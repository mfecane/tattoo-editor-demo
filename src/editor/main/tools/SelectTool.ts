import { SelectWidget } from '@/editor/lib/widget/SelectWidget'
import { WrappedMeshWireframeOverlay } from '@/editor/lib/widget/WrappedMeshWireframeOverlay'
import { WrappedVertexOverlay } from '@/editor/lib/widget/WrappedVertexOverlay'
import { Editor } from '@/editor/main/Editor'
import { EditorToolId, IEditorTool } from '@/editor/main/tools/EditorTool'

interface SelectWidgetEntry {
	widget: SelectWidget
	placedMeshId: string
}

export class SelectTool implements IEditorTool {
	public readonly id = EditorToolId.Select

	private selectWidgets: SelectWidgetEntry[] = []

	private vertexOverlay: WrappedVertexOverlay | null = null

	private wireframeOverlay: WrappedMeshWireframeOverlay | null = null

	public constructor(private readonly editor: Editor) {}

	public enterTool(): void {
		this.editor.canvasEventHandler.enableHandler('selection')
		this.createWidgets()
		this.refreshVertexOverlay()
		this.refreshWireframeOverlay()
	}

	public exitTool(): void {
		for (const { widget } of this.selectWidgets) {
			widget.destroy()
		}
		this.selectWidgets = []
		this.editor.canvasEventHandler.disableHandler('selection')
		this.editor.hitTester.clearColliders()
		this.destroyVertexOverlay()
		this.destroyWireframeOverlay()
	}

	public reset(): void {
		this.removeWidgets()
		this.createWidgets()
		this.refreshVertexOverlay()
		this.refreshWireframeOverlay()
	}

	/** Rebuilds the selected-mesh's vertex-dot overlay - called by reset()/enterTool() whenever selection or wrapped state changes. */
	private refreshVertexOverlay(): void {
		this.destroyVertexOverlay()

		const selectedId = this.editor.controller.getSelectedPlacedMeshId()
		if (!selectedId) {
			return
		}
		const entry = this.editor.controller.project.placedMeshList.getById(selectedId)
		if (!entry || entry.kind !== 'drapedPatch') {
			return
		}

		this.vertexOverlay = new WrappedVertexOverlay(entry.mesh, this.editor)
	}

	public getVertexOverlay(): WrappedVertexOverlay | null {
		return this.vertexOverlay
	}

	private destroyVertexOverlay(): void {
		this.vertexOverlay?.destroy()
		this.vertexOverlay = null
	}

	/** Rebuilds the selected-mesh's triangle-edge wireframe - called by reset()/enterTool() whenever selection or wrapped state changes. */
	private refreshWireframeOverlay(): void {
		this.destroyWireframeOverlay()

		const selectedId = this.editor.controller.getSelectedPlacedMeshId()
		if (!selectedId) {
			return
		}
		const entry = this.editor.controller.project.placedMeshList.getById(selectedId)
		if (!entry || entry.kind !== 'drapedPatch') {
			return
		}

		this.wireframeOverlay = new WrappedMeshWireframeOverlay(entry.mesh)
	}

	public getWireframeOverlay(): WrappedMeshWireframeOverlay | null {
		return this.wireframeOverlay
	}

	private destroyWireframeOverlay(): void {
		this.wireframeOverlay?.destroy()
		this.wireframeOverlay = null
	}

	private createWidgets(): void {
		// The dots are only for picking which mesh to select - once one is selected, its own
		// controls (context menu, transform widgets, vertex overlay) take over, so hide the rest.
		if (this.editor.controller.getSelectedPlacedMeshId() !== null) {
			return
		}

		const placedMeshes = this.editor.controller.project.placedMeshList.getAll()

		for (const { id, mesh } of placedMeshes) {
			const widget = new SelectWidget(mesh.position, this.editor, { placedMeshId: id })
			this.selectWidgets.push({ widget, placedMeshId: id })
		}

		this.selectWidgets.forEach(({ widget }) => {
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

	public getWidgetByPlacedMeshId(placedMeshId: string): SelectWidget | null {
		return this.selectWidgets.find((entry) => entry.placedMeshId === placedMeshId)?.widget ?? null
	}
}
