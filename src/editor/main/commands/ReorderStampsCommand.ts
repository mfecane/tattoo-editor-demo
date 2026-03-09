import type { EditorController } from '@/editor/main/EditorController'
import type { EditorCommand } from '@/editor/main/EditorCommand'
import type { RuntimeStamp } from '@/editor/main/RuntimeStamp'

export class ReorderStampsCommand implements EditorCommand {
	private beforeStamps: RuntimeStamp[] | null = null
	private beforeSelectedStampId: string | null = null
	private afterStamps: RuntimeStamp[] | null = null
	private afterSelectedStampId: string | null = null

	public constructor(
		private readonly newOrder: number[],
		private readonly controller: EditorController
	) {}

	public execute(): void {
		const stamps = this.controller.project.stampList.getStamps()
		this.beforeStamps = stamps
		const reordered = this.newOrder
			.map((i) => stamps[i])
			.filter((s): s is NonNullable<typeof s> => s != null)
		this.beforeSelectedStampId = this.controller.getSelectedStampId()
		this.controller.project.stampList.setStamps(reordered)
		this.afterStamps = reordered
		this.afterSelectedStampId = this.controller.getSelectedStampId()
	}

	public undo(): void {
		if (!this.beforeStamps) {
			throw new Error('[ReorderStampsCommand] Cannot undo before execute')
		}
		this.controller.project.stampList.setStamps(this.beforeStamps)
		this.controller.setSelectedStampId(this.beforeSelectedStampId)
	}

	public redo(): void {
		if (!this.afterStamps) {
			throw new Error('[ReorderStampsCommand] Cannot redo before execute')
		}
		this.controller.project.stampList.setStamps(this.afterStamps)
		this.controller.setSelectedStampId(this.afterSelectedStampId)
	}

	public isUndoable(): boolean {
		return true
	}
}
