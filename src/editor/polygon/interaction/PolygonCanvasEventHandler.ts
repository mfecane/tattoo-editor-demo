import { CanvasEventType } from '@/editor/interaction/CanvasEventType'
import { REGION_EDITOR_CONSTANTS } from '@/editor/constants'
import { distance } from '@/editor/lib/utils/PolygonGeometry'
import { RegionEditorController } from '@/editor/polygon/RegionEditorController'
import { AddPointInteractionHandler } from '@/editor/polygon/interaction/handlers/AddPointInteractionHandler'
import { AddRectInteractionHandler } from '@/editor/polygon/interaction/handlers/AddRectInteractionHandler'
import { ClosePolygonInteractionHandler } from '@/editor/polygon/interaction/handlers/ClosePolygonInteractionHandler'
import { DeleteVertexInteractionHandler } from '@/editor/polygon/interaction/handlers/DeleteVertexInteractionHandler'
import { DeselectInteractionHandler } from '@/editor/polygon/interaction/handlers/DeselectInteractionHandler'
import { MoveVertexInteractionHandler } from '@/editor/polygon/interaction/handlers/MoveVertexInteractionHandler'
import { SelectPolygonInteractionHandler } from '@/editor/polygon/interaction/handlers/SelectPolygonInteractionHandler'
import { SplitEdgeInteractionHandler } from '@/editor/polygon/interaction/handlers/SplitEdgeInteractionHandler'
import { PolygonInteractionEvent } from '@/editor/polygon/interaction/PolygonInteractionEvent'
import { PolygonInteractionHandler } from '@/editor/polygon/interaction/PolygonInteractionHandler'
import { PolygonInteractionHandlerRouter } from '@/editor/polygon/interaction/PolygonInteractionHandlerRouter'
import { PolygonPoint } from '@/editor/polygon/PolygonPoint'
import { Container, FederatedPointerEvent } from 'pixi.js'

/**
 * Translates raw Pixi pointer events on the given stage into semantic
 * click / drag-start / drag / drag-end interaction events (with the hit
 * test already attached) and dispatches them through the handler router.
 * Mirrors CanvasEventHandler's role in the 3D editor's interaction stack.
 */
export class PolygonCanvasEventHandler {
	private readonly router: PolygonInteractionHandlerRouter
	private readonly handlers: PolygonInteractionHandler[]

	private pointerDownPosition: PolygonPoint | null = null
	private isPointerDown: boolean = false
	private isDragging: boolean = false

	private readonly onPointerDown = (event: FederatedPointerEvent): void => this.handlePointerDown(event)
	private readonly onPointerMove = (event: FederatedPointerEvent): void => this.handlePointerMove(event)
	private readonly onPointerUp = (event: FederatedPointerEvent): void => this.handlePointerUp(event)

	public constructor(
		private readonly stage: Container,
		private readonly controller: RegionEditorController
	) {
		this.handlers = [
			new MoveVertexInteractionHandler(this.controller),
			new ClosePolygonInteractionHandler(this.controller),
			new SplitEdgeInteractionHandler(this.controller),
			new DeleteVertexInteractionHandler(this.controller),
			new SelectPolygonInteractionHandler(this.controller),
			new DeselectInteractionHandler(this.controller),
			new AddPointInteractionHandler(this.controller),
			new AddRectInteractionHandler(this.controller),
		]
		this.router = new PolygonInteractionHandlerRouter(this.handlers)

		this.stage.eventMode = 'static'
		this.stage.on('pointerdown', this.onPointerDown)
		this.stage.on('pointermove', this.onPointerMove)
		this.stage.on('pointerup', this.onPointerUp)
		this.stage.on('pointerupoutside', this.onPointerUp)
	}

	public destroy(): void {
		this.stage.off('pointerdown', this.onPointerDown)
		this.stage.off('pointermove', this.onPointerMove)
		this.stage.off('pointerup', this.onPointerUp)
		this.stage.off('pointerupoutside', this.onPointerUp)
	}

	public enableHandler(handlerId: string): void {
		this.router.enableHandler(handlerId)
	}

	public disableHandler(handlerId: string): void {
		this.router.disableHandler(handlerId)
	}

	private handlePointerDown(event: FederatedPointerEvent): void {
		this.pointerDownPosition = this.getLocalPoint(event)
		this.isPointerDown = true
		this.isDragging = false
	}

	private handlePointerMove(event: FederatedPointerEvent): void {
		if (!this.isPointerDown) {
			return
		}

		const point = this.getLocalPoint(event)

		if (!this.isDragging && this.hasMovedPastThreshold(point)) {
			this.isDragging = true
			this.dispatch(CanvasEventType.MoveStart, point)
		}

		if (this.isDragging) {
			this.dispatch(CanvasEventType.Move, point)
		}
	}

	private handlePointerUp(event: FederatedPointerEvent): void {
		// Pixi binds pointerup globally on window (unlike pointerdown, which is
		// scoped to the canvas), so this fires for every pointerup on the page -
		// including releases on DOM elements outside the canvas entirely. Only
		// react to ones that follow a pointerdown we actually saw.
		if (!this.isPointerDown) {
			return
		}

		const point = this.getLocalPoint(event)
		this.isPointerDown = false

		if (this.isDragging) {
			this.dispatch(CanvasEventType.MoveEnd, point)
		} else {
			this.dispatch(CanvasEventType.Click, point)
		}

		this.isDragging = false
		this.pointerDownPosition = null
	}

	private hasMovedPastThreshold(point: PolygonPoint): boolean {
		if (!this.pointerDownPosition) {
			return false
		}
		return distance(point, this.pointerDownPosition) > REGION_EDITOR_CONSTANTS.DRAG_THRESHOLD
	}

	private dispatch(type: CanvasEventType, point: PolygonPoint): void {
		const event: PolygonInteractionEvent = {
			type,
			point,
			hitResult: this.controller.hitTest(point),
		}
		this.router.dispatch(event)
	}

	private getLocalPoint(event: FederatedPointerEvent): PolygonPoint {
		const local = event.getLocalPosition(this.stage)
		return { x: local.x, y: local.y }
	}
}
