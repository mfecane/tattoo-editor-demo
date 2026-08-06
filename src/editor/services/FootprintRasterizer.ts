import { MESH_BAKE_CONSTANTS } from '@/editor/constants'
import {
	BufferGeometry,
	Color,
	DoubleSide,
	Float32BufferAttribute,
	Mesh,
	NoBlending,
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

/** One GPU draw call: body UV (as clip-space position) -> sample the sketch texture at the source UV (uv1). */
export class FootprintRasterizer {
	static rasterize(
		renderer: WebGLRenderer,
		footprintGeometry: BufferGeometry,
		sketchTexture: Texture | null,
		regionMask: Texture
	): WebGLRenderTarget {
		// Convert body UVs to clip-space positions
		const bodyUVs = footprintGeometry.attributes.uv.array as Float32Array
		const sourceUVs = footprintGeometry.attributes.uv1.array as Float32Array
		const indices = footprintGeometry.index?.array as Uint32Array

		const clipPositions = new Float32Array(bodyUVs.length)
		for (let i = 0; i < bodyUVs.length; i++) {
			clipPositions[i] = bodyUVs[i] * 2 - 1
		}

		const geometry = new BufferGeometry()
		geometry.setAttribute('position', new Float32BufferAttribute(clipPositions, 2))
		geometry.setAttribute('sourceUV', new Float32BufferAttribute(sourceUVs, 2))
		geometry.setIndex(new Uint32BufferAttribute(indices, 1))
		// `position` is itemSize 2 (packed clip-space xy) - WebGLRenderer's transparent-object
		// depth-sort path (projectObject, gated on renderer.sortObjects, independent of
		// frustumCulled) calls geometry.computeBoundingSphere() whenever boundingSphere is null,
		// which misreads this buffer as xyz triples and produces a NaN radius. Assign a fixed,
		// correct bounding sphere up front so that computation never runs.
		geometry.boundingSphere = new Sphere(new Vector3(0, 0, 0), Math.SQRT2)

		// `position` is bound with itemSize 2 (already-packed clip-space xy, z defaults to 0 per
		// WebGL's generic-attribute rules) so the renderer can still derive the non-indexed draw
		// vertex count from it. `sourceUV` is a genuinely custom attribute - ShaderMaterial only
		// auto-declares the standard ones (position/normal/uv/...), so it needs an explicit
		// `attribute` line here, unlike `position`.
		// Vertex shader uses the same matrix-based transform MeshBasicMaterial uses (projectionMatrix
		// * modelViewMatrix * position) - the manual gl_Position clip-space bypass this used to do
		// silently failed to draw anything; this is the mechanism actually confirmed to work.
		const material = new ShaderMaterial({
			uniforms: { sketchTex: { value: sketchTexture }, regionMask: { value: regionMask } },
			transparent: true,
			// This is the only draw into a target freshly cleared to (0,0,0,0), so there's nothing
			// underneath to blend against - but `transparent: true` still leaves NormalBlending active,
			// which premultiplies gl_FragColor.rgb by its own alpha against that zero destination
			// (result.rgb = src.rgb * src.a) before the write. Every downstream consumer (regionMask
			// fade, BodyTextureComposer) treats bakedTarget as straight (non-premultiplied) alpha, so
			// that silent premultiply corrupts rgb everywhere alpha isn't exactly 1 - invisible while
			// regionMask made alpha a hard 1/0 step, visible as a gray fringe now that it fades smoothly.
			blending: NoBlending,
			side: DoubleSide,
			vertexShader: /* glsl */ `
				attribute vec2 sourceUV;
				varying vec2 vSourceUV;
				void main() {
					vSourceUV = sourceUV;
					gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
				}
			`,
			fragmentShader: /* glsl */ `
				varying vec2 vSourceUV;
				uniform sampler2D sketchTex;
				uniform sampler2D regionMask;
				void main() {
					vec4 color = texture2D(sketchTex, vSourceUV);
					// GrowBoundaryEdgesModifier extrapolates source UVs past the patch's real boundary so
					// search hits landing just past the edge still resolve to *some* UV (a coverage
					// margin) - regionMask (see PatchRegionMaskRasterizer) is the patch's true, un-grown
					// footprint, blurred, so those extrapolated samples fade to transparent here instead
					// of baking in whatever the sketch texture's wrap mode happens to sample out there.
					float mask = texture2D(regionMask, vSourceUV).r;
					gl_FragColor = vec4(color.rgb, color.a * mask);
				}
			`,
		})

		const mesh = new Mesh(geometry, material)
		// `position` here is itemSize 2 (packed clip-space xy), not a real 3D position - computing
		// a bounding sphere from it would misread the buffer, so skip frustum culling entirely.
		mesh.frustumCulled = false
		const scene = new Scene()
		scene.add(mesh)
		const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 2)
		camera.position.z = 1

		const target = new WebGLRenderTarget(MESH_BAKE_CONSTANTS.BAKE_RESOLUTION, MESH_BAKE_CONSTANTS.BAKE_RESOLUTION)

		const previousTarget = renderer.getRenderTarget()
		const previousClearColor = renderer.getClearColor(new Color())
		const previousClearAlpha = renderer.getClearAlpha()

		// Untouched pixels (outside the drapedPatch's affected footprint) must stay fully
		// transparent - renderAlphaOver's compositing treats alpha 0 as "nothing here, show
		// whatever's underneath", but WebGLRenderer's own default clear is opaque black.
		renderer.setRenderTarget(target)
		renderer.setClearColor(new Color(0, 0, 0), 0)
		renderer.clear(true, true, true)
		renderer.render(scene, camera)
		renderer.setRenderTarget(previousTarget)
		renderer.setClearColor(previousClearColor, previousClearAlpha)

		geometry.dispose()
		material.dispose()

		return target
	}
}
