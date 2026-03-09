import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useClickOutside } from '@/editor/hooks/useClickOutside'
import { useEditorStore } from '@/editor/store/editorStore'
import { useRef } from 'react'

export function ProjectionTypeSelectionMenu() {
	const editorStore = useEditorStore()
	const menuRef = useRef<HTMLDivElement>(null)

	const pendingPlacement = editorStore.pendingPlacement

	const handleSelectStamp = () => {
		console.groupCollapsed('handleSelectStamp', pendingPlacement)
		console.trace()
		console.groupEnd()
		if (!pendingPlacement) return
		const editor = editorStore.editor
		if (!editor) return
		editor.controller.placeImageAtPosition(pendingPlacement, 'stamp')
		editorStore.setPendingPlacement(null)
	}

	const handleSelectCylindricalLattice = () => {
		if (!pendingPlacement) return
		const editor = editorStore.editor
		if (!editor) return
		editor.controller.placeImageAtPosition(pendingPlacement, 'cylindrical-lattice')
		editorStore.setPendingPlacement(null)
	}

	const handleCancel = () => {
		editorStore.setPendingPlacement(null)
	}

	useClickOutside(menuRef, () => {
		handleCancel()
	})

	if (!pendingPlacement) {
		return null
	}

	return (
		<TooltipProvider>
			<div
				ref={menuRef}
				className="absolute z-[51] bg-surface border border-border rounded-md shadow-lg p-2 flex flex-col gap-2 min-w-[200px]"
				style={{
					left: `${pendingPlacement.clientX}px`,
					top: `${pendingPlacement.clientY}px`,
					transform: 'translate(-50%, -50%)',
				}}
			>
				<div className="text-sm font-medium mb-1 px-1">Select Projection Type</div>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="outline"
							className="w-full justify-start text-left h-auto py-2 px-3"
							onClick={handleSelectStamp}
						>
							<div className="flex flex-col items-start">
								<div className="font-medium">Stamp</div>
								<div className="text-xs text-muted-foreground mt-0.5">
									Full control: move, resize, rotate, warp
								</div>
							</div>
						</Button>
					</TooltipTrigger>
					<TooltipContent>
						<p>Standard projection with all transformations enabled</p>
					</TooltipContent>
				</Tooltip>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="outline"
							className="w-full justify-start text-left h-auto py-2 px-3"
							onClick={handleSelectCylindricalLattice}
						>
							<div className="flex flex-col items-start">
								<div className="font-medium">Cylindrical Lattice</div>
								<div className="text-xs text-muted-foreground mt-0.5">
									Sleeve style: Y-axis only, full width
								</div>
							</div>
						</Button>
					</TooltipTrigger>
					<TooltipContent>
						<p>Optimized for sleeve tattoos with constrained movement</p>
					</TooltipContent>
				</Tooltip>
			</div>
		</TooltipProvider>
	)
}
