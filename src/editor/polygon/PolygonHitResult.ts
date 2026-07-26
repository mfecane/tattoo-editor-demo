export enum PolygonHitResultType {
	Vertex = 'vertex',
	Edge = 'edge',
	Close = 'close',
	Select = 'select',
	Background = 'background',
}

export interface PolygonHitResult {
	type: PolygonHitResultType
	polygonId?: string
	vertexIndex?: number
	edgeInsertIndex?: number
}
