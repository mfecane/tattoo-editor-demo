import type { EditorCommand } from '@/editor/main/EditorCommand'
import type { EditorController } from '@/editor/main/EditorController'

/**
 * Commits a vertex-slide fine-tune drag on a wrapped mesh. Like
 * UpdatePlacedMeshCommand, the interaction handler already mutated the live
 * geometry during the drag for preview, so both snapshots are captured by
 * the caller (MoveStart / MoveEnd) rather than derived here.
 */
export class UpdateWrappedMeshVerticesCommand implements EditorCommand {
	public constructor(
		private readonly placedMeshId: string,
		private readonly before: Float32Array,
		private readonly after: Float32Array,
		private readonly controller: EditorController
	) {}

	public execute(): void {
		this.apply(this.after)
	}

	public undo(): void {
		this.apply(this.before)
		this.reselect()
	}

	public redo(): void {
		this.apply(this.after)
		this.reselect()
	}

	public isUndoable(): boolean {
		return true
	}

	// A dirty (unbaked) drapedPatch only gets baked on leaving its edit context (see
	// EditorController.setSelectedPlacedMeshId) - undo/redo mutate geometry without ever
	// selecting/deselecting anything, so reverting/reapplying this drag while some other (or no)
	// mesh is selected would otherwise leave the cached bake stale forever. Forcing selection onto
	// this entry shows the live (unbaked) geometry immediately and queues a correct bake the next
	// time selection actually moves away from it.
	private reselect(): void {
		if (this.controller.getSelectedPlacedMeshId() !== this.placedMeshId) {
			this.controller.setSelectedPlacedMeshId(this.placedMeshId)
		}
	}

	private apply(positions: Float32Array): void {
		const entry = this.controller.project.placedMeshList.getById(this.placedMeshId)
		if (!entry) {
			return
		}
		const positionAttr = entry.mesh.geometry.attributes.position
		;(positionAttr.array as Float32Array).set(positions)
		positionAttr.needsUpdate = true
		entry.mesh.geometry.computeVertexNormals()
		// Draped geometry changed (relax or a committed vertex-slide drag) - the cached reverse-bake layer is stale.
		this.controller.project.placedMeshList.setBakeDirty(this.placedMeshId, true)
	}
}
