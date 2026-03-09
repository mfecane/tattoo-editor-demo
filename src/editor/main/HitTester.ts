import { CanvasEventHandler } from '@/editor/interaction/CanvasEventHandler'
import { HandleUserData } from '@/editor/lib/widget/Handle'
import { IHandle, IWidget } from '@/editor/lib/widget/IWidget'
import { Editor } from '@/editor/main/Editor'
import { EditorToolId } from '@/editor/main/tools/EditorTool'
import { Intersection, Mesh, Object3D, Raycaster } from 'three'

export enum HitResultType {
	ResizeHandle = 'resize-handle',
	RotateHandle = 'rotate-handle',
	MoveHandle = 'move-handle',
	WidgetBody = 'widget-body',
	ImageHandle = 'image-handle',
	SelectableObject = 'selectable-object',
	Empty = 'empty',
	WidgetHandle = 'widget-handle',
}

export interface HitResult {
	type: HitResultType
	object?: Object3D
	intersection?: Intersection
	handleType?: 'x' | 'y' | 'center'
	stampIndex?: number // Index of the stamp when clicking on image-handle
	widget?: IWidget
	handle?: IHandle
	payload?: unknown
}

export class HitTester {
	public readonly canvasEventHandler: CanvasEventHandler

	private colliders: Mesh[] = []

	public constructor(private readonly editor: Editor) {
		this.canvasEventHandler = new CanvasEventHandler(this.editor)
	}

	public performHitTest(raycaster: Raycaster): HitResult {
		const targetMesh = this.editor.previewMesh.mesh

		const handleIntersects = raycaster.intersectObjects(this.colliders, false)
		if (handleIntersects.length > 0) {
			const handleIntersection = handleIntersects[0]
			const userData = handleIntersection.object.userData as Partial<HandleUserData> & {
				isRotateHandle?: boolean
				isHitTest?: boolean
			}
			const payload = userData.payload as { handleType?: 'x' | 'y' | 'center' } | undefined

			if (
				userData.widget !== undefined &&
				userData.widget !== null &&
				typeof userData.widget.getType === 'function'
			) {
				const widgetType = userData.widget.getType()

				if (widgetType === EditorToolId.Move && payload && payload.handleType) {
					return {
						type: HitResultType.MoveHandle,
						object: handleIntersection.object,
						intersection: handleIntersection,
						handleType: payload.handleType,
						payload: userData.payload,
						widget: userData.widget,
						handle: userData.handle,
					}
				}

				if (widgetType === 'scaling' && payload && payload.handleType) {
					return {
						type: HitResultType.ResizeHandle,
						object: handleIntersection.object,
						intersection: handleIntersection,
						handleType: payload.handleType,
						payload: userData.payload,
						widget: userData.widget,
						handle: userData.handle,
					}
				}

				if (widgetType === 'rotate') {
					return {
						type: HitResultType.RotateHandle,
						object: handleIntersection.object,
						intersection: handleIntersection,
						payload: userData.payload,
						widget: userData.widget,
						handle: userData.handle,
					}
				}

				return {
					type: HitResultType.WidgetHandle,
					object: handleIntersection.object,
					intersection: handleIntersection,
					payload: userData.payload,
					widget: userData.widget,
					handle: userData.handle,
				}
			}

			if (userData.isHitTest === true && userData.isRotateHandle === true) {
				return {
					type: HitResultType.RotateHandle,
					object: handleIntersection.object,
					intersection: handleIntersection,
					payload: userData.payload,
				}
			}

			return {
				type: HitResultType.WidgetHandle,
				object: handleIntersection.object,
				intersection: handleIntersection,
				payload: userData.payload,
			}
		}

		if (targetMesh) {
			const meshIntersects = raycaster.intersectObject(targetMesh)
			if (meshIntersects.length > 0) {
				const intersection = meshIntersects[0]
				const maxReasonableDistance = 100
				if (intersection.distance < maxReasonableDistance && intersection.uv !== undefined) {
					return {
						type: HitResultType.SelectableObject,
						object: targetMesh,
						intersection: intersection,
					}
				}
			}
		}

		return { type: HitResultType.Empty }
	}

	public addColliders(colliders: Mesh[]): void {
		this.colliders.push(...colliders)
	}

	public clearColliders(): void {
		this.colliders = []
	}
}
