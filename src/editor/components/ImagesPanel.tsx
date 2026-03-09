import { useReactBridgeContext } from '@/editor/hooks/useReactBridge'
import { ReorderStampsCommand } from '@/editor/main/commands/ReorderStampsCommand'
import { SetSelectedStampIdCommand } from '@/editor/main/commands/SetSelectedStampIdCommand'
import { useEditorStore } from '@/editor/store/editorStore'
import { closestCenter, DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { SortableStampItem } from './SortableStampItem'

export function ImagesPanel() {
	const editor = useEditorStore((state) => state.editor)
	const reactBridge = useReactBridgeContext()
	const state = reactBridge?.getState()
	const stamps = state?.stamps ?? []

	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: 8,
			},
		})
	)

	const handleDragStart = () => {
		if (!editor) {
			return
		}
		editor.controller.historyController.execute(new SetSelectedStampIdCommand(null, editor.controller))
	}

	const handleDragEnd = (event: DragEndEvent) => {
		if (!editor) {
			return
		}

		const { active, over } = event

		if (!over || active.id === over.id) {
			return
		}

		const activeId = active.id as string
		const overId = over.id as string

		const oldIndex = stamps.findIndex((stamp) => stamp.data.id === activeId)
		const newIndex = stamps.findIndex((stamp) => stamp.data.id === overId)

		if (oldIndex === -1 || newIndex === -1) {
			return
		}

		const reorderedStamps = arrayMove(stamps, oldIndex, newIndex)
		const newOrder = reorderedStamps.map((stamp) => stamps.findIndex((s) => s.data.id === stamp.data.id))

		editor.controller.historyController.execute(new ReorderStampsCommand(newOrder, editor.controller))
	}

	const handleImageClick = (stampId: string) => {
		if (!editor) {
			return
		}

		reactBridge?.setSelectedStampId(stampId)
		reactBridge?.setSelectTool()
		reactBridge?.showStampContextMenu()
		reactBridge?.refreshStampContextMenuPosition()
	}

	if (stamps.length === 0) {
		return null
	}

	const reversedStamps = [...stamps].reverse()
	const stampIds = reversedStamps.map((stamp) => stamp.data.id)

	return (
		<div className="absolute right-4 top-1/2 z-50 max-h-[calc(100vh-10rem)] w-24 -translate-y-1/2 rounded bg-background p-2">
			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				onDragStart={handleDragStart}
				onDragEnd={handleDragEnd}
			>
				<SortableContext items={stampIds} strategy={verticalListSortingStrategy}>
					<div className="space-y-3">
						{reversedStamps.map((stamp, reversedIndex) => {
							const originalIndex = stamps.length - 1 - reversedIndex
							return (
								<SortableStampItem
									key={stamp.data.id}
									stamp={stamp}
									index={originalIndex}
									isSelected={state?.selectedStampId === stamp.data.id}
									onClick={() => handleImageClick(stamp.data.id)}
								/>
							)
						})}
					</div>
				</SortableContext>
			</DndContext>
		</div>
	)
}
