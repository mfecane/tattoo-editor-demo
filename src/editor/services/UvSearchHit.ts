import { Vector3 } from 'three'

/**
 * One body vertex's resolved hit on the patch surface, common to every UVSearchAlgorithm
 * implementation - the source UV itself isn't stored here, only what's needed to interpolate it
 * (`GeometryUtils.interpolateUv`) against whichever patch UV array the algorithm searched.
 */
export interface UvSearchHit {
	/** Resolved vertex indices (not raw index-buffer offsets) of the hit patch triangle. */
	triangle: [number, number, number]
	/** Barycentric coordinates of the hit point within `triangle`. */
	barycoord: Vector3
}
