import { CanvasEventType } from '@/editor/interaction/CanvasEventType'
import { InteractionEvent } from '@/editor/interaction/InteractionEvent'
import { InteractionHandler } from '@/editor/interaction/InteractionHandler'
import { InteractionHandlerResult } from '@/editor/interaction/InteractionHandlerResult'
import { EDITOR_CONSTANTS } from '@/editor/lib/constants'
import { getStrategy } from '@/editor/lib/lattice/ProjectionStrategyFactory'
import type { UpdateLatticeStrategy } from '@/editor/lib/lattice/UpdateLatticeStrategy'
import { UpdateStampCommand } from '@/editor/main/commands/UpdateStampCommand'
import { Editor } from '@/editor/main/Editor'
import { PointerMathService } from '@/editor/services/PointerMathService'
import { container } from '@/lib/di/container'
import { Vector2, Vector3 } from 'three'
import { RESIZE_CONSTANTS } from './constants'

export class ResizeInteractionHandler implements InteractionHandler {
	public id: string = 'resize'

	public priority: number = 80

	public enabled: boolean = true

	private isActive: boolean = false
	private initialMousePos: Vector2 = new Vector2()
	private initialSize: { x: number; y: number } = { x: 0, y: 0 }
	private handleType: 'x' | 'y' | 'center' = 'center'
	private strategy: UpdateLatticeStrategy | null = null
	private mouse: Vector2 = new Vector2()
	private activeStampId: string | null = null
	private initialStampInfo: { sizeX: number; sizeY: number } | null = null
	private previewStampInfo: { sizeX: number; sizeY: number; uv: Vector2; rotation: number } | null = null
	private hasPreviewChanges: boolean = false
	private readonly pointerMathService: PointerMathService = container.resolve<PointerMathService>('PointerMathService')

	public constructor(private readonly editor: Editor) {}

	public isEnabled(event: InteractionEvent): boolean {
		if (!this.enabled || !event.context?.hitResult) {
			return false
		}

		return event.context.hitResult.type === 'resize-handle'
	}

