import { getAARectFourCorners } from '@/editor/lib/utils/AARectGeometry'
import { PolygonPoint } from '@/editor/polygon/PolygonPoint'
import { RegionKind } from '@/editor/polygon/RegionShape'

/** An aarect's outline is its 4 derived corners, not the 2 literal stored drag-corners. */
export function getRegionOutlinePoints(kind: RegionKind, points: PolygonPoint[]): PolygonPoint[] {
	return kind === 'aarect' ? getAARectFourCorners(points as [PolygonPoint, PolygonPoint]) : points
}
