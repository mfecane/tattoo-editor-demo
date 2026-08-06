import { PreviewMeshInstance } from '@/editor/main/PreviewMeshInstance'
import { PreviewMeshRegistrar } from '@/editor/main/PreviewMeshRegistrar'
import { PreviewMeshTextureSet } from '@/editor/main/PreviewMeshTextureSet'
import { TextureMapType } from '@/editor/main/TextureMapType'
import { UdimTextureSet } from '@/editor/main/UdimTextureSet'

export const ARM_PREVIEW_MESH_ID: string = 'arm'

export function registerPreviewMeshInstances(registrar: PreviewMeshRegistrar): void {
	const instance = new PreviewMeshInstance(
		ARM_PREVIEW_MESH_ID,
		{ name: 'ArmAsset' },
		'assets/asset/arm_render.glb',
		new PreviewMeshTextureSet([
			new UdimTextureSet(
				1001,
				new Map([
					[TextureMapType.Color, 'assets/asset/color_1001.jpg'],
					[TextureMapType.Orm, 'assets/asset/orm_1001.jpg'],
					[TextureMapType.Normal, 'assets/asset/normal_1001.jpg'],
					[TextureMapType.Alpha, 'assets/asset/alpha_1001.jpg'],
				])
			),
			new UdimTextureSet(
				1002,
				new Map([
					[TextureMapType.Color, 'assets/asset/color_1002.jpg'],
					[TextureMapType.Orm, 'assets/asset/orm_1002.jpg'],
					[TextureMapType.Normal, 'assets/asset/normal_1002.jpg'],
					[TextureMapType.Alpha, 'assets/asset/alpha_1002.jpg'],
				])
			),
		])
	)

	registrar.register(instance)
}
