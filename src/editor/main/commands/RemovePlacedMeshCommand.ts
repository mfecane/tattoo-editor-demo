import { EditorCommand } from '@/editor/main/EditorCommand'
import { EditorController } from '@/editor/main/EditorController'
import { Piece } from '@/editor/main/PlacedMeshList'

export class RemovePlacedMeshCommand implements EditorCommand {
	private removedEntry: Piece | null = null

	public constructor(
		private readonly placedMeshId: string,
		private readonly controller: EditorController
	) {}

	public execute(): void {
		const entry = this.controller.project.placedMeshList.getById(this.placedMeshId)
		if (!entry) {
			return
		}
		this.removedEntry = entry
		this.controller.editor.previewScene.remove(entry.mesh)
		this.controller.project.placedMeshList.removeById(this.placedMeshId)
	}

	public undo(): void {
		const entry = this.removedEntry
		if (!entry) {
			return
		}
		this.controller.editor.previewScene.add(entry.mesh)
		this.controller.project.placedMeshList.add(this.placedMeshId, entry.mesh, entry.sourceShape, entry.texture, entry.sketchAspect)
	}

	public redo(): void {
		this.execute()
	}

	/**
	 * Only true when the removed piece was applied (drapedPatch) - removing a regionMesh still in
	 * placement mode (never wrapped, or unwrapped and never wrapped back) must not produce a
	 * history step, since undoing it would resurrect a piece stuck in placement mode (see
	 * AddPlacedMeshCommand). That removal simply isn't tracked; discarding an unapplied piece is
	 * final.
	 */
	public isUndoable(): boolean {
		return this.removedEntry?.kind === 'drapedPatch'
	}
}
