import { Button } from '@/components/ui/button'
import { useReactBridgeContext } from '@/editor/hooks/useReactBridge'
import { useEditorStore } from '@/editor/store/editorStore'
import { Redo2, Undo2 } from 'lucide-react'
// import { useRouter } from 'next/navigation'

const defaultHistoryState: { canUndo: boolean; canRedo: boolean } = { canUndo: false, canRedo: false }

export function EditorHeader() {
	// const router = useRouter()
	const reactBridge = useReactBridgeContext()

	const editor = useEditorStore((state) => state.editor)

	const controller = editor?.controller
	const historyState = reactBridge?.getHistoryState() ?? defaultHistoryState

	const handleUndo = () => {
		controller?.historyController.undo()
	}

	const handleRedo = () => {
		controller?.historyController.redo()
	}

	/**
	 * modified from original - save button and back button removed
	 */
	return (
		<header className="flex items-center justify-between border-b border-gray-800 bg-gray-900/50 px-4 py-3">
			<div className="flex items-center gap-2">
				<Button
					type="button"
					onClick={handleUndo}
					disabled={!historyState.canUndo}
					variant="ghost"
					className="text-gray-300 hover:text-foreground hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
					title="Undo"
				>
					<Undo2 className="h-4 w-4" />
				</Button>
				<Button
					type="button"
					onClick={handleRedo}
					disabled={!historyState.canRedo}
					variant="ghost"
					className="text-gray-300 hover:text-foreground hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
					title="Redo"
				>
					<Redo2 className="h-4 w-4" />
				</Button>
			</div>
		</header>
	)
}
