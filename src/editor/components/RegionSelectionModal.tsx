import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { DefinedShapesStack } from '@/editor/components/DefinedShapesStack'
import { useReactBridgeContext } from '@/editor/hooks/useReactBridge'
import { useRegionEditorApp } from '@/editor/hooks/useRegionEditorApp'
import { useRegionEditorController } from '@/editor/hooks/useRegionEditorController'
import { PolygonToolId } from '@/editor/polygon/tools/PolygonTool'
import {
	ArrowBigDown,
	Frame,
	Hexagon,
	SquareDashed,
	Trash2,
	X,
} from 'lucide-react'
import { useRef } from 'react'

export function RegionSelectionModal() {
	const reactBridge = useReactBridgeContext()
	const target = reactBridge?.state.sketchEditorTarget ?? null

	const containerRef = useRef<HTMLDivElement>(null)
	const app = useRegionEditorApp(target, reactBridge, containerRef)
	const controller = useRegionEditorController(app?.controller ?? null)

	if (!reactBridge || !target) return null

	const onClose = () => reactBridge.closeRegionEditor()

	const handleSelectWholeImage = () => app?.selectWholeImage()

	const handleStartDrawingPolygon = () => controller?.setActiveTool(controller.getDrawPolygonTool())

	const handleStartDrawingRect = () => controller?.setActiveTool(controller.getDrawRectTool())

	const handleDeleteSelected = () => controller?.deleteSelectedPolygon()

	const handleCancelDrawing = () => controller?.setActiveTool(controller.getSelectTool())

	const handlePlaceOnMesh = () => {
		const region = app?.getSelectedNormalizedRegion()
		if (!region) {
			return
		}
		onClose()
		reactBridge.placeSelectedPolygonOnMesh(target.sketchUrl, region).catch((error: unknown) => {
			console.error('[PolygonSelectionModal] Failed to place mesh:', error)
		})
	}

	const state = controller?.getState() ?? { polygons: [], selectedId: null, activeToolId: PolygonToolId.Select }
	const isDrawing = state.activeToolId !== PolygonToolId.Select
	const hasNoAreas = state.polygons.length === 0 && !isDrawing

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			<div className="fixed inset-0 bg-black/50" onClick={onClose} />

			<div className="relative z-50 flex h-[85vh] w-[90vw] max-w-4xl flex-col rounded-lg bg-neutral-900 shadow-lg">
				<button
					type="button"
					onClick={onClose}
					className="absolute p-2 right-0 top-0 translate-x-[50%] translate-y-[-50%] rounded-full p-1 text-neutral-200 hover:bg-accent hover:text-foreground bg-neutral-900 z-2"
				>
					<X className="h-4 w-4" />
				</button>
				<TooltipProvider>
					<div className="flex items-center justify-between gap-3 rounded-md border border-neutral-800 bg-neutral-950 p-2">
						<div className="flex items-center gap-1">
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										onClick={handleSelectWholeImage}
										disabled={isDrawing}
									>
										<Frame className="h-4 w-4" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									<p>Select whole image</p>
								</TooltipContent>
							</Tooltip>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										onClick={handleStartDrawingRect}
										disabled={isDrawing}
									>
										<SquareDashed className="h-4 w-4" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									<p>Select square region</p>
								</TooltipContent>
							</Tooltip>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										onClick={handleStartDrawingPolygon}
										disabled={isDrawing}
									>
										<Hexagon className="h-4 w-4" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									<p>Define area with points</p>
								</TooltipContent>
							</Tooltip>
							{isDrawing && (
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="destructive"
											size="sm"
											onClick={handleCancelDrawing}
											id="polygon-editor-exit-tool-button"
										>
											<X className="h-4 w-4" />
											Exit {state.activeToolId === PolygonToolId.DrawRect ? 'rectangle' : 'polygon'} tool
										</Button>
									</TooltipTrigger>
									<TooltipContent>
										<p>Cancel drawing and return to selection (Esc)</p>
									</TooltipContent>
								</Tooltip>
							)}
							<Separator orientation="vertical" className="mx-1" />
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										onClick={handleDeleteSelected}
										disabled={!state.selectedId}
										className="text-destructive hover:text-destructive"
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									<p>Delete area</p>
								</TooltipContent>
							</Tooltip>
						</div>

						<Button onClick={handlePlaceOnMesh} disabled={!state.selectedId}>
							<ArrowBigDown className="h-4 w-4" />
							Apply
						</Button>
					</div>
				</TooltipProvider>

				<div className="relative min-h-0 flex-1 overflow-hidden rounded border border-neutral-800 bg-neutral-950">
					<div ref={containerRef} className="h-full w-full" />

					<DefinedShapesStack app={app} controller={controller} />

					{hasNoAreas && (
						<div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/70 p-6 text-center">
							<p className="max-w-sm text-sm text-neutral-300">
								Choose the region of the sketch to place on the body
							</p>
							<div className="flex items-stretch gap-3 flex-col min-w-64">
								<Button onClick={handleSelectWholeImage}>
									<Frame className="h-4 w-4" />
									Select whole image
								</Button>
								<Button onClick={handleStartDrawingRect}>
									<SquareDashed className="h-4 w-4" />
									Select rectangle
								</Button>
								<Button onClick={handleStartDrawingPolygon}>
									<Hexagon className="h-4 w-4" />
									Define area with points
								</Button>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
