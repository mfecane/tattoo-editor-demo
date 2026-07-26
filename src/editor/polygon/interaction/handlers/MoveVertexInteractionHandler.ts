import { CanvasEventType } from '@/editor/interaction/CanvasEventType'
import { InteractionHandlerResult } from '@/editor/interaction/InteractionHandlerResult'
import { RegionEditorController } from '@/editor/polygon/RegionEditorController'
import { PolygonHitResultType } from '@/editor/polygon/PolygonHitResult'
import { PolygonInteractionEvent } from '@/editor/polygon/interaction/PolygonInteractionEvent'
import { PolygonInteractionHandler } from '@/editor/polygon/interaction/PolygonInteractionHandler'

interface DraggedVertex {
	polygonId: string
	vertexIndex: number
}

export class MoveVertexInteractionHandler implements PolygonInteractionHandler {
	public id: string = 'polygon-move-vertex'

	public priority: number = 50

	/** Off until PolygonSelectTool.enterTool() turns it on - see RegionEditorController.setActiveTool. */
	public enabled: boolean = false

	private dragged: DraggedVertex | null = null

	public constructor(private readonly controller: RegionEditorController) {}

	public isEnabled(event: PolygonInteractionEvent): boolean {
		return (
			this.enabled && event.type === CanvasEventType.MoveStart && event.hitResult.type === PolygonHitResultType.Vertex
		)
	}

	public onEvent(event: PolygonInteractionEvent): InteractionHandlerResult {
		if (event.type === CanvasEventType.MoveStart) {
			const { polygonId, vertexIndex } = event.hitResult
			if (polygonId === undefined || vertexIndex === undefined) {
				return new InteractionHandlerResult().setPass()
			}
			this.dragged = { polygonId, vertexIndex }
			return new InteractionHandlerResult().setCapture()
		}

		if (!this.dragged) {
			return new InteractionHandlerResult().setPass()
		}

		if (event.type === CanvasEventType.Move) {
			this.controller.moveVertex(this.dragged.polygonId, this.dragged.vertexIndex, event.point)
			return new InteractionHandlerResult().setHandled()
		}

		if (event.type === CanvasEventType.MoveEnd) {
			this.controller.moveVertex(this.dragged.polygonId, this.dragged.vertexIndex, event.point)
			this.dragged = null
			return new InteractionHandlerResult().setReleaseCapture()
		}

		return new InteractionHandlerResult().setPass()
	}
}
