export enum EditorToolId {
	Select = 'select',
	Move = 'move',
	Rotate = 'rotate',
	Scale = 'scale',
	Placement = 'placement',
}

export interface IEditorTool {
	readonly id: EditorToolId

	enterTool(): void

	exitTool(): void

	/**
	 * Whether this tool's current target (e.g. the selected placed mesh) is still
	 * a valid thing for it to be operating on. Checked by EditorController after
	 * every state change; when it returns false the controller forces the tool
	 * back to Select, tearing down any widget via the tool's own exitTool(). Tools
	 * with no notion of an invalidatable target (Select, Placement) omit this.
	 */
	isTargetValid?(): boolean
}
