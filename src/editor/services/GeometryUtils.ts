import { Vector3 } from 'three'

/**
 * Geometry utilities for bake operations: push, expansion, UV extrapolation.
 * `push` and `growBoundaryEdges` are two independent, separately-callable steps (not bundled
 * into one "expand" call) so a caller can inspect/use the intermediate pushed-only result -
 * e.g. RaycastUVSearch visualizes both stages separately during debugging.
 */
export class GeometryUtils {
	/**
	 * Normalize winding order: ensure all triangles face the same direction.
	 * Flips any triangles whose normals point opposite to the majority direction.
	 */
	static normalizeWinding(positions: Float32Array, indices: Uint32Array): Uint32Array {
		// Compute face normals and find average direction
		const faceNormals: Vector3[] = []
		const avgNormal = new Vector3()

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
			faceNormals.push(faceNormal.clone())
			avgNormal.add(faceNormal)
		}

		avgNormal.negate().normalize()

		// Flip triangles that point opposite to (negated) average
		const normalizedIndices = new Uint32Array(indices)
		for (let t = 0; t < faceNormals.length; t++) {
			if (faceNormals[t].dot(avgNormal) < 0) {
				// Flip winding: swap second and third vertices
				const triStart = t * 3
				const temp = normalizedIndices[triStart + 1]
				normalizedIndices[triStart + 1] = normalizedIndices[triStart + 2]
				normalizedIndices[triStart + 2] = temp
			}
		}

