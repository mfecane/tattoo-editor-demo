import { MeshUtils } from '@/editor/lib/utils/MeshUtils'
import { SurfaceDataCalculator } from '@/editor/lib/utils/surfaceData'
import { Visual3dDebugger } from '@/editor/lib/utils/Visual3dDebugger'
import { GeometryProjectionService } from '@/editor/services/GeometryProjectionService'
import { ImageLoadingService } from '@/editor/services/ImageLoadingService'
import { LatticeRenderer } from '@/editor/services/LatticeRenderer'
import { PointerMathService } from '@/editor/services/PointerMathService'
import { TextureRenderer } from '@/editor/services/TextureRenderer'
import { WidgetTransformService } from '@/editor/services/WidgetTransformService'
import { container } from '@/lib/di/container'

export function registerEditorServices() {
	container.registerSingleton('SurfaceDataCalculator', { useClass: SurfaceDataCalculator })

	container.registerSingleton('Visual3dDebugger', {
		useClass: Visual3dDebugger,
	})

	container.registerSingleton('MeshUtils', {
		useClass: MeshUtils,
	})

	container.registerSingleton('GeometryProjectionService', {
		useClass: GeometryProjectionService,
	})

	container.registerSingleton('PointerMathService', {
		useClass: PointerMathService,
	})

	container.registerSingleton('WidgetTransformService', {
		useClass: WidgetTransformService,
	})

	container.registerSingleton('LatticeRenderer', {
		useClass: LatticeRenderer,
	})

	container.registerSingleton('ImageLoadingService', {
		useClass: ImageLoadingService,
	})

	container.registerSingleton('TextureRenderer', {
		useFactory: (c) => new TextureRenderer(c.resolve<LatticeRenderer>('LatticeRenderer')),
	})
}
