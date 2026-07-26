export enum PolygonToolId {
	Select = 'select',
	DrawPolygon = 'draw-polygon',
	DrawRect = 'draw-rect',
}

export interface IPolygonTool {
	readonly id: PolygonToolId

	enterTool(): void

	exitTool(): void
}
