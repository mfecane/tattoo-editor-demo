import { CanvasEventType } from '@/editor/interaction/CanvasEventType'
import { InteractionEvent } from '@/editor/interaction/InteractionEvent'
import { InteractionHandler } from '@/editor/interaction/InteractionHandler'
import { InteractionHandlerResult } from '@/editor/interaction/InteractionHandlerResult'
import { getStrategy } from '@/editor/lib/lattice/ProjectionStrategyFactory'
import type { UpdateLatticeStrategy } from '@/editor/lib/lattice/UpdateLatticeStrategy'
import { SurfaceDataCalculator } from '@/editor/lib/utils/surfaceData'
import { MoveStampCommand } from '@/editor/main/commands/MoveStampCommand'
import { Editor } from '@/editor/main/Editor'
import type { EditorController } from '@/editor/main/EditorController'
import type { RuntimeStamp } from '@/editor/main/RuntimeStamp'
import { GeometryProjectionService } from '@/editor/services/GeometryProjectionService'
import { PointerMathService } from '@/editor/services/PointerMathService'
import { WidgetTransformService } from '@/editor/services/WidgetTransformService'
import type { StampInfo } from '@/editor/types/projectTypes'
import { container } from '@/lib/di/container'
import { Camera, Group, Mesh, Raycaster, Vector2, Vector3 } from 'three'
import { MOVE_CONSTANTS } from './constants'

export class MoveInteractionHandler implements InteractionHandler {
	public id: string = 'move'

	public priority: number = 60

	public enabled: boolean = true

	private isActive: boolean = false
	private initialMousePos: Vector2 = new Vector2()
	private initialUV: Vector2 = new Vector2()
	private initialWidgetPosition: Vector3 = new Vector3()
	private handleType: 'x' | 'y' | 'center' = 'center'
	private strategy: UpdateLatticeStrategy | null = null
	private mouse: Vector2 = new Vector2()
	private raycaster: Raycaster | null = null
	private activeStampId: string | null = null
	private initialStampInfo: StampInfo | null = null
	private previewStampInfo: StampInfo | null = null
	private hasPreviewChanges: boolean = false
	private readonly geometryProjectionService: GeometryProjectionService = container.resolve<GeometryProjectionService>(
		'GeometryProjectionService'
	)
	private readonly pointerMathService: PointerMathService = container.resolve<PointerMathService>('PointerMathService')
	private readonly widgetTransformService: WidgetTransformService =
		container.resolve<WidgetTransformService>('WidgetTransformService')

	public constructor(private readonly editor: Editor) {}

	public isEnabled(event: InteractionEvent): boolean {
		if (!this.enabled || !event.context?.hitResult) {
			return false
		}

		return event.context.hitResult.type === 'move-handle'
	}

	public async onEvent(event: InteractionEvent): Promise<InteractionHandlerResult> {
		if (event.type === CanvasEventType.MoveStart) {
			if (!event.context || !event.context.hitResult) {
				return new InteractionHandlerResult().setPass()
			}

			const hitResult = event.context.hitResult
			if (hitResult.type !== 'move-handle') {
				return new InteractionHandlerResult().setPass()
			}

			this.handleType = hitResult.handleType || 'center'
			this.raycaster = event.context.raycaster
			return this.handleMoveStart(event, this.editor)
		}

		if (this.isActive) {
			if (event.type === CanvasEventType.Move) {
				return this.handleMove(event, this.editor)
			} else if (event.type === CanvasEventType.MoveEnd) {
				return this.handleMoveEnd(event)
			}
		}

		return new InteractionHandlerResult().setPass()
	}

	private handleMoveStart(event: InteractionEvent, editor: any): InteractionHandlerResult {
		const raycaster = (event.context as any).raycaster
		const mouse = (event.context as any).mouse

		editor.updateCameraMatrix()
		this.pointerMathService.normalizeMousePosition(
			{ clientX: event.x, clientY: event.y },
			editor.getDomElement(),
			editor.camera,
			raycaster,
			mouse
		)

		this.mouse = mouse
		this.raycaster = raycaster
		this.initialMousePos.copy(mouse)

		const controller = editor.controller
		const widget = editor.controller.getMoveTool().getWidget()
		const state = controller.getState()
		const selectedStampId = state.selectedStampId

		const selectedStamp = selectedStampId ? controller.project.stampList.getStampById(selectedStampId) : null
		const stampInfo = selectedStamp?.data.stampInfo
		if (!stampInfo || !widget) {
			return new InteractionHandlerResult().setPass()
		}

		if (selectedStamp) {
			this.strategy = getStrategy(selectedStamp.data.projectionType)
		}

		const widgetGroup = widget.getGroup()
		widgetGroup.updateMatrixWorld(true)
		widgetGroup.getWorldPosition(this.initialWidgetPosition)

		this.initialUV = stampInfo.uv.clone()
		this.activeStampId = selectedStamp.data.id
		this.initialStampInfo = this.cloneStampInfo(stampInfo)
		this.previewStampInfo = null
		this.hasPreviewChanges = false

		this.isActive = true
		editor.controls.enabled = false
		this.editor.reactBridge.hideStampContextMenu()

		return new InteractionHandlerResult().setCapture()
	}

