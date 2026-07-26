'use client'
import { useReactBridgeContext } from '@/editor/hooks/useReactBridge'
import { Piece } from '@/editor/main/PlacedMeshList'
import { PieceThumbnailService } from '@/editor/services/PieceThumbnailService'
import { useEffect, useState } from 'react'
import { WebGLRenderer } from 'three'

interface AppliedPieceThumbnailProps {
	piece: Piece
	thumbnailService: PieceThumbnailService
}

export function AppliedPieceThumbnail({ piece, thumbnailService }: AppliedPieceThumbnailProps) {
	const reactBridge = useReactBridgeContext()
	const [thumbnail, setThumbnail] = useState<string | null>(null)

	useEffect(() => {
		const renderer: WebGLRenderer | undefined = reactBridge?.getRenderer()
		if (!renderer) {
			return
		}
		setThumbnail(thumbnailService.generateThumbnail(piece, renderer))
	}, [piece, thumbnailService, reactBridge])

	return (
		<img
			src={thumbnail ?? ''}
			alt={`Applied piece ${piece.stackIndex + 1}`}
			draggable={false}
			className="block h-32 w-32 rounded object-cover"
		/>
	)
}
