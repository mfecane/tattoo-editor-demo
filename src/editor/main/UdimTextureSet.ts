import { TextureMapType } from '@/editor/main/TextureMapType'

export class UdimTextureSet {
	public constructor(
		public readonly udim: number,
		private readonly urlsByMapType: Map<TextureMapType, string>
	) {}

	public resolve(mapType: TextureMapType): string {
		const url = this.urlsByMapType.get(mapType)
		if (!url) {
			throw new Error(`No "${mapType}" texture registered for UDIM ${this.udim}`)
		}
		return url
	}
}
