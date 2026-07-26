import { useReactBridgeContext } from '@/editor/hooks/useReactBridge'
import { useEditorStore } from '@/editor/store/editorStore'

export function DesignImagesPanel() {
	const editorStore = useEditorStore()
	const reactBridge = useReactBridgeContext()

	return (
		<div>
			<h2 className="text-sm font-medium text-neutral-300 mb-3">Design Images</h2>
			<div className="grid grid-cols-2 gap-2">
				{editorStore.designImages
					? editorStore.designImages
							.filter((item) => item.active)
							.sort((a, b) => a.order - b.order)
							.map((item) => {
								const imageUrl = item.resolvedUrl
								return (
									<DesignImage
										key={item.hash}
										imageUrl={imageUrl}
										onClick={() => reactBridge?.openRegionEditor(item.hash, imageUrl)}
									/>
								)
							})
					: null}
			</div>
		</div>
	)
}

interface DesignImageProps {
	imageUrl: string
	onClick: () => void
}

function DesignImage({ imageUrl, onClick }: DesignImageProps) {
	return (
		<div
			onClick={onClick}
			className="aspect-[3/4] rounded-sm overflow-hidden border border-neutral-800 cursor-pointer hover:border-neutral-700"
		>
			<img
				src={imageUrl}
				alt="Design image"
				className="w-full h-full object-cover pointer-events-none"
				draggable={false}
			/>
		</div>
	)
}
