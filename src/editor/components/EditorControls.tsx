import { InstructionOverlay } from '@/editor/components/InstructionOverlay'
import { SelectionContextMenu } from '@/editor/components/SelectionContextMenu'
import { ViewSettings } from '@/editor/components/ViewSettings'

export function EditorControls() {
	return (
		<>
			<SelectionContextMenu />
			<InstructionOverlay />
			<ViewSettings />
		</>
	)
}
