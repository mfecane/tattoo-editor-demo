import { RuntimeStamp } from '@/editor/main/RuntimeStamp'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export interface SortableStampItemProps {
	stamp: RuntimeStamp
	index: number
	isSelected: boolean
	onClick: () => void
}

export function SortableStampItem({ stamp, index, isSelected, onClick }: SortableStampItemProps) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: stamp.data.id,
		disabled: isSelected,
	})

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	}

	const imageSrc = stamp.resolvedImage?.src

	return (
		<div
			ref={setNodeRef}
			style={style}
			{...attributes}
			{...listeners}
			onClick={onClick}
			className={`
				group relative aspect-square w-full rounded border cursor-pointer
				transition-all
				${isSelected ? 'border-accent border-1' : ''}
				${isSelected ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}
			`}
		>
			{imageSrc ? (
				<img
					src={imageSrc}
					alt={`Stamp ${index + 1}`}
					className="w-full h-full object-cover pointer-events-none"
				/>
			) : (
				<div className="w-full h-full bg-gray-800 flex items-center justify-center">
					<span className="text-xs text-gray-500">No image</span>
				</div>
			)}
		</div>
	)
}
