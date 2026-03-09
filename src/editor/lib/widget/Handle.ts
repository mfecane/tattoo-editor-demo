import { getSingleBasicMaterialOrThrow } from '@/editor/lib/ThreeUtils'
import { IHandle, IWidget } from '@/editor/lib/widget/IWidget'
import { Color, Mesh, Object3D } from 'three'

export interface HandleUserData {
	handle: IHandle
	widget: IWidget
	payload: unknown
	isHitTest: boolean
	isHandle: boolean
}

export class Handle implements IHandle {
	public static readonly HIGHLIGHT_COLOR = new Color(0xffffff)

	private originalColor: Color

	public constructor(
		public readonly name: string,
		private readonly collider: Mesh,
		private readonly mesh: Mesh,
		private readonly widget: IWidget,
		public payload: unknown
	) {
		this.originalColor = getSingleBasicMaterialOrThrow(this.mesh).color?.clone() ?? new Color(0x4a90e2)
		const userData: HandleUserData = {
			isHitTest: true,
			isHandle: true,
			handle: this,
			widget: this.widget,
			payload: this.payload,
		}
		this.collider.userData = userData
	}

	public getCollider(): Mesh {
		return this.collider
	}

	public getVisual(): Object3D {
		return this.mesh
	}

	public getMesh(): Mesh {
		return this.mesh
	}

	public toggleHighlight(highlight: boolean): void {
		if (highlight) {
			getSingleBasicMaterialOrThrow(this.mesh).color?.copy(Handle.HIGHLIGHT_COLOR)
		} else {
			getSingleBasicMaterialOrThrow(this.mesh).color?.copy(this.originalColor)
		}
	}
}
