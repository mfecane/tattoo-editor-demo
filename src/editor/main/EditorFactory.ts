import { Editor } from '@/editor/main/Editor'
import type { ILightingSetup } from '@/editor/main/environment/ILightingSetup'
import { LightingSetup1 } from '@/editor/main/environment/LightingSetup1'
import { LightingSetup2 } from '@/editor/main/environment/LightingSetup2'
import { PreviewMeshFactory } from '@/editor/main/PreviewMeshFactory'
import { PCFSoftShadowMap, PMREMGenerator, ReinhardToneMapping, SRGBColorSpace, Texture, WebGLRenderer } from 'three'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'

export class EditorFactory {
	private static readonly PREVIEW_MESH_URL = 'assets/asset/arm_render.glb'
	private static readonly ENVIRONMENT_MAP_URL = 'assets/environment/blocky_photo_studio_512.ktx2'

	private readonly previewMeshFactory: PreviewMeshFactory = new PreviewMeshFactory()
	private readonly lightingSetup1: ILightingSetup = new LightingSetup1()
	private readonly lightingSetup2: ILightingSetup = new LightingSetup2()

	public async createEditor(container: HTMLElement): Promise<Editor> {
		const width = container.clientWidth
		const height = container.clientHeight

		const renderer = this.createRenderer(width, height)

		const environmentMap = await this.loadPMREMEnvironment(renderer)

		return new Editor(
			await this.previewMeshFactory.loadAsset(EditorFactory.PREVIEW_MESH_URL),
			container,
			width,
			height,
			this.lightingSetup2,
			environmentMap,
			renderer
		)
	}

	private createRenderer(width: number, height: number): WebGLRenderer {
		const renderer = new WebGLRenderer({ antialias: true })
		renderer.setSize(width, height)
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
		renderer.shadowMap.enabled = true
		renderer.shadowMap.type = PCFSoftShadowMap
		renderer.toneMapping = ReinhardToneMapping

		return renderer
	}

	private async loadPMREMEnvironment(renderer: WebGLRenderer): Promise<Texture> {
		const ktx2Loader = new KTX2Loader()
		ktx2Loader.setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/libs/basis/')
		ktx2Loader.detectSupport(renderer)

		const texture = await ktx2Loader.loadAsync(EditorFactory.ENVIRONMENT_MAP_URL)
		texture.colorSpace = SRGBColorSpace

		const pmremGenerator = new PMREMGenerator(renderer)
		pmremGenerator.compileEquirectangularShader()

		const envMap = pmremGenerator.fromEquirectangular(texture).texture

		if (!envMap) {
			texture.dispose()
			pmremGenerator.dispose()
			throw new Error('Failed to generate PMREM environment map')
		}

		texture.dispose()
		pmremGenerator.dispose()

		return envMap
	}
}
