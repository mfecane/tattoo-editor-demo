import { RAYCAST_UV_SEARCH_CONSTANTS } from '@/editor/constants'
import { Visual3dDebugger } from '@/editor/lib/utils/Visual3dDebugger'
import { UVSearchAlgorithm, BakeSearchRequest } from '@/editor/services/UVSearchAlgorithm'
import { GeometryUtils } from '@/editor/services/GeometryUtils'
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
		const bodyUvs = body.geometry.attributes.uv.array as Float32Array
		const bodyIndices = body.geometry.index!.array as Uint32Array

		const bodyMatrix = new Matrix4().fromArray(body.matrixWorldElements)
		const patchMatrix = new Matrix4().fromArray(patch.matrixWorldElements)
		const patchMatrixInverse = patchMatrix.clone().invert()

		// Expand the patch's own geometry (already position + uv + index) in LOCAL space: push along
		// vertex normals, then grow a boundary rim with UV extrapolation - two independent steps
		// (not a single bundled call), though only the final result is visualized below.
		const patchGeometryLocal = patch.geometry
		const patchPositionsLocal = patchGeometryLocal.attributes.position.array as Float32Array
		const patchIndicesLocal = patchGeometryLocal.index!.array as Uint32Array
		const patchUvsLocal = patchGeometryLocal.attributes.uv.array as Float32Array

		const pushedPositionsLocal = GeometryUtils.push(
			patchPositionsLocal,
			patchIndicesLocal,
			RAYCAST_UV_SEARCH_CONSTANTS.NORMAL_MARGIN
		)

		const expanded = GeometryUtils.growBoundaryEdges(
			pushedPositionsLocal,
			patchIndicesLocal,
			patchUvsLocal,
			RAYCAST_UV_SEARCH_CONSTANTS.BOUNDARY_GROWTH
		)

		const expandedPositionsLocal = expanded.positions
		const expandedIndicesLocal = expanded.indices

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
		const validSourceUv = new Map<number, [number, number]>()
		const rays: { origin: Vector3; target: Vector3; hit: boolean }[] = []
		const direction = new Vector3()
		const rayOrigin = new Vector3()
		const patchVertexA = new Vector3()
		const patchVertexB = new Vector3()
		const patchVertexC = new Vector3()
		const bary = new Vector3()

		// Affected triangles: all triangles in the body's editable group
		const [groupStart, groupCount] = body.groupRange
		const affectedVertexIndices = new Set<number>()
		const affectedTriangles: [number, number, number][] = []

		for (let t = groupStart; t < groupStart + groupCount; t += 3) {
			const ia = bodyIndices[t]
			const ib = bodyIndices[t + 1]
			const ic = bodyIndices[t + 2]
			affectedTriangles.push([ia, ib, ic])
			affectedVertexIndices.add(ia)
			affectedVertexIndices.add(ib)
			affectedVertexIndices.add(ic)
		}

		// Raycast each affected body vertex towards the patch
		for (const bodyVertexIndex of affectedVertexIndices) {
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
			const hits = raycaster.intersectObject(patchMesh)
			const hit = hits.length > 0 ? hits[0] : null

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

			validSourceUv.set(bodyVertexIndex, GeometryUtils.interpolateUv(expanded.uvs, ia, ib, ic, bary))
		}

		this.visualDebugger?.showRays('raycastUvSearch.rays', rays)

		// Build output geometry: only vertices with hits, only triangles using those vertices
		const coverage = affectedVertexIndices.size > 0 ? validSourceUv.size / affectedVertexIndices.size : 0

		// Map: old body vertex index → new index in result geometry
		const oldToNewIndex = new Map<number, number>()
		let newIndex = 0

		// Collect all vertices that have hits
		const newPositions: number[] = []
		const newNormals: number[] = []
		const newUVs: number[] = []
		const newUV1s: number[] = []

		for (const vertexIndex of validSourceUv.keys()) {
			oldToNewIndex.set(vertexIndex, newIndex)

			// Position, normal, uv from body
			newPositions.push(
				bodyPositions[vertexIndex * 3],
				bodyPositions[vertexIndex * 3 + 1],
				bodyPositions[vertexIndex * 3 + 2]
			)
			newNormals.push(
				bodyNormals[vertexIndex * 3],
				bodyNormals[vertexIndex * 3 + 1],
				bodyNormals[vertexIndex * 3 + 2]
			)
			newUVs.push(bodyUvs[vertexIndex * 2], bodyUvs[vertexIndex * 2 + 1])

			// uv1: source UV from raycast hit
			const sourceUV = validSourceUv.get(vertexIndex)!
			newUV1s.push(sourceUV[0], sourceUV[1])

			newIndex++
		}

		// Build triangle indices (only triangles where all 3 vertices are in result)
		const newIndices: number[] = []

		for (const [ia, ib, ic] of affectedTriangles) {
			const newIa = oldToNewIndex.get(ia)
			const newIb = oldToNewIndex.get(ib)
			const newIc = oldToNewIndex.get(ic)

			if (newIa !== undefined && newIb !== undefined && newIc !== undefined) {
				newIndices.push(newIa, newIb, newIc)
			}
		}

		// Build result geometry
		const resultGeometry = new BufferGeometry()
		resultGeometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(newPositions), 3))
		resultGeometry.setAttribute('normal', new Float32BufferAttribute(new Float32Array(newNormals), 3))
		resultGeometry.setAttribute('uv', new Float32BufferAttribute(new Float32Array(newUVs), 2))
		resultGeometry.setAttribute('uv1', new Float32BufferAttribute(new Float32Array(newUV1s), 2))
		resultGeometry.setIndex(new Uint32BufferAttribute(new Uint32Array(newIndices), 1))

		return { geometry: resultGeometry, coverage, entryId, jobId }
	}
}
