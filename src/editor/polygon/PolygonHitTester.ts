import { REGION_EDITOR_CONSTANTS } from '@/editor/constants'
import { isPointInAARect } from '@/editor/lib/utils/AARectGeometry'
import { distance, distanceToSegment, isPointInPolygon } from '@/editor/lib/utils/PolygonGeometry'
import { PolygonCollection } from '@/editor/polygon/PolygonCollection'
import { PolygonHitResult, PolygonHitResultType } from '@/editor/polygon/PolygonHitResult'
import { PolygonPoint } from '@/editor/polygon/PolygonPoint'
import { PolygonSelectionModel } from '@/editor/polygon/PolygonSelectionModel'

/**
 * Resolves a pointer position to a semantic hit against the current
 * polygon collection: while a polygon is being drawn, only its
 * close-zone matters; once every polygon is closed, vertex/edge edits
 * only apply to the selected polygon, and hitting any other polygon's
 * body/vertex/edge is a select gesture instead.
 */
export class PolygonHitTester {
	public performHitTest(collection: PolygonCollection, point: PolygonPoint): PolygonHitResult {
		const openPolygon = collection.getOpenPolygon()
		if (openPolygon) {
			return this.hitTestDrawing(openPolygon, point)
		}
		return this.hitTestEditing(collection, point)
	}

	private hitTestDrawing(polygon: PolygonSelectionModel, point: PolygonPoint): PolygonHitResult {
		// A rect never has a "close" gesture - it finishes on drag release (see AddRectInteractionHandler).
		if (polygon.kind === 'aarect') {
			return { type: PolygonHitResultType.Background }
		}
		if (polygon.canClose()) {
			const first = polygon.getPoints()[0]
			if (distance(point, first) <= REGION_EDITOR_CONSTANTS.CLOSE_HIT_RADIUS) {
				return { type: PolygonHitResultType.Close, polygonId: polygon.id }
			}
		}
		return { type: PolygonHitResultType.Background }
	}

	private hitTestEditing(collection: PolygonCollection, point: PolygonPoint): PolygonHitResult {
		const selected = collection.getSelectedPolygon()
		if (selected) {
			const vertexIndex = this.findVertexIndex(selected, point)
			if (vertexIndex !== null) {
				return { type: PolygonHitResultType.Vertex, polygonId: selected.id, vertexIndex }
			}
			const edgeInsertIndex = this.findEdgeInsertIndex(selected, point)
			if (edgeInsertIndex !== null) {
				return { type: PolygonHitResultType.Edge, polygonId: selected.id, edgeInsertIndex }
			}
		}

		const topmostFirst = [...collection.getPolygons()].reverse()
		for (const polygon of topmostFirst) {
			if (this.hitsPolygonBody(polygon, point)) {
				return { type: PolygonHitResultType.Select, polygonId: polygon.id }
			}
		}

		return { type: PolygonHitResultType.Background }
	}

	private hitsPolygonBody(polygon: PolygonSelectionModel, point: PolygonPoint): boolean {
		const points = polygon.getPoints()
		const insideBody =
			polygon.kind === 'aarect' ? isPointInAARect(point, points as [PolygonPoint, PolygonPoint]) : isPointInPolygon(point, points)
		return this.findVertexIndex(polygon, point) !== null || this.findEdgeInsertIndex(polygon, point) !== null || insideBody
	}

	private findVertexIndex(polygon: PolygonSelectionModel, point: PolygonPoint): number | null {
		const points = polygon.getPoints()
		for (let i = 0; i < points.length; i++) {
			if (distance(point, points[i]) <= REGION_EDITOR_CONSTANTS.VERTEX_COLLIDER_RADIUS) {
				return i
			}
		}
		return null
	}

	private findEdgeInsertIndex(polygon: PolygonSelectionModel, point: PolygonPoint): number | null {
		// A rect has no edge-insert concept - this also means SplitEdgeInteractionHandler
		// (gated on an Edge hit) naturally never fires for one.
		if (polygon.kind === 'aarect') {
			return null
		}
		const points = polygon.getPoints()
		for (let i = 0; i < points.length; i++) {
			const a = points[i]
			const b = points[(i + 1) % points.length]
			if (distanceToSegment(point, a, b) <= REGION_EDITOR_CONSTANTS.EDGE_HIT_DISTANCE) {
				return i + 1
			}
		}
		return null
	}
}
