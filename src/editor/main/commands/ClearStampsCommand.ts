import { EditorCommand } from '@/editor/main/EditorCommand'
import { EditorController } from '@/editor/main/EditorController'
import { RuntimeStamp } from '@/editor/main/RuntimeStamp'

export class ClearStampsCommand implements EditorCommand {
	private previousStamps: RuntimeStamp[] | null = null
	private previousSelectedStampId: string | null = null
	public constructor(private readonly controller: EditorController) {}

	public execute(): void {
		this.previousStamps = this.controller.project.stampList.getStamps()
		this.previousSelectedStampId = this.controller.getSelectedStampId()
		this.controller.project.stampList.setStamps([])
		this.controller.setSelectedStampId(null)
	}

	public undo(): void {
		if (!this.previousStamps) {
			throw new Error('[ClearStampsCommand] Cannot undo before execute')
		}
		this.controller.project.stampList.setStamps(this.previousStamps)
		this.controller.setSelectedStampId(this.previousSelectedStampId)
	}

	public redo(): void {
		this.controller.project.stampList.setStamps([])
		this.controller.setSelectedStampId(null)
	}

	public isUndoable(): boolean {
		return true
	}
}
