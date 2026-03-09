import { CanvasEventType } from '@/editor/interaction/CanvasEventType'
import { InteractionEvent } from '@/editor/interaction/InteractionEvent'
import { InteractionHandler } from '@/editor/interaction/InteractionHandler'
import { InteractionHandlerResult } from '@/editor/interaction/InteractionHandlerResult'
import { Editor } from '@/editor/main/Editor'

export class OrbitInteractionHandler implements InteractionHandler {
	public id: string = 'orbit'

	public priority: number = 1

	public enabled: boolean = true

	public constructor(private readonly editor: Editor) {}

	public isEnabled(event: InteractionEvent): boolean {
		return (
			(event.type === CanvasEventType.MoveStart ||
				event.type === CanvasEventType.Move ||
				event.type === CanvasEventType.MoveEnd) &&
			this.enabled
		)
	}

	public async onEvent(event: InteractionEvent): Promise<InteractionHandlerResult> {
		if (
			event.context?.hitResult?.type === 'resize-handle' ||
			event.context?.hitResult?.type === 'rotate-handle' ||
			event.context?.hitResult?.type === 'move-handle' ||
			event.context?.hitResult?.type === 'widget-body'
		) {
			return new InteractionHandlerResult().setPass()
		}

		this.editor.reactBridge.refreshStampContextMenuPosition()

		this.editor.controls.enabled = true
		return new InteractionHandlerResult().setPass()
	}
}
