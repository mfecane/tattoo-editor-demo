import { MESH_WRAP_CONSTANTS } from '@/editor/constants'
import { MeshBVH } from 'three-mesh-bvh'
import { BufferGeometry, Mesh, Raycaster, Vector3 } from 'three'

export interface SurfaceHit {
	point: Vector3
	normal: Vector3
}

/**
 * Casts a ray at a surface from an offset along a given normal, long enough to cross the surface
 * from either side of the offset point - the shared "predict a position, then snap it onto the
 * real surface" primitive behind PlacedMeshWrapper's march, PlacedMeshRelaxer's relax passes, and
 * SlideVertexInteractionHandler's per-vertex drag reprojection. Stateless aside from reusing its
 * own Raycaster instance and a lazily-built MeshBVH cache (keyed per surface geometry, for the
 * closest-point fallback below) - the surface is passed in per call rather than bound at
 * construction, so one reprojector can serve reprojections against different (or since-replaced)
 * meshes.
 *
 * A miss on the primary ray doesn't fail immediately: it widens into a cone around the primary
 * direction (RAYCAST_CONE_RING_ANGLES_DEG), and if that still finds nothing, falls back to the
 * closest point on the surface within RAYCAST_CLOSEST_POINT_MAX_DISTANCE. Only once all three miss
 * is it a genuine miss (null) - callers (the march algorithms) still treat that as a hard miss,
 * this only narrows the set of cases that reach that point.
 */
export class SurfaceReprojector {
	private readonly raycaster: Raycaster = new Raycaster()
	private readonly boundsTreeCache: Map<BufferGeometry, MeshBVH> = new Map()

	public reproject(surface: Mesh, predicted: Vector3, normal: Vector3): SurfaceHit | null {
		const origin = predicted.clone().addScaledVector(normal, MESH_WRAP_CONSTANTS.SEARCH_OFFSET)
		const axis = normal.clone().negate()

		return this.castRay(surface, origin, axis) ?? this.castCone(surface, origin, axis) ?? this.closestPoint(surface, predicted)
	}

	private castRay(surface: Mesh, origin: Vector3, direction: Vector3): SurfaceHit | null {
		this.raycaster.set(origin, direction)
		this.raycaster.near = 0
		this.raycaster.far = MESH_WRAP_CONSTANTS.SEARCH_DISTANCE

		const hits = this.raycaster.intersectObject(surface, false)
		if (hits.length === 0 || !hits[0].face) {
			return null
		}

		const hit = hits[0]
		const worldNormal = hit.face!.normal.clone().transformDirection(hit.object.matrixWorld).normalize()
		return { point: hit.point.clone(), normal: worldNormal }
	}

	/** Sweeps `direction` into a widening cone around `axis`, ring by ring, returning the first hit found. */
	private castCone(surface: Mesh, origin: Vector3, axis: Vector3): SurfaceHit | null {
		const up = Math.abs(axis.y) < 0.99 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0)
		const u = new Vector3().crossVectors(up, axis).normalize()
		const v = new Vector3().crossVectors(axis, u)

		for (const angleDeg of MESH_WRAP_CONSTANTS.RAYCAST_CONE_RING_ANGLES_DEG) {
			const theta = (angleDeg * Math.PI) / 180
			for (let k = 0; k < MESH_WRAP_CONSTANTS.RAYCAST_CONE_RAYS_PER_RING; k++) {
				const phi = (k / MESH_WRAP_CONSTANTS.RAYCAST_CONE_RAYS_PER_RING) * Math.PI * 2
				const direction = axis
					.clone()
					.multiplyScalar(Math.cos(theta))
					.addScaledVector(u, Math.cos(phi) * Math.sin(theta))
					.addScaledVector(v, Math.sin(phi) * Math.sin(theta))
					.normalize()

				const hit = this.castRay(surface, origin, direction)
				if (hit) {
					return hit
				}
			}
		}

		return null
	}

	/** Snaps to the closest point on the surface to `predicted`, within RAYCAST_CLOSEST_POINT_MAX_DISTANCE - the last-resort fallback once no ray in the cone found anything. */
	private closestPoint(surface: Mesh, predicted: Vector3): SurfaceHit | null {
		const bvh = this.getBoundsTree(surface.geometry)
		const localPoint = predicted.clone().applyMatrix4(surface.matrixWorld.clone().invert())

		const result = bvh.closestPointToPoint(localPoint, undefined, 0, MESH_WRAP_CONSTANTS.RAYCAST_CLOSEST_POINT_MAX_DISTANCE)
		if (!result) {
			return null
		}

		const worldPoint = result.point.clone().applyMatrix4(surface.matrixWorld)
		const worldNormal = this.faceNormal(surface.geometry, result.faceIndex).transformDirection(surface.matrixWorld).normalize()
		return { point: worldPoint, normal: worldNormal }
	}

	private getBoundsTree(geometry: BufferGeometry): MeshBVH {
		const cached = this.boundsTreeCache.get(geometry)
		if (cached) {
			return cached
		}
		const bvh = new MeshBVH(geometry)
		this.boundsTreeCache.set(geometry, bvh)
		return bvh
	}

	private faceNormal(geometry: BufferGeometry, faceIndex: number): Vector3 {
		const index = geometry.index
		const position = geometry.attributes.position
		const i0 = index ? index.getX(faceIndex * 3) : faceIndex * 3
		const i1 = index ? index.getX(faceIndex * 3 + 1) : faceIndex * 3 + 1
		const i2 = index ? index.getX(faceIndex * 3 + 2) : faceIndex * 3 + 2

		const a = new Vector3().fromBufferAttribute(position, i0)
		const b = new Vector3().fromBufferAttribute(position, i1)
		const c = new Vector3().fromBufferAttribute(position, i2)

		return new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).normalize()
	}
}
