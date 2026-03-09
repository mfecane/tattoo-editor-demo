import { ImageSource } from '@/editor/types/projectTypes'
import { resolveImageUrl } from '@/lib/imagePathResolver'

export class StampImageItem {
	public image: HTMLImageElement | null = null

	public url: string | null = null

	private promise: Promise<HTMLImageElement> | null = null

	public constructor(
		private readonly source: ImageSource,
		private readonly hash: string,
		private readonly projectId: string,
		private readonly designId: string
	) {
		this.url = this.resolveImagePath()
		this.promise = this.loadImage()
	}

	public async getImageElement(): Promise<HTMLImageElement> {
		if (this.image) {
			return this.image
		}
		if (!this.promise) {
			throw new Error('[StampImageItem] Promise is not initialized')
		}
		return await this.promise
	}

	private async loadImage(): Promise<HTMLImageElement> {
		if (!this.url) {
			throw new Error('[StampImageItem] Image URL is required')
		}
		const url: string = this.url
		const image = new Image()
		image.crossOrigin = 'anonymous'
		await new Promise<void>((resolve, reject) => {
			image.onload = () => resolve()
			image.onerror = () => reject(new Error(`[RuntimeStamp] Failed to load image: ${this.url}`))
			image.src = url
		})
		return image
	}

	private resolveImagePath(): string {
		if (this.isDirectImageUrl(this.hash)) {
			return this.hash
		}
		if (this.source === 'project') {
			if (!this.projectId) {
				throw new Error('[EditorController] Project ID is required for project image hydration')
			}
			return resolveImageUrl(this.hash, `designs3d/${this.projectId}`, 'original')
		}
		if (!this.designId) {
			throw new Error('[EditorController] Design ID is required for design image hydration')
		}
		return resolveImageUrl(this.hash, `designs/${this.designId}`, 'original')
	}

	private isDirectImageUrl(value: string): boolean {
		return (
			value.includes('/') ||
			value.startsWith('/') ||
			value.startsWith('blob:') ||
			value.startsWith('data:') ||
			value.startsWith('http://') ||
			value.startsWith('https://')
		)
	}
}
