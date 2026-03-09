import type { UpdateLatticeStrategy } from './UpdateLatticeStrategy'
import { StampProjectionStrategy } from './strategies/StampProjectionStrategy'
import { CylindricalLatticeStrategy } from './strategies/CylindricalLatticeStrategy'

// Cache strategy instances for performance (strategies are stateless)
const strategyCache = new Map<'stamp' | 'cylindrical-lattice', UpdateLatticeStrategy>()

/**
 * Factory function that returns the appropriate strategy for a given projection type.
 * Uses caching to avoid creating new instances on each call.
 * 
 * @param projectionType - The projection type to get a strategy for
 * @returns The strategy instance for the given projection type
 */
export function getStrategy(projectionType: 'stamp' | 'cylindrical-lattice'): UpdateLatticeStrategy {
	if (!strategyCache.has(projectionType)) {
		switch (projectionType) {
			case 'stamp':
				strategyCache.set(projectionType, new StampProjectionStrategy())
				break
			case 'cylindrical-lattice':
				strategyCache.set(projectionType, new CylindricalLatticeStrategy())
				break
		}
	}
	return strategyCache.get(projectionType)!
}

