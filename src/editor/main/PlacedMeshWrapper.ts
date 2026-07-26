import { MESH_WRAP_CONSTANTS } from '@/editor/constants'
import { BufferGeometry, Float32BufferAttribute, Mesh, Raycaster, Vector2, Vector3 } from 'three'

interface VertexFrame {
	position: Vector3 // world space (mesh sits at identity transform once wrapped, so local === world)
	normal: Vector3
	uAxis: Vector3
	vAxis: Vector3
}

type Triangle = readonly [number, number, number]

interface ReprojectHit {
	point: Vector3
	normal: Vector3
}

export interface WrapResult {
	success: boolean
	/** Present when success is false and a geometry could still be built - lets the caller show a debug wireframe of what the failed attempt looked like before discarding it. */
	invalidGeometry?: BufferGeometry
}

export interface WrapPreview {
	success: boolean
	/** In the source mesh's local space (same transform-preserving conversion wrap() itself uses), so it can be dropped straight onto a ghost mesh positioned like the source. */
	geometry: BufferGeometry
}

interface WrapComputation {
	success: boolean
	reason: string | null
	worldPositions: Float32Array
	index: NonNullable<BufferGeometry['index']>
	uvAttr: BufferGeometry['attributes'][string]
}

/**
 * Wraps a flat regionMesh's geometry onto a target bodyMesh surface via a
 * single-parent Dijkstra front-march - the "cheaper MVP substitute" for the
 * full multi-parent discrete-exponential-map algorithm (docs/a.md): march
 * outward from the mesh's placement point in order of local edge-distance,
 * predicting each vertex from its nearest already-processed neighbor's
 * tangent frame, then snapping the prediction onto the real surface with a
 * raycast and re-orthogonalizing the frame (Gram-Schmidt) for the next
 * generation.
 *
 * The march itself (`compute`) never touches the input mesh - `wrap()`
 * mutates it on success, `preview()` never does, so the same computation
 * can drive both the real commit and a live, continuously-updating ghost
 * preview while the user repositions the regionMesh.
 */
export class PlacedMeshWrapper {
	/** Wraps regionMesh geometry onto bodyMesh. Runs the march and applies result if validation passes, leaving regionMesh untouched on failure. */
	public static wrap(mesh: Mesh, bodyMesh: Mesh): WrapResult {
		const computation = PlacedMeshWrapper.compute(mesh, bodyMesh)
		if (!computation) {
			console.error('[PlacedMeshWrapper] wrap failed: mesh is not fully connected to its origin vertex')
			return { success: false }
		}

		if (!computation.success) {
			console.error(`[PlacedMeshWrapper] wrap failed: ${computation.reason}`)
			return {
				success: false,
				invalidGeometry: PlacedMeshWrapper.buildGeometry(mesh, computation.index, computation.uvAttr, computation.worldPositions),
			}
		}

		const newGeometry = PlacedMeshWrapper.buildGeometry(mesh, computation.index, computation.uvAttr, computation.worldPositions)
		mesh.geometry.dispose()
		mesh.geometry = newGeometry

		return { success: true }
	}

	/** Same march as wrap(), but purely read-only - for a live preview ghost while the user is still positioning the flat mesh. No console logging (this can run every debounce tick). */
	public static preview(mesh: Mesh, bodyMesh: Mesh): WrapPreview | null {
		const computation = PlacedMeshWrapper.compute(mesh, bodyMesh)
		if (!computation) {
			return null
		}

		return {
			success: computation.success,
			geometry: PlacedMeshWrapper.buildGeometry(mesh, computation.index, computation.uvAttr, computation.worldPositions),
		}
	}

