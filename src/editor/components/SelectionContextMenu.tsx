import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { FalloffRadiusControl } from '@/editor/components/FalloffRadiusControl'
import { RelaxControl } from '@/editor/components/RelaxControl'
import { useReactBridgeContext } from '@/editor/hooks/useReactBridge'
import { EditorToolId } from '@/editor/main/tools/EditorTool'
import { cn } from '@/lib/utils'
import { Maximize2, Move, RotateCw, Trash2, Unlink, Waves } from 'lucide-react'

/**
 * Fixed toolbar (bottom-left of the work area, not floating near the mesh
 * anymore) shown whenever a placed mesh is selected. Move/Resize/Rotate are
 * toggle buttons reflecting the active tool - clicking a different one
 * switches directly to it, clicking the active one exits back to Select.
 * Unwrap/Wrap and Delete stay available no matter which of those three is
 * active, so there's no separate "exit widget" checkmark state anymore.
 */
export function SelectionContextMenu() {
	const reactBridge = useReactBridgeContext()

	if (!reactBridge) {
		return null
	}

	const { state } = reactBridge

	if (!state.selectedPlacedMeshId || !state.selectionContextMenuVisible) {
		return null
	}

	const isWrapped = state.selectedPlacedMeshWrapped

	const toolButtonClass = (active: boolean) =>
		cn('p-2 rounded transition-colors', active ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')

	const handleToolClick = (toolId: EditorToolId, activate: () => void) => {
		if (state.tool === toolId) {
			reactBridge.setSelectTool()
		} else {
			activate()
		}
	}

	return (
		<TooltipProvider>
			<div className="absolute z-50 top-4 left-4 flex p-2 gap-2 rounded-md border border-border bg-surface p-1 shadow-lg">
				{!isWrapped && (
					<>
						<Tooltip>
							<TooltipTrigger asChild>
								<button
									onClick={() => handleToolClick(EditorToolId.Move, () => reactBridge.handleMove())}
									className={toolButtonClass(state.tool === EditorToolId.Move)}
								>
									<Move className="w-4 h-4" />
								</button>
							</TooltipTrigger>
							<TooltipContent>
								<p>Move</p>
							</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<button
									onClick={() =>
										handleToolClick(EditorToolId.Scale, () => reactBridge.handleResize())
									}
									className={toolButtonClass(state.tool === EditorToolId.Scale)}
								>
									<Maximize2 className="w-4 h-4" />
								</button>
							</TooltipTrigger>
							<TooltipContent>
								<p>Resize</p>
							</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<button
									onClick={() =>
										handleToolClick(EditorToolId.Rotate, () => reactBridge.handleRotate())
									}
									className={toolButtonClass(state.tool === EditorToolId.Rotate)}
								>
									<RotateCw className="w-4 h-4" />
								</button>
							</TooltipTrigger>
							<TooltipContent>
								<p>Rotate</p>
							</TooltipContent>
						</Tooltip>
					</>
				)}
				{isWrapped && <FalloffRadiusControl />}
				{isWrapped && <RelaxControl />}
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							onClick={() => reactBridge.handleDelete()}
							className="ml-auto p-2 hover:bg-accent rounded transition-colors text-destructive"
						>
							<Trash2 className="w-4 h-4" />
						</button>
					</TooltipTrigger>
					<TooltipContent>
						<p>Delete</p>
					</TooltipContent>
				</Tooltip>

				{isWrapped ? (
					<button
						onClick={() => reactBridge.handleUnwrap()}
						className="min-w-32 flex items-center justify-center gap-2 rounded px-3 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-500 transition-colors"
					>
						<Unlink className="w-4 h-4" />
						Unwrap
					</button>
				) : (
					<button
						onClick={() => reactBridge.handleWrap()}
						disabled={state.selectedPlacedMeshWrapPreviewValid !== true}
						className="min-w-32 flex items-center justify-center gap-2 rounded px-3 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:pointer-events-none"
					>
						<Waves className="w-4 h-4" />
						{state.selectedPlacedMeshWrapPreviewValid === true
							? 'Apply'
							: state.selectedPlacedMeshWrapPreviewValid === false
								? "Can't wrap here"
								: 'Checking…'}
					</button>
				)}
			</div>
		</TooltipProvider>
	)
}
