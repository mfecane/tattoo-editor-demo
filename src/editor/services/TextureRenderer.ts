import type { LatticeMesh } from '@/editor/lib/lattice/LatticeMesh'
import { Editor } from '@/editor/main/Editor'
import { RuntimeStamp } from '@/editor/main/RuntimeStamp'
import type { LatticeRenderer } from '@/editor/services/LatticeRenderer'
import type { StampData } from '@/editor/types/projectTypes'
import { MeshPhysicalMaterial } from 'three'

/**
 * Service for rendering stamps to textures and managing texture updates on asset meshes.
 * Handles composite texture rendering and material slot management.
 */
export class TextureRenderer {
	constructor(private readonly latticeRenderer: LatticeRenderer) {}

	/**
	 * Renders all stamps to a composite texture and updates the asset mesh material slot #1.
	 * This is the main function for texture rendering operations.
	 */
	public renderStampsToTexture(editor: Editor, stamps: RuntimeStamp[]): void {
		const texture = this.latticeRenderer.renderAllStampsToTexture(editor, stamps)
		texture.needsUpdate = true

		const materials = editor.previewMesh.mesh.material
		if (!Array.isArray(materials) || !(materials[1] instanceof MeshPhysicalMaterial)) {
			throw new Error('Asset material is not an array')
		}
		const material = materials[1]
		material.map = texture
	}

	/**
	 * Creates a map of stamps with their lattice meshes for composite rendering.
	 * Used to prepare stamp data for texture rendering.
	 */
	private createStampsMap(stamps: StampData[]): Map<string, { latticeMesh: LatticeMesh }> {
		const stampsMap = new Map<string, { latticeMesh: LatticeMesh }>()
		for (const stamp of stamps) {
			if (stamp.latticeMesh) {
				stampsMap.set(stamp.id, { latticeMesh: stamp.latticeMesh })
			}
		}
		return stampsMap
	}
}