	private handleMove(event: InteractionEvent, editor: any): InteractionHandlerResult {
		const raycaster = (event.context as any).raycaster
		const mouse = (event.context as any).mouse

		editor.updateCameraMatrix()
		this.pointerMathService.normalizeMousePosition(
			{ clientX: event.x, clientY: event.y },
			editor.getDomElement(),
			editor.camera,
			raycaster,
			mouse
		)

		this.mouse = mouse
		this.raycaster = raycaster
		const deltaMouse = new Vector2(this.mouse.x - this.initialMousePos.x, this.mouse.y - this.initialMousePos.y)

		const controller = editor.controller
		const state = controller.getState()
		const selectedStampId = state.selectedStampId

		const widget = editor.controller.getMoveTool().getWidget()
		const selectedStamp: RuntimeStamp | null = selectedStampId
			? controller.project.stampList.getStampById(selectedStampId)
			: null
		const stampInfo = selectedStamp?.data.stampInfo
		const asset = editor.previewMesh.mesh

		if (!widget || !stampInfo || !asset || selectedStampId === null || !this.strategy || !this.raycaster) {
			return new InteractionHandlerResult().setHandled()
		}

		const widgetGroup = widget.getGroup()
		const { screenU, screenV } = this.calculateScreenSpaceAxes(widgetGroup, editor.camera)

		if (this.handleType === 'x' && !this.strategy.canMoveX()) {
			return new InteractionHandlerResult().setHandled()
		}
		if (this.handleType === 'y' && !this.strategy.canMoveY()) {
			return new InteractionHandlerResult().setHandled()
		}
		if (this.handleType === 'center' && !this.strategy.canMoveCenter()) {
			return new InteractionHandlerResult().setHandled()
		}

		if (this.handleType === 'center') {
			if (!this.handleCenterHandleMovement(controller, stampInfo, asset, widgetGroup)) {
				return new InteractionHandlerResult().setHandled()
			}
			return new InteractionHandlerResult().setHandled()
		}

		this.handleAxisConstrainedMovement(
			controller,
			stampInfo,
			asset,
			widgetGroup,
			deltaMouse,
			screenU,
			screenV
		)

		return new InteractionHandlerResult().setHandled()
	}

	private handleMoveEnd(_event: InteractionEvent): InteractionHandlerResult {
		if (!this.isActive) {
			return new InteractionHandlerResult().setPass()
		}

		this.editor.controls.enabled = true
		if (this.hasPreviewChanges && this.activeStampId && this.previewStampInfo) {
			this.editor.controller.historyController.execute(
				new MoveStampCommand(this.activeStampId, this.previewStampInfo, this.editor.controller)
			)
		}

		this.isActive = false
		this.strategy = null
		this.activeStampId = null
		this.initialStampInfo = null
		this.previewStampInfo = null
		this.hasPreviewChanges = false
		this.editor.reactBridge.showStampContextMenu()

		return new InteractionHandlerResult().setReleaseCapture()
	}

	private calculateScreenSpaceAxes(widgetGroup: Group, camera: Camera): { screenU: Vector2; screenV: Vector2 } {
		widgetGroup.updateMatrixWorld(true)
		const widgetPosition = new Vector3()
		widgetGroup.getWorldPosition(widgetPosition)

		const worldU = new Vector3(1, 0, 0).transformDirection(widgetGroup.matrixWorld)
		const worldV = new Vector3(0, 1, 0).transformDirection(widgetGroup.matrixWorld)

		const uScreen = new Vector3()
		uScreen.copy(widgetPosition).add(worldU)
		uScreen.project(camera)

		const vScreen = new Vector3()
		vScreen.copy(widgetPosition).add(worldV)
		vScreen.project(camera)

		const widgetScreen = new Vector3()
		widgetScreen.copy(widgetPosition)
		widgetScreen.project(camera)

		const screenU = new Vector2(uScreen.x - widgetScreen.x, uScreen.y - widgetScreen.y).normalize()
		const screenV = new Vector2(vScreen.x - widgetScreen.x, vScreen.y - widgetScreen.y).normalize()

		return { screenU, screenV }
	}

	private applyPreviewAndWidget(
		controller: EditorController,
		stampInfo: StampInfo,
		newUV: Vector2,
		normal: Vector3,
		uAxis: Vector3,
		vAxis: Vector3,
		widgetGroup: Group,
		updateWidgetPosition?: Vector3
	): void {
		const updatedStampInfo: StampInfo = {
			...stampInfo,
			uv: newUV.clone(),
		}

		if (this.initialStampInfo && updatedStampInfo.uv.distanceTo(this.initialStampInfo.uv) > 0) {
			this.hasPreviewChanges = true
		}
		this.previewStampInfo = updatedStampInfo

		if (!this.activeStampId) {
			return
		}

		const stamp = controller.project.stampList.getStampById(this.activeStampId)
		const latticeMesh = stamp?.latticeMesh
		if (latticeMesh && stamp) {
			latticeMesh.updateTransform(updatedStampInfo, stamp.data.projectionType)
		}

		controller.latticeNeedsRender = true
		this.editor.reactBridge.refreshStampContextMenuPosition()

		if (updateWidgetPosition) {
			widgetGroup.position.copy(updateWidgetPosition)
			widgetGroup.updateMatrixWorld(true)
		}

		this.widgetTransformService.updateWidgetOrientation(widgetGroup, normal, uAxis, vAxis, stampInfo.rotation || 0)
	}

