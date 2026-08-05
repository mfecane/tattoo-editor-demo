import { VERTEX_SLIDE_CONSTANTS } from '@/editor/constants'
import { HandleUserData } from '@/editor/lib/widget/Handle'
import { IHandle, IWidget } from '@/editor/lib/widget/IWidget'
import { TransformHandleId } from '@/editor/lib/widget/TransformHandleLayout'
import { Editor } from '@/editor/main/Editor'
import { Intersection, Mesh, Object3D, Raycaster, Vector3 } from 'three'

export enum HitResultType {
	ResizeHandle = 'resize-handle',
	RotateHandle = 'rotate-handle',
	MoveHandle = 'move-handle',
	WidgetBody = 'widget-body',
	SelectableObject = 'selectable-object',
	Empty = 'empty',
	WidgetHandle = 'widget-handle',
	PlacedMeshVertex = 'placed-mesh-vertex',
}

export interface PlacedMeshVertexPayload {
	placedMeshId: string
	vertexIndex: number
}

export interface HitResult {
	type: HitResultType
	object?: Object3D
	intersection?: Intersection
	handleType?: TransformHandleId
	widget?: IWidget
	handle?: IHandle
	payload?: unknown
}

export class HitTester {
	private colliders: Mesh[] = []

	public constructor(private readonly editor: Editor) {}

	public performHitTest(raycaster: Raycaster): HitResult {
		const bodyMesh = this.editor.previewMesh.mesh

		const handleIntersects = raycaster.intersectObjects(this.colliders, false)
		const handleIntersection = this.pickHandleIntersection(handleIntersects)
		if (handleIntersection) {
			const userData = handleIntersection.object.userData as Partial<HandleUserData>

			if (
				userData.widget !== undefined &&
				userData.widget !== null &&
				typeof userData.widget.getHandleHitResult === 'function'
			) {
				const widgetHitResult = userData.widget.getHandleHitResult(handleIntersection.object, handleIntersection)
				if (widgetHitResult) {
					return widgetHitResult
				}
			}

			return {
				type: HitResultType.WidgetHandle,
				object: handleIntersection.object,
				intersection: handleIntersection,
				payload: userData.payload,
			}
		}

		const wrappedVertexHit = this.testWrappedMeshVertex(raycaster)
		if (wrappedVertexHit) {
			return wrappedVertexHit
		}

		if (bodyMesh) {
			const meshIntersects = raycaster.intersectObject(bodyMesh)
			if (meshIntersects.length > 0) {
				const intersection = meshIntersects[0]
				const maxReasonableDistance = 100
				if (intersection.distance < maxReasonableDistance && intersection.uv !== undefined) {
					return {
						type: HitResultType.SelectableObject,
						object: bodyMesh,
						intersection: intersection,
					}
				}
			}
		}

		return { type: HitResultType.Empty }
	}

	/**
	 * A body/move collider that overlaps a corner/edge/rotate handle collider must lose to it
	 * regardless of which is nearer along the ray - a handle sitting flush on the patch surface
	 * can be marginally farther from the camera than the body plane beneath it. Falls back to
	 * the nearest hit (which may itself be the body collider) when nothing else is under the ray.
	 */
	private pickHandleIntersection(intersects: Intersection[]): Intersection | null {
		const nonBodyHit = intersects.find((hit) => !(hit.object.userData as Partial<HandleUserData>).isBodyCollider)
		return nonBodyHit ?? intersects[0] ?? null
	}

	/**
	 * When the selected placed mesh is wrapped, clicking near one of its vertices should pick
	 * that vertex for fine-tune dragging, rather than falling through to the body mesh. Raycasts
	 * the body mesh itself (not the decal) so a hit is found even where the decal doesn't cover -
	 * a miss here (off the body, or too far from any decal vertex) is left as no hit at all, so it
	 * falls through to the body/empty cases and orbit rotation takes over as normal.
	 */
	private testWrappedMeshVertex(raycaster: Raycaster): HitResult | null {
		const entry = this.editor.controller.getSelectedPlacedMesh()
		if (!entry || entry.kind !== 'drapedPatch') {
			return null
		}

		const bodyIntersects = raycaster.intersectObject(this.editor.previewMesh.mesh, false)
		if (bodyIntersects.length === 0) {
			return null
		}

		const hitPoint = bodyIntersects[0].point
		const positionAttr = entry.mesh.geometry.attributes.position
		entry.mesh.updateMatrixWorld(true)

		let bestIndex = -1
		let bestDistSq = Infinity
		const vertexWorld = new Vector3()
		for (let i = 0; i < positionAttr.count; i++) {
			vertexWorld.set(positionAttr.getX(i), positionAttr.getY(i), positionAttr.getZ(i))
			vertexWorld.applyMatrix4(entry.mesh.matrixWorld)
			const distSq = vertexWorld.distanceToSquared(hitPoint)
			if (distSq < bestDistSq) {
				bestDistSq = distSq
				bestIndex = i
			}
		}

		if (bestIndex === -1 || bestDistSq > VERTEX_SLIDE_CONSTANTS.VERTEX_PICK_MAX_DISTANCE ** 2) {
			return null
		}

		const payload: PlacedMeshVertexPayload = { placedMeshId: entry.id, vertexIndex: bestIndex }
		return {
			type: HitResultType.PlacedMeshVertex,
			object: entry.mesh,
			intersection: bodyIntersects[0],
			payload,
		}
	}

	public addColliders(colliders: Mesh[]): void {
		this.colliders.push(...colliders)
	}

	public clearColliders(): void {
		this.colliders = []
	}
}
