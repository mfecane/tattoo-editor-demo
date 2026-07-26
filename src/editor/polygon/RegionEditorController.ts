import { REGION_EDITOR_CONSTANTS } from '@/editor/constants'
import { distance } from '@/editor/lib/utils/PolygonGeometry'
import { PolygonCanvasEventHandler } from '@/editor/polygon/interaction/PolygonCanvasEventHandler'
import { PolygonCollection } from '@/editor/polygon/PolygonCollection'
import { PolygonHitResult } from '@/editor/polygon/PolygonHitResult'
import { PolygonHitTester } from '@/editor/polygon/PolygonHitTester'
import { PolygonPoint } from '@/editor/polygon/PolygonPoint'
import { RegionKind, RegionShape } from '@/editor/polygon/RegionShape'
import { PolygonDrawPolygonTool } from '@/editor/polygon/tools/PolygonDrawPolygonTool'
import { PolygonDrawRectTool } from '@/editor/polygon/tools/PolygonDrawRectTool'
import { PolygonSelectTool } from '@/editor/polygon/tools/PolygonSelectTool'
import { IPolygonTool, PolygonToolId } from '@/editor/polygon/tools/PolygonTool'

export interface PolygonSnapshot {
	id: string
	kind: RegionKind
	points: PolygonPoint[]
	closed: boolean
	selected: boolean
}

export interface RegionEditorState {
	polygons: PolygonSnapshot[]
	selectedId: string | null
	activeToolId: PolygonToolId
}

/**
 * Orchestrates mutations against a PolygonCollection and notifies
 * subscribers (renderer, React bridge) on every change. Interaction
 * handlers call the action methods here - none of them touch the model
 * directly. Which handlers are even live at a given moment is owned by
 * whichever PolygonTool is active (see setActiveTool) - not by ad hoc
 * boolean flags threaded through hit-testing or handler isEnabled() checks.
 */
export class RegionEditorController {
	private subscribers: Set<() => void> = new Set()

	private canvasEventHandler: PolygonCanvasEventHandler | null = null

	private activeTool: IPolygonTool | null = null

	public readonly selectTool: PolygonSelectTool = new PolygonSelectTool(this)

	public readonly drawPolygonTool: PolygonDrawPolygonTool = new PolygonDrawPolygonTool(this)

	public readonly drawRectTool: PolygonDrawRectTool = new PolygonDrawRectTool(this)

	public constructor(
		private readonly collection: PolygonCollection,
		private readonly hitTester: PolygonHitTester
	) {}

	public subscribe(callback: () => void): () => void {
		this.subscribers.add(callback)
		return () => this.subscribers.delete(callback)
	}

	public getState(): RegionEditorState {
		const selectedId = this.collection.getSelectedId()
		return {
			polygons: this.collection.getPolygons().map((polygon) => ({
				id: polygon.id,
				kind: polygon.kind,
				points: polygon.getPoints(),
				closed: polygon.isClosed(),
				selected: polygon.id === selectedId,
			})),
			selectedId,
			activeToolId: this.getActiveToolId(),
		}
	}

	public hasSelection(): boolean {
		return this.collection.getSelectedId() !== null
	}

	public getSelectTool(): PolygonSelectTool {
		return this.selectTool
	}

	public getDrawPolygonTool(): PolygonDrawPolygonTool {
		return this.drawPolygonTool
	}

	public getDrawRectTool(): PolygonDrawRectTool {
		return this.drawRectTool
	}

	public getActiveToolId(): PolygonToolId {
		return this.activeTool?.id ?? PolygonToolId.Select
	}

	/** True while either draw tool is active - used by input sources (Escape) that don't care which. */
	public isDrawing(): boolean {
		return this.getActiveToolId() !== PolygonToolId.Select
	}

	/** The one place tools get switched - exits the current tool (disabling its handlers) before entering the next (enabling its own), mirroring EditorController.setActiveTool. */
	public setActiveTool(tool: IPolygonTool): void {
		if (this.activeTool === tool) {
			return
		}
		this.activeTool?.exitTool()
		this.activeTool = tool
		tool.enterTool()
		this.notify()
	}

	/** Wires up the (async-constructed) Pixi event handler and enters Select - called once by RegionEditorApp.init() right after building it. */
	public bindCanvasEventHandler(handler: PolygonCanvasEventHandler): void {
		this.canvasEventHandler = handler
		this.setActiveTool(this.selectTool)
	}

	public getCanvasEventHandler(): PolygonCanvasEventHandler {
		if (!this.canvasEventHandler) {
			throw new Error('PolygonCanvasEventHandler is not bound yet')
		}
		return this.canvasEventHandler
	}

	/** Discards the in-progress (unclosed) shape, if any - safe no-op otherwise. Called by draw tools on enter (clear leftovers) and exit (abandon unfinished). */
	public discardOpenPolygon(): void {
		const openPolygon = this.collection.getOpenPolygon()
		if (openPolygon) {
			this.collection.removePolygon(openPolygon.id)
		}
	}

