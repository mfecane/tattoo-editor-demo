import { DefinedShapeThumbnail } from '@/editor/components/DefinedShapeThumbnail'
import { RegionEditorApp } from '@/editor/polygon/RegionEditorApp'
import { RegionEditorController } from '@/editor/polygon/RegionEditorController'

interface DefinedShapesStackProps {
	app: RegionEditorApp | null
	controller: RegionEditorController | null
}

export function DefinedShapesStack({ app, controller }: DefinedShapesStackProps) {
	const shapes = app?.getNormalizedShapes() ?? []
	const isDrawing = controller?.isDrawing() ?? false

	if (shapes.length === 0) {
		return null
	}

	return (
		<div
			id="defined-shapes-panel"
			className="absolute right-4 top-4 flex max-h-96 w-24 flex-col items-center gap-2 overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-800/80 p-2 shadow-xl"
		>
			{shapes.map((shape) => (
				<button
					key={shape.id}
					type="button"
					disabled={isDrawing}
					onClick={() => controller?.selectPolygon(shape.id)}
					className={`flex h-20 w-20 shrink-0 items-center justify-center rounded bg-neutral-900/60 p-1 transition-shadow disabled:cursor-not-allowed disabled:opacity-40 ${
						shape.selected ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-gray-800' : 'enabled:hover:ring-1 enabled:hover:ring-neutral-500'
					}`}
				>
					<DefinedShapeThumbnail shape={shape} />
				</button>
			))}
		</div>
	)
}
