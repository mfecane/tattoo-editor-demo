import { Piece } from '@/editor/main/PlacedMeshList'
import { RegionMeshFactory } from '@/editor/main/RegionMeshFactory'
import { Color, Mesh, MeshBasicMaterial, NormalBlending, OrthographicCamera, Scene, WebGLRenderTarget, WebGLRenderer } from 'three'

export class PieceThumbnailService {
	private static readonly SIZE = 128
	private static readonly CAMERA_PADDING = 1.1

	private readonly cache: Map<string, string | null> = new Map()

	public generateThumbnail(piece: Piece, renderer: WebGLRenderer): string | null {
		const cached: string | null | undefined = this.cache.get(piece.id)
		if (cached !== undefined) {
			return cached
		}

		const thumbnail: string | null = this.render(piece, renderer)
		this.cache.set(piece.id, thumbnail)
		return thumbnail
	}

	public invalidate(pieceId: string): void {
		this.cache.delete(pieceId)
	}

	public clear(): void {
		this.cache.clear()
	}

	private render(piece: Piece, renderer: WebGLRenderer): string | null {
		const regionMesh: Mesh = RegionMeshFactory.createMesh(piece.sourceShape, piece.texture, piece.sketchAspect)
		const material: MeshBasicMaterial = regionMesh.material as MeshBasicMaterial
		material.blending = NormalBlending
		material.depthTest = true
		material.needsUpdate = true

		regionMesh.geometry.computeBoundingBox()
		const box = regionMesh.geometry.boundingBox
		if (!box) {
			this.disposeRegionMesh(regionMesh, material)
			return null
		}

		const width: number = box.max.x - box.min.x
		const height: number = box.max.y - box.min.y
		if (width <= 0 || height <= 0) {
			this.disposeRegionMesh(regionMesh, material)
			return null
		}

		const centerX: number = (box.max.x + box.min.x) / 2
		const centerY: number = (box.max.y + box.min.y) / 2
		const halfExtent: number = (Math.max(width, height) / 2) * PieceThumbnailService.CAMERA_PADDING

		const camera = new OrthographicCamera(-halfExtent, halfExtent, halfExtent, -halfExtent, 0.1, 10)
		camera.position.set(centerX, centerY, 1)
		camera.lookAt(centerX, centerY, 0)

		const scene = new Scene()
		scene.add(regionMesh)

		const size = PieceThumbnailService.SIZE
		const renderTarget = new WebGLRenderTarget(size, size)

		const previousTarget = renderer.getRenderTarget()
		const previousAutoClear: boolean = renderer.autoClear
		const previousClearColor = new Color()
		renderer.getClearColor(previousClearColor)
		const previousClearAlpha: number = renderer.getClearAlpha()

		renderer.autoClear = true
		renderer.setClearColor(0x000000, 0)
		renderer.setRenderTarget(renderTarget)
		renderer.render(scene, camera)

		const pixels: Uint8Array = new Uint8Array(size * size * 4)
		renderer.readRenderTargetPixels(renderTarget, 0, 0, size, size, pixels)

		renderer.setRenderTarget(previousTarget)
		renderer.setClearColor(previousClearColor, previousClearAlpha)
		renderer.autoClear = previousAutoClear

		const canvas: HTMLCanvasElement = document.createElement('canvas')
		canvas.width = size
		canvas.height = size
		const ctx = canvas.getContext('2d')
		if (!ctx) {
			renderTarget.dispose()
			this.disposeRegionMesh(regionMesh, material)
			return null
		}

		const imageData: ImageData = ctx.createImageData(size, size)
		for (let row = 0; row < size; row++) {
			const sourceRow: number = size - 1 - row
			imageData.data.set(pixels.subarray(sourceRow * size * 4, sourceRow * size * 4 + size * 4), row * size * 4)
		}
		ctx.putImageData(imageData, 0, 0)

		renderTarget.dispose()
		this.disposeRegionMesh(regionMesh, material)

		return canvas.toDataURL('image/png')
	}

	private disposeRegionMesh(mesh: Mesh, material: MeshBasicMaterial): void {
		mesh.geometry.dispose()
		material.dispose()
	}
}
