import { CanvasEventType } from '@/editor/interaction/CanvasEventType'
import { InteractionEvent } from '@/editor/interaction/InteractionEvent'
import { InteractionHandler } from '@/editor/interaction/InteractionHandler'
import { InteractionHandlerResult } from '@/editor/interaction/InteractionHandlerResult'
import { SurfaceTangentBasis } from '@/editor/lib/utils/SurfaceTangentBasis'
import { Editor } from '@/editor/main/Editor'
import { PlacedMeshTransform } from '@/editor/main/commands/UpdatePlacedMeshCommand'
import { PointerMathService } from '@/editor/services/PointerMathService'
import { WidgetTransformService } from '@/editor/services/WidgetTransformService'
import { container } from '@/lib/di/container'
import { Group, Mesh, Quaternion, Raycaster, Vector3 } from 'three'

/**
 * Free-move gesture for a selected PlacedMesh: drag anywhere and it re-raycasts
 * against the body surface every frame, sliding along it - there's no UV/lattice
 * to update, so it mutates mesh.position/quaternion directly (live during drag,
 * single UpdatePlacedMeshCommand on release). Axis-constrained move was dropped -
 * a straight-line drag along U/V never actually followed the surface.
 */
export class MovePlacedMeshInteractionHandler implements InteractionHandler {
	public id: string = 'move-placed-mesh'

	public priority: number = 60

	public enabled: boolean = false

	private isActive: boolean = false
	private raycaster: Raycaster | null = null
	private activePlacedMeshId: string | null = null
	private initialTransform: PlacedMeshTransform | null = null
	private previewTransform: PlacedMeshTransform | null = null
	private hasPreviewChanges: boolean = false
	/** The mesh's own twist beyond raw surface alignment, captured at drag start so dragging across curved geometry doesn't discard it - see SurfaceTangentBasis. */
	private twistQuaternion: Quaternion = new Quaternion()
	private readonly pointerMathService: PointerMathService = container.resolve<PointerMathService>('PointerMathService')
	private readonly widgetTransformService: WidgetTransformService =
		container.resolve<WidgetTransformService>('WidgetTransformService')

	public constructor(private readonly editor: Editor) {}

	public isEnabled(event: InteractionEvent): boolean {
		if (!this.enabled || !event.context?.hitResult) {
			return false
		}
		return event.context.hitResult.type === 'move-handle' && this.editor.controller.getSelectedPlacedMeshId() !== null
	}

	public async onEvent(event: InteractionEvent): Promise<InteractionHandlerResult> {
		if (event.type === CanvasEventType.MoveStart) {
			if (!event.context || !event.context.hitResult || event.context.hitResult.type !== 'move-handle') {
				return new InteractionHandlerResult().setPass()
			}
			this.raycaster = event.context.raycaster
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
		this.raycaster = raycaster

		const controller = editor.controller
		const widget = controller.getTransformTool().getWidget()
		const entry = controller.getSelectedPlacedMesh()
		if (!entry || !widget) {
			return new InteractionHandlerResult().setPass()
		}

		this.activePlacedMeshId = entry.id
		this.initialTransform = this.snapshotTransform(entry.mesh)
		this.previewTransform = null
		this.hasPreviewChanges = false

		const currentSurfaceBasis = SurfaceTangentBasis.sampleAt(entry.mesh, this.editor.previewMesh.mesh)
		this.twistQuaternion = currentSurfaceBasis
			? SurfaceTangentBasis.quaternionFromBasis(currentSurfaceBasis).invert().multiply(entry.mesh.quaternion)
			: new Quaternion()

		this.isActive = true
		editor.controls.enabled = false
		widget.setBodyDragging(true)

		return new InteractionHandlerResult().setCapture()
	}

	private handleMove(event: InteractionEvent): InteractionHandlerResult {
		const editor = this.editor
		const raycaster = event.context.raycaster
		const mouse = event.context.mouse
		if (!raycaster || !mouse || !this.initialTransform || !this.activePlacedMeshId) {
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
		this.raycaster = raycaster

		const controller = editor.controller
		const widget = controller.getTransformTool().getWidget()
		const entry = controller.project.placedMeshList.getById(this.activePlacedMeshId)
		if (!widget || !entry) {
			return new InteractionHandlerResult().setHandled()
		}

		this.handleCenterMovement(entry.mesh, widget.getGroup())

		return new InteractionHandlerResult().setHandled()
	}

	private handleCenterMovement(mesh: Mesh, widgetGroup: Group): void {
		if (!this.raycaster) {
			return
		}
		const meshIntersects = this.raycaster.intersectObject(this.editor.previewMesh.mesh)
		if (meshIntersects.length === 0) {
			return
		}

		const intersection = meshIntersects[0]
		const surfaceBasis = SurfaceTangentBasis.fromIntersection(intersection, this.editor.previewMesh.mesh)
		if (!surfaceBasis) {
			return
		}

		// Surface basis alone would re-orient the mesh from scratch every frame (jerky, and
		// discards any twist the user dialed in with the Rotate tool) - reapply the twist
		// captured at drag start on top of the smooth, UV-derived surface frame instead.
		mesh.position.copy(intersection.point)
		mesh.quaternion.copy(SurfaceTangentBasis.quaternionFromBasis(surfaceBasis)).multiply(this.twistQuaternion)

		widgetGroup.position.copy(intersection.point)
		const uAxis = new Vector3(1, 0, 0).applyQuaternion(mesh.quaternion)
		const vAxis = new Vector3(0, 1, 0).applyQuaternion(mesh.quaternion)
		this.widgetTransformService.updateWidgetOrientation(widgetGroup, surfaceBasis.normal, uAxis, vAxis, 0)

		this.markChanged(mesh)
	}

	private markChanged(mesh: Mesh): void {
		if (!this.activePlacedMeshId || !this.initialTransform) {
			return
		}
		this.previewTransform = this.snapshotTransform(mesh)
		if (!this.previewTransform.position.equals(this.initialTransform.position)) {
			this.hasPreviewChanges = true
		}
		this.editor.reactBridge.refreshSelectionContextMenuPosition()
		this.editor.controller.scheduleWrapPreview(this.activePlacedMeshId)
	}

	private snapshotTransform(mesh: Mesh): PlacedMeshTransform {
		return {
			position: mesh.position.clone(),
			quaternion: mesh.quaternion.clone(),
			scale: mesh.scale.clone(),
		}
	}

	private handleMoveEnd(): InteractionHandlerResult {
		if (!this.isActive) {
			return new InteractionHandlerResult().setPass()
		}

		this.editor.controls.enabled = true
		this.editor.controller.getTransformTool().getWidget().setBodyDragging(false)
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

		return new InteractionHandlerResult().setReleaseCapture()
	}
}