	public async onEvent(event: InteractionEvent): Promise<InteractionHandlerResult> {
		if (event.type === CanvasEventType.MoveStart) {
			if (!event.context || !event.context.hitResult) {
				return new InteractionHandlerResult().setPass()
			}

			const hitResult = event.context.hitResult
			if (hitResult.type !== 'resize-handle') {
				return new InteractionHandlerResult().setPass()
			}

			this.handleType = hitResult.handleType || 'center'
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
		const widget = editor.controller.getScaleTool().getWidget()
		const state = controller.getState()
		const selectedStampId = state.selectedStampId

		const selectedStamp = selectedStampId ? controller.project.stampList.getStampById(selectedStampId) : null
		const stampInfo = selectedStamp?.data.stampInfo
		if (!stampInfo || !widget) {
			return new InteractionHandlerResult().setPass()
		}

		if (selectedStamp) {
			this.strategy = getStrategy(selectedStamp.data.projectionType)
		}

		this.initialSize = {
			x: stampInfo.sizeX,
			y: stampInfo.sizeY,
		}
		this.activeStampId = selectedStamp.data.id
		this.initialStampInfo = {
			sizeX: stampInfo.sizeX,
			sizeY: stampInfo.sizeY,
		}
		this.previewStampInfo = null
		this.hasPreviewChanges = false

		this.isActive = true
		editor.controls.enabled = false
		this.editor.reactBridge.hideStampContextMenu()

		return new InteractionHandlerResult().setCapture()
	}

	private handleMove(event: InteractionEvent, editor: Editor): InteractionHandlerResult {
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
		const deltaMouse = new Vector2(this.mouse.x - this.initialMousePos.x, this.mouse.y - this.initialMousePos.y)

		const controller = editor.controller
		const state = controller.getState()
		const selectedStampId = state.selectedStampId

		const widget = editor.controller.getScaleTool().getWidget()
		const selectedStamp = selectedStampId ? controller.project.stampList.getStampById(selectedStampId) : null
		const stampInfo = selectedStamp?.data.stampInfo

		if (!widget || !stampInfo || selectedStampId === null || !this.strategy) {
			return new InteractionHandlerResult().setHandled()
		}

		if (this.handleType === 'x' && !this.strategy.canResizeX()) {
			return new InteractionHandlerResult().setHandled()
		}
		if (this.handleType === 'y' && !this.strategy.canResizeY()) {
			return new InteractionHandlerResult().setHandled()
		}
		if (this.handleType === 'center' && !this.strategy.canResizeCenter()) {
			return new InteractionHandlerResult().setHandled()
		}

		const widgetGroup = widget.getGroup()
		widgetGroup.updateMatrixWorld(true)
		const widgetPosition = new Vector3()
		widgetGroup.getWorldPosition(widgetPosition)

		const worldU = new Vector3(1, 0, 0).transformDirection(widgetGroup.matrixWorld)
		const worldV = new Vector3(0, 1, 0).transformDirection(widgetGroup.matrixWorld)

		const uScreen = new Vector3()
		uScreen.copy(widgetPosition).add(worldU)
		uScreen.project(editor.camera)

		const vScreen = new Vector3()
		vScreen.copy(widgetPosition).add(worldV)
		vScreen.project(editor.camera)

		const widgetScreen = new Vector3()
		widgetScreen.copy(widgetPosition)
		widgetScreen.project(editor.camera)

		const screenU = new Vector2(uScreen.x - widgetScreen.x, uScreen.y - widgetScreen.y).normalize()
		const screenV = new Vector2(vScreen.x - widgetScreen.x, vScreen.y - widgetScreen.y).normalize()

		let calculatedSizeX = this.initialSize.x
		let calculatedSizeY = this.initialSize.y

		const MIN_SIZE_UV = RESIZE_CONSTANTS.MIN_SIZE / EDITOR_CONSTANTS.CANVAS_SIZE
		const MAX_SIZE_UV = 1.0

		if (this.handleType === 'x') {
			const uComponent = deltaMouse.dot(screenU)
			calculatedSizeX = this.initialSize.x * (1 + uComponent * RESIZE_CONSTANTS.SCALING_FACTOR)
			calculatedSizeX = Math.max(MIN_SIZE_UV, Math.min(MAX_SIZE_UV, calculatedSizeX))
			calculatedSizeY = this.initialSize.y
		} else if (this.handleType === 'y') {
			const vComponent = deltaMouse.dot(screenV)
			calculatedSizeY = this.initialSize.y * (1 + vComponent * RESIZE_CONSTANTS.SCALING_FACTOR)
			calculatedSizeY = Math.max(MIN_SIZE_UV, Math.min(MAX_SIZE_UV, calculatedSizeY))
			calculatedSizeX = this.initialSize.x
		} else if (this.handleType === 'center') {
			const uComponent = deltaMouse.dot(screenU)
			const vComponent = deltaMouse.dot(screenV)
			const avgComponent = (uComponent + vComponent) / 2
			const scaleFactor = 1 + avgComponent * RESIZE_CONSTANTS.SCALING_FACTOR
			calculatedSizeX = this.initialSize.x * scaleFactor
			calculatedSizeY = this.initialSize.y * scaleFactor
			calculatedSizeX = Math.max(MIN_SIZE_UV, Math.min(MAX_SIZE_UV, calculatedSizeX))
			calculatedSizeY = Math.max(MIN_SIZE_UV, Math.min(MAX_SIZE_UV, calculatedSizeY))
		}

		const constrainedSize = this.strategy.constrainSize(calculatedSizeX, calculatedSizeY)

		const updatedStampInfo = {
			...stampInfo,
			sizeX: constrainedSize.sizeX,
			sizeY: constrainedSize.sizeY,
		}
		this.previewStampInfo = {
			uv: updatedStampInfo.uv.clone(),
			sizeX: updatedStampInfo.sizeX,
			sizeY: updatedStampInfo.sizeY,
			rotation: updatedStampInfo.rotation,
		}
		if (
			this.initialStampInfo &&
			(this.initialStampInfo.sizeX !== constrainedSize.sizeX || this.initialStampInfo.sizeY !== constrainedSize.sizeY)
		) {
			this.hasPreviewChanges = true
		}

		const stamp = controller.project.stampList.getStampById(selectedStampId)
		const latticeMesh = stamp?.latticeMesh
		if (latticeMesh && stamp) {
			latticeMesh.updateTransform(updatedStampInfo, stamp.data.projectionType)
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