		return normalizedIndices
	}

	/**
	 * Push geometry along vertex normals by a given margin.
	 * Computes vertex normals from face normals, then offsets each vertex outward.
	 */
	static push(positions: Float32Array, indices: Uint32Array, margin: number): Float32Array {
		const expanded = new Float32Array(positions.length)
		expanded.set(positions)

		// Compute vertex normals from face normals
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

		const normal = new Vector3()
		let normalCount = 0

		for (let i = 0; i < positions.length / 3; i++) {
			if (vertexNormalCounts[i] > 0) {
				normal.set(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2])
				normal.divideScalar(vertexNormalCounts[i])
				normalCount++
			}
		}

		// Apply expansion along averaged normals, flipping any that point opposite to average
		for (let i = 0; i < positions.length / 3; i++) {
			if (vertexNormalCounts[i] > 0) {
				normal.set(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2])
				normal.divideScalar(vertexNormalCounts[i]).normalize()
				expanded[i * 3] += normal.x * margin
				expanded[i * 3 + 1] += normal.y * margin
				expanded[i * 3 + 2] += normal.z * margin
			}
		}

		return expanded
	}

	/**
	 * Grow boundary edges with UV interpolation: create shared rim vertices around boundary loop.
	 * ONE new vertex per boundary vertex, grown along its normal - maintains topology.
	 */
	static growBoundaryEdges(
		positions: Float32Array,
		indices: Uint32Array,
		uvs: Float32Array,
		growth: number
	): { positions: Float32Array; indices: Uint32Array; uvs: Float32Array } {
		// Find boundary edges
		const edgeMap = new Map<string, number>()
		const boundaryEdges: [number, number][] = []
		const boundaryVertices = new Set<number>()

		for (let t = 0; t < indices.length; t += 3) {
			const ia = indices[t]
			const ib = indices[t + 1]
			const ic = indices[t + 2]

			for (const [i0, i1] of [[ia, ib], [ib, ic], [ic, ia]]) {
				const key = i0 < i1 ? `${i0},${i1}` : `${i1},${i0}`
				edgeMap.set(key, (edgeMap.get(key) ?? 0) + 1)
			}
		}

		for (const [key, count] of edgeMap) {
			if (count === 1) {
				const [i0, i1] = key.split(',').map(Number)
				boundaryEdges.push([i0, i1])
				boundaryVertices.add(i0)
				boundaryVertices.add(i1)
			}
		}

		// Compute vertex normals
		const normals = this.computeVertexNormals(positions, indices)

		// Create ONE rim vertex per boundary vertex
		// Growth direction: perpendicular to face normal, radially outward from center
		const rimPositions: number[] = []
		const rimUVs: number[] = []
		const vertexToRimIndex = new Map<number, number>()
		let newVertexIndex = positions.length / 3

		// Compute mesh center for radial outward direction
		const center = new Vector3()
		for (let i = 0; i < positions.length / 3; i++) {
			center.x += positions[i * 3]
			center.y += positions[i * 3 + 1]
			center.z += positions[i * 3 + 2]
		}
		center.divideScalar(positions.length / 3)

		// Compute UV space center for radial UV extrapolation
		const uvCenter = new Vector3(0, 0, 0)
		for (const vertexIndex of boundaryVertices) {
			uvCenter.x += uvs[vertexIndex * 2]
			uvCenter.y += uvs[vertexIndex * 2 + 1]
		}
		uvCenter.divideScalar(boundaryVertices.size)

		const posVec = new Vector3()
		const normVec = new Vector3()
		const radialDir = new Vector3()
		const uvRadialDir = new Vector3()

		for (const vertexIndex of boundaryVertices) {
			posVec.fromArray(positions, vertexIndex * 3)
			normVec.set(normals[vertexIndex * 3], normals[vertexIndex * 3 + 1], normals[vertexIndex * 3 + 2]).normalize()

			// Growth direction: radial from center, projected onto surface (perpendicular to normal)
			radialDir.subVectors(posVec, center).normalize()

			// Project onto the surface plane: remove component along the normal
			const normalComponent = radialDir.dot(normVec)
			radialDir.addScaledVector(normVec, -normalComponent).normalize()

			// Grow radially outward
			const grownPos = posVec.clone().addScaledVector(radialDir, growth)
			rimPositions.push(grownPos.x, grownPos.y, grownPos.z)

			// Extrapolate UVs radially in UV space
			const boundaryU = uvs[vertexIndex * 2]
			const boundaryV = uvs[vertexIndex * 2 + 1]
			uvRadialDir.set(boundaryU - uvCenter.x, boundaryV - uvCenter.y, 0).normalize()
			const grownU = boundaryU + uvRadialDir.x * growth
			const grownV = boundaryV + uvRadialDir.y * growth
			rimUVs.push(grownU, grownV)

			vertexToRimIndex.set(vertexIndex, newVertexIndex)
			newVertexIndex++
		}

		// Create quads connecting original boundary loop to rim loop
		const rimIndices: number[] = []
		for (const [i0, i1] of boundaryEdges) {
			const ri0 = vertexToRimIndex.get(i0)!
			const ri1 = vertexToRimIndex.get(i1)!

			// Quad: i0-i1-ri1-ri0 (2 triangles)
			rimIndices.push(i0, i1, ri0)
			rimIndices.push(i1, ri1, ri0)
		}

		// Merge original and rim geometry
		const mergedPositions = new Float32Array(positions.length + rimPositions.length)
		mergedPositions.set(positions)
		for (let i = 0; i < rimPositions.length; i++) {
			mergedPositions[positions.length + i] = rimPositions[i]
		}

		const mergedUVs = new Float32Array(uvs.length + rimUVs.length)
		mergedUVs.set(uvs)
		for (let i = 0; i < rimUVs.length; i++) {
			mergedUVs[uvs.length + i] = rimUVs[i]
		}

		const mergedIndices = new Uint32Array(indices.length + rimIndices.length)
		mergedIndices.set(indices)
		for (let i = 0; i < rimIndices.length; i++) {
			mergedIndices[indices.length + i] = rimIndices[i]
		}

		// Normalize winding order: ensure all triangles face the same direction
		const normalizedIndices = this.normalizeWinding(mergedPositions, mergedIndices)

		return { positions: mergedPositions, indices: normalizedIndices, uvs: mergedUVs }
	}

	private static computeVertexNormals(positions: Float32Array, indices: Uint32Array): Float32Array {
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
	static interpolateUv(uvs: Float32Array, ia: number, ib: number, ic: number, bary: Vector3): [number, number] {
		const uvAx = uvs[ia * 2]
		const uvAy = uvs[ia * 2 + 1]
		const uvBx = uvs[ib * 2]
		const uvBy = uvs[ib * 2 + 1]
		const uvCx = uvs[ic * 2]
		const uvCy = uvs[ic * 2 + 1]

		return [bary.x * uvAx + bary.y * uvBx + bary.z * uvCx, bary.x * uvAy + bary.y * uvBy + bary.z * uvCy]
	}
}
