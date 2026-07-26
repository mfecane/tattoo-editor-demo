import type { EditorCommand } from '@/editor/main/EditorCommand'
import type { EditorController } from '@/editor/main/EditorController'
import { RegionShape } from '@/editor/polygon/RegionShape'

export class PersistRegionsCommand implements EditorCommand {
	public constructor(
		private readonly sketchId: string,
		private readonly regions: RegionShape[],
		private readonly controller: EditorController
	) {}

	public execute(): void {
		this.controller.sketchRegionStore.setRegions(this.sketchId, this.regions)
	}

	public isUndoable(): boolean {
		return false
	}
}
