export const RESIZE_CONSTANTS = {
	SCALING_FACTOR: 3,
	MIN_SIZE: 10,
} as const

export const MOVE_CONSTANTS = {
	SENSITIVITY: 0.5, // Sensitivity factor for UV movement
} as const

export const BRUSH_CONSTANTS = {
	INFLUENCE_RADIUS: 0.2, // UV units
	STRENGTH: 0.02, // How much vertices move per pixel of mouse movement
	EPSILON: 0.000001, // Minimum influence threshold
	SHOW_BRUSH_STROKES: false, // Enable brush stroke visualization
} as const