	private static compute(mesh: Mesh, bodyMesh: Mesh): WrapComputation | null {
		const geometry = mesh.geometry
		const positionAttr = geometry.attributes.position
		const index = geometry.index
		if (!index) {
			return null
		}

		const vertexCount = positionAttr.count
		const local: Vector2[] = []
		for (let i = 0; i < vertexCount; i++) {
			local.push(new Vector2(positionAttr.getX(i), positionAttr.getY(i)))
		}

		const triangles: Triangle[] = []
		const adjacency: number[][] = Array.from({ length: vertexCount }, () => [])
		for (let t = 0; t < index.count; t += 3) {
			const a = index.getX(t)
			const b = index.getX(t + 1)
			const c = index.getX(t + 2)
			triangles.push([a, b, c])
			adjacency[a].push(b)
			adjacency[b].push(a)
			adjacency[b].push(c)
			adjacency[c].push(b)
			adjacency[c].push(a)
			adjacency[a].push(c)
		}

		const originIndex = PlacedMeshWrapper.findOriginVertex(local)
		const { order, parent } = PlacedMeshWrapper.marchOrder(local, adjacency, originIndex)
		if (order === null) {
			return null // mesh isn't fully connected to the origin - nothing meaningful to march or show
		}

		// marchFrames always returns a complete set of frames - vertices that couldn't be
		// reprojected onto the surface fall back to their unprojected predicted position, so
		// a coverage stall shows up as visibly wrong (floating/collapsed) geometry rather than
		// silently vanishing, and getFailureReason below is what actually catches it as a failure.
		const frames = PlacedMeshWrapper.marchFrames(mesh, bodyMesh, local, order, parent, originIndex)

		const worldPositions = new Float32Array(vertexCount * 3)
		for (let i = 0; i < vertexCount; i++) {
			const frame = frames[i]
			worldPositions[i * 3] = frame.position.x
			worldPositions[i * 3 + 1] = frame.position.y
			worldPositions[i * 3 + 2] = frame.position.z
		}

		const reason = PlacedMeshWrapper.getFailureReason(worldPositions, triangles, local, mesh.scale.x * mesh.scale.y)
		return { success: reason === null, reason, worldPositions, index, uvAttr: geometry.attributes.uv }
	}

	/**
	 * Keeps the mesh's own position/quaternion/scale untouched (the select
	 * dot, context menu anchor, etc. all key off mesh.position) - converts
	 * the marched world positions back into that same local frame instead.
	 */
	private static buildGeometry(
		mesh: Mesh,
		index: BufferGeometry['index'],
		uvAttr: BufferGeometry['attributes'][string],
		worldPositions: Float32Array
	): BufferGeometry {
		mesh.updateMatrixWorld(true)
		const inverseMatrix = mesh.matrixWorld.clone().invert()
		const vertexCount = worldPositions.length / 3
		const localPositions = new Float32Array(vertexCount * 3)
		const point = new Vector3()
		for (let i = 0; i < vertexCount; i++) {
			point.set(worldPositions[i * 3], worldPositions[i * 3 + 1], worldPositions[i * 3 + 2]).applyMatrix4(inverseMatrix)
			localPositions[i * 3] = point.x
			localPositions[i * 3 + 1] = point.y
			localPositions[i * 3 + 2] = point.z
		}

		const newGeometry = new BufferGeometry()
		newGeometry.setAttribute('position', new Float32BufferAttribute(localPositions, 3))
		newGeometry.setAttribute('uv', uvAttr.clone())
		newGeometry.setIndex(index ? Array.from(index.array) : null)
		newGeometry.computeVertexNormals()
		return newGeometry
	}

	/** The vertex closest to local (0,0) - RegionMeshFactory centers the mesh on its area-weighted centroid, and that's the point placement raycast the mesh onto the surface. */
	private static findOriginVertex(local: Vector2[]): number {
		let originIndex = 0
		let bestDistSq = Infinity
		for (let i = 0; i < local.length; i++) {
			const distSq = local[i].lengthSq()
			if (distSq < bestDistSq) {
				bestDistSq = distSq
				originIndex = i
			}
		}
		return originIndex
	}

	/** Dijkstra over the flat mesh's own edge graph (edge weight = local-space edge length), giving a march order + a single parent per vertex. */
	private static marchOrder(
		local: Vector2[],
		adjacency: number[][],
		originIndex: number
	): { order: number[] | null; parent: number[] } {
		const vertexCount = local.length
		const dist = new Array<number>(vertexCount).fill(Infinity)
		const parent = new Array<number>(vertexCount).fill(-1)
		const visited = new Array<boolean>(vertexCount).fill(false)
		dist[originIndex] = 0

		for (let iter = 0; iter < vertexCount; iter++) {
			let u = -1
			let best = Infinity
			for (let i = 0; i < vertexCount; i++) {
				if (!visited[i] && dist[i] < best) {
					best = dist[i]
					u = i
				}
			}
			if (u === -1) {
				break
			}
			visited[u] = true
			for (const v of adjacency[u]) {
				const weight = local[u].distanceTo(local[v])
				if (dist[u] + weight < dist[v]) {
					dist[v] = dist[u] + weight
					parent[v] = u
				}
			}
		}

		for (let i = 0; i < vertexCount; i++) {
			if (i !== originIndex && parent[i] === -1) {
				return { order: null, parent }
			}
		}

		const order = Array.from({ length: vertexCount }, (_, i) => i).sort((a, b) => dist[a] - dist[b])
		return { order, parent }
	}

