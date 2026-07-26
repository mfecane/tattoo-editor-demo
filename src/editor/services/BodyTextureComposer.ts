import { MESH_BAKE_CONSTANTS } from '@/editor/constants'
import { Editor } from '@/editor/main/Editor'
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js'
import { MeshPhysicalMaterial, ShaderMaterial, Texture, WebGLRenderTarget } from 'three'

/**
 * Composites cached bakedLayers (Piece.bakedTarget, produced by PatchBaker) onto the
 * body's editable texture - cheap, synchronous, cache-only, no BVH/search work of its own. Runs
 * after every command (see EditorController.refreshBakeAndVisibility) so the body texture never
 * goes stale/blank while a background bake is in flight.
 */
export class BodyTextureComposer {
	private compositeTargetA: WebGLRenderTarget | null = null
	private compositeTargetB: WebGLRenderTarget | null = null

	public constructor(private readonly editor: Editor) {}

	public destroy(): void {
		this.compositeTargetA?.dispose()
		this.compositeTargetB?.dispose()
	}

	/** Cheap, synchronous, cache-only composite - runs after every command so visuals never go stale. */
	public compositeAll(excludeId?: string | null): void {
		const bodyMesh = this.editor.previewMesh.mesh
		const originalTexture = this.editor.previewMesh.originalEditableTexture
		if (!originalTexture) {
			throw new Error('Body mesh has no original editable texture to bake onto')
		}

		const layers = this.editor.controller.project.placedMeshList
			.getAll()
			.filter((entry) => entry.kind === 'drapedPatch' && entry.id !== excludeId && entry.bakedTarget !== null)

		let currentSource: Texture = originalTexture
		if (layers.length > 0) {
			this.ensureCompositeTargets()
			let readTarget = this.compositeTargetA!
			let writeTarget = this.compositeTargetB!
			for (const layer of layers) {
				this.renderMultiplyOver(currentSource, layer.bakedTarget!.texture, writeTarget)
				currentSource = writeTarget.texture
				;[readTarget, writeTarget] = [writeTarget, readTarget]
			}
		}

		const materials = Array.isArray(bodyMesh.material) ? bodyMesh.material : [bodyMesh.material]
		const editableMaterial = materials[1]
		if (editableMaterial instanceof MeshPhysicalMaterial) {
			editableMaterial.map = currentSource
			editableMaterial.needsUpdate = true
		}
	}

	private ensureCompositeTargets(): void {
		if (this.compositeTargetA && this.compositeTargetB) {
			return
		}
		this.compositeTargetA = new WebGLRenderTarget(MESH_BAKE_CONSTANTS.BAKE_RESOLUTION, MESH_BAKE_CONSTANTS.BAKE_RESOLUTION)
		this.compositeTargetB = new WebGLRenderTarget(MESH_BAKE_CONSTANTS.BAKE_RESOLUTION, MESH_BAKE_CONSTANTS.BAKE_RESOLUTION)
	}

	/** Layer multiplies over base where the layer has coverage (layer.a), straight (non-premultiplied) alpha. */
	private renderMultiplyOver(base: Texture, layer: Texture, target: WebGLRenderTarget): void {
		const material = new ShaderMaterial({
			uniforms: { uBase: { value: base }, uLayer: { value: layer } },
			vertexShader: /* glsl */ `
				varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = vec4(position.xy, 0.0, 1.0);
				}
			`,
			fragmentShader: /* glsl */ `
				varying vec2 vUv;
				uniform sampler2D uBase;
				uniform sampler2D uLayer;
				void main() {
					vec4 base = texture2D(uBase, vUv);
					vec4 layer = texture2D(uLayer, vUv);
					vec3 multiplied = base.rgb * layer.rgb;
					vec3 outColor = mix(base.rgb, multiplied, layer.a);
					float outAlpha = layer.a + base.a * (1.0 - layer.a);
					gl_FragColor = vec4(outColor, outAlpha);
				}
			`,
		})

		const quad = new FullScreenQuad(material)
		const renderer = this.editor.renderer
		const previousTarget = renderer.getRenderTarget()
		renderer.setRenderTarget(target)
		quad.render(renderer)
		renderer.setRenderTarget(previousTarget)

		quad.dispose()
		material.dispose()
	}
}
