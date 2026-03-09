import { SelectWidget } from '@/editor/lib/widget/SelectWidget'
import { Editor } from '@/editor/main/Editor'
import { RuntimeStamp } from '@/editor/main/RuntimeStamp'
import { EditorToolId, IEditorTool } from '@/editor/main/tools/EditorTool'

interface SelectWidgetEntry {
	widget: SelectWidget
	stamp: RuntimeStamp
}

export class SelectTool implements IEditorTool {
	public readonly id = EditorToolId.Select

	private selectWidgets: SelectWidgetEntry[] = []

	public constructor(private readonly editor: Editor) {}

	public enterTool(): void {
		this.editor.hitTester.canvasEventHandler.enableHandler('selection')
		this.createWidgets()
	}

	public exitTool(): void {
		for (const { widget } of this.selectWidgets) {
			widget.destroy()
		}
		this.selectWidgets = []
		this.editor.hitTester.canvasEventHandler.disableHandler('selection')
		this.editor.hitTester.clearColliders()
	}

	public reset(): void {
		this.removeWidgets()
		this.createWidgets()
	}

	private createWidgets(): void {
		const stamps = this.editor.controller.project.stampList.getStamps()
		const overlayScene = this.editor.overlayScene
		for (const stamp of stamps) {
			const widget = new SelectWidget(stamp.getPosition3D(), overlayScene, stamp.data.id)

			this.selectWidgets.push({ widget, stamp })
		}
		this.selectWidgets.forEach(({ widget, stamp }) => {
			this.editor.hitTester.addColliders(widget.getColliders())
		})
	}

	private removeWidgets(): void {
		for (const { widget } of this.selectWidgets) {
			widget.destroy()
		}
		this.selectWidgets = []
		this.editor.hitTester.clearColliders()
	}

	public getWidgetByStampId(stampId: string): SelectWidget | null {
		return this.selectWidgets.find(({ stamp }) => stamp.data.id === stampId)?.widget ?? null
	}
}
