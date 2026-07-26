import { UVSearchAlgorithm } from '@/editor/services/UVSearchAlgorithm'
import { RaycastUVSearch } from '@/editor/services/RaycastUVSearch'
import { BakeRequestBuilder } from '@/editor/services/BakeRequestBuilder'
import { FootprintRasterizer } from '@/editor/services/FootprintRasterizer'
import { Editor } from '@/editor/main/Editor'
import { BufferGeometry } from 'three'

/**
 * Produces one drapedPatch's bakedLayer (Piece.bakedTarget) and nothing else - composing
 * bakedLayers onto the body texture is BodyTextureComposer's job.
 *
 * Search (RaycastUVSearch, main thread): expands the drapedPatch's geometry along its normals with
 * a boundary rim, then raycasts from each affected body vertex onto that expanded patch surface to
 * find its source UV. Request/response marshalling lives in BakeRequestBuilder; the actual GPU draw
 * that turns the search result into a texture lives in FootprintRasterizer.
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
		this.uvSearch = new RaycastUVSearch()
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
