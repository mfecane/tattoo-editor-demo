import type { EditorCommand } from '@/editor/main/EditorCommand'
import type { EditorController } from '@/editor/main/EditorController'
import { RegionMeshFactory } from '@/editor/main/RegionMeshFactory'
import { Quaternion, Vector3 } from 'three'

export interface PlacedMeshTransform {
	position: Vector3
	quaternion: Quaternion
	scale: Vector3
}

/**
 * Unlike stamps (data model separate from the live lattice-deformed
 * visual), a PlacedMesh's Mesh *is* the data - the interaction handler
 * mutates position/quaternion/scale live during the drag for preview, so
 * by the time this command runs the mesh is already at `after`. Both
 * snapshots are therefore captured by the caller (MoveStart / MoveEnd),
 * not derived from live state inside execute().
 *
 * When the scale actually changed (a resize commit, not a move/rotate),
 * apply() also retessellates the mesh's geometry from its source region
 * shape at the new scale, so triangle size stays roughly constant in world
 * space regardless of how much the mesh has been scaled - see
 * RegionMeshFactory.createGeometry. Geometry is treated as a pure
 * deterministic function of (sourceShape, scale), never as independent
 * state to snapshot, so execute()/undo()/redo() all naturally regenerate
 * the correct geometry for whichever scale they're applying just by
 * re-running apply() - no separate geometry snapshots needed.
 */
export class UpdatePlacedMeshCommand implements EditorCommand {
	private readonly scaleChanged: boolean

	public constructor(
		private readonly placedMeshId: string,
		private readonly before: PlacedMeshTransform,
		private readonly after: PlacedMeshTransform,
		private readonly controller: EditorController
	) {
		this.scaleChanged = !before.scale.equals(after.scale)
	}

	public execute(): void {
		this.apply(this.after)
	}

	public undo(): void {
		this.apply(this.before)
	}

	public redo(): void {
		this.apply(this.after)
	}

	public isUndoable(): boolean {
		return true
	}

	private apply(transform: PlacedMeshTransform): void {
		const entry = this.controller.project.placedMeshList.getById(this.placedMeshId)
		if (!entry) {
			return
		}
		entry.mesh.position.copy(transform.position)
		entry.mesh.quaternion.copy(transform.quaternion)
		entry.mesh.scale.copy(transform.scale)

		// TransformTool only ever targets a flat (unwrapped) mesh (see EditorController.syncActiveToolToTarget) -
		// entry.kind !== 'drapedPatch' is a defensive no-op guard, not a case this is expected to hit.
		if (this.scaleChanged && entry.kind !== 'drapedPatch') {
			const geometry = RegionMeshFactory.createGeometry(entry.sourceShape, entry.sketchAspect, transform.scale.x, transform.scale.y)
			entry.mesh.geometry.dispose()
			entry.mesh.geometry = geometry
		}
	}
}
