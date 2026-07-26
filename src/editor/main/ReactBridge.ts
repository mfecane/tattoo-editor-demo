import { VERTEX_SLIDE_CONSTANTS } from '@/editor/constants'
import { worldToScreen } from '@/editor/lib/utils'
import { Editor } from '@/editor/main/Editor'
import { EDITOR_HINT_TEXT, EditorHint } from '@/editor/main/EditorHint'
import { SketchEditorTarget } from '@/editor/main/EditorController'
import { EditorToolId } from '@/editor/main/tools/EditorTool'
import { RegionShape } from '@/editor/polygon/RegionShape'
import { Vector2 } from 'three'

interface EditorUIState {
	selectionContextMenuVisible: boolean
	selectionContextMenuPosition: Vector2 | null
	tool: EditorToolId
	widgetsVisible: boolean
	lightRotation: number
	slideVertexFalloffRadius: number
	selectedPlacedMeshId: string | null
	selectedPlacedMeshWrapped: boolean
	/** Whether the live wrap-preview ghost currently shown for the selected flat mesh would succeed. Null until the debounced preview has run once. */
	selectedPlacedMeshWrapPreviewValid: boolean | null
	regionEditorTarget: SketchEditorTarget | null
	sketchEditorTarget?: { sketchId: string; sketchUrl: string } | null
	hint: EditorHint
}

export class ReactBridge {
	// Shared UI snapshot consumed by React components.
	public state: EditorUIState = {
		selectionContextMenuVisible: false,
		selectionContextMenuPosition: null,
		tool: EditorToolId.Select,
		widgetsVisible: true,
		lightRotation: 0,
		slideVertexFalloffRadius: VERTEX_SLIDE_CONSTANTS.FALLOFF_RADIUS,
		selectedPlacedMeshId: null,
		selectedPlacedMeshWrapped: false,
		selectedPlacedMeshWrapPreviewValid: null,
		regionEditorTarget: null,
		hint: EditorHint.NoMeshesPlaced,
	}

	// External subscriptions used by useReactBridge.
	public callbacks: Set<() => void> = new Set()
	private controlsListenerAttached: boolean = false
	private readonly handleControlsChange = (): void => this.refreshSelectionContextMenuPosition()

	public constructor(public readonly editor: Editor) {
		this.editor.controller.subscribe(() => {
			// The one place `tool` gets refreshed - every path that changes the active tool
			// (including EditorController.syncActiveToolToTarget's forced fallback to Select,
			// which no action method here calls directly) goes through EditorController.setActiveTool,
			// which always notifies here. Deriving from controller.getState() instead of mirroring
			// it ad hoc in each action method is what keeps the toolbar highlight from ever
			// going stale/desynced from the real active tool.
			this.refreshTool()
			// Catches wrap-preview updates from the debounced ghost recompute, which mutates the
			// controller and notifies but has no ReactBridge call site of its own.
			this.refreshSelectionMirror()
			this.refreshHint()
			this.notifySubscribers()
		})
		this.editor.controller.historyController.subscribe(() => this.notifySubscribers())
		this.refreshTool()
		this.refreshHint()
	}

	public applyInitialViewSettings(): void {
		this.editor.overlayScene.visible = this.state.widgetsVisible
		this.editor.setLightRotation(this.state.lightRotation)
		this.editor.setBackgroundRotation(this.state.lightRotation)
		this.editor.controller.setSlideVertexFalloffRadius(this.state.slideVertexFalloffRadius)
	}

	// Core bridge subscription lifecycle.
	public subscribe(callback: () => void): () => void {
		this.callbacks.add(callback)
		return () => this.callbacks.delete(callback)
	}

	public bindControlsListeners(): void {
		if (this.controlsListenerAttached) {
			return
		}

		this.editor.controls.addEventListener('change', this.handleControlsChange)
		this.controlsListenerAttached = true
	}

	public unbindControlsListeners(): void {
		if (!this.controlsListenerAttached) {
			return
		}

		this.editor.controls.removeEventListener('change', this.handleControlsChange)
		this.controlsListenerAttached = false
	}

	// Shared state merge helper.
	public updateState(state: Partial<EditorUIState>): void {
		this.state = {
			...this.state,
			...state,
		}
		this.notifySubscribers()
	}

	// Read-only bridge queries.
	public getState(): EditorUIState {
		return this.state
	}

	public getHistoryState(): { canUndo: boolean; canRedo: boolean } {
		return this.editor.controller.historyController.getState()
	}

	// Tool selection actions. Each just tells the controller to switch tools - controller.subscribe
	// (see constructor) is what mirrors the resulting activeToolId into state.tool, so there's no
	// separate `updateState({ tool: ... })` here to forget or get out of sync.
	public setSelectTool(): void {
		this.editor.controller.setActiveTool(this.editor.controller.getSelectTool())
	}

	public handleMove(): void {
		this.editor.controller.setActiveTool(this.editor.controller.getMoveTool())
	}

	public handleResize(): void {
		this.editor.controller.setActiveTool(this.editor.controller.getScaleTool())
	}

	public handleRotate(): void {
		this.editor.controller.setActiveTool(this.editor.controller.getRotateTool())
	}

	public handleDelete(): void {
		this.editor.controller.deleteSelectedPlacedMesh()
		this.setSelectionContextMenuPosition(null)
		this.updateState({
			selectedPlacedMeshId: null,
			selectedPlacedMeshWrapped: false,
			selectedPlacedMeshWrapPreviewValid: null,
		})
		this.refreshHint()
	}

