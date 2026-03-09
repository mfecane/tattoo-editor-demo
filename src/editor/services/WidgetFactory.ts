import type { UpdateLatticeStrategy } from '@/editor/lib/lattice/UpdateLatticeStrategy'
import type { IWidget } from '@/editor/lib/widget/IWidget'
import { MoveWidget } from '@/editor/lib/widget/MoveWidget'
import { RotateWidget } from '@/editor/lib/widget/RotateWidget'
import { ScalingWidget } from '@/editor/lib/widget/ScalingWidget'
import type { Scene, Vector3 } from 'three'

/**
 * Factory for creating widget instances.
 * Separates widget creation logic from store disposal concerns.
 */
export class WidgetFactory {
	/**
	 * Creates a widget of the specified type.
	 *
	 * @param type - The type of widget to create ('scaling', 'rotate', or 'move')
	 * @param position - The 3D position where the widget should be placed
	 * @param normal - The surface normal vector
	 * @param uAxis - The U axis vector (tangent direction)
	 * @param vAxis - The V axis vector (bitangent direction)
	 * @param scene - The Three.js scene to add the widget to
	 * @param strategy - The strategy to determine which handles should be enabled
	 * @param rotation - Optional rotation angle in radians (default: 0)
	 * @returns The created widget instance
	 */
	static create(
		type: 'scaling' | 'rotate' | 'move',
		position: Vector3,
		normal: Vector3,
		uAxis: Vector3,
		vAxis: Vector3,
		scene: Scene,
		strategy: UpdateLatticeStrategy,
		rotation: number = 0
	): IWidget {
		let widget: IWidget
		switch (type) {
			case 'scaling':
				widget = new ScalingWidget(position, normal, uAxis, vAxis, scene, rotation)
				if (widget instanceof ScalingWidget) {
					widget.setEnabledHandles(strategy)
				}
				return widget
			case 'rotate':
				widget = new RotateWidget(position, normal, uAxis, vAxis, scene, rotation)
				if (widget instanceof RotateWidget) {
					widget.setEnabled(strategy)
				}
				return widget
			case 'move':
				widget = new MoveWidget(position, normal, uAxis, vAxis, scene, rotation)
				if (widget instanceof MoveWidget) {
					widget.setEnabledHandles(strategy)
				}
				return widget
		}
	}
}
