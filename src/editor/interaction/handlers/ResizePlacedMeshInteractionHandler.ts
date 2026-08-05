import { PLACED_MESH_CONSTANTS } from '@/editor/constants'
import { CanvasEventType } from '@/editor/interaction/CanvasEventType'
import { InteractionEvent } from '@/editor/interaction/InteractionEvent'
import { InteractionHandler } from '@/editor/interaction/InteractionHandler'
import { InteractionHandlerResult } from '@/editor/interaction/InteractionHandlerResult'
import { MeshUtils } from '@/editor/lib/utils/MeshUtils'
import { CORNER_HANDLE_SIGNS, EDGE_HANDLE_SIGNS, TransformHandleId, isEdgeHandle } from '@/editor/lib/widget/TransformHandleLayout'
import { Editor } from '@/editor/main/Editor'
import { PlacedMeshTransform } from '@/editor/main/commands/UpdatePlacedMeshCommand'
import { PointerMathService } from '@/editor/services/PointerMathService'
import { container } from '@/lib/di/container'
import { Vector2, Vector3 } from 'three'

/**
 * Resize gesture for a selected PlacedMesh: screen-space mouse delta projected onto the
 * widget's own u/v tangent axes, applied to mesh.scale.x/y (clamped to a plain multiplier
 * range). An edge handle drives a single axis; a corner handle drives both independently,
 * or uniformly (both from the same averaged component) while Shift is held. Direction/sign
 * per handle comes from TransformHandleLayout, shared with the widget that lays them out.
 */
export class ResizePlacedMeshInteractionHandler implements InteractionHandler {
	public id: string = 'resize-placed-mesh'

	public priority: number = 80

	public enabled: boolean = false

	private isActive: boolean = false
	private initialMousePos: Vector2 = new Vector2()
	private initialScale: Vector3 = new Vector3(1, 1, 1)
	private handleType: TransformHandleId | null = null
	private mouse: Vector2 = new Vector2()
	private activePlacedMeshId: string | null = null
	private initialTransform: PlacedMeshTransform | null = null
	private previewTransform: PlacedMeshTransform | null = null
	private hasPreviewChanges: boolean = false
	private readonly pointerMathService: PointerMathService = container.resolve<PointerMathService>('PointerMathService')
	private readonly meshUtils: MeshUtils = container.resolve<MeshUtils>('MeshUtils')

	public constructor(private readonly editor: Editor) {}

	public isEnabled(event: InteractionEvent): boolean {
		if (!this.enabled || !event.context?.hitResult) {
			return false
		}
		return event.context.hitResult.type === 'resize-handle' && this.editor.controller.getSelectedPlacedMeshId() !== null
	}

	public async onEvent(event: InteractionEvent): Promise<InteractionHandlerResult> {
		if (event.type === CanvasEventType.MoveStart) {
			if (!event.context || !event.context.hitResult || event.context.hitResult.type !== 'resize-handle') {
				return new InteractionHandlerResult().setPass()
			}
			const handleType = event.context.hitResult.handleType
			if (!handleType) {
				throw new Error('Resize handle hit result is missing handleType')
			}
			this.handleType = handleType
			return this.handleMoveStart(event)
		}

		if (this.isActive) {
			if (event.type === CanvasEventType.Move) {
				return this.handleMove(event)
			} else if (event.type === CanvasEventType.MoveEnd) {
				return this.handleMoveEnd()
			}
		}

		return new InteractionHandlerResult().setPass()
	}

	private handleMoveStart(event: InteractionEvent): InteractionHandlerResult {
		const editor = this.editor
		const raycaster = event.context.raycaster
		const mouse = event.context.mouse
		if (!raycaster || !mouse) {
			return new InteractionHandlerResult().setPass()
		}

		editor.updateCameraMatrix()
		this.pointerMathService.normalizeMousePosition(
			{ clientX: event.x, clientY: event.y },
			editor.getDomElement(),
			editor.camera,
			raycaster,
			mouse
		)
		this.mouse = mouse
		this.initialMousePos.copy(mouse)

		const controller = editor.controller
		const widget = controller.getTransformTool().getWidget()
		const entry = controller.getSelectedPlacedMesh()
		if (!entry || !widget) {
			return new InteractionHandlerResult().setPass()
		}

		this.initialScale.copy(entry.mesh.scale)
		this.activePlacedMeshId = entry.id
		this.initialTransform = {
			position: entry.mesh.position.clone(),
			quaternion: entry.mesh.quaternion.clone(),
			scale: entry.mesh.scale.clone(),
		}
		this.previewTransform = null
		this.hasPreviewChanges = false

		this.isActive = true
		editor.controls.enabled = false

		return new InteractionHandlerResult().setCapture()
	}

