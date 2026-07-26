import { PolygonPoint } from '@/editor/polygon/PolygonPoint'

export type RegionKind = 'polygon' | 'aarect'

/**
 * A region cropped from a sketch, in normalized 0..1 sketch-space.
 * An aarect is defined by its 2 literal drag-endpoint corners - the rect
 * is always the bounding box of those 2 points, so no separate 4-corner
 * representation or axis-alignment constraint is needed.
 */
export type RegionShape =
	| { kind: 'polygon'; points: PolygonPoint[] }
	| { kind: 'aarect'; points: [PolygonPoint, PolygonPoint] }
