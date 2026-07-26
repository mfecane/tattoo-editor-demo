import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import { useReactBridgeContext } from '@/editor/hooks/useReactBridge'
import { Wind } from 'lucide-react'

const DEFAULT_STRENGTH = 0.5
const DEFAULT_ITERATIONS = 3
const DEFAULT_BOUNDARY_WEIGHT = 0

/** Toolbar popover that relaxes the selected wrapped mesh's vertices back toward its original flat edge lengths - see PlacedMeshRelaxer. */
export function RelaxControl() {
	const reactBridge = useReactBridgeContext()
	const [strength, setStrength] = useState(DEFAULT_STRENGTH)
	const [iterations, setIterations] = useState(DEFAULT_ITERATIONS)
	const [boundaryWeight, setBoundaryWeight] = useState(DEFAULT_BOUNDARY_WEIGHT)

	if (!reactBridge) {
		return null
	}

	return (
		<Popover>
			<PopoverTrigger asChild>
				<button className="p-2 rounded transition-colors hover:bg-accent" title="Relax wrapped mesh">
					<Wind className="w-4 h-4" />
				</button>
			</PopoverTrigger>
			<PopoverContent className="w-72 p-4 space-y-4" align="start">
				<div>
					<Label htmlFor="relax-strength" className="text-sm">
						Strength
					</Label>
					<div className="mt-4">
						<Slider
							id="relax-strength"
							min={0}
							max={1}
							step={0.05}
							value={[strength]}
							onValueChange={(values) => setStrength(values[0])}
						/>
					</div>
				</div>
				<div>
					<Label htmlFor="relax-iterations" className="text-sm">
						Iterations
					</Label>
					<div className="mt-4">
						<Slider
							id="relax-iterations"
							min={1}
							max={10}
							step={1}
							value={[iterations]}
							onValueChange={(values) => setIterations(values[0])}
						/>
					</div>
				</div>
				<div>
					<Label htmlFor="relax-boundary-weight" className="text-sm">
						Boundary Weight
					</Label>
					<div className="mt-4">
						<Slider
							id="relax-boundary-weight"
							min={0}
							max={1}
							step={0.05}
							value={[boundaryWeight]}
							onValueChange={(values) => setBoundaryWeight(values[0])}
						/>
					</div>
				</div>
				<Button type="button" onClick={() => reactBridge.handleRelax(strength, iterations, boundaryWeight)} className="w-full">
					Relax
				</Button>
			</PopoverContent>
		</Popover>
	)
}
