import type { EditorController } from '@/editor/main/EditorController'
import type { EditorCommand } from '@/editor/main/EditorCommand'
import type { SerializableStampData, SerializableStampData2 } from '@/editor/types/projectTypes'
import { Vector2 } from 'three'

export class UpdateStampCommand implements EditorCommand {
	private beforeStamp: SerializableStampData2 | null = null
	private afterStamp: SerializableStampData2 | null = null

	constructor(
		private readonly targetStampId: string,
		private readonly updates: Partial<Omit<SerializableStampData, 'id'>>,
		private readonly controller: EditorController
	) {}

	public execute(): void {
		const stamp = this.controller.project.stampList.getStampById(this.targetStampId)
		this.beforeStamp = this.toRuntimeStampData(stamp.serialize())
		const updated: SerializableStampData2 = {
			...stamp.data,
			...(this.updates as Partial<Omit<SerializableStampData2, 'id'>>),
			id: stamp.data.id,
		}
		if (this.updates.stampInfo) {
			const runtimeStampInfo = this.toRuntimeStampData({ ...stamp.serialize(), stampInfo: this.updates.stampInfo }).stampInfo
			updated.stampInfo = { ...stamp.data.stampInfo, ...runtimeStampInfo }
		}
		this.afterStamp = updated
		stamp.updateData(updated)
		this.controller.project.stampList.triggerUpdate()
	}

	public undo(): void {
		if (!this.beforeStamp) {
			throw new Error('[UpdateStampCommand] Cannot undo before execute')
		}
		const stamp = this.controller.project.stampList.getStampById(this.targetStampId)
		stamp.updateData(this.beforeStamp)
		this.controller.project.stampList.triggerUpdate()
	}

	public redo(): void {
		if (!this.afterStamp) {
			throw new Error('[UpdateStampCommand] Cannot redo before execute')
		}
		const stamp = this.controller.project.stampList.getStampById(this.targetStampId)
		stamp.updateData(this.afterStamp)
		this.controller.project.stampList.triggerUpdate()
	}

	private toRuntimeStampData(stampData: SerializableStampData): SerializableStampData2 {
		return {
			...stampData,
			stampInfo: {
				uv: new Vector2(stampData.stampInfo.uv.x, stampData.stampInfo.uv.y),
				sizeX: stampData.stampInfo.sizeX,
				sizeY: stampData.stampInfo.sizeY,
				rotation: stampData.stampInfo.rotation,
			},
		}
	}

	public isUndoable(): boolean {
		return true
	}
}