	private static marchFrames(
		mesh: Mesh,
		bodyMesh: Mesh,
		local: Vector2[],
		order: number[],
		parent: number[],
		originIndex: number
	): VertexFrame[] {
		const frames: VertexFrame[] = new Array(local.length)
		frames[originIndex] = {
			position: mesh.position.clone(),
			normal: new Vector3(0, 0, 1).applyQuaternion(mesh.quaternion),
			uAxis: new Vector3(1, 0, 0).applyQuaternion(mesh.quaternion),
			vAxis: new Vector3(0, 1, 0).applyQuaternion(mesh.quaternion),
		}

		const raycaster = new Raycaster()
		bodyMesh.updateMatrixWorld(true)

		for (const vi of order) {
			if (vi === originIndex) {
				continue
			}
			const parentFrame = frames[parent[vi]]

			// Local deltas are raw (unscaled) geometry-space distances; scale them by the mesh's own
			// scale.x/y so a scaled placed mesh marches at its actual on-surface size, matching how
			// Three.js would render the same delta when flat (worldPos = position + quat.rotate(scale ⊙ local)).
			const delta = new Vector2().subVectors(local[vi], local[parent[vi]])
			delta.x *= mesh.scale.x
			delta.y *= mesh.scale.y
			const predicted = parentFrame.position
				.clone()
				.addScaledVector(parentFrame.uAxis, delta.x)
				.addScaledVector(parentFrame.vAxis, delta.y)

			const hit = PlacedMeshWrapper.reproject(raycaster, bodyMesh, predicted, parentFrame.normal)
			if (hit) {
				frames[vi] = PlacedMeshWrapper.buildFrame(hit, parentFrame.uAxis)
			} else {
				// Coverage stall at this vertex: nothing to reproject onto. Carry the predicted
				// (unprojected) position and parent's frame forward so marching can still finish -
				// this vertex just ends up visibly off-surface, which getFailureReason will catch.
				frames[vi] = { position: predicted, normal: parentFrame.normal, uAxis: parentFrame.uAxis, vAxis: parentFrame.vAxis }
			}
		}

		return frames
	}

	/** Casts a ray straight through `predicted` along `normal`, long enough to cross the surface from either side of it. */
	private static reproject(raycaster: Raycaster, bodyMesh: Mesh, predicted: Vector3, normal: Vector3): ReprojectHit | null {
		const origin = predicted.clone().addScaledVector(normal, MESH_WRAP_CONSTANTS.SEARCH_OFFSET)
		const direction = normal.clone().negate()

		raycaster.set(origin, direction)
		raycaster.near = 0
		raycaster.far = MESH_WRAP_CONSTANTS.SEARCH_DISTANCE

		const hits = raycaster.intersectObject(bodyMesh, false)
		if (hits.length === 0 || !hits[0].face) {
			return null
		}

		const hit = hits[0]
		const worldNormal = hit.face!.normal.clone().transformDirection(hit.object.matrixWorld).normalize()
		return { point: hit.point.clone(), normal: worldNormal }
	}

	/** Gram-Schmidt re-orthogonalization: carry the parent's tangent forward, project out the new normal, rebuild vAxis. */
	private static buildFrame(hit: ReprojectHit, parentU: Vector3): VertexFrame {
		let uAxis = parentU.clone().addScaledVector(hit.normal, -parentU.dot(hit.normal))
		if (uAxis.lengthSq() < 1e-8) {
			const fallback = Math.abs(hit.normal.dot(new Vector3(1, 0, 0))) > 0.99 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0)
			uAxis = fallback.addScaledVector(hit.normal, -fallback.dot(hit.normal))
		}
		uAxis.normalize()
		const vAxis = new Vector3().crossVectors(hit.normal, uAxis).normalize()

