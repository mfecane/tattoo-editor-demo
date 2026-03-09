import { BRUSH_CONSTANTS } from '@/editor/interaction/handlers/constants'
import { ProjectionType, SerializableStampData, StampInfo } from '@/editor/types/projectTypes'
import {
	ClampToEdgeWrapping,
	DoubleSide,
	Material,
	Mesh,
	MeshBasicMaterial,
	MultiplyBlending,
	PlaneGeometry,
	Quaternion,
	Texture,
	Vector2,
	Vector3,
} from 'three'
import { LatticeTransformBuilder } from './LatticeTransformBuilder'
import { getStrategy } from './ProjectionStrategyFactory'
import type { UpdateLatticeStrategy } from './UpdateLatticeStrategy'

// Dear Cursor, do not edit this class, if you have urge to edit it, please ask me first
export class LatticeMesh {
	private static readonly LATTICE_WIDTH = 1
	private static readonly LATTICE_HEIGHT = 1
	private static readonly LATTICE_WIDTH_SEGMENTS = 20
	private static readonly LATTICE_HEIGHT_SEGMENTS = 20

	private readonly mesh: Mesh

	private readonly originalPositions: Float32Array

	private readonly geometry: PlaneGeometry
	private readonly placeholderImage: HTMLImageElement = new Image()
	private stampInfo: StampInfo
	private projectionType: ProjectionType
	private latticeModified: boolean

	private static smoothFalloff(distance: number, radius: number): number {
		if (distance >= radius) {
			return 0
		}
		const normalized = distance / radius
		return 1 - (3 * normalized * normalized - 2 * normalized * normalized * normalized)
	}

	public constructor(public data: SerializableStampData) {
		const stampInfo: StampInfo = {
			uv: new Vector2(data.stampInfo.uv.x, data.stampInfo.uv.y),
			sizeX: data.stampInfo.sizeX,
			sizeY: data.stampInfo.sizeY,
			rotation: data.stampInfo.rotation,
		}

		this.stampInfo = stampInfo
		this.projectionType = data.projectionType
		this.latticeModified = data.latticeModified ?? data.lattice !== undefined
		const strategy = getStrategy(data.projectionType)
		const defaultSize = strategy.getDefaultSize(this.placeholderImage)
		const defaultRotation = strategy.getDefaultRotation()
		this.geometry = new PlaneGeometry(
			LatticeMesh.LATTICE_WIDTH,
			LatticeMesh.LATTICE_HEIGHT,
			LatticeMesh.LATTICE_WIDTH_SEGMENTS,
			LatticeMesh.LATTICE_HEIGHT_SEGMENTS
		)

		const texture = new Texture(this.placeholderImage)
		texture.needsUpdate = true
		texture.wrapS = ClampToEdgeWrapping
		texture.wrapT = ClampToEdgeWrapping
		texture.flipY = false

		const material = new MeshBasicMaterial({
			map: texture,
			side: DoubleSide,
			blending: MultiplyBlending,
			transparent: true,
			depthTest: false,
			depthWrite: false,
		})

		this.mesh = new Mesh(this.geometry, material)
		this.mesh.name = `LatticeMesh:${data.id}`
		this.mesh.matrixAutoUpdate = false

		const constrainedSize = strategy.constrainSize(
			stampInfo.sizeX || defaultSize.sizeX,
			stampInfo.sizeY || defaultSize.sizeY
		)
		const constrainedRotation = strategy.constrainRotation(stampInfo.rotation || defaultRotation)
		const constrainedUV = strategy.constrainUV(stampInfo.uv)

		const transformMatrix = LatticeTransformBuilder.buildTransformMatrix({
			position: constrainedUV,
			sizeX: constrainedSize.sizeX,
			sizeY: constrainedSize.sizeY,
			rotation: constrainedRotation,
		})

		this.mesh.matrix.copy(transformMatrix)
		this.mesh.matrixWorldNeedsUpdate = true

		const positions = this.geometry.attributes.position
		const originalPositions = new Float32Array(positions.array.length)
		originalPositions.set(positions.array)
		this.originalPositions = originalPositions
	}

	public setPositions(data: SerializableStampData): void {
		const geometry = this.geometry
		const positions = geometry.attributes.position
		if (data.latticeModified && data.lattice && data.lattice.vertices.length === positions.count) {
			for (let i = 0; i < positions.count; i++) {
				const [x, y, z] = data.lattice.vertices[i]
				positions.setXYZ(i, x, y, z)
			}
			positions.needsUpdate = true
			this.latticeModified = true
			return
		}
		if (data.latticeModified && data.lattice && data.lattice.vertices.length !== positions.count) {
			throw new Error(
				`[RuntimeStamp] Vertex count mismatch: expected ${positions.count}, got ${data.lattice.vertices.length}`
			)
		}

		positions.array.set(this.originalPositions)
		positions.needsUpdate = true
		this.latticeModified = false
	}

