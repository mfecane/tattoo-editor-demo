import { REGION_EDITOR_CONSTANTS } from '@/editor/constants'
import { getRegionOutlinePoints } from '@/editor/lib/utils/RegionOutline'
import { RegionEditorController, PolygonSnapshot } from '@/editor/polygon/RegionEditorController'
import { Container, Graphics } from 'pixi.js'

/**
 * Draws every polygon's outline, fill and vertex handles - selected vs
 * unselected polygons get distinct color/weight so selection state is
 * always visible. Knows nothing about interaction or hit testing; it
 * only reads controller.getState() and redraws on change.
 */
export class PolygonRenderer {
	private readonly polygonGraphics: Graphics = new Graphics()
	private readonly vertexGraphics: Graphics = new Graphics()
	private unsubscribe: (() => void) | null = null

	public init(stage: Container, controller: RegionEditorController): void {
		stage.addChild(this.polygonGraphics)
		stage.addChild(this.vertexGraphics)

		this.unsubscribe = controller.subscribe(() => this.redraw(controller))
		this.redraw(controller)
	}

	public destroy(): void {
		this.unsubscribe?.()
		this.unsubscribe = null
		this.polygonGraphics.destroy()
		this.vertexGraphics.destroy()
	}

	private redraw(controller: RegionEditorController): void {
		this.polygonGraphics.clear()
		this.vertexGraphics.clear()

		for (const polygon of controller.getState().polygons) {
			this.drawPolygon(polygon)
		}
	}

	private drawPolygon(polygon: PolygonSnapshot): void {
		if (polygon.points.length === 0) {
			return
		}

		const c = REGION_EDITOR_CONSTANTS
		const strokeColor = polygon.selected ? c.SELECTED_STROKE_COLOR : c.UNSELECTED_STROKE_COLOR
		const strokeWidth = polygon.selected ? c.SELECTED_STROKE_WIDTH : c.UNSELECTED_STROKE_WIDTH
		const fillColor = polygon.selected ? c.SELECTED_FILL_COLOR : c.UNSELECTED_FILL_COLOR
		const fillAlpha = polygon.selected ? c.SELECTED_FILL_ALPHA : c.UNSELECTED_FILL_ALPHA
		const vertexColor = polygon.selected ? c.SELECTED_VERTEX_COLOR : c.UNSELECTED_VERTEX_COLOR
		const vertexRadius = polygon.selected ? c.SELECTED_VERTEX_RADIUS : c.UNSELECTED_VERTEX_RADIUS

		const outlinePoints = getRegionOutlinePoints(polygon.kind, polygon.points)

		this.polygonGraphics.moveTo(outlinePoints[0].x, outlinePoints[0].y)
		for (let i = 1; i < outlinePoints.length; i++) {
			this.polygonGraphics.lineTo(outlinePoints[i].x, outlinePoints[i].y)
		}
		if (polygon.closed) {
			this.polygonGraphics.closePath()
			this.polygonGraphics.fill({ color: fillColor, alpha: fillAlpha })
		}
		this.polygonGraphics.stroke({ width: strokeWidth, color: strokeColor })

		for (const point of polygon.points) {
			// Invisible hit collider, deliberately larger than the visible dot below.
			this.vertexGraphics.circle(point.x, point.y, c.VERTEX_COLLIDER_RADIUS)
			this.vertexGraphics.fill({ color: 0x000000, alpha: 0 })

			this.vertexGraphics.circle(point.x, point.y, vertexRadius)
			this.vertexGraphics.fill({ color: vertexColor })
			this.vertexGraphics.stroke({ width: 2, color: strokeColor })
		}
	}
}
