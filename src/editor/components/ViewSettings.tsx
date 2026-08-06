import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useClickOutside } from '@/editor/hooks/useClickOutside'
import { useReactBridgeContext } from '@/editor/hooks/useReactBridge'
import { Lightbulb, Settings } from 'lucide-react'
import { useRef, useState } from 'react'

export function ViewSettings() {
	const reactBridge = useReactBridgeContext()

	const [open, setOpen] = useState(false)
	const triggerRef = useRef<HTMLButtonElement>(null)
	const contentRef = useRef<HTMLDivElement>(null)

	useClickOutside([triggerRef, contentRef], () => setOpen(false), open)

	if (!reactBridge) {
		return null
	}

	const { lightRotation } = reactBridge.state

	const handleLightRotationChange = (values: number[]) => {
		const rotation = values[0]
		reactBridge.setLightRotation(rotation)
	}

	return (
		<TooltipProvider>
			<Tooltip>
				<Popover open={open} onOpenChange={setOpen}>
					<TooltipTrigger asChild>
						<PopoverTrigger asChild>
							<Button ref={triggerRef} variant="ghost" size="icon" aria-label="View settings">
								<Settings className="h-4 w-4" />
							</Button>
						</PopoverTrigger>
					</TooltipTrigger>
					<TooltipContent>
						<p>Modify view settings</p>
					</TooltipContent>
					<PopoverContent
						ref={contentRef}
						data-id="view-settings-panel"
						className="w-80 p-0"
						align="end"
						side="bottom"
						sideOffset={12}
					>
						<div className="space-y-6">
							<div className="space-y-2 bg-neutral-950 rounded-t-md p-2 px-4 mb-2">
								<h4 className="font-bold text-sm">View Settings</h4>
							</div>

							<div className="space-y-4 p-2 px-4 pb-6">
								<Label htmlFor="light-rotation" className="text-sm flex items-center gap-2">
									<Lightbulb className="w-4 h-4" />
									Light Position
								</Label>
								<div className="mt-4">
									<Slider
										id="light-rotation"
										min={-Math.PI}
										max={Math.PI}
										step={0.01}
										value={[lightRotation]}
										onValueChange={handleLightRotationChange}
									/>
								</div>
							</div>
						</div>
					</PopoverContent>
				</Popover>
			</Tooltip>
		</TooltipProvider>
	)
}
