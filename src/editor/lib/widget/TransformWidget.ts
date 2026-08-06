import { EDITOR_CONSTANTS } from '@/editor/constants'
import { getSingleBasicMaterialOrThrow } from '@/editor/lib/ThreeUtils'
import {
	CORNER_HANDLE_SIGNS,
	EDGE_HANDLE_SIGNS,
	HandleAxisSign,
	TransformHandleId,
} from '@/editor/lib/widget/TransformHandleLayout'
import { computeScreenSpaceScale } from '@/editor/lib/widget/screenSpaceScale'
import type { Editor } from '@/editor/main/Editor'
import { HitResult, HitResultType } from '@/editor/main/HitTester'
import { WidgetTransformService } from '@/editor/services/WidgetTransformService'
import { Container } from '@/lib/di/container'
import {
	BufferGeometry,
	CircleGeometry,
	DoubleSide,
	Group,
	Intersection,
	Line,
	LineBasicMaterial,
	LineLoop,
	Mesh,
	MeshBasicMaterial,
	Object3D,
	PlaneGeometry,
	Vector2,
	Vector3,
} from 'three'
import { BaseWidget } from './BaseWidget'
import { Handle, HandleUserData } from './Handle'
import { IHandle } from './IWidget'
import { WidgetStrategy } from './WidgetStrategy'

type HandleKind = 'move' | 'resize' | 'rotate'

interface TransformHandlePayload {
	kind: HandleKind
	handleType?: TransformHandleId
}

/** A billboarded handle's visual + its (larger) invisible hit-test collider, both children of an anchor Group that TransformWidget re-orients/re-scales to face the camera every frame. */
interface HandleAnchor {
	anchor: Group
	handle: IHandle
}

const HIT_RESULT_TYPE_BY_KIND: Record<HandleKind, HitResultType> = {
	move: HitResultType.MoveHandle,
	resize: HitResultType.ResizeHandle,
	rotate: HitResultType.RotateHandle,
}

/**
 * Combined move/scale/rotate widget for a tangent-plane patch: a box outline tracing the
 * patch's real oriented bounding box (see updateBounds - grows/shrinks with the patch, unlike
 * the handles), 4 corner + 4 edge scale handles, and a rotate handle offset above the top edge
 * on a connecting stick. Every handle sits inside its own anchor Group, re-oriented to face the
 * camera and re-scaled every camera update (see updateBillboards) so handles stay a constant,
 * camera-facing size on screen regardless of zoom or the patch's own orientation. Dragging the
 * box body (not a handle) moves the patch - see the body collider/handle below.
 */
export class TransformWidget extends BaseWidget {
	private static readonly HANDLE_VISUAL_SIZE = 0.032
	private static readonly HANDLE_HIT_SIZE = 0.09
	private static readonly ROTATE_VISUAL_RADIUS = 0.018
	private static readonly ROTATE_HIT_SIZE = 0.1
	private static readonly ROTATE_OFFSET = 0.12
	private static readonly BODY_DRAG_OPACITY = 0.15

	private static readonly BOX_COLOR = 0x4a90e2
	private static readonly HANDLE_COLOR = 0x4a90e2
	private static readonly ROTATE_COLOR = 0x0080ff

	private halfWidth: number
	private halfHeight: number

	private readonly boxOutline: LineLoop
	private readonly boxFill: Mesh
	private readonly bodyHandle: IHandle

	private readonly cornerTL: HandleAnchor
	private readonly cornerTR: HandleAnchor
	private readonly cornerBL: HandleAnchor
	private readonly cornerBR: HandleAnchor

	private readonly edgeLeft: HandleAnchor
	private readonly edgeRight: HandleAnchor
	private readonly edgeTop: HandleAnchor
	private readonly edgeBottom: HandleAnchor

	private readonly rotate: HandleAnchor
	private readonly rotateStick: Line

	private readonly handles: IHandle[]
	private readonly billboardAnchors: Group[]

