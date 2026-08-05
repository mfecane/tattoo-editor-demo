import { CanvasEventType } from '@/editor/interaction/CanvasEventType'
import { InteractionEvent } from '@/editor/interaction/InteractionEvent'
import { InteractionHandler } from '@/editor/interaction/InteractionHandler'
import { InteractionHandlerResult } from '@/editor/interaction/InteractionHandlerResult'
import { Editor } from '@/editor/main/Editor'
import { PlacedMeshTransform } from '@/editor/main/commands/UpdatePlacedMeshCommand'
import { PointerMathService } from '@/editor/services/PointerMathService'
import { WidgetTransformService } from '@/editor/services/WidgetTransformService'
import { container } from '@/lib/di/container'
import { Quaternion, Vector2, Vector3 } from 'three'

/**
 * Rotate gesture for a selected PlacedMesh: same screen-space angle math
 * as RotateInteractionHandler, applied as a rotation around the mesh's
 * own local normal (its local +Z) instead of a stampInfo.rotation scalar.
 */
export class RotatePlacedMeshInteractionHandler implements InteractionHandler {
	public id: string = 'rotate-placed-mesh'

	public priority: number = 70

	public enabled: boolean = false

	private isActive: boolean = false
	private initialMousePos: Vector2 = new Vector2()
	private mouse: Vector2 = new Vector2()
	private activePlacedMeshId: string | null = null
	private initialTransform: PlacedMeshTransform | null = null
	private previewTransform: PlacedMeshTransform | null = null
	private hasPreviewChanges: boolean = false
	private readonly pointerMathService: PointerMathService = container.resolve<PointerMathService>('PointerMathService')
	private readonly widgetTransformService: WidgetTransformService =
		container.resolve<WidgetTransformService>('WidgetTransformService')

	public constructor(private readonly editor: Editor) {}

	public isEnabled(event: InteractionEvent): boolean {
		if (!this.enabled || !event.context?.hitResult) {
			return false
		}
		return event.context.hitResult.type === 'rotate-handle' && this.editor.controller.getSelectedPlacedMeshId() !== null
	}

	public async onEvent(event: InteractionEvent): Promise<InteractionHandlerResult> {
		if (event.type === CanvasEventType.MoveStart) {
			if (!event.context || !event.context.hitResult || event.context.hitResult.type !== 'rotate-handle') {
				return new InteractionHandlerResult().setPass()
			}
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
		const editor = this.editor
		const raycaster = event.context.raycaster
		const mouse = event.context.mouse
		if (!raycaster || !mouse) {
			return new InteractionHandlerResult().setPass()
		}

		editor.updateCameraMatrix()
		this.pointerMathService.normalizeMousePosition(
			{ clientX: event.x, clientY: event.y },
			editor.getDomElement(),
			editor.camera,
			raycaster,
			mouse
		)
		this.mouse = mouse
		this.initialMousePos.copy(mouse)

		const controller = editor.controller
		const widget = controller.getTransformTool().getWidget()
		const entry = controller.getSelectedPlacedMesh()
		if (!entry || !widget) {
			return new InteractionHandlerResult().setPass()
		}

		this.activePlacedMeshId = entry.id
		this.initialTransform = {
			position: entry.mesh.position.clone(),
			quaternion: entry.mesh.quaternion.clone(),
			scale: entry.mesh.scale.clone(),
		}
		this.previewTransform = null
		this.hasPreviewChanges = false

		this.isActive = true
		editor.controls.enabled = false

		return new InteractionHandlerResult().setCapture()
	}

	private handleMove(event: InteractionEvent): InteractionHandlerResult {
		const editor = this.editor
		const raycaster = event.context.raycaster
		const mouse = event.context.mouse
		if (!raycaster || !mouse || !this.initialTransform || !this.activePlacedMeshId) {
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
		this.mouse = mouse

		const controller = editor.controller
		const widget = controller.getTransformTool().getWidget()
		const entry = controller.project.placedMeshList.getById(this.activePlacedMeshId)
		if (!widget || !entry) {
			return new InteractionHandlerResult().setHandled()
		}

		const widgetGroup = widget.getGroup()
		widgetGroup.updateMatrixWorld(true)
		const widgetPosition = new Vector3()
		widgetGroup.getWorldPosition(widgetPosition)
		const widgetScreen = new Vector3().copy(widgetPosition).project(editor.camera)
		const widgetScreen2D = new Vector2(widgetScreen.x, widgetScreen.y)

		const initialAngle = Math.atan2(this.initialMousePos.y - widgetScreen2D.y, this.initialMousePos.x - widgetScreen2D.x)
		const currentAngle = Math.atan2(this.mouse.y - widgetScreen2D.y, this.mouse.x - widgetScreen2D.x)

		let deltaAngle = currentAngle - initialAngle
		while (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI
		while (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI

		if (event.modifiers.shift) {
			const snapIncrement = Math.PI / 12
			deltaAngle = Math.round(deltaAngle / snapIncrement) * snapIncrement
		}

		// Rotate around the mesh's own local normal (local +Z), i.e. spin it
		// in its own plane regardless of the plane's world orientation.
		const spin = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), deltaAngle)
		const newQuaternion = this.initialTransform.quaternion.clone().multiply(spin)
		entry.mesh.quaternion.copy(newQuaternion)

		const normal = new Vector3(0, 0, 1).applyQuaternion(newQuaternion)
		const uAxis = new Vector3(1, 0, 0).applyQuaternion(newQuaternion)
		const vAxis = new Vector3(0, 1, 0).applyQuaternion(newQuaternion)
		this.widgetTransformService.updateWidgetOrientation(widgetGroup, normal, uAxis, vAxis, 0)

		this.previewTransform = {
			position: entry.mesh.position.clone(),
			quaternion: newQuaternion.clone(),
			scale: entry.mesh.scale.clone(),
		}
		if (!newQuaternion.equals(this.initialTransform.quaternion)) {
			this.hasPreviewChanges = true
		}

		editor.reactBridge.refreshSelectionContextMenuPosition()
		editor.controller.scheduleWrapPreview(this.activePlacedMeshId)

		return new InteractionHandlerResult().setHandled()
	}

	private handleMoveEnd(): InteractionHandlerResult {
		if (!this.isActive) {
			return new InteractionHandlerResult().setPass()
		}

		this.editor.controls.enabled = true
		if (this.hasPreviewChanges && this.activePlacedMeshId && this.initialTransform && this.previewTransform) {
			this.editor.controller.historyController.execute(
				this.editor.commandFactory.createUpdatePlacedMeshCommand(
					this.activePlacedMeshId,
					this.initialTransform,
					this.previewTransform
				)
			)
		}

		this.isActive = false
		this.activePlacedMeshId = null
		this.initialTransform = null
		this.previewTransform = null
		this.hasPreviewChanges = false

		return new InteractionHandlerResult().setReleaseCapture()
	}
}
