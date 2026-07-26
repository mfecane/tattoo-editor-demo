import { AddPlacedMeshCommand } from '@/editor/main/commands/AddPlacedMeshCommand'
import { PersistRegionsCommand } from '@/editor/main/commands/PersistRegionsCommand'
import { RemovePlacedMeshCommand } from '@/editor/main/commands/RemovePlacedMeshCommand'
import { PlacedMeshTransform, UpdatePlacedMeshCommand } from '@/editor/main/commands/UpdatePlacedMeshCommand'
import { UnwrapPlacedMeshCommand } from '@/editor/main/commands/UnwrapPlacedMeshCommand'
import { UpdateWrappedMeshVerticesCommand } from '@/editor/main/commands/UpdateWrappedMeshVerticesCommand'
import { WrapPlacedMeshCommand } from '@/editor/main/commands/WrapPlacedMeshCommand'
import { EditorCommand } from '@/editor/main/EditorCommand'
import { EditorController } from '@/editor/main/EditorController'
import { RegionShape } from '@/editor/polygon/RegionShape'
import type { Mesh, Texture } from 'three'

export class CommandFactory {
	public constructor(private readonly controller: EditorController) {}

	// Returns the concrete command (not the EditorCommand interface) so the caller can read getPlacedMeshId() after execute().
	public createAddPlacedMeshCommand(mesh: Mesh, sourceShape: RegionShape, texture: Texture, sketchAspect: number): AddPlacedMeshCommand {
		return new AddPlacedMeshCommand(mesh, sourceShape, texture, sketchAspect, this.controller)
	}

	public createRemovePlacedMeshCommand(placedMeshId: string): EditorCommand {
		return new RemovePlacedMeshCommand(placedMeshId, this.controller)
	}

	public createUpdatePlacedMeshCommand(
		placedMeshId: string,
		before: PlacedMeshTransform,
		after: PlacedMeshTransform
	): EditorCommand {
		return new UpdatePlacedMeshCommand(placedMeshId, before, after, this.controller)
	}

	public createPersistRegionsCommand(sketchId: string, regions: RegionShape[]): EditorCommand {
		return new PersistRegionsCommand(sketchId, regions, this.controller)
	}

	// Returns the concrete command (not the EditorCommand interface) so the caller can read didSucceed() after execute().
	public createWrapPlacedMeshCommand(placedMeshId: string): WrapPlacedMeshCommand {
		return new WrapPlacedMeshCommand(placedMeshId, this.controller)
	}

	public createUnwrapPlacedMeshCommand(placedMeshId: string): EditorCommand {
		return new UnwrapPlacedMeshCommand(placedMeshId, this.controller)
	}

	public createUpdateWrappedMeshVerticesCommand(placedMeshId: string, before: Float32Array, after: Float32Array): EditorCommand {
		return new UpdateWrappedMeshVerticesCommand(placedMeshId, before, after, this.controller)
	}
}
