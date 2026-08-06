import { REGION_MASK_CONSTANTS } from '@/editor/constants'
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js'
import {
	BufferGeometry,
	Color,
	Float32BufferAttribute,
	Mesh,
	MeshBasicMaterial,
	OrthographicCamera,
	Scene,
	ShaderMaterial,
	Sphere,
	Texture,
	Uint32BufferAttribute,
	Vector3,
	WebGLRenderer,
	WebGLRenderTarget,
} from 'three'

/**
 * Renders a drapedPatch's own UV footprint - the real, un-grown, un-pushed boundary - as a small
 * blurred alpha mask in the patch's own UV space (the same space `uv1`/source-UV samples live in).
 *
 * GrowBoundaryEdgesModifier extrapolates a rim of triangles/UVs past that real boundary so search
 * hits landing just past the patch's edge still resolve to some source UV (a coverage margin, see
 * docs/baking-algorithm.md) - but "some source UV" can fall outside the design texture's authored
 * region, and FootprintRasterizer would otherwise sample it as-is (smeared or wrapped-around
 * pixels depending on the sketch texture's wrap mode). This mask is what lets FootprintRasterizer
 * zero out exactly those samples: multiplied into its output alpha, it fades to 0 outside the true
 * footprint regardless of how far any given search algorithm's boundary growth extrapolated.
 *
 * The rasterized footprint can itself touch or fill the mask's UV-space border (u/v = 0 or 1) - a
 * patch using the full sketch texture, say - leaving the blur nothing to feather against there. A
 * final pass (`fadeEdges`) forces the mask down to 0 within `EDGE_FADE_TEXELS` of that border
 * regardless of footprint shape, so the design's very edge is always a soft falloff, never a hard
 * cut straight to the render target's boundary.
 */
export class PatchRegionMaskRasterizer {
	public rasterize(renderer: WebGLRenderer, patchGeometry: BufferGeometry): WebGLRenderTarget {
		const uvs = patchGeometry.attributes.uv.array as Float32Array
		const indices = patchGeometry.index!.array as Uint32Array

		const clipPositions = new Float32Array(uvs.length)
		for (let i = 0; i < uvs.length; i++) {
			clipPositions[i] = uvs[i] * 2 - 1
		}

		const footprintGeometry = new BufferGeometry()
		footprintGeometry.name = 'patchRegionMaskRasterizer.footprint'
		footprintGeometry.setAttribute('position', new Float32BufferAttribute(clipPositions, 2))
		footprintGeometry.setIndex(new Uint32BufferAttribute(indices, 1))
		// Same reasoning as FootprintRasterizer: `position` is itemSize 2 (packed clip-space xy), so
		// letting the renderer's transparent-object sort path compute a bounding sphere from it would
		// misread the buffer. Assign a fixed, correct one up front.
		footprintGeometry.boundingSphere = new Sphere(new Vector3(0, 0, 0), Math.SQRT2)

		const material = new MeshBasicMaterial({ color: new Color(0xffffff) })
		material.name = 'patchRegionMaskRasterizer.footprintMaterial'
		const mesh = new Mesh(footprintGeometry, material)
		mesh.name = 'patchRegionMaskRasterizer.footprintMesh'
		mesh.frustumCulled = false

		const scene = new Scene()
		scene.name = 'patchRegionMaskRasterizer.scene'
		scene.add(mesh)
		const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 2)
		camera.name = 'patchRegionMaskRasterizer.camera'
		camera.position.z = 1

		const sharpMask = new WebGLRenderTarget(REGION_MASK_CONSTANTS.MASK_RESOLUTION, REGION_MASK_CONSTANTS.MASK_RESOLUTION)
		sharpMask.texture.name = 'patchRegionMaskRasterizer.sharpMask'

		const previousTarget = renderer.getRenderTarget()
		const previousClearColor = renderer.getClearColor(new Color())
		const previousClearAlpha = renderer.getClearAlpha()

		renderer.setRenderTarget(sharpMask)
		renderer.setClearColor(new Color(0, 0, 0), 0)
		renderer.clear(true, true, true)
		renderer.render(scene, camera)

		const blurredMask = this.blur(renderer, sharpMask.texture)
		const mask = this.fadeEdges(renderer, blurredMask.texture)

		renderer.setRenderTarget(previousTarget)
		renderer.setClearColor(previousClearColor, previousClearAlpha)

