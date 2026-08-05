export type CornerHandleId = 'corner-tl' | 'corner-tr' | 'corner-bl' | 'corner-br'
export type EdgeHandleId = 'edge-left' | 'edge-right' | 'edge-top' | 'edge-bottom'
export type TransformHandleId = CornerHandleId | EdgeHandleId

/** Which direction (in the widget's local u/v tangent axes) dragging a given handle away from center should grow. */
export interface HandleAxisSign {
	uSign: 1 | -1 | 0
	vSign: 1 | -1 | 0
}

export const CORNER_HANDLE_SIGNS: Record<CornerHandleId, HandleAxisSign> = {
	'corner-tl': { uSign: -1, vSign: 1 },
	'corner-tr': { uSign: 1, vSign: 1 },
	'corner-bl': { uSign: -1, vSign: -1 },
	'corner-br': { uSign: 1, vSign: -1 },
}

export const EDGE_HANDLE_SIGNS: Record<EdgeHandleId, HandleAxisSign> = {
	'edge-left': { uSign: -1, vSign: 0 },
	'edge-right': { uSign: 1, vSign: 0 },
	'edge-top': { uSign: 0, vSign: 1 },
	'edge-bottom': { uSign: 0, vSign: -1 },
}

export function isEdgeHandle(id: TransformHandleId): id is EdgeHandleId {
	return id in EDGE_HANDLE_SIGNS
}
