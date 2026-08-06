'use client'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import { useClickOutside } from '@/editor/hooks/useClickOutside'
import { useReactBridgeContext } from '@/editor/hooks/useReactBridge'
import { Piece } from '@/editor/main/PlacedMeshList'
import { ChevronLeft } from 'lucide-react'
import { MouseEvent, PointerEvent, useRef, useState } from 'react'

interface AppliedPieceSettingsProps {
	piece: Piece
}

/** Popover settings for one applied-pieces stack card - currently just that piece's own composited layer contrast (see BodyTextureComposer). */
export function AppliedPieceSettings({ piece }: AppliedPieceSettingsProps) {
	const reactBridge = useReactBridgeContext()

	const [open, setOpen] = useState(false)
	const triggerRef = useRef<HTMLButtonElement>(null)
	const contentRef = useRef<HTMLDivElement>(null)

	// Radix's own outside-click detection listens on document in the bubble phase, which the 3D
	// canvas's pointerdown handler stops before it gets there (see useClickOutside) - this hook
	// listens in the capture phase instead, so clicking the canvas to dismiss the popover works.
	useClickOutside([triggerRef, contentRef], () => setOpen(false), open)

	if (!reactBridge) {
		return null
	}

	const handleContrastChange = (values: number[]) => {
		reactBridge.setPlacedMeshContrast(piece.id, values[0])
	}

	// The card itself is a dnd-kit drag handle and a select-on-click target - stop both so the
	// trigger opens the popover instead of starting a drag or selecting the piece.
	const stopPropagation = (event: MouseEvent | PointerEvent): void => event.stopPropagation()

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					ref={triggerRef}
					id={`applied-piece-settings-trigger-${piece.id}`}
					onPointerDown={stopPropagation}
					onClick={stopPropagation}
					className="block h-full bg-neutral-800/30 hover:text-neutral-50 px-1 transition-colors hover:bg-neutral-600/30"
					title="Piece settings"
				>
					<ChevronLeft className="w-4 h-4" />
				</button>
			</PopoverTrigger>
			<PopoverContent
				ref={contentRef}
				id={`applied-piece-settings-panel-${piece.id}`}
				className="w-72 p-4"
				align="start"
				side="left"
				onPointerDown={stopPropagation}
			>
				<Label htmlFor={`piece-contrast-${piece.id}`} className="text-sm">
					Contrast
				</Label>
				<div className="mt-4">
					<Slider
						id={`piece-contrast-${piece.id}`}
						min={0}
						max={2}
						step={0.01}
						value={[piece.contrast]}
						onValueChange={handleContrastChange}
					/>
				</div>
			</PopoverContent>
		</Popover>
	)
}
