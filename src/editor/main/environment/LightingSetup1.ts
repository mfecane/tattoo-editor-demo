import type { ILightingSetup } from '@/editor/main/environment/ILightingSetup'
import {
	AmbientLight,
	DirectionalLight,
	DirectionalLightHelper,
	Group,
	HemisphereLight,
	PointLight,
	PointLightHelper,
} from 'three'

export class LightingSetup1 implements ILightingSetup {
	public setup(): Group {
		const lightsGroup = new Group()
		lightsGroup.name = 'LightsGroup'

		const ambientLight = new AmbientLight(0xffffff, 0.4)
		ambientLight.name = 'AmbientLight'
		lightsGroup.add(ambientLight)

		const hemisphereLight = new HemisphereLight(0xffffff, 0x444444, 0.6)
		hemisphereLight.name = 'HemisphereLight'
		hemisphereLight.position.set(0, 10, 0)
		lightsGroup.add(hemisphereLight)

		const directionalLight = new DirectionalLight(0xebf7ff, 0.8)
		directionalLight.name = 'DirectionalLight'
		directionalLight.position.set(5, 10, 5)
		directionalLight.castShadow = true
		directionalLight.shadow.mapSize.width = 2048
		directionalLight.shadow.mapSize.height = 2048
		directionalLight.shadow.camera.near = 0.5
		directionalLight.shadow.camera.far = 50
		directionalLight.shadow.camera.left = -10
		directionalLight.shadow.camera.right = 10
		directionalLight.shadow.camera.top = 10
		directionalLight.shadow.camera.bottom = -10
		lightsGroup.add(directionalLight)

		const directionalLightHelper = new DirectionalLightHelper(directionalLight, 1)
		directionalLightHelper.name = 'DirectionalLightHelper'
		lightsGroup.add(directionalLightHelper)

		const fillLight = new DirectionalLight(0xfffcf2, 0.5)
		fillLight.name = 'FillLight'
		fillLight.position.set(-5, 3, -5)
		lightsGroup.add(fillLight)

		const fillLightHelper = new DirectionalLightHelper(fillLight, 1)
		fillLightHelper.name = 'FillLightHelper'
		lightsGroup.add(fillLightHelper)

		const pointLight = new PointLight(0xebf7ff, 0.5, 100)
		pointLight.name = 'PointLight'
		pointLight.position.set(0, 5, 0)
		lightsGroup.add(pointLight)

		const pointLightHelper = new PointLightHelper(pointLight, 1)
		pointLightHelper.name = 'PointLightHelper'
		lightsGroup.add(pointLightHelper)

		return lightsGroup
	}
}
