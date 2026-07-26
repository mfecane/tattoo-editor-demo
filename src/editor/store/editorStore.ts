import { Editor } from '@/editor/main/Editor'
import { DesignImageItemWithUrl } from '@/editor/types/projectTypes'
import { create } from 'zustand'

export interface EditorState {
	loading: boolean
	setLoading: (loading: boolean) => void

	loadingError: string | null
	setLoadingError: (loadingError: string | null) => void

	projectId: string | null
	setProjectId: (projectId: string | null) => void

	designId: string | null
	setDesignId: (designId: string | null) => void

	editor: Editor | null
	setEditor: (editor: Editor | null) => void

	designImages: DesignImageItemWithUrl[] | null
	setDesignImages: (designImages: DesignImageItemWithUrl[] | null) => void
}

export const useEditorStore = create<EditorState>((set) => ({
	loading: true,
	setLoading: (loading) => set({ loading }),

	loadingError: null,
	setLoadingError: (loadingError) => set({ loadingError }),

	projectId: null,
	setProjectId: (projectId) => set({ projectId }),

	designId: null,
	setDesignId: (designId) => set({ designId }),

	editor: null,
	setEditor: (editor) => set({ editor }),

	designImages: null,
	setDesignImages: (designImages) => set({ designImages }),
}))
