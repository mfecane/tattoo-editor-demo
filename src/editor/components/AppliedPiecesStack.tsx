'use client'
import { AppliedPieceItem } from '@/editor/components/AppliedPieceItem'
import { AppliedPieceThumbnail } from '@/editor/components/AppliedPieceThumbnail'
import { useReactBridgeContext } from '@/editor/hooks/useReactBridge'
import { Piece } from '@/editor/main/PlacedMeshList'
import { PieceThumbnailService } from '@/editor/services/PieceThumbnailService'
import {
	DndContext,
	DragEndEvent,
	DragOverlay,
	DragStartEvent,
	KeyboardSensor,
	PointerSensor,
	closestCenter,
	useSensor,
	useSensors,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useEffect, useRef, useState } from 'react'

export function AppliedPiecesStack() {
	const reactBridge = useReactBridgeContext()
	const thumbnailService: PieceThumbnailService = useRef(new PieceThumbnailService()).current
	const [pieces, setPieces] = useState<Piece[]>([])
	const [draggingId, setDraggingId] = useState<string | null>(null)

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
	)

	useEffect(() => {
		if (!reactBridge) {
			return
		}
		const syncPieces = (): void => setPieces(reactBridge.getPlacedMeshes())
		syncPieces()
		return reactBridge.subscribe(syncPieces)
	}, [reactBridge])

	if (pieces.length === 0) {
		return null
	}

	const handleDragStart = (event: DragStartEvent): void => {
		setDraggingId(String(event.active.id))
	}

	const handleDragEnd = (event: DragEndEvent): void => {
		setDraggingId(null)
		const { active, over } = event
		if (!over || active.id === over.id) {
			return
		}
		const fromIndex: number = pieces.findIndex((piece) => piece.id === active.id)
		const toIndex: number = pieces.findIndex((piece) => piece.id === over.id)
		if (fromIndex === -1 || toIndex === -1) {
			return
		}
		reactBridge?.movePlacedMesh(fromIndex, toIndex)
	}

	const handleDragCancel = (): void => setDraggingId(null)

	const draggingPiece: Piece | null = pieces.find((piece) => piece.id === draggingId) ?? null

	return (
		<div
			id="applied-pieces-panel"
			className="absolute right-4 top-1/2 translate-y-[-50%] max-h-[calc(100vh-32rem)] overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-800 p-2.5 shadow-xl"
		>
			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				onDragStart={handleDragStart}
				onDragEnd={handleDragEnd}
				onDragCancel={handleDragCancel}
			>
				<SortableContext items={pieces.map((piece) => piece.id)} strategy={verticalListSortingStrategy}>
					<div className="flex flex-col items-center gap-2">
						{pieces.map((piece) => (
							<AppliedPieceItem key={piece.id} piece={piece} thumbnailService={thumbnailService} />
						))}
					</div>
				</SortableContext>
				<DragOverlay>
					{draggingPiece && <AppliedPieceThumbnail piece={draggingPiece} thumbnailService={thumbnailService} />}
				</DragOverlay>
			</DndContext>
		</div>
	)
}
