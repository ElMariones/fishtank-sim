import { describe, expect, it } from 'vitest';
import { defaultCare } from '../src/core/care';
import { kinship } from '../src/core/pedigree';
import { random } from '../src/core/random';
import { decodeSave } from '../src/core/save';
import type { Fish, World } from '../src/core/types';
import { defaultWater } from '../src/core/water';
import { applyCommand, createWorld, MAX_LIVING, MAX_RECORDS, MAX_TANKS, TANK_CAPACITY } from '../src/core/world';

const NOW = '2026-09-13T12:00:00.000Z';
const cross = { type: 'breed' as const, motherId: 'FSH-000001', fatherId: 'FSH-000002', tankId: 'tank-1', timestamp: NOW };
const base = createWorld(NOW);
const fishId = (n: number) => `FSH-${String(n).padStart(6, '0')}`;
const make = (n: number, sex: Fish['sex'], parents: readonly [Fish, Fish] | null): Fish => ({
  ...structuredClone(base.fish[0]), id: fishId(n), name: `Fish ${n}`, sex,
  parents: parents ? [parents[0].id, parents[1].id] : null, generation: parents ? Math.max(parents[0].generation, parents[1].generation) + 1 : 0,
});

/** The previous exact tabular method, kept as a reference for pedigrees shallower than the depth cutoff. */
function tabularKinship(fish: Fish[], first: string, second: string): number {
  const sorted = [...fish].sort((a, b) => a.generation - b.generation || a.id.localeCompare(b.id));
  const indices = new Map(sorted.map((f, i) => [f.id, i]));
  const a = sorted.map(() => new Float64Array(sorted.length));
  for (let i = 0; i < sorted.length; i++) {
    const parents = sorted[i].parents;
    const m = parents ? indices.get(parents[0]) : undefined, p = parents ? indices.get(parents[1]) : undefined;
    for (let j = 0; j < i; j++) a[i][j] = a[j][i] = ((m === undefined ? 0 : a[m][j]) + (p === undefined ? 0 : a[p][j])) / 2;
    a[i][i] = 1 + (m === undefined || p === undefined ? 0 : a[m][p] / 2);
  }
  const i = indices.get(first), j = indices.get(second);
  return i === undefined || j === undefined ? 0 : a[i][j] / 2;
}

describe('FS-112 larger lab worlds', () => {
  it('lets sold records grow far past 1,000 up to the record cap', () => {
    const archive = Array.from({ length: MAX_RECORDS - 26 }, (_, i) => ({ ...make(i + 7, i % 2 ? 'M' : 'F', null), status: 'sold' as const }));
    const large: World = { ...base, fish: [...structuredClone(base.fish), ...archive], nextId: MAX_RECORDS - 19 };
    const bred = applyCommand(large, cross);
    expect(bred.fish).toHaveLength(MAX_RECORDS);
    expect(decodeSave(JSON.stringify(bred)).fish).toHaveLength(MAX_RECORDS);
    const before = JSON.stringify(bred);
    expect(() => applyCommand(bred, { ...cross, tankId: 'tank-2' })).toThrow('fish records');
    expect(() => applyCommand(bred, { type: 'buy', tankId: 'tank-2', timestamp: NOW })).toThrow('fish records');
    expect(JSON.stringify(bred)).toBe(before);
  });

  it('caps living fish separately from records, with no partial change when rejected', () => {
    expect(MAX_LIVING).toBe(MAX_TANKS * TANK_CAPACITY);
    // A hypothetical ninth tank isolates the living cap from tank capacity.
    const crowded: World = {
      ...structuredClone(base), nextId: MAX_LIVING - 9,
      tanks: Array.from({ length: MAX_TANKS + 1 }, (_, i) => ({ id: `tank-${i + 1}`, name: `Tank ${i + 1}`, capacity: TANK_CAPACITY, planted: false, water: defaultWater(), care: defaultCare(defaultWater()) })),
      fish: Array.from({ length: MAX_LIVING - 10 }, (_, i) => ({ ...make(i + 1, i % 2 ? 'M' : 'F', null), tankId: `tank-${Math.ceil((i + 1) / TANK_CAPACITY)}` })),
    };
    const before = JSON.stringify(crowded);
    expect(() => applyCommand(crowded, { ...cross, tankId: `tank-${MAX_TANKS + 1}` })).toThrow('living fish');
    expect(JSON.stringify(crowded)).toBe(before);
    const bought = applyCommand(crowded, { type: 'buy', tankId: `tank-${MAX_TANKS + 1}`, timestamp: NOW });
    expect(bought.fish.filter(f => f.status === 'living')).toHaveLength(MAX_LIVING - 9);
    const soldTen = applyCommand(crowded, { type: 'sell-batch', fishIds: crowded.fish.slice(0, 10).map(f => f.id) });
    const soldOneMore = applyCommand(soldTen, { type: 'sell', fishId: crowded.fish[10].id });
    expect(applyCommand(soldOneMore, { ...cross, motherId: crowded.fish[12].id, fatherId: crowded.fish[13].id, tankId: `tank-${MAX_TANKS + 1}` }).fish.filter(f => f.status === 'living')).toHaveLength(MAX_LIVING - 1);
  });

  it('matches the exact tabular kinship on a random, deep and inbred pedigree', () => {
    const rng = random(2026);
    const fish: Fish[] = Array.from({ length: 20 }, (_, i) => make(i + 1, i % 2 ? 'M' : 'F', null));
    while (fish.length < 300) {
      const recent = (sex: Fish['sex']) => { const group = fish.filter(f => f.sex === sex); return group[group.length - 1 - Math.floor(rng() * Math.min(group.length, 8))]; };
      fish.push(make(fish.length + 1, rng() < 0.5 ? 'F' : 'M', [recent('F'), recent('M')]));
    }
    for (let trial = 0; trial < 250; trial++) {
      const a = fish[Math.floor(rng() * fish.length)], b = fish[Math.floor(rng() * fish.length)];
      expect(kinship(fish, a.id, b.id)).toBeCloseTo(tabularKinship(fish, a.id, b.id), 12);
    }
  });

  it('keeps exact deep ancestry without allocating a world-sized matrix', () => {
    const line: Fish[] = [make(1, 'F', null), make(2, 'M', null)];
    let [sister, brother] = line;
    for (let generation = 1; generation <= 300; generation++) {
      const next = [make(line.length + 1, 'F', [sister, brother]), make(line.length + 2, 'M', [sister, brother])] as const;
      line.push(...next);
      [sister, brother] = next;
    }
    let started = performance.now();
    expect(kinship(line, sister.id, brother.id)).toBeGreaterThan(0.99);
    expect(kinship(line, line[2].id, line[3].id)).toBe(0.25);
    expect(performance.now() - started).toBeLessThan(250);
    expect(kinship(line, sister.id, line[0].id)).toBeCloseTo(0.25, 12);

    const wide: Fish[] = Array.from({ length: MAX_RECORDS }, (_, i) => make(i + 1, i % 2 ? 'M' : 'F', null));
    wide.push(make(MAX_RECORDS + 1, 'F', [wide[0], wide[1]]), make(MAX_RECORDS + 2, 'M', [wide[0], wide[1]]));
    started = performance.now();
    expect(kinship(wide, fishId(MAX_RECORDS + 1), fishId(MAX_RECORDS + 2))).toBe(0.25);
    expect(kinship(wide, fishId(100), fishId(201))).toBe(0);
    expect(performance.now() - started).toBeLessThan(250);
  });
});
