import type { EditorCommand } from '@/editor/main/EditorCommand'
import type { EditorController } from '@/editor/main/EditorController'
import type { SerializableStampData } from '@/editor/types/projectTypes'

export class RemoveStampCommand implements EditorCommand {
	private removedStamp: SerializableStampData | null = null
	private previousSelectedStampId: string | null = null

	public constructor(
		private readonly index: number,
		private readonly controller: EditorController
	) {}

	public execute(): void {
		const stamps = this.controller.project.stampList.getStamps()
		if (this.index < 0 || this.index >= stamps.length) {
			throw new Error(
				`[RemoveStampCommand] Invalid stamp index: ${this.index}. Valid range: 0-${stamps.length - 1}`
			)
		}
		this.removedStamp = stamps[this.index].serialize()
		this.previousSelectedStampId = this.controller.getSelectedStampId()
		this.controller.project.stampList.removeStamp(this.index)
		this.updateSelectedStampId(this.removedStamp.id)
	}

	public undo(): void {
		if (!this.removedStamp) {
			throw new Error('[RemoveStampCommand] Cannot undo before execute')
		}
		const restoredStamp = this.controller.project.stampFactory.createFromSerializable(this.removedStamp)
		this.controller.project.stampList.insertStamp(this.index, restoredStamp)
		this.controller.setSelectedStampId(this.previousSelectedStampId)
	}

	public redo(): void {
		if (!this.removedStamp) {
			throw new Error('[RemoveStampCommand] Cannot redo before execute')
		}
		const stamps = this.controller.project.stampList.getStamps()
		const removeIndex = stamps.findIndex((stamp) => stamp.data.id === this.removedStamp!.id)
		if (removeIndex === -1) return
		this.controller.project.stampList.removeStampById(this.removedStamp.id)
		this.updateSelectedStampId(this.removedStamp.id)
	}

	private updateSelectedStampId(removedStampId: string): void {
		if (this.controller.getSelectedStampId() === removedStampId) {
			this.controller.setSelectedStampId(null)
		}
	}

	public isUndoable(): boolean {
		return true
	}
}
