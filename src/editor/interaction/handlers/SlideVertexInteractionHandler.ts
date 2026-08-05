import { CanvasEventType } from '@/editor/interaction/CanvasEventType'
import { InteractionEvent } from '@/editor/interaction/InteractionEvent'
import { InteractionHandler } from '@/editor/interaction/InteractionHandler'
import { InteractionHandlerResult } from '@/editor/interaction/InteractionHandlerResult'
import { Editor } from '@/editor/main/Editor'
import { HitResultType, PlacedMeshVertexPayload } from '@/editor/main/HitTester'
import { SurfaceReprojector } from '@/editor/main/SurfaceReprojector'
import { PointerMathService } from '@/editor/services/PointerMathService'
import { container } from '@/lib/di/container'
import { Matrix3, Mesh, Vector3 } from 'three'

/**
 * Fine-tune gesture for a wrapped mesh: drags a single vertex, reprojecting
 * it against the body mesh live (like the move-handle's center drag, but
 * per-vertex instead of rigid). Only ever enabled when HitTester resolves a
 * PlacedMeshVertex hit, which itself only happens for the selected+wrapped
 * mesh - see HitTester.testWrappedMeshVertex.
 *
 * Dragging one vertex also nudges nearby vertices, tapering off with graph
 * distance (proportional/soft-selection editing) - the neighbor set and
 * their distances are computed once at drag start from the mesh's own edge
 * connectivity, the same Dijkstra-by-local-edge-length approach
 * PlacedMeshWrapper uses to march the wrap.
 *
 * Every affected vertex is re-reprojected onto the body surface each update
 * (not just linearly translated), so the falloff patch actually tracks the
 * body's curvature instead of drifting off it - via SurfaceReprojector, the
 * same primitive PlacedMeshWrapper's march uses. That's an extra raycast
 * per affected vertex, so the expensive part of the update is throttled to
 * once per animation frame (see rafHandle) rather than once per raw pointer
 * event, which would otherwise fire far more often than the screen redraws.
 */
export class SlideVertexInteractionHandler implements InteractionHandler {
	public id: string = 'slide-vertex'

	public priority: number = 65

	public enabled: boolean = true

	private isActive: boolean = false
	private activePlacedMeshId: string | null = null
	private activeVertexIndex: number | null = null
	private beforePositions: Float32Array | null = null
	private falloffWeights: Map<number, number> | null = null
	private hasPreviewChanges: boolean = false
	private pendingLocalPoint: Vector3 | null = null
	private rafHandle: number | null = null
	private readonly surfaceReprojector: SurfaceReprojector = new SurfaceReprojector()
	private readonly pointerMathService: PointerMathService = container.resolve<PointerMathService>('PointerMathService')

	public constructor(private readonly editor: Editor) {}

	public isEnabled(event: InteractionEvent): boolean {
		if (!this.enabled || !event.context?.hitResult) {
			return false
		}
		return event.context.hitResult.type === HitResultType.PlacedMeshVertex
	}

	public async onEvent(event: InteractionEvent): Promise<InteractionHandlerResult> {
		if (event.type === CanvasEventType.MoveStart) {
			return this.handleMoveStart(event)
		}

		if (this.isActive) {
			if (event.type === CanvasEventType.Move) {
				return this.handleMove(event)
			} else if (event.type === CanvasEventType.MoveEnd) {
				return this.handleMoveEnd()
			}
		}

		return new InteractionHandlerResult().setPass()
	}

	private handleMoveStart(event: InteractionEvent): InteractionHandlerResult {
		const hitResult = event.context.hitResult
		if (!hitResult || hitResult.type !== HitResultType.PlacedMeshVertex) {
			return new InteractionHandlerResult().setPass()
		}

		const payload = hitResult.payload as PlacedMeshVertexPayload | undefined
		if (!payload) {
			return new InteractionHandlerResult().setPass()
		}

		const entry = this.editor.controller.project.placedMeshList.getById(payload.placedMeshId)
		if (!entry) {
			return new InteractionHandlerResult().setPass()
		}

		this.activePlacedMeshId = payload.placedMeshId
		this.activeVertexIndex = payload.vertexIndex
		this.beforePositions = Float32Array.from(entry.mesh.geometry.attributes.position.array)
		this.falloffWeights = this.computeFalloffWeights(entry.mesh, payload.vertexIndex)
		this.hasPreviewChanges = false

		this.isActive = true
		this.editor.controls.enabled = false
		const vertexOverlay = this.editor.controller.getSelectTool().getVertexOverlay()
		vertexOverlay?.setHoveredIndex(payload.vertexIndex)
		vertexOverlay?.setInfluenceWeights(this.falloffWeights)

		return new InteractionHandlerResult().setCapture()
	}

