import { MESH_WRAP_CONSTANTS } from '@/editor/constants'
import { MeshSnapshot } from '@/editor/main/MeshSnapshot'
import { BufferAttribute, Matrix3, Mesh, Raycaster, Vector3 } from 'three'

interface RestEdge {
	neighbor: number
	restLength: number
}

/**
 * Relaxes a wrapped placed-mesh's vertices back toward the edge lengths of its original flat
 * (pre-wrap) geometry - counters the stretching/compression PlacedMeshWrapper's march introduces
 * over curved regions of the body. Each iteration nudges every vertex toward the average position
 * implied by its neighbors' current positions plus the ORIGINAL flat edge length (scaled by the
 * mesh's frozen pre-wrap scale - the same delta.x*scale.x / delta.y*scale.y convention
 * PlacedMeshWrapper.marchFrames uses), then reprojects it onto the body surface along its current
 * normal - the same offset-ray idea as PlacedMeshWrapper.reproject - so relaxing can't lift the
 * patch off the curved surface it's glued to. Boundary vertices (touching only one triangle on an
 * edge) get their own relax result blended in by `boundaryWeight` (0 = fully pinned, so the
 * decal's outline can't shrink inward over iterations; 1 = relaxed exactly like interior
 * vertices) instead of an all-or-nothing pin, so the outline/interior tradeoff is tunable.
 */
export class PlacedMeshRelaxer {
	public static relax(
		mesh: Mesh,
		flatBackup: MeshSnapshot,
		bodyMesh: Mesh,
		strength: number,
		iterations: number,
		boundaryWeight: number = 0
	): void {
		const index = mesh.geometry.index
		const positionAttr = mesh.geometry.attributes.position
		const normalAttr = mesh.geometry.attributes.normal
		if (!index || iterations <= 0 || strength <= 0) {
			return
		}

		const vertexCount = positionAttr.count
		const adjacency = PlacedMeshRelaxer.buildRestAdjacency(flatBackup, index, vertexCount)
		const boundary = PlacedMeshRelaxer.findBoundaryVertices(index)

		mesh.updateMatrixWorld(true)
		const matrixWorld = mesh.matrixWorld.clone()
		const inverseMatrix = matrixWorld.clone().invert()
		const normalMatrix = new Matrix3().getNormalMatrix(matrixWorld)
		const raycaster = new Raycaster()

		let worldPositions: Vector3[] = new Array(vertexCount)
		for (let i = 0; i < vertexCount; i++) {
			worldPositions[i] = new Vector3(positionAttr.getX(i), positionAttr.getY(i), positionAttr.getZ(i)).applyMatrix4(matrixWorld)
		}

		for (let iter = 0; iter < iterations; iter++) {
			const nextPositions: Vector3[] = new Array(vertexCount)
			const contribution = new Vector3()
			const target = new Vector3()

			for (let i = 0; i < vertexCount; i++) {
				const edges = adjacency[i]
				if (edges.length === 0) {
					nextPositions[i] = worldPositions[i].clone()
					continue
				}

				target.set(0, 0, 0)
				for (const { neighbor, restLength } of edges) {
					contribution.copy(worldPositions[i]).sub(worldPositions[neighbor])
					if (contribution.lengthSq() < 1e-12) {
						contribution.set(1, 0, 0)
					} else {
						contribution.normalize()
					}
					contribution.multiplyScalar(restLength).add(worldPositions[neighbor])
					target.add(contribution)
				}
				target.divideScalar(edges.length)

				const predicted = worldPositions[i].clone().lerp(target, strength)

				const normal = new Vector3(normalAttr.getX(i), normalAttr.getY(i), normalAttr.getZ(i)).applyMatrix3(normalMatrix).normalize()
				const origin = predicted.clone().addScaledVector(normal, MESH_WRAP_CONSTANTS.SEARCH_OFFSET)
				raycaster.set(origin, normal.clone().negate())
				raycaster.near = 0
				raycaster.far = MESH_WRAP_CONSTANTS.SEARCH_DISTANCE

				const hits = raycaster.intersectObject(bodyMesh, false)
				const relaxed = hits.length > 0 ? hits[0].point.clone() : predicted

				nextPositions[i] = boundary.has(i) ? worldPositions[i].clone().lerp(relaxed, boundaryWeight) : relaxed
			}

			worldPositions = nextPositions

			for (let i = 0; i < vertexCount; i++) {
				const local = worldPositions[i].clone().applyMatrix4(inverseMatrix)
				positionAttr.setXYZ(i, local.x, local.y, local.z)
			}
			positionAttr.needsUpdate = true
			mesh.geometry.computeVertexNormals()
		}
	}

	/** One rest length per unique undirected edge, taken from the flat backup's local 2D positions scaled by its frozen pre-wrap scale - a real (pre-wrap) world-space edge length, not a raw local-space one, since scale can be non-uniform. */
	private static buildRestAdjacency(flatBackup: MeshSnapshot, index: BufferAttribute, vertexCount: number): RestEdge[][] {
		const flatPosition = flatBackup.geometry.attributes.position
		const scale = flatBackup.scale
		const adjacency: RestEdge[][] = Array.from({ length: vertexCount }, () => [])
		const seen = new Set<string>()

		const addEdge = (a: number, b: number): void => {
			const key = a < b ? `${a}_${b}` : `${b}_${a}`
			if (seen.has(key)) {
				return
			}
			seen.add(key)

			const dx = (flatPosition.getX(b) - flatPosition.getX(a)) * scale.x
			const dy = (flatPosition.getY(b) - flatPosition.getY(a)) * scale.y
			const dz = (flatPosition.getZ(b) - flatPosition.getZ(a)) * scale.z
			const restLength = Math.sqrt(dx * dx + dy * dy + dz * dz)

			adjacency[a].push({ neighbor: b, restLength })
			adjacency[b].push({ neighbor: a, restLength })
		}

		for (let t = 0; t < index.count; t += 3) {
			const a = index.getX(t)
			const b = index.getX(t + 1)
			const c = index.getX(t + 2)
			addEdge(a, b)
			addEdge(b, c)
			addEdge(c, a)
		}

		return adjacency
	}

	/** Vertices touching an edge shared by only one triangle - pinned during relax so the decal's outline doesn't creep inward. */
	private static findBoundaryVertices(index: BufferAttribute): Set<number> {
		const edgeToTriangleCount = new Map<string, number>()
		const edgeVertices = new Map<string, [number, number]>()

		const noteEdge = (a: number, b: number): void => {
			const key = a < b ? `${a}_${b}` : `${b}_${a}`
			edgeToTriangleCount.set(key, (edgeToTriangleCount.get(key) ?? 0) + 1)
			edgeVertices.set(key, [a, b])
		}

		for (let t = 0; t < index.count; t += 3) {
			const a = index.getX(t)
			const b = index.getX(t + 1)
			const c = index.getX(t + 2)
			noteEdge(a, b)
			noteEdge(b, c)
			noteEdge(c, a)
		}

		const boundary = new Set<number>()
		for (const [key, count] of edgeToTriangleCount) {
			if (count === 1) {
				const [a, b] = edgeVertices.get(key)!
				boundary.add(a)
				boundary.add(b)
			}
		}
		return boundary
	}
}
