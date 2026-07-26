import { CanvasEventType } from '@/editor/interaction/CanvasEventType'
import { InteractionHandlerResult } from '@/editor/interaction/InteractionHandlerResult'
import { RegionEditorController } from '@/editor/polygon/RegionEditorController'
import { PolygonHitResultType } from '@/editor/polygon/PolygonHitResult'
import { PolygonInteractionEvent } from '@/editor/polygon/interaction/PolygonInteractionEvent'
import { PolygonInteractionHandler } from '@/editor/polygon/interaction/PolygonInteractionHandler'

/** Click on empty canvas while the draw-polygon tool is active (see PolygonDrawPolygonTool): place the next point. */
export class AddPointInteractionHandler implements PolygonInteractionHandler {
	public id: string = 'polygon-add-point'

	public priority: number = 10

	/** Off until PolygonDrawPolygonTool.enterTool() turns it on - see RegionEditorController.setActiveTool. */
	public enabled: boolean = false

	public constructor(private readonly controller: RegionEditorController) {}

	public isEnabled(event: PolygonInteractionEvent): boolean {
		return this.enabled && event.type === CanvasEventType.Click && event.hitResult.type === PolygonHitResultType.Background
	}

	public onEvent(event: PolygonInteractionEvent): InteractionHandlerResult {
		this.controller.handleBackgroundClick(event.point)
		return new InteractionHandlerResult().setHandled()
	}
}
