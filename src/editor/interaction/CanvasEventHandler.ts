import { CanvasEventType } from '@/editor/interaction/CanvasEventType'
import { InteractionContext } from '@/editor/interaction/InteractionContext'
import { InteractionEvent } from '@/editor/interaction/InteractionEvent'
import { InteractionHandler } from '@/editor/interaction/InteractionHandler'
import { InteractionHandlerRouter } from '@/editor/interaction/InteractionHandlerRouter'
import { BrushInteractionHandler } from '@/editor/interaction/handlers/BrushInteractionHandler'
import { DragInteractionHandler } from '@/editor/interaction/handlers/DragInteractionHandler'
import { HoverInteractionHandler } from '@/editor/interaction/handlers/HoverInteractionHandler'
import { MoveInteractionHandler } from '@/editor/interaction/handlers/MoveInteractionHandler'
import { OrbitInteractionHandler } from '@/editor/interaction/handlers/OrbitInteractionHandler'
import { ResizeInteractionHandler } from '@/editor/interaction/handlers/ResizeInteractionHandler'
import { RotateInteractionHandler } from '@/editor/interaction/handlers/RotateInteractionHandler'
import { SelectionInteractionHandler } from '@/editor/interaction/handlers/SelectionInteractionHandler'
import { Editor } from '@/editor/main/Editor'
import { PerspectiveCamera, Raycaster, Vector2 } from 'three'

export class CanvasEventHandler {
	private static readonly DOUBLE_CLICK_SHIFT: number = 2

	private static readonly SINGLE_CLICK_DELAY_MS: number = 200

	private static readonly DOUBLE_CLICK_TIME_MS: number = 300

	private lastPointerDownPosition: Vector2 | null = null

	private lastPointerUpPosition: Vector2 | null = null

	private lastPointerUpTime: number = 0

	private singleClickTimeoutId: ReturnType<typeof setTimeout> | null = null

	private isPointerDown: boolean = false

	private isDragging: boolean = false

	private context: InteractionContext

	private handlerRouter: InteractionHandlerRouter = new InteractionHandlerRouter([])

	private raycaster: Raycaster | null = null

	private mouse: Vector2 | null = null

	private element: HTMLElement

	private handlers: InteractionHandler[] = []

	private camera: PerspectiveCamera

	public constructor(private readonly editor: Editor) {
		this.element = editor.renderer.domElement
		this.camera = editor.camera
		this.raycaster = new Raycaster()
		this.mouse = new Vector2()
		this.context = new InteractionContext(this.editor)
		this.handlers = [
			new SelectionInteractionHandler(this.editor),
			new ResizeInteractionHandler(this.editor),
			new RotateInteractionHandler(this.editor),
			new MoveInteractionHandler(this.editor),
			new DragInteractionHandler(this.editor),
			new BrushInteractionHandler(this.editor),
			new HoverInteractionHandler(),
			new OrbitInteractionHandler(this.editor),
		]
		this.handlerRouter = new InteractionHandlerRouter(this.handlers)

		this.context.initialize(this.raycaster, this.camera, this.element, this.mouse)

		this.element.addEventListener('pointerdown', (e) => this.onPointerDown(e))
		this.element.addEventListener('pointermove', (e) => this.onPointerMove(e))
		this.element.addEventListener('pointerup', (e) => this.onPointerUp(e))
	}

	public async onPointerDown(event: PointerEvent): Promise<void> {
		event.preventDefault()
		event.stopPropagation()

		this.lastPointerDownPosition = new Vector2(event.clientX, event.clientY)
		this.isPointerDown = true
		this.isDragging = false

		this.context.updatePressedButtons(event)

		// Clear single click timeout, if new click is started
		if (this.singleClickTimeoutId) {
			clearTimeout(this.singleClickTimeoutId)
			this.singleClickTimeoutId = null
		}
	}

