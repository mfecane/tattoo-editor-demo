import { Box3, Mesh, Object3D, Vector3 } from 'three'

export class MeshUtils {
	private static readonly CUBE_SIZE = 2

	fitMesh(mesh: Mesh | Object3D): number {
		const box = new Box3().setFromObject(mesh)
		const size = box.getSize(new Vector3())
		const center = box.getCenter(new Vector3())

		const maxDimension = Math.max(size.x, size.y, size.z)
		const scale = maxDimension > 0 ? MeshUtils.CUBE_SIZE / maxDimension : 1

		mesh.position.set(-center.x * scale, -center.y * scale, -center.z * scale)
		mesh.scale.set(scale, scale, scale)
		mesh.updateMatrixWorld(true)

		return scale
	}
}
