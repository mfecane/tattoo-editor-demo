import type { UpdateLatticeStrategy } from '@/editor/lib/lattice/UpdateLatticeStrategy'
import type { IHandle } from '@/editor/lib/widget/IWidget'
import { HitResultType, type HitResult } from '@/editor/main/HitTester'
import { WidgetTransformService } from '@/editor/services/WidgetTransformService'
import { container } from '@/lib/di/container'
import {
	ArrowHelper,
	Color,
	LineBasicMaterial,
	Mesh,
	MeshBasicMaterial,
	Scene,
	SphereGeometry,
	Vector3,
	type Intersection,
	type Object3D,
} from 'three'
import { BaseWidget } from './BaseWidget'
import { HandleUserData } from './Handle'

class ScaleHandle implements IHandle {
	private static readonly HIGHLIGHT_COLOR = new Color(0xffffff)

	public constructor(
		private readonly collider: Mesh,
		private readonly visual: Mesh,
		private readonly originalColor: Color
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
		const mat = this.visual.material as MeshBasicMaterial
		mat.color.copy(highlight ? ScaleHandle.HIGHLIGHT_COLOR : this.originalColor)
	}
}

export class ScalingWidget extends BaseWidget {
	private readonly widgetTransformService: WidgetTransformService =
		container.resolve<WidgetTransformService>('WidgetTransformService')
	private xAxisHelper: ArrowHelper | null = null
	private yAxisHelper: ArrowHelper | null = null
	private xHandle: Mesh | null = null
	private yHandle: Mesh | null = null
	private xHitTest: Mesh | null = null
	private yHitTest: Mesh | null = null
	private centerHandle: Mesh | null = null
	private centerHitTest: Mesh | null = null

	public constructor(
		position: Vector3,
		normal: Vector3,
		uAxis: Vector3,
		vAxis: Vector3,
		scene: Scene,
		rotation: number = 0
	) {
		super()

		this.group.name = 'ScalingWidget'
		this.group.position.copy(position)

		const quaternion = this.widgetTransformService.calculateWidgetOrientation(normal, uAxis, vAxis, rotation)
		this.group.quaternion.copy(quaternion)
		this.group.scale.set(1, 1, 1)

		this.group.visible = true

		const arrowLength = 0.36
		const arrowHeadLength = 0.09
		const arrowHeadWidth = 0.054
		const hitTestSize = 0.072

		const xAxisHelper = new ArrowHelper(
			new Vector3(1, 0, 0),
			new Vector3(0, 0, 0),
			arrowLength,
			0xff0000,
			arrowHeadLength,
			arrowHeadWidth
		)
		xAxisHelper.name = 'XAxisHelper'
		xAxisHelper.userData.isXAxis = true
		if (xAxisHelper.line && xAxisHelper.line.material instanceof LineBasicMaterial) {
			xAxisHelper.line.material.depthTest = false
		}
		if (xAxisHelper.cone && xAxisHelper.cone.material instanceof MeshBasicMaterial) {
			xAxisHelper.cone.material.depthTest = false
		}
		this.group.add(xAxisHelper)

		const yAxisHelper = new ArrowHelper(
			new Vector3(0, 1, 0),
			new Vector3(0, 0, 0),
			arrowLength,
			0x00ff00,
			arrowHeadLength,
			arrowHeadWidth
		)
		yAxisHelper.name = 'YAxisHelper'
		yAxisHelper.userData.isYAxis = true
		if (yAxisHelper.line && yAxisHelper.line.material instanceof LineBasicMaterial) {
			yAxisHelper.line.material.depthTest = false
		}
		if (yAxisHelper.cone && yAxisHelper.cone.material instanceof MeshBasicMaterial) {
			yAxisHelper.cone.material.depthTest = false
		}
		this.group.add(yAxisHelper)

		const centerGeometry = new SphereGeometry(0.036, 16, 16)
		const centerMaterial = new MeshBasicMaterial({
			color: 0xffff00,
			depthTest: false,
		})
		const centerHandle = new Mesh(centerGeometry, centerMaterial)
		centerHandle.name = 'CenterHandle'
		centerHandle.userData.isCenterHandle = true
		this.group.add(centerHandle)

		const xHandleGeometry = new SphereGeometry(0.027, 16, 16)
		const xHandleMaterial = new MeshBasicMaterial({
			color: 0xff0000,
			depthTest: false,
		})
		const xHandle = new Mesh(xHandleGeometry, xHandleMaterial)
		xHandle.name = 'XHandle'
		xHandle.position.set(arrowLength, 0, 0)
		xHandle.userData.isXHandle = true
		this.group.add(xHandle)

		const yHandleGeometry = new SphereGeometry(0.027, 16, 16)
		const yHandleMaterial = new MeshBasicMaterial({
			color: 0x00ff00,
			depthTest: false,
		})
		const yHandle = new Mesh(yHandleGeometry, yHandleMaterial)
		yHandle.name = 'YHandle'
		yHandle.position.set(0, arrowLength, 0)
		yHandle.userData.isYHandle = true
		this.group.add(yHandle)

		const xHitTestGeometry = new SphereGeometry(hitTestSize, 16, 16)
		const xHitTestMaterial = new MeshBasicMaterial({
			color: 0xff0000,
			transparent: true,
			opacity: 0,
		})
		const xHitTest = new Mesh(xHitTestGeometry, xHitTestMaterial)
		xHitTest.name = 'XHitTest'
		xHitTest.position.set(arrowLength, 0, 0)
		xHitTest.userData.isXHandle = true
		xHitTest.userData.isXAxis = true
		xHitTest.userData.isHitTest = true
		this.group.add(xHitTest)

		const yHitTestGeometry = new SphereGeometry(hitTestSize, 16, 16)
		const yHitTestMaterial = new MeshBasicMaterial({
			color: 0x00ff00,
			transparent: true,
			opacity: 0,
		})
		const yHitTest = new Mesh(yHitTestGeometry, yHitTestMaterial)
		yHitTest.name = 'YHitTest'
		yHitTest.position.set(0, arrowLength, 0)
		yHitTest.userData.isYHandle = true
		yHitTest.userData.isYAxis = true
		yHitTest.userData.isHitTest = true
		this.group.add(yHitTest)

		const centerHitTestGeometry = new SphereGeometry(hitTestSize, 16, 16)
		const centerHitTestMaterial = new MeshBasicMaterial({
			color: 0xffff00,
			transparent: true,
			opacity: 0,
		})
		const centerHitTest = new Mesh(centerHitTestGeometry, centerHitTestMaterial)
		centerHitTest.name = 'CenterHitTest'
		centerHitTest.position.set(0, 0, 0)
		centerHitTest.userData.isCenterHandle = true
		centerHitTest.userData.isHitTest = true
		this.group.add(centerHitTest)

		const xHandleUserData: HandleUserData = {
			isHitTest: true,
			isHandle: true,
			handle: new ScaleHandle(xHitTest, xHandle, new Color(0xff0000)),
			widget: this,
			payload: { handleType: 'x' as const },
		}
		xHitTest.userData = xHandleUserData

		const yHandleUserData: HandleUserData = {
			isHitTest: true,
			isHandle: true,
			handle: new ScaleHandle(yHitTest, yHandle, new Color(0x00ff00)),
			widget: this,
			payload: { handleType: 'y' as const },
		}
		yHitTest.userData = yHandleUserData

		const centerHandleUserData: HandleUserData = {
			isHitTest: true,
			isHandle: true,
			handle: new ScaleHandle(centerHitTest, centerHandle, new Color(0xffff00)),
			widget: this,
			payload: { handleType: 'center' as const },
		}
		centerHitTest.userData = centerHandleUserData

		xAxisHelper.userData.originalColor = 0xff0000
		yAxisHelper.userData.originalColor = 0x00ff00
		xHandle.userData.originalColor = 0xff0000
		yHandle.userData.originalColor = 0x00ff00
		centerHandle.userData.originalColor = 0xffff00

		this.xAxisHelper = xAxisHelper
		this.yAxisHelper = yAxisHelper
		this.xHandle = xHandle
		this.yHandle = yHandle
		this.xHitTest = xHitTest
		this.yHitTest = yHitTest
		this.centerHandle = centerHandle
		this.centerHitTest = centerHitTest

		scene.add(this.group)
	}

