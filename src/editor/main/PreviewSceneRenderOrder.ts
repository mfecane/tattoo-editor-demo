/**
 * Explicit Three.js renderOrder values for everything added to `Editor.previewScene`
 * (the main 3D scene - body, placed decals, wrap preview). Deliberately not used for
 * `overlayScene` (widgets/handles), which is a separate render pass with its own ordering.
 *
 * Higher draws later/on top. Gaps are left between values so a new layer can be inserted
 * without renumbering everything else.
 */
export enum PreviewSceneRenderOrder {
	Body = 0,
	PlacedMesh = 10,
	WrapPreviewGhost = 20,
}
