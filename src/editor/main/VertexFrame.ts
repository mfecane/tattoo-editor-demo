import { Vector3 } from 'three'

/** A vertex's local tangent-plane basis mid-march: where it landed on the body surface (or its unprojected prediction on a raycast miss) plus its orientation. */
export interface VertexFrame {
	position: Vector3 // world space (mesh sits at identity transform once wrapped, so local === world)
	normal: Vector3
	uAxis: Vector3
	vAxis: Vector3
}
