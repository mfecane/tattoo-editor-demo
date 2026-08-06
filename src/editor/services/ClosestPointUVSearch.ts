import { CLOSEST_POINT_UV_SEARCH_CONSTANTS } from '@/editor/constants'
import { Visual3dDebugger } from '@/editor/lib/utils/Visual3dDebugger'
import { UVSearchAlgorithm, BakeSearchRequest } from '@/editor/services/UVSearchAlgorithm'
import { UvSearchHit } from '@/editor/services/UvSearchHit'
import { collectAffectedRegion, buildUvTransferResult } from '@/editor/services/UvTransferResultBuilder'
import { GrowBoundaryEdgesModifier } from '@/editor/services/GrowBoundaryEdgesModifier'
import { WorldSpaceUtils } from '@/editor/services/WorldSpaceUtils'
import { MeshBVH } from 'three-mesh-bvh'
import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute, Vector3, Matrix4, Triangle, Quaternion, Box3 } from 'three'

/**
 * Closest-point UV search: BVH-accelerated alternative to RaycastUVSearch, same patch-centric
 * approach and output contract, different core query. Instead of raycasting from each body vertex
 * along its normal, finds the closest point on any patch triangle (edge/face, not nearest vertex)
 * via a MeshBVH traversal with branch-and-bound pruning by distance.
 *
 * Candidates are gated by normal agreement (CLOSEST_POINT_UV_SEARCH_CONSTANTS.NORMAL_DOT_THRESHOLD):
 * a triangle whose normal diverges too far from the query vertex's normal is rejected outright.
 * Without this, closest-point-in-space snaps across concave folds (armpits, between fingers) to
 * geometrically-near but surface-unrelated patch regions - confirmed failure mode, not
 * hypothetical.
 *
 * Which algorithm PatchBaker actually uses is picked by MESH_BAKE_CONSTANTS.UV_SEARCH_ALGORITHM.
 */
export class ClosestPointUVSearch implements UVSearchAlgorithm {
	private visualDebugger: Visual3dDebugger | null = null

	/** Optional - when set, each search visualizes the expanded patch (wireframe) and every closest-point query, color-coded hit/miss. */
	public setDebugger(visualDebugger: Visual3dDebugger): void {
		this.visualDebugger = visualDebugger
	}

	public search(
		request: BakeSearchRequest
	): Promise<{ geometry: BufferGeometry; coverage: number; entryId: string; jobId: number }> {
		return Promise.resolve(this.computeClosestPointSearch(request))
	}

	public destroy(): void {
		// Nothing to clean up
	}

