import { EditorCommand } from '@/editor/main/EditorCommand'
import { EditorController } from '@/editor/main/EditorController'
import { RuntimeStamp } from '@/editor/main/RuntimeStamp'
import { SerializableStampData } from '@/editor/types/projectTypes'
import { v7 as uuid } from 'uuid'

export class AddStampCommand implements EditorCommand {
	private createdStamp: RuntimeStamp | null = null

	constructor(
		private readonly stampData: Omit<SerializableStampData, 'id'> & { id?: string },
		private readonly controller: EditorController
	) {}

	public execute(): void {
		console.groupCollapsed('AddStampCommand')
		console.trace()
		console.groupEnd()
		//@ts-expect-error fuck off, typescript
		this.createdStamp = this.controller.project.stampFactory.createNew({
			...this.stampData,
			id: uuid(),
		})
		this.controller.project.stampList.addStamp(this.createdStamp)
	}

	public undo(): void {
		if (!this.createdStamp) {
			throw new Error('[AddStampCommand] Cannot undo before execute')
		}
		this.controller.project.stampList.removeStampById(this.createdStamp.data.id)
	}

	public redo(): void {
		if (!this.createdStamp) {
			throw new Error('[AddStampCommand] Cannot redo before execute')
		}
		this.controller.project.stampList.addStamp(this.createdStamp)
	}

	public isUndoable(): boolean {
		return true
	}
}
