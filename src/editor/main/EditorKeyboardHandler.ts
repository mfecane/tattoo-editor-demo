import { EditorController } from '@/editor/main/EditorController'

/**
 * Keyboard input for the 3D editor - currently just undo/redo, the one
 * gesture that previously only existed as header buttons. Lives alongside
 * CanvasEventHandler as the other native-input source feeding the same
 * controller, instead of living as a raw window listener in the view.
 */
export class EditorKeyboardHandler {
	private readonly onKeyDown = (event: KeyboardEvent): void => this.handleKeyDown(event)

	public constructor(private readonly controller: EditorController) {
		window.addEventListener('keydown', this.onKeyDown)
	}

	public destroy(): void {
		window.removeEventListener('keydown', this.onKeyDown)
	}

	private handleKeyDown(event: KeyboardEvent): void {
		if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') {
			return
		}

		const target = event.target
		if (target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select'))) {
			return
		}

		event.preventDefault()
		if (event.shiftKey) {
			this.controller.historyController.redo()
		} else {
			this.controller.historyController.undo()
		}
	}
}
