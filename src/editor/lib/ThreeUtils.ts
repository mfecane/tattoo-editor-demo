import { Mesh, MeshBasicMaterial } from 'three'

export function getSingleBasicMaterialOrThrow(mesh: Mesh): MeshBasicMaterial {
	if (Array.isArray(mesh.material)) {
		throw new Error(`Mesh ${mesh.name} must have exactly one material`)
	}
	return mesh.material as MeshBasicMaterial
}
