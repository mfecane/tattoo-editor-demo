export enum EditorToolId {
	Select = 'select',
	Move = 'move',
	Rotate = 'rotate',
	Scale = 'scale',
	Brush = 'brush',
}

export interface IEditorTool {
	readonly id: EditorToolId

	enterTool(): void

	exitTool(): void
}
