import { CanvasEventType } from '@/editor/interaction/CanvasEventType'
import { InteractionHandlerResult } from '@/editor/interaction/InteractionHandlerResult'
import { RegionEditorController } from '@/editor/polygon/RegionEditorController'
import { PolygonHitResultType } from '@/editor/polygon/PolygonHitResult'
import { PolygonInteractionEvent } from '@/editor/polygon/interaction/PolygonInteractionEvent'
import { PolygonInteractionHandler } from '@/editor/polygon/interaction/PolygonInteractionHandler'

/**
 * Drag-a-box gesture for drawing an axis-aligned rect region: press one
 * corner, drag to the opposite corner, release to finish. The anchor corner
 * is pinned in the model itself (see RegionEditorController.beginRectCorner),
 * so this handler only needs to track whether a drag is in progress.
 */
export class AddRectInteractionHandler implements PolygonInteractionHandler {
	public id: string = 'polygon-add-rect'

	public priority: number = 10

	/** Off until PolygonDrawRectTool.enterTool() turns it on - see RegionEditorController.setActiveTool. */
	public enabled: boolean = false

	private isDragging: boolean = false

	public constructor(private readonly controller: RegionEditorController) {}

	public isEnabled(event: PolygonInteractionEvent): boolean {
		if (!this.enabled) {
			return false
		}
		if (event.type === CanvasEventType.MoveStart) {
			return event.hitResult.type === PolygonHitResultType.Background
		}
		return this.isDragging
	}

	public onEvent(event: PolygonInteractionEvent): InteractionHandlerResult {
		if (event.type === CanvasEventType.MoveStart) {
			this.isDragging = true
			this.controller.beginRectCorner(event.point)
			return new InteractionHandlerResult().setCapture()
		}

		if (!this.isDragging) {
			return new InteractionHandlerResult().setPass()
		}

		if (event.type === CanvasEventType.Move) {
			this.controller.updateRectCorner(event.point)
			return new InteractionHandlerResult().setHandled()
		}

		if (event.type === CanvasEventType.MoveEnd) {
			this.controller.finishRect(event.point)
			this.isDragging = false
			return new InteractionHandlerResult().setReleaseCapture()
		}

		return new InteractionHandlerResult().setPass()
	}
}
