import { RegionEditorController } from '@/editor/polygon/RegionEditorController'
import { IPolygonTool, PolygonToolId } from '@/editor/polygon/tools/PolygonTool'

/** Drag-a-box drawing: AddRectInteractionHandler pins/drags/finishes the rect on its own. */
export class PolygonDrawRectTool implements IPolygonTool {
	public readonly id: PolygonToolId = PolygonToolId.DrawRect

	private static readonly HANDLER_IDS = ['polygon-add-rect'] as const

	public constructor(private readonly controller: RegionEditorController) {}

	public enterTool(): void {
		this.controller.discardOpenPolygon()
		this.controller.deselectAll()

		const canvasEventHandler = this.controller.getCanvasEventHandler()
		for (const handlerId of PolygonDrawRectTool.HANDLER_IDS) {
			canvasEventHandler.enableHandler(handlerId)
		}
	}

	public exitTool(): void {
		const canvasEventHandler = this.controller.getCanvasEventHandler()
		for (const handlerId of PolygonDrawRectTool.HANDLER_IDS) {
			canvasEventHandler.disableHandler(handlerId)
		}

		// Leaving mid-draw (Escape, or switching tools) abandons whatever's unfinished.
		// A no-op once the rect already finished normally through AddRectInteractionHandler.
		this.controller.discardOpenPolygon()
	}
}
