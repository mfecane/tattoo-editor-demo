import { MESH_WRAP_CONSTANTS } from '@/editor/constants'
import { DijkstraOrderMarcher } from '@/editor/main/DijkstraOrderMarcher'
import { FrameBlender } from '@/editor/main/FrameBlender'
import { LiveFrontierMarcher } from '@/editor/main/LiveFrontierMarcher'
import { MeshTopology } from '@/editor/main/MeshTopology'
import { PatchFrameMarcher } from '@/editor/main/PatchFrameMarcher'
import { SurfaceReprojector } from '@/editor/main/SurfaceReprojector'
import { WrapValidator } from '@/editor/main/WrapValidator'
import { BufferGeometry, Float32BufferAttribute, Mesh, Vector2, Vector3 } from 'three'

export interface WrapResult {
	success: boolean
	/** Present when success is false and a geometry could still be built - lets the caller show a debug wireframe of what the failed attempt looked like before discarding it. */
	invalidGeometry?: BufferGeometry
}

export interface WrapPreview {
	success: boolean
	/** In the source mesh's local space (same transform-preserving conversion wrap() itself uses), so it can be dropped straight onto a ghost mesh positioned like the source. */
	geometry: BufferGeometry
}

interface WrapComputation {
	success: boolean
	reason: string | null
	worldPositions: Float32Array
	index: NonNullable<BufferGeometry['index']>
	uvAttr: BufferGeometry['attributes'][string]
}

/**
 * Wraps a flat regionMesh's geometry onto a target bodyMesh surface via a live,
 * fused plan-and-place front-march - a Fast-Marching-style frontier always
 * advances from the not-yet-placed vertex that's genuinely nearest given what's
 * actually been placed in 3D so far (not a distance precomputed on the flat
 * patch), predicting each vertex by blending its already-placed mesh neighbors'
 * tangent-frame predictions (weighted by inverse local-space distance, not a
 * single shortest-path parent), then snapping the blended prediction onto the
 * real surface with a raycast and re-orthogonalizing the frame (Gram-Schmidt)
 * before relaxing its still-unplaced neighbors' distance estimates.
 *
 * This class is just the orchestrating facade - MeshTopology builds the flat
 * mesh's own edge graph and origin vertex, a PatchFrameMarcher (picked by
 * MESH_WRAP_CONSTANTS.MARCH_ALGORITHM) runs the actual march, and WrapValidator
 * decides whether the marched result is geometrically valid.
 *
 * The march itself (`compute`) never touches the input mesh - `wrap()`
 * mutates it on success, `preview()` never does, so the same computation
 * can drive both the real commit and a live, continuously-updating ghost
 * preview while the user repositions the regionMesh.
 */
export class PlacedMeshWrapper {
	/** Wraps regionMesh geometry onto bodyMesh. Runs the march and applies result if validation passes, leaving regionMesh untouched on failure. */
	public static wrap(mesh: Mesh, bodyMesh: Mesh): WrapResult {
		const computation = PlacedMeshWrapper.compute(mesh, bodyMesh)
		if (!computation) {
			console.error('[PlacedMeshWrapper] wrap failed: mesh is not fully connected to its origin vertex')
			return { success: false }
		}

		if (!computation.success) {
			console.error(`[PlacedMeshWrapper] wrap failed: ${computation.reason}`)
			return {
				success: false,
				invalidGeometry: PlacedMeshWrapper.buildGeometry(mesh, computation.index, computation.uvAttr, computation.worldPositions),
			}
		}

		const newGeometry = PlacedMeshWrapper.buildGeometry(mesh, computation.index, computation.uvAttr, computation.worldPositions)
		mesh.geometry.dispose()
		mesh.geometry = newGeometry

		return { success: true }
	}

	/** Same march as wrap(), but purely read-only - for a live preview ghost while the user is still positioning the flat mesh. No console logging (this can run every debounce tick). */
	public static preview(mesh: Mesh, bodyMesh: Mesh): WrapPreview | null {
		const computation = PlacedMeshWrapper.compute(mesh, bodyMesh)
		if (!computation) {
			return null
		}

		return {
			success: computation.success,
			geometry: PlacedMeshWrapper.buildGeometry(mesh, computation.index, computation.uvAttr, computation.worldPositions),
		}
	}

	private static compute(mesh: Mesh, bodyMesh: Mesh): WrapComputation | null {
		const geometry = mesh.geometry
		const positionAttr = geometry.attributes.position
		const index = geometry.index
		if (!index) {
			return null
		}

		const vertexCount = positionAttr.count
		const local: Vector2[] = []
		for (let i = 0; i < vertexCount; i++) {
			local.push(new Vector2(positionAttr.getX(i), positionAttr.getY(i)))
		}

		const topology = new MeshTopology(local, index)

		// march() always returns a complete set of frames when the mesh is connected - vertices that
		// couldn't be reprojected onto the surface fall back to their unprojected blended prediction, so
		// a coverage stall shows up as visibly wrong (floating/collapsed) geometry rather than silently
		// vanishing, and WrapValidator below is what actually catches it as a failure.
		const marcher: PatchFrameMarcher =
			MESH_WRAP_CONSTANTS.MARCH_ALGORITHM === 'dijkstra-order'
				? new DijkstraOrderMarcher(new FrameBlender(), new SurfaceReprojector())
				: new LiveFrontierMarcher(new FrameBlender(), new SurfaceReprojector())
		const frames = marcher.march(mesh, bodyMesh, local, topology.adjacency, topology.originIndex)
		if (frames === null) {
			return null // mesh isn't fully connected to the origin - nothing meaningful to march or show
		}

		const worldPositions = new Float32Array(vertexCount * 3)
		for (let i = 0; i < vertexCount; i++) {
			const frame = frames[i]
			worldPositions[i * 3] = frame.position.x
			worldPositions[i * 3 + 1] = frame.position.y
			worldPositions[i * 3 + 2] = frame.position.z
		}

		const reason = new WrapValidator().validate(worldPositions, topology.triangles, local, mesh.scale.x * mesh.scale.y)
		return { success: reason === null, reason, worldPositions, index, uvAttr: geometry.attributes.uv }
	}

	/**
	 * Keeps the mesh's own position/quaternion/scale untouched (the select
	 * dot, context menu anchor, etc. all key off mesh.position) - converts
	 * the marched world positions back into that same local frame instead.
	 */
	private static buildGeometry(
		mesh: Mesh,
		index: BufferGeometry['index'],
		uvAttr: BufferGeometry['attributes'][string],
		worldPositions: Float32Array
	): BufferGeometry {
		mesh.updateMatrixWorld(true)
		const inverseMatrix = mesh.matrixWorld.clone().invert()
		const vertexCount = worldPositions.length / 3
		const localPositions = new Float32Array(vertexCount * 3)
		const point = new Vector3()
		for (let i = 0; i < vertexCount; i++) {
			point.set(worldPositions[i * 3], worldPositions[i * 3 + 1], worldPositions[i * 3 + 2]).applyMatrix4(inverseMatrix)
			localPositions[i * 3] = point.x
			localPositions[i * 3 + 1] = point.y
			localPositions[i * 3 + 2] = point.z
		}

		const newGeometry = new BufferGeometry()
		newGeometry.setAttribute('position', new Float32BufferAttribute(localPositions, 3))
		newGeometry.setAttribute('uv', uvAttr.clone())
		newGeometry.setIndex(index ? Array.from(index.array) : null)
		newGeometry.computeVertexNormals()
		return newGeometry
	}
}
