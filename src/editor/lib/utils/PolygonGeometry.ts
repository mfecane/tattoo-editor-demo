import { PolygonPoint } from '@/editor/polygon/PolygonPoint'

export interface PointsBounds {
	minX: number
	minY: number
	maxX: number
	maxY: number
}

export function getPointsBounds(points: PolygonPoint[]): PointsBounds {
	let minX = points[0].x
	let minY = points[0].y
	let maxX = points[0].x
	let maxY = points[0].y

	for (const point of points) {
		minX = Math.min(minX, point.x)
		minY = Math.min(minY, point.y)
		maxX = Math.max(maxX, point.x)
		maxY = Math.max(maxY, point.y)
	}

	return { minX, minY, maxX, maxY }
}

export function distance(a: PolygonPoint, b: PolygonPoint): number {
	return Math.hypot(a.x - b.x, a.y - b.y)
}

export function distanceToSegment(p: PolygonPoint, a: PolygonPoint, b: PolygonPoint): number {
	const dx = b.x - a.x
	const dy = b.y - a.y
	const lengthSquared = dx * dx + dy * dy
	if (lengthSquared === 0) {
		return distance(p, a)
	}
	const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared))
	return distance(p, { x: a.x + t * dx, y: a.y + t * dy })
}

export function isPointInPolygon(point: PolygonPoint, polygon: PolygonPoint[]): boolean {
	let inside = false
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		const a = polygon[i]
		const b = polygon[j]
		const crossesRay = a.y > point.y !== b.y > point.y
		if (crossesRay && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
			inside = !inside
		}
	}
	return inside
}

/** Shoelace-formula area-weighted centroid - correct for asymmetric/concave shapes, unlike a plain vertex average. */
export function computeAreaWeightedCentroid(points: PolygonPoint[]): PolygonPoint {
	let area = 0
	let cx = 0
	let cy = 0

	for (let i = 0; i < points.length; i++) {
		const p0 = points[i]
		const p1 = points[(i + 1) % points.length]
		const cross = p0.x * p1.y - p1.x * p0.y
		area += cross
		cx += (p0.x + p1.x) * cross
		cy += (p0.y + p1.y) * cross
	}
	area *= 0.5

	if (Math.abs(area) < 1e-9) {
		const n = points.length
		return {
			x: points.reduce((sum, p) => sum + p.x, 0) / n,
			y: points.reduce((sum, p) => sum + p.y, 0) / n,
		}
	}

	return { x: cx / (6 * area), y: cy / (6 * area) }
}
