import { MESH_WRAP_CONSTANTS, VERTEX_SLIDE_CONSTANTS } from '@/editor/constants'
import { SurfaceTangentBasis } from '@/editor/lib/utils/SurfaceTangentBasis'
import { WrapPreviewGhost } from '@/editor/lib/widget/WrapPreviewGhost'
import { Editor } from '@/editor/main/Editor'
import { HistoryController } from '@/editor/main/HistoryController'
import { SketchRegionStore } from '@/editor/main/SketchRegionStore'
import { Piece } from '@/editor/main/PlacedMeshList'
import { PlacedMeshRelaxer } from '@/editor/main/PlacedMeshRelaxer'
import { PlacedMeshWrapper } from '@/editor/main/PlacedMeshWrapper'
import { RegionMeshFactory } from '@/editor/main/RegionMeshFactory'
import { Project } from '@/editor/main/Project'
import { PlacementTool } from '@/editor/main/tools/PlacementTool'
import { SelectTool } from '@/editor/main/tools/SelectTool'
import { TransformTool } from '@/editor/main/tools/TransformTool'
import { EditorToolId, IEditorTool } from '@/editor/main/tools/EditorTool'
import { RegionShape } from '@/editor/polygon/RegionShape'
import { Container } from '@/lib/di/container'
import { BufferGeometry, Intersection, Mesh, Texture, TextureLoader } from 'three'

export interface SketchEditorTarget {
	sketchId: string
	sketchUrl: string
}

export interface EditorState {
	activeToolId: EditorToolId
	selectedPlacedMeshId: string | null
	sketchEditorTarget: SketchEditorTarget | null
}

export class EditorController {
	private state: EditorState = {
		activeToolId: EditorToolId.Select,
		selectedPlacedMeshId: null,
		sketchEditorTarget: null,
	}

	private activeTool: IEditorTool | null = null

	private readonly selectTool: SelectTool
	private readonly transformTool: TransformTool
	private readonly placementTool: PlacementTool

	private pendingPlacement: { mesh: Mesh; sourceShape: RegionShape; texture: Texture; sketchAspect: number } | null = null

	private wrapPreviewDebounceTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map()
	private wrapPreviewGhost: WrapPreviewGhost | null = null
	private wrapPreviewGhostMeshId: string | null = null

	/** Live setting (not undo-tracked), read by SlideVertexInteractionHandler.computeFalloffWeights - see ReactBridge.setSlideVertexFalloffRadius. */
	private slideVertexFalloffRadius: number = VERTEX_SLIDE_CONSTANTS.FALLOFF_RADIUS

	public readonly historyController: HistoryController = new HistoryController(this)

	private subscriptions: Set<() => void> = new Set()

	public readonly project: Project

	public readonly sketchRegionStore: SketchRegionStore = new SketchRegionStore()

	public constructor(
		public readonly editor: Editor,
		private readonly container: Container
	) {
		this.project = new Project()

		this.selectTool = new SelectTool(this.editor)
		this.transformTool = new TransformTool(this.editor, this.container)
		this.placementTool = new PlacementTool(this.editor)
	}

	public getState(): EditorState {
		return this.state
	}

	public subscribe(callback: () => void): () => void {
		this.subscriptions.add(callback)
		return () => this.subscriptions.delete(callback)
	}

	private notifySubscribers(): void {
		for (const cb of this.subscriptions) {
			cb()
		}
	}

	public getActiveTool(): IEditorTool | null {
		return this.activeTool
	}

	public getSelectTool(): SelectTool {
		return this.selectTool
	}

	public getTransformTool(): TransformTool {
		return this.transformTool
	}

	public getPlacementTool(): PlacementTool {
		return this.placementTool
	}

	public setActiveTool(tool: IEditorTool): void {
		if (this.activeTool === tool) return
		if (this.activeTool) {
			this.activeTool.exitTool()
		}
		this.activeTool = tool
		this.state.activeToolId = tool.id
		tool.enterTool()
		this.notifySubscribers()
	}

