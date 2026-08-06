import { MeshUtils } from '@/editor/lib/utils/MeshUtils'
import { Visual3dDebugger } from '@/editor/lib/utils/Visual3dDebugger'
import { PreviewMeshRegistrar } from '@/editor/main/PreviewMeshRegistrar'
import { PreviewMeshRepository } from '@/editor/main/PreviewMeshRepository'
import { PointerMathService } from '@/editor/services/PointerMathService'
import { WidgetTransformService } from '@/editor/services/WidgetTransformService'
import { Container } from '@/lib/di/container'

export function registerEditorServices(container: Container): void {
	container.registerSingleton('Visual3dDebugger', {
		useClass: Visual3dDebugger,
	})

	container.registerSingleton('MeshUtils', {
		useClass: MeshUtils,
	})

	container.registerSingleton('PointerMathService', {
		useClass: PointerMathService,
	})

	container.registerSingleton('WidgetTransformService', {
		useClass: WidgetTransformService,
	})

	container.registerSingleton('PreviewMeshRepository', {
		useClass: PreviewMeshRepository,
	})

	container.registerSingleton('PreviewMeshRegistrar', {
		useFactory: (c) => new PreviewMeshRegistrar(c.resolve('PreviewMeshRepository')),
	})
}
