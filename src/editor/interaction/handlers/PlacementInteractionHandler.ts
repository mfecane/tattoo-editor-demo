import { CanvasEventType } from '@/editor/interaction/CanvasEventType'
import { InteractionEvent } from '@/editor/interaction/InteractionEvent'
import { InteractionHandler } from '@/editor/interaction/InteractionHandler'
import { InteractionHandlerResult } from '@/editor/interaction/InteractionHandlerResult'
import { Editor } from '@/editor/main/Editor'
import { HitResultType } from '@/editor/main/HitTester'

/** Click on the body mesh while the placement tool is active: drop the pending mesh there. */
export class PlacementInteractionHandler implements InteractionHandler {
	public id: string = 'placement'

	public priority: number = 90

	public enabled: boolean = false

	public constructor(private readonly editor: Editor) {}

	public isEnabled(event: InteractionEvent): boolean {
		return this.enabled && event.type === CanvasEventType.Click
	}

	public async onEvent(event: InteractionEvent): Promise<InteractionHandlerResult> {
		const hitResult = event.context?.hitResult
		if (!hitResult || hitResult.type !== HitResultType.SelectableObject || !hitResult.intersection) {
			return new InteractionHandlerResult().setPass()
		}

		this.editor.controller.placePendingMeshAt(hitResult.intersection)
		return new InteractionHandlerResult().setHandled()
	}
}
