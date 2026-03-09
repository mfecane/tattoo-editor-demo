import { CanvasEventType } from '@/editor/interaction/CanvasEventType'
import { InteractionEvent } from '@/editor/interaction/InteractionEvent'
import { InteractionHandler } from '@/editor/interaction/InteractionHandler'
import { InteractionHandlerResult } from '@/editor/interaction/InteractionHandlerResult'
import { getStrategy } from '@/editor/lib/lattice/ProjectionStrategyFactory'
import type { UpdateLatticeStrategy } from '@/editor/lib/lattice/UpdateLatticeStrategy'
import { Editor } from '@/editor/main/Editor'
import { UpdateStampCommand } from '@/editor/main/commands/UpdateStampCommand'
import { GeometryProjectionService } from '@/editor/services/GeometryProjectionService'
import { PointerMathService } from '@/editor/services/PointerMathService'
import { WidgetTransformService } from '@/editor/services/WidgetTransformService'
import type { StampInfo } from '@/editor/types/projectTypes'
import { container } from '@/lib/di/container'
import { Vector2, Vector3 } from 'three'

export class RotateInteractionHandler implements InteractionHandler {
	public id: string = 'rotate'

	public priority: number = 70

	public enabled: boolean = true

	private isActive: boolean = false
	private initialMousePos: Vector2 = new Vector2()
	private initialRotation: number = 0
	private strategy: UpdateLatticeStrategy | null = null
	private mouse: Vector2 = new Vector2()
	private activeStampId: string | null = null
	private initialStampInfo: { rotation: number } | null = null
	private previewStampInfo: StampInfo | null = null
	private hasPreviewChanges: boolean = false
	private readonly geometryProjectionService: GeometryProjectionService = container.resolve<GeometryProjectionService>(
		'GeometryProjectionService'
	)
	private readonly pointerMathService: PointerMathService = container.resolve<PointerMathService>('PointerMathService')
	private readonly widgetTransformService: WidgetTransformService =
		container.resolve<WidgetTransformService>('WidgetTransformService')

	public constructor(private readonly editor: Editor) {}

	public isEnabled(event: InteractionEvent): boolean {
		if (!this.enabled || !event.context?.hitResult) {
			return false
		}

		if (event.context.hitResult.type !== 'rotate-handle') {
			return false
		}

		const controller = this.editor.controller
		if (!controller) return false
		const state = controller.getState()
		const selectedStamp = state.selectedStampId ? controller.project.stampList.getStampById(state.selectedStampId) : null
		if (!selectedStamp) {
			return false
		}

		const strategy = getStrategy(selectedStamp.data.projectionType)
		return strategy.canRotate()
	}