	private handleMove(event: InteractionEvent): InteractionHandlerResult {
		const editor = this.editor
		const raycaster = event.context.raycaster
		const mouse = event.context.mouse
		if (!raycaster || !mouse || !this.initialTransform || !this.activePlacedMeshId || !this.handleType) {
			return new InteractionHandlerResult().setHandled()
		}

		editor.updateCameraMatrix()
		this.pointerMathService.normalizeMousePosition(
			{ clientX: event.x, clientY: event.y },
			editor.getDomElement(),
			editor.camera,
			raycaster,
			mouse
		)
		this.mouse = mouse
		const deltaMouse = new Vector2(this.mouse.x - this.initialMousePos.x, this.mouse.y - this.initialMousePos.y)

		const controller = editor.controller
		const widget = controller.getTransformTool().getWidget()
		const entry = controller.project.placedMeshList.getById(this.activePlacedMeshId)
		if (!widget || !entry) {
			return new InteractionHandlerResult().setHandled()
		}

		const widgetGroup = widget.getGroup()
		widgetGroup.updateMatrixWorld(true)
		const widgetPosition = new Vector3()
		widgetGroup.getWorldPosition(widgetPosition)

		const worldU = new Vector3(1, 0, 0).transformDirection(widgetGroup.matrixWorld)
		const worldV = new Vector3(0, 1, 0).transformDirection(widgetGroup.matrixWorld)

		const uScreen = new Vector3().copy(widgetPosition).add(worldU).project(editor.camera)
		const vScreen = new Vector3().copy(widgetPosition).add(worldV).project(editor.camera)
		const widgetScreen = new Vector3().copy(widgetPosition).project(editor.camera)

		const screenU = new Vector2(uScreen.x - widgetScreen.x, uScreen.y - widgetScreen.y).normalize()
		const screenV = new Vector2(vScreen.x - widgetScreen.x, vScreen.y - widgetScreen.y).normalize()

		const uComponent = deltaMouse.dot(screenU)
		const vComponent = deltaMouse.dot(screenV)

		const clamp = (value: number) => Math.max(PLACED_MESH_CONSTANTS.MIN_SCALE, Math.min(PLACED_MESH_CONSTANTS.MAX_SCALE, value))

		let scaleX = this.initialScale.x
		let scaleY = this.initialScale.y

		if (isEdgeHandle(this.handleType)) {
			const { uSign, vSign } = EDGE_HANDLE_SIGNS[this.handleType]
			if (uSign !== 0) {
				scaleX = clamp(this.initialScale.x * (1 + uSign * uComponent * PLACED_MESH_CONSTANTS.SCALING_FACTOR))
			}
			if (vSign !== 0) {
				scaleY = clamp(this.initialScale.y * (1 + vSign * vComponent * PLACED_MESH_CONSTANTS.SCALING_FACTOR))
			}
		} else {
			const { uSign, vSign } = CORNER_HANDLE_SIGNS[this.handleType]
			if (event.modifiers.shift) {
				const outwardComponent = (uSign * uComponent + vSign * vComponent) / 2
				const scaleFactor = 1 + outwardComponent * PLACED_MESH_CONSTANTS.SCALING_FACTOR
				scaleX = clamp(this.initialScale.x * scaleFactor)
				scaleY = clamp(this.initialScale.y * scaleFactor)
			} else {
				scaleX = clamp(this.initialScale.x * (1 + uSign * uComponent * PLACED_MESH_CONSTANTS.SCALING_FACTOR))
				scaleY = clamp(this.initialScale.y * (1 + vSign * vComponent * PLACED_MESH_CONSTANTS.SCALING_FACTOR))
			}
		}

		entry.mesh.scale.set(scaleX, scaleY, entry.mesh.scale.z)

		const halfExtents = this.meshUtils.computeLocalHalfExtents(entry.mesh)
		halfExtents.multiply(new Vector2(scaleX, scaleY))
		widget.updateBounds(halfExtents)

		this.previewTransform = {
			position: entry.mesh.position.clone(),
			quaternion: entry.mesh.quaternion.clone(),
			scale: entry.mesh.scale.clone(),
		}
		if (this.initialTransform.scale.x !== scaleX || this.initialTransform.scale.y !== scaleY) {
			this.hasPreviewChanges = true
		}

		editor.reactBridge.refreshSelectionContextMenuPosition()
		editor.controller.scheduleWrapPreview(this.activePlacedMeshId)

		return new InteractionHandlerResult().setHandled()
	}

	private handleMoveEnd(): InteractionHandlerResult {
		if (!this.isActive) {
			return new InteractionHandlerResult().setPass()
		}

		this.editor.controls.enabled = true
		if (this.hasPreviewChanges && this.activePlacedMeshId && this.initialTransform && this.previewTransform) {
			this.editor.controller.historyController.execute(
				this.editor.commandFactory.createUpdatePlacedMeshCommand(
					this.activePlacedMeshId,
					this.initialTransform,
					this.previewTransform
				)
			)
		}

		this.isActive = false
		this.activePlacedMeshId = null
		this.initialTransform = null
		this.previewTransform = null
		this.hasPreviewChanges = false
		this.handleType = null

		return new InteractionHandlerResult().setReleaseCapture()
	}
}
