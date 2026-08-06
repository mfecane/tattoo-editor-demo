import { Container } from '@/lib/di/container'
import { createContext, useContext } from 'react'

export const ContainerContext = createContext<Container | null>(null)

export function useContainer(): Container {
	const container: Container | null = useContext(ContainerContext)
	if (!container) {
		throw new Error('Could not initialize dependency container')
	}
	return container
}
