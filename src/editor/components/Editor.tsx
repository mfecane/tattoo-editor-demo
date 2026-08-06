'use client'
import { Loader } from '@/components/ui/loader'
import { AppliedPiecesStack } from '@/editor/components/AppliedPiecesStack'
import { EditorBlockingOverlay } from '@/editor/components/EditorBlockingOverlay'
import { EditorPanel } from '@/editor/components/EditorPanel'
import EditorToolbar from '@/editor/components/EditorToolbar'
import { InstructionOverlay } from '@/editor/components/InstructionOverlay'
import { RegionSelectionModal } from '@/editor/components/RegionSelectionModal'
import { useContainer } from '@/editor/hooks/useContainer'
import { useEditorLoader } from '@/editor/hooks/useEditorLoader'
import { ReactBridgeContext, useReactBridge } from '@/editor/hooks/useReactBridge'
import { PreviewMeshRegistrar } from '@/editor/main/PreviewMeshRegistrar'
import { registerPreviewMeshInstances } from '@/editor/main/registerPreviewMeshInstances'
import { registerEditorServices } from '@/editor/services/registerEditorServices'
import { Container } from '@/lib/di/container'
import { cn } from '@/lib/utils'
import { useRef } from 'react'

interface EditorProps {
	projectId: string
}

export function Editor({ projectId }: EditorProps) {
	const container: Container = useContainer()

	registerEditorServices(container)

	registerPreviewMeshInstances(container.resolve<PreviewMeshRegistrar>('PreviewMeshRegistrar'))

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

	return (
		<ReactBridgeContext.Provider value={reactBridge}>
			<main className="inset-0 flex flex-col bg-surface relative w-full h-full">
				{editorStore.loading && (
					<div className="absolute inset-0 z-[100] flex items-center justify-center bg-surface/80 backdrop-blur-md">
						<Loader />
					</div>
				)}

				<div className="flex flex-1 overflow-hidden">
					<div
						ref={mountRef}
						id="editor-container"
						className={cn('w-full h-full relative flex-1 overflow-hidden bg-neutral-950')}
					>
						{editorStore.editor && <EditorToolbar />}
						{editorStore.editor && <InstructionOverlay />}
						{editorStore.editor && <AppliedPiecesStack />}
						{editorStore.editor && <EditorBlockingOverlay />}
					</div>
					<EditorPanel />
				</div>

				{editorStore.editor && <RegionSelectionModal />}
			</main>
		</ReactBridgeContext.Provider>
	)
}
