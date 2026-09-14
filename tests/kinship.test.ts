import { describe, expect, it } from 'vitest';
import { advanceWorld } from '../src/core/habitat';
import { createKinshipCache, kinship, UNRELATED_FOUNDERS, type FounderAssumption } from '../src/core/pedigree';
import { random } from '../src/core/random';
import type { Fish } from '../src/core/types';
import { TICKS_PER_GAME_DAY } from '../src/core/water';
import { applyCommand, createWorld } from '../src/core/world';

const NOW = '2026-09-13T12:00:00.000Z';
const base = createWorld(NOW);
const fishId = (n: number) => `FSH-${String(n).padStart(6, '0')}`;
const make = (n: number, sex: Fish['sex'], parents: readonly [Fish, Fish] | null): Fish => ({
  ...base.fish[0], id: fishId(n), name: `Fish ${n}`, sex,
  parents: parents ? [parents[0].id, parents[1].id] : null, generation: parents ? Math.max(parents[0].generation, parents[1].generation) + 1 : 0,
});

/**
 * Reference: the numerator relationship matrix built row by row. Founders and unrecorded parents form a base population
 * with relationship 2 × coancestry between different members and 1 + inbreeding on the diagonal.
 */
function tabularKinship(fish: readonly Fish[], assumption: FounderAssumption, first: string, second: string): number {
  const sorted = [...fish].sort((a, b) => a.generation - b.generation || a.id.localeCompare(b.id));
  const index = new Map(sorted.map((f, i) => [f.id, i]));
  const founderRelationship = 2 * assumption.coancestry, a = sorted.map(() => new Float64Array(sorted.length));
  for (let i = 0; i < sorted.length; i++) {
    const parents = sorted[i].parents;
    const m = parents ? index.get(parents[0]) : undefined, p = parents ? index.get(parents[1]) : undefined;
    for (let j = 0; j < i; j++) {
      a[i][j] = a[j][i] = parents
        ? ((m === undefined ? founderRelationship : a[m][j]) + (p === undefined ? founderRelationship : a[p][j])) / 2 : founderRelationship;
    }
    a[i][i] = parents ? 1 + (m === undefined || p === undefined ? founderRelationship : a[m][p]) / 2 : 1 + assumption.inbreeding;
  }
  const i = index.get(first), j = index.get(second);
  return i === undefined || j === undefined ? assumption.coancestry : a[i][j] / 2;
}

/** Parents drawn from the most recent ten of each sex, so lines inbreed. */
function randomPedigree(seed: number, size: number): Fish[] {
  const rng = random(seed);
  const fish: Fish[] = Array.from({ length: 12 }, (_, i) => make(i + 1, i % 2 ? 'M' : 'F', null));
  while (fish.length < size) {
    const recent = (sex: Fish['sex']) => { const group = fish.filter(f => f.sex === sex); return group[group.length - 1 - Math.floor(rng() * Math.min(group.length, 10))]; };
    fish.push(make(fish.length + 1, rng() < 0.5 ? 'F' : 'M', [recent('F'), recent('M')]));
  }
  return fish;
}

function siblingLine(generations: number): Fish[] {
  const line: Fish[] = [make(1, 'F', null), make(2, 'M', null)];
  for (let generation = 1; generation <= generations; generation++) {
    const [sister, brother] = line.slice(-2);
    line.push(make(line.length + 1, 'F', [sister, brother]), make(line.length + 2, 'M', [sister, brother]));
  }
  return line;
}

