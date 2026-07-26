import { Intersection, Matrix4, Mesh, Object3D, Quaternion, Raycaster, Vector2, Vector3 } from 'three'

export interface SurfaceBasis {
	normal: Vector3
	uAxis: Vector3
	vAxis: Vector3
}

/**
 * Derives a smooth, continuous tangent-space basis (normal + U/V axes) from
 * a raycast hit on a mesh, using the hit triangle's UV derivatives - the
 * same math used for normal-mapping tangent space - rather than an
 * arbitrary "shortest rotation from local +Z to the normal"
 * (Quaternion.setFromUnitVectors). The latter has no continuity guarantee:
 * as the normal direction changes while dragging across curved geometry,
 * the chosen rotation can visibly jerk/roll. UV-derived tangents instead
 * vary smoothly with the surface's own parameterization, matching how the
 * pre-mesh stamp system (see master branch's GeometryProjectionService/
 * SurfaceDataCalculator) placed and moved stamps.
 */
export class SurfaceTangentBasis {
	private static readonly EPSILON = 1e-6

	/** Basis at an existing raycast hit - the common case, from a Move/Placement drag's own intersection. */
	public static fromIntersection(intersection: Intersection, mesh: Mesh): SurfaceBasis | null {
		if (!intersection.face) {
			return null
		}
		const normal = intersection.face.normal.clone().transformDirection(mesh.matrixWorld).normalize()
		const tangents = SurfaceTangentBasis.calculateTangentVectors(mesh, intersection.face.a, intersection.face.b, intersection.face.c, normal)
		return { normal, ...tangents }
	}

	/**
	 * Basis at a source object's current position, found by raycasting it onto the target
	 * surface along the source's own normal (its local +Z in world space). Used to capture
	 * "what does the surface look like right where this mesh already sits" - e.g. at the start
	 * of a drag, before there's a fresh intersection to read a basis from.
	 */
	public static sampleAt(sourceObject: Object3D, bodyMesh: Mesh): SurfaceBasis | null {
		const sourceNormal = new Vector3(0, 0, 1).applyQuaternion(sourceObject.quaternion)
		const raycaster = new Raycaster()
		const searchOffset = 0.5
		raycaster.set(sourceObject.position.clone().addScaledVector(sourceNormal, searchOffset), sourceNormal.clone().negate())
		raycaster.near = 0
		raycaster.far = searchOffset * 2

		const hits = raycaster.intersectObject(bodyMesh, false)
		if (hits.length === 0) {
			return null
		}
		return SurfaceTangentBasis.fromIntersection(hits[0], bodyMesh)
	}

	/** Builds an orthonormal rotation from a basis - column order (uAxis, vAxis, normal) matches how placed-mesh geometry treats local +X/+Y/+Z. */
	public static quaternionFromBasis(basis: SurfaceBasis): Quaternion {
		const matrix = new Matrix4().makeBasis(basis.uAxis, basis.vAxis, basis.normal)
		return new Quaternion().setFromRotationMatrix(matrix)
	}

	private static calculateTangentVectors(
		mesh: Mesh,
		a: number,
		b: number,
		c: number,
		normal: Vector3
	): { uAxis: Vector3; vAxis: Vector3 } {
		const uvAttr = mesh.geometry.attributes.uv
		if (!uvAttr) {
			return SurfaceTangentBasis.fallbackTangents(normal)
		}

		const positionAttr = mesh.geometry.attributes.position
		const v0 = new Vector3().fromBufferAttribute(positionAttr, a)
		const v1 = new Vector3().fromBufferAttribute(positionAttr, b)
		const v2 = new Vector3().fromBufferAttribute(positionAttr, c)

		const uv0 = new Vector2(uvAttr.getX(a), uvAttr.getY(a))
		const uv1 = new Vector2(uvAttr.getX(b), uvAttr.getY(b))
		const uv2 = new Vector2(uvAttr.getX(c), uvAttr.getY(c))

		const edge1 = v1.clone().sub(v0)
		const edge2 = v2.clone().sub(v0)
		const deltaUV1 = uv1.clone().sub(uv0)
		const deltaUV2 = uv2.clone().sub(uv0)

		const denom = deltaUV1.x * deltaUV2.y - deltaUV2.x * deltaUV1.y
		if (Math.abs(denom) < SurfaceTangentBasis.EPSILON) {
			return SurfaceTangentBasis.fallbackTangents(normal)
		}
		const f = 1 / denom

		const tangent = new Vector3(
			f * (deltaUV2.y * edge1.x - deltaUV1.y * edge2.x),
			f * (deltaUV2.y * edge1.y - deltaUV1.y * edge2.y),
			f * (deltaUV2.y * edge1.z - deltaUV1.y * edge2.z)
		)
			.transformDirection(mesh.matrixWorld)
			.normalize()

		// Gram-Schmidt the UV tangent against the normal for uAxis, then derive vAxis as a pure
		// cross product instead of trusting the independently-computed UV bitangent's handedness.
		// Real meshes commonly mirror UV islands (symmetric body parts reusing texture space),
		// which flips that bitangent's handedness on half the surface - feeding a reflection
		// (determinant -1) into Matrix4.makeBasis + Quaternion.setFromRotationMatrix produces
		// garbage rotations (e.g. the mesh ending up perpendicular to the surface instead of flush
		// against it). cross(normal, uAxis) is always right-handed and orthonormal by construction.
		const uAxis = tangent.sub(normal.clone().multiplyScalar(normal.dot(tangent))).normalize()

		if (uAxis.lengthSq() < SurfaceTangentBasis.EPSILON) {
			return SurfaceTangentBasis.fallbackTangents(normal)
		}

		const vAxis = new Vector3().crossVectors(normal, uAxis).normalize()

		return { uAxis, vAxis }
	}

	/** Used when a triangle has no/degenerate UVs - still consistent (no discontinuity within a single triangle), just not tied to the surface's own parameterization. */
	private static fallbackTangents(normal: Vector3): { uAxis: Vector3; vAxis: Vector3 } {
		const seed = Math.abs(normal.x) > 0.99 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0)
		const uAxis = seed.clone().sub(normal.clone().multiplyScalar(normal.dot(seed))).normalize()
		const vAxis = new Vector3().crossVectors(normal, uAxis).normalize()
		return { uAxis, vAxis }
	}
}
