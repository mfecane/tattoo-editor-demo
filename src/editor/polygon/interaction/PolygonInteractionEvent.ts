import { CanvasEventType } from '@/editor/interaction/CanvasEventType'
import { PolygonHitResult } from '@/editor/polygon/PolygonHitResult'
import { PolygonPoint } from '@/editor/polygon/PolygonPoint'

export interface PolygonInteractionEvent {
	type: CanvasEventType
	point: PolygonPoint
	hitResult: PolygonHitResult
}
