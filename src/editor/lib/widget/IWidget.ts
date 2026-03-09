import type { HitResult } from '@/editor/main/HitTester'
import type { Group, Intersection, Mesh, Object3D } from 'three'

export interface IHandle {
	getCollider(): Mesh

	getVisual(): Object3D

	getMesh(): Mesh

	toggleHighlight(highlight: boolean): void
}

export interface IWidget {
	destroy(): void
	getHandles(): IHandle[]
	getGroup(): Group
	getType(): 'scaling' | 'move' | 'rotate' | 'select'
	getColliders(): Mesh[]
	getHandleType(intersected: Object3D): 'x' | 'y' | 'center' | null
	getHandleHitResult(intersected: Object3D, intersection: Intersection): HitResult | null
}
