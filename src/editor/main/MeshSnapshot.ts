import { BufferGeometry, Mesh, Quaternion, Vector3 } from 'three'

export interface MeshSnapshot {
	geometry: BufferGeometry
	position: Vector3
	quaternion: Quaternion
	scale: Vector3
}

/** Captures a mesh's current geometry + transform so it can be restored later (e.g. reverting a wrap). */
export function snapshotMesh(mesh: Mesh): MeshSnapshot {
	return {
		geometry: mesh.geometry.clone(),
		position: mesh.position.clone(),
		quaternion: mesh.quaternion.clone(),
		scale: mesh.scale.clone(),
	}
}

/** Restores a mesh to a previously captured snapshot. The snapshot's geometry is cloned so it stays reusable. */
export function applyMeshSnapshot(mesh: Mesh, snapshot: MeshSnapshot): void {
	mesh.geometry.dispose()
	mesh.geometry = snapshot.geometry.clone()
	mesh.position.copy(snapshot.position)
	mesh.quaternion.copy(snapshot.quaternion)
	mesh.scale.copy(snapshot.scale)
}
