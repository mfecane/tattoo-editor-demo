import { Box3, Mesh, Object3D, Vector2, Vector3 } from 'three'

export class MeshUtils {
	private static readonly CUBE_SIZE = 2

	/** Half-width/half-height of a mesh's own local (unscaled) geometry along its x/y axes - e.g. a patch's tangent-plane bounding box before mesh.scale is applied. */
	computeLocalHalfExtents(mesh: Mesh): Vector2 {
		if (!mesh.geometry.boundingBox) {
			mesh.geometry.computeBoundingBox()
		}
		const boundingBox = mesh.geometry.boundingBox
		if (!boundingBox) {
			throw new Error(`Mesh ${mesh.name} geometry has no bounding box`)
		}
		return new Vector2((boundingBox.max.x - boundingBox.min.x) / 2, (boundingBox.max.y - boundingBox.min.y) / 2)
	}

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
