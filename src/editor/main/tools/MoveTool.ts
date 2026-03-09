import { getStrategy } from '@/editor/lib/lattice/ProjectionStrategyFactory'
import { MoveWidget } from '@/editor/lib/widget/MoveWidget'
import { Editor } from '@/editor/main/Editor'
import { GeometryProjectionService } from '@/editor/services/GeometryProjectionService'
import { EditorToolId, IEditorTool } from '@/editor/main/tools/EditorTool'
import { WidgetFactory } from '@/editor/services/WidgetFactory'
import { container } from '@/lib/di/container'
import { Optional } from 'typescript-optional'

export class MoveTool implements IEditorTool {
	public readonly id = EditorToolId.Move

	private widget: MoveWidget | null = null

	public constructor(private readonly editor: Editor) {}

	public enterTool(): void {
		const selectedStamp = this.editor.controller.getSelectedStamp()
		if (!selectedStamp) return

		const { stampInfo } = selectedStamp.data
		const geometryProjectionService = container.resolve<GeometryProjectionService>('GeometryProjectionService')
		const surfaceBasis = geometryProjectionService.inferSurfaceBasisFromUV(this.editor.previewMesh.mesh, stampInfo.uv)
		if (!surfaceBasis) return

		const strategy = getStrategy(selectedStamp.data.projectionType)
		this.widget = WidgetFactory.create(
			'move',
			selectedStamp.getPosition3D(),
			surfaceBasis.normal,
			surfaceBasis.uAxis,
			surfaceBasis.vAxis,
			this.editor.overlayScene,
			strategy,
			stampInfo.rotation ?? 0
			// fuck off typescript
		) as unknown as MoveWidget

		this.editor.hitTester.addColliders(this.widget?.getHandles().map((h) => h.getCollider()) ?? [])
		this.editor.hitTester.canvasEventHandler.enableHandler('move')
	}

	public exitTool(): void {
		if (this.widget) {
			this.widget.destroy()
			this.widget = null
		}
		this.editor.hitTester.canvasEventHandler.disableHandler('move')
		this.editor.hitTester.clearColliders()
	}

	public getWidget(): MoveWidget {
		return Optional.ofNullable(this.widget).orElseThrow(() => new Error('MoveTool is not active'))
	}
}
