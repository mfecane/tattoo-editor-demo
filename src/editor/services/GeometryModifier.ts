import { BufferGeometry } from 'three'

/** A pure geometry transform: consumes a BufferGeometry, returns a new one - never mutates its input. */
export interface GeometryModifier {
	apply(geometry: BufferGeometry): BufferGeometry
}
