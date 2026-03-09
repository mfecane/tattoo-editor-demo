import { GeometryProjectionService } from '@/editor/services/GeometryProjectionService'
import type { Intersection, Mesh, Vector3 } from 'three'
import { Vector3 as Vector3Constructor } from 'three'

/**
 * Calculates surface data (normal and tangent vectors) from a raycast intersection.
 * Handles normal transformation and validates orthogonality of tangent vectors.
 */
export class SurfaceDataCalculator {
	private static readonly EPSILON = 1e-6
	private static readonly geometryProjectionService = new GeometryProjectionService()

	/**
	 * Calculates normal and tangent vectors from a raycast intersection.
	 * This one appears to be correct
	 *
	 * @param intersection - The raycast intersection result
	 * @param asset - The mesh that was intersected
	 * @param fallbackNormal - Optional fallback normal if intersection.normal is not available
	 * @returns Object containing normal, uAxis, and vAxis vectors
	 * @throws Error if tangent vectors are not orthogonal to the normal
	 */
	static calculateFromIntersection(
		intersection: Intersection,
		asset: Mesh,
		fallbackNormal?: Vector3
	): { normal: Vector3; uAxis: Vector3; vAxis: Vector3 } {
		const normal = intersection.normal
			? intersection.normal.clone().transformDirection(asset.matrixWorld)
			: fallbackNormal ?? new Vector3Constructor(0, 1, 0)

		const faceIndex = intersection.faceIndex ?? 0
		const { uAxis, vAxis } = this.geometryProjectionService.calculateTangentVectors(asset.geometry, faceIndex, normal)

		const uDotN = Math.abs(uAxis.dot(normal))
		const vDotN = Math.abs(vAxis.dot(normal))
		const uDotV = Math.abs(uAxis.dot(vAxis))

		if (uDotN > this.EPSILON || vDotN > this.EPSILON || uDotV > this.EPSILON) {
			throw new Error(
				`Tangent vectors are not orthogonal: uAxis·normal=${uDotN}, vAxis·normal=${vDotN}, uAxis·vAxis=${uDotV}`
			)
		}

		return { normal, uAxis, vAxis }
	}
}
