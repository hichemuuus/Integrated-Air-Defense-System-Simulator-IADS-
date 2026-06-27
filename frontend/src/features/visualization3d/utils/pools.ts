export class ObjectPool<T> {
  private pool: T[] = []

  constructor(private factory: () => T, initialSize = 0) {
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory())
    }
  }

  acquire(): T {
    return this.pool.pop() || this.factory()
  }

  release(obj: T): void {
    this.pool.push(obj)
  }

  get size(): number {
    return this.pool.length
  }
}

export class RingBuffer {
  readonly data: Float32Array
  head = 0
  count = 0

  constructor(readonly capacity: number, readonly stride: number) {
    this.data = new Float32Array(capacity * stride)
  }

  push(...values: number[]): void {
    const offset = this.head * this.stride
    for (let i = 0; i < values.length && i < this.stride; i++) {
      this.data[offset + i] = values[i]
    }
    this.head = (this.head + 1) % this.capacity
    if (this.count < this.capacity) this.count++
  }

  fillOrdered(target: Float32Array, targetOffset: number): void {
    const start = this.head - this.count
    const wrapStart = start < 0 ? start + this.capacity : start
    const stride = this.stride

    for (let i = 0; i < this.count; i++) {
      const srcIdx = ((wrapStart + i) % this.capacity) * stride
      const dstIdx = (targetOffset + i) * 3
      target[dstIdx] = this.data[srcIdx]
      target[dstIdx + 1] = this.data[srcIdx + 1]
      target[dstIdx + 2] = this.data[srcIdx + 2]
    }
  }

  clear(): void {
    this.head = 0
    this.count = 0
  }
}
