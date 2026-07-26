import { RegionEditorController } from '@/editor/polygon/RegionEditorController'
import { IPolygonTool, PolygonToolId } from '@/editor/polygon/tools/PolygonTool'

/** Lasso drawing: places points on background clicks, closes via ClosePolygonInteractionHandler. */
export class PolygonDrawPolygonTool implements IPolygonTool {
	public readonly id: PolygonToolId = PolygonToolId.DrawPolygon

	private static readonly HANDLER_IDS = ['polygon-add-point', 'polygon-close'] as const

	public constructor(private readonly controller: RegionEditorController) {}

	public enterTool(): void {
		this.controller.discardOpenPolygon()
		this.controller.deselectAll()
		this.controller.beginDrawPolygon()

		const canvasEventHandler = this.controller.getCanvasEventHandler()
		for (const handlerId of PolygonDrawPolygonTool.HANDLER_IDS) {
			canvasEventHandler.enableHandler(handlerId)
		}
	}

	public exitTool(): void {
		const canvasEventHandler = this.controller.getCanvasEventHandler()
		for (const handlerId of PolygonDrawPolygonTool.HANDLER_IDS) {
			canvasEventHandler.disableHandler(handlerId)
		}

		// Leaving mid-draw (Escape, or switching tools) abandons whatever's unfinished.
		// A no-op once the shape already closed normally through ClosePolygonInteractionHandler.
		this.controller.discardOpenPolygon()
	}
}
