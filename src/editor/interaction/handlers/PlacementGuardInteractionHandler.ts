import { CanvasEventType } from '@/editor/interaction/CanvasEventType'
import { InteractionEvent } from '@/editor/interaction/InteractionEvent'
import { InteractionHandler } from '@/editor/interaction/InteractionHandler'
import { InteractionHandlerResult } from '@/editor/interaction/InteractionHandlerResult'
import { Editor } from '@/editor/main/Editor'
import { HitResultType } from '@/editor/main/HitTester'

/** Hit types that are legitimate interactions with the selected, not-yet-applied piece itself - never trigger the discard confirmation below. */
const ALLOWED_HIT_TYPES: ReadonlySet<HitResultType> = new Set([
	HitResultType.SelectableObject,
	HitResultType.WidgetHandle,
	HitResultType.MoveHandle,
	HitResultType.ResizeHandle,
	HitResultType.RotateHandle,
	HitResultType.WidgetBody,
])

/**
 * Guards a selected regionMesh in placement mode (placed but not yet applied/wrapped): clicking
 * anywhere on the canvas other than the body mesh or one of the transform widget's handles would
 * otherwise silently lose the piece, so this asks for confirmation instead. Apply/Delete live
 * outside the canvas (SelectionContextMenu) and go through their own flows, unaffected by this
 * handler. Always enabled - isEnabled() gates on live selection state rather than tool lifecycle,
 * since regionMesh selection is exactly what drives TransformTool (see EditorController.syncActiveToolToTarget).
 */
export class PlacementGuardInteractionHandler implements InteractionHandler {
	public id: string = 'placement-guard'

	public priority: number = 110

	public enabled: boolean = true

	public constructor(private readonly editor: Editor) {}

	public isEnabled(event: InteractionEvent): boolean {
		if (!this.enabled || event.type !== CanvasEventType.Click) {
			return false
		}
		const selected = this.editor.controller.getSelectedPlacedMesh()
		return selected !== null && selected.kind === 'regionMesh'
	}

	public async onEvent(event: InteractionEvent): Promise<InteractionHandlerResult> {
		const hitResult = event.context?.hitResult
		if (hitResult && ALLOWED_HIT_TYPES.has(hitResult.type)) {
			return new InteractionHandlerResult().setPass()
		}

		this.editor.reactBridge.requestSelectPlacedMesh(null)
		return new InteractionHandlerResult().setHandled()
	}
}
