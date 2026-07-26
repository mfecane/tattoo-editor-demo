import { BufferGeometry } from 'three'

export interface BakeSearchRequest {
	jobId: number
	entryId: string
	body: {
		/** Snapshot geometry with position, normal, and uv attributes plus an index. */
		geometry: BufferGeometry
		/** [start, count] index range of the tile-1001 material group - see PreviewMeshFactory.mergeGroupMeshes. */
		groupRange: [number, number]
		matrixWorldElements: number[]
	}
	patch: {
		/** Snapshot geometry with position and uv attributes plus an index. */
		geometry: BufferGeometry
		matrixWorldElements: number[]
	}
}

/**
 * UV search algorithm: takes body mesh and drapedPatch, finds which body vertices map to patch UVs.
 * Returns a new BufferGeometry (subset of body mesh) with hit vertices and their source UVs.
 */
export interface UVSearchAlgorithm {
	/**
	 * Execute search: return geometry for bake footprint.
	 * - Vertices: only those with successful raycast hits
	 * - Triangles: only those using hit vertices
	 * - Attributes: position, normal, uv (preserved from body), uv1 (source UVs from hits)
	 * - Coverage: fraction of affected vertices that got hits
	 * - entryId, jobId: for stale-result detection
	 */
	search(request: BakeSearchRequest): Promise<{ geometry: BufferGeometry; coverage: number; entryId: string; jobId: number }>

	/** Clean up any persistent resources (workers, etc). */
	destroy(): void
}
