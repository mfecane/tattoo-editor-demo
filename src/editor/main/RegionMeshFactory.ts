import { POLYGON_MESH_CONSTANTS } from '@/editor/constants'
import { getAARectBounds } from '@/editor/lib/utils/AARectGeometry'
import { computeAreaWeightedCentroid } from '@/editor/lib/utils/PolygonGeometry'
import { AARectTessellator } from '@/editor/main/AARectTessellator'
import { PolygonTessellator } from '@/editor/main/PolygonTessellator'
import { PreviewSceneRenderOrder } from '@/editor/main/PreviewSceneRenderOrder'
import { PolygonPoint } from '@/editor/polygon/PolygonPoint'
import { RegionShape } from '@/editor/polygon/RegionShape'
import { BufferGeometry, Float32BufferAttribute, FrontSide, Mesh, MeshBasicMaterial, MultiplyBlending, Texture, Vector2 } from 'three'

/**
 * Builds a flat regionMesh cropped from a source sketch, either a freeform lasso
 * polygon (poly2tri constrained Delaunay, via PolygonTessellator) or an
 * axis-aligned rect (uniform grid, via AARectTessellator) - see
 * createGeometry. UVs are recovered per-vertex from the region's own
 * normalized sketch-space coordinates (not a bounding-box UV) so the texture
 * samples the correct region. Local origin is the area-weighted centroid,
 * so positioning the mesh places its visual center, not a corner.
 */
export class RegionMeshFactory {
	public static createMesh(shape: RegionShape, texture: Texture, sketchAspect: number): Mesh {
		const geometry = RegionMeshFactory.createGeometry(shape, sketchAspect, 1, 1)

		const material = new MeshBasicMaterial({
			map: texture,
			transparent: true,
			depthTest: false,
			side: FrontSide,
			blending: MultiplyBlending,
			polygonOffset: true,
			polygonOffsetFactor: -32.0,
			polygonOffsetUnits: -32.0,
		})

		const regionMesh = new Mesh(geometry, material)
		// Draw after the body regardless of depth-buffer edge cases - works
		// together with the polygonOffset above, doesn't replace it.
		regionMesh.renderOrder = PreviewSceneRenderOrder.PlacedMesh

		return regionMesh
	}

	/**
	 * Pure geometry (no material/Mesh) - reused both at initial placement
	 * (scaleX = scaleY = 1) and at retessellation time when a placed mesh is
	 * resized (see UpdatePlacedMeshCommand), so triangle density adapts to
	 * keep world-space triangle size roughly constant regardless of scale.
	 */
	public static createGeometry(shape: RegionShape, sketchAspect: number, scaleX: number, scaleY: number): BufferGeometry {
		const centroid = computeAreaWeightedCentroid(shape.points)
		const { worldWidth, worldHeight } = RegionMeshFactory.computeWorldSize(sketchAspect)

		const toWorld = (point: PolygonPoint): Vector2 =>
			new Vector2((point.x - centroid.x) * worldWidth, (centroid.y - point.y) * worldHeight)

		const baseSpacing = POLYGON_MESH_CONSTANTS.STEINER_GRID_SPACING
		let geometry: BufferGeometry

		if (shape.kind === 'aarect') {
			const worldCorners = shape.points.map(toWorld) as [Vector2, Vector2]
			const { minX, minY, maxX, maxY } = getAARectBounds([
				{ x: worldCorners[0].x, y: worldCorners[0].y },
				{ x: worldCorners[1].x, y: worldCorners[1].y },
			])
			// Fully anisotropic: an axis-aligned grid has no diagonal-edge ambiguity, so x/y
			// spacing don't need to be reconciled into one scalar the way the Delaunay path does.
			const spacingX = baseSpacing / scaleX
			const spacingY = baseSpacing / scaleY
			geometry = AARectTessellator.tessellate(minX, minY, maxX, maxY, spacingX, spacingY)
		} else {
			const boundary = shape.points.map(toWorld)
			// True per-axis-anisotropic Delaunay density for arbitrary diagonal edges isn't
			// well-defined, so the polygon path uses one isotropic effective spacing (geometric
			// mean of the two axis scales) instead.
			const effectiveScale = Math.sqrt(scaleX * scaleY)
			geometry = PolygonTessellator.tessellate(boundary, baseSpacing / effectiveScale)
		}

		RegionMeshFactory.applySketchSpaceUVs(geometry, centroid, worldWidth, worldHeight)
		return geometry
	}

	private static computeWorldSize(sketchAspect: number): { worldWidth: number; worldHeight: number } {
		const worldSize = POLYGON_MESH_CONSTANTS.WORLD_SIZE
		return {
			worldWidth: sketchAspect >= 1 ? worldSize : worldSize * sketchAspect,
			worldHeight: sketchAspect >= 1 ? worldSize / sketchAspect : worldSize,
		}
	}

	/**
	 * Every vertex's sketch-space UV is recovered from its world-space position via the inverse
	 * of the same affine map used to build the boundary above (pure scale + offset around the
	 * centroid) - that works for ANY vertex, not just the original region points, so both
	 * PolygonTessellator's seeded interior Steiner points and AARectTessellator's grid vertices
	 * get correct UVs too without needing barycentric interpolation against a source triangle.
	 */
	private static applySketchSpaceUVs(geometry: BufferGeometry, centroid: PolygonPoint, worldWidth: number, worldHeight: number): void {
		const position = geometry.attributes.position
		const uv = new Float32Array(position.count * 2)

		for (let i = 0; i < position.count; i++) {
			const sketchX = centroid.x + position.getX(i) / worldWidth
			const sketchY = centroid.y - position.getY(i) / worldHeight
			uv[i * 2] = sketchX
			uv[i * 2 + 1] = 1 - sketchY
		}

		geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
	}
}
