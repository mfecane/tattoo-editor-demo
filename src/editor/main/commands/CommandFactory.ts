import { AddStampCommand } from '@/editor/main/commands/AddStampCommand'
import { ClearStampsCommand } from '@/editor/main/commands/ClearStampsCommand'
import { RemoveStampCommand } from '@/editor/main/commands/RemoveStampCommand'
import { ReorderStampsCommand } from '@/editor/main/commands/ReorderStampsCommand'
import { SetSelectedStampIdCommand } from '@/editor/main/commands/SetSelectedStampIdCommand'
import { UpdateStampCommand } from '@/editor/main/commands/UpdateStampCommand'
import { EditorCommand } from '@/editor/main/EditorCommand'
import { EditorController } from '@/editor/main/EditorController'
import type { SerializableStampData } from '@/editor/types/projectTypes'

export class CommandFactory {
	public constructor(private readonly controller: EditorController) {}

	public createAddCommand(stampData: Omit<SerializableStampData, 'id'> & { id?: string }): EditorCommand {
		return new AddStampCommand(stampData, this.controller)
	}

	public createRemoveCommand(index: number): EditorCommand {
		return new RemoveStampCommand(index, this.controller)
	}

	public createUpdateCommand(stampId: string, updates: Partial<Omit<SerializableStampData, 'id'>>): EditorCommand {
		return new UpdateStampCommand(stampId, updates, this.controller)
	}

	public createReorderCommand(newOrder: number[]): EditorCommand {
		return new ReorderStampsCommand(newOrder, this.controller)
	}

	public createClearStampsCommand(): EditorCommand {
		return new ClearStampsCommand(this.controller)
	}

	public createSetSelectedStampIdCommand(stampId: string | null): EditorCommand {
		return new SetSelectedStampIdCommand(stampId, this.controller)
	}
}
