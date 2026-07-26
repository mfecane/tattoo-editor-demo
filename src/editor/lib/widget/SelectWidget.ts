import { EDITOR_CONSTANTS } from '@/editor/constants'
import { Handle } from '@/editor/lib/widget/Handle'
import { IHandle, IWidget } from '@/editor/lib/widget/IWidget'
import { computeScreenSpaceScale } from '@/editor/lib/widget/screenSpaceScale'
import type { Editor } from '@/editor/main/Editor'
import { HitResult } from '@/editor/main/HitTester'
import { Group, Intersection, Mesh, MeshBasicMaterial, Object3D, SphereGeometry, Vector3 } from 'three'

export interface SelectWidgetPayload {
	placedMeshId: string
}

export class SelectWidget implements IWidget {
	private handles: IHandle[] = []

	public group: Group = new Group()

	private screenSpaceScaleSubscription: AbortController

	public constructor(
		position: Vector3,
		editor: Editor,
		public readonly payload: SelectWidgetPayload
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

		const handle = new Handle('SelectHandle', hitTest, handleMesh, this, this.payload)

		this.group.position.copy(position)
		this.group.add(handle.getCollider())
		this.group.add(handle.getVisual())
		editor.overlayScene.add(this.group)

		this.handles = [handle]

		const applyScale = () => {
			this.group.scale.setScalar(
				computeScreenSpaceScale(editor.camera, this.group.position, EDITOR_CONSTANTS.WIDGET_REFERENCE_DISTANCE)
			)
		}
		applyScale()
		this.screenSpaceScaleSubscription = editor.cameraUpdateController.subscribe(applyScale)
	}

	public getColliders(): Mesh[] {
		return this.handles.map((handle) => handle.getCollider())
	}

	public getHandles(): IHandle[] {
		return this.handles
	}

	getHandleType(_intersected: Object3D): 'x' | 'y' | 'center' | null {
		throw new Error('Method not implemented.')
	}

	getHandleHitResult(_intersected: Object3D, _intersection: Intersection): HitResult | null {
		throw new Error('Method not implemented.')
	}

	getGroup(): Group {
		return this.group
	}

	getType(): 'select' {
		return 'select'
	}

	destroy(): void {
		this.screenSpaceScaleSubscription.abort()
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
