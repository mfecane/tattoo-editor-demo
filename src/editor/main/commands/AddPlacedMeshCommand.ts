import { EditorCommand } from '@/editor/main/EditorCommand'
import { EditorController } from '@/editor/main/EditorController'
import { RegionShape } from '@/editor/polygon/RegionShape'
import { Mesh, Texture } from 'three'
import { v7 as uuid } from 'uuid'

export class AddPlacedMeshCommand implements EditorCommand {
	private readonly id: string = uuid()

	public constructor(
		private readonly mesh: Mesh,
		private readonly sourceShape: RegionShape,
		private readonly texture: Texture,
		private readonly sketchAspect: number,
		private readonly controller: EditorController
	) {}

	public execute(): void {
		this.controller.editor.previewScene.add(this.mesh)
		this.controller.project.placedMeshList.add(this.id, this.mesh, this.sourceShape, this.texture, this.sketchAspect)
	}

	public undo(): void {
		this.controller.editor.previewScene.remove(this.mesh)
		this.controller.project.placedMeshList.removeById(this.id)
	}

	public redo(): void {
		this.execute()
	}

	/**
	 * Always false - placing a mesh always results in a regionMesh sitting in placement mode
	 * (not yet applied/wrapped), and that state must never be something undo/redo can produce or
	 * land on (see PlacementGuardInteractionHandler/ReactBridge.guardAgainstUnresolvedPlacement -
	 * the only way out of placement mode is Apply or the discard confirmation, never undo). History
	 * only starts tracking a piece once WrapPlacedMeshCommand successfully applies it.
	 */
	public isUndoable(): boolean {
		return false
	}

	public getPlacedMeshId(): string {
		return this.id
	}
}
