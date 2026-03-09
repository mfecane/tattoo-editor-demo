import { Mesh, MeshPhysicalMaterial, Texture } from 'three'

export class PreviewMesh {
	public originalEditableTexture: Texture | null = null

	public constructor(public readonly mesh: Mesh) {
		this.originalEditableTexture = this.getTexture()
	}

	private getTexture(): Texture {
		if (!Array.isArray(this.mesh.material) || !(this.mesh.material[1] instanceof MeshPhysicalMaterial)) {
			throw new Error('Asset material is not an array')
		}
		const material = this.mesh.material[1] as MeshPhysicalMaterial
		if (!material.map) {
			throw new Error('Material does not have a map texture')
		}
		return material.map
	}
}
