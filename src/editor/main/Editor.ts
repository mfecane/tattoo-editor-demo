import { EDITOR_CONSTANTS } from '@/editor/constants'
import { CanvasEventHandler } from '@/editor/interaction/CanvasEventHandler'
import { Visual3dDebugger } from '@/editor/lib/utils/Visual3dDebugger'
import { CameraUpdateController } from '@/editor/main/CameraUpdateController'
import { CommandFactory } from '@/editor/main/commands/CommandFactory'
import { EditorController } from '@/editor/main/EditorController'
import { EditorKeyboardHandler } from '@/editor/main/EditorKeyboardHandler'
import { ILightingSetup } from '@/editor/main/environment/ILightingSetup'
import { HitTester } from '@/editor/main/HitTester'
import { PreviewMesh } from '@/editor/main/PreviewMesh'
import { ReactBridge } from '@/editor/main/ReactBridge'
import { BodyTextureComposer } from '@/editor/services/BodyTextureComposer'
import { PatchBaker } from '@/editor/services/PatchBaker'
import { ProjectRecord } from '@/editor/types/projectTypes'
import { Euler, Group, Mesh, PerspectiveCamera, Scene, Texture, WebGLRenderer } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader.js'
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js'

export class Editor {
	public previewScene: Scene
	public overlayScene: Scene
	public lightsGroup!: Group

	public camera: PerspectiveCamera
	public renderer: WebGLRenderer
	public composer: EffectComposer
	public controls: OrbitControls
	public resizeObserver: ResizeObserver
	public handleResize = () => this.resize()

	public readonly controller: EditorController = new EditorController(this)

	public readonly commandFactory: CommandFactory = new CommandFactory(this.controller)

	public readonly hitTester: HitTester

	public readonly canvasEventHandler: CanvasEventHandler

	// Declared before patchBaker - PatchBaker's constructor wires it into its UVSearchAlgorithm
	// (see PatchBaker constructor), and class field initializers run in declaration order, so it
	// must exist first or that wiring silently receives undefined.
	public readonly visual3dDebugger: Visual3dDebugger = new Visual3dDebugger()

	public readonly patchBaker: PatchBaker = new PatchBaker(this)

	public readonly bodyTextureComposer: BodyTextureComposer = new BodyTextureComposer(this)

	public readonly reactBridge: ReactBridge = new ReactBridge(this)

	public readonly keyboardHandler: EditorKeyboardHandler = new EditorKeyboardHandler(this.controller)

	public readonly cameraUpdateController: CameraUpdateController = new CameraUpdateController()

	public projectId: string | null = null

	private animateId: number | null = null

