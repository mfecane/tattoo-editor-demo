import { worldToScreen } from '@/editor/lib/utils'
import { Editor } from '@/editor/main/Editor'
import { RuntimeStamp } from '@/editor/main/RuntimeStamp'
import { EditorToolId } from '@/editor/main/tools/EditorTool'
import { Vector2 } from 'three'

interface EditorUIState {
	stampContextMenuVisible: boolean
	stampContextMenuPosition: Vector2 | null
	isBrushMode: boolean
	isBrushActive: boolean
	tool: EditorToolId
	brushSize: number
	brushStrength: number
	widgetsVisible: boolean
	lightRotation: number
	selectedStampId: string | null
	stamps: RuntimeStamp[]
}

export class ReactBridge {
	// Shared UI snapshot consumed by React components.
	public state: EditorUIState = {
		stampContextMenuVisible: false,
		stampContextMenuPosition: null,
		isBrushMode: false,
		isBrushActive: false,
		tool: EditorToolId.Select,
		brushSize: 0.2,
		brushStrength: 0.02,
		widgetsVisible: true,
		lightRotation: 0,
		selectedStampId: null,
		stamps: [],
	}

	// External subscriptions used by useReactBridge.
	public callbacks: Set<() => void> = new Set()
	private controlsListenerAttached: boolean = false
	private readonly handleControlsChange = (): void => this.refreshStampContextMenuPosition()

	public constructor(public readonly editor: Editor) {
		this.editor.controller.subscribe(() => this.notifySubscribers())
		this.editor.controller.historyController.subscribe(() => this.notifySubscribers())
		this.editor.controller.project.stampList.setOnUpdateCallback(() => this.update())
	}

	public applyInitialViewSettings(): void {
		this.editor.overlayScene.visible = this.state.widgetsVisible
		this.editor.setLightRotation(this.state.lightRotation)
		this.editor.setBackgroundRotation(this.state.lightRotation)
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

	// Tool selection actions.
	public setSelectTool(): void {
		this.editor.controller.setActiveTool(this.editor.controller.getSelectTool())
		this.updateState({ tool: EditorToolId.Select })
	}

	public handleMove(): void {
		this.editor.controller.setActiveTool(this.editor.controller.getMoveTool())
		this.updateState({ tool: EditorToolId.Move })
	}

	public handleResize(): void {
		this.editor.controller.setActiveTool(this.editor.controller.getScaleTool())
		this.updateState({ tool: EditorToolId.Scale })
	}

	public handleRotate(): void {
		this.editor.controller.setActiveTool(this.editor.controller.getRotateTool())
		this.updateState({ tool: EditorToolId.Rotate })
	}

	public handleDelete(): void {
		const selectedIndex = this.editor.controller.getSelectedIndex()
		if (selectedIndex === null) return
		this.editor.controller.historyController.execute(this.editor.commandFactory.createRemoveCommand(selectedIndex))
		this.setStampContextMenuPosition(null)
	}

	public handleExitWidget(): void {
		this.setSelectTool()
	}

	// Brush workflow actions.
	public handleBrush(): void {
		this.editor.controller.setActiveTool(this.editor.controller.getBrushTool())
		this.enterBrush()
	}

	public handleExitBrush(): void {
		this.exitBrush()
	}

	public enterBrush(): void {
		this.updateState({
			isBrushMode: true,
			isBrushActive: false,
		})
	}

	public exitBrush(): void {
		this.editor.controller.setActiveTool(this.editor.controller.getSelectTool())
		this.updateState({
			isBrushMode: false,
			isBrushActive: false,
		})
	}

	public setBrushActive(active: boolean): void {
		if (this.state.isBrushActive === active) {
			return
		}

		this.updateState({
			isBrushActive: active,
		})
	}

	public setBrushSize(size: number): void {
		this.state = {
			...this.state,
			brushSize: size,
		}
		this.notifySubscribers()
	}

	public setBrushStrength(strength: number): void {
		this.state = {
			...this.state,
			brushStrength: strength,
		}
		this.notifySubscribers()
	}

	public handleResetLattice(): void {
		const selectedStamp = this.editor.controller.getSelectedStamp()
		const latticeMesh = selectedStamp?.latticeMesh ?? null
		const asset = this.editor.previewMesh.mesh

		if (!latticeMesh || !asset) return

		latticeMesh.resetVertices()
		this.editor.controller.latticeNeedsRender = true
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

	// Stamp selection + context menu actions.
	public setSelectedStampId(stampId: string | null): void {
		this.editor.controller.setSelectedStampId(stampId)
		this.updateState({ selectedStampId: stampId })
	}

	public refreshStampContextMenuPosition(): void {
		const selectedStamp = this.editor.controller.getSelectedStamp()
		if (!selectedStamp) {
			return
		}

		const worldPosition = selectedStamp.getPosition3D()
		const screenPos = worldToScreen(worldPosition, this.editor.camera, this.editor.getDomElement())
		this.updateState({
			stampContextMenuPosition: new Vector2(screenPos.x, screenPos.y),
		})
	}

	public setStampContextMenuPosition(position: Vector2 | null): void {
		this.updateState({
			stampContextMenuPosition: position,
			stampContextMenuVisible: position !== null,
		})
	}

	public hideStampContextMenu(): void {
		if (!this.state.stampContextMenuVisible) {
			return
		}
		this.updateState({
			stampContextMenuVisible: false,
		})
	}

	public showStampContextMenu(): void {
		this.updateState({
			stampContextMenuVisible: true,
		})
	}

	private notifySubscribers(): void {
		for (const callback of this.callbacks) {
			callback()
		}
	}

	private async update(): Promise<void> {
		const state = this.state
		state.selectedStampId = this.editor.controller.getSelectedStampId()
		state.stamps = this.editor.controller.project.stampList.getStamps()
		this.state = { ...state }
		this.notifySubscribers()
	}
}