	private readonly widgetTransformService: WidgetTransformService =
		this.container.resolve<WidgetTransformService>('WidgetTransformService')

	public constructor(
		position: Vector3,
		normal: Vector3,
		uAxis: Vector3,
		vAxis: Vector3,
		halfExtents: Vector2,
		editor: Editor,
		private readonly container: Container,
		rotation: number = 0
	) {
		super()

		this.group.name = 'TransformWidget'
		this.group.position.copy(position)

		const quaternion = this.widgetTransformService.calculateWidgetOrientation(normal, uAxis, vAxis, rotation)
		this.group.quaternion.copy(quaternion)
		this.group.visible = true

		this.halfWidth = halfExtents.x
		this.halfHeight = halfExtents.y

		this.boxOutline = this.createBoxOutline()
		this.boxFill = this.createBoxFill()
		this.bodyHandle = this.createBodyHandle()

		this.cornerTL = this.createSquareHandle('corner-tl')
		this.cornerTR = this.createSquareHandle('corner-tr')
		this.cornerBL = this.createSquareHandle('corner-bl')
		this.cornerBR = this.createSquareHandle('corner-br')

		this.edgeLeft = this.createSquareHandle('edge-left')
		this.edgeRight = this.createSquareHandle('edge-right')
		this.edgeTop = this.createSquareHandle('edge-top')
		this.edgeBottom = this.createSquareHandle('edge-bottom')

		this.rotateStick = this.createRotateStick()
		this.rotate = this.createRotateHandle()

		this.handles = [
			this.bodyHandle,
			this.cornerTL.handle,
			this.cornerTR.handle,
			this.cornerBL.handle,
			this.cornerBR.handle,
			this.edgeLeft.handle,
			this.edgeRight.handle,
			this.edgeTop.handle,
			this.edgeBottom.handle,
			this.rotate.handle,
		]
		this.billboardAnchors = [
			this.cornerTL.anchor,
			this.cornerTR.anchor,
			this.cornerBL.anchor,
			this.cornerBR.anchor,
			this.edgeLeft.anchor,
			this.edgeRight.anchor,
			this.edgeTop.anchor,
			this.edgeBottom.anchor,
			this.rotate.anchor,
		]

		this.applyBounds()

		editor.overlayScene.add(this.group)
		this.subscribeToCameraUpdates(editor, () => this.updateBillboards(editor))
	}

	private createBoxOutline(): LineLoop {
		const points = [new Vector3(-0.5, -0.5, 0), new Vector3(0.5, -0.5, 0), new Vector3(0.5, 0.5, 0), new Vector3(-0.5, 0.5, 0)]
		const geometry = new BufferGeometry().setFromPoints(points)
		const material = new LineBasicMaterial({ color: TransformWidget.BOX_COLOR, depthTest: false })
		const outline = new LineLoop(geometry, material)
		outline.name = 'BoxOutline'
		this.group.add(outline)
		return outline
	}

	private createBoxFill(): Mesh {
		const geometry = new PlaneGeometry(1, 1)
		const material = new MeshBasicMaterial({
			color: TransformWidget.BOX_COLOR,
			transparent: true,
			opacity: 0,
			depthTest: false,
			side: DoubleSide,
		})
		const fill = new Mesh(geometry, material)
		fill.name = 'BoxFill'
		this.group.add(fill)
		return fill
	}

	private createBodyHandle(): IHandle {
		const collider = this.createPlaneCollider('BodyHitTest', 1)
		this.group.add(collider)
		const payload: TransformHandlePayload = { kind: 'move' }
		return new Handle('TransformBodyHandle', collider, this.boxFill, this, payload, true)
	}

