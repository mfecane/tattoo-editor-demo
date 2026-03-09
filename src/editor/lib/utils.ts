import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { PerspectiveCamera, Vector3 } from 'three'

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}

export function worldToScreen(
	worldPosition: Vector3,
	camera: PerspectiveCamera,
	domElement: HTMLElement
): { x: number; y: number } {
	const vector = worldPosition.clone()
	vector.project(camera)

	const x = (vector.x * 0.5 + 0.5) * domElement.clientWidth
	const y = (vector.y * -0.5 + 0.5) * domElement.clientHeight

	return { x, y }
}

/**
 * Creates a throttled version of a function that limits execution to at most once per interval.
 * @param fn - The function to throttle
 * @param intervalMs - The minimum time interval between executions in milliseconds
 * @returns A throttled version of the function
 */
export function throttle<T extends (...args: any[]) => any>(
	fn: T,
	intervalMs: number
): (...args: Parameters<T>) => void {
	let lastCallTime = 0

	return function (this: any, ...args: Parameters<T>) {
		const now = performance.now()
		if (now - lastCallTime >= intervalMs) {
			lastCallTime = now
			fn.apply(this, args)
		}
	}
}

/**
 * Creates a throttled version of a function that limits execution to a specific frame rate.
 * @param fn - The function to throttle
 * @param fps - The target frame rate (e.g., 60 for 60fps)
 * @returns A throttled version of the function
 */
export function throttleFPS<T extends (...args: any[]) => any>(fn: T, fps: number): (...args: Parameters<T>) => void {
	return throttle(fn, 1000 / fps)
}
