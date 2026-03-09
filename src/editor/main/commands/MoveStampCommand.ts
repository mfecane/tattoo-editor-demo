import type { EditorCommand } from '@/editor/main/EditorCommand'
import type { EditorController } from '@/editor/main/EditorController'
import type { SerializableStampData, SerializableStampData2, StampInfo } from '@/editor/types/projectTypes'
import { Vector2 } from 'three'

export class MoveStampCommand implements EditorCommand {
	private targetStampId: string | null = null
	private beforeStamp: SerializableStampData | null = null
	private afterStamp: SerializableStampData2 | null = null

	public constructor(
		private readonly id: string,
		private readonly updatedStampInfo: StampInfo,
		private readonly controller: EditorController
	) {}

	public execute(): void {
		const stamp = this.controller.project.stampList.getStampById(this.id)
		this.targetStampId = stamp.data.id
		this.beforeStamp = stamp.serialize()
		const updated: SerializableStampData2 = {
			...stamp.data,
			stampInfo: { ...stamp.data.stampInfo, ...this.updatedStampInfo },
			id: stamp.data.id,
		}
		this.afterStamp = updated
		stamp.updateData(updated)
		this.controller.project.stampList.triggerUpdate()
	}

	public undo(): void {
		if (!this.targetStampId || !this.beforeStamp) {
			throw new Error('[MoveStampCommand] Cannot undo before execute')
		}
		const stamp = this.controller.project.stampList.getStampById(this.targetStampId)
		if (!stamp) return
		const deserialized: SerializableStampData2 = {
			...this.beforeStamp,
			stampInfo: {
				uv: new Vector2(this.beforeStamp.stampInfo.uv.x, this.beforeStamp.stampInfo.uv.y),
				sizeX: this.beforeStamp.stampInfo.sizeX,
				sizeY: this.beforeStamp.stampInfo.sizeY,
				rotation: this.beforeStamp.stampInfo.rotation,
			},
		}
		stamp.updateData(deserialized)
		this.controller.project.stampList.triggerUpdate()
	}

	public redo(): void {
		if (!this.targetStampId || !this.afterStamp) {
			throw new Error('[MoveStampCommand] Cannot redo before execute')
		}
		const stamp = this.controller.project.stampList.getStampById(this.targetStampId)
		if (!stamp) return
		stamp.updateData(this.afterStamp)
		this.controller.project.stampList.triggerUpdate()
	}

	public isUndoable(): boolean {
		return true
	}
}