		footprintGeometry.dispose()
		material.dispose()
		sharpMask.dispose()
		blurredMask.dispose()

		return mask
	}

	/** Separable blur: one horizontal pass, one vertical pass, each a 5-tap Gaussian-ish kernel. */
	private blur(renderer: WebGLRenderer, source: Texture): WebGLRenderTarget {
		const texelSize = 1 / REGION_MASK_CONSTANTS.MASK_RESOLUTION
		const blurStep = REGION_MASK_CONSTANTS.BLUR_RADIUS_TEXELS * texelSize

		const horizontal = new WebGLRenderTarget(REGION_MASK_CONSTANTS.MASK_RESOLUTION, REGION_MASK_CONSTANTS.MASK_RESOLUTION)
		horizontal.texture.name = 'patchRegionMaskRasterizer.blurHorizontal'
		this.blurPass(renderer, source, horizontal, blurStep, 0)

		const blurred = new WebGLRenderTarget(REGION_MASK_CONSTANTS.MASK_RESOLUTION, REGION_MASK_CONSTANTS.MASK_RESOLUTION)
		blurred.texture.name = 'patchRegionMaskRasterizer.blurred'
		this.blurPass(renderer, horizontal.texture, blurred, 0, blurStep)

		horizontal.dispose()
		return blurred
	}

	/**
	 * Forces the mask to 0 within EDGE_FADE_TEXELS of the render target's own UV-space border
	 * (u/v = 0 or 1), blended smoothly over that margin - independent of the blurred footprint's own
	 * shape, so a footprint that reaches the border (e.g. the full sketch texture selected) still
	 * gets a soft edge instead of staying opaque all the way out.
	 */
	private fadeEdges(renderer: WebGLRenderer, source: Texture): WebGLRenderTarget {
		const margin = REGION_MASK_CONSTANTS.EDGE_FADE_TEXELS / REGION_MASK_CONSTANTS.MASK_RESOLUTION

		const target = new WebGLRenderTarget(REGION_MASK_CONSTANTS.MASK_RESOLUTION, REGION_MASK_CONSTANTS.MASK_RESOLUTION)
		target.texture.name = 'patchRegionMaskRasterizer.edgeFaded'

		const material = new ShaderMaterial({
			name: 'patchRegionMaskRasterizer.edgeFadeMaterial',
			uniforms: { uSource: { value: source }, uMargin: { value: margin } },
			vertexShader: /* glsl */ `
				varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = vec4(position.xy, 0.0, 1.0);
				}
			`,
			fragmentShader: /* glsl */ `
				varying vec2 vUv;
				uniform sampler2D uSource;
				uniform float uMargin;
				void main() {
					vec2 distanceToEdge = min(vUv, 1.0 - vUv);
					float fade = smoothstep(0.0, uMargin, min(distanceToEdge.x, distanceToEdge.y));
					gl_FragColor = texture2D(uSource, vUv) * fade;
				}
			`,
		})

		const quad = new FullScreenQuad(material)
		renderer.setRenderTarget(target)
		quad.render(renderer)

		quad.dispose()
		material.dispose()

		return target
	}

	private blurPass(renderer: WebGLRenderer, source: Texture, target: WebGLRenderTarget, stepX: number, stepY: number): void {
		const material = new ShaderMaterial({
			name: 'patchRegionMaskRasterizer.blurMaterial',
			uniforms: { uSource: { value: source }, uStepX: { value: stepX }, uStepY: { value: stepY } },
			vertexShader: /* glsl */ `
				varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = vec4(position.xy, 0.0, 1.0);
				}
			`,
			fragmentShader: /* glsl */ `
				varying vec2 vUv;
				uniform sampler2D uSource;
				uniform float uStepX;
				uniform float uStepY;
				void main() {
					vec2 step = vec2(uStepX, uStepY);
					vec4 sum = texture2D(uSource, vUv) * 0.4;
					sum += texture2D(uSource, vUv + step) * 0.24;
					sum += texture2D(uSource, vUv - step) * 0.24;
					sum += texture2D(uSource, vUv + step * 2.0) * 0.06;
					sum += texture2D(uSource, vUv - step * 2.0) * 0.06;
					gl_FragColor = sum;
				}
			`,
		})

		const quad = new FullScreenQuad(material)
		renderer.setRenderTarget(target)
		quad.render(renderer)

		quad.dispose()
		material.dispose()
	}
}