	private computeClosestPointSearch(request: BakeSearchRequest): {
		geometry: BufferGeometry
		coverage: number
		entryId: string
		jobId: number
	} {
		const { body, patch, jobId, entryId } = request

		const bodyPositions = body.geometry.attributes.position.array as Float32Array
		const bodyNormals = body.geometry.attributes.normal.array as Float32Array

		const bodyMatrix = new Matrix4().fromArray(body.matrixWorldElements)
		const patchMatrix = new Matrix4().fromArray(patch.matrixWorldElements)

		// Grow a boundary rim (UV-extrapolated) so closest points landing just past the patch's raw
		// edge still resolve a source UV - see GrowBoundaryEdgesModifier. No push-along-normal margin
		// here (unlike RaycastUVSearch): a closest-point query doesn't need surface separation to
		// avoid t≈0/negative-t misses, since it never casts a ray.
		const expandedGeometryLocal = new GrowBoundaryEdgesModifier(CLOSEST_POINT_UV_SEARCH_CONSTANTS.BOUNDARY_GROWTH).apply(
			patch.geometry
		)

		const expandedIndicesLocal = expandedGeometryLocal.index!.array as Uint32Array
		const expandedUvsLocal = expandedGeometryLocal.attributes.uv.array as Float32Array

		const expandedPositionsWorld = WorldSpaceUtils.toWorldSpace(
			expandedGeometryLocal.attributes.position.array as Float32Array,
			patchMatrix
		)

		// Build patch mesh + BVH for closest-point queries (world space)
		const patchGeometry = new BufferGeometry()
		patchGeometry.name = 'closestPointUvSearch.expandedPatch'
		patchGeometry.setAttribute('position', new Float32BufferAttribute(expandedPositionsWorld, 3))
		patchGeometry.setIndex(new Uint32BufferAttribute(expandedIndicesLocal, 1))

		// Off the cyan/red hit/miss ray coding entirely so the wireframe doesn't read as a third state.
		this.visualDebugger?.showWireframe('closestPointUvSearch.expandedPatch', patchGeometry, { color: 0xffffff })

		const bvh = new MeshBVH(patchGeometry)

		// MeshBVH construction permutes patchGeometry's index buffer in place for BVH-friendly
		// triangle layout - triangleIndex from bvh.shapecast() is a position in THAT permuted array,
		// not in expandedIndicesLocal (which is a separate copy: Uint32BufferAttribute's constructor
		// does `new Uint32Array(expandedIndicesLocal)`, which copies rather than aliasing). Vertex
		// lookups by triangleIndex must read from patchGeometry's own (now-permuted) index array.
		const bvhIndices = patchGeometry.index!.array as Uint32Array

		const bodyWorldPositions = WorldSpaceUtils.toWorldSpace(bodyPositions, bodyMatrix)
		const bodyRotation = new Quaternion().setFromRotationMatrix(bodyMatrix)

		const region = collectAffectedRegion(body)
		const hits = new Map<number, UvSearchHit>()
		const rays: { origin: Vector3; target: Vector3; hit: boolean }[] = []

		const queryPoint = new Vector3()
		const queryNormal = new Vector3()
		const candidatePoint = new Vector3()
		const closestPoint = new Vector3()
		const triangleNormal = new Vector3()
		const boxClamped = new Vector3()
		const patchVertexA = new Vector3()
		const patchVertexB = new Vector3()
		const patchVertexC = new Vector3()
		const barycoord = new Vector3()

		for (const bodyVertexIndex of region.vertexIndices) {
			queryPoint.fromArray(bodyWorldPositions, bodyVertexIndex * 3)
			queryNormal
				.set(bodyNormals[bodyVertexIndex * 3], bodyNormals[bodyVertexIndex * 3 + 1], bodyNormals[bodyVertexIndex * 3 + 2])
				.applyQuaternion(bodyRotation)
				.normalize()

			// Branch-and-bound closest-point traversal: intersectsBounds prunes any subtree whose box
			// can't possibly beat the current closest distance, boundsTraverseOrder visits the nearer
			// child first so that bound tightens as early as possible. intersectsTriangle rejects
			// normal-disagreeing triangles outright (returns false without touching the distance bound)
			// then keeps the true closest survivor.
			let closestDistanceSq = CLOSEST_POINT_UV_SEARCH_CONSTANTS.MAX_DISTANCE ** 2
			let closestTriangleIndex = -1

			bvh.shapecast({
				boundsTraverseOrder: (box: Box3) => boxClamped.copy(queryPoint).clamp(box.min, box.max).distanceToSquared(queryPoint),
				intersectsBounds: (box: Box3) =>
					boxClamped.copy(queryPoint).clamp(box.min, box.max).distanceToSquared(queryPoint) < closestDistanceSq,
				intersectsTriangle: (triangle, triangleIndex) => {
					triangle.getNormal(triangleNormal)
					if (triangleNormal.dot(queryNormal) < CLOSEST_POINT_UV_SEARCH_CONSTANTS.NORMAL_DOT_THRESHOLD) {
						return false
					}

					triangle.closestPointToPoint(queryPoint, candidatePoint)
					const distSq = queryPoint.distanceToSquared(candidatePoint)
					if (distSq < closestDistanceSq) {
						closestDistanceSq = distSq
						closestPoint.copy(candidatePoint)
						closestTriangleIndex = triangleIndex
					}
					return false
				},
			})

			if (closestTriangleIndex === -1) {
				rays.push({ origin: queryPoint.clone(), target: queryPoint.clone().addScaledVector(queryNormal, 0.02), hit: false })
				continue
			}

			rays.push({ origin: queryPoint.clone(), target: closestPoint.clone(), hit: true })

			const ia = bvhIndices[closestTriangleIndex * 3]
			const ib = bvhIndices[closestTriangleIndex * 3 + 1]
			const ic = bvhIndices[closestTriangleIndex * 3 + 2]

			patchVertexA.fromArray(expandedPositionsWorld, ia * 3)
			patchVertexB.fromArray(expandedPositionsWorld, ib * 3)
			patchVertexC.fromArray(expandedPositionsWorld, ic * 3)
			Triangle.getBarycoord(closestPoint, patchVertexA, patchVertexB, patchVertexC, barycoord)

			hits.set(bodyVertexIndex, { triangle: [ia, ib, ic], barycoord: barycoord.clone() })
		}

		this.visualDebugger?.showRays('closestPointUvSearch.rays', rays)

		const { geometry, coverage } = buildUvTransferResult(body, region, hits, expandedUvsLocal)
		return { geometry, coverage, entryId, jobId }
	}
}
