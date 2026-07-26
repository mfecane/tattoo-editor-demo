import { RegionEditorController } from '@/editor/polygon/RegionEditorController'
import { useEffect, useState } from 'react'

/**
 * Subscribes a component to a RegionEditorController, mirroring
 * useReactBridge's tick-based re-render pattern for the 3D editor.
 */
export function useRegionEditorController(
	controller: RegionEditorController | null
): RegionEditorController | null {
	const [, setTick] = useState(0)

	useEffect(() => {
		if (!controller) return
		return controller.subscribe(() => setTick((tick) => tick + 1))
	}, [controller])

	return controller
}
