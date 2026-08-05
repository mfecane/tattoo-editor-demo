import { MESH_WRAP_CONSTANTS } from '@/editor/constants'
import { Triangle } from '@/editor/main/MeshTopology'
import { Vector2, Vector3 } from 'three'

/**
 * Coverage/distortion/self-fold checks on a marched wrap result - decides whether the blended
 * front-march produced a geometrically valid drape. Pure over triangle/position data, no
 * dependency on the mesh or scene the result came from.
 */
export class WrapValidator {
	/** Returns null when valid, otherwise a human-readable reason for the console. */
	public validate(positions: Float32Array, triangles: Triangle[], local: Vector2[], scaleAreaFactor: number): string | null {
		// `local` is raw, unscaled geometry-space; `positions` (worldPositions) already has
		// mesh.scale baked in via FrameBlender's delta.x/y *= scale.x/y. Scale flatArea by the
		// same scale.x * scale.y so the distortion ratio below measures curvature-induced
		// stretch only, not the user's own Resize - otherwise a 2x scaled mesh reports a
		// ~4x "distortion blowup" purely from the scale, even on a geometrically perfect wrap.
		let flatArea = 0
		for (const [a, b, c] of triangles) {
			flatArea += this.triangleArea2D(local[a], local[b], local[c])
		}
		flatArea *= scaleAreaFactor
		if (flatArea < 1e-10) {
			return 'source polygon has ~zero area'
		}

		const pa = new Vector3()
		const pb = new Vector3()
		const pc = new Vector3()
		const ab = new Vector3()
		const ac = new Vector3()
		const normal = new Vector3()

		const triangleNormals: Vector3[] = []
		const triangleAreas: number[] = []
		let wrappedArea = 0

		for (const [a, b, c] of triangles) {
			pa.set(positions[a * 3], positions[a * 3 + 1], positions[a * 3 + 2])
			pb.set(positions[b * 3], positions[b * 3 + 1], positions[b * 3 + 2])
			pc.set(positions[c * 3], positions[c * 3 + 1], positions[c * 3 + 2])
			ab.subVectors(pb, pa)
			ac.subVectors(pc, pa)
			normal.crossVectors(ab, ac)

			const area = normal.length() * 0.5
			triangleAreas.push(area)
			wrappedArea += area

			const unitNormal = area > 1e-12 ? normal.clone().divideScalar(normal.length()) : new Vector3()
			triangleNormals.push(unitNormal)
		}

		const averageArea = wrappedArea / triangles.length
		for (let i = 0; i < triangleAreas.length; i++) {
			if (triangleAreas[i] < averageArea * MESH_WRAP_CONSTANTS.MIN_TRIANGLE_AREA_RATIO) {
				return `degenerate triangle #${i} (area ${triangleAreas[i].toExponential(2)}, average ${averageArea.toExponential(2)})`
			}
		}

		// Self-fold check: compare each triangle only against its edge-adjacent neighbors, not
		// a mesh-wide average. A patch legitimately wrapped around real curvature (most of the
		// way around an arm, say) can have far-apart triangles pointing in very different or even
		// opposite directions without anything being wrong - a genuine fold shows up locally, as
		// two triangles sharing an edge whose normals point sharply away from each other.
		const foldReason = this.findAdjacentNormalFold(triangles, triangleNormals, triangleAreas)
		if (foldReason) {
			return foldReason
		}

		const distortionRatio = wrappedArea / flatArea
		if (distortionRatio > MESH_WRAP_CONSTANTS.MAX_DISTORTION_RATIO) {
			return `distortion blowup (wrapped area is ${distortionRatio.toFixed(2)}x the flat area, max ${MESH_WRAP_CONSTANTS.MAX_DISTORTION_RATIO}x)`
		}
		if (distortionRatio < MESH_WRAP_CONSTANTS.MIN_DISTORTION_RATIO) {
			return `distortion collapse (wrapped area is ${distortionRatio.toFixed(2)}x the flat area, min ${MESH_WRAP_CONSTANTS.MIN_DISTORTION_RATIO}x)`
		}

		return null
	}

	/** Finds two edge-adjacent triangles whose normals point sharply away from each other - a real self-fold, as opposed to gradual curvature. */
	private findAdjacentNormalFold(triangles: Triangle[], triangleNormals: Vector3[], triangleAreas: number[]): string | null {
		const edgeToTriangles = new Map<string, number[]>()
		const edgeKey = (i0: number, i1: number): string => (i0 < i1 ? `${i0}_${i1}` : `${i1}_${i0}`)

		for (let i = 0; i < triangles.length; i++) {
			const [a, b, c] = triangles[i]
			for (const key of [edgeKey(a, b), edgeKey(b, c), edgeKey(c, a)]) {
				const list = edgeToTriangles.get(key)
				if (list) {
					list.push(i)
				} else {
					edgeToTriangles.set(key, [i])
				}
			}
		}

		for (const triangleIndices of edgeToTriangles.values()) {
			if (triangleIndices.length !== 2) {
				continue // boundary edge, only one triangle - nothing to compare
			}
			const [i, j] = triangleIndices
			if (triangleAreas[i] < 1e-12 || triangleAreas[j] < 1e-12) {
				continue // already flagged as degenerate, its normal isn't meaningful
			}
			const dot = triangleNormals[i].dot(triangleNormals[j])
			if (dot < MESH_WRAP_CONSTANTS.MIN_ADJACENT_NORMAL_DOT) {
				return `self-fold between adjacent triangles #${i} and #${j} (normals ${dot.toFixed(2)} aligned, need >= ${MESH_WRAP_CONSTANTS.MIN_ADJACENT_NORMAL_DOT})`
			}
		}

		return null
	}

	private triangleArea2D(a: Vector2, b: Vector2, c: Vector2): number {
		return Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) * 0.5
	}
}
