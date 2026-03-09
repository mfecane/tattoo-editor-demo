import { Matrix4, Quaternion, Vector3 } from 'three'
import type { Group } from 'three'

export class WidgetTransformService {
	private static readonly WIDGET_ROTATION_SIGN = -1

	public calculateWidgetOrientation(
		normal: Vector3,
		uAxis: Vector3,
		vAxis: Vector3,
		rotation: number = 0
	): Quaternion {
		const normalizedN = normal.clone().normalize()

		let normalizedU: Vector3
		let normalizedV: Vector3

		if (rotation !== 0) {
			const rotationQuaternion = new Quaternion().setFromAxisAngle(
				normalizedN,
				rotation * WidgetTransformService.WIDGET_ROTATION_SIGN
			)
			const rotatedU = uAxis.clone().applyQuaternion(rotationQuaternion)
			const rotatedV = vAxis.clone().applyQuaternion(rotationQuaternion)
			normalizedU = rotatedU.clone().normalize()
			normalizedV = rotatedV.clone().normalize()
		} else {
			normalizedU = uAxis.clone().normalize()
			normalizedV = vAxis.clone().normalize()
		}

		const uProjected = normalizedU.clone().sub(normalizedN.clone().multiplyScalar(normalizedU.dot(normalizedN)))
		uProjected.normalize()

		const vProjected = normalizedV.clone().sub(normalizedN.clone().multiplyScalar(normalizedV.dot(normalizedN)))
		vProjected.normalize()

		const correctedV = vProjected.clone().sub(uProjected.clone().multiplyScalar(vProjected.dot(uProjected)))
		correctedV.normalize()

		const cross = new Vector3().crossVectors(uProjected, correctedV)
		if (cross.dot(normalizedN) < 0) {
			correctedV.negate()
		}

		const matrix = new Matrix4()
		matrix.makeBasis(uProjected, correctedV, normalizedN)

		const determinant = matrix.determinant()
		const EPSILON = 1e-6
		if (Math.abs(Math.abs(determinant) - 1) > EPSILON) {
			throw new Error(`Matrix is not a rotation matrix: determinant is ${determinant}, expected 1`)
		}

		const quaternion = new Quaternion().setFromRotationMatrix(matrix).normalize()
		this.assertValidQuaternion(quaternion)
		return quaternion
	}

	public updateWidgetOrientation(
		widgetGroup: Group,
		normal: Vector3,
		uAxis: Vector3,
		vAxis: Vector3,
		rotation: number
	): void {
		const quaternion = this.calculateWidgetOrientation(normal, uAxis, vAxis, rotation)
		widgetGroup.quaternion.copy(quaternion)
		widgetGroup.updateMatrixWorld(true)
	}

	private assertValidQuaternion(q: Quaternion): void {
		if (![q.x, q.y, q.z, q.w].every((v) => Number.isFinite(v))) {
			throw new Error(
				`Invalid quaternion components: x=${q.x}, y=${q.y}, z=${q.z}, w=${q.w} (must be finite)`
			)
		}
		const norm = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w)
		if (Math.abs(norm - 1) > 1e-3) {
			throw new Error(`Quaternion norm is ${norm}, expected approximately 1`)
		}
	}
}
