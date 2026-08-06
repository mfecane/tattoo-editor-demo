'use client'
import ConfirmModal from '@/components/modals/ConfirmModal'
import { Button } from '@/components/ui/button'
import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProjectSketchesPanel } from '@/editor/components/ProjectSketchesPanel'
import { BASE_URL } from '@/editor/constants'
import { useReactBridgeContext } from '@/editor/hooks/useReactBridge'
import { Camera, Check, Image, Settings2 } from 'lucide-react'
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
	const reactBridge = useReactBridgeContext()
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
	const onProjectImageClick = (image: Pick<RuntimeProjectImage, 'id' | 'imageUrl'>) =>
		reactBridge?.openRegionEditor(image.id, image.imageUrl)

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
		<section
			data-id="editor-panel"
			className="w-80 flex-shrink-0 overflow-y-auto border-l border-neutral-800 bg-neutral-900 p-2"
		>
			<Tabs defaultValue="media" className="h-full">
				<TabsList className="w-full">
					<TabsTrigger value="media" className="flex-1 flex gap-2">
						<Image className="w-4 h-4" />
						Media
					</TabsTrigger>
					<TabsTrigger value="renders" className="flex-1 flex gap-2">
						<Camera className="w-4 h-4" />
						Renders
					</TabsTrigger>
					<TabsTrigger value="settings" className="flex-1 flex gap-2">
						<Settings2 className="w-4 h-4" />
						Settings
					</TabsTrigger>
				</TabsList>

				<TabsContent value="media">
					<div className="space-y-6 p-2 rounded-md bg-neutral-950">
						<ProjectSketchesPanel
							projectImages={projectImages}
							onImageDelete={onProjectImageDelete}
							onImageClick={onProjectImageClick}
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
				</TabsContent>

				<TabsContent value="renders">
					<div className="space-y-6 p-2 rounded-md bg-neutral-950">
						<p className="text-xs text-neutral-500">No renders yet.</p>
					</div>
				</TabsContent>

				<TabsContent value="settings">
					<div className="space-y-2 p-2 py-4 rounded-md bg-neutral-950">
						<Button variant="secondary" className="block w-full" disabled>
							Store camera position
						</Button>
						<Marker className="flex">
							<MarkerIcon>
								<Check className="w-4 h-4" />
							</MarkerIcon>
							<MarkerContent>Stored</MarkerContent>
						</Marker>
						<Button variant="secondary" className="block w-full" disabled>
							Move camera to stored position
						</Button>
						<p>Stored camera position will be used as start position in view mode.</p>
					</div>
				</TabsContent>
			</Tabs>
		</section>
	)
}
