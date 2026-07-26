import { Editor } from '@/editor/main/Editor'
import { EditorToolId, IEditorTool } from '@/editor/main/tools/EditorTool'

export class PlacementTool implements IEditorTool {
	public readonly id: EditorToolId = EditorToolId.Placement

	public constructor(private readonly editor: Editor) {}

	public enterTool(): void {
		this.editor.canvasEventHandler.enableHandler('placement')
		this.editor.getDomElement().style.cursor = 'crosshair'
	}

	public exitTool(): void {
		this.editor.canvasEventHandler.disableHandler('placement')
		this.editor.controller.cancelMeshPlacement()
		this.editor.getDomElement().style.cursor = ''
	}
}
