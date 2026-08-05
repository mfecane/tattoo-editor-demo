export enum EditorToolId {
	Select = 'select',
	Transform = 'transform',
	Placement = 'placement',
}

export interface IEditorTool {
	readonly id: EditorToolId

	enterTool(): void

	exitTool(): void
}
