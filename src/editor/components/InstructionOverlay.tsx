import { useReactBridgeContext } from '@/editor/hooks/useReactBridge'

export function InstructionOverlay() {
	const reactBridge = useReactBridgeContext()

	if (!reactBridge || !reactBridge.state.widgetsVisible) {
		return null
	}

	const text = reactBridge.getHintText()
	if (!text) {
		return null
	}

	return (
		<div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
			<div className="bg-surface/95 backdrop-blur-sm border border-border rounded-lg px-6 py-4 shadow-lg">
				<p className="text-sm font-medium text-foreground text-center">{text}</p>
			</div>
		</div>
	)
}