	private handleMove(event: InteractionEvent): InteractionHandlerResult {
		const editor = this.editor
		const raycaster = event.context.raycaster
		const mouse = event.context.mouse
		if (!raycaster || !mouse || this.activePlacedMeshId === null || this.activeVertexIndex === null) {
			return new InteractionHandlerResult().setHandled()
		}

		editor.updateCameraMatrix()
		this.pointerMathService.normalizeMousePosition(
			{ clientX: event.x, clientY: event.y },
			editor.getDomElement(),
			editor.camera,
			raycaster,
			mouse
		)

		const surfaceHits = raycaster.intersectObject(editor.previewMesh.mesh, false)
		if (surfaceHits.length === 0) {
			return new InteractionHandlerResult().setHandled()
		}

		const entry = editor.controller.project.placedMeshList.getById(this.activePlacedMeshId)
		if (!entry) {
			return new InteractionHandlerResult().setHandled()
		}

		entry.mesh.updateMatrixWorld(true)
		this.pendingLocalPoint = entry.mesh.worldToLocal(surfaceHits[0].point.clone())

		// The pointer target is cheap to update every event; the actual reprojection pass below
		// (one raycast per affected vertex) is throttled to once per rendered frame so a fast
		// pointer/high-polling-rate mouse doesn't run it far more often than the screen can show.
		if (this.rafHandle === null) {
			this.rafHandle = requestAnimationFrame(() => {
				this.rafHandle = null
				this.applyPendingMove()
			})
		}

		return new InteractionHandlerResult().setHandled()
	}

	/**
	 * Reprojects every vertex in the falloff set onto the body surface, via SurfaceReprojector:
	 * predict a new position from the delta at the grabbed vertex, then snap it onto the real
	 * surface along the vertex's own (pre-update) normal. A vertex whose ray doesn't hit anything
	 * just keeps its predicted (unprojected) position, mirroring PlacedMeshWrapper's coverage-stall
	 * fallback.
	 */
	private applyPendingMove(): void {
		const localPoint = this.pendingLocalPoint
		const activeIndex = this.activeVertexIndex
		const before = this.beforePositions
		const weights = this.falloffWeights
		if (!localPoint || activeIndex === null || !before || !weights || this.activePlacedMeshId === null) {
			return
		}

		const entry = this.editor.controller.project.placedMeshList.getById(this.activePlacedMeshId)
		if (!entry) {
			return
		}

		entry.mesh.updateMatrixWorld(true)
		const positionAttr = entry.mesh.geometry.attributes.position
		const normalAttr = entry.mesh.geometry.attributes.normal
		const normalMatrix = new Matrix3().getNormalMatrix(entry.mesh.matrixWorld)

		const deltaX = localPoint.x - before[activeIndex * 3]
		const deltaY = localPoint.y - before[activeIndex * 3 + 1]
		const deltaZ = localPoint.z - before[activeIndex * 3 + 2]

		const predicted = new Vector3()
		const worldPredicted = new Vector3()
		const worldNormal = new Vector3()

		for (const [index, weight] of weights) {
			predicted.set(before[index * 3] + deltaX * weight, before[index * 3 + 1] + deltaY * weight, before[index * 3 + 2] + deltaZ * weight)
			worldPredicted.copy(predicted).applyMatrix4(entry.mesh.matrixWorld)
			worldNormal.set(normalAttr.getX(index), normalAttr.getY(index), normalAttr.getZ(index)).applyMatrix3(normalMatrix).normalize()

			const hit = this.surfaceReprojector.reproject(this.editor.previewMesh.mesh, worldPredicted, worldNormal)
			const newWorldPoint = hit ? hit.point : worldPredicted
			const newLocalPoint = entry.mesh.worldToLocal(newWorldPoint.clone())
			positionAttr.setXYZ(index, newLocalPoint.x, newLocalPoint.y, newLocalPoint.z)
		}

		positionAttr.needsUpdate = true
		entry.mesh.geometry.computeVertexNormals()
		this.editor.controller.getSelectTool().getVertexOverlay()?.refresh()
		this.editor.controller.getSelectTool().getWireframeOverlay()?.refresh()

		this.hasPreviewChanges = true
	}

