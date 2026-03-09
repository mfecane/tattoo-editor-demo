import { Slider } from '@/components/ui/slider'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useReactBridgeContext } from '@/editor/hooks/useReactBridge'
import { EditorToolId } from '@/editor/main/tools/EditorTool'
import { Check, Circle, Grid2x2, Maximize2, Move, RotateCcw, RotateCw, Trash2, Zap } from 'lucide-react'

export function StampContextMenu() {
	const reactBridge = useReactBridgeContext()

	if (!reactBridge) {
		return null
	}

	const { state } = reactBridge
	const position = state.stampContextMenuPosition

	if (!position || !state.stampContextMenuVisible) {
		return null
	}

	const menuStyle = {
		left: `${position.x}px`,
		top: `${position.y + 100}px`,
		transform: 'translateX(-50%)',
	}

	if (state.tool !== EditorToolId.Select) {
		return (
			<TooltipProvider>
				<div
					className="absolute z-51 bg-surface border border-border rounded-md shadow-lg p-1 flex gap-1"
					style={menuStyle}
				>
					<Tooltip>
						<TooltipTrigger asChild>
							<button
								onClick={() => reactBridge.handleExitWidget()}
								className="p-2 hover:bg-accent rounded transition-colors"
							>
								<Check className="w-4 h-4" />
							</button>
						</TooltipTrigger>
						<TooltipContent>
							<p>Exit widget</p>
						</TooltipContent>
					</Tooltip>
				</div>
			</TooltipProvider>
		)
	}

	if (state.isBrushMode) {
		return (
			<TooltipProvider>
				<div
					className="absolute z-50 bg-surface border border-border rounded-md shadow-lg p-3 flex flex-col gap-3 min-w-[220px]"
					style={menuStyle}
				>
					<div className="flex gap-1">
						<Tooltip>
							<TooltipTrigger asChild>
								<button
									onClick={() => reactBridge.handleExitBrush()}
									className="p-2 hover:bg-accent rounded transition-colors"
								>
									<Check className="w-4 h-4" />
								</button>
							</TooltipTrigger>
							<TooltipContent>
								<p>Exit warp</p>
							</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<button
									onClick={() => reactBridge.handleResetLattice()}
									className="p-2 hover:bg-accent rounded transition-colors"
								>
									<RotateCcw className="w-4 h-4" />
								</button>
							</TooltipTrigger>
							<TooltipContent>
								<p>Reset Lattice</p>
							</TooltipContent>
						</Tooltip>
					</div>

					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<label className="text-xs font-medium text-foreground flex items-center gap-1.5">
								<Circle className="w-3.5 h-3.5 text-muted-foreground" />
								<span>Brush Size</span>
							</label>
							<span className="text-xs text-muted-foreground font-mono tabular-nums">
								{state.brushSize.toFixed(2)}
							</span>
						</div>
						<Slider
							value={[state.brushSize]}
							onValueChange={(values) => reactBridge.setBrushSize(values[0])}
							min={0.05}
							max={0.5}
							step={0.01}
							className="w-full"
						/>
					</div>

					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<label className="text-xs font-medium text-foreground flex items-center gap-1.5">
								<Zap className="w-3.5 h-3.5 text-muted-foreground" />
								<span>Strength</span>
							</label>
							<span className="text-xs text-muted-foreground font-mono tabular-nums">
								{state.brushStrength.toFixed(3)}
							</span>
						</div>
						<Slider
							value={[state.brushStrength]}
							onValueChange={(values) => reactBridge.setBrushStrength(values[0])}
							min={0.001}
							max={0.1}
							step={0.001}
							className="w-full"
						/>
					</div>
				</div>
			</TooltipProvider>
		)
	}

	return (
		<TooltipProvider>
			<div
				className="absolute z-50 bg-surface border border-border rounded-md shadow-lg p-1 flex gap-1"
				style={menuStyle}
			>
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							onClick={() => reactBridge.handleMove()}
							className="p-2 hover:bg-accent rounded transition-colors"
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
							onClick={() => reactBridge.handleResize()}
							className="p-2 hover:bg-accent rounded transition-colors"
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
							onClick={() => reactBridge.handleRotate()}
							className="p-2 hover:bg-accent rounded transition-colors"
						>
							<RotateCw className="w-4 h-4" />
						</button>
					</TooltipTrigger>
					<TooltipContent>
						<p>Rotate</p>
					</TooltipContent>
				</Tooltip>
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							onClick={() => reactBridge.handleBrush()}
							className="p-2 hover:bg-accent rounded transition-colors"
						>
							<Grid2x2 className="w-4 h-4" />
						</button>
					</TooltipTrigger>
					<TooltipContent>
						<p>Warp</p>
					</TooltipContent>
				</Tooltip>
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							onClick={() => reactBridge.handleDelete()}
							className="p-2 hover:bg-accent rounded transition-colors text-destructive"
						>
							<Trash2 className="w-4 h-4" />
						</button>
					</TooltipTrigger>
					<TooltipContent>
						<p>Delete</p>
					</TooltipContent>
				</Tooltip>
			</div>
		</TooltipProvider>
	)
}
