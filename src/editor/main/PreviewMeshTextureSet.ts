import { TextureMapType } from '@/editor/main/TextureMapType'
import { UdimTextureSet } from '@/editor/main/UdimTextureSet'

export class PreviewMeshTextureSet {
	private readonly udimSetsByUdim: Map<number, UdimTextureSet>

	public constructor(udimSets: UdimTextureSet[]) {
		this.udimSetsByUdim = new Map(udimSets.map((udimSet) => [udimSet.udim, udimSet]))
	}

	public getUdims(): number[] {
		return Array.from(this.udimSetsByUdim.keys()).sort((a, b) => a - b)
	}

	public getUdimCount(): number {
		return this.udimSetsByUdim.size
	}

	public resolve(udim: number, mapType: TextureMapType): string {
		const udimSet = this.udimSetsByUdim.get(udim)
		if (!udimSet) {
			throw new Error(`UDIM ${udim} is not registered on this preview mesh`)
		}
		return udimSet.resolve(mapType)
	}
}
