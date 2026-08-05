/**
 * Determines which move/resize/rotate handles are enabled on a widget.
 * Currently RigidMeshStrategy is the only implementation (placed meshes
 * always allow everything) - kept as an interface so a future entity
 * type with real constraints doesn't require touching the widget classes.
 */
export interface WidgetStrategy {
	canMoveCenter(): boolean
	canResizeX(): boolean
	canResizeY(): boolean
	canResizeCorners(): boolean
	canRotate(): boolean
}