describe('FS-405 kinship reference fixtures', () => {
  it('reproduces textbook relationships with unrelated founders', () => {
    const [a, b, c, d, e, g, h, i] = [make(1, 'F', null), make(2, 'M', null), make(3, 'F', null), make(4, 'M', null), make(5, 'F', null), make(6, 'M', null), make(7, 'F', null), make(8, 'M', null)];
    const sister = make(11, 'F', [a, b]), brother = make(12, 'M', [a, b]), halfSister = make(13, 'F', [a, d]), halfBrother = make(14, 'M', [a, d]);
    const otherSister = make(15, 'F', [c, d]), otherBrother = make(16, 'M', [c, d]);
    const cousinA = make(21, 'F', [sister, d]), cousinB = make(22, 'M', [c, brother]);
    const doubleA = make(23, 'F', [sister, otherBrother]), doubleB = make(24, 'M', [otherSister, brother]);
    const halfCousinA = make(25, 'F', [sister, i]), halfCousinB = make(26, 'M', [h, halfBrother]);
    const secondA = make(31, 'F', [cousinA, g]), secondB = make(32, 'M', [e, cousinB]);
    const inbred = make(33, 'F', [sister, brother]);
    const fish = [a, b, c, d, e, g, h, i, sister, brother, halfSister, halfBrother, otherSister, otherBrother, cousinA, cousinB, doubleA, doubleB, halfCousinA, halfCousinB, secondA, secondB, inbred];
    const cache = createKinshipCache([...fish].reverse());
    const cases: [string, Fish, Fish, number][] = [
      ['unrelated founders', a, b, 0], ['self, not inbred', sister, sister, 0.5], ['parent and offspring', a, sister, 0.25],
      ['full siblings', sister, brother, 0.25], ['half siblings', sister, halfSister, 0.125], ['grandparent and grandchild', a, cousinA, 0.125],
      ['aunt or uncle and niece', brother, cousinA, 0.125], ['first cousins', cousinA, cousinB, 0.0625], ['double first cousins', doubleA, doubleB, 0.125],
      ['half first cousins', halfCousinA, halfCousinB, 0.03125], ['second cousins', secondA, secondB, 0.015625], ['self, full-sib offspring', inbred, inbred, 0.625],
    ];
    for (const [label, first, second, expected] of cases) {
      expect([label, cache.kinship(first.id, second.id), cache.kinship(second.id, first.id)]).toEqual([label, expected, expected]);
      expect(kinship(fish, first.id, second.id)).toBe(expected);
    }
    expect([cache.inbreeding(inbred.id), cache.inbreeding(sister.id), cache.inbreeding(a.id), cache.inbreeding('FSH-999999')]).toEqual([0.25, 0, 0, 0]);
  });

  it("follows Wright's recurrences for continued full-sib mating and backcrossing to one sire", () => {
    const line = siblingLine(12), cache = createKinshipCache(line);
    const expected = [0, 0];
    for (let t = 2; t <= 12; t++) expected.push((1 + 2 * expected[t - 1] + expected[t - 2]) / 4);
    for (let t = 1; t <= 12; t++) expect(cache.inbreeding(line[2 * t].id)).toBeCloseTo(expected[t], 14);
    expect(expected.slice(2, 7)).toEqual([0.25, 0.375, 0.5, 0.59375, 0.671875]);

    const sire = make(1, 'M', null), dam = make(2, 'F', null), daughters = [make(3, 'F', [dam, sire])];
    for (let t = 1; t < 10; t++) daughters.push(make(3 + t, 'F', [daughters[t - 1], sire]));
    const backcross = createKinshipCache([sire, dam, ...daughters]);
    let previous = 0;
    daughters.forEach((daughter, t) => {
      const value = t === 0 ? 0 : (previous + 0.5) / 2;
      expect(backcross.inbreeding(daughter.id)).toBeCloseTo(value, 14);
      previous = value;
    });
    expect(backcross.inbreeding(daughters[3].id)).toBe(0.4375);
  });

  it('applies an explicit founder assumption as a base population, matching the tabular matrix', () => {
    const related: FounderAssumption = { coancestry: 0.1, inbreeding: 0.1 };
    const [m, p, q, r] = [make(1, 'F', null), make(2, 'M', null), make(3, 'F', null), make(4, 'M', null)];
    const sister = make(5, 'F', [m, p]), brother = make(6, 'M', [m, p]), unrelated = make(7, 'M', [q, r]);
    const cache = createKinshipCache([m, p, q, r, sister, brother, unrelated], related);
    expect([cache.kinship(m.id, p.id), cache.kinship(m.id, m.id), cache.inbreeding(m.id)]).toEqual([0.1, 0.55, 0.1]);
    expect(cache.kinship(sister.id, brother.id)).toBeCloseTo(0.325, 14);
    expect(cache.kinship(sister.id, unrelated.id)).toBeCloseTo(0.1, 14);
    expect(cache.inbreeding(sister.id)).toBe(0.1);

    const rng = random(405), dropped = new Set([fishId(20), fishId(150)]);
    const fish = randomPedigree(405, 300).filter(f => !dropped.has(f.id));
    for (const assumption of [UNRELATED_FOUNDERS, related, { coancestry: 0.05, inbreeding: 0 }]) {
      const tested = createKinshipCache(fish, assumption);
      for (let trial = 0; trial < 200; trial++) {
        const first = fish[Math.floor(rng() * fish.length)].id, second = trial % 5 ? fish[Math.floor(rng() * fish.length)].id : first;
        expect(tested.kinship(first, second)).toBeCloseTo(tabularKinship(fish, assumption, first, second), 12);
      }
      expect(tested.kinship(fishId(20), fishId(21))).toBe(assumption.coancestry);
    }
    for (const invalid of [{ coancestry: -0.1, inbreeding: 0 }, { coancestry: 0, inbreeding: 1 }, { coancestry: 0.6, inbreeding: 0 }, { coancestry: Number.NaN, inbreeding: 0 }]) {
      expect(() => createKinshipCache([], invalid)).toThrow('Founder assumption is out of range.');
    }
  });

  it('names the founders and unrecorded parents whose relatedness is assumed', () => {
    const hatched = advanceWorld(applyCommand(base, { type: 'breed', motherId: fishId(1), fatherId: fishId(2), tankId: 'tank-2', timestamp: NOW }), 0, 4 * TICKS_PER_GAME_DAY);
    const brood = hatched.fish.filter(f => f.parents), daughter = brood.find(f => f.sex === 'F')!, son = brood.find(f => f.sex === 'M')!;
    const inbred = applyCommand(hatched, { type: 'breed', motherId: daughter.id, fatherId: son.id, tankId: 'tank-2', timestamp: NOW });
    const bought = applyCommand(applyCommand(inbred, { type: 'sell', fishId: fishId(2) }), { type: 'buy', tankId: 'tank-1', timestamp: NOW });
    const grandchild = bought.fish.find(f => f.generation === 2)!, newcomer = bought.fish.at(-1)!;
    const cache = createKinshipCache(bought.fish);
    expect([cache.inbreeding(grandchild.id), cache.kinship(grandchild.id, newcomer.id), cache.inbreeding(newcomer.id)]).toEqual([0.25, 0, 0]);
    expect(cache.founders([grandchild.id, newcomer.id])).toEqual({ founders: [fishId(1), fishId(2), newcomer.id], missing: [] });
    expect(cache.founders(['', fishId(1)])).toEqual({ founders: [fishId(1)], missing: [] });
    const orphaned = createKinshipCache(bought.fish.filter(f => f.id !== fishId(2)));
    expect(orphaned.founders([grandchild.id])).toEqual({ founders: [fishId(1)], missing: [fishId(2)] });
    // Without Sumi's record the siblings share only their recorded mother, so the link through their father is invisible.
    const orphans = bought.fish.filter(f => f.id !== fishId(2)), [mother, father] = grandchild.parents!;
    expect(orphaned.inbreeding(grandchild.id)).toBe(0.125);
    expect(orphaned.inbreeding(grandchild.id)).toBeCloseTo(tabularKinship(orphans, UNRELATED_FOUNDERS, mother, father), 14);
  });
});

