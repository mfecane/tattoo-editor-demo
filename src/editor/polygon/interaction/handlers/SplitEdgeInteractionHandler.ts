import { CanvasEventType } from '@/editor/interaction/CanvasEventType'
import { InteractionHandlerResult } from '@/editor/interaction/InteractionHandlerResult'
import { RegionEditorController } from '@/editor/polygon/RegionEditorController'
import { PolygonHitResultType } from '@/editor/polygon/PolygonHitResult'
import { PolygonInteractionEvent } from '@/editor/polygon/interaction/PolygonInteractionEvent'
import { PolygonInteractionHandler } from '@/editor/polygon/interaction/PolygonInteractionHandler'

/** No kind check needed: PolygonHitTester never emits an Edge hit for an aarect (see findEdgeInsertIndex). */
export class SplitEdgeInteractionHandler implements PolygonInteractionHandler {
	public id: string = 'polygon-split-edge'

	public priority: number = 30

	/** Off until PolygonSelectTool.enterTool() turns it on - see RegionEditorController.setActiveTool. */
	public enabled: boolean = false

	public constructor(private readonly controller: RegionEditorController) {}

	public isEnabled(event: PolygonInteractionEvent): boolean {
		return this.enabled && event.type === CanvasEventType.Click && event.hitResult.type === PolygonHitResultType.Edge
	}

	public onEvent(event: PolygonInteractionEvent): InteractionHandlerResult {
		const { polygonId, edgeInsertIndex } = event.hitResult
		if (polygonId !== undefined && edgeInsertIndex !== undefined) {
			this.controller.splitEdge(polygonId, edgeInsertIndex, event.point)
		}
		return new InteractionHandlerResult().setHandled()
	}
}
