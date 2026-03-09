import { LatticeMesh } from '@/editor/lib/lattice/LatticeMesh'
import { Editor } from '@/editor/main/Editor'
import { SerializableStampInfo } from '@/editor/main/SerializableStampInfo'
import { GeometryProjectionService } from '@/editor/services/GeometryProjectionService'
import { StampImageStorage } from '@/editor/services/StampImageStorage'
import { SerializableStampData, SerializableStampData2, StampInfo } from '@/editor/types/projectTypes'
import { container } from '@/lib/di/container'
import { Vector2, Vector3 } from 'three'
import { v7 as uuid } from 'uuid'

export class RuntimeStampFactory {
	public constructor(private readonly editor: Editor) {}

	public createNew(data: Omit<SerializableStampData2, 'id'> & { id?: string }): RuntimeStamp {
		if (!data.stampInfo.uv) {
			throw new Error('[RuntimeStampFactory] StampInfo.uv is required')
		}
		const latticeModified = data.latticeModified ?? false
		return new RuntimeStamp(
			{
				...data,
				latticeModified,
				id: uuid(),
			},
			this.editor
		)
	}

	public createFromSerializable(data: SerializableStampData): RuntimeStamp {
		data.stampInfo = this.deserializeStampInfo(data.stampInfo)
		if (!data.stampInfo.uv) {
			throw new Error('[RuntimeStampFactory] StampInfo.uv is required')
		}
		return new RuntimeStamp(
			{
				...data,
				latticeModified: data.latticeModified ?? data.lattice !== undefined,
			} as SerializableStampData2,
			this.editor
		)
	}

	private deserializeStampInfo(stampInfo: SerializableStampInfo): StampInfo {
		return {
			uv: new Vector2(stampInfo.uv.x, stampInfo.uv.y),
			sizeX: stampInfo.sizeX,
			sizeY: stampInfo.sizeY,
			rotation: stampInfo.rotation,
		}
	}
}

// Cursor, do not edit, if you have urge to edit this class, please ask me first
export class RuntimeStamp {
	public latticeMesh: LatticeMesh
	public resolvedImage?: HTMLImageElement
	public dirty: boolean = true

	private readonly imageStorage: StampImageStorage

	public constructor(
		public data: SerializableStampData2,
		private readonly editor: Editor
	) {
		this.latticeMesh = new LatticeMesh(data)
		this.imageStorage = this.editor.getStampImageStorage()

		this.updateData(data)
	}

	public updateData(data: SerializableStampData2): void {
		this.data = data
		this.latticeMesh.updateTransform(data.stampInfo, data.projectionType)
		this.latticeMesh.setPositions(data)
		this.imageStorage.createImage(data.sourceImage.hash, data.sourceImage.source)
		this.dirty = true
	}

	public async update(): Promise<void> {
		this.resolvedImage = await this.imageStorage.getImage(this.data.sourceImage.hash).getImageElement()
		this.latticeMesh.setImage(this.resolvedImage)
		this.dirty = false
	}

	public hasRuntime(): boolean {
		return this.latticeMesh !== null && this.resolvedImage !== undefined
	}

	public destroy(): void {
		this.latticeMesh.destroy()
		this.resolvedImage = undefined
	}

	public getPosition3D(): Vector3 {
		const asset = this.editor.previewMesh.mesh
		const geometryProjectionService = container.resolve<GeometryProjectionService>('GeometryProjectionService')
		const position = geometryProjectionService.getPositionFromUV(asset.geometry, asset, this.data.stampInfo.uv)
		if (!position) {
			throw new Error(
				`[RuntimeStamp] Could not resolve 3D position for UV (${this.data.stampInfo.uv.x}, ${this.data.stampInfo.uv.y})`
			)
		}
		return position
	}

	public serialize(): SerializableStampData {
		const latticeModified = this.latticeMesh.isLatticeModified()
		return {
			...this.data,
			latticeModified,
			lattice: latticeModified
				? {
						vertices: this.latticeMesh.extractLatticeVertices(),
					}
				: undefined,
			stampInfo: this.serializeStampInfo(this.data.stampInfo),
		}
	}

	private serializeStampInfo(stampInfo: StampInfo): SerializableStampInfo {
		return {
			uv: {
				x: stampInfo.uv.x,
				y: stampInfo.uv.y,
			},
			sizeX: stampInfo.sizeX,
			sizeY: stampInfo.sizeY,
			rotation: stampInfo.rotation,
		}
	}
}
