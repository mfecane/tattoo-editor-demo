import { CanvasEventType } from '@/editor/interaction/CanvasEventType'
import { InteractionEvent } from '@/editor/interaction/InteractionEvent'
import { InteractionHandler } from '@/editor/interaction/InteractionHandler'
import { InteractionHandlerResult } from '@/editor/interaction/InteractionHandlerResult'
import { IHandle } from '@/editor/lib/widget/IWidget'

export class HoverInteractionHandler implements InteractionHandler {
	public id: string = 'hover'

	public priority: number = 0

	public enabled: boolean = true

	private previousHighlightedHandle: IHandle | null = null

	public isEnabled(event: InteractionEvent): boolean {
		return event.type === CanvasEventType.Hover && this.enabled
	}

	public async onEvent(event: InteractionEvent): Promise<InteractionHandlerResult> {
		if (event.type !== CanvasEventType.Hover) {
			return new InteractionHandlerResult().setPass()
		}

		const hitResult = event.context.hitResult
		let handle: IHandle | null = null
		if (hitResult && hitResult.handle) {
			handle = hitResult.handle
		}

		if (this.previousHighlightedHandle !== handle) {
			this.previousHighlightedHandle?.toggleHighlight(false)
			this.previousHighlightedHandle = handle
			handle?.toggleHighlight(true)
		}

		return new InteractionHandlerResult().setHandled()
	}
}