	public updateTransform(stampInfo: StampInfo, projectionType: 'stamp' | 'cylindrical-lattice'): void {
		this.stampInfo = stampInfo

		if (this.projectionType !== projectionType) {
			// TODO review
			throw new Error('[updateTransform] Projection type cannot be changed')
		}

		const strategy = getStrategy(projectionType)

		const constrainedUV = strategy.constrainUV(stampInfo.uv)
		const constrainedSize = strategy.constrainSize(stampInfo.sizeX, stampInfo.sizeY)
		const constrainedRotation = strategy.constrainRotation(stampInfo.rotation)

		const transformMatrix = LatticeTransformBuilder.buildTransformMatrix({
			position: constrainedUV,
			sizeX: constrainedSize.sizeX,
			sizeY: constrainedSize.sizeY,
			rotation: constrainedRotation,
		})

		this.mesh.matrix.copy(transformMatrix)
		this.mesh.matrixWorldNeedsUpdate = true
	}

	public resetVertices(): void {
		const positions = this.geometry.attributes.position
		positions.array.set(this.originalPositions)
		positions.needsUpdate = true
		this.latticeModified = false
	}

	public setImage(image: HTMLImageElement): void {
		if (!(this.mesh.material instanceof MeshBasicMaterial)) {
			throw new Error('[LatticeMesh] Expected MeshBasicMaterial')
		}
		if (!this.mesh.material.map) {
			throw new Error('[LatticeMesh] Expected texture map on lattice material')
		}
		this.mesh.material.map.image = image
		this.mesh.material.map.needsUpdate = true
	}

	public deformVertices(
		brushUV: Vector2,
		uvDirection: Vector2,
		onNeedsRender?: () => void,
		strategy?: UpdateLatticeStrategy,
		brushSize?: number
	): void {
		const positions = this.geometry.attributes.position
		const meshMatrix = this.mesh.matrix.clone()
		const meshQuaternion = new Quaternion()
		const meshScale = new Vector3()
		meshMatrix.decompose(new Vector3(), meshQuaternion, meshScale)
		const inverseQuaternion = meshQuaternion.clone().invert()
		const scaleX = meshScale.x
		const scaleY = meshScale.y

		for (let i = 0; i < positions.count; i++) {
			const localVertex = new Vector3().fromBufferAttribute(positions, i)
			const originalVertex = new Vector3(
				this.originalPositions[i * 3],
				this.originalPositions[i * 3 + 1],
				this.originalPositions[i * 3 + 2]
			)
			const uvVertex = originalVertex.clone().applyMatrix4(meshMatrix)
			const vertexUV = new Vector2(uvVertex.x, uvVertex.y)
			const distance = strategy ? strategy.calculateDistance(vertexUV, brushUV) : vertexUV.distanceTo(brushUV)
			const influenceRadius = brushSize ?? BRUSH_CONSTANTS.INFLUENCE_RADIUS
			const influence = LatticeMesh.smoothFalloff(distance, influenceRadius)

			if (influence <= BRUSH_CONSTANTS.EPSILON) {
				continue
			}

			const shiftUV = uvDirection.clone().multiplyScalar(influence)
			const shiftUV3D = new Vector3(shiftUV.x, shiftUV.y, 0)
			const shiftRotated = shiftUV3D.clone().applyQuaternion(inverseQuaternion)
			const shiftLocal = new Vector3(shiftRotated.x / scaleX, shiftRotated.y / scaleY, shiftRotated.z)

			positions.setXYZ(i, localVertex.x + shiftLocal.x, localVertex.y + shiftLocal.y, localVertex.z)
		}

		positions.needsUpdate = true
		this.latticeModified = true
		if (onNeedsRender) {
			onNeedsRender()
		}
	}

	// TODO review correctness
	public destroy(): void {
		this.geometry.dispose()
		if (this.mesh.material instanceof Material) {
			this.mesh.material.dispose()
		}
	}

	public getGeometry(): PlaneGeometry {
		return this.geometry
	}

	public getMesh(): Mesh {
		return this.mesh
	}

	public extractLatticeVertices(): Array<[number, number, number]> {
		const geometry = this.geometry
		const positions = geometry.attributes.position
		const vertices: Array<[number, number, number]> = []
		for (let i = 0; i < positions.count; i++) {
			const x = positions.getX(i)
			const y = positions.getY(i)
			const z = positions.getZ(i)
			vertices.push([x, y, z])
		}
		return vertices
	}

	public applyLatticeVertices(vertices: Array<[number, number, number]>): void {
		const positions = this.geometry.attributes.position
		if (vertices.length !== positions.count) {
			throw new Error(`[LatticeMesh] Vertex count mismatch: expected ${positions.count}, got ${vertices.length}`)
		}

		for (let i = 0; i < positions.count; i++) {
			const [x, y, z] = vertices[i]
			positions.setXYZ(i, x, y, z)
		}
		positions.needsUpdate = true
		this.latticeModified = !this.matchesOriginalPositions(positions.array)
	}

	public isLatticeModified(): boolean {
		return this.latticeModified
	}

	private matchesOriginalPositions(current: ArrayLike<number>): boolean {
		for (let i = 0; i < this.originalPositions.length; i++) {
			if (current[i] !== this.originalPositions[i]) {
				return false
			}
		}
		return true
	}

	public cloneMesh(): Mesh {
		const meshClone = this.mesh.clone()
		meshClone.geometry = this.geometry.clone()
		//@ts-expect-error fuck off, typescript
		meshClone.material = this.mesh.material.clone()
		return meshClone
	}
}
