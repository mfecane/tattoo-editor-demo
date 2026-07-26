import { EDITOR_CONSTANTS, VERTEX_SLIDE_CONSTANTS } from '@/editor/constants'
import type { Editor } from '@/editor/main/Editor'
import { Color, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Quaternion, SphereGeometry, Vector3 } from 'three'

/**
 * Renders a small dot at every vertex of a selected, wrapped placed mesh -
 * lets the user see and grab individual vertices for the fine-tune slide
 * gesture. One InstancedMesh (not one Mesh per vertex) since a tessellated
 * mesh can easily have a few hundred vertices; per-instance color is how
 * the hovered dot gets highlighted without touching the others.
 *
 * Each dot is also scaled to stay constant-size on screen. Unlike a single
 * Group-based widget, the instances are spread across the wrapped mesh's
 * surface at different distances from the camera, so this can't be a single
 * uniform scale on the InstancedMesh itself (that would scale everything
 * around the mesh's local origin, dragging dots out of place) - each
 * instance's own matrix carries its own scale instead.
 */
export class WrappedVertexOverlay {
	private readonly instancedMesh: InstancedMesh
	private readonly baseColor = new Color(VERTEX_SLIDE_CONSTANTS.POINT_COLOR)
	private readonly hoverColor = new Color(VERTEX_SLIDE_CONSTANTS.HOVER_COLOR)
	private readonly influenceLowColor = new Color(VERTEX_SLIDE_CONSTANTS.INFLUENCE_COLOR_LOW)
	private readonly influenceHighColor = new Color(VERTEX_SLIDE_CONSTANTS.INFLUENCE_COLOR_HIGH)
	private hoveredIndex: number | null = null
	private showingInfluenceWeights: boolean = false

	private readonly screenSpaceScaleSubscription: AbortController

	public constructor(
		private readonly mesh: Mesh,
		private readonly editor: Editor
	) {
		const count = mesh.geometry.attributes.position.count
		const geometry = new SphereGeometry(VERTEX_SLIDE_CONSTANTS.POINT_SIZE, 8, 8)
		const material = new MeshBasicMaterial({ depthTest: false })

		this.instancedMesh = new InstancedMesh(geometry, material, count)
		this.instancedMesh.renderOrder = 999
		this.instancedMesh.name = 'WrappedVertexOverlay'

		for (let i = 0; i < count; i++) {
			this.instancedMesh.setColorAt(i, this.baseColor)
		}

		this.editor.overlayScene.add(this.instancedMesh)
		this.refresh()

		this.screenSpaceScaleSubscription = editor.cameraUpdateController.subscribe(() => this.refresh())
	}

	/** Re-reads vertex positions from the mesh's current geometry and each dot's screen-space scale - call after any drag mutates it, and on every camera update. */
	public refresh(): void {
		this.mesh.updateMatrixWorld(true)

		const positionAttr = this.mesh.geometry.attributes.position
		const matrix = new Matrix4()
		const point = new Vector3()
		const scale = new Vector3()
		const identityQuaternion = new Quaternion()
		const cameraPosition = this.editor.camera.position

		for (let i = 0; i < positionAttr.count; i++) {
			point.set(positionAttr.getX(i), positionAttr.getY(i), positionAttr.getZ(i)).applyMatrix4(this.mesh.matrixWorld)
			const scaleFactor = point.distanceTo(cameraPosition) / EDITOR_CONSTANTS.WIDGET_REFERENCE_DISTANCE
			scale.setScalar(scaleFactor)
			matrix.compose(point, identityQuaternion, scale)
			this.instancedMesh.setMatrixAt(i, matrix)
		}

		this.instancedMesh.instanceMatrix.needsUpdate = true
	}

	public setHoveredIndex(index: number | null): void {
		if (this.hoveredIndex === index || this.showingInfluenceWeights) {
			this.hoveredIndex = index
			return
		}
		if (this.hoveredIndex !== null) {
			this.instancedMesh.setColorAt(this.hoveredIndex, this.baseColor)
		}
		if (index !== null) {
			this.instancedMesh.setColorAt(index, this.hoverColor)
		}
		this.hoveredIndex = index

		if (this.instancedMesh.instanceColor) {
			this.instancedMesh.instanceColor.needsUpdate = true
		}
	}

	/**
	 * Colors every dot by its slide-vertex falloff weight (see
	 * SlideVertexInteractionHandler.computeFalloffWeights) - a low/high gradient for vertices the
	 * current drag is nudging, base color for everything outside the falloff radius. Pass null to
	 * drop back to plain base/hover coloring once the drag ends.
	 */
	public setInfluenceWeights(weights: Map<number, number> | null): void {
		const count = this.mesh.geometry.attributes.position.count

		if (weights) {
			for (let i = 0; i < count; i++) {
				const weight = weights.get(i)
				this.instancedMesh.setColorAt(i, weight === undefined ? this.baseColor : this.influenceLowColor.clone().lerp(this.influenceHighColor, weight))
			}
			this.showingInfluenceWeights = true
		} else {
			for (let i = 0; i < count; i++) {
				this.instancedMesh.setColorAt(i, i === this.hoveredIndex ? this.hoverColor : this.baseColor)
			}
			this.showingInfluenceWeights = false
		}

		if (this.instancedMesh.instanceColor) {
			this.instancedMesh.instanceColor.needsUpdate = true
		}
	}

	public destroy(): void {
		this.screenSpaceScaleSubscription.abort()
		this.instancedMesh.geometry.dispose()
		;(this.instancedMesh.material as MeshBasicMaterial).dispose()
		this.editor.overlayScene.remove(this.instancedMesh)
	}
}
