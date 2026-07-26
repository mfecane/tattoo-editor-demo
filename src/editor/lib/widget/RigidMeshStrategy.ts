import type { WidgetStrategy } from '@/editor/lib/widget/WidgetStrategy'

/**
 * Strategy for freely-placed rigid meshes (PlacedMesh) - no surface
 * projection or constraints, every transform handle is enabled.
 */
export class RigidMeshStrategy implements WidgetStrategy {
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
}