	public setSelectedPlacedMeshId(id: string | null): void {
		const previousId = this.state.selectedPlacedMeshId
		if (previousId && previousId !== id) {
			this.clearWrapPreview(previousId)
			// Leaving a dirty drapedPatch's edit context - background-bake it now, in the
			// background, no explicit button/spinner. Ignored if it's not a dirty drapedPatch.
			this.editor.patchBaker.scheduleBake(previousId)
		}

		this.state.selectedPlacedMeshId = id
		this.notifySubscribers()

		if (id) {
			const entry = this.project.placedMeshList.getById(id)
			if (entry && entry.kind === 'regionMesh') {
				this.scheduleWrapPreview(id)
			}
		}

		this.syncActiveToolToTarget()
		this.refreshBakeAndVisibility()
	}

	/**
	 * The single boundary for widget lifetime: derives which tool *should* be
	 * active from current selection state and switches into it if it isn't
	 * already. A selected regionMesh always gets the combined TransformTool -
	 * its handles show immediately on selection, there's no separate mode
	 * button - anything else (nothing selected, or a wrapped drapedPatch,
	 * which has no transform handles) falls back to Select, tearing down any
	 * stale widget via that tool's own exitTool(). PlacementTool manages its
	 * own lifecycle explicitly (see beginMeshPlacement/placePendingMeshAt)
	 * and is left alone here. Called from setSelectedPlacedMeshId and from
	 * every HistoryController execute/undo/redo, since those are the only
	 * places domain state (selection, wrapped-ness, mesh existence) can change.
	 */
	public syncActiveToolToTarget(): void {
		if (this.activeTool === this.placementTool) {
			return
		}

		const selected = this.getSelectedPlacedMesh()
		const desiredTool: IEditorTool = selected && selected.kind === 'regionMesh' ? this.transformTool : this.selectTool

		if (this.activeTool !== desiredTool) {
			this.setActiveTool(desiredTool)
			return
		}
		if (this.activeTool === this.selectTool) {
			this.selectTool.reset()
		}
	}

	public getSelectedPlacedMeshId(): string | null {
		return this.state.selectedPlacedMeshId
	}

	public getSelectedPlacedMesh(): Piece | null {
		const selectedPlacedMeshId = this.state.selectedPlacedMeshId
		if (selectedPlacedMeshId === null) {
			return null
		}

		return this.project.placedMeshList.getById(selectedPlacedMeshId)
	}

	public getSlideVertexFalloffRadius(): number {
		return this.slideVertexFalloffRadius
	}

	public setSlideVertexFalloffRadius(radius: number): void {
		this.slideVertexFalloffRadius = radius
	}

	/** Live setting (not undo-tracked), immediately re-composited - see ReactBridge.setPlacedMeshContrast. */
	public setPlacedMeshContrast(id: string, contrast: number): void {
		this.project.placedMeshList.setContrast(id, contrast)
		this.refreshBakeAndVisibility()
	}

	public openRegionEditor(target: SketchEditorTarget): void {
		this.state.sketchEditorTarget = target
		this.notifySubscribers()
	}

	public closeRegionEditor(): void {
		this.state.sketchEditorTarget = null
		this.notifySubscribers()
	}

	public getSketchEditorTarget(): SketchEditorTarget | null {
		return this.state.sketchEditorTarget
	}

	/**
	 * Loads the source image, crops it to the given region, and enters
	 * placement mode with the resulting mesh.
	 */
	public async beginPolygonMeshPlacement(imageUrl: string, shape: RegionShape): Promise<void> {
		const texture = await new TextureLoader().loadAsync(imageUrl)
		const image = texture.image as HTMLImageElement
		const aspect = image.width / image.height

		const regionMesh = RegionMeshFactory.createMesh(shape, texture, aspect)
		this.beginMeshPlacement(regionMesh, shape, texture, aspect)
	}

	/** Enters placement mode: the next click on the body mesh drops this mesh there. */
	public beginMeshPlacement(mesh: Mesh, sourceShape: RegionShape, texture: Texture, sketchAspect: number): void {
		this.pendingPlacement = { mesh, sourceShape, texture, sketchAspect }
		this.setActiveTool(this.placementTool)
	}

