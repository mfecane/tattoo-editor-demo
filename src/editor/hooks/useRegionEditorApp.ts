import { SketchEditorTarget } from '@/editor/main/EditorController'
import { ReactBridge } from '@/editor/main/ReactBridge'
import { RegionEditorApp } from '@/editor/polygon/RegionEditorApp'
import { useEffect, useState } from 'react'

/**
 * Creates a RegionEditorApp for the given target and tears it down on
 * change/unmount - mirrors useEditorLoader's create/cancel/destroy shape
 * for the main 3D Editor instance. Persistence policy (when a snapshot is
 * taken, for how long) lives in RegionEditorApp.bindPersistence - this hook
 * only supplies where a snapshot goes and manages the resulting unsubscribe
 * handle alongside the app's own lifecycle.
 */
export function useRegionEditorApp(
	target: SketchEditorTarget | null,
	reactBridge: ReactBridge | null,
	containerRef: React.RefObject<HTMLDivElement | null>
): RegionEditorApp | null {
	const [app, setApp] = useState<RegionEditorApp | null>(null)

	useEffect(() => {
		if (!target || !reactBridge || !containerRef.current) {
			return
		}

		let cancelled = false
		let unsubscribePersistence: (() => void) | null = null
		const editorApp = new RegionEditorApp()
		const initialRegions = reactBridge.getStoredRegions(target.sketchId)

		editorApp.init(containerRef.current, target.sketchUrl, initialRegions).then(
			() => {
				if (cancelled) {
					editorApp.destroy()
					return
				}

				unsubscribePersistence = editorApp.bindPersistence((regions) => reactBridge.persistRegions(target.sketchId, regions))

				setApp(editorApp)
			},
			(error: unknown) => console.error('[useRegionEditorApp] Failed to init editor:', error)
		)

		return () => {
			cancelled = true
			unsubscribePersistence?.()
			editorApp.destroy()
			setApp(null)
		}
	}, [target, reactBridge])

	return app
}
