import { DesignImageItemWithUrl } from '@/editor/types/projectTypes'
// import { DesignImageItem, getDesignById } from '@/lib/designs'
import { resolveImageUrl } from '@/lib/imagePathResolver'

export class DesignImagesLoader {
	public async load(designId: string): Promise<DesignImageItemWithUrl[]> {
		// let resolvedImages: DesignImageItemWithUrl[] = []
		// const design = await getDesignById(designId)
		// if (design && design.imageItems) {
		// 	resolvedImages = (design.imageItems as DesignImageItem[])
		// 		.filter((item) => item.active)
		// 		.sort((a, b) => a.order - b.order)
		// 		.map((item) => {
		// 			const imageUrl = resolveImageUrl(item.hash, `designs/${designId}`, 'small')
		// 			return {
		// 				...item,
		// 				resolvedUrl: imageUrl,
		// 			}
		// 		})
		// }

		// return resolvedImages

		throw new Error('Not implemented')
	}
}