	public cancelMeshPlacement(): void {
		this.pendingPlacement = null
	}

	/**
	 * Places the pending mesh's center at the intersection point, oriented
	 * so its local +Z (the flat mesh's face normal) matches the
	 * surface normal. No lattice/curvature wrapping yet - rigid decal only.
	 */
	public placePendingMeshAt(intersection: Intersection): void {
		const pending = this.pendingPlacement
		if (!pending) {
			return
		}
		const { mesh, sourceShape, texture, sketchAspect } = pending

		const surfaceBasis = SurfaceTangentBasis.fromIntersection(intersection, this.editor.previewMesh.mesh)
		if (!surfaceBasis) {
			return
		}

		mesh.position.copy(intersection.point)
		mesh.quaternion.copy(SurfaceTangentBasis.quaternionFromBasis(surfaceBasis))

		this.pendingPlacement = null
		const command = this.editor.commandFactory.createAddPlacedMeshCommand(mesh, sourceShape, texture, sketchAspect)
		this.historyController.execute(command)
		this.setActiveTool(this.selectTool)

		// Select it immediately so its transform handles/context menu show up right away,
		// instead of leaving the user to hunt for the blue select dot after placing. Also force
		// widgets back on - the toggle only ever hides selection handles (it's disabled whenever
		// something is selected), so a prior toggle-off would otherwise leave the new piece's
		// transform handles invisible too. setSelectedPlacedMeshId positions/shows the context menu
		// itself - see ReactBridge.setSelectedPlacedMeshId.
		this.editor.reactBridge.setWidgetsVisible(true)
		const placedMeshId = command.getPlacedMeshId()
		this.editor.reactBridge.setSelectedPlacedMeshId(placedMeshId)
	}

	public deleteSelectedPlacedMesh(): void {
		const selectedPlacedMeshId = this.state.selectedPlacedMeshId
		if (!selectedPlacedMeshId) {
			return
		}
		this.historyController.execute(this.editor.commandFactory.createRemovePlacedMeshCommand(selectedPlacedMeshId))
		this.setSelectedPlacedMeshId(null)
	}

	/** Runs the wrap algorithm on the selected mesh. Returns whether it succeeded, so the UI can react to a failed wrap. */
	public wrapSelectedPlacedMesh(): boolean {
		const selectedPlacedMeshId = this.state.selectedPlacedMeshId
		if (!selectedPlacedMeshId) {
			return false
		}
		const command = this.editor.commandFactory.createWrapPlacedMeshCommand(selectedPlacedMeshId)
		this.historyController.execute(command)
		return command.didSucceed()
	}

	/**
	 * Keeps at most one wrapped placed mesh "live" at a time - the selected
	 * one, rendered as a real mesh so it stays editable, with every other
	 * wrapped mesh hidden and baked into the body texture instead. With
	 * nothing selected, every wrapped mesh is hidden and baked. Not domain
	 * state/undo-tracked - a derived render side effect re-run after anything
	 * that could change what's selected/wrapped/placed (see call sites in
	 * setSelectedPlacedMeshId and HistoryController.execute/undo/redo).
	 */
	public refreshBakeAndVisibility(): void {
		const selectedId = this.state.selectedPlacedMeshId
		for (const entry of this.project.placedMeshList.getAll()) {
			// Flat regionMeshes always visible; wrapped drapedPatches only visible if selected
			entry.mesh.visible = entry.kind === 'regionMesh' || entry.id === selectedId
		}
		this.editor.bodyTextureComposer.compositeAll(selectedId)
	}

