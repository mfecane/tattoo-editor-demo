import { EDITOR_CONSTANTS } from '@/editor/lib/constants'
import type { CanvasTexture } from 'three'
import { RepeatWrapping, CanvasTexture as ThreeCanvasTexture } from 'three'

export class ImageLoadingService {
	private canvas: HTMLCanvasElement
	private texture: CanvasTexture

	public constructor() {
		this.canvas = document.createElement('canvas')
		this.canvas.width = EDITOR_CONSTANTS.CANVAS_SIZE
		this.canvas.height = EDITOR_CONSTANTS.CANVAS_SIZE

		const ctx = this.canvas.getContext('2d')
		if (ctx) {
			ctx.fillStyle = '#ffffff'
			ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
		}

		this.texture = new ThreeCanvasTexture(this.canvas)
		this.texture.wrapS = RepeatWrapping
		this.texture.wrapT = RepeatWrapping
		this.texture.repeat.set(1, 1)
		this.texture.needsUpdate = true
	}

	/**
	 * Gets the current canvas
	 */
	public getCanvas(): HTMLCanvasElement | null {
		return this.canvas
	}

	/**
	 * Gets the current texture
	 */
	public getTexture(): CanvasTexture | null {
		return this.texture
	}

	/**
	 * Cleanup resources
	 */
	public dispose(): void {
		if (this.texture) {
			this.texture.dispose()
		}
		if (this.canvas) {
			const ctx = this.canvas.getContext('2d')
			if (ctx) {
				ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
			}
		}
	}

	/**
	 * Loads an image from URL with crossOrigin settings
	 */
	public loadImage(imageUrl: string): Promise<HTMLImageElement> {
		return new Promise((resolve, reject) => {
			const img = new Image()
			img.crossOrigin = 'anonymous'

			img.onload = () => resolve(img)
			img.onerror = (error) => {
				const errorMessage = `Failed to load image: ${imageUrl}`
				reject(new Error(errorMessage))
			}

			img.src = imageUrl
		})
	}

	/**
	 * Updates canvas with loaded image
	 */
	public updateCanvasWithImage(image: HTMLImageElement): void {
		if (!this.canvas) {
			throw new Error('[ImageLoadingService] Canvas not initialized')
		}

		const ctx = this.canvas.getContext('2d')
		if (!ctx) {
			throw new Error('[ImageLoadingService] Failed to get canvas 2D context')
		}

		// Clear and fill canvas with white background
		ctx.fillStyle = '#ffffff'
		ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

		// Update texture if available
		if (this.texture) {
			this.texture.needsUpdate = true
		}
	}

	/**
	 * Handles complete image loading process
	 */
	public async loadAndUpdateImage(imageUrl: string): Promise<HTMLImageElement> {
		const image = await this.loadImage(imageUrl)
		this.updateCanvasWithImage(image)
		return image
	}
}
