import { Handle } from '@/editor/lib/widget/Handle'
import { IHandle, IWidget } from '@/editor/lib/widget/IWidget'
import { HitResult } from '@/editor/main/HitTester'
import { Group, Intersection, Mesh, MeshBasicMaterial, Object3D, Scene, SphereGeometry, Vector3 } from 'three'

export class SelectWidget implements IWidget {
	private handles: IHandle[] = []

	public group: Group = new Group()

	public constructor(
		position: Vector3,
		private readonly overlayScene: Scene,
		public readonly stampId: string | null
	) {
		const handleSize = 0.03
		const handleGeometry = new SphereGeometry(handleSize, 16, 16)
		const handleMaterial = new MeshBasicMaterial({
			color: 0x4a90e2,
			depthTest: false,
		})
		const handleMesh = new Mesh(handleGeometry, handleMaterial)
		handleMesh.name = 'SelectHandleMesh'

		const hitTestSize = 0.08
		const hitTestGeometry = new SphereGeometry(hitTestSize, 16, 16)
		const hitTestMaterial = new MeshBasicMaterial({
			color: 0xffffff,
			visible: false,
		})
		const hitTest = new Mesh(hitTestGeometry, hitTestMaterial)
		hitTest.name = 'SelectHandleHitTest'

		const handle = new Handle('SelectHandle', hitTest, handleMesh, this, {
			stampId: this.stampId,
		})

		this.group.position.copy(position)
		this.group.add(handle.getCollider())
		this.group.add(handle.getVisual())
		overlayScene.add(this.group)

		this.handles = [handle]
	}

	public getColliders(): Mesh[] {
		return this.handles.map((handle) => handle.getCollider())
	}

	public getHandles(): IHandle[] {
		return this.handles
	}

	getHandleType(intersected: Object3D): 'x' | 'y' | 'center' | null {
		throw new Error('Method not implemented.')
	}

	getHandleHitResult(intersected: Object3D, intersection: Intersection): HitResult | null {
		throw new Error('Method not implemented.')
	}

	getGroup(): Group {
		return this.group
	}

	getType(): 'select' {
		return 'select'
	}

	destroy(): void {
		this.group.traverse((child) => {
			const obj = child as Object3D & {
				geometry?: { dispose: () => void }
				material?: { dispose: () => void } | { dispose: () => void }[]
			}
			if (obj.geometry) {
				obj.geometry.dispose()
			}
			if (obj.material) {
				if (Array.isArray(obj.material)) {
					obj.material.forEach((mat) => mat.dispose())
				} else {
					obj.material.dispose()
				}
			}
		})
		this.group.parent?.remove(this.group)
	}

	public getWorldPosition(target: Vector3): Vector3 {
		return this.group.getWorldPosition(target)
	}
}
