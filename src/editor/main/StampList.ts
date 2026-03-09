import { RuntimeStamp } from '@/editor/main/RuntimeStamp'
import { SerializableStampData } from '@/editor/types/projectTypes'
import { Optional } from 'typescript-optional'

export class StampList {
	private stamps: RuntimeStamp[] = []

	public onUpdateCallbacks: Set<() => Promise<void>> = new Set()

	public onRenderRequiredCallbacks: Set<() => Promise<void>> = new Set()

	public constructor() {}

	public addStamp(stamp: RuntimeStamp): void {
		this.stamps.push(stamp)
		void this.update()
	}

	public insertStamp(index: number, stamp: RuntimeStamp): void {
		this.stamps.splice(index, 0, stamp)
		void this.update(true)
	}

	public removeStamp(index: number): void {
		const stamp = this.stamps[index]
		if (stamp) {
			stamp.destroy()
		}
		this.stamps.splice(index, 1)
		void this.update(true)
	}

	public removeStampById(id: string): void {
		const index = this.stamps.findIndex((stamp) => stamp.data.id === id)
		if (index !== -1) {
			this.stamps[index].destroy()
			this.stamps.splice(index, 1)
			void this.update(true)
		}
	}

	public clear(): void {
		for (const stamp of this.stamps) {
			stamp.destroy()
		}
		this.stamps = []
	}

	/**
	 * @deprecated avoid
	 */
	public setStamps(stamps: RuntimeStamp[]): void {
		const newSet = new Set(stamps)
		for (const stamp of this.stamps) {
			if (!newSet.has(stamp)) {
				stamp.destroy()
			}
		}
		this.stamps = stamps
		void this.update()
	}

	public triggerUpdate(): void {
		void this.update()
	}

	private async update(forceRender: boolean = false): Promise<void> {
		// immediate updates
		for (const callback of this.onUpdateCallbacks) {
			await callback()
		}

		let renderRequired = false
		await Promise.all(
			this.stamps.map(async (stamp) => {
				if (stamp.dirty) {
					renderRequired = true
					await stamp.update()
				}
			})
		)

		// deferred render updates
		if (renderRequired || forceRender) {
			for (const callback of this.onRenderRequiredCallbacks) {
				await callback()
			}
		}
	}

	public getStampById(id: string): RuntimeStamp {
		return Optional.ofNullable(this.stamps.find((stamp) => stamp.data.id === id)).orElseThrow(
			() => new Error(`[StampList] Stamp with id ${id} not found`)
		)
	}

	public getStampByIndex(index: number): RuntimeStamp {
		return Optional.ofNullable(this.stamps[index]).orElseThrow(
			() => new Error(`[StampList] Stamp with index ${index} not found`)
		)
	}

	public getStamps(): RuntimeStamp[] {
		return [...this.stamps]
	}

	public getSerializedStamps(): SerializableStampData[] {
		return this.stamps.map((stamp) => stamp.serialize())
	}

	/**
	 * @param callback - The callback to add to the set of callbacks.
	 * @returns A function to remove the callback from the set of callbacks.
	 */
	public setOnRenderRequiredCallback(callback: () => Promise<void>): () => void {
		this.onRenderRequiredCallbacks.add(callback)
		return () => this.onRenderRequiredCallbacks.delete(callback)
	}

	public setOnUpdateCallback(callback: () => Promise<void>): () => void {
		this.onUpdateCallbacks.add(callback)
		return () => this.onUpdateCallbacks.delete(callback)
	}
}
