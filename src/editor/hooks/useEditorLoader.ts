import { Editor } from '@/editor/main/Editor'
import { EditorFactory } from '@/editor/main/EditorFactory'
import { EditorState, useEditorStore } from '@/editor/store/editorStore'
import { DesignImageItemWithUrl, ProjectRecord } from '@/editor/types/projectTypes'
import { useEffect } from 'react'

async function load(projectId: string): Promise<[ProjectRecord, DesignImageItemWithUrl[]]> {
	const now = new Date().toISOString()
	const project: ProjectRecord = {
		id: projectId,
		userId: '',
		designId: '',
		projectData: {},
		images: [],
		createdAt: now,
		updatedAt: now,
	}
	const designImages: DesignImageItemWithUrl[] = []
	return [project, designImages]
}

export function useEditorLoader(projectId: string, mountRef: React.RefObject<HTMLDivElement | null>): EditorState {
	let editorStore = useEditorStore()

	useEffect(() => {
		if (!mountRef.current) return

		const container = mountRef.current
		let isCancelled = false
		let editor: Editor | null = null

		editorStore.setLoading(true)

		new EditorFactory().createEditor(container).then(async (editorInstance) => {
			if (isCancelled) {
				editorInstance.destroy()
				return
			}

			editor = editorInstance

			try {
				const [projectData, designImages] = await load(projectId)
				await editor.setProjectData(projectData)
				editorStore.setDesignImages(designImages)
				editorStore.setEditor(editor)
				editorStore.setProjectId(projectId)
				editorStore.setDesignId(projectData.designId)
				editor.animate()
				await new Promise((resolve) => setTimeout(resolve, 500))
				editorStore.setLoading(false)
			} catch (error) {
				editorStore.setLoadingError(error as string)
			}
		})

		return () => {
			isCancelled = true
			if (editor) {
				editor.destroy()
			}
		}
	}, [])

	return editorStore
}
