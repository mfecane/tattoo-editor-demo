'use client'
import { Loader } from '@/components/ui/loader'
import { EditorControls } from '@/editor/components/EditorControls'
import { EditorHeader } from '@/editor/components/EditorHeader'
import { EditorPanel } from '@/editor/components/EditorPanel'
import { useEditorDrag } from '@/editor/hooks/useEditorDrag'
import { useEditorLoader } from '@/editor/hooks/useEditorLoader'
import { ReactBridgeContext, useReactBridge } from '@/editor/hooks/useReactBridge'
import { EDITOR_CANVAS_DROPPABLE_ID } from '@/editor/lib/constants'
import { registerEditorServices } from '@/editor/services/registerEditorServices'
import { cn } from '@/lib/utils'
import { DndContext, DragOverlay, useDroppable } from '@dnd-kit/core'
import { useRef } from 'react'

interface EditorProps {
	projectId: string
}

export function Editor({ projectId }: EditorProps) {
	registerEditorServices()

	const mountRef = useRef<HTMLDivElement>(null)

	const editorStore = useEditorLoader(projectId, mountRef)

	const reactBridge = useReactBridge()

	const { sensors, isDragging, handleDragStart, handleDragEnd, dragImage } = useEditorDrag(editorStore)

	if (editorStore.loadingError) {
		return (
			<div className="flex h-full items-center justify-center bg-surface">
				<div className="text-center">
					<div className="text-red-400 mb-4">{editorStore.loadingError}</div>
				</div>
			</div>
		)
	}

	const editorClasses = cn('w-full h-full relative bg-gray-950')

	return (
		<ReactBridgeContext.Provider value={reactBridge}>
			<main className="fixed inset-0 flex flex-col bg-surface relative w-full h-full">
				{editorStore.loading && (
					<div className="absolute inset-0 z-[100] flex items-center justify-center bg-surface/80 backdrop-blur-md">
						<Loader />
					</div>
				)}

				{editorStore.editor && <EditorHeader />}

				<DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
					<div className="flex flex-1 overflow-hidden">
						<section className="relative flex-1 overflow-hidden">
							{isDragging && <CanvasDroppable />}
							<div ref={mountRef} id="editor-container" className={editorClasses}>
								{editorStore.editor && <EditorControls />}
							</div>
						</section>
						<EditorPanel />
					</div>
					{dragImage && <DragImage imageUrl={dragImage.imageUrl} />}
				</DndContext>
			</main>
		</ReactBridgeContext.Provider>
	)
}

function DragImage({ imageUrl }: { imageUrl: string }) {
	return (
		<DragOverlay dropAnimation={null}>
			<div className="aspect-[3/4] w-24 rounded-sm overflow-hidden border border-gray-800 bg-gray-900 shadow-lg cursor-grabbing pointer-events-none">
				<img
					src={imageUrl}
					alt=""
					className="w-full h-full object-cover pointer-events-none"
					draggable={false}
				/>
			</div>
		</DragOverlay>
	)
}

function CanvasDroppable() {
	const { setNodeRef } = useDroppable({ id: EDITOR_CANVAS_DROPPABLE_ID })
	return <div ref={setNodeRef} className="absolute inset-0 z-10"></div>
}
