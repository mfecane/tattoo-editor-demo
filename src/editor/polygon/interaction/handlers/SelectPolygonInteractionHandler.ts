import { CanvasEventType } from '@/editor/interaction/CanvasEventType'
import { InteractionHandlerResult } from '@/editor/interaction/InteractionHandlerResult'
import { RegionEditorController } from '@/editor/polygon/RegionEditorController'
import { PolygonHitResultType } from '@/editor/polygon/PolygonHitResult'
import { PolygonInteractionEvent } from '@/editor/polygon/interaction/PolygonInteractionEvent'
import { PolygonInteractionHandler } from '@/editor/polygon/interaction/PolygonInteractionHandler'

export class SelectPolygonInteractionHandler implements PolygonInteractionHandler {
	public id: string = 'polygon-select'

	public priority: number = 20

	/** Off until PolygonSelectTool.enterTool() turns it on - see RegionEditorController.setActiveTool. */
	public enabled: boolean = false

	public constructor(private readonly controller: RegionEditorController) {}

	public isEnabled(event: PolygonInteractionEvent): boolean {
		return this.enabled && event.type === CanvasEventType.Click && event.hitResult.type === PolygonHitResultType.Select
	}

	public onEvent(event: PolygonInteractionEvent): InteractionHandlerResult {
		if (event.hitResult.polygonId) {
			this.controller.selectPolygon(event.hitResult.polygonId)
		}
		return new InteractionHandlerResult().setHandled()
	}
}
