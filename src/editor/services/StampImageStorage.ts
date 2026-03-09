import { StampImageItem } from '@/editor/services/StampImageItem'
import { ImageSource } from '@/editor/types/projectTypes'
import { Optional } from 'typescript-optional'

export class StampImageStorage {
	private images: Map<string, StampImageItem> = new Map()

	public constructor(
		private readonly projectId: string,
		private readonly designId: string
	) {}

	public createImage(hash: string, source: ImageSource) {
		const item = new StampImageItem(source, hash, this.projectId, this.designId)
		this.images.set(hash, item)
		return item
	}

	public getImage(hash: string): StampImageItem {
		return Optional.ofNullable(this.images.get(hash)).orElseThrow(
			() => new Error('[StampImageStorage] Image not found')
		)
	}
}
