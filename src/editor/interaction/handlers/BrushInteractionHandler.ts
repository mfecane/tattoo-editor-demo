import { CanvasEventType } from '@/editor/interaction/CanvasEventType'
import { InteractionEvent } from '@/editor/interaction/InteractionEvent'
import { InteractionHandler } from '@/editor/interaction/InteractionHandler'
import { InteractionHandlerResult } from '@/editor/interaction/InteractionHandlerResult'
import { EDITOR_CONSTANTS } from '@/editor/lib/constants'
import { getStrategy } from '@/editor/lib/lattice/ProjectionStrategyFactory'
import { throttleFPS } from '@/editor/lib/utils'
import { Editor } from '@/editor/main/Editor'
import { BrushStrokeCommand } from '@/editor/main/commands/BrushStrokeCommand'
import { GeometryProjectionService } from '@/editor/services/GeometryProjectionService'
import { PointerMathService } from '@/editor/services/PointerMathService'
import { container } from '@/lib/di/container'
import { Raycaster, Vector2, Vector3 } from 'three'

export class BrushInteractionHandler implements InteractionHandler {
	public id: string = 'brush'

	public priority: number = 90

	public enabled: boolean = false

	private isActive: boolean = false
	private initialUV: Vector2 = new Vector2()
	private uAxis: Vector3 | null = null
	private vAxis: Vector3 | null = null
	private throttledOnPointerMove: (event: InteractionEvent) => void
	private mouse: Vector2 = new Vector2()
	private previousMousePos: Vector2 | null = null
	private raycaster: Raycaster | null = null
	private activeStampId: string | null = null
	private initialLatticeVertices: Array<[number, number, number]> | null = null
	private hasPreviewChanges: boolean = false
	private readonly geometryProjectionService: GeometryProjectionService =
		container.resolve<GeometryProjectionService>('GeometryProjectionService')
	private readonly pointerMathService: PointerMathService = container.resolve<PointerMathService>('PointerMathService')

	public constructor(private readonly editor: Editor) {
		this.throttledOnPointerMove = throttleFPS(
			this.onPointerMoveInternal.bind(this),
			EDITOR_CONSTANTS.BRUSH_THROTTLE_FPS
		)
	}

	public isEnabled(event: InteractionEvent): boolean {
		if (!this.enabled || !event.context?.hitResult) {
			return false
		}

		const controller = this.editor.controller
		if (!controller || !this.editor.reactBridge.state.isBrushMode) return false
		const state = controller.getState()
		if (state.selectedStampId === null) return false

		const hitResult = event.context.hitResult
		if (hitResult.type === 'image-handle') {
			const hitStampId = this.resolveHitStampId(hitResult.stampIndex)
			if (hitStampId !== state.selectedStampId) {
				return false
			}
		}

		const selectedStamp = controller.project.stampList.getStampById(state.selectedStampId)
		return (
			(hitResult.type === 'selectable-object' || hitResult.type === 'image-handle') &&
			selectedStamp?.data.stampInfo !== null &&
			selectedStamp?.latticeMesh !== null
		)
	}

	public async onEvent(event: InteractionEvent): Promise<InteractionHandlerResult> {
		if (event.type === CanvasEventType.MoveStart) {
			if (!event.context || !event.context.hitResult) {
				return new InteractionHandlerResult().setPass()
			}

			const hitResult = event.context.hitResult
			const controller = this.editor.controller
			const state = controller.getState()

			if (!this.editor.reactBridge.state.isBrushMode || state.selectedStampId === null) {
				return new InteractionHandlerResult().setPass()
			}

			if (hitResult.type === 'image-handle') {
				const hitStampId = this.resolveHitStampId(hitResult.stampIndex)
				if (hitStampId !== state.selectedStampId) {
					return new InteractionHandlerResult().setPass()
				}
			}

			const selectedStamp = controller.project.stampList.getStampById(state.selectedStampId)
			if (
				!(hitResult.type === 'selectable-object' || hitResult.type === 'image-handle') ||
				!selectedStamp?.data.stampInfo ||
				!selectedStamp?.latticeMesh
			) {
				return new InteractionHandlerResult().setPass()
			}

			return this.handleMoveStart(event, this.editor)
		}

		if (this.isActive) {
			if (event.type === CanvasEventType.Move) {
				return this.handleMove(event, this.editor)
			} else if (event.type === CanvasEventType.MoveEnd) {
				return this.handleMoveEnd(event)
			}
		}

		return new InteractionHandlerResult().setPass()
	}

	private handleMoveStart(event: InteractionEvent, editor: Editor): InteractionHandlerResult {
		const raycaster = (event.context as any).raycaster
		const mouse = (event.context as any).mouse

		editor.updateCameraMatrix()
		this.pointerMathService.normalizeMousePosition(
			{ clientX: event.x, clientY: event.y },
			editor.getDomElement(),
			editor.camera,
			raycaster,
			mouse
		)

		this.mouse = mouse
		this.raycaster = raycaster
		this.previousMousePos = mouse.clone()

		const controller = editor.controller
		const state = controller.getState()
		const selectedStampId = state.selectedStampId
		const selectedStamp = selectedStampId ? controller.project.stampList.getStampById(selectedStampId) : null
		const asset = editor.previewMesh.mesh

		if (!selectedStamp || !this.raycaster || !asset) {
			return new InteractionHandlerResult().setPass()
		}

		const assetIntersects = this.raycaster.intersectObject(asset)
		if (assetIntersects.length === 0) {
			return new InteractionHandlerResult().setPass()
		}

		const intersection = assetIntersects[0]
		if (!intersection.uv) {
			return new InteractionHandlerResult().setPass()
		}
		const uv = intersection.uv.clone()
		const normal = intersection.normal
			? intersection.normal.clone().transformDirection(asset.matrixWorld)
			: new Vector3(0, 1, 0)

		const faceIndex = intersection.faceIndex ?? 0
		const tangentVectors = this.geometryProjectionService.calculateTangentVectors(asset.geometry, faceIndex, normal)
		this.uAxis = tangentVectors.uAxis
		this.vAxis = tangentVectors.vAxis

		this.initialUV = uv.clone()
		this.activeStampId = selectedStamp.data.id
		this.initialLatticeVertices = selectedStamp.latticeMesh.extractLatticeVertices()
		this.hasPreviewChanges = false

		this.isActive = true
		editor.controls.enabled = false
		this.editor.reactBridge.setBrushActive(true)
		this.editor.reactBridge.hideStampContextMenu()

		return new InteractionHandlerResult().setCapture()
	}

