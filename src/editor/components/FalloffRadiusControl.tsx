import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import { Toggle } from '@/components/ui/toggle'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useReactBridgeContext } from '@/editor/hooks/useReactBridge'
import { Radius } from 'lucide-react'

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
			<TooltipProvider>
				<Tooltip>
					<PopoverTrigger asChild>
						<TooltipTrigger asChild>
							<Toggle variant="ghost" size="icon">
								<Radius className="w-4 h-4" />
							</Toggle>
						</TooltipTrigger>
					</PopoverTrigger>
					<TooltipContent>
						<p>Modify move vertex influence</p>
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
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
