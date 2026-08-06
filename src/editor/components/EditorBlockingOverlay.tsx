import { Loader } from '@/components/ui/loader'
import { useReactBridgeContext } from '@/editor/hooks/useReactBridge'

/** Whole-screen spinner scoped to the editor container, shown for as long as ReactBridge.state.blocking is set - any long-running background operation (e.g. PatchBaker) can drive it. */
export function EditorBlockingOverlay() {
	const reactBridge = useReactBridgeContext()

	if (!reactBridge?.state.blocking) {
		return null
	}

	return (
		<div className="absolute inset-0 z-[100] flex items-center justify-center bg-surface/80 backdrop-blur-md">
			<Loader size="lg" />
		</div>
	)
}
