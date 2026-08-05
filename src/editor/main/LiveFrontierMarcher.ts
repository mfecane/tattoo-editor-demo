import { Blend, FrameBlender } from '@/editor/main/FrameBlender'
import { FrontierQueue } from '@/editor/main/FrontierQueue'
import { PatchFrameMarcher } from '@/editor/main/PatchFrameMarcher'
import { SurfaceReprojector } from '@/editor/main/SurfaceReprojector'
import { VertexFrame } from '@/editor/main/VertexFrame'
import { Mesh, Vector2 } from 'three'

/**
 * The fused plan-and-place front-march: a live Fast-Marching-style frontier (FrontierQueue, keyed
 * on a running distance-to-origin estimate) always pops whichever not-yet-placed vertex is
 * genuinely nearest given what's actually been placed in 3D so far - not a distance precomputed on
 * the flat patch before any placement happened. Each popped vertex blends predictions from *all* of
 * its already-placed neighbors (FrameBlender), snaps the blend onto the real surface via
 * SurfaceReprojector, then relaxes its still-unplaced neighbors' distance estimates before moving
 * on. Selected via MESH_WRAP_CONSTANTS.MARCH_ALGORITHM - see also DijkstraOrderMarcher.
 */
export class LiveFrontierMarcher implements PatchFrameMarcher {
	public constructor(private readonly blender: FrameBlender, private readonly reprojector: SurfaceReprojector) {}

	public march(mesh: Mesh, bodyMesh: Mesh, local: Vector2[], adjacency: number[][], originIndex: number): VertexFrame[] | null {
		const frames: VertexFrame[] = new Array(local.length)
		const distance: number[] = new Array(local.length).fill(Infinity)
		bodyMesh.updateMatrixWorld(true)

		const originBlend = this.blender.seedOriginVertex(mesh, local, originIndex)
		const originHit = this.reprojector.reproject(bodyMesh, originBlend.position, originBlend.normal)
		frames[originIndex] = this.blender.finalize(originHit, originBlend)
		distance[originIndex] = 0

		const frontier = new FrontierQueue()
		this.relax(originIndex, mesh, local, adjacency, frames, distance, frontier)

		let placedCount = 1
		for (let entry = frontier.popMin(); entry !== null; entry = frontier.popMin()) {
			const vi = entry.vertexIndex
			if (frames[vi]) {
				continue // stale queue entry from an earlier, worse estimate - vi is already placed
			}

			const blend: Blend = this.blender.predictBlend(vi, mesh, local, adjacency, frames)
			const hit = this.reprojector.reproject(bodyMesh, blend.position, blend.normal)
			// On a miss, finalize() carries the blended (unprojected) prediction forward so marching can
			// still finish - this vertex just ends up visibly off-surface, which WrapValidator will
			// catch. It still gets a distance and relaxes its neighbors below, same as a hit, so a
			// single miss can't stall the rest of the frontier.
			frames[vi] = this.blender.finalize(hit, blend)
			placedCount++

			// Relax step: vi is now placed, so its real frame can seed/improve the distance estimate of
			// each still-unplaced neighbor - same idea as Dijkstra's edge relaxation, except the edge
			// weight is a live tangent-transport estimate through vi's own frame, not a flat 2D edge length.
			distance[vi] = entry.distance
			this.relax(vi, mesh, local, adjacency, frames, distance, frontier)
		}

		return placedCount === local.length ? frames : null
	}

	/** Pushes/updates vi's not-yet-placed neighbors into the frontier with a distance estimate transported through vi's own (already-placed) frame. */
	private relax(vi: number, mesh: Mesh, local: Vector2[], adjacency: number[][], frames: VertexFrame[], distance: number[], frontier: FrontierQueue): void {
		const frame = frames[vi]
		for (const neighbor of adjacency[vi]) {
			if (frames[neighbor]) {
				continue // already placed, nothing to relax
			}
			const predicted = this.blender.predictPosition(frame, mesh, local, vi, neighbor)
			const candidateDistance = distance[vi] + frame.position.distanceTo(predicted)
			if (candidateDistance < distance[neighbor]) {
				distance[neighbor] = candidateDistance
				frontier.push(neighbor, candidateDistance)
			}
		}
	}
}
