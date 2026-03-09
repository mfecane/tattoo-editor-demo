import type { Object3D, Scene, Vector3 } from 'three'
import { ArrowHelper, LineBasicMaterial, Mesh, MeshBasicMaterial, SphereGeometry } from 'three'

/**
 * Manages temporary Three.js objects with automatic cleanup via timeout.
 * Useful for debug visualizations that should disappear after a short time.
 */
export class Visual3dDebugger {
	private objects: Map<Object3D, NodeJS.Timeout> = new Map()

	//@ts-expect-error fuck off typescript
	private scene: Scene

	public constructor() {}

	public setScene(scene: Scene): void {
		this.scene = scene
	}
	/**
	 * Adds a temporary object to the scene and schedules its removal.
	 * If an object of the same type already exists, it will be replaced.
	 */
	public addTemporaryObject(object: Object3D, timeoutMs: number = 4000): void {
		const scene = this.scene

		this.removeObject(object)

		scene.add(object)

		const timeout = setTimeout(() => {
			this.removeObject(object)
		}, timeoutMs)

		this.objects.set(object, timeout)
	}

	/**
	 * Creates and adds a temporary arrow helper to visualize a direction vector.
	 */
	public addTemporaryArrowHelper(
		direction: Vector3,
		origin: Vector3,
		length: number = 0.3,
		color: number = 0x00ffff,
		headLength: number = 0.1,
		headWidth: number = 0.05,
		timeoutMs: number = 4000
	): void {
		const arrowHelper = new ArrowHelper(direction, origin, length, color, headLength, headWidth)
		arrowHelper.name = 'NormalArrowHelper'
		if (arrowHelper.line && arrowHelper.line.material instanceof LineBasicMaterial) {
			arrowHelper.line.material.depthTest = false
		}
		if (arrowHelper.cone && arrowHelper.cone.material instanceof MeshBasicMaterial) {
			arrowHelper.cone.material.depthTest = false
		}
		this.addTemporaryObject(arrowHelper, timeoutMs)
	}

	private removeObject(object: Object3D): void {
		const timeout = this.objects.get(object)
		if (timeout) {
			clearTimeout(timeout)
			this.objects.delete(object)
		}

		const scene = this.scene
		if (object.parent === scene) {
			scene.remove(object)
			object.traverse((child) => {
				if (child instanceof Mesh) {
					child.geometry.dispose()
					if (Array.isArray(child.material)) {
						child.material.forEach((mat) => mat.dispose())
					} else {
						child.material.dispose()
					}
				}
			})
		}
	}

	public debugPoint(position: Vector3, name: string, color: number = 0x00ff00, size: number = 0.1): void {
		const marker = new Mesh(
			new SphereGeometry(size, 16, 16),
			new MeshBasicMaterial({
				color,
				depthTest: false,
				depthWrite: false,
			})
		)
		marker.renderOrder = 999
		marker.position.copy(position)
		marker.name = name
		this.addTemporaryObject(marker)
	}

	/**
	 * Clears all temporary objects immediately.
	 */
	public clearAll(): void {
		for (const object of this.objects.keys()) {
			this.removeObject(object)
		}
	}
}
