import { MeshSnapshot, snapshotMesh } from '@/editor/main/MeshSnapshot'
import { RegionShape } from '@/editor/polygon/RegionShape'
import { Mesh, Texture, WebGLRenderTarget } from 'three'

/**
 * A sketch's region once placed on the body - either a flat, unwrapped regionMesh (rigid decal)
 * or a wrapped drapedPatch conforming to the body surface. The drapedPatch-only fields are
 * undefined while kind is 'regionMesh' and populated once makeWrapped() transitions it.
 */
export class Piece {
	public id: string
	public kind: 'regionMesh' | 'drapedPatch'
	public mesh: Mesh
	public sourceShape: RegionShape
	public texture: Texture
	public sketchAspect: number
	public stackIndex: number
	/** Whether a live wrap preview is currently valid for this mesh. */
	public wrapPreviewValid: boolean | null
	/** drapedPatch-only: the mesh's flat, unwrapped geometry + transform, captured at wrap time so unwrap can revert to this state. */
	public flatBackup?: MeshSnapshot
	/** drapedPatch-only: true whenever this patch's draped geometry has changed since its last reverse-bake (wrap/relax/vertex-slide). */
	public bakeDirty?: boolean
	/** drapedPatch-only: cached reverse-bake result (body-UV-space color layer) from the last completed background bake, or null if never baked. */
	public bakedTarget?: WebGLRenderTarget | null
	/** drapedPatch-only: validVertexCount / totalAffectedVertexCount from the last completed bake, or null if never baked. */
	public bakeCoverage?: number | null

	public constructor(params: {
		id: string
		kind: 'regionMesh' | 'drapedPatch'
		mesh: Mesh
		sourceShape: RegionShape
		texture: Texture
		sketchAspect: number
		stackIndex: number
		wrapPreviewValid: boolean | null
		flatBackup?: MeshSnapshot
		bakeDirty?: boolean
		bakedTarget?: WebGLRenderTarget | null
		bakeCoverage?: number | null
	}) {
		this.id = params.id
		this.kind = params.kind
		this.mesh = params.mesh
		this.sourceShape = params.sourceShape
		this.texture = params.texture
		this.sketchAspect = params.sketchAspect
		this.stackIndex = params.stackIndex
		this.wrapPreviewValid = params.wrapPreviewValid
		this.flatBackup = params.flatBackup
		this.bakeDirty = params.bakeDirty
		this.bakedTarget = params.bakedTarget
		this.bakeCoverage = params.bakeCoverage
	}
}

/**
 * Collection of placed meshes - stores both regionMesh (flat) and drapedPatch (wrapped) pieces.
 * When a regionMesh is wrapped, it transitions to drapedPatch and gains a flatBackup for unwrapping.
 * Meshes placed directly on the body surface via the placement tool are initially rigid decals,
 * then can be wrapped to conform to the body surface.
 */
export class PlacedMeshList {
	private entries: Piece[] = []

	public add(id: string, mesh: Mesh, sourceShape: RegionShape, texture: Texture, sketchAspect: number): void {
		this.entries.push(
			new Piece({
				id,
				kind: 'regionMesh',
				mesh,
				sourceShape,
				texture,
				sketchAspect,
				stackIndex: this.entries.length,
				wrapPreviewValid: null,
			})
		)
	}

	/** Disposes any cached bake layer before dropping the entry - a removed patch's baked contribution must not linger in GPU memory. */
	public removeById(id: string): void {
		const entry = this.getById(id)
		if (entry?.kind === 'drapedPatch') {
			entry.bakedTarget?.dispose()
		}
		this.entries = this.entries.filter((entry) => entry.id !== id)
		for (let i = 0; i < this.entries.length; i++) {
			this.entries[i].stackIndex = i
		}
	}

	public getById(id: string): Piece | null {
		return this.entries.find((entry) => entry.id === id) ?? null
	}

	public getAll(): Piece[] {
		return [...this.entries]
	}

	/** Transitions a regionMesh to drapedPatch state by adding flatBackup for unwrap capability. */
	public makeWrapped(id: string, mesh: Mesh): void {
		const entry = this.getById(id)
		if (!entry) {
			return
		}
		entry.kind = 'drapedPatch'
		entry.mesh = mesh
		entry.flatBackup = snapshotMesh(mesh)
		entry.bakeDirty = true
		entry.bakedTarget = null
		entry.bakeCoverage = null
	}

	/** Transitions a drapedPatch back to regionMesh state for unwrapping. Disposes any cached bake layer - it no longer applies once the patch leaves drapedPatch state. */
	public makeUnwrapped(id: string, mesh: Mesh): void {
		const entry = this.getById(id)
		if (!entry) {
			return
		}
		if (entry.kind === 'drapedPatch') {
			entry.bakedTarget?.dispose()
		}
		entry.kind = 'regionMesh'
		entry.mesh = mesh
		entry.flatBackup = undefined
		entry.bakeDirty = undefined
		entry.bakedTarget = undefined
		entry.bakeCoverage = undefined
	}

	/** Re-captures the flat backup from the mesh's current geometry/transform - call right before wrapping. */
	public updateFlatBackup(id: string, mesh: Mesh): void {
		const entry = this.getById(id)
		if (!entry || entry.kind !== 'drapedPatch') {
			return
		}
		entry.flatBackup = snapshotMesh(mesh)
	}

	public setWrapPreviewValid(id: string, valid: boolean | null): void {
		const entry = this.getById(id)
		if (!entry) {
			return
		}
		entry.wrapPreviewValid = valid
	}

	public moveEntry(fromIndex: number, toIndex: number): void {
		if (fromIndex < 0 || fromIndex >= this.entries.length || toIndex < 0 || toIndex >= this.entries.length || fromIndex === toIndex) {
			return
		}
		const [entry] = this.entries.splice(fromIndex, 1)
		this.entries.splice(toIndex, 0, entry)
		for (let i = 0; i < this.entries.length; i++) {
			this.entries[i].stackIndex = i
		}
	}

	public setBakeDirty(id: string, dirty: boolean): void {
		const entry = this.getById(id)
		if (!entry || entry.kind !== 'drapedPatch') {
			return
		}
		entry.bakeDirty = dirty
	}

	/** Stores a freshly completed reverse-bake result, disposing whatever was cached before it. */
	public setBakedLayer(id: string, target: WebGLRenderTarget, coverage: number): void {
		const entry = this.getById(id)
		if (!entry || entry.kind !== 'drapedPatch') {
			target.dispose()
			return
		}
		entry.bakedTarget?.dispose()
		entry.bakedTarget = target
		entry.bakeCoverage = coverage
		entry.bakeDirty = false
	}
}
