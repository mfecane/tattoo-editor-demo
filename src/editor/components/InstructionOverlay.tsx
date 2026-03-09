import { useReactBridgeContext } from '@/editor/hooks/useReactBridge'
import { useEditorStore } from '@/editor/store/editorStore'

export function InstructionOverlay() {
	const reactBridge = useReactBridgeContext()
	const editor = useEditorStore((state) => state.editor)
	const state = editor?.controller.getState()
	const selectedStampId = state?.selectedStampId ?? null
	const stamps = editor?.controller.project.stampList.getStamps()
	const selectedStamp =
		selectedStampId !== null
			? (editor?.controller.project.stampList.getStampById(selectedStampId) ?? null)
			: null
	const stampInfo = selectedStamp?.data ?? null
	const isBrushMode = reactBridge?.state.isBrushMode ?? false
	const widgetsVisible = reactBridge?.state.widgetsVisible ?? true

	if (stamps?.length === 0) {
		return (
			<div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
				<div className="bg-surface/95 backdrop-blur-sm border border-border rounded-lg px-6 py-4 shadow-lg">
					<p className="text-sm font-medium text-foreground text-center">
						Drag image to mesh or click on the mesh
					</p>
				</div>
			</div>
		)
	}

	if ((selectedStampId === null || !stampInfo) && widgetsVisible) {
		return (
			<div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
				<div className="bg-surface/95 backdrop-blur-sm border border-border rounded-lg px-6 py-4 shadow-lg">
					<p className="text-sm font-medium text-foreground text-center">Click blue circle to select image</p>
				</div>
			</div>
		)
	}

	if (!isBrushMode) {
		return null
	}

	return (
		<div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
			<div className="bg-surface/95 backdrop-blur-sm border border-border rounded-lg px-6 py-4 shadow-lg">
				<p className="text-sm font-medium text-foreground text-center">
					Click and drag on the surface to shape image
				</p>
			</div>
		</div>
	)
}
