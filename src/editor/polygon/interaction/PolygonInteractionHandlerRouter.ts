import { InteractionHandlerResult } from '@/editor/interaction/InteractionHandlerResult'
import { PolygonInteractionEvent } from '@/editor/polygon/interaction/PolygonInteractionEvent'
import { PolygonInteractionHandler } from '@/editor/polygon/interaction/PolygonInteractionHandler'

/**
 * Priority-ordered dispatch with pointer capture, mirroring
 * InteractionHandlerRouter from the 3D editor's interaction stack.
 */
export class PolygonInteractionHandlerRouter {
	private capturedHandlerId: string | null = null

	public constructor(private handlers: PolygonInteractionHandler[]) {
		this.handlers = [...this.handlers].sort((a, b) => b.priority - a.priority)
	}

	public dispatch(event: PolygonInteractionEvent): void {
		const capturedHandler = this.getCapturedHandler()
		if (capturedHandler) {
			this.dispatchToHandler(capturedHandler, event)
			return
		}

		for (const handler of this.handlers) {
			if (!handler.isEnabled(event)) {
				continue
			}
			const result = this.dispatchToHandler(handler, event)
			if (result.handled || result.capture || result.releaseCapture) {
				return
			}
		}
	}

	public enableHandler(handlerId: string): void {
		const handler = this.getHandlerById(handlerId)
		if (handler) {
			handler.enabled = true
		}
	}

	public disableHandler(handlerId: string): void {
		const handler = this.getHandlerById(handlerId)
		if (handler) {
			handler.enabled = false
		}
	}

	private getCapturedHandler(): PolygonInteractionHandler | null {
		if (!this.capturedHandlerId) {
			return null
		}
		return this.getHandlerById(this.capturedHandlerId)
	}

	private getHandlerById(handlerId: string): PolygonInteractionHandler | null {
		return this.handlers.find((handler) => handler.id === handlerId) ?? null
	}

	private dispatchToHandler(
		handler: PolygonInteractionHandler,
		event: PolygonInteractionEvent
	): InteractionHandlerResult {
		const result = handler.onEvent(event)

		if (result.capture) {
			this.capturedHandlerId = handler.id
		}
		if (result.releaseCapture) {
			this.capturedHandlerId = null
		}

		return result
	}
}
