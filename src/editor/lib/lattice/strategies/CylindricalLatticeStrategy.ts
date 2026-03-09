import { Vector2 } from 'three'
import type { UpdateLatticeStrategy } from '../UpdateLatticeStrategy'
import { GeometryProjectionService } from '@/editor/services/GeometryProjectionService'
import { container } from '@/lib/di/container'

	const MIN_SIZE = 10 / 1024

/**
 * Strategy for cylindrical-lattice projection type.
 * Enforces constraints for sleeve-style tattoos:
 * - Full UV width (sizeX = 1.0)
 * - X-axis and Y-axis movement allowed (X-axis wraps around cylinder)
 * - Rotation disabled
 */
export class CylindricalLatticeStrategy implements UpdateLatticeStrategy {
	private readonly geometryProjectionService: GeometryProjectionService = container.resolve<GeometryProjectionService>(
		'GeometryProjectionService'
	)
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
		return false
	}

	canResizeY(): boolean {
		return true
	}

	canResizeCenter(): boolean {
		return true
	}

	canRotate(): boolean {
		return false
	}

	constrainUV(uv: Vector2, _initialUV?: Vector2): Vector2 {
		return new Vector2(
			uv.x,
			Math.max(0, Math.min(1, uv.y))
		)
	}

	constrainSize(sizeX: number, sizeY: number): { sizeX: number; sizeY: number } {
		return {
			sizeX: 1.0,
			sizeY: Math.max(MIN_SIZE, Math.min(1.0, sizeY)),
		}
	}

	constrainRotation(rotation: number): number {
		return 0
	}

	getDefaultSize(sourceImage?: HTMLImageElement | null): { sizeX: number; sizeY: number } {
		let sizeY = 0.4

		if (sourceImage && sourceImage.naturalWidth > 0 && sourceImage.naturalHeight > 0) {
			const aspectRatio = sourceImage.naturalHeight / sourceImage.naturalWidth
			sizeY = aspectRatio

			sizeY = Math.max(MIN_SIZE, Math.min(1.0, sizeY))
		}

		return { sizeX: 1.0, sizeY }
	}

	getDefaultRotation(): number {
		return 0
	}

	calculateDistance(uv1: Vector2, uv2: Vector2): number {
		return this.geometryProjectionService.wrappedUVDistance(uv1, uv2, true)
	}
}

