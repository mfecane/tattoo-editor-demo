export type ObjectType = 'tube' | 'cylinder' | 'plane' | 'custom'

export interface ProjectObject {
	type: ObjectType
	name?: string
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

// Editor project schema - pure 3D editor data structure. No placed-mesh
// persistence yet (see Project.ts) - meshes only live for the session.
export interface EditorProject {
	version: string
	object: ProjectObject
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
