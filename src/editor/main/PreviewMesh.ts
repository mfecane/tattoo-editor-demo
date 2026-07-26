import { PreviewSceneRenderOrder } from '@/editor/main/PreviewSceneRenderOrder'
import { Mesh, MeshPhysicalMaterial, Texture } from 'three'

export class PreviewMesh {
	public originalEditableTexture: Texture | null = null

	public constructor(public readonly mesh: Mesh) {
		this.originalEditableTexture = this.getTexture()
		this.applyPolygonOffset()
		this.mesh.renderOrder = PreviewSceneRenderOrder.Body
	}

	/**
	 * Pushes the body surface back in the depth buffer so placed decals
	 * (rendered right on top of it, at effectively the same depth) win the
	 * depth test reliably instead of z-fighting. The mesh has a material
	 * array (per-geometry-group materials, e.g. skin + editable-texture
	 * region), so this has to be set on every entry - three.js reads
	 * polygonOffset per material, not per mesh.
	 */
	private applyPolygonOffset(): void {
		const materials = Array.isArray(this.mesh.material) ? this.mesh.material : [this.mesh.material]
		for (const material of materials) {
			material.polygonOffset = true
			material.polygonOffsetFactor = 1.0
			material.polygonOffsetUnits = 1.0
		}
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
