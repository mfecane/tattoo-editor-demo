import type { HitResult } from '@/editor/main/HitTester'
import { Group, Intersection, Mesh, Object3D } from 'three'
import type { IHandle } from './IWidget'
import { IWidget } from './IWidget'

export abstract class BaseWidget implements IWidget {
	protected group: Group

	public constructor() {
		this.group = new Group()
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

	abstract getType(): 'scaling' | 'move' | 'rotate' | 'select'

	abstract getHandleType(intersected: Object3D): 'x' | 'y' | 'center' | null

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
