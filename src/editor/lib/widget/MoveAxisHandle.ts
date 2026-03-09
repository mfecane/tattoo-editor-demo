import { Handle, HandleUserData } from '@/editor/lib/widget/Handle'
import type { IHandle, IWidget } from '@/editor/lib/widget/IWidget'
import { ArrowHelper, Color, LineBasicMaterial, Mesh, MeshBasicMaterial } from 'three'

export class MoveAxisHandle implements IHandle {
	public static readonly HIGHLIGHT_COLOR = new Color(0xffffff)

	private readonly originalLineColor: Color
	private readonly originalConeColor: Color

	public constructor(
		public readonly name: string,
		private readonly collider: Mesh,
		private readonly arrowHelper: ArrowHelper,
		private readonly widget: IWidget,
		public payload: unknown
	) {
		this.originalLineColor =
			this.arrowHelper.line?.material instanceof LineBasicMaterial
				? this.arrowHelper.line.material.color.clone()
				: new Color(0x4a90e2)
		this.originalConeColor =
			this.arrowHelper.cone?.material instanceof MeshBasicMaterial
				? this.arrowHelper.cone.material.color.clone()
				: new Color(0x4a90e2)

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

	public getVisual(): ArrowHelper {
		return this.arrowHelper
	}

	public getMesh(): Mesh {
		return this.arrowHelper.cone as Mesh
	}

	public toggleHighlight(highlight: boolean): void {
		const color = highlight ? MoveAxisHandle.HIGHLIGHT_COLOR : this.originalLineColor
		if (this.arrowHelper.line?.material instanceof LineBasicMaterial) {
			this.arrowHelper.line.material.color.copy(color)
		}
		const coneColor = highlight ? MoveAxisHandle.HIGHLIGHT_COLOR : this.originalConeColor
		if (this.arrowHelper.cone?.material instanceof MeshBasicMaterial) {
			this.arrowHelper.cone.material.color.copy(coneColor)
		}
	}
}