	public getSelectedRegion(): RegionShape | null {
		const selected = this.collection.getSelectedPolygon()
		if (!selected) {
			return null
		}
		return { kind: selected.kind, points: selected.getPoints() } as RegionShape
	}

	/** Seeds already-closed regions (e.g. restored from storage) without going through the draw flow. */
	public loadRegions(shapes: RegionShape[]): void {
		for (const shape of shapes) {
			this.collection.loadPolygon(shape.points, shape.kind)
		}
		this.notify()
	}

	/** Adds an already-closed region (e.g. the whole-image rect) and selects it, same as finishing a drawn shape. */
	public addRegion(shape: RegionShape): void {
		this.discardOpenPolygon()
		const polygon = this.collection.loadPolygon(shape.points, shape.kind)
		this.collection.select(polygon.id)
		this.setActiveTool(this.selectTool)
		this.notify()
	}

	public hitTest(point: PolygonPoint): PolygonHitResult {
		return this.hitTester.performHitTest(this.collection, point)
	}

	/** Starts a new lasso polygon with no vertices yet - called by PolygonDrawPolygonTool.enterTool() so the open polygon exists (and hit-testing is in drawing mode, see PolygonHitTester) before the first point is even placed. Notification is left to setActiveTool(), which calls this and then notifies once. */
	public beginDrawPolygon(): void {
		this.collection.createPolygon('polygon')
	}

	/** Click on empty canvas while the draw-polygon tool is active: place the next point. */
	public handleBackgroundClick(point: PolygonPoint): void {
		const openPolygon = this.collection.getOpenPolygon()
		if (!openPolygon) {
			throw new Error('handleBackgroundClick called with no open polygon - PolygonDrawPolygonTool.enterTool() should have created one')
		}
		openPolygon.addPoint(point)
		this.notify()
	}

	public closeOpenPolygon(): void {
		const openPolygon = this.collection.getOpenPolygon()
		if (!openPolygon || !openPolygon.canClose()) {
			return
		}
		openPolygon.close()
		this.collection.select(openPolygon.id)
		this.setActiveTool(this.selectTool)
		this.notify()
	}

	/** Drag start on empty canvas while the draw-rect tool is active: pins both corners at the press point. */
	public beginRectCorner(point: PolygonPoint): void {
		const openPolygon = this.collection.createPolygon('aarect')
		openPolygon.addPoint(point)
		openPolygon.addPoint(point)
		this.notify()
	}

	/** Live drag update: the 2nd corner follows the pointer. */
	public updateRectCorner(point: PolygonPoint): void {
		const openPolygon = this.collection.getOpenPolygon()
		openPolygon?.moveVertex(1, point)
		this.notify()
	}

	/**
	 * Drag release: finalizes the rect, discarding it if it's too small to be
	 * an intentional shape. Closes directly (not via closeOpenPolygon(), whose
	 * canClose() guard requires MIN_VERTICES(3) - a 2-point rect never meets
	 * that, since it has no analogous "minimum vertex count" concept).
	 */
	public finishRect(point: PolygonPoint): void {
		const openPolygon = this.collection.getOpenPolygon()
		if (!openPolygon) {
			return
		}
		openPolygon.moveVertex(1, point)

		const [corner0, corner1] = openPolygon.getPoints()
		if (distance(corner0, corner1) < REGION_EDITOR_CONSTANTS.MIN_RECT_SIZE) {
			this.collection.removePolygon(openPolygon.id)
		} else {
			openPolygon.close()
			this.collection.select(openPolygon.id)
		}
		this.setActiveTool(this.selectTool)
		this.notify()
	}

	public selectPolygon(id: string): void {
		this.collection.select(id)
		this.notify()
	}

	public deselectAll(): void {
		this.collection.deselectAll()
		this.notify()
	}

	// TODO: snap to nearby vertices belonging to other polygons while dragging, and
	// merge the dragged vertex into the target vertex on drop (see docs/a.md's
	// snap-to-vertex/weld behavior for touching stamps - same idea, one level down).
	public moveVertex(polygonId: string, index: number, point: PolygonPoint): void {
		this.collection.getPolygon(polygonId)?.moveVertex(index, point)
		this.notify()
	}

	public deleteVertex(polygonId: string, index: number): void {
		if (!this.collection.getPolygon(polygonId)?.removeVertex(index)) {
			return
		}
		this.notify()
	}

	public splitEdge(polygonId: string, insertIndex: number, point: PolygonPoint): void {
		this.collection.getPolygon(polygonId)?.insertPoint(insertIndex, point)
		this.notify()
	}

	public deleteSelectedPolygon(): void {
		const selectedId = this.collection.getSelectedId()
		if (!selectedId) {
			return
		}
		this.collection.removePolygon(selectedId)
		this.notify()
	}

	private notify(): void {
		for (const callback of this.subscribers) {
			callback()
		}
	}
}
