import { BufferGeometry, Mesh, Vector2, Vector3 } from 'three'

export interface SurfaceBasis {
	normal: Vector3
	uAxis: Vector3
	vAxis: Vector3
	faceIndex: number
}

export class GeometryProjectionService {
	public calculateTangentVectors(
		geometry: BufferGeometry,
		faceIndex: number,
		normal: Vector3
	): { uAxis: Vector3; vAxis: Vector3 } {
		const positions = geometry.attributes.position
		const uvs = geometry.attributes.uv
		const indices = geometry.index

		if (!indices || !uvs) {
			const worldX = new Vector3(1, 0, 0)
			const uAxis = worldX
				.clone()
				.sub(normal.clone().multiplyScalar(worldX.dot(normal)))
				.normalize()
			const vAxis = new Vector3().crossVectors(normal, uAxis).normalize()
			return { uAxis, vAxis }
		}

		const i0 = indices.getX(faceIndex * 3)
		const i1 = indices.getX(faceIndex * 3 + 1)
		const i2 = indices.getX(faceIndex * 3 + 2)

		const v0 = new Vector3(positions.getX(i0), positions.getY(i0), positions.getZ(i0))
		const v1 = new Vector3(positions.getX(i1), positions.getY(i1), positions.getZ(i1))
		const v2 = new Vector3(positions.getX(i2), positions.getY(i2), positions.getZ(i2))

		const uv0 = new Vector2(uvs.getX(i0), uvs.getY(i0))
		const uv1 = new Vector2(uvs.getX(i1), uvs.getY(i1))
		const uv2 = new Vector2(uvs.getX(i2), uvs.getY(i2))

		const edge1 = v1.clone().sub(v0)
		const edge2 = v2.clone().sub(v0)
		const deltaUV1 = uv1.clone().sub(uv0)
		const deltaUV2 = uv2.clone().sub(uv0)

		const f = 1.0 / (deltaUV1.x * deltaUV2.y - deltaUV2.x * deltaUV1.y)
		const tangent = new Vector3()
		tangent.x = f * (deltaUV2.y * edge1.x - deltaUV1.y * edge2.x)
		tangent.y = f * (deltaUV2.y * edge1.y - deltaUV1.y * edge2.y)
		tangent.z = f * (deltaUV2.y * edge1.z - deltaUV1.y * edge2.z)
		tangent.normalize()

		const bitangent = new Vector3()
		bitangent.x = f * (-deltaUV2.x * edge1.x + deltaUV1.x * edge2.x)
		bitangent.y = f * (-deltaUV2.x * edge1.y + deltaUV1.x * edge2.y)
		bitangent.z = f * (-deltaUV2.x * edge1.z + deltaUV1.x * edge2.z)
		bitangent.normalize()

		const uAxis = tangent.clone()
		const vAxis = bitangent.clone()

		uAxis.sub(normal.clone().multiplyScalar(normal.dot(uAxis))).normalize()
		vAxis.sub(normal.clone().multiplyScalar(normal.dot(vAxis)))
		vAxis.sub(uAxis.clone().multiplyScalar(uAxis.dot(vAxis))).normalize()

		return { uAxis, vAxis }
	}

	public wrappedUVDistance(uv1: Vector2, uv2: Vector2, wrapU: boolean = true): number {
		const dx = wrapU ? this.getWrappedUDistance(uv1.x, uv2.x) : Math.abs(uv1.x - uv2.x)
		const dy = Math.abs(uv1.y - uv2.y)
		return Math.sqrt(dx * dx + dy * dy)
	}

	public getFaceIndexFromUV(geometry: BufferGeometry, targetUV: Vector2): number | null {
		const uvAttribute = geometry.attributes.uv
		if (!uvAttribute || uvAttribute.count === 0) return null

		const index = geometry.index
		const wrappedUV = this.wrapUV(targetUV)

		let closestFace: number | null = null
		let minDistance = Number.POSITIVE_INFINITY

		const triangleCount = index ? index.count / 3 : uvAttribute.count / 3

		for (let face = 0; face < triangleCount; face++) {
			const i0 = index ? index.getX(face * 3) : face * 3
			const i1 = index ? index.getX(face * 3 + 1) : face * 3 + 1
			const i2 = index ? index.getX(face * 3 + 2) : face * 3 + 2

			if (i0 >= uvAttribute.count || i1 >= uvAttribute.count || i2 >= uvAttribute.count) continue

			const uv0 = new Vector2(uvAttribute.getX(i0), uvAttribute.getY(i0))
			const uv1 = new Vector2(uvAttribute.getX(i1), uvAttribute.getY(i1))
			const uv2 = new Vector2(uvAttribute.getX(i2), uvAttribute.getY(i2))

			// ignore uv's from second udim
			if (uv0.x > 1 || uv1.x > 1 || uv2.x > 1) continue

			const centroid = new Vector2((uv0.x + uv1.x + uv2.x) / 3, (uv0.y + uv1.y + uv2.y) / 3)
			const dist = this.wrappedUVDistance(centroid, wrappedUV)

			if (dist < minDistance) {
				minDistance = dist
				closestFace = face
			}
		}

		return closestFace
	}

