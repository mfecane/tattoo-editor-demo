import { EDITOR_CONSTANTS } from '@/editor/constants'
import { computeScreenSpaceScale } from '@/editor/lib/widget/screenSpaceScale'
import type { Editor } from '@/editor/main/Editor'
import type { HitResult } from '@/editor/main/HitTester'
import { Group, Intersection, Mesh, Object3D } from 'three'
import type { IHandle } from './IWidget'
import { IWidget } from './IWidget'

export abstract class BaseWidget implements IWidget {
	protected group: Group

	private screenSpaceScaleSubscription: AbortController | null = null

	public constructor() {
		this.group = new Group()
	}

	/** Keeps the widget's on-screen size constant regardless of camera distance/zoom - call once the group's position is set. */
	protected enableScreenSpaceScale(editor: Editor): void {
		const applyScale = () => {
			this.group.scale.setScalar(
				computeScreenSpaceScale(editor.camera, this.group.position, EDITOR_CONSTANTS.WIDGET_REFERENCE_DISTANCE)
			)
		}
		applyScale()
		this.screenSpaceScaleSubscription = editor.cameraUpdateController.subscribe(applyScale)
	}

	/** Call from every concrete destroy() - each widget overrides destroy() itself, so this isn't automatic. */
	protected disposeScreenSpaceScale(): void {
		this.screenSpaceScaleSubscription?.abort()
		this.screenSpaceScaleSubscription = null
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
