import { Blend, FrameBlender } from '@/editor/main/FrameBlender'
import { PatchFrameMarcher } from '@/editor/main/PatchFrameMarcher'
import { SurfaceReprojector } from '@/editor/main/SurfaceReprojector'
import { VertexFrame } from '@/editor/main/VertexFrame'
import { Mesh, Vector2 } from 'three'

/**
 * Legacy two-stage march, kept alongside LiveFrontierMarcher for comparison - see
 * MESH_WRAP_CONSTANTS.MARCH_ALGORITHM. Planning and placement are separate: a full march order is
 * decided upfront by a Dijkstra pass over the flat regionMesh's own edge graph (edge weight =
 * local-space edge length), before any vertex has actually been placed on the curved body: then
 * that fixed order is walked once, blending each vertex's already-placed neighbors (FrameBlender)
 * and snapping onto the surface via SurfaceReprojector. Flat distance diverges from true
 * body-surface distance wherever the body has curvature, so the march order this produces can be
 * wrong for the surface being wrapped onto - that's the problem LiveFrontierMarcher fixes.
 */
export class DijkstraOrderMarcher implements PatchFrameMarcher {
	public constructor(private readonly blender: FrameBlender, private readonly reprojector: SurfaceReprojector) {}

	public march(mesh: Mesh, bodyMesh: Mesh, local: Vector2[], adjacency: number[][], originIndex: number): VertexFrame[] | null {
		const order = this.planOrder(local, adjacency, originIndex)
		if (order === null) {
			return null
		}

		const frames: VertexFrame[] = new Array(local.length)
		bodyMesh.updateMatrixWorld(true)

		const originBlend = this.blender.seedOriginVertex(mesh, local, originIndex)
		const originHit = this.reprojector.reproject(bodyMesh, originBlend.position, originBlend.normal)
		frames[originIndex] = this.blender.finalize(originHit, originBlend)

		for (const vi of order) {
			if (vi === originIndex) {
				continue
			}
			const blend: Blend = this.blender.predictBlend(vi, mesh, local, adjacency, frames)
			const hit = this.reprojector.reproject(bodyMesh, blend.position, blend.normal)
			frames[vi] = this.blender.finalize(hit, blend)
		}

		return frames
	}

	/**
	 * Dijkstra over the mesh's own edge graph (edge weight = local-space edge length) from
	 * originIndex, giving the full vertex processing order upfront - nearest-to-origin first. Null
	 * if the mesh isn't fully connected to the origin.
	 */
	private planOrder(local: Vector2[], adjacency: number[][], originIndex: number): number[] | null {
		const vertexCount = local.length
		const dist = new Array<number>(vertexCount).fill(Infinity)
		const visited = new Array<boolean>(vertexCount).fill(false)
		dist[originIndex] = 0

		for (let iter = 0; iter < vertexCount; iter++) {
			let u = -1
			let best = Infinity
			for (let i = 0; i < vertexCount; i++) {
				if (!visited[i] && dist[i] < best) {
					best = dist[i]
					u = i
				}
			}
			if (u === -1) {
				break
			}
			visited[u] = true
			for (const v of adjacency[u]) {
				const weight = local[u].distanceTo(local[v])
				if (dist[u] + weight < dist[v]) {
					dist[v] = dist[u] + weight
				}
			}
		}

		if (dist.some((d) => d === Infinity)) {
			return null // mesh isn't fully connected to the origin
		}

		return Array.from({ length: vertexCount }, (_, i) => i).sort((a, b) => dist[a] - dist[b])
	}
}