	public getPositionFromUV(geometry: BufferGeometry, mesh: Mesh, targetUV: Vector2): Vector3 | null {
		const positionAttribute = geometry.attributes.position
		if (!positionAttribute || positionAttribute.count === 0) {
			return null
		}

		const wrappedUV = this.wrapUV(targetUV)
		const closestFace = this.getFaceIndexFromUV(geometry, wrappedUV)
		if (closestFace === null) {
			return null
		}

		const index = geometry.index
		const i0 = index ? index.getX(closestFace * 3) : closestFace * 3
		const i1 = index ? index.getX(closestFace * 3 + 1) : closestFace * 3 + 1
		const i2 = index ? index.getX(closestFace * 3 + 2) : closestFace * 3 + 2

		if (i0 >= positionAttribute.count || i1 >= positionAttribute.count || i2 >= positionAttribute.count) {
			return null
		}

		const p0 = new Vector3(positionAttribute.getX(i0), positionAttribute.getY(i0), positionAttribute.getZ(i0))
		const p1 = new Vector3(positionAttribute.getX(i1), positionAttribute.getY(i1), positionAttribute.getZ(i1))
		const p2 = new Vector3(positionAttribute.getX(i2), positionAttribute.getY(i2), positionAttribute.getZ(i2))

		const uvAttribute = geometry.attributes.uv
		if (!uvAttribute) {
			return null
		}

		const uv0 = new Vector2(uvAttribute.getX(i0), uvAttribute.getY(i0))
		const uv1 = new Vector2(uvAttribute.getX(i1), uvAttribute.getY(i1))
		const uv2 = new Vector2(uvAttribute.getX(i2), uvAttribute.getY(i2))

		const v0 = uv1.clone().sub(uv0)
		const v1 = uv2.clone().sub(uv0)
		const v2 = wrappedUV.clone().sub(uv0)

		const d00 = v0.dot(v0)
		const d01 = v0.dot(v1)
		const d11 = v1.dot(v1)
		const d20 = v2.dot(v0)
		const d21 = v2.dot(v1)

		const denom = d00 * d11 - d01 * d01
		if (Math.abs(denom) < 1e-8) {
			return p0
				.clone()
				.add(p1)
				.add(p2)
				.multiplyScalar(1 / 3)
				.applyMatrix4(mesh.matrixWorld)
		}

		const b = (d11 * d20 - d01 * d21) / denom
		const c = (d00 * d21 - d01 * d20) / denom
		const a = 1 - b - c

		return p0.clone().multiplyScalar(a).addScaledVector(p1, b).addScaledVector(p2, c).applyMatrix4(mesh.matrixWorld)
	}

	public inferSurfaceBasisFromUV(asset: Mesh, uv: Vector2): SurfaceBasis | null {
		const faceIndex = this.getFaceIndexFromUV(asset.geometry, uv)
		if (faceIndex === null) {
			return null
		}

		const positions = asset.geometry.attributes.position
		const indices = asset.geometry.index
		if (!positions || !indices) {
			return null
		}

		const i0 = indices.getX(faceIndex * 3)
		const i1 = indices.getX(faceIndex * 3 + 1)
		const i2 = indices.getX(faceIndex * 3 + 2)

		const v0 = new Vector3(positions.getX(i0), positions.getY(i0), positions.getZ(i0))
		const v1 = new Vector3(positions.getX(i1), positions.getY(i1), positions.getZ(i1))
		const v2 = new Vector3(positions.getX(i2), positions.getY(i2), positions.getZ(i2))

		const edge1 = v1.clone().sub(v0)
		const edge2 = v2.clone().sub(v0)
		const normal = new Vector3().crossVectors(edge1, edge2).normalize().transformDirection(asset.matrixWorld)

		const { uAxis, vAxis } = this.calculateTangentVectors(asset.geometry, faceIndex, normal)

		return { normal, uAxis, vAxis, faceIndex }
	}

	private wrapUV(uv: Vector2): Vector2 {
		return new Vector2(this.wrapU(uv.x), uv.y)
	}

	private wrapU(u: number): number {
		return ((u % 1) + 1) % 1
	}

	private getWrappedUDistance(u1: number, u2: number): number {
		const direct = Math.abs(u1 - u2)
		const wrapped = 1 - direct
		return Math.min(direct, wrapped)
	}
}
