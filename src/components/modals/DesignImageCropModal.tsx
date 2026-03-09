import { Button } from '@/components/ui/button'
import React, { useRef, useState, useEffect } from 'react'

interface DesignImageCropModalProps {
	isOpen: boolean
	imageSrc: string
	onSave: (croppedBlob: Blob) => void | Promise<void>
	onClose: () => void
}

export default function DesignImageCropModal({
	isOpen,
	imageSrc,
	onSave,
	onClose,
}: DesignImageCropModalProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const imgRef = useRef<HTMLImageElement | null>(null)
	const [isProcessing, setIsProcessing] = useState(false)

	useEffect(() => {
		if (!isOpen || !imageSrc) return

		const img = new Image()
		img.crossOrigin = 'anonymous'
		img.onload = () => {
			imgRef.current = img
			drawImageToCanvas(img)
		}
		img.src = imageSrc
	}, [isOpen, imageSrc])

	const drawImageToCanvas = (img: HTMLImageElement) => {
		const canvas = canvasRef.current
		if (!canvas) return

		const ctx = canvas.getContext('2d')
		if (!ctx) return

		// Set canvas size to image size
		canvas.width = img.width
		canvas.height = img.height

		// Draw image
		ctx.drawImage(img, 0, 0)
	}

	const handleSave = async () => {
		const canvas = canvasRef.current
		if (!canvas) return

		setIsProcessing(true)
		try {
			canvas.toBlob(
				(blob) => {
					if (blob) {
						onSave(blob)
					}
					setIsProcessing(false)
				},
				'image/jpeg',
				0.95
			)
		} catch (error) {
			console.error('[DesignImageCropModal] Failed to create blob:', error)
			setIsProcessing(false)
		}
	}

	if (!isOpen) return null

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			{/* Backdrop */}
			<div className="fixed inset-0 bg-black/50" onClick={onClose} />

			{/* Modal */}
			<div className="relative z-50 w-full max-w-2xl rounded-lg border border-gray-800 bg-gray-900 p-6 shadow-lg">
				<h2 className="mb-4 text-lg font-semibold text-gray-100">Crop Image</h2>

				<div className="mb-6 flex items-center justify-center overflow-hidden rounded border border-gray-800 bg-gray-950">
					<canvas ref={canvasRef} className="max-h-[60vh] max-w-full object-contain" />
				</div>

				<div className="flex justify-end gap-3">
					<Button variant="outline" onClick={onClose} disabled={isProcessing}>
						Cancel
					</Button>
					<Button onClick={handleSave} disabled={isProcessing}>
						{isProcessing ? 'Processing...' : 'Save'}
					</Button>
				</div>
			</div>
		</div>
	)
}
