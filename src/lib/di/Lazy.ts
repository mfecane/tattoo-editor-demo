import type { Container } from './container'
import type { Token } from './container'

/**
 * Lazy dependency resolver wrapper.
 * Wraps a lazy resolver function to provide a cleaner API for deferred dependency resolution.
 *
 * @example
 * ```ts
 * const lazyEditor = new Lazy(container, 'Editor')
 * // Later...
 * const editor = lazyEditor.get()
 * ```
 */
export class Lazy<T> {
	constructor(
		private readonly container: Container,
		private readonly token: Token<T>
	) {}

	/**
	 * Resolve the dependency. Returns the same singleton instance on every call.
	 */
	get(): T {
		return this.container.resolve(this.token)
	}

	/**
	 * Create a Lazy instance from a container and token.
	 * Convenience factory method for cleaner syntax.
	 */
	static of<T>(container: Container, token: Token<T>): Lazy<T> {
		return new Lazy(container, token)
	}
}
