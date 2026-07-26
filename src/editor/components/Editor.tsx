'use client'
import { Loader } from '@/components/ui/loader'
import { AppliedPiecesStack } from '@/editor/components/AppliedPiecesStack'
import { EditorControls } from '@/editor/components/EditorControls'
import { EditorHeader } from '@/editor/components/EditorHeader'
import { EditorPanel } from '@/editor/components/EditorPanel'
import { RegionSelectionModal } from '@/editor/components/RegionSelectionModal'
import { useEditorLoader } from '@/editor/hooks/useEditorLoader'
import { ReactBridgeContext, useReactBridge } from '@/editor/hooks/useReactBridge'
import { registerEditorServices } from '@/editor/services/registerEditorServices'
import { cn } from '@/lib/utils'
import { useRef } from 'react'

interface EditorProps {
	projectId: string
}

export function Editor({ projectId }: EditorProps) {
	registerEditorServices()

	const mountRef = useRef<HTMLDivElement>(null)

	const editorStore = useEditorLoader(projectId, mountRef)

	const reactBridge = useReactBridge()

	if (editorStore.loadingError) {
		return (
			<div className="flex h-full items-center justify-center bg-surface">
				<div className="text-center">
					<div className="text-red-400 mb-4">{editorStore.loadingError}</div>
				</div>
			</div>
		)
	}

	const editorClasses = cn('w-full h-full relative bg-neutral-950')

	return (
		<ReactBridgeContext.Provider value={reactBridge}>
			<main className="fixed inset-0 flex flex-col bg-surface relative w-full h-full">
				{editorStore.loading && (
					<div className="absolute inset-0 z-[100] flex items-center justify-center bg-surface/80 backdrop-blur-md">
						<Loader />
					</div>
				)}

				{editorStore.editor && <EditorHeader />}

				<div className="flex flex-1 overflow-hidden">
					<section className="relative flex-1 overflow-hidden">
						<div ref={mountRef} id="editor-container" className={editorClasses}>
							{editorStore.editor && <EditorControls />}
							{editorStore.editor && <AppliedPiecesStack />}
						</div>
					</section>
					<EditorPanel />
				</div>

				{editorStore.editor && <RegionSelectionModal />}
			</main>
		</ReactBridgeContext.Provider>
	)
}
