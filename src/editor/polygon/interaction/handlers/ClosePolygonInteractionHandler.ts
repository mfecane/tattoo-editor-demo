import { CanvasEventType } from '@/editor/interaction/CanvasEventType'
import { InteractionHandlerResult } from '@/editor/interaction/InteractionHandlerResult'
import { RegionEditorController } from '@/editor/polygon/RegionEditorController'
import { PolygonHitResultType } from '@/editor/polygon/PolygonHitResult'
import { PolygonInteractionEvent } from '@/editor/polygon/interaction/PolygonInteractionEvent'
import { PolygonInteractionHandler } from '@/editor/polygon/interaction/PolygonInteractionHandler'

/** No kind check needed: PolygonHitTester never emits a Close hit for an aarect (see hitTestDrawing). */
export class ClosePolygonInteractionHandler implements PolygonInteractionHandler {
	public id: string = 'polygon-close'

	public priority: number = 40

	/** Off until PolygonDrawPolygonTool.enterTool() turns it on - see RegionEditorController.setActiveTool. */
	public enabled: boolean = false

	public constructor(private readonly controller: RegionEditorController) {}

	public isEnabled(event: PolygonInteractionEvent): boolean {
		return this.enabled && event.type === CanvasEventType.Click && event.hitResult.type === PolygonHitResultType.Close
	}

	public onEvent(_event: PolygonInteractionEvent): InteractionHandlerResult {
		this.controller.closeOpenPolygon()
		return new InteractionHandlerResult().setHandled()
	}
}
