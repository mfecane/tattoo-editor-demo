import { UpdateLatticeStrategy } from '@/editor/lib/lattice/UpdateLatticeStrategy'
import { HitResult, HitResultType } from '@/editor/main/HitTester'
import { WidgetTransformService } from '@/editor/services/WidgetTransformService'
import { container } from '@/lib/di/container'
import {
	Color,
	DoubleSide,
	Intersection,
	Mesh,
	MeshBasicMaterial,
	Object3D,
	RingGeometry,
	Scene,
	SphereGeometry,
	Vector3,
} from 'three'
import { BaseWidget } from './BaseWidget'
import { HandleUserData } from './Handle'
import { IHandle } from './IWidget'

class RotateHandle implements IHandle {
	private static readonly HIGHLIGHT_COLOR = new Color(0xffffff)

	public constructor(
		private readonly collider: Mesh,
		private readonly visual: Mesh,
		private readonly ring: Mesh,
		private readonly handleColor: Color,
		private readonly ringColor: Color
	) {}

	public getCollider(): Mesh {
		return this.collider
	}

	public getVisual(): Object3D {
		return this.visual
	}

	public getMesh(): Mesh {
		return this.visual
	}

	public toggleHighlight(highlight: boolean): void {
		const handleMaterial = this.visual.material as MeshBasicMaterial
		const ringMaterial = this.ring.material as MeshBasicMaterial
		handleMaterial.color.copy(highlight ? RotateHandle.HIGHLIGHT_COLOR : this.handleColor)
		ringMaterial.color.copy(highlight ? RotateHandle.HIGHLIGHT_COLOR : this.ringColor)
	}
}

export class RotateWidget extends BaseWidget {
	private handles: IHandle[] = []
	private readonly widgetTransformService: WidgetTransformService =
		container.resolve<WidgetTransformService>('WidgetTransformService')

	public constructor(
		position: Vector3,
		normal: Vector3,
		uAxis: Vector3,
		vAxis: Vector3,
		scene: Scene,
		rotation: number = 0
	) {
		super()

		this.group.name = 'RotateWidget'
		this.group.position.copy(position)

		const quaternion = this.widgetTransformService.calculateWidgetOrientation(normal, uAxis, vAxis, rotation)
		this.group.quaternion.copy(quaternion)
		this.group.scale.set(1, 1, 1)

		this.group.visible = true

		const handleRadius = 0.27
		const handleSize = 0.036
		const hitTestSize = 0.072

		const ringGeometry = new RingGeometry(handleRadius - 0.018, handleRadius + 0.018, 32)
		const ringMaterial = new MeshBasicMaterial({
			color: 0x0080ff,
			side: DoubleSide,
			depthTest: false,
		})
		const ring = new Mesh(ringGeometry, ringMaterial)
		ring.name = 'RotateRing'
		ring.userData.isRotateWidget = true
		this.group.add(ring)

		const handleGeometry = new SphereGeometry(handleSize, 16, 16)
		const handleMaterial = new MeshBasicMaterial({
			color: 0x0080ff,
			depthTest: false,
		})
		const handle = new Mesh(handleGeometry, handleMaterial)
		handle.name = 'RotateHandle'
		handle.position.set(handleRadius, 0, 0)
		this.group.add(handle)

		const hitTestGeometry = new SphereGeometry(hitTestSize, 16, 16)
		const hitTestMaterial = new MeshBasicMaterial({
			color: 0x0080ff,
			transparent: true,
			opacity: 0,
		})
		const hitTest = new Mesh(hitTestGeometry, hitTestMaterial)
		hitTest.name = 'RotateHitTest'
		hitTest.position.set(handleRadius, 0, 0)
		this.group.add(hitTest)

		const rotateHandle = new RotateHandle(hitTest, handle, ring, new Color(0x0080ff), new Color(0x0080ff))
		this.handles = [rotateHandle]
		const rotateHandleUserData: HandleUserData = {
			isHitTest: true,
			isHandle: true,
			handle: rotateHandle,
			widget: this,
			payload: { handleType: 'center' as const },
		}
		hitTest.userData = rotateHandleUserData

		scene.add(this.group)
	}

	public getHandles(): IHandle[] {
		return this.handles
	}

	getType(): 'rotate' {
		return 'rotate'
	}

	getHandleType(intersected: Object3D): 'x' | 'y' | 'center' | null {
		const userData = intersected.userData as HandleUserData
		const payload = userData?.payload as { handleType?: 'x' | 'y' | 'center' } | undefined
		return payload?.handleType ?? null
	}

	getHandleHitResult(intersected: Object3D, intersection: Intersection): HitResult | null {
		const handleType = this.getHandleType(intersected)
		if (handleType) {
			return {
				type: HitResultType.RotateHandle,
				object: intersected,
				intersection,
				handleType,
			}
		}
		return null
	}

	setEnabled(strategy: UpdateLatticeStrategy): void {
		this.group.visible = strategy.canRotate()
	}

	public destroy(): void {
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
}
