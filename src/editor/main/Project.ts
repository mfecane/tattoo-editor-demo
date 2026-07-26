import { PlacedMeshList } from '@/editor/main/PlacedMeshList'

/**
 * Owns the placed-mesh collection. No project persistence yet - meshes
 * live only for the session (see docs/architecture skill: the old
 * stamp/lattice pipeline had a save/load format, this prototype
 * replacement doesn't have one built yet).
 */
export class Project {
	public readonly placedMeshList: PlacedMeshList = new PlacedMeshList()
}
