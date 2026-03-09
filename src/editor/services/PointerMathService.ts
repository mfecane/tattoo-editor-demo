import { PerspectiveCamera, Raycaster, Vector2 } from 'three'

export class PointerMathService {
	public normalizeMousePosition(
		event: { clientX: number; clientY: number },
		domElement: HTMLElement,
		camera: PerspectiveCamera,
		raycaster: Raycaster,
		mouse: Vector2
	): void {
		const rect = domElement.getBoundingClientRect()
		mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
		mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

		raycaster.setFromCamera(mouse, camera)
	}
}
