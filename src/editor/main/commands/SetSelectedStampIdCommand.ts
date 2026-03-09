import type { EditorCommand } from '@/editor/main/EditorCommand'
import type { EditorController } from '@/editor/main/EditorController'

export class SetSelectedStampIdCommand implements EditorCommand {
	public constructor(
		private readonly stampId: string | null,
		private readonly controller: EditorController
	) {}

	public execute(): void {
		this.controller.setSelectedStampId(this.stampId)
	}

	public isUndoable(): boolean {
		return false
	}
}
