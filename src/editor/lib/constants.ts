/**
 * Editor-wide constants
 */

export const EDITOR_CONSTANTS = {
	// Rendering
	CANVAS_SIZE: 1024,
	LATTICE_RENDER_TARGET_SIZE: 2048,

	// Camera
	CAMERA_FOV: 45,
	CAMERA_NEAR: 0.1,
	CAMERA_FAR: 1000,

	// Performance
	BRUSH_THROTTLE_FPS: 60,
	TEXTURE_UPDATE_FPS: 30,

	// Autosave
	AUTOSAVE_DEBOUNCE_MS: 2000,

	// Project defaults
	DEFAULT_OBJECT_TYPE: 'tube' as const,
	DEFAULT_OBJECT_NAME: 'Left Arm',
	SCHEMA_VERSION: '1.0.0',
} as const

export const EDITOR_CANVAS_DROPPABLE_ID = 'editor-canvas'

export enum EditorDragType {
	DESIGN_IMAGE = 'design-image',
	PROJECT_IMAGE = 'project-image',
}

//@ts-expect-error fuck off typescript
export const BASE_URL = import.meta.env.BASE_URL as string
