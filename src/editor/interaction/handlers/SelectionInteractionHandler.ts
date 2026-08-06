import { CanvasEventType } from '@/editor/interaction/CanvasEventType'
import { InteractionEvent } from '@/editor/interaction/InteractionEvent'
import { InteractionHandler } from '@/editor/interaction/InteractionHandler'
import { InteractionHandlerResult } from '@/editor/interaction/InteractionHandlerResult'
import { SelectWidgetPayload } from '@/editor/lib/widget/SelectWidget'
import { Editor } from '@/editor/main/Editor'
import { HitResult } from '@/editor/main/HitTester'

export class SelectionInteractionHandler implements InteractionHandler {
	public id: string = 'selection'

	public priority: number = 100

	public enabled: boolean = true

	public constructor(private readonly editor: Editor) {}

	public isEnabled(event: InteractionEvent): boolean {
		return event.type === CanvasEventType.Click && this.enabled
	}

	public async onEvent(event: InteractionEvent): Promise<InteractionHandlerResult> {
		if (!event.context || !event.context.hitResult) {
			return new InteractionHandlerResult().setPass()
		}

		return this.handleClick(event.context.hitResult)
	}

	private handleClick(hitResult: HitResult): InteractionHandlerResult {
		const controller = this.editor.controller

		if (hitResult.type === 'widget-handle') {
			const payload = hitResult.payload as SelectWidgetPayload | undefined

			if (payload?.placedMeshId) {
				const entry = controller.project.placedMeshList.getById(payload.placedMeshId)
				if (entry) {
					// Goes through ReactBridge (not a bare controller mutation) so the
					// bridge's cached selectedPlacedMeshId/selectedPlacedMeshWrapped stay
					// in sync - the context menu and hint text read those, not the controller.
					// Selecting drives the context menu's position/visibility along with it - see
					// ReactBridge.setSelectedPlacedMeshId.
					this.editor.reactBridge.requestSelectPlacedMesh(entry.id)
					return new InteractionHandlerResult().setHandled()
				}
			}
		}

		this.editor.reactBridge.requestSelectPlacedMesh(null)

		return new InteractionHandlerResult().setPass()
	}
}
