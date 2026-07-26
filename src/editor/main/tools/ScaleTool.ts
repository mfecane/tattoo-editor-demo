import { RigidMeshStrategy } from '@/editor/lib/widget/RigidMeshStrategy'
import { ScalingWidget } from '@/editor/lib/widget/ScalingWidget'
import { Editor } from '@/editor/main/Editor'
import { EditorToolId, IEditorTool } from '@/editor/main/tools/EditorTool'
import { WidgetFactory } from '@/editor/services/WidgetFactory'
import { Vector3 } from 'three'
import { Optional } from 'typescript-optional'

export class ScaleTool implements IEditorTool {
	public readonly id = EditorToolId.Scale

	private widget: ScalingWidget | null = null

	public constructor(private readonly editor: Editor) {}

	public enterTool(): void {
		const selectedPlacedMesh = this.editor.controller.getSelectedPlacedMesh()
		if (!selectedPlacedMesh) return

		const { mesh } = selectedPlacedMesh
		const normal = new Vector3(0, 0, 1).applyQuaternion(mesh.quaternion)
		const uAxis = new Vector3(1, 0, 0).applyQuaternion(mesh.quaternion)
		const vAxis = new Vector3(0, 1, 0).applyQuaternion(mesh.quaternion)

		this.widget = WidgetFactory.create(
			'scaling',
			mesh.position,
			normal,
			uAxis,
			vAxis,
			this.editor,
			new RigidMeshStrategy(),
			0
		) as ScalingWidget

		this.widget.getGroup().updateMatrixWorld(true)
		this.editor.hitTester.addColliders(this.widget.getColliders())
		this.editor.canvasEventHandler.enableHandler('resize-placed-mesh')
	}

	public exitTool(): void {
		if (this.widget) {
			this.widget.destroy()
			this.widget = null
		}
		this.editor.canvasEventHandler.disableHandler('resize-placed-mesh')
		this.editor.hitTester.clearColliders()
	}

	public getWidget(): ScalingWidget {
		return Optional.ofNullable(this.widget).orElseThrow(() => new Error('ScaleTool is not active'))
	}

	public isTargetValid(): boolean {
		const selectedPlacedMesh = this.editor.controller.getSelectedPlacedMesh()
		return selectedPlacedMesh !== null && selectedPlacedMesh.kind === 'regionMesh'
	}
}