	private handleMove(event: InteractionEvent, editor: Editor): InteractionHandlerResult {
		if (!this.isActive) {
			return new InteractionHandlerResult().setHandled()
		}
		this.throttledOnPointerMove(event)
		return new InteractionHandlerResult().setHandled()
	}

	private onPointerMoveInternal(event: InteractionEvent): void {
		const raycaster = (event.context as any).raycaster
		const mouse = (event.context as any).mouse

		this.editor.updateCameraMatrix()
		this.pointerMathService.normalizeMousePosition(
			{ clientX: event.x, clientY: event.y },
			this.editor.getDomElement(),
			this.editor.camera,
			raycaster,
			mouse
		)

		this.mouse = mouse
		this.raycaster = raycaster

		const controller = this.editor.controller
		const state = controller.getState()
		const selectedStampId = state.selectedStampId
		const selectedStamp = selectedStampId ? controller.project.stampList.getStampById(selectedStampId) : null
		const stampInfo = selectedStamp?.data.stampInfo
		const latticeMesh = selectedStamp?.latticeMesh
		const asset = this.editor.previewMesh.mesh

		if (selectedStampId === null) {
			this.isActive = false
			this.editor.controls.enabled = true
			this.previousMousePos = null
			this.editor.reactBridge.setBrushActive(false)
			return
		}
		if (!stampInfo || !latticeMesh || !asset || !this.uAxis || !this.vAxis || !this.raycaster) {
			return
		}

		const currentMousePos = this.mouse.clone()
		if (!this.previousMousePos) {
			this.previousMousePos = currentMousePos.clone()
			return
		}

		const screenDirection = new Vector2()
		screenDirection.subVectors(currentMousePos, this.previousMousePos)

		const screenU = new Vector2()
		const screenV = new Vector2()

		const uAxisWorld = this.uAxis.clone().transformDirection(asset.matrixWorld)
		const uAxisScreen = uAxisWorld.clone().project(this.editor.camera)
		screenU.set(uAxisScreen.x * this.editor.camera.aspect, uAxisScreen.y)

		const vAxisWorld = this.vAxis.clone().transformDirection(asset.matrixWorld)
		const vAxisScreen = vAxisWorld.clone().project(this.editor.camera)
		screenV.set(vAxisScreen.x * this.editor.camera.aspect, vAxisScreen.y)

		screenU.normalize()
		screenV.normalize()

		const uComponent = screenDirection.dot(screenU)
		const vComponent = screenDirection.dot(screenV)

		const uvDirection = new Vector2(uComponent, vComponent)
		const brushStrength = this.editor.reactBridge.state.brushStrength
		uvDirection.multiplyScalar(brushStrength)
		if (uvDirection.lengthSq() === 0) {
			this.previousMousePos.copy(currentMousePos)
			return
		}

		const strategy = getStrategy(selectedStamp.data.projectionType || 'cylindrical-lattice')
		const brushSize = this.editor.reactBridge.state.brushSize
		latticeMesh.deformVertices(
			this.initialUV,
			uvDirection,
			() => (this.editor.controller.latticeNeedsRender = true),
			strategy,
			brushSize
		)
		this.hasPreviewChanges = true

		this.previousMousePos.copy(currentMousePos)
	}

	private handleMoveEnd(_event: InteractionEvent): InteractionHandlerResult {
		if (!this.isActive) {
			return new InteractionHandlerResult().setPass()
		}

		this.editor.controls.enabled = true
		if (this.hasPreviewChanges && this.activeStampId && this.initialLatticeVertices) {
			const stamp = this.editor.controller.project.stampList.getStampById(this.activeStampId)
			const finalVertices = stamp.latticeMesh.extractLatticeVertices()
			this.editor.controller.historyController.execute(
				new BrushStrokeCommand(this.activeStampId, this.initialLatticeVertices, finalVertices, this.editor.controller)
			)
		}

		this.isActive = false
		this.uAxis = null
		this.vAxis = null
		this.previousMousePos = null
		this.activeStampId = null
		this.initialLatticeVertices = null
		this.hasPreviewChanges = false
		this.editor.reactBridge.setBrushActive(false)
		this.editor.reactBridge.showStampContextMenu()

		return new InteractionHandlerResult().setReleaseCapture()
	}

	private resolveHitStampId(stampIndex: number | undefined): string | null {
		if (stampIndex === undefined) {
			return null
		}

		const stamp = this.editor.controller.project.stampList.getStamps()[stampIndex]
		return stamp ? stamp.data.id : null
	}
}