	private cloneStampInfo(stampInfo: StampInfo): StampInfo {
		return {
			uv: stampInfo.uv.clone(),
			sizeX: stampInfo.sizeX,
			sizeY: stampInfo.sizeY,
			rotation: stampInfo.rotation,
		}
	}

	private calculateAxisConstrainedUVDelta(
		deltaMouse: Vector2,
		screenU: Vector2,
		screenV: Vector2,
		rotation: number,
		handleType: 'x' | 'y'
	): { deltaU: number; deltaV: number } {
		const cosR = Math.cos(-rotation)
		const sinR = Math.sin(-rotation)

		let deltaU = 0
		let deltaV = 0

		if (handleType === 'x') {
			const uComponent = deltaMouse.dot(screenU)
			const movementAmount = uComponent * MOVE_CONSTANTS.SENSITIVITY
			deltaU = movementAmount * cosR
			deltaV = movementAmount * sinR
		} else if (handleType === 'y') {
			const vComponent = deltaMouse.dot(screenV)
			const movementAmount = vComponent * MOVE_CONSTANTS.SENSITIVITY
			deltaU = -movementAmount * sinR
			deltaV = -movementAmount * cosR
		}

		return { deltaU, deltaV }
	}

	private handleCenterHandleMovement(
		controller: EditorController,
		stampInfo: StampInfo,
		asset: Mesh,
		widgetGroup: Group
	): boolean {
		if (!this.raycaster) {
			return false
		}

		const meshIntersects = this.raycaster.intersectObject(asset)
		if (meshIntersects.length === 0) {
			return false
		}

		const intersection = meshIntersects[0]
		if (!intersection.uv) {
			return false
		}

		const uv = intersection.uv.clone()

		const { normal, uAxis, vAxis } = SurfaceDataCalculator.calculateFromIntersection(
			intersection,
			asset
		)

		const constrainedUV = this.strategy!.constrainUV(uv, this.initialUV)

		this.applyPreviewAndWidget(
			controller,
			stampInfo,
			constrainedUV,
			normal,
			uAxis,
			vAxis,
			widgetGroup,
			intersection.point
		)

		return true
	}

	private handleAxisConstrainedMovement(
		controller: EditorController,
		stampInfo: StampInfo,
		asset: Mesh,
		widgetGroup: Group,
		deltaMouse: Vector2,
		screenU: Vector2,
		screenV: Vector2
	): void {
		if (this.handleType === 'center') {
			return
		}

		const rotation = stampInfo.rotation || 0
		const { deltaU, deltaV } = this.calculateAxisConstrainedUVDelta(
			deltaMouse,
			screenU,
			screenV,
			rotation,
			this.handleType
		)

		const calculatedUV = new Vector2(this.initialUV.x + deltaU, this.initialUV.y + deltaV)
		const newUV = this.strategy!.constrainUV(calculatedUV, this.initialUV)

		const newPosition = this.geometryProjectionService.getPositionFromUV(asset.geometry, asset, newUV)
		if (!newPosition) {
			return
		}

		widgetGroup.position.copy(newPosition)

		const surfaceBasis = this.geometryProjectionService.inferSurfaceBasisFromUV(asset, newUV)
		if (surfaceBasis) {
			this.applyPreviewAndWidget(
				controller,
				stampInfo,
				newUV,
				surfaceBasis.normal,
				surfaceBasis.uAxis,
				surfaceBasis.vAxis,
				widgetGroup
			)
			return
		}

		const updatedStampInfo: StampInfo = {
			...stampInfo,
			uv: newUV.clone(),
		}
		if (this.initialStampInfo && updatedStampInfo.uv.distanceTo(this.initialStampInfo.uv) > 0) {
			this.hasPreviewChanges = true
		}
		this.previewStampInfo = updatedStampInfo
		if (this.activeStampId) {
			const stamp = controller.project.stampList.getStampById(this.activeStampId)
			const latticeMesh = stamp?.latticeMesh
			if (latticeMesh && stamp) {
				latticeMesh.updateTransform(updatedStampInfo, stamp.data.projectionType)
			}
			controller.latticeNeedsRender = true
			this.editor.reactBridge.refreshStampContextMenuPosition()
		}

		const currentSurfaceBasis = this.geometryProjectionService.inferSurfaceBasisFromUV(asset, stampInfo.uv)
		if (currentSurfaceBasis) {
			this.widgetTransformService.updateWidgetOrientation(
				widgetGroup,
				currentSurfaceBasis.normal,
				currentSurfaceBasis.uAxis,
				currentSurfaceBasis.vAxis,
				stampInfo.rotation || 0
			)
		}
	}
}
