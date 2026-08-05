import { useEffect } from 'react'

/**
 * Closes on a pointerdown outside all given refs. Listens in the capture phase because the
 * canvas calls stopPropagation() on pointerdown, which would otherwise swallow the event before
 * it bubbles up to a document-level listener.
 */
export function useClickOutside(
	refs: React.RefObject<HTMLElement | null>[],
	callback: () => void,
	enabled: boolean = true
) {
	useEffect(() => {
		if (!enabled) return

		function handlePointerDown(event: PointerEvent) {
			const target = event.target as Node
			const isInside = refs.some((ref) => ref.current?.contains(target))
			if (!isInside) {
				callback()
			}
		}

		document.addEventListener('pointerdown', handlePointerDown, true)
		return () => {
			document.removeEventListener('pointerdown', handlePointerDown, true)
		}
	}, [refs, callback, enabled])
}
