import { MeshUtils } from '@/editor/lib/utils/MeshUtils'
import { RigidMeshStrategy } from '@/editor/lib/widget/RigidMeshStrategy'
import { TransformWidget } from '@/editor/lib/widget/TransformWidget'
import { Editor } from '@/editor/main/Editor'
import { EditorToolId, IEditorTool } from '@/editor/main/tools/EditorTool'
import { WidgetFactory } from '@/editor/services/WidgetFactory'
import { container } from '@/lib/di/container'
import { Vector2, Vector3 } from 'three'
import { Optional } from 'typescript-optional'

/** Handler ids the combined widget dispatches to - one per HitResultType a handle on it can produce. */
const TRANSFORM_HANDLER_IDS = ['move-placed-mesh', 'rotate-placed-mesh', 'resize-placed-mesh']

export class TransformTool implements IEditorTool {
	public readonly id = EditorToolId.Transform

	private widget: TransformWidget | null = null

	private readonly meshUtils: MeshUtils = container.resolve<MeshUtils>('MeshUtils')

	public constructor(private readonly editor: Editor) {}

	public enterTool(): void {
		const selectedPlacedMesh = this.editor.controller.getSelectedPlacedMesh()
		if (!selectedPlacedMesh) return

		const { mesh } = selectedPlacedMesh
		const normal = new Vector3(0, 0, 1).applyQuaternion(mesh.quaternion)
		const uAxis = new Vector3(1, 0, 0).applyQuaternion(mesh.quaternion)
		const vAxis = new Vector3(0, 1, 0).applyQuaternion(mesh.quaternion)
		const halfExtents = this.meshUtils.computeLocalHalfExtents(mesh)
		halfExtents.multiply(new Vector2(mesh.scale.x, mesh.scale.y))

		this.widget = WidgetFactory.create(
			mesh.position,
			normal,
			uAxis,
			vAxis,
			halfExtents,
			this.editor,
			new RigidMeshStrategy(),
			0
		) as TransformWidget

		this.widget.getGroup().updateMatrixWorld(true)
		this.editor.hitTester.addColliders(this.widget.getColliders())
		for (const handlerId of TRANSFORM_HANDLER_IDS) {
			this.editor.canvasEventHandler.enableHandler(handlerId)
		}
	}

	public exitTool(): void {
		if (this.widget) {
			this.widget.destroy()
			this.widget = null
		}
		for (const handlerId of TRANSFORM_HANDLER_IDS) {
			this.editor.canvasEventHandler.disableHandler(handlerId)
		}
		this.editor.hitTester.clearColliders()
	}

	public getWidget(): TransformWidget {
		return Optional.ofNullable(this.widget).orElseThrow(() => new Error('TransformTool is not active'))
	}
}
