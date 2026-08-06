'use client'
import { AppliedPieceSettings } from '@/editor/components/AppliedPieceSettings'
import { AppliedPieceThumbnail } from '@/editor/components/AppliedPieceThumbnail'
import { useReactBridgeContext } from '@/editor/hooks/useReactBridge'
import { Piece } from '@/editor/main/PlacedMeshList'
import { PieceThumbnailService } from '@/editor/services/PieceThumbnailService'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CSSProperties } from 'react'

interface AppliedPieceItemProps {
	piece: Piece
	thumbnailService: PieceThumbnailService
}

export function AppliedPieceItem({ piece, thumbnailService }: AppliedPieceItemProps) {
	const reactBridge = useReactBridgeContext()
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: piece.id })

	const isSelected: boolean = reactBridge?.getState().selectedPlacedMeshId === piece.id

	const style: CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0 : 1,
	}

	const handleClick = (): void => {
		reactBridge?.requestSelectPlacedMesh(piece.id)
	}

	return (
		<div
			id={`applied-piece-${piece.id}`}
			ref={setNodeRef}
			style={style}
			{...attributes}
			{...listeners}
			className={`flex h-32 bg-neutral-900 shrink-0 touch-none select-none items-stretch justify-center rounded transition-shadow cursor-grab active:cursor-grabbing ${
				isSelected
					? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-gray-800'
					: 'hover:ring-1 hover:ring-neutral-600'
			}`}
		>
			<AppliedPieceSettings piece={piece} />
			<AppliedPieceThumbnail piece={piece} thumbnailService={thumbnailService} onClick={handleClick} />
		</div>
	)
}
