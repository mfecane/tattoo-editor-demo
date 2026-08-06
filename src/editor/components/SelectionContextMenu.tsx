import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import ConfirmModal from '@/components/modals/ConfirmModal'
import { FalloffRadiusControl } from '@/editor/components/FalloffRadiusControl'
import { RelaxControl } from '@/editor/components/RelaxControl'
import { useReactBridgeContext } from '@/editor/hooks/useReactBridge'
import { Trash2, Unlink, Waves } from 'lucide-react'
import { useState } from 'react'

export function SelectionContextMenu() {
	const reactBridge = useReactBridgeContext()
	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

	if (!reactBridge) {
		return null
	}

	const { state } = reactBridge

	if (!state.selectedPlacedMeshId || !state.selectionContextMenuVisible) {
		return null
	}

	const isWrapped = state.selectedPlacedMeshWrapped

	const handleConfirmDelete = () => {
		reactBridge.handleDelete()
		setDeleteConfirmOpen(false)
	}

	return (
		<div data-id="selection-context-menu" className="rounded bg-neutral-900 flex gap-2 p-2 items-center">
			<ConfirmModal
				isOpen={state.discardConfirmVisible}
				title={state.selectedPlacedMeshEverWrapped ? 'Cancel placement?' : 'Discard piece?'}
				description="This piece hasn't been applied yet. Continuing removes it from the canvas."
				confirmText={state.selectedPlacedMeshEverWrapped ? 'Cancel placement' : 'Discard'}
				cancelText="Keep editing"
				confirmVariant="danger"
				onCancel={() => reactBridge.cancelDiscard()}
				onConfirm={() => reactBridge.confirmDiscard()}
			/>

			<TooltipProvider>
				{isWrapped && <FalloffRadiusControl />}
				{isWrapped && <RelaxControl />}
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setDeleteConfirmOpen(true)}
							className="ml-auto p-2 hover:bg-accent rounded transition-colors text-destructive"
						>
							<Trash2 className="w-4 h-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>
						<p>Delete</p>
					</TooltipContent>
				</Tooltip>

				<ConfirmModal
					isOpen={deleteConfirmOpen}
					title="Delete piece?"
					description="This removes the selected piece from the canvas."
					confirmText="Delete"
					cancelText="Cancel"
					confirmVariant="danger"
					onCancel={() => setDeleteConfirmOpen(false)}
					onConfirm={handleConfirmDelete}
				/>

				{isWrapped ? (
					<Button variant="ghost" onClick={() => reactBridge.handleUnwrap()}>
						<Unlink className="w-4 h-4" />
						Unwrap
					</Button>
				) : (
					<Button
						variant="ghost"
						onClick={() => reactBridge.handleWrap()}
						disabled={state.selectedPlacedMeshWrapPreviewValid !== true}
					>
						<Waves className="w-4 h-4" />
						{state.selectedPlacedMeshWrapPreviewValid === true
							? 'Apply'
							: state.selectedPlacedMeshWrapPreviewValid === false
								? "Can't wrap here"
								: 'Checking…'}
					</Button>
				)}
			</TooltipProvider>
		</div>
	)
}
