import { Matrix4, Vector3 } from 'three'

/**
 * Local-to-world space conversion helpers shared by UV search algorithms.
 */
export class WorldSpaceUtils {
	/** Transforms a flat (x,y,z)-per-vertex position array by the given matrix, returning a new array. */
	static toWorldSpace(positions: Float32Array, matrix: Matrix4): Float32Array {
		const worldPositions = new Float32Array(positions.length)
		const vertex = new Vector3()
		for (let i = 0; i < positions.length / 3; i++) {
			vertex.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
			vertex.applyMatrix4(matrix)
			worldPositions[i * 3] = vertex.x
			worldPositions[i * 3 + 1] = vertex.y
			worldPositions[i * 3 + 2] = vertex.z
		}
		return worldPositions
	}
}
