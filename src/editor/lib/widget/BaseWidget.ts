import type { Editor } from '@/editor/main/Editor'
import type { HitResult } from '@/editor/main/HitTester'
import { Group, Intersection, Mesh, Object3D } from 'three'
import type { IHandle } from './IWidget'
import { IWidget } from './IWidget'

export abstract class BaseWidget implements IWidget {
	protected group: Group

	private cameraUpdateSubscription: AbortController | null = null

	public constructor() {
		this.group = new Group()
	}

	/** Subscribes to every camera update (see CameraUpdateController), invoking callback once immediately too - call from a subclass constructor, and disposeCameraSubscription() from its destroy(). */
	protected subscribeToCameraUpdates(editor: Editor, callback: () => void): void {
		callback()
		this.cameraUpdateSubscription = editor.cameraUpdateController.subscribe(callback)
	}

	protected disposeCameraSubscription(): void {
		this.cameraUpdateSubscription?.abort()
		this.cameraUpdateSubscription = null
	}

	public destroy(): void {
		throw new Error('Method not implemented.')
	}

	public getGroup(): Group {
		return this.group
	}

	public getHandles(): IHandle[] {
		return []
	}

	abstract getType(): 'transform' | 'select'

	abstract getHandleHitResult(intersected: Object3D, intersection: Intersection): HitResult | null

	public getColliders(): Mesh[] {
		const colliders: Mesh[] = []
		this.group.traverse((child) => {
			if (child.userData.isHitTest && child instanceof Mesh) {
				colliders.push(child)
			}
		})
		return colliders
	}
}
