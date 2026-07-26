import { REGION_EDITOR_CONSTANTS } from '@/editor/constants'
import { PolygonPoint } from '@/editor/polygon/PolygonPoint'
import { RegionKind } from '@/editor/polygon/RegionShape'

/**
 * Pure data model for a region selection - either a freeform lasso polygon
 * or an axis-aligned rect (whose 2 stored points are its literal drag
 * corners; the rect is always their bounding box). Holds no rendering or
 * interaction concerns - only the vertex list, kind, and closed/open state.
 */
export class PolygonSelectionModel {
	private points: PolygonPoint[] = []

	private closed: boolean = false

	public constructor(
		public readonly id: string,
		public readonly kind: RegionKind = 'polygon'
	) {}

	public getPoints(): PolygonPoint[] {
		return this.points.map((point) => ({ ...point }))
	}

	public isClosed(): boolean {
		return this.closed
	}

	public addPoint(point: PolygonPoint): void {
		this.points.push({ ...point })
	}

	public insertPoint(index: number, point: PolygonPoint): void {
		this.points.splice(index, 0, { ...point })
	}

	public moveVertex(index: number, point: PolygonPoint): void {
		if (!this.points[index]) {
			return
		}
		this.points[index] = { ...point }
	}

	public canRemoveVertex(): boolean {
		return this.points.length > REGION_EDITOR_CONSTANTS.MIN_VERTICES
	}

	public removeVertex(index: number): boolean {
		if (!this.points[index] || !this.canRemoveVertex()) {
			return false
		}
		this.points.splice(index, 1)
		return true
	}

	public canClose(): boolean {
		return this.points.length >= REGION_EDITOR_CONSTANTS.MIN_VERTICES
	}

	public close(): void {
		this.closed = true
	}
}