	// View settings actions.
	public setWidgetsVisible(visible: boolean): void {
		this.editor.overlayScene.visible = visible
		this.updateState({
			widgetsVisible: visible,
		})
	}

	public setLightRotation(rotation: number): void {
		this.editor.setLightRotation(rotation)
		this.editor.setBackgroundRotation(rotation)
		this.updateState({
			lightRotation: rotation,
		})
	}

	public setSlideVertexFalloffRadius(radius: number): void {
		this.editor.controller.setSlideVertexFalloffRadius(radius)
		this.updateState({
			slideVertexFalloffRadius: radius,
		})
	}

	// Placed-mesh selection + context menu actions.
	public setSelectedPlacedMeshId(placedMeshId: string | null): void {
		this.editor.controller.setSelectedPlacedMeshId(placedMeshId)
		this.updateState({ selectedPlacedMeshId: placedMeshId })
		this.refreshSelectionMirror()
		this.refreshHint()
	}

	public handleWrap(): void {
		this.editor.controller.wrapSelectedPlacedMesh()
		this.refreshSelectionMirror()
		this.refreshHint()
	}

	public handleUnwrap(): void {
		this.editor.controller.unwrapSelectedPlacedMesh()
		this.refreshSelectionMirror()
		this.refreshHint()
	}

	public handleRelax(strength: number, iterations: number, boundaryWeight: number): void {
		this.editor.controller.relaxSelectedPlacedMesh(strength, iterations, boundaryWeight)
	}

	/** Mirrors the controller's real activeToolId - the only source of truth for which tool is active, never mutated independently by an action method (see setSelectTool/handleMove/handleResize/handleRotate). */
	private refreshTool(): void {
		this.updateState({ tool: this.editor.controller.getState().activeToolId })
	}

	/** Re-reads wrapped/wrapPreviewValid off the selected entry - the source of truth for both lives on Piece, not in this cached UI state. */
	private refreshSelectionMirror(): void {
		const entry = this.editor.controller.getSelectedPlacedMesh()
		this.updateState({
			selectedPlacedMeshWrapped: entry?.kind === 'drapedPatch',
			selectedPlacedMeshWrapPreviewValid: entry?.wrapPreviewValid ?? null,
		})
	}

	// Help overlay hint.
	public setHint(hint: EditorHint): void {
		if (this.state.hint === hint) {
			return
		}
		this.updateState({ hint })
	}

	public getHintText(): string | null {
		return EDITOR_HINT_TEXT[this.state.hint]
	}

	/** Derives the current hint from controller state - called at every meaningful transition (tool/selection/wrap changes) instead of being tracked as its own independent piece of state. */
	private refreshHint(): void {
		const activeToolId = this.editor.controller.getState().activeToolId

		if (this.editor.controller.project.placedMeshList.getAll().length === 0) {
			this.setHint(EditorHint.NoMeshesPlaced)
			return
		}

		if (activeToolId === EditorToolId.Placement) {
			this.setHint(EditorHint.PlacementActive)
			return
		}

		if (activeToolId !== EditorToolId.Select) {
			this.setHint(EditorHint.WidgetActive)
			return
		}

		if (!this.state.selectedPlacedMeshId) {
			this.setHint(EditorHint.SelectToInspect)
			return
		}

		this.setHint(this.state.selectedPlacedMeshWrapped ? EditorHint.MeshSelectedWrapped : EditorHint.MeshSelectedFlat)
	}

	public refreshSelectionContextMenuPosition(): void {
		const worldPosition = this.editor.controller.getSelectedPlacedMesh()?.mesh.position
		if (!worldPosition) {
			return
		}

		const screenPos = worldToScreen(worldPosition, this.editor.camera, this.editor.getDomElement())
		this.updateState({
			selectionContextMenuPosition: new Vector2(screenPos.x, screenPos.y),
			selectionContextMenuVisible: true,
		})
	}

	public setSelectionContextMenuPosition(position: Vector2 | null): void {
		this.updateState({
			selectionContextMenuPosition: position,
			selectionContextMenuVisible: position !== null,
		})
	}

	// Region editor actions.
	public openRegionEditor(sketchId: string, sketchUrl: string): void {
		this.editor.controller.openRegionEditor({ sketchId, sketchUrl })
		this.updateState({ sketchEditorTarget: { sketchId, sketchUrl } })
	}

	public closeRegionEditor(): void {
		this.editor.controller.closeRegionEditor()
		this.updateState({ sketchEditorTarget: null })
	}

	public async placeSelectedPolygonOnMesh(imageUrl: string, shape: RegionShape): Promise<void> {
		await this.editor.controller.beginPolygonMeshPlacement(imageUrl, shape)
		this.closeRegionEditor()
	}

	public getStoredRegions(sketchId: string): RegionShape[] {
		return this.editor.controller.sketchRegionStore.getRegions(sketchId)
	}

	public persistRegions(sketchId: string, regions: RegionShape[]): void {
		this.editor.controller.historyController.execute(
			this.editor.commandFactory.createPersistRegionsCommand(sketchId, regions)
		)
	}

	public getPlacedMeshes() {
		return this.editor.controller.project.placedMeshList.getAll()
	}

	public movePlacedMesh(fromIndex: number, toIndex: number): void {
		this.editor.controller.project.placedMeshList.moveEntry(fromIndex, toIndex)
		this.notifySubscribers()
	}

	public getRenderer() {
		return this.editor.renderer
	}

	private notifySubscribers(): void {
		for (const callback of this.callbacks) {
			callback()
		}
	}
}
