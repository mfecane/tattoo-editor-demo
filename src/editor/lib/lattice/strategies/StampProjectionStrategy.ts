import { Vector2 } from 'three'
import type { UpdateLatticeStrategy } from '../UpdateLatticeStrategy'

/**
 * Strategy for standard stamp projection type.
 * Allows all transformations with minimal constraints.
 */
export class StampProjectionStrategy implements UpdateLatticeStrategy {
	canMoveX(): boolean {
		return true
	}

	canMoveY(): boolean {
		return true
	}

	canMoveCenter(): boolean {
		return true
	}

	canResizeX(): boolean {
		return true
	}

	canResizeY(): boolean {
		return true
	}

	canResizeCenter(): boolean {
		return true
	}

	canRotate(): boolean {
		return true
	}

	constrainUV(uv: Vector2, _initialUV?: Vector2): Vector2 {
		return new Vector2(Math.max(0, Math.min(1, uv.x)), Math.max(0, Math.min(1, uv.y)))
	}

	constrainSize(sizeX: number, sizeY: number): { sizeX: number; sizeY: number } {
		const MIN_SIZE = 10 / 1024
		return {
			sizeX: Math.max(MIN_SIZE, Math.min(1.0, sizeX)),
			sizeY: Math.max(MIN_SIZE, Math.min(1.0, sizeY)),
		}
	}

	constrainRotation(rotation: number): number {
		return rotation
	}

	getDefaultSize(sourceImage?: HTMLImageElement | null): { sizeX: number; sizeY: number } {
		const MIN_SIZE = 10 / 1024
		const DEFAULT_SIZE = 0.4

		if (sourceImage && sourceImage.naturalWidth > 0 && sourceImage.naturalHeight > 0) {
			const aspectRatio = sourceImage.naturalHeight / sourceImage.naturalWidth

			let sizeX: number
			let sizeY: number

			if (aspectRatio > 1) {
				sizeX = DEFAULT_SIZE
				sizeY = DEFAULT_SIZE * aspectRatio
			} else {
				sizeX = DEFAULT_SIZE / aspectRatio
				sizeY = DEFAULT_SIZE
			}

			sizeX = Math.max(MIN_SIZE, Math.min(1.0, sizeX))
			sizeY = Math.max(MIN_SIZE, Math.min(1.0, sizeY))

			return { sizeX, sizeY }
		}

		return { sizeX: DEFAULT_SIZE, sizeY: DEFAULT_SIZE }
	}

	getDefaultRotation(): number {
		return 0
	}

	calculateDistance(uv1: Vector2, uv2: Vector2): number {
		return uv1.distanceTo(uv2)
	}
}
