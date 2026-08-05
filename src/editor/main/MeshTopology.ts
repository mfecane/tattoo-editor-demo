import { BufferGeometry, Vector2 } from 'three'

export type Triangle = readonly [number, number, number]

/**
 * The flat regionMesh's own triangle/edge graph, extracted once from its index buffer: adjacency
 * list and the origin vertex (closest to local (0,0) - RegionMeshFactory centers meshes on their
 * area-weighted centroid, and that's the point placement raycasts the mesh onto the surface with).
 * The march order itself isn't decided here - see PlacedMeshWrapper's PatchFrameMarcher
 * implementations (LiveFrontierMarcher/DijkstraOrderMarcher) for how each one derives it.
 */
export class MeshTopology {
	public readonly triangles: Triangle[]
	public readonly adjacency: number[][]
	public readonly originIndex: number

	public constructor(private readonly local: Vector2[], index: BufferGeometry['index']) {
		const vertexCount = local.length
		this.triangles = []
		this.adjacency = Array.from({ length: vertexCount }, () => [])

		if (index) {
			for (let t = 0; t < index.count; t += 3) {
				const a = index.getX(t)
				const b = index.getX(t + 1)
				const c = index.getX(t + 2)
				this.triangles.push([a, b, c])
				this.adjacency[a].push(b, c)
				this.adjacency[b].push(a, c)
				this.adjacency[c].push(a, b)
			}
		}

		this.originIndex = this.findOriginVertex()
	}

	private findOriginVertex(): number {
		let originIndex = 0
		let bestDistSq = Infinity
		for (let i = 0; i < this.local.length; i++) {
			const distSq = this.local[i].lengthSq()
			if (distSq < bestDistSq) {
				bestDistSq = distSq
				originIndex = i
			}
		}
		return originIndex
	}
}
