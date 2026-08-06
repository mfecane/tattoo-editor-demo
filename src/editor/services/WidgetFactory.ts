import type { IWidget } from '@/editor/lib/widget/IWidget'
import { TransformWidget } from '@/editor/lib/widget/TransformWidget'
import type { WidgetStrategy } from '@/editor/lib/widget/WidgetStrategy'
import type { Editor } from '@/editor/main/Editor'
import type { Container } from '@/lib/di/container'
import type { Vector2, Vector3 } from 'three'

/**
 * Factory for creating widget instances.
 * Separates widget creation logic from store disposal concerns.
 */
export class WidgetFactory {
	/**
	 * Creates the combined transform widget (free move + corner/edge scale + rotate).
	 *
	 * @param position - The 3D position where the widget should be placed
	 * @param normal - The surface normal vector
	 * @param uAxis - The U axis vector (tangent direction)
	 * @param vAxis - The V axis vector (bitangent direction)
	 * @param halfExtents - Half-width/half-height (world units) of the patch's tangent-plane bounding box, traced by the box outline
	 * @param editor - The active Editor (its overlayScene, camera, and cameraUpdateController)
	 * @param container - The dependency container, resolved down into the widget's own services
	 * @param strategy - The strategy to determine which handles should be enabled
	 * @param rotation - Optional rotation angle in radians (default: 0)
	 * @returns The created widget instance
	 */
	static create(
		position: Vector3,
		normal: Vector3,
		uAxis: Vector3,
		vAxis: Vector3,
		halfExtents: Vector2,
		editor: Editor,
		container: Container,
		strategy: WidgetStrategy,
		rotation: number = 0
	): IWidget {
		const widget = new TransformWidget(position, normal, uAxis, vAxis, halfExtents, editor, container, rotation)
		widget.setEnabledHandles(strategy)
		return widget
	}
}
