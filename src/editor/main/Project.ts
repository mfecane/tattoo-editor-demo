import { EDITOR_CONSTANTS } from '@/editor/lib/constants'
import type { EditorController } from '@/editor/main/EditorController'
import { RuntimeStampFactory } from '@/editor/main/RuntimeStamp'
import { StampList } from '@/editor/main/StampList'
import type { EditorProject, ProjectRecord } from '@/editor/types/projectTypes'

/**
 * modified from original - save method removed
 */
export class Project {
	public readonly stampFactory: RuntimeStampFactory

	public readonly stampList: StampList = new StampList()

	public constructor(private readonly controller: EditorController) {
		this.stampFactory = new RuntimeStampFactory(this.controller.editor)
	}

	public setProjectData(project: ProjectRecord): void {
		const data = project.projectData as EditorProject

		if (this.hasStamps(data) && data.version !== EDITOR_CONSTANTS.SCHEMA_VERSION) {
			throw new Error(`Unsupported schema version: ${data.version}`)
		}

		if (!this.hasStamps(data)) {
			return
		}

		for (const stamp of data.stamps) {
			try {
				const runtimeStamp = this.stampFactory.createFromSerializable(stamp)
				this.stampList.addStamp(runtimeStamp)
			} catch (error) {
				console.warn(`[Project] Error creating runtime stamp: ${error}`)
			}
		}

		this.controller.setSelectedStampId(null)
	}

	private hasStamps(data: ProjectRecord['projectData']): data is EditorProject {
		return data !== null && typeof data === 'object' && 'stamps' in data && Array.isArray(data.stamps)
	}
}
