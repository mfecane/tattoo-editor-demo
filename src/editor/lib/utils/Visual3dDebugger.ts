import {
	ArrowHelper,
	BufferGeometry,
	Color,
	Float32BufferAttribute,
	LineBasicMaterial,
	LineSegments,
	Matrix4,
	Mesh,
	MeshBasicMaterial,
	Object3D,
	Scene,
	SphereGeometry,
	Vector3,
} from 'three'

interface DebugEntry {
	object: Object3D
	timeout: ReturnType<typeof setTimeout> | null
}

/**
 * Named, self-cleaning debug visualizations for a Three.js scene. Each visualization is
 * registered under a name - calling any `show*`/`addTemporaryObject` method again with the same
 * name replaces the previous object instead of piling up duplicates, which is what makes this
 * safe to call from a routine that re-runs often (e.g. once per bake/search).
 */
export class Visual3dDebugger {
	private entries: Map<string, DebugEntry> = new Map()
	private scene: Scene | null = null

	public setScene(scene: Scene): void {
		this.scene = scene
	}

	/**
	 * Adds/replaces the named debug object. Pass `timeoutMs: null` to keep it visible until
	 * explicitly replaced/cleared instead of auto-expiring - useful for a visualization you want
	 * to keep inspecting (orbit the camera, etc.) rather than a quick flash.
	 */
	public addTemporaryObject(name: string, object: Object3D, timeoutMs: number | null = 4000): void {
		if (!this.scene) {
			return
		}
		this.remove(name)
		object.name = name
		this.scene.add(object)
		const timeout = timeoutMs === null ? null : setTimeout(() => this.remove(name), timeoutMs)
		this.entries.set(name, { object, timeout })
	}

	/** Removes and disposes the named debug object, if present. Safe to call when nothing is registered under that name. */
	public remove(name: string): void {
		const entry = this.entries.get(name)
		if (!entry) {
			return
		}
		if (entry.timeout) {
			clearTimeout(entry.timeout)
		}
		this.entries.delete(name)
		this.scene?.remove(entry.object)
		entry.object.traverse((child) => {
			if (!(child instanceof Mesh) && !(child instanceof LineSegments)) {
				return
			}
			child.geometry.dispose()
			if (Array.isArray(child.material)) {
				child.material.forEach((mat) => mat.dispose())
			} else {
				child.material.dispose()
			}
		})
	}

	/** Creates and adds a temporary arrow helper to visualize a direction vector. */
	public addTemporaryArrowHelper(
		name: string,
		direction: Vector3,
		origin: Vector3,
		length: number = 0.3,
		color: number = 0x00ffff,
		headLength: number = 0.1,
		headWidth: number = 0.05,
		timeoutMs: number | null = 4000
	): void {
		const arrowHelper = new ArrowHelper(direction, origin, length, color, headLength, headWidth)
		if (arrowHelper.line && arrowHelper.line.material instanceof LineBasicMaterial) {
			arrowHelper.line.material.depthTest = false
		}
		if (arrowHelper.cone && arrowHelper.cone.material instanceof MeshBasicMaterial) {
			arrowHelper.cone.material.depthTest = false
		}
		this.addTemporaryObject(name, arrowHelper, timeoutMs)
	}

	public debugPoint(name: string, position: Vector3, color: number = 0x00ff00, size: number = 0.1, timeoutMs: number | null = 4000): void {
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
		this.addTemporaryObject(name, marker, timeoutMs)
	}

	/**
	 * Shows a BufferGeometry as a wireframe mesh - e.g. the pushed/expanded copy of a drapedPatch
	 * used during raycast UV search. Pass a `matrix` if `geometry` is in local space and needs
	 * placing in the scene's world space (the geometry itself is not mutated).
	 */
	public showWireframe(
		name: string,
		geometry: BufferGeometry,
		options?: { matrix?: Matrix4; color?: number; opacity?: number; timeoutMs?: number | null }
	): void {
		const material = new MeshBasicMaterial({
			color: options?.color ?? 0xffaa00,
			wireframe: true,
			transparent: true,
			opacity: options?.opacity ?? 0.35,
			depthTest: false,
		})
		const mesh = new Mesh(geometry, material)
		if (options?.matrix) {
			mesh.matrixAutoUpdate = false
			mesh.matrix.copy(options.matrix)
			mesh.matrixWorldNeedsUpdate = true
		}
		mesh.renderOrder = 900
		mesh.frustumCulled = false
		this.addTemporaryObject(name, mesh, options?.timeoutMs ?? null)
	}

	/**
	 * Shows a batch of rays (origin -> target) as one LineSegments draw call, color-coded by
	 * `hit` - e.g. every ray cast from a body vertex during raycast UV search, so both the hits
	 * and the misses are visible at once.
	 */
	public showRays(
		name: string,
		rays: { origin: Vector3; target: Vector3; hit: boolean }[],
		options?: { hitColor?: number; missColor?: number; timeoutMs?: number | null }
	): void {
		const hitColor = new Color(options?.hitColor ?? 0x00ffff)
		const missColor = new Color(options?.missColor ?? 0xff0044)

		const positions = new Float32Array(rays.length * 6)
		const colors = new Float32Array(rays.length * 6)
		rays.forEach((ray, i) => {
			positions[i * 6] = ray.origin.x
			positions[i * 6 + 1] = ray.origin.y
			positions[i * 6 + 2] = ray.origin.z
			positions[i * 6 + 3] = ray.target.x
			positions[i * 6 + 4] = ray.target.y
			positions[i * 6 + 5] = ray.target.z

			const color = ray.hit ? hitColor : missColor
			colors[i * 6] = color.r
			colors[i * 6 + 1] = color.g
			colors[i * 6 + 2] = color.b
			colors[i * 6 + 3] = color.r
			colors[i * 6 + 4] = color.g
			colors[i * 6 + 5] = color.b
		})

		const geometry = new BufferGeometry()
		geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
		geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))

		const material = new LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, opacity: 0.6 })
		const lines = new LineSegments(geometry, material)
		lines.frustumCulled = false
		lines.renderOrder = 901
		this.addTemporaryObject(name, lines, options?.timeoutMs ?? null)
	}

	/** Clears all registered debug objects immediately. */
	public clearAll(): void {
		for (const name of [...this.entries.keys()]) {
			this.remove(name)
		}
	}
}
