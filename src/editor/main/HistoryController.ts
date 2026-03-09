import type { EditorCommand } from '@/editor/main/EditorCommand'
import type { EditorController } from '@/editor/main/EditorController'

const MAX_HISTORY_SIZE = 50

export interface HistoryState {
	canUndo: boolean
	canRedo: boolean
}

export class HistoryController {
	private readonly undoStack: EditorCommand[] = []
	private readonly redoStack: EditorCommand[] = []
	private readonly subscribers: Set<() => void> = new Set()
	private state: HistoryState = { canUndo: false, canRedo: false }

	public constructor(private readonly controller: EditorController) {}

	public execute(command: EditorCommand): void {
		command.execute()
		if (command.isUndoable?.()) {
			this.push(command)
		}
	}

	public push(command: EditorCommand): void {
		this.undoStack.push(command)
		if (this.undoStack.length > MAX_HISTORY_SIZE) {
			this.undoStack.shift()
		}
		this.redoStack.length = 0
		this.recomputeStateAndNotify()
	}

	public undo(): boolean {
		const command = this.undoStack.pop()
		if (!command || !command.undo) {
			return false
		}
		command.undo()
		this.redoStack.push(command)
		this.recomputeStateAndNotify()
		return true
	}

	public redo(): boolean {
		const command = this.redoStack.pop()
		if (!command) {
			return false
		}
		if (command.redo) {
			command.redo()
		} else {
			command.execute()
		}
		this.undoStack.push(command)
		this.recomputeStateAndNotify()
		return true
	}

	public canUndo(): boolean {
		return this.undoStack.length > 0
	}

	public canRedo(): boolean {
		return this.redoStack.length > 0
	}

	public clear(): void {
		this.undoStack.length = 0
		this.redoStack.length = 0
		this.recomputeStateAndNotify()
	}

	public subscribe(callback: () => void): () => void {
		this.subscribers.add(callback)
		return () => this.subscribers.delete(callback)
	}

	public getState(): HistoryState {
		return this.state
	}

	private recomputeStateAndNotify(): void {
		const nextState: HistoryState = {
			canUndo: this.undoStack.length > 0,
			canRedo: this.redoStack.length > 0,
		}
		if (nextState.canUndo === this.state.canUndo && nextState.canRedo === this.state.canRedo) {
			return
		}
		this.state = nextState
		this.notifySubscribers()
	}

	private notifySubscribers(): void {
		for (const callback of this.subscribers) {
			callback()
		}
	}
}
