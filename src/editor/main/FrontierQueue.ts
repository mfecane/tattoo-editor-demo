interface FrontierEntry {
	readonly vertexIndex: number
	readonly distance: number
}

/**
 * Binary min-heap of (vertex, distance) frontier entries, keyed on running distance-to-origin
 * estimate - the priority queue behind LiveFrontierMarcher's live march. A vertex can be pushed
 * more than once as neighbors relax its estimate downward; stale entries are left in the heap
 * rather than removed (no decrease-key) and are simply skipped on pop once the vertex is placed.
 */
export class FrontierQueue {
	private readonly entries: FrontierEntry[] = []

	public push(vertexIndex: number, distance: number): void {
		this.entries.push({ vertexIndex, distance })
		this.bubbleUp(this.entries.length - 1)
	}

	public popMin(): FrontierEntry | null {
		if (this.entries.length === 0) {
			return null
		}
		const min = this.entries[0]
		const last = this.entries.pop() as FrontierEntry
		if (this.entries.length > 0) {
			this.entries[0] = last
			this.bubbleDown(0)
		}
		return min
	}

	private bubbleUp(i: number): void {
		while (i > 0) {
			const parent = (i - 1) >> 1
			if (this.entries[parent].distance <= this.entries[i].distance) {
				break
			}
			;[this.entries[parent], this.entries[i]] = [this.entries[i], this.entries[parent]]
			i = parent
		}
	}

	private bubbleDown(i: number): void {
		const count = this.entries.length
		for (;;) {
			const left = i * 2 + 1
			const right = i * 2 + 2
			let smallest = i
			if (left < count && this.entries[left].distance < this.entries[smallest].distance) {
				smallest = left
			}
			if (right < count && this.entries[right].distance < this.entries[smallest].distance) {
				smallest = right
			}
			if (smallest === i) {
				break
			}
			;[this.entries[smallest], this.entries[i]] = [this.entries[i], this.entries[smallest]]
			i = smallest
		}
	}
}
