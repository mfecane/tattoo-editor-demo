import { MESH_BAKE_CONSTANTS } from '@/editor/constants'
import { UVSearchAlgorithm } from '@/editor/services/UVSearchAlgorithm'
import { RaycastUVSearch } from '@/editor/services/RaycastUVSearch'
import { ClosestPointUVSearch } from '@/editor/services/ClosestPointUVSearch'
import { BakeRequestBuilder } from '@/editor/services/BakeRequestBuilder'
import { FootprintRasterizer } from '@/editor/services/FootprintRasterizer'
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
 * dirty patch's edit context, never on every command - no explicit bake button, no blocking
 * spinner. Stale in-flight jobs (the same patch went dirty again before the previous job returned)
 * are detected via a per-entry generation counter and discarded silently.
 */
export class PatchBaker {
	private readonly uvSearch: UVSearchAlgorithm
	private readonly generationByEntry: Map<string, number> = new Map()

	public constructor(private readonly editor: Editor) {
		this.uvSearch = MESH_BAKE_CONSTANTS.UV_SEARCH_ALGORITHM === 'closest-point' ? new ClosestPointUVSearch() : new RaycastUVSearch()
		// this.uvSearch.setDebugger(this.editor.visual3dDebugger) // uncomment to visualize the expanded patch + hit/miss rays during search
	}

	public destroy(): void {
		this.uvSearch.destroy()
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

		this.uvSearch.search(request).then((response) => this.handleSearchResult(response))
	}

	private handleSearchResult(result: { geometry: BufferGeometry; coverage: number; entryId: string; jobId: number }): void {
		if (this.generationByEntry.get(result.entryId) !== result.jobId) {
			return // stale - a newer job for this entry has already been scheduled
		}

		if (result.geometry.attributes.position.array.length === 0) {
			// Nothing valid to bake (e.g. patch fully off-surface) - leave any previous cache as-is.
			return
		}

		const entry = this.editor.controller.project.placedMeshList.getById(result.entryId)
		const sketchTexture = entry?.kind === 'drapedPatch' ? entry.texture : null

		const target = FootprintRasterizer.rasterize(this.editor.renderer, result.geometry, sketchTexture)
		this.editor.controller.project.placedMeshList.setBakedLayer(result.entryId, target, result.coverage)
		this.editor.controller.refreshBakeAndVisibility()
	}
}
