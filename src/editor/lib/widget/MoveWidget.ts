import { UpdateLatticeStrategy } from '@/editor/lib/lattice/UpdateLatticeStrategy'
import { HitResult, HitResultType } from '@/editor/main/HitTester'
import { WidgetTransformService } from '@/editor/services/WidgetTransformService'
import { container } from '@/lib/di/container'
import {
	ArrowHelper,
	Intersection,
	LineBasicMaterial,
	Mesh,
	MeshBasicMaterial,
	Object3D,
	Scene,
	SphereGeometry,
	Vector3,
} from 'three'
import { BaseWidget } from './BaseWidget'
import { Handle, HandleUserData } from './Handle'
import { IHandle } from './IWidget'
import { MoveAxisHandle } from './MoveAxisHandle'

type HandleType = 'x' | 'y' | 'center'

export class MoveWidget extends BaseWidget {
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

		this.group.name = 'MoveWidget'
		this.group.position.copy(position)

		const quaternion = this.widgetTransformService.calculateWidgetOrientation(normal, uAxis, vAxis, rotation)
		this.group.quaternion.copy(quaternion)
		this.group.scale.set(1, 1, 1)

		this.group.visible = true
		this.group.userData.isMoveWidget = true

		const arrowLength = 0.36
		const hitTestSize = 0.072

		const xHandle = this.createAxisHandle('x', 0xff0000, new Vector3(1, 0, 0), arrowLength, hitTestSize)
		const yHandle = this.createAxisHandle('y', 0x00ff00, new Vector3(0, 1, 0), arrowLength, hitTestSize)
		const centerHandle = this.createSphereHandle('center', 0xffff00, new Vector3(0, 0, 0), hitTestSize)

		this.handles = [xHandle, yHandle, centerHandle]

		for (const handle of this.handles) {
			this.group.add(handle.getCollider())
			this.group.add(handle.getVisual())
		}

		this.setTemporaryVisibility(true)

		scene.add(this.group)
	}

	private createAxisHandle(
		handleType: 'x' | 'y',
		color: number,
		direction: Vector3,
		arrowLength: number,
		hitTestSize: number
	): IHandle {
		const arrowHeadLength = 0.09
		const arrowHeadWidth = 0.054

		const arrowHelper = new ArrowHelper(
			direction,
			new Vector3(0, 0, 0),
			arrowLength,
			color,
			arrowHeadLength,
			arrowHeadWidth
		)
		arrowHelper.name = `${handleType.toUpperCase()}AxisHelper`
		if (arrowHelper.line?.material instanceof LineBasicMaterial) {
			arrowHelper.line.material.depthTest = false
		}
		if (arrowHelper.cone?.material instanceof MeshBasicMaterial) {
			arrowHelper.cone.material.depthTest = false
		}

		const hitTestGeometry = new SphereGeometry(hitTestSize, 16, 16)
		const hitTestMaterial = new MeshBasicMaterial({
			color,
			transparent: false,
			opacity: 0.0,
		})
		const hitTest = new Mesh(hitTestGeometry, hitTestMaterial)
		hitTest.name = `${handleType.toUpperCase()}HitTest`
		hitTest.renderOrder = 1
		hitTest.position.copy(direction).multiplyScalar(arrowLength)

		return new MoveAxisHandle(`Move${handleType.toUpperCase()}Handle`, hitTest, arrowHelper, this, {
			handleType,
		})
	}

	private createSphereHandle(handleType: 'center', color: number, position: Vector3, hitTestSize: number): IHandle {
		const handleGeometry = new SphereGeometry(0.036, 16, 16)
		const handleMaterial = new MeshBasicMaterial({
			color,
			depthTest: false,
		})
		const handleMesh = new Mesh(handleGeometry, handleMaterial)
		handleMesh.name = 'CenterHandleMesh'
		handleMesh.renderOrder = 1
		handleMesh.position.copy(position)

		const hitTestGeometry = new SphereGeometry(hitTestSize, 16, 16)
		const hitTestMaterial = new MeshBasicMaterial({
			color,
			transparent: false,
			opacity: 0.0,
		})
		const hitTest = new Mesh(hitTestGeometry, hitTestMaterial)
		hitTest.name = 'CenterHitTest'
		hitTest.renderOrder = 1
		hitTest.position.copy(position)

		return new Handle('MoveCenterHandle', hitTest, handleMesh, this, {
			handleType,
		})
	}

	public getHandles(): IHandle[] {
		return this.handles
	}

	public getColliders(): Mesh[] {
		return this.handles.map((h) => h.getCollider())
	}

	setEnabledHandles(strategy: UpdateLatticeStrategy): void {
		const canMoveX = strategy.canMoveX()
		const canMoveY = strategy.canMoveY()
		const canMoveCenter = strategy.canMoveCenter()

		const [xHandle, yHandle, centerHandle] = this.handles
		if (xHandle) {
			xHandle.getVisual().visible = canMoveX
			xHandle.getCollider().visible = canMoveX
		}
		if (yHandle) {
			yHandle.getVisual().visible = canMoveY
			yHandle.getCollider().visible = canMoveY
		}
		if (centerHandle) {
			centerHandle.getVisual().visible = canMoveCenter
			centerHandle.getCollider().visible = canMoveCenter
		}
	}

	setTemporaryVisibility(showOnlyCenter: boolean): void {
		const [xHandle, yHandle, centerHandle] = this.handles
		if (xHandle) {
			xHandle.getVisual().visible = !showOnlyCenter
		}
		if (yHandle) {
			yHandle.getVisual().visible = !showOnlyCenter
		}
		if (centerHandle) {
			centerHandle.getVisual().visible = true
		}
	}

	getType(): 'move' {
		return 'move'
	}

	getHandleType(intersected: Object3D): HandleType | null {
		const userData = intersected.userData as HandleUserData
		const payload = userData?.payload as { handleType?: HandleType } | undefined
		return payload?.handleType ?? null
	}

	getHandleHitResult(intersected: Object3D, intersection: Intersection): HitResult | null {
		const userData = intersected.userData as HandleUserData
		const payload = userData?.payload as { handleType?: HandleType } | undefined
		const handleType = payload?.handleType ?? null
		if (handleType && userData?.handle) {
			return {
				type: HitResultType.MoveHandle,
				object: intersected,
				intersection,
				handleType,
				handle: userData.handle,
			}
		}
		return null
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
