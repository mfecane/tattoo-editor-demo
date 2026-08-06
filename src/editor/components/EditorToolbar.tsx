import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Toggle } from '@/components/ui/toggle'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { StampToolBar } from '@/editor/components/StampToolBar'
import { ViewSettings } from '@/editor/components/ViewSettings'
import { useReactBridgeContext } from '@/editor/hooks/useReactBridge'
import { useEditorStore } from '@/editor/store/editorStore'
import { ArrowLeft, Circle, CircleOff, Redo2, Save, Undo2 } from 'lucide-react'

interface Props {}

const defaultHistoryState: { canUndo: boolean; canRedo: boolean } = { canUndo: false, canRedo: false }

const EditorToolbar: React.FC<Props> = ({}) => {
	const reactBridge = useReactBridgeContext()

	const editor = useEditorStore((state) => state.editor)

	const controller = editor?.controller
	const historyState = reactBridge?.getHistoryState() ?? defaultHistoryState
	const widgetsVisible = reactBridge?.state.widgetsVisible ?? false
	const hasSelection = reactBridge?.state.selectedPlacedMeshId != null

	const handleUndo = () => {
		controller?.historyController.undo()
	}

	const handleRedo = () => {
		controller?.historyController.redo()
	}

	const handleWidgetsVisibleChange = (pressed: boolean) => {
		reactBridge?.setWidgetsVisible(pressed)
	}

	return (
		<div className="absolute w-full right-0 left-0 top-0 flex justify-between items-start p-4">
			<TooltipProvider>
				<div className="flex gap-2 ">
					<div className="bg-neutral-900 rounded p-2">
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button type="button" variant="ghost" size="icon" disabled>
										<ArrowLeft />
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									<p>Back to editing design</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					</div>
					<StampToolBar />
				</div>

				<div className="bg-neutral-900 rounded-md overflow-hidden flex gap-2 p-2 items-center">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								type="button"
								onClick={handleUndo}
								disabled={!historyState.canUndo}
								size="icon"
								variant="ghost"
								title="Undo"
							>
								<Undo2 className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>Undo last action</p>
						</TooltipContent>
					</Tooltip>

					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								type="button"
								onClick={handleRedo}
								disabled={!historyState.canRedo}
								size="icon"
								variant="ghost"
								title="Redo"
							>
								<Redo2 className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>Redo last undone action</p>
						</TooltipContent>
					</Tooltip>

					<Tooltip>
						<TooltipTrigger asChild>
							<Button size="icon" type="button" variant="ghost" disabled>
								<Save className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>Save project</p>
						</TooltipContent>
					</Tooltip>

					<ViewSettings />

					<Separator orientation="vertical" />

					<Tooltip>
						<TooltipTrigger asChild>
							<Toggle
								pressed={widgetsVisible}
								onPressedChange={handleWidgetsVisibleChange}
								disabled={hasSelection}
								aria-label="Display widgets"
								title="Display Widgets"
							>
								{widgetsVisible ? <Circle className="h-4 w-4" /> : <CircleOff className="h-4 w-4" />}
							</Toggle>
						</TooltipTrigger>
						<TooltipContent>
							<p>Show/hide placed piece selection handles</p>
						</TooltipContent>
					</Tooltip>
				</div>
			</TooltipProvider>
		</div>
	)
}

export default EditorToolbar
