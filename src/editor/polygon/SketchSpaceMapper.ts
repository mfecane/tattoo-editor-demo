import { PolygonPoint } from '@/editor/polygon/PolygonPoint'

/**
 * Converts between Pixi canvas-pixel coordinates and normalized 0..1
 * sketch-space coordinates, using the fitted sprite's bounds within the
 * canvas. Since the sprite is scaled uniformly (aspect-preserving), the
 * 0..1 fraction along its width/height is stable regardless of canvas
 * size - that's what gets persisted, not raw pixel positions.
 */
export class SketchSpaceMapper {
	public constructor(
		private readonly originX: number,
		private readonly originY: number,
		private readonly width: number,
		private readonly height: number
	) {}

	public toNormalized(point: PolygonPoint): PolygonPoint {
		return {
			x: (point.x - this.originX) / this.width,
			y: (point.y - this.originY) / this.height,
		}
	}

	public fromNormalized(point: PolygonPoint): PolygonPoint {
		return {
			x: this.originX + point.x * this.width,
			y: this.originY + point.y * this.height,
		}
	}
}
