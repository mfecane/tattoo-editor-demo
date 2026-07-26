import { PerspectiveCamera, Vector3 } from 'three'

/**
 * World-space scale factor that keeps an object's on-screen size constant
 * across camera distance. For a perspective camera, apparent size is
 * inversely proportional to distance, so scaling an object's world size
 * linearly WITH distance exactly cancels that out. Returns 1 at
 * `referenceDistance` (where the object's authored geometry size is
 * "correct"), smaller when closer to the camera, bigger when farther.
 */
export function computeScreenSpaceScale(camera: PerspectiveCamera, worldPosition: Vector3, referenceDistance: number): number {
	return camera.position.distanceTo(worldPosition) / referenceDistance
}
