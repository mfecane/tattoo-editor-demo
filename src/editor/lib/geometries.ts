import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Quaternion, Vector3 } from 'three'

// it's okay let's keep it, it may be useful
export class BentTubeGeometry extends BufferGeometry {
	constructor(radius: number = 0.2, segments: number = 32, curveSegments: number = 64) {
		super()

		const vertices: number[] = []
		const normals: number[] = []
		const uvs: number[] = []
		const indices: number[] = []

		const points: Vector3[] = []
		const height = 4
		const irregularity = 0.2

		for (let i = 0; i <= 5; i++) {
			const t = i / 5
			const y = t * height
			const x = Math.sin(t * Math.PI * 1.5) * irregularity
			const z = Math.cos(t * Math.PI * 1.3) * irregularity
			points.push(new Vector3(x, y, z))
		}

		const curve = new CatmullRomCurve3(points)

		const curvePoints = curve.getPoints(curveSegments)
		const tangents: Vector3[] = []

		for (let i = 0; i < curvePoints.length; i++) {
			const t = i / (curvePoints.length - 1)
			const tangent = curve.getTangent(t).normalize()
			tangents.push(tangent)
		}

		// Improved parallel transport for consistent orientation without twisting
		interface Frame {
			right: Vector3
			up: Vector3
		}
		const frames: Frame[] = []

		const referenceDir = new Vector3(1, 0, 0)

		for (let i = 0; i < curvePoints.length; i++) {
			const tangent = tangents[i]

			let right: Vector3, up: Vector3

			if (i === 0) {
				const worldX = new Vector3(1, 0, 0)
				const worldY = new Vector3(0, 1, 0)

				const projX = worldX.clone().sub(worldX.clone().multiplyScalar(worldX.dot(tangent)))

				if (projX.length() < 0.01) {
					const projY = worldY.clone().sub(worldY.clone().multiplyScalar(worldY.dot(tangent)))
					if (projY.length() > 0.01) {
						right = projY.normalize()
					} else {
						right = new Vector3(1, 0, 0)
					}
				} else {
					right = projX.normalize()
				}

				right = new Vector3().crossVectors(tangent, right)
				if (right.length() < 0.01) {
					right = new Vector3(1, 0, 0)
					right = new Vector3().crossVectors(tangent, right)
				}
				right.normalize()

				up = new Vector3().crossVectors(tangent, right).normalize()
			} else {
				const prevTangent = tangents[i - 1]
				const prevRight = frames[i - 1].right
				const prevUp = frames[i - 1].up

				const dot = Math.max(-1, Math.min(1, prevTangent.dot(tangent)))
				const angle = Math.acos(dot)

				if (angle > 0.0001) {
					const axis = new Vector3().crossVectors(prevTangent, tangent)
					if (axis.length() > 0.0001) {
						axis.normalize()

						const quaternion = new Quaternion().setFromAxisAngle(axis, angle)
						right = prevRight.clone().applyQuaternion(quaternion)
						up = prevUp.clone().applyQuaternion(quaternion)
					} else {
						right = prevRight.clone()
						up = prevUp.clone()
					}
				} else {
					right = prevRight.clone()
					up = prevUp.clone()
				}

				right = new Vector3().crossVectors(up, tangent).normalize()
				if (right.length() < 0.01) {
					const altUp = new Vector3(0, 1, 0)
					right = new Vector3().crossVectors(altUp, tangent).normalize()
					if (right.length() < 0.01) {
						right = new Vector3(1, 0, 0)
					}
				}
				up = new Vector3().crossVectors(tangent, right).normalize()
			}

			frames.push({ right, up })
		}

		for (let i = 0; i < curvePoints.length; i++) {
			const point = curvePoints[i]
			const frame = frames[i]
			const right = frame.right
			const up = frame.up

			const t = i / (curvePoints.length - 1)
			const taperFactor = 1 - t * 0.3
			const currentRadius = radius * taperFactor

			for (let j = 0; j <= segments; j++) {
				const angle = (j / segments) * Math.PI * 2
				const cos = Math.cos(angle)
				const sin = Math.sin(angle)

				const offset = new Vector3()
				offset.addScaledVector(right, cos * currentRadius)
				offset.addScaledVector(up, sin * currentRadius)

				const vertex = point.clone().add(offset)
				vertices.push(vertex.x, vertex.y, vertex.z)

				const normal = offset.clone().normalize()
				normals.push(normal.x, normal.y, normal.z)

				const u = j / segments
				const v = i / (curvePoints.length - 1)
				uvs.push(u, v)
			}
		}

		for (let i = 0; i < curvePoints.length - 1; i++) {
			for (let j = 0; j < segments; j++) {
				const current = i * (segments + 1) + j
				const next = i * (segments + 1) + j + 1
				const currentNext = (i + 1) * (segments + 1) + j
				const nextNext = (i + 1) * (segments + 1) + j + 1

				indices.push(current, next, currentNext)
				indices.push(next, nextNext, currentNext)
			}
		}

		this.setAttribute('position', new Float32BufferAttribute(vertices, 3))
		this.setAttribute('normal', new Float32BufferAttribute(normals, 3))
		this.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
		this.setIndex(indices)
		this.computeBoundingSphere()
	}
}
