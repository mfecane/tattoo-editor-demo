import { Vector3 } from 'three'

/** Shared pure geometry math used by GeometryModifier implementations and UV search. */

interface EdgeOwner {
	triangle: number
	i0: number
	i1: number
}

/**
 * Makes triangle winding consistent across the whole mesh by propagating orientation across
 * shared edges from one seed triangle per connected component (flood-fill), instead of comparing
 * each triangle against a single global reference direction. A draped/wrapped mesh's face normals
 * can legitimately span far more than 90° of directions (e.g. wrapped around a cylindrical body),
 * so no single reference vector can classify winding correctness - only comparing a triangle
 * against its direct edge-neighbors can, since two consistently-wound triangles always share an
 * edge in opposite directions.
 */
export function normalizeWinding(indices: Uint32Array): Uint32Array {
	const triangleCount = indices.length / 3
	const normalizedIndices = new Uint32Array(indices)

	const edgeKey = (i0: number, i1: number): string => (i0 < i1 ? `${i0},${i1}` : `${i1},${i0}`)

	// Undirected edge -> triangles that own it, each with the edge's direction as originally wound.
	const edgeOwners: Map<string, EdgeOwner[]> = new Map()
	for (let t = 0; t < triangleCount; t++) {
		const i0 = normalizedIndices[t * 3]
		const i1 = normalizedIndices[t * 3 + 1]
		const i2 = normalizedIndices[t * 3 + 2]
		for (const [a, b] of [[i0, i1], [i1, i2], [i2, i0]] as [number, number][]) {
			const key = edgeKey(a, b)
			const owners = edgeOwners.get(key) ?? []
			owners.push({ triangle: t, i0: a, i1: b })
			edgeOwners.set(key, owners)
		}
	}

	const flipTriangle = (t: number): void => {
		const triStart = t * 3
		const temp = normalizedIndices[triStart + 1]
		normalizedIndices[triStart + 1] = normalizedIndices[triStart + 2]
		normalizedIndices[triStart + 2] = temp
	}

	const visited = new Uint8Array(triangleCount)

	for (let seed = 0; seed < triangleCount; seed++) {
		if (visited[seed]) {
			continue
		}
		visited[seed] = 1
		const queue: number[] = [seed]

		while (queue.length > 0) {
			const t = queue.shift()!
			const i0 = normalizedIndices[t * 3]
			const i1 = normalizedIndices[t * 3 + 1]
			const i2 = normalizedIndices[t * 3 + 2]

			for (const [a, b] of [[i0, i1], [i1, i2], [i2, i0]] as [number, number][]) {
				const owners = edgeOwners.get(edgeKey(a, b))!
				for (const owner of owners) {
					if (owner.triangle === t || visited[owner.triangle]) {
						continue
					}
					// Consistent winding: the neighbor should own this shared edge in the opposite
					// direction (b, a). If it owns the same direction (a, b), it disagrees - flip it.
					if (owner.i0 === a && owner.i1 === b) {
						flipTriangle(owner.triangle)
					}
					visited[owner.triangle] = 1
					queue.push(owner.triangle)
				}
			}
		}
	}

	return normalizedIndices
}

/** Computes one averaged, normalized normal per vertex from its adjacent face normals; zero vector for unreferenced vertices. */
export function computeVertexNormals(positions: Float32Array, indices: Uint32Array): Float32Array {
	const normals = new Float32Array(positions.length)
	const vertexNormalCounts = new Float32Array(positions.length / 3)

	const a = new Vector3()
	const b = new Vector3()
	const c = new Vector3()
	const faceNormal = new Vector3()

	for (let t = 0; t < indices.length; t += 3) {
		const ia = indices[t]
		const ib = indices[t + 1]
		const ic = indices[t + 2]

		a.fromArray(positions, ia * 3)
		b.fromArray(positions, ib * 3)
		c.fromArray(positions, ic * 3)

		b.sub(a)
		c.sub(a)
		faceNormal.crossVectors(b, c).normalize()

		for (const i of [ia, ib, ic]) {
			normals[i * 3] += faceNormal.x
			normals[i * 3 + 1] += faceNormal.y
			normals[i * 3 + 2] += faceNormal.z
			vertexNormalCounts[i]++
		}
	}

	// Normalize
	const normal = new Vector3()
	for (let i = 0; i < positions.length / 3; i++) {
		if (vertexNormalCounts[i] > 0) {
			normal.set(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2])
			normal.divideScalar(vertexNormalCounts[i]).normalize()
			normals[i * 3] = normal.x
			normals[i * 3 + 1] = normal.y
			normals[i * 3 + 2] = normal.z
		}
	}

	return normals
}

/** Barycentric-interpolates a 2-component UV attribute at triangle (ia, ib, ic) using barycentric coords `bary`. */
export function interpolateUv(uvs: Float32Array, ia: number, ib: number, ic: number, bary: Vector3): [number, number] {
	const uvAx = uvs[ia * 2]
	const uvAy = uvs[ia * 2 + 1]
	const uvBx = uvs[ib * 2]
	const uvBy = uvs[ib * 2 + 1]
	const uvCx = uvs[ic * 2]
	const uvCy = uvs[ic * 2 + 1]

	return [bary.x * uvAx + bary.y * uvBx + bary.z * uvCx, bary.x * uvAy + bary.y * uvBy + bary.z * uvCy]
}
