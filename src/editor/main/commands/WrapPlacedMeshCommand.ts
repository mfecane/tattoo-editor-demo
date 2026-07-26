import { MESH_WRAP_CONSTANTS } from '@/editor/constants'
import type { EditorCommand } from '@/editor/main/EditorCommand'
import type { EditorController } from '@/editor/main/EditorController'
import { applyMeshSnapshot } from '@/editor/main/MeshSnapshot'
import { PlacedMeshRelaxer } from '@/editor/main/PlacedMeshRelaxer'
import { PlacedMeshWrapper } from '@/editor/main/PlacedMeshWrapper'

/**
 * Runs the front-marching wrap algorithm on a placed mesh. If it fails
 * (coverage stall, self-fold, distortion blowup - see PlacedMeshWrapper),
 * the mesh is left untouched and this command records itself as a no-op,
 * so it never enters the undo history.
 */
export class WrapPlacedMeshCommand implements EditorCommand {
	private succeeded: boolean = false

	public constructor(
		private readonly placedMeshId: string,
		private readonly controller: EditorController
	) {}

	public execute(): void {
		const entry = this.controller.project.placedMeshList.getById(this.placedMeshId)
		if (!entry || entry.kind === 'drapedPatch') {
			this.succeeded = false
			return
		}

		// Transition regionMesh to drapedPatch, capturing current state for unwrap.
		this.controller.project.placedMeshList.makeWrapped(this.placedMeshId, entry.mesh)
		const wrapped = this.controller.project.placedMeshList.getById(this.placedMeshId)
		if (!wrapped || wrapped.kind !== 'drapedPatch') {
			this.succeeded = false
			return
		}

		const bodyMesh = this.controller.editor.previewMesh.mesh
		const result = PlacedMeshWrapper.wrap(wrapped.mesh, bodyMesh)
		this.succeeded = result.success
		if (this.succeeded) {
			PlacedMeshRelaxer.relax(
				wrapped.mesh,
				wrapped.flatBackup!,
				bodyMesh,
				MESH_WRAP_CONSTANTS.AUTO_RELAX_STRENGTH,
				MESH_WRAP_CONSTANTS.AUTO_RELAX_ITERATIONS,
				MESH_WRAP_CONSTANTS.AUTO_RELAX_BOUNDARY_WEIGHT
			)
			this.controller.clearWrapPreview(this.placedMeshId)
		} else {
			// Wrap failed - transition back to regionMesh state
			this.controller.project.placedMeshList.makeUnwrapped(this.placedMeshId, wrapped.mesh)
			if (result.invalidGeometry) {
				// Show the failed attempt on the preview ghost only - the real mesh stays flat and untouched.
				this.controller.showWrapAttemptResult(this.placedMeshId, result.invalidGeometry, false)
			}
		}
	}

	public undo(): void {
		if (!this.succeeded) {
			return
		}
		const entry = this.controller.project.placedMeshList.getById(this.placedMeshId)
		if (!entry || entry.kind !== 'drapedPatch') {
			return
		}
		applyMeshSnapshot(entry.mesh, entry.flatBackup!)
		this.controller.project.placedMeshList.makeUnwrapped(this.placedMeshId, entry.mesh)
		this.controller.scheduleWrapPreview(this.placedMeshId)
	}

	public redo(): void {
		this.execute()
	}

	public isUndoable(): boolean {
		return this.succeeded
	}

	public didSucceed(): boolean {
		return this.succeeded
	}
}