	public async onEvent(event: InteractionEvent): Promise<InteractionHandlerResult> {
		if (event.type === CanvasEventType.MoveStart) {
			if (!event.context || !event.context.hitResult) {
				return new InteractionHandlerResult().setPass()
			}

			const hitResult = event.context.hitResult
			if (hitResult.type !== 'rotate-handle') {
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

	private handleMoveStart(event: InteractionEvent, editor: any): InteractionHandlerResult {
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
		this.initialMousePos.copy(mouse)

		const controller = editor.controller
		const widget = editor.controller.getRotateTool().getWidget()
		const state = controller.getState()
		const selectedStampId = state.selectedStampId

		const selectedStamp = selectedStampId ? controller.project.stampList.getStampById(selectedStampId) : null
		const stampInfo = selectedStamp?.data.stampInfo
		if (!stampInfo || !widget) {
			return new InteractionHandlerResult().setPass()
		}

		if (selectedStamp) {
			this.strategy = getStrategy(selectedStamp.data.projectionType)
			if (!this.strategy.canRotate()) {
				return new InteractionHandlerResult().setPass()
			}
		}

		this.initialRotation = stampInfo.rotation || 0
		this.activeStampId = selectedStamp.data.id
		this.initialStampInfo = { rotation: this.initialRotation }
		this.previewStampInfo = null
		this.hasPreviewChanges = false

		this.isActive = true
		editor.controls.enabled = false
		this.editor.reactBridge.hideStampContextMenu()

		return new InteractionHandlerResult().setCapture()
	}

	private handleMove(event: InteractionEvent, editor: any): InteractionHandlerResult {
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

		const controller = editor.controller
		const state = controller.getState()
		const selectedStampId = state.selectedStampId

		const widget = editor.controller.getRotateTool().getWidget()
		const selectedStamp = selectedStampId ? controller.project.stampList.getStampById(selectedStampId) : null
		const stampInfo = selectedStamp?.data.stampInfo

		if (!widget || !stampInfo || selectedStampId === null || !this.strategy) {
			return new InteractionHandlerResult().setHandled()
		}

		const widgetGroup = widget.getGroup()
		widgetGroup.updateMatrixWorld(true)
		const widgetPosition = new Vector3()
		widgetGroup.getWorldPosition(widgetPosition)

		const widgetScreen = new Vector3()
		widgetScreen.copy(widgetPosition)
		widgetScreen.project(editor.camera)

		const widgetScreen2D = new Vector2(widgetScreen.x, widgetScreen.y)

		const initialAngle = Math.atan2(
			this.initialMousePos.y - widgetScreen2D.y,
			this.initialMousePos.x - widgetScreen2D.x
		)

		const currentAngle = Math.atan2(this.mouse.y - widgetScreen2D.y, this.mouse.x - widgetScreen2D.x)

		let deltaAngle = initialAngle - currentAngle

		while (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI
		while (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI

		const calculatedRotation = this.initialRotation + deltaAngle

		const constrainedRotation = this.strategy.constrainRotation(calculatedRotation)

		const updatedStampInfo = {
			...stampInfo,
			rotation: constrainedRotation,
		}
		this.previewStampInfo = {
			uv: updatedStampInfo.uv.clone(),
			sizeX: updatedStampInfo.sizeX,
			sizeY: updatedStampInfo.sizeY,
			rotation: updatedStampInfo.rotation,
		}
		if (this.initialStampInfo && this.initialStampInfo.rotation !== constrainedRotation) {
			this.hasPreviewChanges = true
		}

		const stamp = controller.project.stampList.getStampById(selectedStampId)
		const latticeMesh = stamp?.latticeMesh
		if (latticeMesh && stamp) {
			latticeMesh.updateTransform(updatedStampInfo, stamp.data.projectionType)
		}
		const surfaceBasis = this.geometryProjectionService.inferSurfaceBasisFromUV(
			editor.previewMesh.mesh,
			updatedStampInfo.uv
		)
		if (surfaceBasis) {
			this.widgetTransformService.updateWidgetOrientation(
				widgetGroup,
				surfaceBasis.normal,
				surfaceBasis.uAxis,
				surfaceBasis.vAxis,
				constrainedRotation
			)
		}

		controller.latticeNeedsRender = true
		this.editor.reactBridge.refreshStampContextMenuPosition()

		return new InteractionHandlerResult().setHandled()
	}

	private handleMoveEnd(_event: InteractionEvent): InteractionHandlerResult {
		if (!this.isActive) {
			return new InteractionHandlerResult().setPass()
		}

		this.editor.controls.enabled = true
		if (this.hasPreviewChanges && this.activeStampId !== null && this.previewStampInfo) {
			this.editor.controller.historyController.execute(
				new UpdateStampCommand(this.activeStampId, { stampInfo: this.previewStampInfo }, this.editor.controller)
			)
		}

		this.isActive = false
		this.strategy = null
		this.activeStampId = null
		this.initialStampInfo = null
		this.previewStampInfo = null
		this.hasPreviewChanges = false
		this.editor.reactBridge.showStampContextMenu()

		return new InteractionHandlerResult().setReleaseCapture()
	}
}
