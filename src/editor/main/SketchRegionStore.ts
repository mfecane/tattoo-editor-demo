import { RegionShape } from '@/editor/polygon/RegionShape'

/**
 * Regions drawn on each sketch, keyed by a stable sketch
 * identifier (not the URL, which can be a transient blob: URL). Points
 * are normalized 0..1 sketch-space, independent of any particular
 * editor session's canvas size.
 */
export class SketchRegionStore {
	private regionsBySketch: Map<string, RegionShape[]> = new Map()

	public getRegions(sketchId: string): RegionShape[] {
		return this.regionsBySketch.get(sketchId) ?? []
	}

	public setRegions(sketchId: string, regions: RegionShape[]): void {
		this.regionsBySketch.set(sketchId, regions)
	}
}
