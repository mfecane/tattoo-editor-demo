import { VertexFrame } from '@/editor/main/VertexFrame'
import { Mesh, Vector2 } from 'three'

/**
 * Common interface for PlacedMeshWrapper's interchangeable marching algorithms - see
 * MESH_WRAP_CONSTANTS.MARCH_ALGORITHM for which implementation is active (DijkstraOrderMarcher,
 * the legacy precomputed-order march, or LiveFrontierMarcher, the fused live-frontier march).
 */
export interface PatchFrameMarcher {
	/** Null return means the mesh isn't fully connected to its origin vertex - nothing meaningful to march or show. */
	march(mesh: Mesh, bodyMesh: Mesh, local: Vector2[], adjacency: number[][], originIndex: number): VertexFrame[] | null
}
