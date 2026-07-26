import { MeshUtils } from '@/editor/lib/utils/MeshUtils'
import { Visual3dDebugger } from '@/editor/lib/utils/Visual3dDebugger'
import { PointerMathService } from '@/editor/services/PointerMathService'
import { WidgetTransformService } from '@/editor/services/WidgetTransformService'
import { container } from '@/lib/di/container'

export function registerEditorServices() {
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
}