	public async onPointerMove(event: PointerEvent): Promise<void> {
		event.preventDefault()
		event.stopPropagation()

		if (!this.isDragging && this.isPointerDown && this.isMoved(event.clientX, event.clientY)) {
			this.isDragging = true
			await this.dispatchEvent(CanvasEventType.MoveStart, event.clientX, event.clientY, 0, 0, event)
		}
		if (this.isDragging) {
			await this.dispatchEvent(CanvasEventType.Move, event.clientX, event.clientY, 0, 0, event)
		} else if (!this.isPointerDown) {
			await this.dispatchEvent(CanvasEventType.Hover, event.clientX, event.clientY, 0, 0, event)
		}
	}

	public async onPointerUp(event: PointerEvent): Promise<void> {
		event.preventDefault()
		event.stopPropagation()

		this.isPointerDown = false

		if (this.isDragging) {
			await this.dispatchEvent(CanvasEventType.MoveEnd, event.clientX, event.clientY, 0, 0, event)
			this.isDragging = false
			this.lastPointerUpPosition = null
			this.lastPointerUpTime = 0
			return
		}

		if (this.isMoved(event.clientX, event.clientY)) {
			this.lastPointerUpPosition = null
			this.lastPointerUpTime = 0
			return
		}

		const currentTime = Date.now()
		const currentPosition = new Vector2(event.clientX, event.clientY)

		const isDoubleClick =
			this.lastPointerUpPosition !== null &&
			this.lastPointerUpTime > 0 &&
			currentTime - this.lastPointerUpTime < CanvasEventHandler.DOUBLE_CLICK_TIME_MS &&
			!this.isMoved(event.clientX, event.clientY, this.lastPointerUpPosition)

		if (isDoubleClick) {
			if (this.singleClickTimeoutId) {
				clearTimeout(this.singleClickTimeoutId)
				this.singleClickTimeoutId = null
			}
			this.lastPointerUpPosition = null
			this.lastPointerUpTime = 0
			void this.dispatchEvent(CanvasEventType.DoubleClick, event.clientX, event.clientY, 0, 0, event)
			return
		}

		this.lastPointerUpPosition = currentPosition
		this.lastPointerUpTime = currentTime

		if (this.singleClickTimeoutId) {
			clearTimeout(this.singleClickTimeoutId)
		}
		this.singleClickTimeoutId = setTimeout(() => {
			this.singleClickTimeoutId = null
			this.lastPointerUpPosition = null
			this.lastPointerUpTime = 0
			void this.dispatchEvent(CanvasEventType.Click, event.clientX, event.clientY, 0, 0, event)
		}, CanvasEventHandler.SINGLE_CLICK_DELAY_MS)
	}

	private isMoved(x: number, y: number, referencePosition?: Vector2): boolean {
		const position = referencePosition ?? this.lastPointerDownPosition
		if (!position) {
			return false
		}
		const dx: number = x - position.x
		const dy: number = y - position.y
		return Math.hypot(dx, dy) > CanvasEventHandler.DOUBLE_CLICK_SHIFT
	}

	private async dispatchEvent(
		type: CanvasEventType,
		x: number,
		y: number,
		dx: number,
		dy: number,
		event: MouseEvent
	): Promise<void> {
		if (!this.context || !this.camera || !this.raycaster || !this.mouse) {
			return
		}

		this.context.initialize(this.raycaster, this.camera, this.element, this.mouse)

		this.context.findIntersections(x, y)

		const newEvent: InteractionEvent = {
			type,
			x,
			y,
			dx,
			dy,
			modifiers: {
				shift: event.shiftKey,
				ctrl: event.ctrlKey,
				meta: event.metaKey,
				alt: event.altKey,
			},
			context: this.context,
			raw: event,
		}

		await this.handlerRouter.dispatch(newEvent)
	}

	public clear(): void {
		this.context.clear()
	}

	public enableHandler(handlerId: string): void {
		this.handlerRouter.enableHandler(handlerId)
	}

	public disableHandler(handlerId: string): void {
		this.handlerRouter.disableHandler(handlerId)
	}
}