describe('FS-405 incremental cache', () => {
  it('keeps computed pairs as the world grows, so a new generation costs a handful of pairs', () => {
    const line = siblingLine(240), grown = siblingLine(241);
    const cache = createKinshipCache(line.slice(0, -2));
    for (let t = 1; t < 240; t++) cache.inbreeding(line[2 * t].id);
    expect(cache.sync(line)).toBe(false);
    const before = cache.stats();
    expect(cache.inbreeding(line.at(-2)!.id)).toBe(kinship(line, line.at(-4)!.id, line.at(-3)!.id));
    expect(cache.sync(grown)).toBe(false);
    const afterSync = cache.stats();
    expect([afterSync.records, afterSync.resets, afterSync.entries >= before.entries]).toEqual([grown.length, 0, true]);

    const newest = grown.at(-2)!.id, value = cache.inbreeding(newest), incremental = cache.stats().computed - afterSync.computed;
    const fresh = createKinshipCache(grown);
    expect(fresh.inbreeding(newest)).toBe(value);
    expect(incremental).toBeLessThanOrEqual(12);
    expect(fresh.stats().computed).toBeGreaterThan(20 * incremental);
    const repeated = cache.stats().computed;
    expect(cache.kinship(grown.at(-4)!.id, grown.at(-3)!.id)).toBe(value);
    expect(cache.stats().computed).toBe(repeated);
  });

  it('rebuilds only when recorded history changes, and stays exact when full', () => {
    const fish = randomPedigree(4050, 260), cache = createKinshipCache(fish);
    const rng = random(4051), pairs = Array.from({ length: 150 }, () => [fish[Math.floor(rng() * fish.length)].id, fish[Math.floor(rng() * fish.length)].id] as const);
    const values = pairs.map(([first, second]) => cache.kinship(first, second));
    const entries = cache.stats().entries;

    expect(cache.sync(fish)).toBe(false);
    expect(cache.sync(fish.map(member => ({ ...member, name: `${member.name}!`, status: 'sold' as const })))).toBe(false);
    expect(cache.stats()).toMatchObject({ entries, resets: 0 });

    const target = fish.findIndex(member => member.generation >= 3);
    const tampered = fish.map((member, i) => i === target ? { ...member, parents: [fish[0].id, fish[1].id] as [string, string], generation: 1 } : member);
    expect(cache.sync(tampered)).toBe(true);
    pairs.forEach(([first, second]) => expect(cache.kinship(first, second)).toBeCloseTo(tabularKinship(tampered, UNRELATED_FOUNDERS, first, second), 12));
    expect(cache.sync(fish.slice(0, 100))).toBe(true);
    expect(cache.sync([...fish.slice(0, 100), fish[0]])).toBe(true);
    expect(cache.stats()).toMatchObject({ records: 100, resets: 3 });

    const small = createKinshipCache(fish, UNRELATED_FOUNDERS, 40);
    pairs.forEach(([first, second], i) => expect(small.kinship(first, second)).toBe(values[i]));
    expect(small.stats().clears).toBeGreaterThan(0);
  });
});