	private createSquareHandle(handleType: TransformHandleId): HandleAnchor {
		const anchor = new Group()
		anchor.name = `${handleType}-anchor`
		this.group.add(anchor)

		const geometry = new PlaneGeometry(TransformWidget.HANDLE_VISUAL_SIZE, TransformWidget.HANDLE_VISUAL_SIZE)
		const material = new MeshBasicMaterial({ color: TransformWidget.HANDLE_COLOR, depthTest: false, side: DoubleSide })
		const mesh = new Mesh(geometry, material)
		mesh.name = `${handleType}-visual`
		anchor.add(mesh)

		const collider = this.createPlaneCollider(`${handleType}-hitTest`, TransformWidget.HANDLE_HIT_SIZE)
		anchor.add(collider)

		const payload: TransformHandlePayload = { kind: 'resize', handleType }
		const handle = new Handle(`Transform${handleType}`, collider, mesh, this, payload)
		return { anchor, handle }
	}

	private createRotateStick(): Line {
		const geometry = new BufferGeometry().setFromPoints([new Vector3(0, 0, 0), new Vector3(0, 1, 0)])
		const material = new LineBasicMaterial({ color: TransformWidget.ROTATE_COLOR, depthTest: false })
		const stick = new Line(geometry, material)
		stick.name = 'RotateStick'
		this.group.add(stick)
		return stick
	}

	private createRotateHandle(): HandleAnchor {
		const anchor = new Group()
		anchor.name = 'rotate-anchor'
		this.group.add(anchor)

		const geometry = new CircleGeometry(TransformWidget.ROTATE_VISUAL_RADIUS, 24)
		const material = new MeshBasicMaterial({ color: TransformWidget.ROTATE_COLOR, depthTest: false, side: DoubleSide })
		const mesh = new Mesh(geometry, material)
		mesh.name = 'rotate-visual'
		anchor.add(mesh)

		const collider = this.createPlaneCollider('rotate-hitTest', TransformWidget.ROTATE_HIT_SIZE)
		anchor.add(collider)

		const payload: TransformHandlePayload = { kind: 'rotate' }
		const handle = new Handle('TransformRotateHandle', collider, mesh, this, payload)
		return { anchor, handle }
	}

	private createPlaneCollider(name: string, size: number): Mesh {
		const geometry = new PlaneGeometry(size, size)
		const material = new MeshBasicMaterial({ transparent: true, opacity: 0, side: DoubleSide })
		const mesh = new Mesh(geometry, material)
		mesh.name = name
		return mesh
	}

	/** Repositions the box outline/fill/body and every handle anchor from halfWidth/halfHeight - called at construction and again from updateBounds whenever the patch is resized. */
	private applyBounds(): void {
		const width = this.halfWidth * 2
		const height = this.halfHeight * 2

		this.boxOutline.scale.set(width, height, 1)
		this.boxFill.scale.set(width, height, 1)
		this.bodyHandle.getCollider().scale.set(width, height, 1)

		this.positionAnchor(this.cornerTL.anchor, CORNER_HANDLE_SIGNS['corner-tl'])
		this.positionAnchor(this.cornerTR.anchor, CORNER_HANDLE_SIGNS['corner-tr'])
		this.positionAnchor(this.cornerBL.anchor, CORNER_HANDLE_SIGNS['corner-bl'])
		this.positionAnchor(this.cornerBR.anchor, CORNER_HANDLE_SIGNS['corner-br'])

		this.positionAnchor(this.edgeLeft.anchor, EDGE_HANDLE_SIGNS['edge-left'])
		this.positionAnchor(this.edgeRight.anchor, EDGE_HANDLE_SIGNS['edge-right'])
		this.positionAnchor(this.edgeTop.anchor, EDGE_HANDLE_SIGNS['edge-top'])
		this.positionAnchor(this.edgeBottom.anchor, EDGE_HANDLE_SIGNS['edge-bottom'])

		this.rotate.anchor.position.set(0, this.halfHeight + TransformWidget.ROTATE_OFFSET, 0)
		this.rotateStick.position.set(0, this.halfHeight, 0)
		this.rotateStick.scale.set(1, TransformWidget.ROTATE_OFFSET, 1)
	}

