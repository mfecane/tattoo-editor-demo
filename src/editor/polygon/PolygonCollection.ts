import { PolygonPoint } from '@/editor/polygon/PolygonPoint'
import { PolygonSelectionModel } from '@/editor/polygon/PolygonSelectionModel'
import { RegionKind } from '@/editor/polygon/RegionShape'
import { v7 as uuid } from 'uuid'

/**
 * Registry of polygons on the canvas plus which one (if any) is selected.
 * At most one polygon is ever open (unclosed) at a time - that's the one
 * currently being drawn.
 */
export class PolygonCollection {
	private polygons: PolygonSelectionModel[] = []

	private selectedId: string | null = null

	public getPolygons(): PolygonSelectionModel[] {
		return this.polygons
	}

	public getPolygon(id: string): PolygonSelectionModel | null {
		return this.polygons.find((polygon) => polygon.id === id) ?? null
	}

	public getOpenPolygon(): PolygonSelectionModel | null {
		return this.polygons.find((polygon) => !polygon.isClosed()) ?? null
	}

	public getSelectedId(): string | null {
		return this.selectedId
	}

	public getSelectedPolygon(): PolygonSelectionModel | null {
		return this.selectedId ? this.getPolygon(this.selectedId) : null
	}

	public createPolygon(kind: RegionKind = 'polygon'): PolygonSelectionModel {
		const polygon = new PolygonSelectionModel(uuid(), kind)
		this.polygons.push(polygon)
		return polygon
	}

	/** Seeds an already-closed region (e.g. restored from storage) without going through the draw flow. */
	public loadPolygon(points: PolygonPoint[], kind: RegionKind = 'polygon'): PolygonSelectionModel {
		const polygon = this.createPolygon(kind)
		for (const point of points) {
			polygon.addPoint(point)
		}
		polygon.close()
		return polygon
	}

	public select(id: string): void {
		if (!this.getPolygon(id)) {
			return
		}
		this.selectedId = id
	}

	public deselectAll(): void {
		this.selectedId = null
	}

	public removePolygon(id: string): void {
		this.polygons = this.polygons.filter((polygon) => polygon.id !== id)
		if (this.selectedId === id) {
			this.selectedId = null
		}
	}
}
