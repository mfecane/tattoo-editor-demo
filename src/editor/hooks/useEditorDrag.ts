import { DesignImageProps } from '@/editor/components/DesignImagesPanel'
import { EDITOR_CANVAS_DROPPABLE_ID, EditorDragType } from '@/editor/lib/constants'
import { SetSelectedStampIdCommand } from '@/editor/main/commands/SetSelectedStampIdCommand'
import { EditorState } from '@/editor/store/editorStore'
import {
	DragEndEvent,
	DragStartEvent,
	PointerSensor,
	SensorDescriptor,
	SensorOptions,
	useSensor,
	useSensors,
} from '@dnd-kit/core'
import { useState } from 'react'

interface EditorDragResult {
	sensors: SensorDescriptor<SensorOptions>[]
	isDragging: boolean
	dragImage: DesignImageProps | null
	handleDragStart: (event: DragStartEvent) => void
	handleDragEnd: (event: DragEndEvent) => void
}

// dnd wrapper to drag and place stamp
export function useEditorDrag(editorState: EditorState): EditorDragResult {
	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

	const [isDragging, setIsDragging] = useState(false)

	const [dragImage, setDragImage] = useState<DesignImageProps | null>(null)

	const handleDragStart = (event: DragStartEvent) => {
		const editor = editorState.editor
		if (!editor) return

		const data = event.active.data.current as DesignImageProps
		if (
			(data?.type !== EditorDragType.DESIGN_IMAGE && data?.type !== EditorDragType.PROJECT_IMAGE) ||
			!data.imageUrl ||
			!data.hash
		) {
			return
		}

		const controller = editor?.controller
		if (!editor || !controller) return

		controller.historyController.execute(new SetSelectedStampIdCommand(null, controller))

		// trigger image loading
		editor.controller.onStartDragImage(data.hash, data.source)

		setDragImage(data)

		setIsDragging(true)
	}

	const handleDragEnd = (event: DragEndEvent) => {
		const editor = editorState.editor
		const overId = event.over?.id
		const data = event.active.data.current as DesignImageProps
		const translatedRect = event.active.rect.current.translated

		if (!translatedRect) {
			throw new Error('Translated draggable rect is missing on drag end')
		}

		const dropClientX = translatedRect.left + translatedRect.width / 2
		const dropClientY = translatedRect.top + translatedRect.height / 2

		if (
			editor &&
			overId === EDITOR_CANVAS_DROPPABLE_ID &&
			(data?.type === EditorDragType.DESIGN_IMAGE || data?.type === EditorDragType.PROJECT_IMAGE) &&
			data.imageUrl
		) {
			const dropIntersection = editor.controller.resolveDropIntersection(dropClientX, dropClientY)
			if (!dropIntersection) {
				setDragImage(null)
				setIsDragging(false)
				return
			}

			editorState.setPendingPlacement({
				image: data,
				clientX: dropClientX,
				clientY: dropClientY,
				intersection: dropIntersection,
			})
		}

		setDragImage(null)

		setIsDragging(false)
	}

	return { sensors, isDragging, dragImage, handleDragStart, handleDragEnd }
}
