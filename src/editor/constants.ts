/**
 * Editor-wide constants
 */

export const EDITOR_CONSTANTS = {
	// Camera
	CAMERA_FOV: 45,
	CAMERA_NEAR: 0.1,
	CAMERA_FAR: 1000,

	// Distance from the camera at which a screen-space-scaled widget's authored geometry size
	// (e.g. a handle's SphereGeometry radius) looks correct - roughly the camera's starting
	// distance from the origin. Scale grows/shrinks linearly with distance from here, which for
	// a perspective camera exactly cancels out the distance-based apparent-size falloff, so the
	// widget stays the same size on screen regardless of zoom/distance.
	WIDGET_REFERENCE_DISTANCE: 3,
} as const

export const REGION_EDITOR_CONSTANTS = {
	MIN_VERTICES: 3,

	// Empty margin (screen px) kept between the sketch image and the pixi viewport's edge.
	VIEWPORT_PADDING: 32,

	// Invisible per-vertex hit collider, deliberately larger than the visible dot.
	VERTEX_COLLIDER_RADIUS: 14,
	EDGE_HIT_DISTANCE: 8,
	CLOSE_HIT_RADIUS: 12,
	DRAG_THRESHOLD: 4,
	// Below this drag distance (same canvas-pixel units as DRAG_THRESHOLD), a drawn rect is
	// considered degenerate/accidental and discarded instead of finalized.
	MIN_RECT_SIZE: 8,

	SELECTED_VERTEX_RADIUS: 7,
	UNSELECTED_VERTEX_RADIUS: 5,
	SELECTED_VERTEX_COLOR: 0xffffff,
	UNSELECTED_VERTEX_COLOR: 0xc7cbd1,

	SELECTED_STROKE_WIDTH: 2.5,
	UNSELECTED_STROKE_WIDTH: 1.5,
	SELECTED_STROKE_COLOR: 0x3bd914,
	UNSELECTED_STROKE_COLOR: 0x58bbf5,
	SELECTED_FILL_COLOR: 0x3bd914,
	UNSELECTED_FILL_COLOR: 0x58bbf5,
	SELECTED_FILL_ALPHA: 0.15,
	UNSELECTED_FILL_ALPHA: 0.06,
} as const

export const POLYGON_MESH_CONSTANTS = {
	// World units spanning the source image's longer dimension. Real-world
	// calibration isn't wired up yet - this is just a plausible starting size.
	WORLD_SIZE: 0.4,

	// Spacing (world units) of the interior Steiner-point grid seeded before poly2tri's
	// constrained Delaunay triangulation - see PolygonTessellator. This is what gives the
	// tessellation its interior density now, replacing the old midpoint-subdivision pass.
	STEINER_GRID_SPACING: 0.04,
} as const

export const MESH_WRAP_CONSTANTS = {
	// How far off the surface (along the marching normal) reprojection rays are cast from, in world units.
	SEARCH_OFFSET: 0.5,
	// Total ray length, must exceed 2x SEARCH_OFFSET so it can cross the surface from either side.
	SEARCH_DISTANCE: 1.5,

	// A marched triangle smaller than this fraction of the wrapped mesh's average triangle area is degenerate.
	MIN_TRIANGLE_AREA_RATIO: 0.05,
	// Total wrapped/flat surface-area ratio outside [MIN, MAX] is treated as a distortion blowup.
	MAX_DISTORTION_RATIO: 4.0,
	MIN_DISTORTION_RATIO: 0.15,
	// Minimum dot product between two edge-adjacent triangles' normals before it's a self-fold
	// (-1 = pointing directly opposite). Local, not compared against a mesh-wide average, so
	// gradual real curvature (wrapping most of the way around an arm) doesn't false-positive.
	MIN_ADJACENT_NORMAL_DOT: -0.3,

	// Live wrap-preview ghost: recomputed this long after the last move/rotate/resize of a flat mesh.
	PREVIEW_DEBOUNCE_MS: 500,
	PREVIEW_VALID_COLOR: 0x22cc66,
	PREVIEW_INVALID_COLOR: 0xdd3333,

	AUTO_RELAX_STRENGTH: 0.5,
	AUTO_RELAX_ITERATIONS: 3,
	AUTO_RELAX_BOUNDARY_WEIGHT: 1,
} as const

export const MESH_BAKE_CONSTANTS = {
	// Resolution (both dimensions) of the baked color map and the composed body texture - see PatchBaker/BodyTextureComposer.
	BAKE_RESOLUTION: 4096,
} as const

export const RAYCAST_UV_SEARCH_CONSTANTS = {
	// World-space distance the patch's expanded-copy geometry is pushed out along its vertex
	// normals before raycasting - see GeometryUtils.push. Gives body vertices near the patch's
	// silhouette (but just outside its raw footprint) something to still hit.
	NORMAL_MARGIN: 0.02,

	// UV-space (and matching world-space) distance the patch's boundary rim is grown outward -
	// see GeometryUtils.growBoundaryEdges. Extrapolates a ring of triangles/UVs past the patch's
	// original edge so raycasts landing just past the boundary still resolve a source UV.
	BOUNDARY_GROWTH: 0.08,
} as const

export const VERTEX_SLIDE_CONSTANTS = {
	// Radius of the vertex dots rendered over a selected, wrapped mesh.
	POINT_SIZE: 0.008,
	POINT_COLOR: 0x00ff00,
	HOVER_COLOR: 0xffff00,

	// Influence-heatmap gradient shown on the vertex dots while dragging: weight 0 fades to the
	// base point color (no influence), weight 1 is the grabbed vertex itself.
	INFLUENCE_COLOR_LOW: 0x2244ff,
	INFLUENCE_COLOR_HIGH: 0xff2200,

	// Local-space graph-distance radius (mesh spans ~POLYGON_MESH_CONSTANTS.WORLD_SIZE) within
	// which dragging one vertex also nudges its neighbors, tapering off with distance.
	FALLOFF_RADIUS: 0.15,

	// World-space distance (from the body-mesh hit point to the nearest decal vertex) beyond which
	// a click is considered "not on a vertex" - falls through to no hit at all, so orbit rotation
	// takes over instead of grabbing a distant vertex. See HitTester.testWrappedMeshVertex.
	VERTEX_PICK_MAX_DISTANCE: 0.03,

	// Wireframe overlay of the selected wrapped mesh's actual triangle edges.
	WIREFRAME_COLOR: 0xff8800,
} as const

export const PLACED_MESH_CONSTANTS = {
	// World units per NDC unit of screen-space drag.
	MOVE_SENSITIVITY: 1.0,
	// Same drag-to-scale formula the old stamp resize handler used, applied to a scale multiplier instead of UV size.
	SCALING_FACTOR: 3,
	MIN_SCALE: 0.1,
	MAX_SCALE: 5,
} as const

//@ts-expect-error fuck off typescript
export const BASE_URL = import.meta.env.BASE_URL as string
