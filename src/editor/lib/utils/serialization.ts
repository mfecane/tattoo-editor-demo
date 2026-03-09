import { BufferGeometry, Camera, Material, Object3D, Scene, Texture, WebGLRenderer } from 'three'

/**
 * Safely serializes an object to JSON, filtering out any non-serializable properties.
 * This prevents circular references and React/DOM element references from causing errors.
 */
export function safeSerialize(obj: unknown): string {
	return JSON.stringify(obj, (key, value) => {
		if (value && typeof value === 'object') {
			if ('__reactFiber$' in value || '__reactInternalInstance$' in value) {
				return undefined
			}
			if (value instanceof HTMLElement || value instanceof Element || value instanceof Node) {
				return undefined
			}
			if (
				value instanceof Texture ||
				value instanceof Material ||
				value instanceof BufferGeometry ||
				value instanceof Object3D ||
				value instanceof WebGLRenderer ||
				value instanceof Camera ||
				value instanceof Scene
			) {
				return undefined
			}
			if (value.constructor && value.constructor.name !== 'Object' && value.constructor.name !== 'Array') {
				const allowedConstructors = ['Number', 'String', 'Boolean', 'Date']
				if (!allowedConstructors.includes(value.constructor.name)) {
					return undefined
				}
			}
		}
		return value
	})
}
