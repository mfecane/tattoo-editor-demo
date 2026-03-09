import { CanvasEventType } from '@/editor/interaction/CanvasEventType'
import { InteractionEvent } from '@/editor/interaction/InteractionEvent'
import { InteractionHandler } from '@/editor/interaction/InteractionHandler'
import { InteractionHandlerResult } from '@/editor/interaction/InteractionHandlerResult'
import { worldToScreen } from '@/editor/lib/utils'
import { SetSelectedStampIdCommand } from '@/editor/main/commands/SetSelectedStampIdCommand'
import { Editor } from '@/editor/main/Editor'
import { HitResult } from '@/editor/main/HitTester'
import { Vector2 } from 'three'

export class SelectionInteractionHandler implements InteractionHandler {
	public id: string = 'selection'

	public priority: number = 100

	public enabled: boolean = true

	public constructor(private readonly editor: Editor) {}

	public isEnabled(event: InteractionEvent): boolean {
		return [CanvasEventType.Click, CanvasEventType.Hover].includes(event.type) && this.enabled
	}

	public async onEvent(event: InteractionEvent): Promise<InteractionHandlerResult> {
		if (!event.context || !event.context.hitResult) {
			return new InteractionHandlerResult().setPass()
		}

		if (event.type === CanvasEventType.Click) {
			return this.handleClick(event.context.hitResult)
		}

		const controller = this.editor.controller

		if (!controller || this.editor.reactBridge.state.isBrushMode || this.editor.reactBridge.state.isBrushActive) {
			return new InteractionHandlerResult().setPass()
		}

		const hitResult = event.context.hitResult

		if (hitResult.type === 'image-handle') {
			const stampId = this.resolveHitStampId(hitResult)
			if (!stampId) {
				return new InteractionHandlerResult().setPass()
			}
			controller.historyController.execute(new SetSelectedStampIdCommand(stampId, controller))
			return new InteractionHandlerResult().setHandled()
		}

		return new InteractionHandlerResult().setPass()
	}

	private handleClick(hitResult: HitResult): InteractionHandlerResult {
		if (this.editor.reactBridge.state.isBrushMode || this.editor.reactBridge.state.isBrushActive) {
			return new InteractionHandlerResult().setPass()
		}

		const controller = this.editor.controller
		const stamps = controller.project.stampList.getStamps()

		if (hitResult.type === 'widget-handle') {
			const stampId = (hitResult.payload as { stampId?: string })?.stampId
			if (typeof stampId === 'string') {
				const stampExists = stamps.some((stamp) => stamp.data.id === stampId)
				if (stampExists) {
					controller.historyController.execute(new SetSelectedStampIdCommand(stampId, controller))
					const stamp = controller.project.stampList.getStampById(stampId)
					const worldPosition = stamp.getPosition3D()
					const screenPos = worldToScreen(worldPosition, this.editor.camera, this.editor.getDomElement())
					const position = new Vector2(screenPos.x, screenPos.y)
					this.editor.reactBridge.setStampContextMenuPosition(position)
					return new InteractionHandlerResult().setHandled()
				}
			}
		}

		this.editor.reactBridge.setStampContextMenuPosition(null)
		controller.historyController.execute(new SetSelectedStampIdCommand(null, controller))

		return new InteractionHandlerResult().setPass()
	}

	private resolveHitStampId(hitResult: HitResult): string | null {
		const payloadStampId = (hitResult.payload as { stampId?: string })?.stampId
		if (payloadStampId) {
			return payloadStampId
		}

		if (hitResult.stampIndex === undefined) {
			return null
		}

		const stamp = this.editor.controller.project.stampList.getStamps()[hitResult.stampIndex]
		return stamp ? stamp.data.id : null
	}
}
