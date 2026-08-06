import { EDITOR_CONSTANTS, PLACEMENT_CURSOR_CONSTANTS } from '@/editor/constants'
import { computeScreenSpaceScale } from '@/editor/lib/widget/screenSpaceScale'
import { Editor } from '@/editor/main/Editor'
import { ConeGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three'

const UP: Vector3 = new Vector3(0, 1, 0)

/**
 * Arrow shown while the placement tool is active, tracking the cursor's hit point on the body
 * mesh - tip touching the surface, shaft standing off along the surface normal - so the user can
 * see exactly where the pending mesh would land before clicking. Driven by HoverInteractionHandler
 * (update() on every hover over the body, hide() otherwise), owned by PlacementTool.
 */
export class PlacementCursorArrow {
	private readonly group: Group = new Group()

	private readonly material: MeshBasicMaterial

	public constructor(private readonly editor: Editor) {
		// Local +Y aligned, tip at the local origin (touches the hit point), base/shaft trailing
		// away toward +Y (aligned to the surface normal by update()'s quaternion).
		const headGeometry: ConeGeometry = new ConeGeometry(PLACEMENT_CURSOR_CONSTANTS.HEAD_RADIUS, PLACEMENT_CURSOR_CONSTANTS.HEAD_LENGTH, 16)
			.rotateX(Math.PI)
			.translate(0, PLACEMENT_CURSOR_CONSTANTS.HEAD_LENGTH / 2, 0)

		const shaftGeometry: CylinderGeometry = new CylinderGeometry(
			PLACEMENT_CURSOR_CONSTANTS.SHAFT_RADIUS,
			PLACEMENT_CURSOR_CONSTANTS.SHAFT_RADIUS,
			PLACEMENT_CURSOR_CONSTANTS.SHAFT_LENGTH,
			12
		).translate(0, PLACEMENT_CURSOR_CONSTANTS.HEAD_LENGTH + PLACEMENT_CURSOR_CONSTANTS.SHAFT_LENGTH / 2, 0)

		this.material = new MeshBasicMaterial({
			color: PLACEMENT_CURSOR_CONSTANTS.COLOR,
			depthTest: false,
			transparent: true,
			opacity: PLACEMENT_CURSOR_CONSTANTS.OPACITY,
		})

		const head: Mesh = new Mesh(headGeometry, this.material)
		head.name = 'PlacementCursorArrowHead'
		const shaft: Mesh = new Mesh(shaftGeometry, this.material)
		shaft.name = 'PlacementCursorArrowShaft'

		this.group.name = 'PlacementCursorArrow'
		this.group.renderOrder = 999
		this.group.visible = false
		this.group.add(head, shaft)
		this.editor.overlayScene.add(this.group)
	}

	/** Points the arrow's tip at `point`, standing off along `normal`, scaled to a constant screen size. */
	public update(point: Vector3, normal: Vector3): void {
		this.group.position.copy(point)
		this.group.quaternion.setFromUnitVectors(UP, normal)
		this.group.scale.setScalar(computeScreenSpaceScale(this.editor.camera, point, EDITOR_CONSTANTS.WIDGET_REFERENCE_DISTANCE))
		this.group.visible = true
	}

	public hide(): void {
		this.group.visible = false
	}

	public destroy(): void {
		this.group.traverse((child) => {
			if (child instanceof Mesh) {
				child.geometry.dispose()
			}
		})
		this.material.dispose()
		this.group.parent?.remove(this.group)
	}
}
