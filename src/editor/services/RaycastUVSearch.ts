import { RAYCAST_UV_SEARCH_CONSTANTS } from '@/editor/constants'
import { Visual3dDebugger } from '@/editor/lib/utils/Visual3dDebugger'
import { UVSearchAlgorithm, BakeSearchRequest } from '@/editor/services/UVSearchAlgorithm'
import { UvSearchHit } from '@/editor/services/UvSearchHit'
import { collectAffectedRegion, buildUvTransferResult } from '@/editor/services/UvTransferResultBuilder'
import { PushModifier } from '@/editor/services/PushModifier'
import { GrowBoundaryEdgesModifier } from '@/editor/services/GrowBoundaryEdgesModifier'
import { WorldSpaceUtils } from '@/editor/services/WorldSpaceUtils'
import {
	BufferGeometry,
	Float32BufferAttribute,
	Uint32BufferAttribute,
	Vector3,
	Matrix4,
	Triangle,
	Raycaster,
	Mesh,
	MeshBasicMaterial,
	Quaternion,
	DoubleSide,
} from 'three'

/**
 * Raycast UV search: patch-centric approach with margin expansion.
 * Expands drapedPatch along normals, raycasts from body vertices to find UVs on patch surface.
 */
export class RaycastUVSearch implements UVSearchAlgorithm {
	private visualDebugger: Visual3dDebugger | null = null

	/** Optional - when set, each search visualizes the expanded patch (wireframe) and every ray cast, color-coded hit/miss. */
	public setDebugger(visualDebugger: Visual3dDebugger): void {
		this.visualDebugger = visualDebugger
	}

	public search(
		request: BakeSearchRequest
	): Promise<{ geometry: BufferGeometry; coverage: number; entryId: string; jobId: number }> {
		return Promise.resolve(this.computeRaycastSearch(request))
	}

	public destroy(): void {
		// Nothing to clean up
	}

	private computeRaycastSearch(request: BakeSearchRequest): {
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
		const patchMatrixInverse = patchMatrix.clone().invert()

		// Expand the patch's own geometry (already position + uv + index) in LOCAL space: push along
		// vertex normals, then grow a boundary rim with UV extrapolation - two independent
		// GeometryModifiers (not a single bundled call), though only the final result is visualized
		// below.
		const patchGeometryLocal = patch.geometry
		const pushedGeometryLocal = new PushModifier(RAYCAST_UV_SEARCH_CONSTANTS.NORMAL_MARGIN).apply(patchGeometryLocal)
		const expandedGeometryLocal = new GrowBoundaryEdgesModifier(RAYCAST_UV_SEARCH_CONSTANTS.BOUNDARY_GROWTH).apply(
			pushedGeometryLocal
		)

		const expandedPositionsLocal = expandedGeometryLocal.attributes.position.array as Float32Array
		const expandedIndicesLocal = expandedGeometryLocal.index!.array as Uint32Array
		const expandedUvsLocal = expandedGeometryLocal.attributes.uv.array as Float32Array

		// Transform expanded positions to world space
		const expandedPositionsWorld = WorldSpaceUtils.toWorldSpace(expandedPositionsLocal, patchMatrix)

		// Build patch mesh for raycasting (world space)
		const patchGeometry = new BufferGeometry()
		patchGeometry.setAttribute('position', new Float32BufferAttribute(expandedPositionsWorld, 3))
		patchGeometry.setIndex(new Uint32BufferAttribute(expandedIndicesLocal, 1))
		patchGeometry.computeBoundingSphere()

		this.visualDebugger?.showWireframe('raycastUvSearch.expandedPatch', patchGeometry, { color: 0xffaa00 })

		const patchMesh = new Mesh(patchGeometry, new MeshBasicMaterial({ side: DoubleSide }))
		const raycaster = new Raycaster()

		// How far to draw a missed ray for debug visualization, since it has no hit point to stop at.
		const missRayLength = patchGeometry.boundingSphere?.radius ?? 1

		// Compute world-space body positions
		const bodyWorldPositions = WorldSpaceUtils.toWorldSpace(bodyPositions, bodyMatrix)

		// Raycast from body vertices to patch
		const hits = new Map<number, UvSearchHit>()
		const rays: { origin: Vector3; target: Vector3; hit: boolean }[] = []
		const direction = new Vector3()
		const rayOrigin = new Vector3()
		const patchVertexA = new Vector3()
		const patchVertexB = new Vector3()
		const patchVertexC = new Vector3()
		const bary = new Vector3()

		const region = collectAffectedRegion(body)

		// Raycast each affected body vertex towards the patch
		for (const bodyVertexIndex of region.vertexIndices) {
			// Ray origin: already in world space
			rayOrigin.fromArray(bodyWorldPositions, bodyVertexIndex * 3)

			// Ray direction: body normal transformed to world space
			const bodyNormalLocal = new Vector3(
				bodyNormals[bodyVertexIndex * 3],
				bodyNormals[bodyVertexIndex * 3 + 1],
				bodyNormals[bodyVertexIndex * 3 + 2]
			).normalize()
			direction.copy(bodyNormalLocal)
			direction.applyQuaternion(new Quaternion().setFromRotationMatrix(bodyMatrix))
			direction.normalize()

			// Raycast using Three.js Raycaster
			raycaster.set(rayOrigin, direction)
			const intersections = raycaster.intersectObject(patchMesh)
			const hit = intersections.length > 0 ? intersections[0] : null

			if (!hit) {
				rays.push({
					origin: rayOrigin.clone(),
					target: rayOrigin.clone().addScaledVector(direction, missRayLength),
					hit: false,
				})
				continue
			}

			rays.push({ origin: rayOrigin.clone(), target: hit.point.clone(), hit: true })

			// Interpolate UVs at hit point using expanded geometry
			// hit.face.a/b/c are already resolved vertex indices (Three's raycaster
			// dereferences the index buffer internally), so use them directly.
			const ia = hit.face!.a
			const ib = hit.face!.b
			const ic = hit.face!.c

			patchVertexA.fromArray(expandedPositionsLocal, ia * 3)
			patchVertexB.fromArray(expandedPositionsLocal, ib * 3)
			patchVertexC.fromArray(expandedPositionsLocal, ic * 3)

			// Transform hit point from world space to patch local space for barycentric calculation
			const hitPointLocal = hit.point.clone().applyMatrix4(patchMatrixInverse)
			Triangle.getBarycoord(hitPointLocal, patchVertexA, patchVertexB, patchVertexC, bary)

			hits.set(bodyVertexIndex, { triangle: [ia, ib, ic], barycoord: bary.clone() })
		}

		this.visualDebugger?.showRays('raycastUvSearch.rays', rays)

		const { geometry, coverage } = buildUvTransferResult(body, region, hits, expandedUvsLocal)
		return { geometry, coverage, entryId, jobId }
	}
}
