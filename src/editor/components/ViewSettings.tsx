import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { useReactBridgeContext } from '@/editor/hooks/useReactBridge'
import { Settings } from 'lucide-react'

export function ViewSettings() {
	const reactBridge = useReactBridgeContext()

	if (!reactBridge) {
		return null
	}

	const { widgetsVisible, lightRotation } = reactBridge.state

	const handleLightRotationChange = (values: number[]) => {
		const rotation = values[0]
		reactBridge.setLightRotation(rotation)
	}

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					size="icon"
					className="absolute top-4 right-4 z-50 bg-surface border border-border shadow-lg hover:bg-accent"
					aria-label="View settings"
				>
					<Settings className="h-4 w-4" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-80 p-0" align="start" side="left">
				<div className="space-y-6">
					<div className="space-y-2 bg-gray-950 rounded-t-md p-2 px-4 mb-2">
						<h4 className="font-bold text-sm">View Settings</h4>
					</div>

					<div className="space-y-4 p-2 px-4 pb-6">
						<div className="flex items-center justify-between">
							<Label htmlFor="widgets-toggle" className="text-sm">
								Display Widgets
							</Label>
							<Switch
								id="widgets-toggle"
								checked={widgetsVisible}
								onCheckedChange={(checked) => reactBridge.setWidgetsVisible(checked)}
							/>
						</div>

						<Label htmlFor="light-rotation" className="text-sm">
							Light Rotation
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
	)
}
