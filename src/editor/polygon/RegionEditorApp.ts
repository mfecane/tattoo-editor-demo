import { REGION_EDITOR_CONSTANTS } from '@/editor/constants'
import { SketchSpaceMapper } from '@/editor/polygon/SketchSpaceMapper'
import { PolygonCanvasEventHandler } from '@/editor/polygon/interaction/PolygonCanvasEventHandler'
import { PolygonKeyboardHandler } from '@/editor/polygon/interaction/PolygonKeyboardHandler'
import { PolygonCollection } from '@/editor/polygon/PolygonCollection'
import { PolygonSnapshot, RegionEditorController } from '@/editor/polygon/RegionEditorController'
import { PolygonHitTester } from '@/editor/polygon/PolygonHitTester'
import { PolygonPoint } from '@/editor/polygon/PolygonPoint'
import { RegionShape } from '@/editor/polygon/RegionShape'
import { PolygonRenderer } from '@/editor/polygon/rendering/PolygonRenderer'
import { Application, Assets, Sprite, Texture } from 'pixi.js'

/**
 * Composition root for the lasso-polygon editor: bootstraps the Pixi
 * application and background sprite, then wires the model / hit tester /
 * controller / event handler / renderer together. Each concern lives in its
 * own class - the one piece of policy this class does own directly is
 * persistence timing (see bindPersistence), since that's a property of the
 * app's own lifecycle, not of any single sub-component.
 */
export class RegionEditorApp {
	public readonly controller: RegionEditorController

	private readonly collection = new PolygonCollection()
	private readonly hitTester = new PolygonHitTester()
	private readonly renderer = new PolygonRenderer()

	private app: Application | null = null
	private eventHandler: PolygonCanvasEventHandler | null = null
	private readonly keyboardHandler: PolygonKeyboardHandler
	private mapper: SketchSpaceMapper | null = null

	// React StrictMode mounts effects twice (mount -> cleanup -> mount) and
	// destroy() can land before any of the awaits below have resolved, when
	// there's nothing yet to tear down. Without this flag the abandoned
	// instance keeps initializing in the background and appends a second,
	// orphaned Pixi canvas + controller into the same container.
	private destroyed: boolean = false

	public constructor() {
		this.controller = new RegionEditorController(this.collection, this.hitTester)
		this.keyboardHandler = new PolygonKeyboardHandler(this.controller)
	}

	public async init(container: HTMLDivElement, imageUrl: string, initialRegions: RegionShape[] = []): Promise<void> {
		const app = new Application()
		await app.init({
			resizeTo: container,
			backgroundAlpha: 0,
			antialias: true,
		})
		if (this.destroyed) {
			app.destroy(true, { children: true, texture: true })
			return
		}
		this.app = app
		container.appendChild(app.canvas)

		// imageUrl may be a blob: URL (uploaded file) with no recognizable extension, so the
		// resolver can't detect the right parser from the URL alone - force it explicitly.
		const texture: Texture = await Assets.load({ src: imageUrl, parser: 'texture' })
		if (this.destroyed) {
			return
		}
		const sprite = new Sprite(texture)
		fitSpriteToContainer(sprite, app.screen.width, app.screen.height, REGION_EDITOR_CONSTANTS.VIEWPORT_PADDING)
		app.stage.addChild(sprite)

		app.stage.hitArea = app.screen

		this.mapper = new SketchSpaceMapper(sprite.x, sprite.y, sprite.width, sprite.height)

		this.renderer.init(app.stage, this.controller)
		this.eventHandler = new PolygonCanvasEventHandler(app.stage, this.controller)
		this.controller.bindCanvasEventHandler(this.eventHandler)

		if (initialRegions.length > 0) {
			const mapper = this.mapper
			this.controller.loadRegions(
				initialRegions.map((shape) => ({ ...shape, points: shape.points.map((point) => mapper.fromNormalized(point)) }) as RegionShape)
			)
		}
	}

	/** All closed regions, converted to normalized 0..1 sketch-space - what gets persisted. */
	public getNormalizedRegions(): RegionShape[] {
		if (!this.mapper) {
			return []
		}
		const mapper = this.mapper
		return this.controller
			.getState()
			.polygons.filter((polygon) => polygon.closed)
			.map((polygon) => ({ kind: polygon.kind, points: polygon.points.map((point) => mapper.toNormalized(point)) }) as RegionShape)
	}

	/** Adds a rect spanning the full image and selects it - the "whole image" shortcut. */
	public selectWholeImage(): void {
		if (!this.mapper) {
			return
		}
		const mapper = this.mapper
		const corners: [PolygonPoint, PolygonPoint] = [
			{ x: 0, y: 0 },
			{ x: 1, y: 1 },
		].map((point) => mapper.fromNormalized(point)) as [PolygonPoint, PolygonPoint]
		this.controller.addRegion({ kind: 'aarect', points: corners })
	}

	/** Closed regions with points normalized to whole-image 0..1 space - for thumbnails that need to place a shape within the image, not just its own bounds. */
	public getNormalizedShapes(): PolygonSnapshot[] {
		if (!this.mapper) {
			return []
		}
		const mapper = this.mapper
		return this.controller
			.getState()
			.polygons.filter((polygon) => polygon.closed)
			.map((polygon) => ({ ...polygon, points: polygon.points.map((point) => mapper.toNormalized(point)) }))
	}

	public getSelectedNormalizedRegion(): RegionShape | null {
		const selected = this.controller.getSelectedRegion()
		if (!selected || !this.mapper) {
			return null
		}
		const mapper = this.mapper
		return { ...selected, points: selected.points.map((point) => mapper.toNormalized(point)) } as RegionShape
	}

	/**
	 * Wires this app's region model to persistence for its whole remaining lifetime: calls
	 * onChange once immediately with the current normalized regions, then again on every
	 * subsequent model change, until the returned unsubscribe function is called. Callers (the
	 * React layer) only supply where a snapshot goes, not when one is taken.
	 */
	public bindPersistence(onChange: (regions: RegionShape[]) => void): () => void {
		const notify = (): void => onChange(this.getNormalizedRegions())
		notify()
		return this.controller.subscribe(notify)
	}

	public destroy(): void {
		this.destroyed = true

		this.eventHandler?.destroy()
		this.eventHandler = null
		this.keyboardHandler.destroy()
		this.renderer.destroy()

		this.app?.destroy(true, { children: true, texture: true })
		this.app = null
	}
}

function fitSpriteToContainer(sprite: Sprite, width: number, height: number, padding: number): void {
	const availableWidth = Math.max(width - padding * 2, 1)
	const availableHeight = Math.max(height - padding * 2, 1)
	const scale = Math.min(availableWidth / sprite.texture.width, availableHeight / sprite.texture.height)
	sprite.width = sprite.texture.width * scale
	sprite.height = sprite.texture.height * scale
	sprite.x = (width - sprite.width) / 2
	sprite.y = (height - sprite.height) / 2
}
