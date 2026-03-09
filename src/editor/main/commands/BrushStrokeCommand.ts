import type { EditorCommand } from '@/editor/main/EditorCommand'
import type { EditorController } from '@/editor/main/EditorController'

export class BrushStrokeCommand implements EditorCommand {
	private readonly beforeVertices: Array<[number, number, number]>
	private readonly afterVertices: Array<[number, number, number]>

	public constructor(
		private readonly stampId: string,
		beforeVertices: Array<[number, number, number]>,
		afterVertices: Array<[number, number, number]>,
		private readonly controller: EditorController
	) {
		this.beforeVertices = beforeVertices.map(([x, y, z]) => [x, y, z])
		this.afterVertices = afterVertices.map(([x, y, z]) => [x, y, z])
	}

	public execute(): void {
		const stamp = this.controller.project.stampList.getStampById(this.stampId)
		stamp.latticeMesh.applyLatticeVertices(this.afterVertices)
		this.controller.latticeNeedsRender = true
	}

	public undo(): void {
		const stamp = this.controller.project.stampList.getStampById(this.stampId)
		stamp.latticeMesh.applyLatticeVertices(this.beforeVertices)
		this.controller.latticeNeedsRender = true
	}

	public redo(): void {
		this.execute()
	}

	public isUndoable(): boolean {
		return true
	}
}
