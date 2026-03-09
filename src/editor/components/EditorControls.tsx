import { InstructionOverlay } from '@/editor/components/InstructionOverlay'
import { ImagesPanel } from '@/editor/components/ImagesPanel'
import { ProjectionTypeSelectionMenu } from '@/editor/components/ProjectionTypeSelectionMenu'
import { StampContextMenu } from '@/editor/components/StampContextMenu'
import { TextureOverlay } from '@/editor/components/TextureOverlay'
import { ViewSettings } from '@/editor/components/ViewSettings'

export function EditorControls() {
	return (
		<>
			<StampContextMenu />
			<ProjectionTypeSelectionMenu />
			<InstructionOverlay />
			<ImagesPanel />
			<TextureOverlay />
			<ViewSettings />
		</>
	)
}