	private handleMoveEnd(): InteractionHandlerResult {
		if (!this.isActive) {
			return new InteractionHandlerResult().setPass()
		}

		// Flush any throttled update still pending so the undo snapshot below reflects the
		// pointer's actual final position, not whatever the last rendered frame applied.
		if (this.rafHandle !== null) {
			cancelAnimationFrame(this.rafHandle)
			this.rafHandle = null
			this.applyPendingMove()
		}

		this.editor.controls.enabled = true
		this.editor.controller.getSelectTool().getVertexOverlay()?.setInfluenceWeights(null)
		if (this.hasPreviewChanges && this.activePlacedMeshId && this.beforePositions) {
			const entry = this.editor.controller.project.placedMeshList.getById(this.activePlacedMeshId)
			if (entry) {
				const afterPositions = Float32Array.from(entry.mesh.geometry.attributes.position.array)
				this.editor.controller.historyController.execute(
					this.editor.commandFactory.createUpdateWrappedMeshVerticesCommand(
						this.activePlacedMeshId,
						this.beforePositions,
						afterPositions
					)
				)
			}
		}

		this.isActive = false
		this.activePlacedMeshId = null
		this.activeVertexIndex = null
		this.beforePositions = null
		this.falloffWeights = null
		this.pendingLocalPoint = null
		this.hasPreviewChanges = false

		return new InteractionHandlerResult().setReleaseCapture()
	}

	/**
	 * Dijkstra over the mesh's own edge graph (weighted by local-space edge
	 * length) from the grabbed vertex, kept only up to FALLOFF_RADIUS and
	 * converted to a smooth 1..0 weight (cosine falloff) - the grabbed vertex
	 * itself always gets weight 1.
	 */
	private computeFalloffWeights(mesh: Mesh, originIndex: number): Map<number, number> {
		const positionAttr = mesh.geometry.attributes.position
		const index = mesh.geometry.index
		const vertexCount = positionAttr.count

		const local: Vector3[] = []
		for (let i = 0; i < vertexCount; i++) {
			local.push(new Vector3(positionAttr.getX(i), positionAttr.getY(i), positionAttr.getZ(i)))
		}

		const adjacency: number[][] = Array.from({ length: vertexCount }, () => [])
		if (index) {
			for (let t = 0; t < index.count; t += 3) {
				const a = index.getX(t)
				const b = index.getX(t + 1)
				const c = index.getX(t + 2)
				adjacency[a].push(b, c)
				adjacency[b].push(a, c)
				adjacency[c].push(a, b)
			}
		}

		const radius = this.editor.controller.getSlideVertexFalloffRadius()
		const dist = new Array<number>(vertexCount).fill(Infinity)
		const visited = new Array<boolean>(vertexCount).fill(false)
		dist[originIndex] = 0

		const weights = new Map<number, number>()

		for (let iter = 0; iter < vertexCount; iter++) {
			let u = -1
			let best = Infinity
			for (let i = 0; i < vertexCount; i++) {
				if (!visited[i] && dist[i] < best) {
					best = dist[i]
					u = i
				}
			}
			// The true global minimum unvisited distance already exceeds the falloff
			// radius, so every remaining vertex does too - safe to stop marching.
			if (u === -1 || best > radius) {
				break
			}
			visited[u] = true

			const t = best / radius
			weights.set(u, u === originIndex ? 1 : 0.5 * (Math.cos(Math.PI * t) + 1))

			for (const v of adjacency[u]) {
				const weight = local[u].distanceTo(local[v])
				if (dist[u] + weight < dist[v]) {
					dist[v] = dist[u] + weight
				}
			}
		}

		return weights
	}
}
