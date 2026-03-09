import { Matrix4, Quaternion, Vector2, Vector3 } from 'three'

export interface LatticeTransformParams {
	position: Vector2
	sizeX: number
	sizeY: number
	rotation: number
}

export interface LatticeTransformResult {
	position: Vector3
	scale: Vector3
	rotation: Quaternion
}

/**
 * Helper class for building lattice transform matrices.
 * Combines configured transform, rotation, scale, and UV space correction scale.
 */
export class LatticeTransformBuilder {
	/**
	 * Hard-coded overall scale due to UV space being non-uniform.
	 */
	public static readonly UV_SPACE_CORRECTION_SCALE = new Vector2(1.0, 0.3)
	/**
	 * Builds a transform matrix combining configured transform, rotation, scale, and UV space correction scale.
	 * Transform order: Configured Scale -> Rotate -> UV Correction Scale (in world space) -> Translate
	 * Matrix multiplication order: T * S_uv * R * S_config
	 *
	 * @param params - Transform parameters (position, sizeX, sizeY, rotation)
	 * @returns Transform matrix
	 */
	public static buildTransformMatrix(params: LatticeTransformParams): Matrix4 {
		const { position, sizeX, sizeY, rotation } = params

		const configScaleMatrix = new Matrix4().makeScale(sizeX, sizeY, 1)
		const rotationMatrix = new Matrix4().makeRotationZ(rotation)
		const uvScaleMatrix = new Matrix4().makeScale(
			this.UV_SPACE_CORRECTION_SCALE.x,
			this.UV_SPACE_CORRECTION_SCALE.y,
			1
		)
		const translationMatrix = new Matrix4().makeTranslation(position.x, position.y, 0)

		let transformMatrix = configScaleMatrix.clone()
		transformMatrix.premultiply(rotationMatrix)
		transformMatrix.premultiply(uvScaleMatrix)
		transformMatrix.premultiply(translationMatrix)

		return transformMatrix
	}

	/**
	 * Decomposes a transform matrix into position, rotation, and scale components.
	 *
	 * @param matrix - Transform matrix to decompose
	 * @returns Decomposed transform components
	 */
	public static decomposeTransform(matrix: Matrix4): LatticeTransformResult {
		const position = new Vector3()
		const quaternion = new Quaternion()
		const scale = new Vector3()
		matrix.decompose(position, quaternion, scale)

		return {
			position,
			scale,
			rotation: quaternion,
		}
	}

	/**
	 * Builds and decomposes a transform matrix for a lattice mesh.
	 * Convenience method that combines buildTransformMatrix and decomposeTransform.
	 *
	 * @param params - Transform parameters (position, sizeX, sizeY, rotation)
	 * @returns Decomposed transform components ready to apply to mesh
	 */
	public static buildTransform(params: LatticeTransformParams): LatticeTransformResult {
		const matrix = this.buildTransformMatrix(params)
		return this.decomposeTransform(matrix)
	}
}