	/** Runs the relax pass on the selected drapedPatch and pushes the result as one undoable step - see PlacedMeshRelaxer. */
	public relaxSelectedPlacedMesh(strength: number, iterations: number, boundaryWeight: number): void {
		const selectedPlacedMeshId = this.state.selectedPlacedMeshId
		if (!selectedPlacedMeshId) {
			return
		}
		const entry = this.project.placedMeshList.getById(selectedPlacedMeshId)
		if (!entry || entry.kind !== 'drapedPatch') {
			return
		}

		const beforePositions = Float32Array.from(entry.mesh.geometry.attributes.position.array)
		PlacedMeshRelaxer.relax(entry.mesh, entry.flatBackup!, this.editor.previewMesh.mesh, strength, iterations, boundaryWeight)
		const afterPositions = Float32Array.from(entry.mesh.geometry.attributes.position.array)

		this.historyController.execute(
			this.editor.commandFactory.createUpdateWrappedMeshVerticesCommand(selectedPlacedMeshId, beforePositions, afterPositions)
		)
	}

	public unwrapSelectedPlacedMesh(): void {
		const selectedPlacedMeshId = this.state.selectedPlacedMeshId
		if (!selectedPlacedMeshId) {
			return
		}
		this.historyController.execute(this.editor.commandFactory.createUnwrapPlacedMeshCommand(selectedPlacedMeshId))
	}

	/**
	 * Debounced live wrap-preview: call on every move/rotate/resize of a flat
	 * placed mesh (including mid-drag). Only the actual (expensive) march
	 * runs, 500ms after the last call - not on every call.
	 */
	public scheduleWrapPreview(placedMeshId: string): void {
		const existing = this.wrapPreviewDebounceTimeouts.get(placedMeshId)
		if (existing) {
			clearTimeout(existing)
		}

		const timeoutId = setTimeout(() => {
			this.wrapPreviewDebounceTimeouts.delete(placedMeshId)
			this.runWrapPreview(placedMeshId)
		}, MESH_WRAP_CONSTANTS.PREVIEW_DEBOUNCE_MS)
		this.wrapPreviewDebounceTimeouts.set(placedMeshId, timeoutId)
	}

	/** Cancels any pending/shown preview for this mesh - call when it's deselected, deleted, or wrapped. */
	public clearWrapPreview(placedMeshId: string): void {
		const existingTimeout = this.wrapPreviewDebounceTimeouts.get(placedMeshId)
		if (existingTimeout) {
			clearTimeout(existingTimeout)
			this.wrapPreviewDebounceTimeouts.delete(placedMeshId)
		}

		this.project.placedMeshList.setWrapPreviewValid(placedMeshId, null)

		if (this.wrapPreviewGhostMeshId === placedMeshId) {
			this.wrapPreviewGhost?.hide()
			this.wrapPreviewGhostMeshId = null
		}
	}

	/**
	 * Shows a computed wrap attempt (success or failure) on the ghost - never
	 * on the real mesh, which stays flat and untouched until a wrap actually
	 * commits. Used by both the debounced preview and a failed Wrap click, so
	 * a failure never needs its own separate flash-then-revert on the real mesh.
	 */
	public showWrapAttemptResult(placedMeshId: string, geometry: BufferGeometry, success: boolean): void {
		const entry = this.project.placedMeshList.getById(placedMeshId)
		if (!entry) {
			geometry.dispose()
			return
		}

		this.project.placedMeshList.setWrapPreviewValid(placedMeshId, success)
		if (!this.wrapPreviewGhost) {
			this.wrapPreviewGhost = new WrapPreviewGhost(this.editor.previewScene)
		}
		this.wrapPreviewGhost.update(entry.mesh, geometry, success)
		this.wrapPreviewGhostMeshId = placedMeshId

		this.notifySubscribers()
	}

	private runWrapPreview(placedMeshId: string): void {
		// Selection may have moved on by the time the debounce fires.
		if (this.state.selectedPlacedMeshId !== placedMeshId) {
			return
		}

		const entry = this.project.placedMeshList.getById(placedMeshId)
		if (!entry || entry.kind === 'drapedPatch') {
			this.clearWrapPreview(placedMeshId)
			return
		}

		const preview = PlacedMeshWrapper.preview(entry.mesh, this.editor.previewMesh.mesh)
		if (!preview) {
			this.clearWrapPreview(placedMeshId)
			return
		}

		this.showWrapAttemptResult(placedMeshId, preview.geometry, preview.success)
	}
}
