export type Point = { x: number; y: number };

/** Rebuilt from the immutable frame snapshot. Queries retain source order for stable steering sums/ties. */
export class SpatialHash<T extends Point> {
  private readonly cells = new Map<string, { item: T; index: number }[]>();
  constructor(items: readonly T[], private readonly cellSize: number) {
    if (!Number.isFinite(cellSize) || cellSize <= 0) throw new Error('Invalid spatial cell size.');
    items.forEach((item, index) => {
      const key = this.key(Math.floor(item.x / cellSize), Math.floor(item.y / cellSize));
      const bucket = this.cells.get(key) ?? [];
      bucket.push({ item, index });
      this.cells.set(key, bucket);
    });
  }
  private key(x: number, y: number) { return `${x}:${y}`; }
  /** Broad-phase candidates only; callers apply their exact distance test. */
  query(point: Point, radius: number): T[] {
    const result: { item: T; index: number }[] = [];
    for (let x = Math.floor((point.x - radius) / this.cellSize); x <= Math.floor((point.x + radius) / this.cellSize); x++) {
      for (let y = Math.floor((point.y - radius) / this.cellSize); y <= Math.floor((point.y + radius) / this.cellSize); y++) {
        const bucket = this.cells.get(this.key(x, y));
        if (bucket) result.push(...bucket);
      }
    }
    return result.sort((a, b) => a.index - b.index).map(entry => entry.item);
  }
}
