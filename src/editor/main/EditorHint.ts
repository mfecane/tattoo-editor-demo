export enum EditorHint {
	None = 'none',
	NoMeshesPlaced = 'no-meshes-placed',
	SelectToInspect = 'select-to-inspect',
	PlacementActive = 'placement-active',
	MeshSelectedFlat = 'mesh-selected-flat',
	MeshSelectedWrapped = 'mesh-selected-wrapped',
	WidgetActive = 'widget-active',
}

/** Text shown by the help overlay for each hint - the single place that owns this copy. */
export const EDITOR_HINT_TEXT: Record<EditorHint, string | null> = {
	[EditorHint.None]: null,
	[EditorHint.NoMeshesPlaced]: 'Click a design or project image, select a region, then click on the mesh to place it',
	[EditorHint.SelectToInspect]: 'Click the blue circle to select a placed design',
	[EditorHint.PlacementActive]: 'Click on the body to place the design there',
	[EditorHint.MeshSelectedFlat]: 'Move, resize or rotate it - the wireframe preview shows what wrapping it would produce',
	[EditorHint.MeshSelectedWrapped]: 'Drag a vertex to fine-tune its fit, or Unwrap to edit it freely again',
	[EditorHint.WidgetActive]: 'Drag the handles to adjust, or click its toolbar button again to stop',
}
