import { EDITOR_CONSTANTS } from '@/editor/lib/constants'
import { LatticeMesh } from '@/editor/lib/lattice/LatticeMesh'
import { Editor } from '@/editor/main/Editor'
import { RuntimeStamp } from '@/editor/main/RuntimeStamp'
import {
	Box3,
	Color,
	LinearFilter,
	Matrix4,
	Mesh,
	MeshBasicMaterial,
	OrthographicCamera,
	PlaneGeometry,
	RGBAFormat,
	Scene,
	Texture,
	Vector2,
	WebGLRenderTarget,
	WebGLRenderer,
} from 'three'

/**
 * @singleton
 */
export class LatticeRenderer {
	public renderTarget: WebGLRenderTarget // Make public for debug access
	public texture: Texture | null = null

	private renderScene: Scene
	private camera: OrthographicCamera
	private size: Vector2 = new Vector2(
		EDITOR_CONSTANTS.LATTICE_RENDER_TARGET_SIZE,
		EDITOR_CONSTANTS.LATTICE_RENDER_TARGET_SIZE
	)

	public constructor() {
		this.renderTarget = new WebGLRenderTarget(this.size.x, this.size.y, {
			minFilter: LinearFilter,
			magFilter: LinearFilter,
			format: RGBAFormat,
		})
		this.renderTarget.texture.generateMipmaps = false

		this.renderScene = new Scene()
		this.renderScene.background = new Color(0xffffff)

		this.camera = new OrthographicCamera(0, 1, 1, 0, EDITOR_CONSTANTS.CAMERA_NEAR, EDITOR_CONSTANTS.CAMERA_FAR)
		this.camera.position.set(0, 0, 1)
		this.camera.lookAt(0, 0, 0)
		this.camera.updateProjectionMatrix()
		this.camera.updateMatrixWorld()
	}

	/**
	 * Updates the render target size if canvas size changes.
	 */
	public setSize(size: Vector2 | null): void {
		if (size === null) {
			this.size.set(EDITOR_CONSTANTS.LATTICE_RENDER_TARGET_SIZE, EDITOR_CONSTANTS.LATTICE_RENDER_TARGET_SIZE)
		} else {
			this.size.copy(size)
		}
	}

	/**
	 * Disposes of resources.
	 */
	public dispose(): void {
		this.renderTarget.dispose()
		this.renderScene.clear()
	}

	/**
	 * Renders all stamp lattice meshes to a single composite texture.
	 * All stamps are composited together on the same texture.
	 * If backgroundTexture is provided, it will be rendered first, then stamps composited on top.
	 */
	public renderAllStampsToTexture(editor: Editor, stamps: RuntimeStamp[]): Texture {
		const mainRenderer = editor.renderer
		const backgroundTexture = editor.previewMesh.originalEditableTexture

		this.renderScene.clear()
		const clonesToDispose: Mesh[] = []

		const backgroundQuad = this.createBackgroundQuad(backgroundTexture)
		if (backgroundQuad) {
			this.renderScene.add(backgroundQuad)
			clonesToDispose.push(backgroundQuad)
		}

		this.processStamps(stamps, clonesToDispose)

		this.camera.updateMatrixWorld()

		this.renderToTarget(mainRenderer)

		this.disposeClones(clonesToDispose)

		this.texture = this.renderTarget.texture
		return this.texture
	}

	public getTexture(): Texture | null {
		return this.texture
	}

	/**
	 * Creates a full-screen quad for rendering the background texture.
	 */
	private createBackgroundQuad(backgroundTexture: Texture | null): Mesh | null {
		if (!backgroundTexture) {
			return null
		}

		const geometry = new PlaneGeometry(1, 1)
		const material = new MeshBasicMaterial({
			map: backgroundTexture,
			depthTest: false,
		})
		const backgroundQuad = new Mesh(geometry, material)
		backgroundQuad.name = 'BackgroundQuad'
		backgroundQuad.position.set(0.5, 0.5, 0)
		backgroundQuad.rotateX(0)
		backgroundQuad.renderOrder = -1

		return backgroundQuad
	}

	/**
	 * Processes all stamps, creating clones and handling UV wrapping.
	 * Adds clones to the render scene and tracks them for disposal.
	 */
	private processStamps(stamps: RuntimeStamp[], clonesToDispose: Mesh[]): void {
		let index = 0
		for (const [_, stamp] of stamps.entries()) {
			if (!stamp.latticeMesh) continue

			const stampClones = this.processStamp(stamp, index)
			for (const clone of stampClones) {
				this.renderScene.add(clone)
				clonesToDispose.push(clone)
			}

			index++
		}
	}

	/**
	 * Processes a single stamp, creating clones with UV wrapping if needed.
	 * Returns array of clones (original + wrapped copies if needed).
	 */
	private processStamp(stamp: { latticeMesh: LatticeMesh }, index: number): Mesh[] {
		const meshClone = stamp.latticeMesh.cloneMesh()

		meshClone.name = `LatticeMesh_${index}`
		meshClone.updateMatrixWorld(true)

		meshClone.renderOrder = index

		const clones: Mesh[] = [meshClone]

		const box = new Box3().setFromObject(meshClone)
		const minX = box.min.x
		const maxX = box.max.x

		const needsLeftWrap = minX < 0
		const needsRightWrap = maxX > 1

		if (needsLeftWrap) {
			const leftWrapClone = this.createWrappedClone(meshClone, index, 'LeftWrap', 1)
			clones.push(leftWrapClone)
		}

		if (needsRightWrap) {
			const rightWrapClone = this.createWrappedClone(meshClone, index, 'RightWrap', -1)
			clones.push(rightWrapClone)
		}

		return clones
	}

	private createWrappedClone(
		meshClone: Mesh,
		index: number,
		suffix: 'LeftWrap' | 'RightWrap',
		offsetX: number
	): Mesh {
		const wrappedClone = meshClone.clone()
		wrappedClone.name = `LatticeMesh_${index}_${suffix}`
		wrappedClone.renderOrder = index
		const offsetMatrix = new Matrix4().makeTranslation(offsetX, 0, 0)
		wrappedClone.matrix.copy(offsetMatrix.multiply(meshClone.matrix.clone()))
		wrappedClone.matrixWorldNeedsUpdate = true
		wrappedClone.updateMatrixWorld(true)
		return wrappedClone
	}

	/**
	 * Renders the scene to the render target.
	 */
	private renderToTarget(renderer: WebGLRenderer): void {
		const sizeBackup: Vector2 = new Vector2()
		renderer.getSize(sizeBackup)

		this.renderTarget.setSize(this.size.x, this.size.y)
		renderer.setSize(this.size.x, this.size.y)
		renderer.setRenderTarget(this.renderTarget)
		renderer.clear()
		renderer.render(this.renderScene, this.camera)

		renderer.setRenderTarget(null)
		renderer.setSize(sizeBackup.x, sizeBackup.y)
	}

	/**
	 * Disposes of all clone meshes and clears the render scene.
	 */
	private disposeClones(clones: Mesh[]): void {
		this.renderScene.clear()
		// for (const clone of clones) {
		// 	clone.geometry.dispose()
		// 	if (Array.isArray(clone.material)) {
		// 		clone.material.forEach((mat) => mat.dispose())
		// 	} else {
		// 		clone.material.dispose()
		// 	}
		// }
	}
}
