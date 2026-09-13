import { describe, expect, it } from 'vitest';
import { LOCI } from '../src/core/catalog';
import { express, fingerprint, founderGenome, inherit } from '../src/core/genetics';
import { kinship } from '../src/core/pedigree';
import { decodeSave } from '../src/core/save';
import type { Fish, Genome } from '../src/core/types';
import { applyCommand, createWorld, quote } from '../src/core/world';
import { createActor, stepMotion } from '../src/simulation/motion';
import { COHORT_VISUAL_FIXTURES, EXTREME_VISUAL_FIXTURES, FOUNDER_VISUAL_FIXTURES, VISUAL_DESCRIPTORS, VISUAL_FIXTURE_REPORT } from '../src/core/visualFixtures';
import { hash } from '../src/core/random';

const NOW = '2026-09-13T12:00:00.000Z';
const uniform = (maternal: number, paternal = maternal): Genome => ({ version: 1, maternal: Array(48).fill(maternal), paternal: Array(48).fill(paternal) });
const cross = { type: 'breed' as const, motherId: 'FSH-000001', fatherId: 'FSH-000002', tankId: 'tank-1', timestamp: NOW };

describe('genetics invariants', () => {
  it('replays founders, offspring, mutations and phenotype exactly from seed', () => {
    const m = founderGenome(51), f = founderGenome(13);
    expect(founderGenome(51)).toEqual(m);
    const a = inherit(m, f, 12), b = inherit(m, f, 12);
    expect(a).toEqual(b);
    expect(express(a.genome)).toEqual(express(b.genome));
    expect(fingerprint(a.genome)).toBe(fingerprint(b.genome));
  });

  it('takes each copy from the correct parent and never modifies parents', () => {
    const m = founderGenome(19), f = founderGenome(24), before = JSON.stringify([m, f]);
    for (let seed = 0; seed < 500; seed++) {
      const child = inherit(m, f, seed, 0);
      LOCI.forEach((_, i) => {
        expect([m.maternal[i], m.paternal[i]]).toContain(child.genome.maternal[i]);
        expect([f.maternal[i], f.paternal[i]]).toContain(child.genome.paternal[i]);
      });
      expect(child.mutations).toHaveLength(0);
    }
    expect(JSON.stringify([m, f])).toBe(before);
  });

  it('follows Mendelian 1:2:1 segregation in a seeded 10000-child sample', () => {
    const parent = uniform(0, 5), counts = [0, 0, 0];
    for (let seed = 0; seed < 10000; seed++) {
      const { genome } = inherit(parent, parent, seed, 0);
      counts[(genome.maternal[47] + genome.paternal[47]) / 5]++;
    }
    [0.25, 0.5, 0.25].forEach((expected, i) => expect(Math.abs(counts[i] / 10000 - expected)).toBeLessThan(0.02));
    expect(express(uniform(0, 5)).metallic).toBeLessThan(1);
    expect(express(uniform(5)).metallic).toBe(1);
  });

  it('preserves linked phase with the configured boundary switch frequency', () => {
    const parent = uniform(0, 5);
    let switches = 0;
    for (let seed = 0; seed < 10000; seed++) {
      const { genome } = inherit(parent, parent, seed, 0);
      if (genome.maternal[0] !== genome.maternal[1]) switches++;
    }
    expect(Math.abs(switches / 10000 - 0.12)).toBeLessThan(0.02);
  });

  it('logs every forced mutation and clamps boundary transitions without no-ops', () => {
    for (const value of [0, 2, 5]) {
      const result = inherit(uniform(value), uniform(value), 90, 1);
      expect(result.mutations).toHaveLength(96);
      for (const mutation of result.mutations) {
        expect(mutation.to).not.toBe(mutation.from);
        expect(result.genome[mutation.copy][mutation.locus]).toBe(mutation.to);
        expect(mutation.to).toBeGreaterThanOrEqual(0);
        expect(mutation.to).toBeLessThanOrEqual(5);
      }
    }
  });

  it('produces finite positive anatomy from extremes and varied founders', () => {
    const genomes = [uniform(0), uniform(5), uniform(0, 5), ...Array.from({ length: 1000 }, (_, i) => founderGenome(i))];
    for (const genome of genomes) {
      const p = express(genome), { markings, ...numeric } = p;
      expect(Object.values(numeric).every(Number.isFinite)).toBe(true);
      expect(markings.length).toBeGreaterThanOrEqual(6);
      expect(markings.length).toBeLessThanOrEqual(12);
      expect(markings.every(m => [m.u, m.v, m.size, m.angle, m.priority].every(Number.isFinite) && m.u > 0 && m.u < 1 && Math.abs(m.v) < 1)).toBe(true);
      expect(p.length).toBeGreaterThan(0); expect(p.depth).toBeGreaterThan(0);
      expect(p.speed).toBeGreaterThan(0);
    }
  });

  it('makes a longer tail slower when all other alleles are held constant', () => {
    const short = uniform(2), long = uniform(2);
    long.maternal[12] = 5; long.paternal[12] = 5;
    short.maternal[12] = 0; short.paternal[12] = 0;
    expect(express(long).speed).toBeLessThan(express(short).speed);
  });

  it('responds to ten generations of selection for a deeper body', () => {
    let pool = Array.from({ length: 100 }, (_, i) => founderGenome(i + 40));
    const mean = (genomes: Genome[]) => genomes.reduce((sum, g) => sum + express(g).depth, 0) / genomes.length;
    const start = mean(pool);
    for (let gen = 0; gen < 10; gen++) {
      const parents = [...pool].sort((a, b) => express(b).depth - express(a).depth).slice(0, 10);
      pool = Array.from({ length: 100 }, (_, i) => inherit(parents[i % 10], parents[(i + 3) % 10], gen * 1000 + i, 0.003).genome);
    }
    expect(mean(pool) - start).toBeGreaterThan(0.08);
  });
});

