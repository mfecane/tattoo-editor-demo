/**
 * Stub implementation of auth.
 * Placeholder for future authentication integration.
 */

export interface User {
	id: string
	email: string
	name?: string
}

export function useAuth() {
	return {
		user: null as User | null,
		isLoading: false,
		error: null as Error | null,
	}
}
