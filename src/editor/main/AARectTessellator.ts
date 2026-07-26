import { BufferGeometry, Float32BufferAttribute } from 'three'

/**
 * Slices an axis-aligned rect into a uniform grid, independently along x and
 * y (fully anisotropic - unlike PolygonTessellator's Delaunay pass, an
 * axis-aligned grid has no diagonal-edge ambiguity, so spacingX/spacingY
 * don't need to be reconciled into one scalar). Cheap (O(cols*rows)), no
 * poly2tri involved.
 */
export class AARectTessellator {
	/** spacingX/spacingY: target world-unit cell size along each axis - see RegionMeshFactory. */
	public static tessellate(minX: number, minY: number, maxX: number, maxY: number, spacingX: number, spacingY: number): BufferGeometry {
		const width = maxX - minX
		const height = maxY - minY
		const cols = Math.max(1, Math.round(width / spacingX))
		const rows = Math.max(1, Math.round(height / spacingY))

		const positions: number[] = []
		for (let row = 0; row <= rows; row++) {
			const y = minY + (height * row) / rows
			for (let col = 0; col <= cols; col++) {
				const x = minX + (width * col) / cols
				positions.push(x, y, 0)
			}
		}

		// row increases with +y, col increases with +x - wound CCW as seen from +z (front-facing,
		// matching PolygonTessellator's convention) so the material's FrontSide actually renders it.
		const indices: number[] = []
		const verticesPerRow = cols + 1
		for (let row = 0; row < rows; row++) {
			for (let col = 0; col < cols; col++) {
				const bottomLeft = row * verticesPerRow + col
				const bottomRight = bottomLeft + 1
				const topLeft = bottomLeft + verticesPerRow
				const topRight = topLeft + 1
				indices.push(bottomLeft, bottomRight, topLeft, bottomRight, topRight, topLeft)
			}
		}

		const geometry = new BufferGeometry()
		geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
		geometry.setIndex(indices)
		geometry.computeVertexNormals()

		return geometry
	}
}
