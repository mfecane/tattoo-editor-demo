import { MESH_BAKE_CONSTANTS } from '@/editor/constants'
import { UVSearchAlgorithm } from '@/editor/services/UVSearchAlgorithm'
import { RaycastUVSearch } from '@/editor/services/RaycastUVSearch'
import { ClosestPointUVSearch } from '@/editor/services/ClosestPointUVSearch'
import { BakeRequestBuilder } from '@/editor/services/BakeRequestBuilder'
import { FootprintRasterizer } from '@/editor/services/FootprintRasterizer'
import { PatchRegionMaskRasterizer } from '@/editor/services/PatchRegionMaskRasterizer'
import { Editor } from '@/editor/main/Editor'
import { BufferGeometry } from 'three'

/**
 * Produces one drapedPatch's bakedLayer (Piece.bakedTarget) and nothing else - composing
 * bakedLayers onto the body texture is BodyTextureComposer's job.
 *
 * Search (UVSearchAlgorithm, main thread): finds, for each affected body vertex, its source UV on
 * the drapedPatch surface. Which implementation - RaycastUVSearch (margin-expanded raycasting) or
 * ClosestPointUVSearch (BVH-accelerated, normal-gated closest point) - is picked by
 * MESH_BAKE_CONSTANTS.UV_SEARCH_ALGORITHM. Request/response marshalling lives in
 * BakeRequestBuilder; the actual GPU draw that turns the search result into a texture lives in
 * FootprintRasterizer.
 *
 * A bake is triggered (see EditorController.setSelectedPlacedMeshId) only when the user leaves a
 * dirty patch's edit context, never on every command - no explicit bake button. The editor
 * container shows a whole-screen spinner for as long as any bake is in flight (see
 * addOnBakingChangeListener). Stale in-flight jobs (the same patch went dirty again before the
 * previous job returned) are detected via a per-entry generation counter and discarded silently.
 */
export class PatchBaker {
	private readonly uvSearch: UVSearchAlgorithm
	private readonly regionMaskRasterizer: PatchRegionMaskRasterizer = new PatchRegionMaskRasterizer()
	private readonly generationByEntry: Map<string, number> = new Map()
	private readonly bakingChangeListeners: Set<(baking: boolean) => void> = new Set()
	private activeJobCount: number = 0

	public constructor(private readonly editor: Editor) {
		this.uvSearch =
			MESH_BAKE_CONSTANTS.UV_SEARCH_ALGORITHM === 'closest-point'
				? new ClosestPointUVSearch()
				: new RaycastUVSearch()
		// this.uvSearch.setDebugger(this.editor.visual3dDebugger) // uncomment to visualize the expanded patch + hit/miss rays during search
	}

	public destroy(): void {
		this.uvSearch.destroy()
	}

	/** Whether a bake job is currently in flight - see addOnBakingChangeListener for change notifications. */
	public isBaking(): boolean {
		return this.activeJobCount > 0
	}

	/** Fires whenever isBaking() flips, not on every job start/end - callback pattern per CameraUpdateController.subscribe. */
	public addOnBakingChangeListener(listener: (baking: boolean) => void): AbortController {
		this.bakingChangeListeners.add(listener)

		const controller = new AbortController()
		controller.signal.addEventListener('abort', () => this.bakingChangeListeners.delete(listener))
		return controller
	}

	/** Marks intent to bake this patch and posts the search job. Superseded by any later call for the same id (see generationByEntry). */
	public scheduleBake(entryId: string): void {
		const entry = this.editor.controller.project.placedMeshList.getById(entryId)
		if (!entry || entry.kind !== 'drapedPatch' || !entry.bakeDirty) {
			return
		}

		const generation = (this.generationByEntry.get(entryId) ?? 0) + 1
		this.generationByEntry.set(entryId, generation)

		const request = BakeRequestBuilder.build(this.editor, entry, generation)
		if (!request) {
			return
		}

		this.beginJob()
		this.uvSearch.search(request).then((response) => {
			this.endJob()
			this.handleSearchResult(response)
		})
	}

	private beginJob(): void {
		this.activeJobCount++
		if (this.activeJobCount === 1) {
			this.notifyBakingChange()
		}
	}

	private endJob(): void {
		this.activeJobCount--
		if (this.activeJobCount === 0) {
			this.notifyBakingChange()
		}
	}

	private notifyBakingChange(): void {
		const baking = this.isBaking()
		for (const listener of this.bakingChangeListeners) {
			listener(baking)
		}
	}

	private handleSearchResult(result: {
		geometry: BufferGeometry
		coverage: number
		entryId: string
		jobId: number
	}): void {
		if (this.generationByEntry.get(result.entryId) !== result.jobId) {
			return // stale - a newer job for this entry has already been scheduled
		}

		if (result.geometry.attributes.position.array.length === 0) {
			// Nothing valid to bake (e.g. patch fully off-surface) - leave any previous cache as-is.
			return
		}

		const entry = this.editor.controller.project.placedMeshList.getById(result.entryId)
		if (!entry || entry.kind !== 'drapedPatch') {
			return // entry removed or unwrapped while this bake was in flight - nothing to rasterize onto
		}

		const regionMask = this.regionMaskRasterizer.rasterize(this.editor.renderer, entry.mesh.geometry)
		const target = FootprintRasterizer.rasterize(
			this.editor.renderer,
			result.geometry,
			entry.texture,
			regionMask.texture
		)
		regionMask.dispose()

		this.editor.controller.project.placedMeshList.setBakedLayer(result.entryId, target, result.coverage)
		this.editor.controller.refreshBakeAndVisibility()
	}
}
