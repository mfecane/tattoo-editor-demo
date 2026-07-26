import { CanvasEventType } from '@/editor/interaction/CanvasEventType'
import { InteractionHandlerResult } from '@/editor/interaction/InteractionHandlerResult'
import { RegionEditorController } from '@/editor/polygon/RegionEditorController'
import { PolygonHitResultType } from '@/editor/polygon/PolygonHitResult'
import { PolygonInteractionEvent } from '@/editor/polygon/interaction/PolygonInteractionEvent'
import { PolygonInteractionHandler } from '@/editor/polygon/interaction/PolygonInteractionHandler'

/** Click on empty canvas while a polygon is selected: deselect it instead of drawing. */
export class DeselectInteractionHandler implements PolygonInteractionHandler {
	public id: string = 'polygon-deselect'

	public priority: number = 15

	/** Off until PolygonSelectTool.enterTool() turns it on - see RegionEditorController.setActiveTool. */
	public enabled: boolean = false

	public constructor(private readonly controller: RegionEditorController) {}

	public isEnabled(event: PolygonInteractionEvent): boolean {
		return (
			this.enabled &&
			event.type === CanvasEventType.Click &&
			event.hitResult.type === PolygonHitResultType.Background &&
			this.controller.hasSelection()
		)
	}

	public onEvent(_event: PolygonInteractionEvent): InteractionHandlerResult {
		this.controller.deselectAll()
		return new InteractionHandlerResult().setHandled()
	}
}
