import { EditorDragType } from '@/editor/lib/constants'
import { useDraggable } from '@dnd-kit/core'
import { Upload, X } from 'lucide-react'

interface RuntimeProjectImage {
	id: string
	imageUrl: string
}

interface ProjectImagesPanelProps {
	projectImages: RuntimeProjectImage[]
	onImageDelete: (imageId: string) => void
	onFilesSelected: (files: FileList | null) => void
	onDragOver: (e: React.DragEvent) => void
	onDragLeave: (e: React.DragEvent) => void
	onDrop: (e: React.DragEvent) => void
	isDragging: boolean
	fileInputRef: React.RefObject<HTMLInputElement>
}

export function ProjectImagesPanel({
	projectImages,
	onImageDelete,
	onFilesSelected,
	onDragOver,
	onDragLeave,
	onDrop,
	isDragging,
	fileInputRef,
}: ProjectImagesPanelProps) {
	const handleSkeletonClick = () => {
		if (!fileInputRef.current) {
			throw new Error('File input ref is not available')
		}
		fileInputRef.current.click()
	}

	return (
		<div>
			<h2 className="text-sm font-medium text-gray-300 mb-3">Project Images</h2>
			<div className="grid grid-cols-2 gap-2">
				<button
					type="button"
					onClick={handleSkeletonClick}
					onDragOver={onDragOver}
					onDragLeave={onDragLeave}
					onDrop={onDrop}
					className={`aspect-[3/4] rounded-sm border overflow-hidden transition-colors ${
						isDragging
							? 'border-gray-500 bg-gray-800/80'
							: 'border-gray-800 border-dashed hover:border-gray-700'
					}`}
				>
					<div className="flex h-full w-full flex-col items-center justify-center gap-2 p-2">
						<div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-800 text-gray-500">
							<Upload className="h-3 w-3" />
						</div>
						<p className="text-[10px] text-gray-400">{isDragging ? 'Drop' : 'Upload'}</p>
					</div>
					<input
						ref={fileInputRef}
						type="file"
						accept="image/*"
						multiple
						onChange={(e) => {
							onFilesSelected(e.target.files)
							e.currentTarget.value = ''
						}}
						className="hidden"
					/>
				</button>
				{projectImages.map((image) => {
					return <ProjectImage key={image.id} image={image} onImageDelete={onImageDelete} />
				})}
			</div>
		</div>
	)
}

interface ProjectImageProps {
	image: RuntimeProjectImage
	onImageDelete: (imageId: string) => void
}

function ProjectImage({ image, onImageDelete }: ProjectImageProps) {
	const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
		id: `project-image-${image.id}`,
		data: {
			type: EditorDragType.PROJECT_IMAGE,
			imageUrl: image.imageUrl,
			hash: image.imageUrl,
			source: 'project',
		},
	})

	return (
		<div
			ref={setNodeRef}
			{...attributes}
			{...listeners}
			className={`group relative aspect-[3/4] rounded-sm overflow-hidden border border-gray-800 cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-50' : ''}`}
		>
			<img src={image.imageUrl} alt="Project image" className="w-full h-full object-cover pointer-events-none" />
			<button
				type="button"
				onClick={() => onImageDelete(image.id)}
				className="absolute right-2 top-2 rounded-md text-gray-600 bg-surface/70 backdrop-blur-sm border border-gray-700/50 p-1 opacity-0 transition-opacity group-hover:opacity-100"
			>
				<X className="h-3 w-3 text-foreground" />
			</button>
		</div>
	)
}
