import { Upload, X } from 'lucide-react'

interface RuntimeProjectImage {
	id: string
	imageUrl: string
}

interface ProjectImagesPanelProps {
	projectImages: RuntimeProjectImage[]
	onImageDelete: (imageId: string) => void
	onImageClick: (image: RuntimeProjectImage) => void
	onFilesSelected: (files: FileList | null) => void
	onDragOver: (e: React.DragEvent) => void
	onDragLeave: (e: React.DragEvent) => void
	onDrop: (e: React.DragEvent) => void
	isDragging: boolean
	fileInputRef: React.RefObject<HTMLInputElement>
}

export function ProjectSketchesPanel({
	projectImages,
	onImageDelete,
	onImageClick,
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
			<h2 className="text-sm font-medium text-neutral-300 mb-3">Project sketches</h2>
			<div className="grid grid-cols-2 gap-2">
				<button
					type="button"
					onClick={handleSkeletonClick}
					onDragOver={onDragOver}
					onDragLeave={onDragLeave}
					onDrop={onDrop}
					className={`aspect-[3/4] rounded-sm border overflow-hidden transition-colors ${
						isDragging
							? 'border-neutral-500 bg-neutral-800/80'
							: 'border-neutral-800 border-dashed hover:border-neutral-700'
					}`}
				>
					<div className="flex h-full w-full flex-col items-center justify-center gap-2 p-2">
						<div className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-800 text-neutral-500">
							<Upload className="h-3 w-3" />
						</div>
						<p className="text-[10px] text-neutral-400">{isDragging ? 'Drop' : 'Upload'}</p>
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
					return (
						<ProjectImage
							key={image.id}
							image={image}
							onImageDelete={onImageDelete}
							onImageClick={onImageClick}
						/>
					)
				})}
			</div>
		</div>
	)
}

interface ProjectImageProps {
	image: RuntimeProjectImage
	onImageDelete: (imageId: string) => void
	onImageClick: (image: RuntimeProjectImage) => void
}

function ProjectImage({ image, onImageDelete, onImageClick }: ProjectImageProps) {
	return (
		<div
			onClick={() => onImageClick(image)}
			className="group relative aspect-[3/4] rounded-sm overflow-hidden border border-neutral-800 cursor-pointer hover:border-neutral-700"
		>
			<img src={image.imageUrl} alt="Project image" className="w-full h-full object-cover pointer-events-none" />
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation()
					onImageDelete(image.id)
				}}
				className="absolute right-2 top-2 rounded-md text-neutral-600 bg-surface/70 backdrop-blur-sm border border-neutral-700/50 p-1 opacity-0 transition-opacity group-hover:opacity-100"
			>
				<X className="h-3 w-3 text-foreground" />
			</button>
		</div>
	)
}
