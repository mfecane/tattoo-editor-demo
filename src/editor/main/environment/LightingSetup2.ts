import type { ILightingSetup } from '@/editor/main/environment/ILightingSetup'
import { AmbientLight, DirectionalLight, DirectionalLightHelper, Group, RectAreaLight } from 'three'
import { RectAreaLightHelper } from 'three/examples/jsm/helpers/RectAreaLightHelper.js'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'

export class LightingSetup2 implements ILightingSetup {
	private showHelpers: boolean = false

	public setup(): Group {
		RectAreaLightUniformsLib.init()

		const lightsGroup = new Group()
		lightsGroup.name = 'LightsGroup'

		const ambient = new AmbientLight(0xffffff, 0.05)
		ambient.name = 'AmbientLight'
		lightsGroup.add(ambient)

		const key = new DirectionalLight(0xfff1e0, 6)
		key.name = 'KeyLight'
		key.position.set(0.932, 1.2, 2.386)
		key.lookAt(0, 0.2, 0)
		key.castShadow = true
		key.shadow.mapSize.width = 2048
		key.shadow.mapSize.height = 2048
		key.shadow.camera.near = 0.5
		key.shadow.camera.far = 50
		key.shadow.camera.left = -10
		key.shadow.camera.right = 10
		key.shadow.camera.top = 10
		key.shadow.camera.bottom = -10
		key.shadow.bias = 0.0001
		lightsGroup.add(key)

		const keyHelper = new DirectionalLightHelper(key, 1)
		keyHelper.name = 'KeyLightHelper'
		keyHelper.visible = this.showHelpers
		lightsGroup.add(keyHelper)

		// TODO rotate lights a bit to the right

		const fill = new RectAreaLight(0xffffff, 6, 1.8, 1.2)
		fill.name = 'FillLight'
		fill.position.set(2.105, 0.0, 1.514)
		fill.lookAt(0, 0.1, 0)
		lightsGroup.add(fill)

		const fillHelper = new RectAreaLightHelper(fill)
		fillHelper.name = 'FillLightHelper'
		fillHelper.visible = this.showHelpers
		lightsGroup.add(fillHelper)

		const rim = new RectAreaLight(0xe6f0ff, 16, 2.5, 0.35)
		rim.name = 'RimLight'
		rim.position.set(-0.512, 0.9, -1.912)
		rim.lookAt(0, 0.2, 0)
		lightsGroup.add(rim)

		const rimHelper = new RectAreaLightHelper(rim)
		rimHelper.name = 'RimLightHelper'
		rimHelper.visible = this.showHelpers
		lightsGroup.add(rimHelper)

		const top = new RectAreaLight(0xffffff, 2, 1.2, 1.2)
		top.name = 'TopLight'
		top.color.set(0xffffff)
		top.position.set(0.173, 2.2, 0.1)
		top.lookAt(0, 0.2, 0)
		lightsGroup.add(top)

		const topHelper = new RectAreaLightHelper(top)
		topHelper.name = 'TopLightHelper'
		topHelper.visible = this.showHelpers
		lightsGroup.add(topHelper)

		return lightsGroup
	}
}
