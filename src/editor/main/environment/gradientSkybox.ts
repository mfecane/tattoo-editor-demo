import { BackSide, Mesh, ShaderMaterial, SphereGeometry } from 'three'

export function createGradientSkybox(): Mesh {
	// What's the point of sphere geometry? Cube could waork just as good with less faces
	const geometry = new SphereGeometry(100, 32, 32)

	const vertexShader = `
		varying vec3 vWorldPosition;

		void main() {
			vec4 worldPosition = modelMatrix * vec4(position, 1.0);
			vWorldPosition = worldPosition.xyz;
			gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
		}
	`

	const fragmentShader = `
		varying vec3 vWorldPosition;

		void main() {
			vec3 direction = normalize(vWorldPosition);

			float gradient = (direction.y + 1.0) * 0.5;

			vec3 bottomColor = vec3(54.0 / 255.0, 54.0 / 255.0, 65.0 / 255.0) * 0.5; //rgb(54, 54, 65)
			vec3 topColor = vec3(112.0 / 255.0, 101.0 / 255.0, 116.0 / 255.0) * 0.5; //rgb(112, 101, 116)

			vec3 color = mix(bottomColor, topColor, gradient);

			gl_FragColor = vec4(color, 1.0);
		}
	`

	const material = new ShaderMaterial({
		vertexShader,
		fragmentShader,
		side: BackSide,
	})

	const skybox = new Mesh(geometry, material)
	skybox.name = 'GradientSkybox'
	skybox.renderOrder = -1
	skybox.frustumCulled = false

	return skybox
}
