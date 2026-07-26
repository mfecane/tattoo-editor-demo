import { VERTEX_SLIDE_CONSTANTS } from '@/editor/constants'
import { LineBasicMaterial, LineSegments, Mesh, WireframeGeometry } from 'three'

/**
 * Shows the selected, wrapped placed mesh's actual triangle edges - lets the
 * user see how the decal's geometry sits on the body (sizing, curvature,
 * folding) while fine-tuning vertices. Added directly as a child of the mesh
 * so it inherits its transform for free, instead of copying
 * position/quaternion/scale every frame like WrapPreviewGhost does for its
 * scene-level ghost.
 */
export class WrappedMeshWireframeOverlay {
	private readonly line: LineSegments

	public constructor(private readonly mesh: Mesh) {
		const material = new LineBasicMaterial({
			color: VERTEX_SLIDE_CONSTANTS.WIREFRAME_COLOR,
			depthTest: false,
			transparent: true,
			opacity: 0.9,
		})

		this.line = new LineSegments(new WireframeGeometry(mesh.geometry), material)
		this.line.renderOrder = 1000
		this.line.name = 'WrappedMeshWireframeOverlay'
		this.mesh.add(this.line)
	}

	/** Rebuilds the wireframe from the mesh's current geometry - call after wrap/unwrap or any vertex drag. */
	public refresh(): void {
		this.line.geometry.dispose()
		this.line.geometry = new WireframeGeometry(this.mesh.geometry)
	}

	public destroy(): void {
		this.mesh.remove(this.line)
		this.line.geometry.dispose()
		;(this.line.material as LineBasicMaterial).dispose()
	}
}
