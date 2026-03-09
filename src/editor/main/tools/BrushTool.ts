import { Editor } from '@/editor/main/Editor'
import { EditorToolId, IEditorTool } from '@/editor/main/tools/EditorTool'

export class BrushTool implements IEditorTool {
	public readonly id: EditorToolId = EditorToolId.Brush

	public constructor(private readonly editor: Editor) {}

	public enterTool(): void {
		this.editor.hitTester.canvasEventHandler.enableHandler('brush')
	}

	public exitTool(): void {
		this.editor.hitTester.canvasEventHandler.disableHandler('brush')
		this.editor.controls.enabled = true
		this.editor.reactBridge.setBrushActive(false)
	}
}
