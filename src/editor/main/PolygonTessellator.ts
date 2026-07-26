import { distanceToSegment, isPointInPolygon } from '@/editor/lib/utils/PolygonGeometry'
import { Point, SweepContext, XY } from 'poly2tri'
import { BufferGeometry, Float32BufferAttribute, Vector2 } from 'three'

/**
 * Triangulates a simple 2D polygon boundary (world-space, already centered/scaled by
 * RegionMeshFactory) via poly2tri's constrained Delaunay sweep, seeding a grid of interior
 * Steiner points first for interior density, and subdividing the boundary contour itself at the
 * same spacing (see subdivideBoundary) so the outer edge isn't left as a handful of long,
 * coarse segments - the boundary vertices are otherwise just whatever the user's lasso happened
 * to place, which can be far sparser than the interior grid and would leave a ring of long thin
 * triangles right at the edge, exactly where PlacedMeshWrapper's march is most sensitive to
 * curvature. Replaces the old scheme - three.js ShapeGeometry's ear-clip boundary triangulation,
 * then blind midpoint-subdivision of whatever triangles that produced - with real
 * Delaunay-quality triangles throughout, boundary and interior alike.
 */
export class PolygonTessellator {
	/** spacing: target world-unit edge length - see RegionMeshFactory for how it's derived from scale. */
	public static tessellate(boundary: Vector2[], spacing: number): BufferGeometry {
		const contourPoints = PolygonTessellator.subdivideBoundary(boundary, spacing)
		const contour = contourPoints.map((point) => new Point(point.x, point.y))
		const context = new SweepContext(contour)

		const steinerPoints = PolygonTessellator.seedInteriorPoints(boundary, spacing)
		if (steinerPoints.length > 0) {
			context.addPoints(steinerPoints)
		}
		context.triangulate()

		const indexByPoint = new Map<XY, number>()
		const positions: number[] = []
		const indices: number[] = []

		const indexOf = (point: XY): number => {
			let index = indexByPoint.get(point)
			if (index === undefined) {
				index = positions.length / 3
				positions.push(point.x, point.y, 0)
				indexByPoint.set(point, index)
			}
			return index
		}

		for (const triangle of context.getTriangles()) {
			indices.push(indexOf(triangle.getPoint(0)), indexOf(triangle.getPoint(1)), indexOf(triangle.getPoint(2)))
		}

		const geometry = new BufferGeometry()
		geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
		geometry.setIndex(indices)
		geometry.computeVertexNormals()

		return geometry
	}

	/**
	 * Inserts extra points along each boundary edge so no edge is longer than roughly one grid
	 * spacing - the original polygon vertices are preserved exactly (each edge's subdivision
	 * starts at its own original start vertex), only new points are added between them, so the
	 * outline's actual shape doesn't change, just its resolution as a constrained contour.
	 */
	private static subdivideBoundary(boundary: Vector2[], spacing: number): Vector2[] {
		const subdivided: Vector2[] = []

		for (let i = 0; i < boundary.length; i++) {
			const a = boundary[i]
			const b = boundary[(i + 1) % boundary.length]
			const segments = Math.max(1, Math.round(a.distanceTo(b) / spacing))

			for (let s = 0; s < segments; s++) {
				const t = s / segments
				subdivided.push(new Vector2(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t))
			}
		}

		return subdivided
	}

	/**
	 * A grid of candidate points across the boundary's bounding box, kept only if inside the
	 * polygon and far enough from every edge - too close to the boundary and poly2tri's sweep
	 * tends to produce degenerate sliver triangles right along the edge.
	 */
	private static seedInteriorPoints(boundary: Vector2[], spacing: number): Point[] {
		const margin = spacing * 0.5

		let minX = Infinity
		let minY = Infinity
		let maxX = -Infinity
		let maxY = -Infinity
		for (const point of boundary) {
			minX = Math.min(minX, point.x)
			minY = Math.min(minY, point.y)
			maxX = Math.max(maxX, point.x)
			maxY = Math.max(maxY, point.y)
		}

		const points: Point[] = []
		for (let x = minX + spacing / 2; x < maxX; x += spacing) {
			for (let y = minY + spacing / 2; y < maxY; y += spacing) {
				const candidate = { x, y }
				if (!isPointInPolygon(candidate, boundary)) {
					continue
				}
				if (PolygonTessellator.distanceToBoundary(candidate, boundary) < margin) {
					continue
				}
				points.push(new Point(x, y))
			}
		}

		return points
	}

	private static distanceToBoundary(point: { x: number; y: number }, boundary: Vector2[]): number {
		let minDistance = Infinity
		for (let i = 0; i < boundary.length; i++) {
			const a = boundary[i]
			const b = boundary[(i + 1) % boundary.length]
			minDistance = Math.min(minDistance, distanceToSegment(point, a, b))
		}
		return minDistance
	}
}
