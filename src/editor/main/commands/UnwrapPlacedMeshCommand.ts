import type { EditorCommand } from '@/editor/main/EditorCommand'
import type { EditorController } from '@/editor/main/EditorController'
import { applyMeshSnapshot } from '@/editor/main/MeshSnapshot'
import { PlacedMeshWrapper } from '@/editor/main/PlacedMeshWrapper'

/**
 * Restores a wrapped mesh to its backed-up flat state. Undo re-runs the wrap
 * algorithm rather than storing a separate wrapped-geometry snapshot - the
 * flat backup + target mesh fully determine the wrap result, so re-wrapping
 * from the restored flat state is deterministic.
 */
export class UnwrapPlacedMeshCommand implements EditorCommand {
	private applied: boolean = false

	public constructor(
		private readonly placedMeshId: string,
		private readonly controller: EditorController
	) {}

	public execute(): void {
		const entry = this.controller.project.placedMeshList.getById(this.placedMeshId)
		if (!entry || entry.kind !== 'drapedPatch') {
			this.applied = false
			return
		}
		applyMeshSnapshot(entry.mesh, entry.flatBackup!)
		this.controller.project.placedMeshList.makeUnwrapped(this.placedMeshId, entry.mesh)
		this.applied = true
		this.controller.scheduleWrapPreview(this.placedMeshId)
	}

	public undo(): void {
		if (!this.applied) {
			return
		}
		const entry = this.controller.project.placedMeshList.getById(this.placedMeshId)
		if (!entry) {
			return
		}
		const result = PlacedMeshWrapper.wrap(entry.mesh, this.controller.editor.previewMesh.mesh)
		if (result.success) {
			this.controller.project.placedMeshList.makeWrapped(this.placedMeshId, entry.mesh)
			this.controller.clearWrapPreview(this.placedMeshId)
		}
	}

	public redo(): void {
		this.execute()
	}

	public isUndoable(): boolean {
		return this.applied
	}
}
