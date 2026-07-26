import { RegionEditorController } from '@/editor/polygon/RegionEditorController'
import { IPolygonTool, PolygonToolId } from '@/editor/polygon/tools/PolygonTool'

/** Vertex/edge editing and select/deselect gestures against already-closed shapes - never active while a draw tool is. */
export class PolygonSelectTool implements IPolygonTool {
	public readonly id: PolygonToolId = PolygonToolId.Select

	private static readonly HANDLER_IDS = [
		'polygon-select',
		'polygon-deselect',
		'polygon-move-vertex',
		'polygon-split-edge',
		'polygon-delete-vertex',
	] as const

	public constructor(private readonly controller: RegionEditorController) {}

	public enterTool(): void {
		const canvasEventHandler = this.controller.getCanvasEventHandler()
		for (const handlerId of PolygonSelectTool.HANDLER_IDS) {
			canvasEventHandler.enableHandler(handlerId)
		}
	}

	public exitTool(): void {
		const canvasEventHandler = this.controller.getCanvasEventHandler()
		for (const handlerId of PolygonSelectTool.HANDLER_IDS) {
			canvasEventHandler.disableHandler(handlerId)
		}
	}
}