describe('pedigree', () => {
  const founders = createWorld(NOW).fish;
  const child = (id: string, mother: Fish, father: Fish, sex: Fish['sex'] = 'F'): Fish => ({
    ...founders[0], id, parents: [mother.id, father.id], sex, generation: Math.max(mother.generation, father.generation) + 1,
  });
  const sister = child('child-a', founders[0], founders[1]);
  const brother = child('child-b', founders[0], founders[1], 'M');
  const half = child('child-c', founders[0], founders[3]);
  const cousin1 = child('cousin-a', sister, founders[5]);
  const cousin2 = child('cousin-b', founders[2], brother);
  const family = [...founders, sister, brother, half, cousin1, cousin2];

  it('calculates unrelated, self, sibling, half sibling, parent and cousin kinship', () => {
    expect(kinship(family, founders[0].id, founders[1].id)).toBe(0);
    expect(kinship(family, sister.id, sister.id)).toBe(0.5);
    expect(kinship(family, sister.id, brother.id)).toBe(0.25);
    expect(kinship(family, sister.id, half.id)).toBe(0.125);
    expect(kinship(family, sister.id, founders[0].id)).toBe(0.25);
    expect(kinship(family, cousin1.id, cousin2.id)).toBe(0.0625);
  });

  it('retains relationships when ancestors are sold and input order differs', () => {
    const archived = family.map(f => ({ ...f, status: 'sold' as const })).reverse();
    expect(kinship(archived, cousin1.id, cousin2.id)).toBe(0.0625);
  });
});

