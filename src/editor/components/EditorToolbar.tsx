import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Toggle } from '@/components/ui/toggle'
import { SelectionContextMenu } from '@/editor/components/SelectionContextMenu'
import { ViewSettings } from '@/editor/components/ViewSettings'
import { useReactBridgeContext } from '@/editor/hooks/useReactBridge'
import { useEditorStore } from '@/editor/store/editorStore'
import { ArrowLeft, Camera, LayoutGrid, Redo2, Save, Undo2 } from 'lucide-react'

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
			<div className="flex gap-2 ">
				<div className="bg-neutral-900 rounded p-2">
					<Button type="button" variant="ghost" size="icon" disabled>
						<ArrowLeft />
					</Button>
				</div>
				<SelectionContextMenu />
			</div>

			<div className="bg-neutral-900 rounded-md overflow-hidden flex gap-2 p-2 items-center">
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

				<Button size="icon" type="button" variant="ghost" disabled>
					<Save className="h-4 w-4" />
				</Button>

				<ViewSettings />

				<Button size="icon" type="button" variant="ghost" disabled>
					<Camera className="h-4 w-4" />
				</Button>

				<Separator orientation="vertical" />

				<Toggle
					pressed={widgetsVisible}
					onPressedChange={handleWidgetsVisibleChange}
					disabled={hasSelection}
					aria-label="Display widgets"
					title="Display Widgets"
				>
					<LayoutGrid className="h-4 w-4" />
				</Toggle>
			</div>
		</div>
	)
}

export default EditorToolbar
