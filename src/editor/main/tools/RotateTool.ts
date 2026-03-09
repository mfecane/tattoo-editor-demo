import { getStrategy } from '@/editor/lib/lattice/ProjectionStrategyFactory'
import { RotateWidget } from '@/editor/lib/widget/RotateWidget'
import { Editor } from '@/editor/main/Editor'
import { GeometryProjectionService } from '@/editor/services/GeometryProjectionService'
import { EditorToolId, IEditorTool } from '@/editor/main/tools/EditorTool'
import { WidgetFactory } from '@/editor/services/WidgetFactory'
import { container } from '@/lib/di/container'
import { Optional } from 'typescript-optional'

export class RotateTool implements IEditorTool {
	public readonly id = EditorToolId.Rotate

	private widget: RotateWidget | null = null

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
			'rotate',
			selectedStamp.getPosition3D(),
			surfaceBasis.normal,
			surfaceBasis.uAxis,
			surfaceBasis.vAxis,
			this.editor.overlayScene,
			strategy,
			stampInfo.rotation ?? 0
		) as RotateWidget

		this.widget.getGroup().updateMatrixWorld(true)
		this.editor.hitTester.addColliders(this.widget.getColliders())
		this.editor.hitTester.canvasEventHandler.enableHandler('rotate')
	}

	public exitTool(): void {
		if (this.widget) {
			this.widget.destroy()
			this.widget = null
		}
		this.editor.hitTester.canvasEventHandler.disableHandler('rotate')
		this.editor.hitTester.clearColliders()
	}

	public getWidget(): RotateWidget {
		return Optional.ofNullable(this.widget).orElseThrow(() => new Error('RotateTool is not active'))
	}
}
