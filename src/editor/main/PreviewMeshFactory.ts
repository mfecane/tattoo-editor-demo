import { PreviewMesh } from '@/editor/main/PreviewMesh'
import {
	Box3,
	Group,
	LinearSRGBColorSpace,
	Mesh,
	MeshPhysicalMaterial,
	MeshPhysicalMaterialParameters,
	RepeatWrapping,
	SRGBColorSpace,
	TextureLoader,
	Vector3,
} from 'three'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { Optional } from 'typescript-optional'

/**
 * @service
 * @stateless
 */
export class PreviewMeshFactory {
	constructor() {}

	public async loadAsset(url: string): Promise<PreviewMesh> {
		const loader = new GLTFLoader()

		const dracoLoader = new DRACOLoader()
		dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')
		loader.setDRACOLoader(dracoLoader)

		try {
			const gltf = await loader.loadAsync(url)
			const assetGroup = Optional.ofNullable(gltf.scene.children[0] as Group).orElseThrow(
				() => new Error('Asset group not found')
			)

			// All this because of this lazy ass mother fucker:
			// donmccurdy
			// Apr 2023
			// Exporting a multi-material mesh with GLTFExporter and then importing it with
			// GLTFLoader should produce a scene with the same appearance, but — as you
			// mention – the multi-material mesh will be split into one part per material.
			// We have no plans to change that behavior, sorry. It was supported at one
			// point in the past, but was overly complex to maintain and had to be removed.
			// https://discourse.threejs.org/t/some-issues-when-export-a-single-mesh-with-multiple-materials-using-gltf-exporter/50395/3

			const mesh = this.mergeGroupMeshes(assetGroup)

			mesh.position.copy(assetGroup.position)
			mesh.rotation.copy(assetGroup.rotation)
			mesh.scale.copy(assetGroup.scale)
			mesh.quaternion.copy(assetGroup.quaternion)
			mesh.updateMatrixWorld(true)

			const box = new Box3().setFromObject(mesh)
			const size = box.getSize(new Vector3())
			const center = box.getCenter(new Vector3())

			const maxDimension = Math.max(size.x, size.y, size.z)
			const scale = maxDimension > 0 ? 3 / maxDimension : 1

			const geometry = mesh.geometry

			geometry.applyMatrix4(mesh.matrixWorld)

			geometry.translate(-center.x, -center.y, -center.z)

			geometry.scale(scale, scale, scale)

			mesh.position.set(0, 0, 0)
			mesh.rotation.set(0, 0, 0)
			mesh.quaternion.set(0, 0, 0, 1)
			mesh.scale.set(1, 1, 1)
			mesh.updateMatrixWorld(true)

			await this.setupAssetMaterials(mesh)

			mesh.name = 'ArmAsset'
			mesh.castShadow = true
			mesh.receiveShadow = true

			return new PreviewMesh(mesh)
		} catch (error) {
			throw new Error(`Failed to load asset: ${error}`)
		}
	}

	private async setupAssetMaterials(asset: Mesh): Promise<void> {
		const textureLoader = new TextureLoader()

		const [color1001, orm1001, normal1001, alpha1001] = await Promise.all([
			textureLoader.loadAsync('assets/asset/color_1001.jpg'),
			textureLoader.loadAsync('assets/asset/orm_1001.jpg'),
			textureLoader.loadAsync('assets/asset/normal_1001.jpg'),
			textureLoader.loadAsync('assets/asset/alpha_1001.jpg'),
		])

		const [color1002, orm1002, normal1002, alpha1002] = await Promise.all([
			textureLoader.loadAsync('assets/asset/color_1002.jpg'),
			textureLoader.loadAsync('assets/asset/orm_1002.jpg'),
			textureLoader.loadAsync('assets/asset/normal_1002.jpg'),
			textureLoader.loadAsync('assets/asset/alpha_1002.jpg'),
		])

		color1001.wrapS = RepeatWrapping
		color1001.wrapT = RepeatWrapping
		color1001.flipY = false
		color1001.colorSpace = SRGBColorSpace
		orm1001.wrapS = RepeatWrapping
		orm1001.wrapT = RepeatWrapping
		orm1001.flipY = false
		orm1001.colorSpace = LinearSRGBColorSpace
		normal1001.wrapS = RepeatWrapping
		normal1001.wrapT = RepeatWrapping
		normal1001.flipY = false
		alpha1001.wrapS = RepeatWrapping
		alpha1001.wrapT = RepeatWrapping
		alpha1001.flipY = false

		color1002.wrapS = RepeatWrapping
		color1002.wrapT = RepeatWrapping
		color1002.flipY = false
		color1002.colorSpace = SRGBColorSpace
		orm1002.wrapS = RepeatWrapping
		orm1002.wrapT = RepeatWrapping
		orm1002.flipY = false
		normal1002.wrapS = RepeatWrapping
		normal1002.wrapT = RepeatWrapping
		normal1002.flipY = false
		alpha1002.wrapS = RepeatWrapping
		alpha1002.wrapT = RepeatWrapping
		alpha1002.flipY = false

		const common: MeshPhysicalMaterialParameters = {
			sheen: 1.0,
			sheenRoughness: 0.5,
			aoMapIntensity: 1.0,
			transparent: true,
		}

		const material1001 = new MeshPhysicalMaterial({
			map: color1001,
			alphaMap: alpha1001,
			normalMap: normal1001,
			aoMap: orm1001,
			roughnessMap: orm1001,
			metalnessMap: orm1001,
			...common,
		})

		const material1002 = new MeshPhysicalMaterial({
			map: color1002,
			alphaMap: alpha1002,
			normalMap: normal1002,
			aoMap: orm1002,
			roughnessMap: orm1002,
			metalnessMap: orm1002,
			...common,
		})

		asset.material = [material1002, material1001]
	}

	private mergeGroupMeshes(group: Group): Mesh {
		const meshes: Mesh[] = []

		group.traverse((child) => {
			if (child instanceof Mesh) {
				meshes.push(child)
			}
		})

		if (meshes.length !== 2) {
			throw new Error(`[GeometryMerger] Expected exactly 2 meshes in group, found ${meshes.length}`)
		}

		const [mesh1, mesh2] = meshes

		const geometry1 = mesh1.geometry.clone()
		const geometry2 = mesh2.geometry.clone()

		const mergedGeometry = mergeGeometries([geometry1, geometry2])

		if (!mergedGeometry) {
			throw new Error('[GeometryMerger] Failed to merge geometries')
		}

		const indexCount1 = geometry1.index ? geometry1.index.count : geometry1.attributes.position.count
		const indexCount2 = geometry2.index ? geometry2.index.count : geometry2.attributes.position.count

		mergedGeometry.clearGroups()
		mergedGeometry.addGroup(0, indexCount1, 0)
		mergedGeometry.addGroup(indexCount1, indexCount2, 1)

		const mergedMesh = new Mesh(mergedGeometry, [])
		mergedMesh.castShadow = mesh1.castShadow
		mergedMesh.receiveShadow = mesh1.receiveShadow

		return mergedMesh
	}
}
