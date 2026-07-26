import { CanvasEventType } from '@/editor/interaction/CanvasEventType'
import { InteractionHandlerResult } from '@/editor/interaction/InteractionHandlerResult'
import { RegionEditorController } from '@/editor/polygon/RegionEditorController'
import { PolygonHitResultType } from '@/editor/polygon/PolygonHitResult'
import { PolygonInteractionEvent } from '@/editor/polygon/interaction/PolygonInteractionEvent'
import { PolygonInteractionHandler } from '@/editor/polygon/interaction/PolygonInteractionHandler'

/**
 * A plain click (no drag) on a vertex deletes it. Dragging the same
 * vertex is handled separately by MoveVertexInteractionHandler, which
 * captures the pointer before a click can ever be dispatched here.
 *
 * Safe for an aarect's 2-point shape with no kind check needed here:
 * PolygonSelectionModel.canRemoveVertex() already refuses below
 * MIN_VERTICES (3), so deleteVertex() is always a no-op on a rect.
 */
export class DeleteVertexInteractionHandler implements PolygonInteractionHandler {
	public id: string = 'polygon-delete-vertex'

	public priority: number = 30

	/** Off until PolygonSelectTool.enterTool() turns it on - see RegionEditorController.setActiveTool. */
	public enabled: boolean = false

	public constructor(private readonly controller: RegionEditorController) {}

	public isEnabled(event: PolygonInteractionEvent): boolean {
		return this.enabled && event.type === CanvasEventType.Click && event.hitResult.type === PolygonHitResultType.Vertex
	}

	public onEvent(event: PolygonInteractionEvent): InteractionHandlerResult {
		const { polygonId, vertexIndex } = event.hitResult
		if (polygonId !== undefined && vertexIndex !== undefined) {
			this.controller.deleteVertex(polygonId, vertexIndex)
		}
		return new InteractionHandlerResult().setHandled()
	}
}
