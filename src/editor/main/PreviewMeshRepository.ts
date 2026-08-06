import { PreviewMeshInstance } from '@/editor/main/PreviewMeshInstance'

export class PreviewMeshRepository {
	private readonly instancesById: Map<string, PreviewMeshInstance> = new Map()

	public add(instance: PreviewMeshInstance): void {
		if (this.instancesById.has(instance.id)) {
			throw new Error(`PreviewMeshInstance with id "${instance.id}" is already registered`)
		}
		this.instancesById.set(instance.id, instance)
	}

	public has(id: string): boolean {
		return this.instancesById.has(id)
	}

	public get(id: string): PreviewMeshInstance {
		const instance = this.instancesById.get(id)
		if (!instance) {
			throw new Error(`PreviewMeshInstance with id "${id}" is not registered`)
		}
		return instance
	}

	public getAll(): PreviewMeshInstance[] {
		return Array.from(this.instancesById.values())
	}
}
