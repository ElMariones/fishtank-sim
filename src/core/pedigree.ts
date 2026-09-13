import type { Fish } from './types';

/** Tabular numerator relationship matrix. Unknown founders assumed unrelated, non-inbred. */
export function kinship(fish: Fish[], first: string, second: string): number {
  const sorted = [...fish].sort((a, b) => a.generation - b.generation || a.id.localeCompare(b.id));
  const indices = new Map(sorted.map((f, i) => [f.id, i]));
  const a = sorted.map(() => new Float64Array(sorted.length));
  for (let i = 0; i < sorted.length; i++) {
    const parents = sorted[i].parents;
    const m = parents ? indices.get(parents[0]) : undefined;
    const p = parents ? indices.get(parents[1]) : undefined;
    for (let j = 0; j < i; j++) a[i][j] = a[j][i] = ((m === undefined ? 0 : a[m][j]) + (p === undefined ? 0 : a[p][j])) / 2;
    a[i][i] = 1 + (m === undefined || p === undefined ? 0 : a[m][p] / 2);
  }
  const i = indices.get(first), j = indices.get(second);
  return i === undefined || j === undefined ? 0 : a[i][j] / 2;
}
