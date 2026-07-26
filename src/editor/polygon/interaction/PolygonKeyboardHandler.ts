import { RegionEditorController } from '@/editor/polygon/RegionEditorController'

/**
 * Keyboard input for the polygon editor - currently just Escape to cancel
 * an in-progress draw. Lives alongside PolygonCanvasEventHandler as the
 * other native-input source feeding the same controller, instead of
 * living as a raw window listener in the view.
 */
export class PolygonKeyboardHandler {
	private readonly onKeyDown = (event: KeyboardEvent): void => this.handleKeyDown(event)

	public constructor(private readonly controller: RegionEditorController) {
		window.addEventListener('keydown', this.onKeyDown)
	}

	public destroy(): void {
		window.removeEventListener('keydown', this.onKeyDown)
	}

	private handleKeyDown(event: KeyboardEvent): void {
		if (event.key === 'Escape' && this.controller.isDrawing()) {
			this.controller.setActiveTool(this.controller.getSelectTool())
		}
	}
}
