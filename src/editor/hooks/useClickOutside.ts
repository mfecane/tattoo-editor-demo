import { useEffect } from 'react'

export function useClickOutside(ref: React.RefObject<HTMLElement | null>, callback: () => void) {
	function handleClickOutside(event: MouseEvent) {
		if (ref.current && !ref.current.contains(event.target as Node)) {
			callback()
		}
	}

	useEffect(() => {
		if (!ref.current) return
		const backdrop = document.createElement('div')
		backdrop.className = 'absolute inset-0 bg-black/50 z-50'
		ref.current.parentNode?.appendChild(backdrop)
		backdrop.addEventListener('mousedown', handleClickOutside)
		return () => {
			backdrop.removeEventListener('mousedown', handleClickOutside)
			backdrop.remove()
		}
	}, [ref, callback])
}
