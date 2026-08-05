import { MESH_WRAP_CONSTANTS } from '@/editor/constants'
import { SurfaceHit } from '@/editor/main/SurfaceReprojector'
import { VertexFrame } from '@/editor/main/VertexFrame'
import { Mesh, Vector2, Vector3 } from 'three'

export interface Blend {
	position: Vector3
	normal: Vector3
	uAxis: Vector3
}

interface BlendCandidate {
	index: number
	frame: VertexFrame
	weight: number
}

/**
 * Frame-construction primitives shared by both PatchFrameMarcher implementations: seeding the
 * origin frame, predicting a neighbor's 3D position via tangent-offset transport, blending
 * multiple already-placed neighbors' predictions (weighted by inverse local-space distance, not a
 * single parent), and finalizing a blended prediction into an orthonormal frame - Gram-Schmidt
 * once, against the raycast-hit normal (or the blended normal on a miss), never per-candidate.
 */
export class FrameBlender {
	/** The mesh's placement frame - true local (0,0), the point the user actually clicked to place the mesh (mesh.position), already on the body surface. Distinct from MeshTopology.originIndex, which is only the nearest *tessellated* vertex to (0,0) and is rarely exactly there. */
	public seedPlacementFrame(mesh: Mesh): VertexFrame {
		return {
			position: mesh.position.clone(),
			normal: new Vector3(0, 0, 1).applyQuaternion(mesh.quaternion),
			uAxis: new Vector3(1, 0, 0).applyQuaternion(mesh.quaternion),
			vAxis: new Vector3(0, 1, 0).applyQuaternion(mesh.quaternion),
		}
	}

	/** The march's actual first step: transports the placement frame (true (0,0)) out to originIndex's real local position, so originIndex gets reprojected onto the surface like every other vertex instead of being pinned to the placement point itself. */
	public seedOriginVertex(mesh: Mesh, local: Vector2[], originIndex: number): Blend {
		const placementFrame = this.seedPlacementFrame(mesh)
		const delta = local[originIndex].clone()
		delta.x *= mesh.scale.x
		delta.y *= mesh.scale.y
		return {
			position: this.transport(placementFrame, delta),
			normal: placementFrame.normal,
			uAxis: placementFrame.uAxis,
		}
	}

	/** Transports `from`'s tangent frame to predict `to`'s 3D position, via the flat local-space offset between them. */
	public predictPosition(frame: VertexFrame, mesh: Mesh, local: Vector2[], from: number, to: number): Vector3 {
		// Local deltas are raw (unscaled) geometry-space distances; scale them by the mesh's own
		// scale.x/y so a scaled placed mesh marches at its actual on-surface size, matching how
		// Three.js would render the same delta when flat (worldPos = position + quat.rotate(scale ⊙ local)).
		const delta = new Vector2().subVectors(local[to], local[from])
		delta.x *= mesh.scale.x
		delta.y *= mesh.scale.y
		return this.transport(frame, delta)
	}

	/** Moves `frame`'s position along its own tangent plane by a scaled local-space delta. */
	private transport(frame: VertexFrame, delta: Vector2): Vector3 {
		return frame.position.clone().addScaledVector(frame.uAxis, delta.x).addScaledVector(frame.vAxis, delta.y)
	}

	/**
	 * Blends vi's nearest already-placed mesh neighbors - up to NEIGHBOR_BLEND_COUNT, weighted by
	 * inverse local-space distance and normalized to sum to 1 - into a single predicted
	 * position/normal/u-axis. No single neighbor fully determines vi's fate, it's outvoted by the
	 * others.
	 */
	public predictBlend(vi: number, mesh: Mesh, local: Vector2[], adjacency: number[][], frames: VertexFrame[]): Blend {
		const candidates = this.gatherCandidates(vi, local, adjacency, frames)

		const position = new Vector3()
		const normal = new Vector3()
		const uAxis = new Vector3()
		for (const candidate of candidates) {
			const predicted = this.predictPosition(candidate.frame, mesh, local, candidate.index, vi)
			position.addScaledVector(predicted, candidate.weight)
			normal.addScaledVector(candidate.frame.normal, candidate.weight)
			uAxis.addScaledVector(candidate.frame.uAxis, candidate.weight)
		}
		normal.normalize()
		return { position, normal, uAxis }
	}

	/** Snaps a blended prediction onto the raycast hit (or keeps it unprojected on a miss) and re-orthogonalizes the frame. */
	public finalize(hit: SurfaceHit | null, blend: Blend): VertexFrame {
		const position = hit ? hit.point : blend.position
		const normal = hit ? hit.normal : blend.normal
		const { uAxis, vAxis } = this.orthonormalize(normal, blend.uAxis)
		return { position, normal, uAxis, vAxis }
	}

	/** The nearest already-placed (frame-computed) mesh neighbors of vi, by local-space edge distance. */
	private gatherCandidates(vi: number, local: Vector2[], adjacency: number[][], frames: VertexFrame[]): BlendCandidate[] {
		const distanceByNeighbor = new Map<number, number>()
		for (const n of adjacency[vi]) {
			if (frames[n] && !distanceByNeighbor.has(n)) {
				distanceByNeighbor.set(n, local[vi].distanceTo(local[n]))
			}
		}
		if (distanceByNeighbor.size === 0) {
			throw new Error(`[FrameBlender] vertex ${vi} has no already-placed neighbor - march invariant is broken`)
		}

		const nearest = Array.from(distanceByNeighbor.entries())
			.sort(([, a], [, b]) => a - b)
			.slice(0, MESH_WRAP_CONSTANTS.NEIGHBOR_BLEND_COUNT)

		const weights = nearest.map(([, distance]) => 1 / Math.max(distance, MESH_WRAP_CONSTANTS.MIN_BLEND_DISTANCE))
		const weightSum = weights.reduce((sum, weight) => sum + weight, 0)

		return nearest.map(([index], i) => ({ index, frame: frames[index], weight: weights[i] / weightSum }))
	}

	/** Gram-Schmidt re-orthogonalization: project uHint's normal component out, rebuild vAxis from the result. */
	private orthonormalize(normal: Vector3, uHint: Vector3): { uAxis: Vector3; vAxis: Vector3 } {
		let uAxis = uHint.clone().addScaledVector(normal, -uHint.dot(normal))
		if (uAxis.lengthSq() < 1e-8) {
			const fallback = Math.abs(normal.dot(new Vector3(1, 0, 0))) > 0.99 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0)
			uAxis = fallback.addScaledVector(normal, -fallback.dot(normal))
		}
		uAxis.normalize()
		const vAxis = new Vector3().crossVectors(normal, uAxis).normalize()

		return { uAxis, vAxis }
	}
}