	private positionAnchor(anchor: Group, signs: HandleAxisSign): void {
		anchor.position.set(signs.uSign * this.halfWidth, signs.vSign * this.halfHeight, 0)
	}

	/** Re-orients every handle anchor to face the camera and re-scales it to stay a constant size on screen - subscribed once per camera update, see the constructor. */
	private updateBillboards(editor: Editor): void {
		const localCameraQuaternion = this.group.quaternion.clone().invert().multiply(editor.camera.quaternion)
		const scale = computeScreenSpaceScale(editor.camera, this.group.position, EDITOR_CONSTANTS.WIDGET_REFERENCE_DISTANCE)

		for (const anchor of this.billboardAnchors) {
			anchor.quaternion.copy(localCameraQuaternion)
			anchor.scale.setScalar(scale)
		}
	}

	/** Called by the resize gesture as mesh.scale changes, so the box outline/handles track the patch's real size live during the drag. */
	public updateBounds(halfExtents: Vector2): void {
		this.halfWidth = halfExtents.x
		this.halfHeight = halfExtents.y
		this.applyBounds()
	}

	/** Toggles the box interior's ~15% fill, shown only while the body is actively being dragged (moved) - see MovePlacedMeshInteractionHandler. */
	public setBodyDragging(dragging: boolean): void {
		getSingleBasicMaterialOrThrow(this.boxFill).opacity = dragging ? TransformWidget.BODY_DRAG_OPACITY : 0
	}

	public getHandles(): IHandle[] {
		return this.handles
	}

	public getColliders(): Mesh[] {
		return this.handles.map((h) => h.getCollider())
	}

	public setEnabledHandles(strategy: WidgetStrategy): void {
		this.setHandleEnabled(this.bodyHandle, strategy.canMoveCenter())
		this.setHandleEnabled(this.cornerTL.handle, strategy.canResizeCorners())
		this.setHandleEnabled(this.cornerTR.handle, strategy.canResizeCorners())
		this.setHandleEnabled(this.cornerBL.handle, strategy.canResizeCorners())
		this.setHandleEnabled(this.cornerBR.handle, strategy.canResizeCorners())
		this.setHandleEnabled(this.edgeLeft.handle, strategy.canResizeX())
		this.setHandleEnabled(this.edgeRight.handle, strategy.canResizeX())
		this.setHandleEnabled(this.edgeTop.handle, strategy.canResizeY())
		this.setHandleEnabled(this.edgeBottom.handle, strategy.canResizeY())
		this.setHandleEnabled(this.rotate.handle, strategy.canRotate())
	}

	private setHandleEnabled(handle: IHandle, enabled: boolean): void {
		handle.getVisual().visible = enabled
		handle.getCollider().visible = enabled
	}

	getType(): 'transform' {
		return 'transform'
	}

	getHandleHitResult(intersected: Object3D, intersection: Intersection): HitResult | null {
		const userData = intersected.userData as HandleUserData
		const payload = userData?.payload as TransformHandlePayload | undefined
		if (!payload || !userData?.handle) {
			return null
		}
		return {
			type: HIT_RESULT_TYPE_BY_KIND[payload.kind],
			object: intersected,
			intersection,
			handleType: payload.handleType,
			handle: userData.handle,
			widget: this,
			payload,
		}
	}

	public destroy(): void {
		this.disposeCameraSubscription()
		this.group.traverse((child) => {
			const obj = child as Object3D & {
				geometry?: { dispose: () => void }
				material?: { dispose: () => void } | { dispose: () => void }[]
			}
			if (obj.geometry) {
				obj.geometry.dispose()
			}
			if (obj.material) {
				if (Array.isArray(obj.material)) {
					obj.material.forEach((mat) => mat.dispose())
				} else {
					obj.material.dispose()
				}
			}
		})
		this.group.parent?.remove(this.group)
	}
}
