import { GeometryModifier } from '@/editor/services/GeometryModifier'
import { computeVertexNormals, normalizeWinding } from '@/editor/services/GeometryUtils'
import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute, Vector3 } from 'three'

/**
 * Grows one new rim vertex per boundary vertex, radially outward in both position and UV space,
 * and stitches it to the boundary loop with new triangles - maintains topology, interior vertices
 * untouched.
 */
export class GrowBoundaryEdgesModifier implements GeometryModifier {
	public constructor(private readonly growth: number) {}

	public apply(geometry: BufferGeometry): BufferGeometry {
		const positions = geometry.attributes.position.array as Float32Array
		const indices = geometry.index!.array as Uint32Array
		const uvs = geometry.attributes.uv.array as Float32Array

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

		const normals = computeVertexNormals(positions, indices)

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
			const grownPos = posVec.clone().addScaledVector(radialDir, this.growth)
			rimPositions.push(grownPos.x, grownPos.y, grownPos.z)

			// Extrapolate UVs radially in UV space
			const boundaryU = uvs[vertexIndex * 2]
			const boundaryV = uvs[vertexIndex * 2 + 1]
			uvRadialDir.set(boundaryU - uvCenter.x, boundaryV - uvCenter.y, 0).normalize()
			const grownU = boundaryU + uvRadialDir.x * this.growth
			const grownV = boundaryV + uvRadialDir.y * this.growth
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
		mergedPositions.set(rimPositions, positions.length)

		const mergedUVs = new Float32Array(uvs.length + rimUVs.length)
		mergedUVs.set(uvs)
		mergedUVs.set(rimUVs, uvs.length)

		const mergedIndices = new Uint32Array(indices.length + rimIndices.length)
		mergedIndices.set(indices)
		mergedIndices.set(rimIndices, indices.length)

		// Normalize winding order: ensure all triangles face the same direction
		const normalizedIndices = normalizeWinding(mergedIndices)

		const grown = new BufferGeometry()
		grown.name = 'growBoundaryEdgesModifier.output'
		grown.setAttribute('position', new Float32BufferAttribute(mergedPositions, 3))
		grown.setAttribute('uv', new Float32BufferAttribute(mergedUVs, 2))
		grown.setIndex(new Uint32BufferAttribute(normalizedIndices, 1))
		return grown
	}
}