describe('world commands and persistence', () => {
  it('creates 20 unique offspring with immutable parents and increasing generations', () => {
    const original = createWorld(NOW), next = applyCommand(original, cross);
    expect(original.fish).toHaveLength(6); expect(next.fish).toHaveLength(26);
    expect(new Set(next.fish.map(f => f.id)).size).toBe(26);
    next.fish.slice(6).forEach(f => { expect(f.parents).toEqual([cross.motherId, cross.fatherId]); expect(f.generation).toBe(1); });
    expect(decodeSave(JSON.stringify(next))).toEqual(next);
  });

  it('rejects a full-cohort overflow without partial births', () => {
    const world = applyCommand(applyCommand(createWorld(NOW), cross), cross);
    const before = JSON.stringify(world);
    expect(() => applyCommand(world, cross)).toThrow('free places');
    expect(JSON.stringify(world)).toBe(before);
    expect(world.fish).toHaveLength(46);
  });

  it('rejects invalid parents and permits repeat generations in accelerated lab mode', () => {
    const world = createWorld(NOW);
    expect(() => applyCommand(world, { ...cross, fatherId: cross.motherId })).toThrow();
    const next = applyCommand(world, cross);
    const m = next.fish.slice(6).find(f => f.sex === 'F')!, f = next.fish.slice(6).find(f => f.sex === 'M')!;
    const generation2 = applyCommand(next, { ...cross, motherId: m.id, fatherId: f.id, tankId: 'tank-2' });
    expect(generation2.fish.at(-1)!.generation).toBe(2);
  });

  it('archives a sale once, retains its genome and prevents further breeding or payment', () => {
    const world = applyCommand(createWorld(NOW), cross), fish = world.fish[0];
    const next = applyCommand(world, { type: 'sell', fishId: fish.id });
    expect(next.credits).toBe(world.credits + quote(fish));
    expect(next.fish[0].genome).toEqual(fish.genome);
    expect(next.fish[6].parents![0]).toBe(fish.id);
    expect(() => applyCommand(next, { type: 'sell', fishId: fish.id })).toThrow();
    expect(() => applyCommand(next, cross)).toThrow();
    expect(decodeSave(JSON.stringify(next))).toEqual(next);
  });

  it('sells a reviewed batch atomically and rejects any invalid member without partial sales', () => {
    const world = applyCommand(createWorld(NOW), cross);
    const members = world.fish.slice(6, 10), ids = members.map(f => f.id);
    const sold = applyCommand(world, { type: 'sell-batch', fishIds: ids });
    expect(sold.credits).toBe(world.credits + members.reduce((sum, f) => sum + quote(f), 0));
    expect(sold.fish.filter(f => ids.includes(f.id)).every(f => f.status === 'sold')).toBe(true);
    expect(sold.fish.filter(f => ids.includes(f.id)).map(f => [f.genome, f.parents])).toEqual(members.map(f => [f.genome, f.parents]));
    expect(sold.fish.filter(f => f.status === 'sold')).toHaveLength(4);
    expect(world.fish.every(f => f.status === 'living')).toBe(true);
    expect(decodeSave(JSON.stringify(sold))).toEqual(sold);
    const before = JSON.stringify(sold), living = sold.fish[12].id;
    for (const fishIds of [[], [living, living], [living, ids[0]], [living, 'FSH-999999']]) {
      expect(() => applyCommand(sold, { type: 'sell-batch', fishIds })).toThrow();
    }
    expect(JSON.stringify(sold)).toBe(before);
  });

  it('moves and renames without altering identity, genome or pedigree', () => {
    const world = createWorld(NOW);
    const moved = applyCommand(world, { type: 'move', fishId: world.fish[0].id, tankId: 'tank-2' });
    const renamed = applyCommand(moved, { type: 'rename', fishId: world.fish[0].id, name: '  Ember  ' });
    expect(renamed.fish[0].name).toBe('Ember');
    expect(renamed.fish[0].tankId).toBe('tank-2');
    expect(renamed.fish[0].genome).toEqual(world.fish[0].genome);
    expect(() => applyCommand(world, { type: 'rename', fishId: world.fish[0].id, name: ' ' })).toThrow();
    expect(() => applyCommand(world, { type: 'move', fishId: world.fish[0].id, tankId: 'missing' })).toThrow();
  });

  it('deducts NPC purchase funds and cannot profit by instant resale', () => {
    const world = createWorld(NOW);
    const bought = applyCommand(world, { type: 'buy', tankId: 'tank-2', timestamp: NOW });
    expect(bought.credits).toBe(world.credits - 250);
    expect(bought.fish.at(-1)!.parents).toBeNull();
    const sold = applyCommand(bought, { type: 'sell', fishId: bought.fish.at(-1)!.id });
    expect(sold.credits).toBeLessThan(world.credits);
    expect(() => applyCommand({ ...world, credits: 0 }, { type: 'buy', tankId: 'tank-1', timestamp: NOW })).toThrow();
  });

  it('rejects malformed saves, duplicate IDs, missing tanks, cycles and invalid alleles', () => {
    const world = applyCommand(createWorld(NOW), cross);
    const invalid = [
      { ...world, version: 2 },
      { ...world, nextId: 1 },
      { ...world, fish: [...world.fish, world.fish[0]] },
      { ...world, tanks: [] },
    ];
    invalid.forEach(data => expect(() => decodeSave(JSON.stringify(data))).toThrow());
    const badAllele = structuredClone(world); badAllele.fish[0].genome.maternal[0] = 9;
    expect(() => decodeSave(JSON.stringify(badAllele))).toThrow();
    const cycle = structuredClone(world); cycle.fish[0].parents = [cycle.fish[6].id, cycle.fish[1].id];
    expect(() => decodeSave(JSON.stringify(cycle))).toThrow();
    expect(() => decodeSave('{oops')).toThrow();
  });
});

