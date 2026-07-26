import { MESH_WRAP_CONSTANTS } from '@/editor/constants'
import { PreviewSceneRenderOrder } from '@/editor/main/PreviewSceneRenderOrder'
import { BufferGeometry, DoubleSide, Mesh, MeshBasicMaterial, Scene } from 'three'

/**
 * A single wireframe "ghost" mesh showing what wrapping the currently
 * selected flat mesh would produce, kept in sync by EditorController's
 * debounced preview scheduler. Color-coded so validity is visible without
 * clicking Wrap first: green if the preview would succeed, red if not.
 */
export class WrapPreviewGhost {
	private readonly mesh: Mesh
	private readonly material: MeshBasicMaterial

	public constructor(private readonly scene: Scene) {
		this.material = new MeshBasicMaterial({
			wireframe: true,
			transparent: true,
			opacity: 0.6,
			side: DoubleSide,
			polygonOffset: true,
			polygonOffsetFactor: -8,
			polygonOffsetUnits: -8,
			depthTest: false
		})
		this.mesh = new Mesh(new BufferGeometry(), this.material)
		this.mesh.name = 'WrapPreviewGhost'
		this.mesh.renderOrder = PreviewSceneRenderOrder.WrapPreviewGhost
		this.mesh.visible = false
		this.scene.add(this.mesh)
	}

	/** Matches the ghost to `sourceMesh`'s current transform and swaps in the given preview geometry. */
	public update(sourceMesh: Mesh, geometry: BufferGeometry, valid: boolean): void {
		this.mesh.geometry.dispose()
		this.mesh.geometry = geometry
		this.mesh.position.copy(sourceMesh.position)
		this.mesh.quaternion.copy(sourceMesh.quaternion)
		this.mesh.scale.copy(sourceMesh.scale)
		this.material.color.set(valid ? MESH_WRAP_CONSTANTS.PREVIEW_VALID_COLOR : MESH_WRAP_CONSTANTS.PREVIEW_INVALID_COLOR)
		this.mesh.visible = true
	}

	public hide(): void {
		this.mesh.visible = false
	}

	public destroy(): void {
		this.mesh.geometry.dispose()
		this.material.dispose()
		this.scene.remove(this.mesh)
	}
}
