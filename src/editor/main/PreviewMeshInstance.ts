import { PreviewMeshTextureSet } from '@/editor/main/PreviewMeshTextureSet'

export class PreviewMeshInstance {
	public constructor(
		public readonly id: string,
		public readonly metadata: Record<string, unknown>,
		public readonly meshFile: string,
		public readonly textures: PreviewMeshTextureSet
	) {}
}
