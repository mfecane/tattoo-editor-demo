export interface EditorCommand {
	execute(): void
	undo?(): void
	redo?(): void
	isUndoable?(): boolean
}
