import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import { useReactBridgeContext } from '@/editor/hooks/useReactBridge'
import { SlidersHorizontal } from 'lucide-react'

/** Toolbar popover for the slide-vertex falloff radius - see SlideVertexInteractionHandler.computeFalloffWeights. */
export function FalloffRadiusControl() {
	const reactBridge = useReactBridgeContext()

	if (!reactBridge) {
		return null
	}

	const { slideVertexFalloffRadius } = reactBridge.state

	const handleFalloffRadiusChange = (values: number[]) => {
		reactBridge.setSlideVertexFalloffRadius(values[0])
	}

	return (
		<Popover>
			<PopoverTrigger asChild>
				<button className="p-2 rounded transition-colors hover:bg-accent" title="Vertex slide falloff radius">
					<SlidersHorizontal className="w-4 h-4" />
				</button>
			</PopoverTrigger>
			<PopoverContent className="w-72 p-4" align="start">
				<Label htmlFor="falloff-radius" className="text-sm">
					Vertex Slide Falloff Radius
				</Label>
				<div className="mt-4">
					<Slider
						id="falloff-radius"
						min={0.01}
						max={0.4}
						step={0.005}
						value={[slideVertexFalloffRadius]}
						onValueChange={handleFalloffRadiusChange}
					/>
				</div>
			</PopoverContent>
		</Popover>
	)
}
