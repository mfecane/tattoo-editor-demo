import { PolygonPoint } from '@/editor/polygon/PolygonPoint'

export interface AARectBounds {
	minX: number
	minY: number
	maxX: number
	maxY: number
}

/** The 2 stored points are the literal drag corners - the rect is always their bounding box. */
export function getAARectBounds(points: [PolygonPoint, PolygonPoint]): AARectBounds {
	const [a, b] = points
	return {
		minX: Math.min(a.x, b.x),
		minY: Math.min(a.y, b.y),
		maxX: Math.max(a.x, b.x),
		maxY: Math.max(a.y, b.y),
	}
}

/** Top-left, top-right, bottom-right, bottom-left, in winding order - for rendering the actual outline. */
export function getAARectFourCorners(points: [PolygonPoint, PolygonPoint]): PolygonPoint[] {
	const { minX, minY, maxX, maxY } = getAARectBounds(points)
	return [
		{ x: minX, y: minY },
		{ x: maxX, y: minY },
		{ x: maxX, y: maxY },
		{ x: minX, y: maxY },
	]
}

export function isPointInAARect(point: PolygonPoint, points: [PolygonPoint, PolygonPoint]): boolean {
	const { minX, minY, maxX, maxY } = getAARectBounds(points)
	return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY
}
