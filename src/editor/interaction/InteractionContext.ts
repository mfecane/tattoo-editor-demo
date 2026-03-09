import { HitResult } from '@/editor/main/HitTester'
import { Editor } from '@/editor/main/Editor'
import { PointerMathService } from '@/editor/services/PointerMathService'
import { container } from '@/lib/di/container'
import { Intersection, Object3D, PerspectiveCamera, Raycaster, Vector2 } from 'three'

export class InteractionContext {
	public enteredObjects: Object3D[] = []

	public exitedObjects: Object3D[] = []

	public intersections: Intersection<Object3D>[] = []

	public pressedButtons: number = 0

	public hit: Intersection<Object3D> | null = null

	public hitResult: HitResult | null = null

	public raycaster: Raycaster | null = null

	private camera: PerspectiveCamera | null = null

	private domElement: HTMLElement | null = null

	public mouse: Vector2 | null = null

	private previousHitObject: Object3D | null = null
	private readonly pointerMathService: PointerMathService = container.resolve<PointerMathService>('PointerMathService')

	public constructor(private readonly editor: Editor) {}

	public initialize(raycaster: Raycaster, camera: PerspectiveCamera, domElement: HTMLElement, mouse: Vector2): void {
		this.raycaster = raycaster
		this.camera = camera
		this.domElement = domElement
		this.mouse = mouse
	}

	public updatePressedButtons(event: PointerEvent): void {
		this.pressedButtons = event.buttons
	}

	public findIntersections(x: number, y: number): void {
		if (!this.raycaster || !this.camera || !this.domElement || !this.mouse) {
			return
		}

		this.editor.updateCameraMatrix()

		const event = { clientX: x, clientY: y }
		this.pointerMathService.normalizeMousePosition(
			event,
			this.domElement,
			this.camera,
			this.raycaster,
			this.mouse
		)

		this.hitResult = this.editor.hitTester.performHitTest(this.raycaster)

		if (this.hitResult.intersection) {
			this.hit = this.hitResult.intersection
			this.intersections = [this.hitResult.intersection]
		} else {
			this.hit = null
			this.intersections = []
		}

		const currentHitObject = this.hitResult.object ?? this.hit?.object ?? null
		if (currentHitObject !== this.previousHitObject) {
			this.enteredObjects = currentHitObject ? [currentHitObject] : []
			this.exitedObjects = this.previousHitObject ? [this.previousHitObject] : []
			this.previousHitObject = currentHitObject
		} else {
			this.enteredObjects = []
			this.exitedObjects = []
		}
	}

	public clear(): void {
		this.intersections = []
		this.pressedButtons = 0
		this.hit = null
		this.hitResult = null
		this.enteredObjects = []
		this.exitedObjects = []
		this.previousHitObject = null
	}
}
