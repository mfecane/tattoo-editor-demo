import { getRegionOutlinePoints } from '@/editor/lib/utils/RegionOutline'
import { PolygonSnapshot } from '@/editor/polygon/RegionEditorController'

interface DefinedShapeThumbnailProps {
	/** Shape with points normalized to whole-image 0..1 space (see RegionEditorApp.getNormalizedShapes), so the thumbnail can place it within the full image rather than filling its own bounds. */
	shape: PolygonSnapshot
}

const STROKE_WIDTH = 0.02

/** Fixed 0..1 viewBox representing the whole image - every thumbnail shares it so a shape's size and position stay comparable across the list. */
export function DefinedShapeThumbnail({ shape }: DefinedShapeThumbnailProps) {
	const outline = getRegionOutlinePoints(shape.kind, shape.points)
	if (outline.length === 0) {
		return null
	}

	const polygonPoints: string = outline.map((point) => `${point.x},${point.y}`).join(' ')

	return (
		<svg viewBox="0 0 1 1" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
			<rect x={0} y={0} width={1} height={1} className="fill-none stroke-gray-500" strokeWidth={STROKE_WIDTH / 2} />
			<polygon points={polygonPoints} className="fill-sky-400/25 stroke-sky-300" strokeWidth={STROKE_WIDTH} />
		</svg>
	)
}