		return { position: hit.point, normal: hit.normal, uAxis, vAxis }
	}

	/** Coverage/distortion/self-fold checks per docs/a.md's failure handling. Returns null when valid, otherwise a human-readable reason for the console. */
	private static getFailureReason(positions: Float32Array, triangles: Triangle[], local: Vector2[], scaleAreaFactor: number): string | null {
		// `local` is raw, unscaled geometry-space; `positions` (worldPositions) already has
		// mesh.scale baked in via marchFrames' delta.x/y *= scale.x/y. Scale flatArea by the
		// same scale.x * scale.y so the distortion ratio below measures curvature-induced
		// stretch only, not the user's own Resize - otherwise a 2x scaled mesh reports a
		// ~4x "distortion blowup" purely from the scale, even on a geometrically perfect wrap.
		let flatArea = 0
		for (const [a, b, c] of triangles) {
			flatArea += PlacedMeshWrapper.triangleArea2D(local[a], local[b], local[c])
		}
		flatArea *= scaleAreaFactor
		if (flatArea < 1e-10) {
			return 'source polygon has ~zero area'
		}

		const pa = new Vector3()
		const pb = new Vector3()
		const pc = new Vector3()
		const ab = new Vector3()
		const ac = new Vector3()
		const normal = new Vector3()

		const triangleNormals: Vector3[] = []
		const triangleAreas: number[] = []
		let wrappedArea = 0

		for (const [a, b, c] of triangles) {
			pa.set(positions[a * 3], positions[a * 3 + 1], positions[a * 3 + 2])
			pb.set(positions[b * 3], positions[b * 3 + 1], positions[b * 3 + 2])
			pc.set(positions[c * 3], positions[c * 3 + 1], positions[c * 3 + 2])
			ab.subVectors(pb, pa)
			ac.subVectors(pc, pa)
			normal.crossVectors(ab, ac)

			const area = normal.length() * 0.5
			triangleAreas.push(area)
			wrappedArea += area

			const unitNormal = area > 1e-12 ? normal.clone().divideScalar(normal.length()) : new Vector3()
			triangleNormals.push(unitNormal)
		}

		const averageArea = wrappedArea / triangles.length
		for (let i = 0; i < triangleAreas.length; i++) {
			if (triangleAreas[i] < averageArea * MESH_WRAP_CONSTANTS.MIN_TRIANGLE_AREA_RATIO) {
				return `degenerate triangle #${i} (area ${triangleAreas[i].toExponential(2)}, average ${averageArea.toExponential(2)})`
			}
		}

		// Self-fold check: compare each triangle only against its edge-adjacent neighbors, not
		// a mesh-wide average. A patch legitimately wrapped around real curvature (most of the
		// way around an arm, say) can have far-apart triangles pointing in very different or even
		// opposite directions without anything being wrong - a genuine fold shows up locally, as
		// two triangles sharing an edge whose normals point sharply away from each other.
		const foldReason = PlacedMeshWrapper.findAdjacentNormalFold(triangles, triangleNormals, triangleAreas)
		if (foldReason) {
			return foldReason
		}

		const distortionRatio = wrappedArea / flatArea
		if (distortionRatio > MESH_WRAP_CONSTANTS.MAX_DISTORTION_RATIO) {
			return `distortion blowup (wrapped area is ${distortionRatio.toFixed(2)}x the flat area, max ${MESH_WRAP_CONSTANTS.MAX_DISTORTION_RATIO}x)`
		}
		if (distortionRatio < MESH_WRAP_CONSTANTS.MIN_DISTORTION_RATIO) {
			return `distortion collapse (wrapped area is ${distortionRatio.toFixed(2)}x the flat area, min ${MESH_WRAP_CONSTANTS.MIN_DISTORTION_RATIO}x)`
		}

		return null
	}

	/** Finds two edge-adjacent triangles whose normals point sharply away from each other - a real self-fold, as opposed to gradual curvature. */
	private static findAdjacentNormalFold(triangles: Triangle[], triangleNormals: Vector3[], triangleAreas: number[]): string | null {
		const edgeToTriangles = new Map<string, number[]>()
		const edgeKey = (i0: number, i1: number): string => (i0 < i1 ? `${i0}_${i1}` : `${i1}_${i0}`)

		for (let i = 0; i < triangles.length; i++) {
			const [a, b, c] = triangles[i]
			for (const key of [edgeKey(a, b), edgeKey(b, c), edgeKey(c, a)]) {
				const list = edgeToTriangles.get(key)
				if (list) {
					list.push(i)
				} else {
					edgeToTriangles.set(key, [i])
				}
			}
		}

		for (const triangleIndices of edgeToTriangles.values()) {
			if (triangleIndices.length !== 2) {
				continue // boundary edge, only one triangle - nothing to compare
			}
			const [i, j] = triangleIndices
			if (triangleAreas[i] < 1e-12 || triangleAreas[j] < 1e-12) {
				continue // already flagged as degenerate, its normal isn't meaningful
			}
			const dot = triangleNormals[i].dot(triangleNormals[j])
			if (dot < MESH_WRAP_CONSTANTS.MIN_ADJACENT_NORMAL_DOT) {
				return `self-fold between adjacent triangles #${i} and #${j} (normals ${dot.toFixed(2)} aligned, need >= ${MESH_WRAP_CONSTANTS.MIN_ADJACENT_NORMAL_DOT})`
			}
		}

		return null
	}

	private static triangleArea2D(a: Vector2, b: Vector2, c: Vector2): number {
		return Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) * 0.5
	}
}
