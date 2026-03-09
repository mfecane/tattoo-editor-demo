import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { LatticeRenderer } from '@/editor/services/LatticeRenderer'
import { useEditorStore } from '@/editor/store/editorStore'
import { container } from '@/lib/di/container'
import { Image, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export function TextureOverlay() {
	const [isVisible, setIsVisible] = useState(false)

	return (
		<>
			{/* Toggle Button */}
			{!isVisible && (
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<button
								onClick={() => setIsVisible(true)}
								className="absolute bottom-4 right-4 z-50 p-3 bg-surface border border-border rounded-md shadow-lg hover:bg-accent transition-colors"
								aria-label="Show texture overlay"
							>
								<Image className="w-5 h-5 text-foreground" />
							</button>
						</TooltipTrigger>
						<TooltipContent>
							<p>Show texture overlay</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			)}

			{/* Overlay Panel */}
			{isVisible && <TextureOverlayImage setIsVisible={setIsVisible} />}
		</>
	)
}

interface TextureOverlayImageProps {
	setIsVisible: (isVisible: boolean) => void
}

function TextureOverlayImage({ setIsVisible }: TextureOverlayImageProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return

		const ctx = canvas.getContext('2d')
		if (!ctx) return

		const latticeRenderer = container.resolve<LatticeRenderer>('LatticeRenderer')
		const editor = useEditorStore.getState().editor
		if (!editor) return
		const renderer = editor.renderer

		if (!renderer) return

		const renderTarget = latticeRenderer.renderTarget
		if (renderTarget) {
			const width = renderTarget.width
			const height = renderTarget.height
			canvas.width = width
			canvas.height = height

			const previousRenderTarget = renderer.getRenderTarget()
			renderer.setRenderTarget(renderTarget)
			const pixels = new Uint8Array(width * height * 4)
			renderer.readRenderTargetPixels(renderTarget, 0, 0, width, height, pixels)
			renderer.setRenderTarget(previousRenderTarget)

			const imageData = ctx.createImageData(width, height)
			for (let y = 0; y < height; y++) {
				const srcY = height - 1 - y
				for (let x = 0; x < width; x++) {
					const srcIdx = (srcY * width + x) * 4
					const dstIdx = (y * width + x) * 4
					imageData.data[dstIdx] = pixels[srcIdx]
					imageData.data[dstIdx + 1] = pixels[srcIdx + 1]
					imageData.data[dstIdx + 2] = pixels[srcIdx + 2]
					imageData.data[dstIdx + 3] = pixels[srcIdx + 3]
				}
			}
			ctx.putImageData(imageData, 0, 0)
		}
	}, [])

	return (
		<div className="absolute bottom-4 right-4 z-40 w-80 h-80 bg-surface border border-border rounded-lg shadow-xl overflow-hidden">
			<canvas
				ref={canvasRef}
				className="w-full h-full object-contain pointer-events-none"
				style={{ imageRendering: 'pixelated' }}
			/>
			<button
				onClick={() => setIsVisible(false)}
				className="absolute top-2 right-2 p-1.5 bg-surface/90 border border-border rounded-md shadow-sm hover:bg-accent transition-colors"
				aria-label="Close overlay"
			>
				<X className="w-4 h-4 text-foreground" />
			</button>
		</div>
	)
}
