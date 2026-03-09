import { EditorDragType } from '@/editor/lib/constants'
import { useEditorStore } from '@/editor/store/editorStore'
import { useDraggable } from '@dnd-kit/core'

export function DesignImagesPanel() {
	const editorStore = useEditorStore()

	return (
		<div>
			<h2 className="text-sm font-medium text-gray-300 mb-3">Design Images</h2>
			<div className="grid grid-cols-2 gap-2">
				{editorStore.designImages
					? editorStore.designImages
							.filter((item) => item.active)
							.sort((a, b) => a.order - b.order)
							.map((item) => {
								const imageUrl = item.resolvedUrl
								return (
									<DesignImage
										key={item.hash}
										id={`design-image-${item.hash}`}
										imageUrl={imageUrl}
										hash={item.hash}
									/>
								)
							})
					: null}
			</div>
		</div>
	)
}

interface DesignImageDraggableProps {
	id: string
	imageUrl: string
	hash: string
}

export interface DesignImageProps {
	type: EditorDragType
	imageUrl: string
	hash: string
	source: 'design' | 'project'
}

function DesignImage({ id, imageUrl, hash }: DesignImageDraggableProps) {
	const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
		id,
		data: {
			type: EditorDragType.DESIGN_IMAGE,
			imageUrl,
			hash,
			source: 'design',
		},
	})

	return (
		<div
			ref={setNodeRef}
			{...attributes}
			{...listeners}
			className={`aspect-[3/4] rounded-sm overflow-hidden border border-gray-800 cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-50' : ''}`}
		>
			<img
				src={imageUrl}
				alt="Design image"
				className="w-full h-full object-cover pointer-events-none"
				draggable={false}
			/>
		</div>
	)
}
