import { Button } from '@/components/ui/button'
import { MESH_WRAP_CONSTANTS } from '@/editor/constants'
import { useReactBridgeContext } from '@/editor/hooks/useReactBridge'
import { Wind } from 'lucide-react'

/** Toolbar button that relaxes the selected wrapped mesh's vertices back toward its original flat edge lengths - see PlacedMeshRelaxer. */
export function RelaxControl() {
	const reactBridge = useReactBridgeContext()

	if (!reactBridge) {
		return null
	}

	const handleRelax = () => {
		reactBridge.handleRelax(
			MESH_WRAP_CONSTANTS.MANUAL_RELAX_STRENGTH,
			MESH_WRAP_CONSTANTS.MANUAL_RELAX_ITERATIONS,
			MESH_WRAP_CONSTANTS.MANUAL_RELAX_BOUNDARY_WEIGHT
		)
	}

	return (
		<Button variant="ghost" size="icon" onClick={handleRelax} title="Relax wrapped mesh">
			<Wind className="w-4 h-4" />
		</Button>
	)
}
