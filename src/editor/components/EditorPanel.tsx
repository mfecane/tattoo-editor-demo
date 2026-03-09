'use client'
import ConfirmModal from '@/components/modals/ConfirmModal'
import { BASE_URL } from '@/editor/lib/constants'
import { ProjectImagesPanel } from '@/editor/components/ProjectImagesPanel'
import { useEffect, useRef, useState } from 'react'

interface RuntimeProjectImage {
	id: string
	imageUrl: string
	revokeOnRemove: boolean
}

const DEFAULT_PROJECT_IMAGES: RuntimeProjectImage[] = [
	{
		id: 'cat.webp',
		imageUrl: `${BASE_URL}/assets/images/tattoo/cat.webp`,
		revokeOnRemove: false,
	},
	{
		id: 'moon.webp',
		imageUrl: `${BASE_URL}/assets/images/tattoo/moon.webp`,
		revokeOnRemove: false,
	},
	{
		id: 'spider.webp',
		imageUrl: `${BASE_URL}/assets/images/tattoo/spider.webp`,
		revokeOnRemove: false,
	},
]

export function EditorPanel() {
	const [projectImages, setProjectImages] = useState<RuntimeProjectImage[]>(DEFAULT_PROJECT_IMAGES)
	const [isDragging, setIsDragging] = useState(false)
	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
	const [imageToDelete, setImageToDelete] = useState<RuntimeProjectImage | null>(null)
	const [uploadError, setUploadError] = useState<string | null>(null)
	const fileInputRef = useRef<HTMLInputElement>(null)
	const uploadedUrlsRef = useRef<Set<string>>(new Set())

	useEffect(() => {
		return () => {
			for (const imageUrl of uploadedUrlsRef.current) {
				URL.revokeObjectURL(imageUrl)
			}
		}
	}, [])

	const handleDeleteImage = (imageId: string) => {
		const image = projectImages.find((currentImage) => currentImage.id === imageId)
		if (!image) {
			throw new Error(`Cannot delete image: "${imageId}" not found`)
		}
		if (image.revokeOnRemove) {
			URL.revokeObjectURL(image.imageUrl)
			uploadedUrlsRef.current.delete(image.imageUrl)
		}
		setProjectImages((currentImages) => currentImages.filter((currentImage) => currentImage.id !== image.id))
	}

	const handleDeleteClick = (imageId: string) => {
		const image = projectImages.find((currentImage) => currentImage.id === imageId)
		if (!image) {
			throw new Error(`Cannot open delete confirmation: "${imageId}" not found`)
		}
		setImageToDelete(image)
		setDeleteConfirmOpen(true)
	}

	const handleConfirmDelete = () => {
		if (imageToDelete) {
			handleDeleteImage(imageToDelete.id)
			setImageToDelete(null)
		}
		setDeleteConfirmOpen(false)
	}

	const handleDeleteCancel = () => {
		setDeleteConfirmOpen(false)
		setImageToDelete(null)
	}

	const onProjectImageDelete = handleDeleteClick
	const onFilesSelected = async (files: FileList | null) => {
		if (!files || files.length === 0) {
			return
		}
		setUploadError(null)
		const uploadedImages = Array.from(files).map((file) => ({
			id: `${file.name}-${crypto.randomUUID()}`,
			imageUrl: URL.createObjectURL(file),
			revokeOnRemove: true,
		}))
		for (const image of uploadedImages) {
			uploadedUrlsRef.current.add(image.imageUrl)
		}
		setProjectImages((currentImages) => [...currentImages, ...uploadedImages])
	}

	const onDragOver = (e: React.DragEvent) => {
		e.preventDefault()
		setIsDragging(true)
	}

	const onDragLeave = (e: React.DragEvent) => {
		e.preventDefault()
		setIsDragging(false)
	}

	const onDrop = (e: React.DragEvent) => {
		e.preventDefault()
		setIsDragging(false)
		onFilesSelected(e.dataTransfer.files).catch((error: unknown) => {
			const message = error instanceof Error ? error.message : String(error)
			setUploadError(message)
		})
	}

	return (
		<section className="w-80 flex-shrink-0 overflow-y-auto border-l border-gray-800 bg-gray-900 p-4">
			<div className="space-y-6">
				<ProjectImagesPanel
					projectImages={projectImages}
					onImageDelete={onProjectImageDelete}
					onFilesSelected={(files) => {
						onFilesSelected(files).catch((error: unknown) => {
							const message = error instanceof Error ? error.message : String(error)
							setUploadError(message)
						})
					}}
					onDragOver={onDragOver}
					onDragLeave={onDragLeave}
					onDrop={onDrop}
					isDragging={isDragging}
					fileInputRef={fileInputRef}
				/>
				{uploadError ? <p className="text-xs text-red-400">{uploadError}</p> : null}

				<ConfirmModal
					isOpen={deleteConfirmOpen}
					title="Delete image?"
					description="This removes the image from this runtime session."
					confirmText="Delete"
					cancelText="Cancel"
					confirmVariant="danger"
					onCancel={handleDeleteCancel}
					onConfirm={handleConfirmDelete}
				/>
			</div>
		</section>
	)
}
