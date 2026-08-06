import { BakeSearchRequest } from '@/editor/services/UVSearchAlgorithm'
import { UvSearchHit } from '@/editor/services/UvSearchHit'
import { interpolateUv } from '@/editor/services/GeometryUtils'
import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute } from 'three'

/** Body triangles/vertices in the editable material group - everything a UVSearchAlgorithm scans for hits. */
export interface AffectedRegion {
	vertexIndices: Set<number>
	triangles: [number, number, number][]
}

/** Scans `body.groupRange` for its triangles and referenced vertex indices - shared setup for every UVSearchAlgorithm. */
export function collectAffectedRegion(body: BakeSearchRequest['body']): AffectedRegion {
	const bodyIndices = body.geometry.index!.array as Uint32Array
	const [groupStart, groupCount] = body.groupRange

	const vertexIndices: Set<number> = new Set()
	const triangles: [number, number, number][] = []

	for (let t = groupStart; t < groupStart + groupCount; t += 3) {
		const ia = bodyIndices[t]
		const ib = bodyIndices[t + 1]
		const ic = bodyIndices[t + 2]
		triangles.push([ia, ib, ic])
		vertexIndices.add(ia)
		vertexIndices.add(ib)
		vertexIndices.add(ic)
	}

	return { vertexIndices, triangles }
}

/**
 * Turns per-vertex UvSearchHits into the shared UVSearchAlgorithm output contract: only hit
 * vertices, only triangles whose 3 vertices all got a hit, body position/normal/uv preserved,
 * uv1 = source UV interpolated from `patchUvs` via each hit's triangle + barycoord.
 */
export function buildUvTransferResult(
	body: BakeSearchRequest['body'],
	region: AffectedRegion,
	hits: Map<number, UvSearchHit>,
	patchUvs: Float32Array
): { geometry: BufferGeometry; coverage: number } {
	const bodyPositions = body.geometry.attributes.position.array as Float32Array
	const bodyNormals = body.geometry.attributes.normal.array as Float32Array
	const bodyUvs = body.geometry.attributes.uv.array as Float32Array

	const coverage = region.vertexIndices.size > 0 ? hits.size / region.vertexIndices.size : 0

	// Map: old body vertex index → new index in result geometry
	const oldToNewIndex: Map<number, number> = new Map()
	let newIndex = 0

	const newPositions: number[] = []
	const newNormals: number[] = []
	const newUVs: number[] = []
	const newUV1s: number[] = []

	for (const [vertexIndex, hit] of hits) {
		oldToNewIndex.set(vertexIndex, newIndex)

		newPositions.push(bodyPositions[vertexIndex * 3], bodyPositions[vertexIndex * 3 + 1], bodyPositions[vertexIndex * 3 + 2])
		newNormals.push(bodyNormals[vertexIndex * 3], bodyNormals[vertexIndex * 3 + 1], bodyNormals[vertexIndex * 3 + 2])
		newUVs.push(bodyUvs[vertexIndex * 2], bodyUvs[vertexIndex * 2 + 1])

		const [ia, ib, ic] = hit.triangle
		const sourceUv = interpolateUv(patchUvs, ia, ib, ic, hit.barycoord)
		newUV1s.push(sourceUv[0], sourceUv[1])

		newIndex++
	}

	// Build triangle indices (only triangles where all 3 vertices are in result)
	const newIndices: number[] = []
	for (const [ia, ib, ic] of region.triangles) {
		const newIa = oldToNewIndex.get(ia)
		const newIb = oldToNewIndex.get(ib)
		const newIc = oldToNewIndex.get(ic)

		if (newIa !== undefined && newIb !== undefined && newIc !== undefined) {
			newIndices.push(newIa, newIb, newIc)
		}
	}

	const resultGeometry = new BufferGeometry()
	resultGeometry.name = 'uvTransferResultBuilder.output'
	resultGeometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(newPositions), 3))
	resultGeometry.setAttribute('normal', new Float32BufferAttribute(new Float32Array(newNormals), 3))
	resultGeometry.setAttribute('uv', new Float32BufferAttribute(new Float32Array(newUVs), 2))
	resultGeometry.setAttribute('uv1', new Float32BufferAttribute(new Float32Array(newUV1s), 2))
	resultGeometry.setIndex(new Uint32BufferAttribute(new Uint32Array(newIndices), 1))

	return { geometry: resultGeometry, coverage }
}