	public constructor(
		public readonly previewMesh: PreviewMesh,
		public readonly container: HTMLElement,
		private readonly width: number,
		private readonly height: number,
		private readonly lightingSetup: ILightingSetup,
		private readonly environmentMap: Texture,
		renderer: WebGLRenderer
	) {
		this.previewScene = new Scene()

		this.overlayScene = new Scene()

		// Wired to PatchBaker's active UVSearchAlgorithm (see PatchBaker constructor) to
		// visualize the expanded patch geometry and hit rays during UV search - also
		// available for ad-hoc debug use elsewhere.
		this.visual3dDebugger.setScene(this.overlayScene)

		this.camera = new PerspectiveCamera(
			EDITOR_CONSTANTS.CAMERA_FOV,
			this.width / this.height,
			EDITOR_CONSTANTS.CAMERA_NEAR,
			EDITOR_CONSTANTS.CAMERA_FAR
		)
		this.camera.name = 'EditorCamera'
		this.camera.position.set(2.0, 2.0, 2.0)
		this.camera.lookAt(0, 0, 0)

		this.renderer = renderer
		this.container.appendChild(this.renderer.domElement)

		this.controls = new OrbitControls(this.camera, this.renderer.domElement)
		this.controls.enableDamping = true
		this.controls.dampingFactor = 0.05
		this.controls.minDistance = 1
		this.controls.maxDistance = 20
		this.controls.enablePan = true
		this.controls.enableZoom = true
		this.controls.autoRotate = false
		this.reactBridge.bindControlsListeners()

		this.lightsGroup = this.lightingSetup.setup()
		this.previewScene.add(this.lightsGroup)

		this.previewScene.environment = this.environmentMap
		this.previewScene.environmentIntensity = 0.15
		this.previewScene.background = this.environmentMap
		this.previewScene.backgroundIntensity = 0.025
		this.previewScene.backgroundBlurriness = 0.25
		this.previewScene.backgroundRotation = new Euler(0, 0, 0)
		this.reactBridge.applyInitialViewSettings()

		this.previewScene.add(this.previewMesh.mesh)

		// this.controller.setRuntimeContext(this.overlayScene, this.previewMesh.mesh)

		this.composer = new EffectComposer(renderer)
		this.composer.setSize(this.width, this.height)

		const renderPass = new RenderPass(this.previewScene, this.camera)
		this.composer.addPass(renderPass)

		const gammaPass = new ShaderPass(GammaCorrectionShader)
		this.composer.addPass(gammaPass)

		const vignettePass = new ShaderPass(VignetteShader)
		vignettePass.uniforms['offset'].value = 0.2
		vignettePass.uniforms['darkness'].value = 2

		this.composer.addPass(vignettePass)

		this.resizeObserver = new ResizeObserver(this.handleResize)
		this.resizeObserver.observe(this.container)

		window.addEventListener('resize', this.handleResize)

		this.hitTester = new HitTester(this)
		this.canvasEventHandler = new CanvasEventHandler(this)
		this.controller.setActiveTool(this.controller.getSelectTool())
	}

	public async setProjectData(projectData: ProjectRecord): Promise<void> {
		this.projectId = projectData.id
	}

	public destroy(): void {
		this.keyboardHandler.destroy()
		this.patchBaker.destroy()
		this.bodyTextureComposer.destroy()

		if (this.animateId) {
			cancelAnimationFrame(this.animateId)
		}

		if (this.renderer.domElement.parentNode === this.container) {
			this.container.removeChild(this.renderer.domElement)
		}

		if (this.previewScene.environment) {
			this.previewScene.environment.dispose()
			this.previewScene.environment = null
		}

		this.previewScene.background = null

		// TODO recheck cleanup
		this.previewScene.traverse((child) => {
			if (child instanceof Mesh) {
				if (child.geometry) {
					child.geometry.dispose()
				}
				if (child.material) {
					if (Array.isArray(child.material)) {
						child.material.forEach((mat) => mat.dispose())
					} else {
						child.material.dispose()
					}
				}
			}
		})

		this.composer.dispose()
		this.renderer.dispose()
		this.reactBridge.unbindControlsListeners()
		this.controls.dispose()

		this.resizeObserver.disconnect()
		window.removeEventListener('resize', this.handleResize)
	}

	public update() {
		this.controls.update()
		this.cameraUpdateController.notify()
	}

	public render(): void {
		this.composer.render()
		const autoClear = this.renderer.autoClear
		this.renderer.autoClear = false
		this.renderer.render(this.overlayScene, this.camera)
		this.renderer.autoClear = autoClear
	}

	public resize() {
		const width = this.container.clientWidth
		const height = this.container.clientHeight
		this.camera.aspect = width / height
		this.camera.updateProjectionMatrix()
		this.renderer.setSize(width, height)
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
		this.composer.setSize(width, height)
	}

	public getDomElement(): HTMLElement {
		return this.renderer.domElement
	}

	public updateCameraMatrix(): void {
		this.camera.updateProjectionMatrix()
		this.camera.updateMatrixWorld(true)
	}

	public setLightRotation(angle: number): void {
		this.lightsGroup.rotation.y = angle
	}

	public setBackgroundRotation(angle: number): void {
		this.previewScene.backgroundRotation.z = angle
	}

	public getOverlayScene(): Scene {
		return this.overlayScene
	}

	public animate(): void {
		this.update()
		this.render()
		this.animateId = requestAnimationFrame(() => this.animate())
	}
}
