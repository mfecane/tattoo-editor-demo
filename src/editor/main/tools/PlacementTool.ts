import { PlacementCursorArrow } from '@/editor/lib/widget/PlacementCursorArrow'
import { Editor } from '@/editor/main/Editor'
import { EditorToolId, IEditorTool } from '@/editor/main/tools/EditorTool'

export class PlacementTool implements IEditorTool {
	public readonly id: EditorToolId = EditorToolId.Placement

	private cursorArrow: PlacementCursorArrow | null = null

	public constructor(private readonly editor: Editor) {}

	public enterTool(): void {
		this.editor.canvasEventHandler.enableHandler('placement')
		this.editor.getDomElement().style.cursor = 'crosshair'
		this.cursorArrow = new PlacementCursorArrow(this.editor)
	}

	public exitTool(): void {
		this.editor.canvasEventHandler.disableHandler('placement')
		this.editor.controller.cancelMeshPlacement()
		this.editor.getDomElement().style.cursor = ''
		this.cursorArrow?.destroy()
		this.cursorArrow = null
	}

	public getCursorArrow(): PlacementCursorArrow | null {
		return this.cursorArrow
	}
}
