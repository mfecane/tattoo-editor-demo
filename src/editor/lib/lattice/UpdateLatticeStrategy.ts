import type { Vector2 } from 'three'

/**
 * Strategy interface for constraining lattice updates based on projection type.
 * This allows different projection types to enforce different constraints on
 * movement, scaling, rotation, and other transformations.
 *
 * Handlers should never check projection types directly - they should always
 * delegate to the strategy interface to determine allowed operations and
 * apply constraints.
 */
export interface UpdateLatticeStrategy {
	/**
	 * Whether X-axis movement is allowed.
	 */
	canMoveX(): boolean

	/**
	 * Whether Y-axis movement is allowed.
	 */
	canMoveY(): boolean

	/**
	 * Whether center handle movement is allowed.
	 */
	canMoveCenter(): boolean

	/**
	 * Whether X-axis scaling is allowed.
	 */
	canResizeX(): boolean

	/**
	 * Whether Y-axis scaling is allowed.
	 */
	canResizeY(): boolean

	/**
	 * Whether center handle scaling is allowed.
	 */
	canResizeCenter(): boolean

	/**
	 * Whether rotation is allowed.
	 */
	canRotate(): boolean

	/**
	 * Constrains UV coordinates according to projection type rules.
	 * @param uv - The UV coordinates to constrain
	 * @param initialUV - Optional initial UV coordinates (for center handle constraints)
	 * @returns Constrained UV coordinates
	 */
	constrainUV(uv: Vector2, initialUV?: Vector2): Vector2

	/**
	 * Constrains size values according to projection type rules.
	 * @param sizeX - The X size value to constrain
	 * @param sizeY - The Y size value to constrain
	 * @returns Constrained size values
	 */
	constrainSize(sizeX: number, sizeY: number): { sizeX: number; sizeY: number }

	/**
	 * Constrains rotation value according to projection type rules.
	 * @param rotation - The rotation value to constrain
	 * @returns Constrained rotation value
	 */
	constrainRotation(rotation: number): number

	/**
	 * Gets the default size for new stamps of this projection type.
	 * @param sourceImage - Optional source image to calculate aspect ratio-aware default size
	 * @returns Default size values
	 */
	getDefaultSize(sourceImage?: HTMLImageElement | null): { sizeX: number; sizeY: number }

	/**
	 * Gets the default rotation for new stamps of this projection type.
	 * @returns Default rotation value
	 */
	getDefaultRotation(): number

	/**
	 * Calculates distance between two UV coordinates according to projection type rules.
	 * For cylindrical projections, this may use wrapped distance calculations.
	 * @param uv1 - First UV coordinate
	 * @param uv2 - Second UV coordinate
	 * @returns Distance between the two UV coordinates
	 */
	calculateDistance(uv1: Vector2, uv2: Vector2): number
}
