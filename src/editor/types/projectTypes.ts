import { LatticeMesh } from '@/editor/lib/lattice/LatticeMesh'
import { SerializableStampInfo } from '@/editor/main/SerializableStampInfo'
import type { Group, Vector2 } from 'three'

export type ObjectType = 'tube' | 'cylinder' | 'plane' | 'custom'

export type ProjectionType = 'stamp' | 'cylindrical-lattice'

export type ImageSource = 'project' | 'design'

export interface ProjectObject {
	type: ObjectType
	name?: string
}

export interface SourceImage {
	hash: string
	source: ImageSource
}

export interface StampInfo {
	uv: Vector2
	sizeX: number
	sizeY: number
	rotation: number
}

export interface LatticeData {
	vertices: Array<[number, number, number]>
}

/** Serializable stamp data for editor state; only commands and initial load mutate. */
export interface SerializableStampData {
	id: string
	projectionType: ProjectionType
	stampInfo: SerializableStampInfo
	sourceImage: SourceImage
	latticeModified: boolean
	lattice?: LatticeData
}

export interface SerializableStampData2 {
	id: string
	projectionType: ProjectionType
	stampInfo: StampInfo
	sourceImage: SourceImage
	latticeModified: boolean
	lattice?: LatticeData
}

export interface StampData {
	id: string
	projectionType: ProjectionType
	stampInfo: StampInfo
	latticeMesh: LatticeMesh
	sourceImage: HTMLImageElement | SourceImage
	imageHandle: Group | null
	latticeModified: boolean
	lattice?: LatticeData
}

export interface CameraData {
	position: { x: number; y: number; z: number }
	target: { x: number; y: number; z: number }
}

export interface RenderData {
	id: string
	hash: string
	createdAt: string // ISO 8601 timestamp
	camera?: CameraData // Camera state when render was created
}

// Editor project schema - pure 3D editor data structure
export interface EditorProject {
	version: string
	object: ProjectObject
	stamps: SerializableStampData[]
	camera?: CameraData
	renders?: RenderData[]
}

// API/database record - includes metadata + editor project
export interface ProjectRecord {
	id: string
	userId: string
	designId: string
	projectData: EditorProject | {}
	images: string[]
	createdAt: string
	updatedAt: string
}

export interface DesignImageItemWithUrl {
	hash: string
	active: boolean
	order: number
	resolvedUrl: string
	cover?: boolean
}