	setEnabledHandles(strategy: UpdateLatticeStrategy): void {
		const canResizeX = strategy.canResizeX()
		const canResizeY = strategy.canResizeY()
		const canResizeCenter = strategy.canResizeCenter()

		if (this.xAxisHelper) {
			this.xAxisHelper.visible = canResizeX
		}
		if (this.xHandle) {
			this.xHandle.visible = canResizeX
		}
		if (this.xHitTest) {
			this.xHitTest.visible = canResizeX
		}

		if (this.yAxisHelper) {
			this.yAxisHelper.visible = canResizeY
		}
		if (this.yHandle) {
			this.yHandle.visible = canResizeY
		}
		if (this.yHitTest) {
			this.yHitTest.visible = canResizeY
		}

		if (this.centerHandle) {
			this.centerHandle.visible = canResizeCenter
		}
		if (this.centerHitTest) {
			this.centerHitTest.visible = canResizeCenter
		}
	}

	getType(): 'scaling' {
		return 'scaling'
	}

	getHandleType(intersected: Object3D): 'x' | 'y' | 'center' | null {
		let currentObject: Object3D | null = intersected
		while (currentObject && currentObject !== this.group) {
			if (currentObject.userData.isHitTest) {
				const payload = currentObject.userData.payload as { handleType?: 'x' | 'y' | 'center' } | undefined
				if (payload?.handleType) {
					return payload.handleType
				}
			}
			currentObject = currentObject.parent
		}
		return null
	}

	getHandleHitResult(intersected: Object3D, intersection: Intersection): HitResult | null {
		const handleType = this.getHandleType(intersected)
		if (handleType) {
			return {
				type: HitResultType.ResizeHandle,
				object: intersected,
				intersection,
				handleType,
			}
		}
		return null
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
}
