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
	/** Whether the selected piece has ever been wrapped (applied) before - drives the discard-confirmation copy below. */
	selectedPlacedMeshEverWrapped: boolean
	/** Whether the live wrap-preview ghost currently shown for the selected flat mesh would succeed. Null until the debounced preview has run once. */
	selectedPlacedMeshWrapPreviewValid: boolean | null
	/** Whether the "discard this not-yet-applied piece?" confirmation is open - see guardAgainstUnresolvedPlacement. */
	discardConfirmVisible: boolean
	regionEditorTarget: SketchEditorTarget | null
	sketchEditorTarget?: { sketchId: string; sketchUrl: string } | null
	hint: EditorHint
	/** Whether the editor container's whole-screen blocking spinner should show - any long-running background operation (currently just PatchBaker) can drive it. */
	blocking: boolean
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
		selectedPlacedMeshEverWrapped: false,
		selectedPlacedMeshWrapPreviewValid: null,
		discardConfirmVisible: false,
		regionEditorTarget: null,
		hint: EditorHint.NoMeshesPlaced,
		blocking: false,
	}

	// External subscriptions used by useReactBridge.
	public callbacks: Set<() => void> = new Set()
	private controlsListenerAttached: boolean = false
	private readonly handleControlsChange = (): void => this.refreshSelectionContextMenuPosition()
	/** Action deferred behind the discard confirmation - see guardAgainstUnresolvedPlacement/confirmDiscard/cancelDiscard. */
	private pendingGuardedAction: (() => void) | null = null

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
		this.editor.patchBaker.addOnBakingChangeListener((baking) => this.updateState({ blocking: baking }))
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

	public handleDelete(): void {
		this.editor.controller.deleteSelectedPlacedMesh()
		this.setSelectionContextMenuPosition(null)
		this.updateState({
			selectedPlacedMeshId: null,
			selectedPlacedMeshWrapped: false,
			selectedPlacedMeshEverWrapped: false,
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
	/** Selecting always drives the context menu along with it - callers never position/show it themselves, so there's no step to forget (see refreshSelectionContextMenuPosition/setSelectionContextMenuPosition). */
	public setSelectedPlacedMeshId(placedMeshId: string | null): void {
		this.editor.controller.setSelectedPlacedMeshId(placedMeshId)
		this.updateState({ selectedPlacedMeshId: placedMeshId })
		this.refreshSelectionMirror()
		this.refreshHint()
		if (placedMeshId) {
			this.refreshSelectionContextMenuPosition()
		} else {
			this.setSelectionContextMenuPosition(null)
		}
	}

	/**
	 * Guards any action that would abandon a selected regionMesh still in placement mode (not yet
	 * applied/wrapped) - starting a new placement, selecting a different piece, clicking away on
	 * the canvas. There must never be more than one unresolved piece at a time, so instead of
	 * running the action right away this defers it behind the discard confirmation; nothing else
	 * selected, or the selected piece already a wrapped drapedPatch, runs it immediately. See
	 * confirmDiscard/cancelDiscard, requestSelectPlacedMesh, openRegionEditor and
	 * PlacementGuardInteractionHandler - every entry point that can move the user away from the
	 * selected piece goes through this.
	 */
	private guardAgainstUnresolvedPlacement(action: () => void): void {
		const selected = this.editor.controller.getSelectedPlacedMesh()
		if (selected && selected.kind === 'regionMesh') {
			this.pendingGuardedAction = action
			this.updateState({ discardConfirmVisible: true })
			return
		}
		action()
	}

	/** The one path clicks (canvas or UI) should use to change selection - see guardAgainstUnresolvedPlacement. */
	public requestSelectPlacedMesh(nextPlacedMeshId: string | null): void {
		// Re-clicking the already-selected piece isn't "moving away" from it - let it through
		// unguarded, same as before this piece could ever need confirming.
		if (this.editor.controller.getSelectedPlacedMeshId() === nextPlacedMeshId) {
			this.setSelectedPlacedMeshId(nextPlacedMeshId)
			return
		}
		this.guardAgainstUnresolvedPlacement(() => this.setSelectedPlacedMeshId(nextPlacedMeshId))
	}

	public confirmDiscard(): void {
		this.handleDelete()
		this.updateState({ discardConfirmVisible: false })
		const action = this.pendingGuardedAction
		this.pendingGuardedAction = null
		action?.()
	}

	public cancelDiscard(): void {
		this.pendingGuardedAction = null
		this.updateState({ discardConfirmVisible: false })
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

	/** Mirrors the controller's real activeToolId - the only source of truth for which tool is active. Selecting a placed mesh (see setSelectedPlacedMeshId) is what actually drives it, via EditorController.syncActiveToolToTarget - there's no separate `updateState({ tool: ... })` here to forget or get out of sync. */
	private refreshTool(): void {
		this.updateState({ tool: this.editor.controller.getState().activeToolId })
	}

	/** Re-reads wrapped/everWrapped/wrapPreviewValid off the selected entry - the source of truth for all three lives on Piece, not in this cached UI state. */
	private refreshSelectionMirror(): void {
		const entry = this.editor.controller.getSelectedPlacedMesh()
		this.updateState({
			selectedPlacedMeshWrapped: entry?.kind === 'drapedPatch',
			selectedPlacedMeshEverWrapped: entry?.everWrapped ?? false,
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

		if (activeToolId === EditorToolId.Transform) {
			this.setHint(EditorHint.WidgetActive)
			return
		}

		if (!this.state.selectedPlacedMeshId) {
			this.setHint(EditorHint.SelectToInspect)
			return
		}

		// Reaching here with a selection means Select is still the active tool despite something
		// being selected - only possible for a wrapped drapedPatch, since selecting a flat
		// regionMesh always switches into Transform (see EditorController.syncActiveToolToTarget)
		// and is caught by the activeToolId !== Select branch above.
		this.setHint(EditorHint.MeshSelectedWrapped)
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
	/** Clicking a sketch to place another piece is itself a "move away" from an unresolved regionMesh - see guardAgainstUnresolvedPlacement. */
	public openRegionEditor(sketchId: string, sketchUrl: string): void {
		this.guardAgainstUnresolvedPlacement(() => {
			this.editor.controller.openRegionEditor({ sketchId, sketchUrl })
			this.updateState({ sketchEditorTarget: { sketchId, sketchUrl } })
		})
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

	public setPlacedMeshContrast(id: string, contrast: number): void {
		this.editor.controller.setPlacedMeshContrast(id, contrast)
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
