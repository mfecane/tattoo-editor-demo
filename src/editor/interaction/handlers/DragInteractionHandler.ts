import { CanvasEventType } from '@/editor/interaction/CanvasEventType'
import { InteractionEvent } from '@/editor/interaction/InteractionEvent'
import { InteractionHandler } from '@/editor/interaction/InteractionHandler'
import { InteractionHandlerResult } from '@/editor/interaction/InteractionHandlerResult'
import { Editor } from '@/editor/main/Editor'

export class DragInteractionHandler implements InteractionHandler {
	public id: string = 'drag'

	public priority: number = 55

	public enabled: boolean = true

	private isActive: boolean = false

	public constructor(private readonly editor: Editor) {}

	public isEnabled(event: InteractionEvent): boolean {
		if (!this.enabled || !event.context?.hitResult) {
			return false
		}

		return event.context.hitResult.type === 'widget-body'
	}

	public async onEvent(event: InteractionEvent): Promise<InteractionHandlerResult> {
		if (!event.context || !event.context.hitResult) {
			return new InteractionHandlerResult().setPass()
		}

		const hitResult = event.context.hitResult
		if (hitResult.type !== 'widget-body') {
			return new InteractionHandlerResult().setPass()
		}

		if (event.type === CanvasEventType.MoveStart) {
			const widget = hitResult.widget
			if (widget) {
				this.isActive = true
				this.editor.controls.enabled = false
				return new InteractionHandlerResult().setCapture()
			}
		} else if (event.type === CanvasEventType.MoveEnd && this.isActive) {
			this.isActive = false
			this.editor.controls.enabled = true
			return new InteractionHandlerResult().setReleaseCapture()
		}

		return new InteractionHandlerResult().setPass()
	}
}