describe('fixed-step motion', () => {
  it('replays finite bounded positions after prolonged movement and food attraction', () => {
    const initial = createWorld(NOW).fish.map(createActor);
    function run() {
      let actors = structuredClone(initial);
      for (let tick = 0; tick < 2000; tick++) actors = stepMotion(actors, tick * 0.05, tick < 100 ? { x: 0.5, y: 0.2, remaining: 1 } : null);
      return actors;
    }
    const a = run(); expect(a).toEqual(run());
    a.forEach(actor => {
      expect(Number.isFinite(actor.vx + actor.vy + actor.x + actor.y)).toBe(true);
      expect(actor.x).toBeGreaterThanOrEqual(0.08); expect(actor.x).toBeLessThanOrEqual(0.92);
      expect(actor.y).toBeGreaterThanOrEqual(0.12); expect(actor.y).toBeLessThanOrEqual(0.88);
    });
  });
});

describe('FS-101 visual fixtures', () => {
  it('pins founder, cohort and extreme identities to a versioned deterministic baseline', () => {
    expect(VISUAL_FIXTURE_REPORT.fixtureVersion).toBe(1);
    expect(FOUNDER_VISUAL_FIXTURES.map(fixture => [fixture.id, fixture.birthSeed, fixture.genomeFingerprint])).toEqual([
      ['FSH-000001', 47017952, 'C27C49D6'], ['FSH-000002', 97350809, 'CA682453'],
      ['FSH-000003', 80573190, 'AFBCAA66'], ['FSH-000004', 130906047, 'C71392BD'],
      ['FSH-000005', 114128428, '8D3D1E0A'], ['FSH-000006', 164461285, '52583B8E'],
    ]);
    expect(COHORT_VISUAL_FIXTURES.map(cohort => [
      cohort.id, cohort.seed, cohort.children.length,
      hash(cohort.children.map(child => child.genomeFingerprint).join(',')).toString(16).padStart(8, '0').toUpperCase(),
    ])).toEqual([['cross-a', 101001, 20, 'BD215114'], ['cross-b', 101002, 20, '39528E26']]);
    expect(EXTREME_VISUAL_FIXTURES.map(fixture => [fixture.id, fixture.birthSeed, fixture.genomeFingerprint])).toEqual([
      ['extreme-needle', 201001, '4E05DD5B'], ['extreme-disk', 201002, '9186E69B'],
      ['extreme-dome', 201003, 'F1AE3CEB'], ['extreme-fan', 201004, 'E3EF315B'],
      ['extreme-face', 201005, 'A53F929B'], ['extreme-fork', 201006, '78F597E3'],
    ]);
    expect(COHORT_VISUAL_FIXTURES.map(cohort => ['length', 'depth', 'head', 'eye', 'tail', 'spread', 'frequency', 'patternScale'].map(key =>
      Number(cohort.descriptors[key as keyof typeof cohort.descriptors].mean.toFixed(6)),
    ))).toEqual([
      [0.47, 0.38, 0.241839, 0.52, 0.19987, 0.47, 0.576923, 0.32],
      [0.355, 0.305, 0.171871, 0.49, 0.413698, 0.305, 0.5, 0.35],
    ]);
  });

  it('keeps every declared descriptor finite and normalized for every fixture', () => {
    const fixtures = [...FOUNDER_VISUAL_FIXTURES, ...COHORT_VISUAL_FIXTURES.flatMap(cohort => cohort.children), ...EXTREME_VISUAL_FIXTURES];
    for (const fixture of fixtures) {
      for (const { key } of VISUAL_DESCRIPTORS) {
        expect(Number.isFinite(fixture.normalized[key])).toBe(true);
        expect(fixture.normalized[key]).toBeGreaterThanOrEqual(0);
        expect(fixture.normalized[key]).toBeLessThanOrEqual(1);
      }
    }
  });
});
