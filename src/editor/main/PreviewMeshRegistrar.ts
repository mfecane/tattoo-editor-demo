import { PreviewMeshInstance } from '@/editor/main/PreviewMeshInstance'
import { PreviewMeshRepository } from '@/editor/main/PreviewMeshRepository'

export class PreviewMeshRegistrar {
	public constructor(private readonly repository: PreviewMeshRepository) {}

	public register(instance: PreviewMeshInstance): boolean {
		if (this.repository.has(instance.id)) return false
		this.repository.add(instance)
		return true
	}
}
