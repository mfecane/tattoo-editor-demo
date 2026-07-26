import { BakeSearchRequest } from '@/editor/services/UVSearchAlgorithm'
import { Editor } from '@/editor/main/Editor'
import { Piece } from '@/editor/main/PlacedMeshList'
import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute } from 'three'

/** Extracts the plain typed-array + matrix payload a UVSearchAlgorithm needs - no live Three.js objects/GL context. */
export class BakeRequestBuilder {
	static build(editor: Editor, entry: Piece, generation: number): BakeSearchRequest | null {
		const bodyMesh = editor.previewMesh.mesh
		bodyMesh.updateMatrixWorld(true)
		entry.mesh.updateMatrixWorld(true)

		const bodyGeometry = bodyMesh.geometry
		const editableGroup = bodyGeometry.groups.find((group) => group.materialIndex === 1)
		const bodyIndex = bodyGeometry.index
		const bodyPosition = bodyGeometry.attributes.position
		const bodyNormal = bodyGeometry.attributes.normal
		const bodyUv = bodyGeometry.attributes.uv
		if (!editableGroup || !bodyIndex || !bodyPosition || !bodyNormal || !bodyUv) {
			return null
		}

		const patchGeometry = entry.mesh.geometry
		const patchIndex = patchGeometry.index
		const patchPosition = patchGeometry.attributes.position
		const patchUv = patchGeometry.attributes.uv
		if (!patchIndex || !patchPosition || !patchUv) {
			return null
		}

		const bodyRequestGeometry = new BufferGeometry()
		bodyRequestGeometry.setAttribute('position', new Float32BufferAttribute(Float32Array.from(bodyPosition.array), 3))
		bodyRequestGeometry.setAttribute('normal', new Float32BufferAttribute(Float32Array.from(bodyNormal.array), 3))
		bodyRequestGeometry.setAttribute('uv', new Float32BufferAttribute(Float32Array.from(bodyUv.array), 2))
		bodyRequestGeometry.setIndex(new Uint32BufferAttribute(Uint32Array.from(bodyIndex.array), 1))

		const patchRequestGeometry = new BufferGeometry()
		patchRequestGeometry.setAttribute('position', new Float32BufferAttribute(Float32Array.from(patchPosition.array), 3))
		patchRequestGeometry.setAttribute('uv', new Float32BufferAttribute(Float32Array.from(patchUv.array), 2))
		patchRequestGeometry.setIndex(new Uint32BufferAttribute(Uint32Array.from(patchIndex.array), 1))

		return {
			jobId: generation,
			entryId: entry.id,
			body: {
				geometry: bodyRequestGeometry,
				groupRange: [editableGroup.start, editableGroup.count],
				matrixWorldElements: bodyMesh.matrixWorld.toArray(),
			},
			patch: {
				geometry: patchRequestGeometry,
				matrixWorldElements: entry.mesh.matrixWorld.toArray(),
			},
		}
	}
}
