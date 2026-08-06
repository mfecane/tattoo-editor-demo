import { GeometryModifier } from '@/editor/services/GeometryModifier'
import { computeVertexNormals } from '@/editor/services/GeometryUtils'
import { BufferGeometry, Float32BufferAttribute } from 'three'

/** Pushes every vertex outward along its averaged vertex normal by a fixed margin. */
export class PushModifier implements GeometryModifier {
	public constructor(private readonly margin: number) {}

	public apply(geometry: BufferGeometry): BufferGeometry {
		const positions = geometry.attributes.position.array as Float32Array
		const indices = geometry.index!.array as Uint32Array
		const normals = computeVertexNormals(positions, indices)

		const pushedPositions = new Float32Array(positions.length)
		for (let i = 0; i < positions.length; i++) {
			pushedPositions[i] = positions[i] + normals[i] * this.margin
		}

		const pushed = geometry.clone()
		pushed.name = 'pushModifier.output'
		pushed.setAttribute('position', new Float32BufferAttribute(pushedPositions, 3))
		return pushed
	}
}
