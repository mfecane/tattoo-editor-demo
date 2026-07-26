import { InteractionHandlerResult } from '@/editor/interaction/InteractionHandlerResult'
import { PolygonInteractionEvent } from '@/editor/polygon/interaction/PolygonInteractionEvent'

export interface PolygonInteractionHandler {
	id: string

	priority: number

	enabled: boolean

	isEnabled(event: PolygonInteractionEvent): boolean

	onEvent(event: PolygonInteractionEvent): InteractionHandlerResult
}
