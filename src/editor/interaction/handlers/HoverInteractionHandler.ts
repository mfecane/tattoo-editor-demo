import { CanvasEventType } from '@/editor/interaction/CanvasEventType'
import { InteractionEvent } from '@/editor/interaction/InteractionEvent'
import { InteractionHandler } from '@/editor/interaction/InteractionHandler'
import { InteractionHandlerResult } from '@/editor/interaction/InteractionHandlerResult'
import { IHandle } from '@/editor/lib/widget/IWidget'
import { Editor } from '@/editor/main/Editor'
import { HitResultType, PlacedMeshVertexPayload } from '@/editor/main/HitTester'

export class HoverInteractionHandler implements InteractionHandler {
	public id: string = 'hover'

	public priority: number = 0

	public enabled: boolean = true

	private previousHighlightedHandle: IHandle | null = null

	public constructor(private readonly editor: Editor) {}

	public isEnabled(event: InteractionEvent): boolean {
		return event.type === CanvasEventType.Hover && this.enabled
	}

	public async onEvent(event: InteractionEvent): Promise<InteractionHandlerResult> {
		if (event.type !== CanvasEventType.Hover) {
			return new InteractionHandlerResult().setPass()
		}

		const hitResult = event.context.hitResult
		let handle: IHandle | null = null
		if (hitResult && hitResult.handle) {
			handle = hitResult.handle
		}

		if (this.previousHighlightedHandle !== handle) {
			this.previousHighlightedHandle?.toggleHighlight(false)
			this.previousHighlightedHandle = handle
			handle?.toggleHighlight(true)
		}

		this.updateVertexHover(hitResult)

		return new InteractionHandlerResult().setHandled()
	}

	/** Highlights the wrapped-mesh vertex dot the mouse is over, so the user can see which point a drag would grab. */
	private updateVertexHover(hitResult: InteractionEvent['context']['hitResult']): void {
		const overlay = this.editor.controller.getSelectTool().getVertexOverlay()
		if (!overlay) {
			return
		}

		if (hitResult?.type === HitResultType.PlacedMeshVertex) {
			const payload = hitResult.payload as PlacedMeshVertexPayload
			overlay.setHoveredIndex(payload.vertexIndex)
		} else {
			overlay.setHoveredIndex(null)
		}
	}
}
