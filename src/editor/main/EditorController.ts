import { getStrategy } from '@/editor/lib/lattice/ProjectionStrategyFactory'
import { Editor } from '@/editor/main/Editor'
import { HistoryController } from '@/editor/main/HistoryController'
import { Project } from '@/editor/main/Project'
import { RuntimeStamp } from '@/editor/main/RuntimeStamp'
import { BrushTool } from '@/editor/main/tools/BrushTool'
import { EditorToolId, IEditorTool } from '@/editor/main/tools/EditorTool'
import { MoveTool } from '@/editor/main/tools/MoveTool'
import { RotateTool } from '@/editor/main/tools/RotateTool'
import { ScaleTool } from '@/editor/main/tools/ScaleTool'
import { SelectTool } from '@/editor/main/tools/SelectTool'
import { TextureRenderer } from '@/editor/services/TextureRenderer'
import { PendingPlacement } from '@/editor/store/editorStore'
import { ImageSource, StampInfo } from '@/editor/types/projectTypes'
import { container } from '@/lib/di/container'
import { Intersection, Raycaster, Vector2 } from 'three'

export interface EditorState {
	activeToolId: EditorToolId
	selectedStampId: string | null
}

export class EditorController {
	private state: EditorState = {
		activeToolId: EditorToolId.Select,
		selectedStampId: null,
	}

	private activeTool: IEditorTool | null = null

	private readonly selectTool: SelectTool
	private readonly brushTool: BrushTool
	private readonly moveTool: MoveTool
	private readonly rotateTool: RotateTool
	private readonly scaleTool: ScaleTool

	public readonly historyController: HistoryController = new HistoryController(this)

	private subscriptions: Set<() => void> = new Set()

	public readonly project: Project

	public latticeNeedsRender: boolean = true

	public constructor(public readonly editor: Editor) {
		this.project = new Project(this)
		this.project.stampList.setOnRenderRequiredCallback(async () => {
			this.latticeNeedsRender = true
		})
		this.project.stampList.setOnUpdateCallback(async () => this.onStampListUpdate())

		this.selectTool = new SelectTool(this.editor)
		this.brushTool = new BrushTool(this.editor)
		this.moveTool = new MoveTool(this.editor)
		this.rotateTool = new RotateTool(this.editor)
		this.scaleTool = new ScaleTool(this.editor)
	}

	// TODO fix double animation loops
	public async animate(): Promise<void> {
		if (this.latticeNeedsRender) {
			await this.renderLattice()
		}
		requestAnimationFrame(async () => await this.animate())
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

	private onStampListUpdate(): void {
		this.ensureSelectedStampStillExists()
		this.updateTool()
		this.notifySubscribers()
	}

	private updateTool(): void {
		if (this.state.activeToolId === EditorToolId.Select) {
			this.selectTool.exitTool()
			this.selectTool.enterTool()
		} else if (this.state.activeToolId === EditorToolId.Rotate) {
			this.rotateTool.exitTool()
			this.rotateTool.enterTool()
		} else if (this.state.activeToolId === EditorToolId.Scale) {
			this.scaleTool.exitTool()
			this.scaleTool.enterTool()
		}
	}

	private async renderLattice(): Promise<void> {
		container
			.resolve<TextureRenderer>('TextureRenderer')
			.renderStampsToTexture(this.editor, this.project.stampList.getStamps())
		this.latticeNeedsRender = false
	}

	public setSelectedStampId(id: string | null): void {
		this.state.selectedStampId = id
		this.notifySubscribers()
	}

	public getSelectedStamp(): RuntimeStamp | null {
		const selectedStampId = this.state.selectedStampId
		if (selectedStampId === null) {
			return null
		}

		return this.project.stampList.getStampById(selectedStampId)
	}

	public getActiveTool(): IEditorTool | null {
		return this.activeTool
	}

	public getSelectTool(): SelectTool {
		return this.selectTool
	}

	public getMoveTool(): MoveTool {
		return this.moveTool
	}

	public getBrushTool(): BrushTool {
		return this.brushTool
	}

	public getScaleTool(): ScaleTool {
		return this.scaleTool
	}

	public getRotateTool(): RotateTool {
		return this.rotateTool
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

	public getSelectedStampId(): string | null {
		return this.state.selectedStampId
	}

	public getSelectedIndex(): number | null {
		const selectedStampId = this.state.selectedStampId
		if (selectedStampId === null) {
			return null
		}

		const selectedIndex = this.project.stampList
			.getStamps()
			.findIndex((stamp) => stamp.data.id === selectedStampId)
		return selectedIndex === -1 ? null : selectedIndex
	}

	public onStartDragImage(hash: string, source: ImageSource): void {
		this.editor.getStampImageStorage().createImage(hash, source)
	}

	public resolveDropIntersection(clientX: number, clientY: number): Intersection | null {
		const rect = this.editor.getDomElement().getBoundingClientRect()
		const mouse = new Vector2()
		mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1
		mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1

		const raycaster = new Raycaster()
		raycaster.setFromCamera(mouse, this.editor.camera)

		const previewIntersections = raycaster.intersectObject(this.editor.previewMesh.mesh)
		if (previewIntersections.length === 0) {
			return null
		}

		const previewIntersection = previewIntersections[0]
		if (!previewIntersection.uv) {
			return null
		}

		return previewIntersection
	}

	public async placeImageAtPosition(
		pendingPlacement: PendingPlacement,
		projectionType: 'stamp' | 'cylindrical-lattice'
	): Promise<void> {
		if (!pendingPlacement.intersection) {
			return
		}

		const strategy = getStrategy(projectionType)

		const sourceImage: HTMLImageElement = await this.editor
			.getStampImageStorage()
			.getImage(pendingPlacement.image.hash)
			.getImageElement()

		const defaultSize = strategy.getDefaultSize(sourceImage)

		const defaultRotation = strategy.getDefaultRotation()

		const uv = pendingPlacement.intersection.uv
		if (!uv) {
			return
		}

		const constrainedUV = strategy.constrainUV(uv)

		const stampInfo: StampInfo = {
			uv: constrainedUV,
			sizeX: defaultSize.sizeX,
			sizeY: defaultSize.sizeY,
			rotation: defaultRotation,
		}

		this.historyController.execute(
			this.editor.commandFactory.createAddCommand({
				projectionType,
				stampInfo,
				sourceImage: {
					hash: pendingPlacement.image.hash,
					source: pendingPlacement.image.source,
				},
				latticeModified: false,
			})
		)
	}

	private ensureSelectedStampStillExists(): void {
		const selectedStampId = this.state.selectedStampId
		if (selectedStampId === null) {
			return
		}

		const selectedStampExists = this.project.stampList.getStamps().some((stamp) => stamp.data.id === selectedStampId)
		if (!selectedStampExists) {
			this.state.selectedStampId = null
		}
	}
}
