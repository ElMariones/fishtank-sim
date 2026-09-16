import { describe, expect, it } from 'vitest';
import { APPEARANCE_BASELINE, APPEARANCE_FOUNDER_WEIGHTS } from '../src/core/appearance';
import { APPEARANCE_LOCI, CHROMOSOMES, CROSSOVER_RATE, FOUNDER_WEIGHTS, GENOME_LOCI, LOCI, MUTATION_RATE, STRUCTURE_LOCI } from '../src/core/catalog';
import { express, founderGenome, inherit } from '../src/core/genetics';
import { advanceRuntime, commandEnvelope, createRuntime, decodeRuntime, executeCommand } from '../src/core/runtime';
import { allelesAt, genomeProblem, lociFor, LOCUS_REGISTRY } from '../src/core/registry';
import { hash, random } from '../src/core/random';
import { decodeSave } from '../src/core/save';
import { LISTING_GENOME } from '../src/core/shop';
import {
  describeStructure, expressStructure, STANDARD_STRUCTURE, STRUCTURAL_MUTATION_RATE, STRUCTURE_BASELINE, STRUCTURE_OFFSET,
} from '../src/core/structure';
import type { Genome, Mutation, World } from '../src/core/types';
import { TICKS_PER_GAME_DAY } from '../src/core/water';
import { applyCommand, createWorld, WORLD_VERSION } from '../src/core/world';

const NOW = '2026-09-17T12:00:00.000Z';
const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;

/** The genome v2 inheritance exactly as it was written before the registry, kept here as the reference. */
function legacyInherit(mother: Genome, father: Genome, seed: number, mutationRate: number, version: 1 | 2) {
  const mutations: Mutation[] = [];
  const transmit = (rng: () => number, count: number, offset: number, allele: (homolog: 0 | 1, index: number) => number, copy: Mutation['copy']) => {
    let side: 0 | 1 = 0;
    return Array.from({ length: count }, (_, i) => {
      if (i % 6 === 0) side = rng() < 0.5 ? 0 : 1;
      else if (rng() < CROSSOVER_RATE) side = side ? 0 : 1;
      const from = allele(side, i);
      if (rng() >= mutationRate) return from;
      const to = from === 0 ? 1 : from === 5 ? 4 : from + (rng() < 0.5 ? -1 : 1);
      mutations.push({ locus: offset + i, copy, from, to });
      return to;
    });
  };
  const core = (parent: Genome) => (homolog: 0 | 1, i: number) => (homolog === 0 ? parent.maternal : parent.paternal)[i];
  const rng = random(seed);
  const maternal = transmit(rng, LOCI.length, 0, core(mother), 'maternal');
  const paternal = transmit(rng, LOCI.length, 0, core(father), 'paternal');
  if (version === 1) return { genome: { version, maternal, paternal }, mutations };
  const appended = (parent: Genome) => (homolog: 0 | 1, i: number) =>
    parent.version === 1 ? APPEARANCE_BASELINE[i] : (homolog === 0 ? parent.maternal : parent.paternal)[LOCI.length + i];
  const stream = random(hash(`appearance-v2:birth:${seed}`));
  maternal.push(...transmit(stream, APPEARANCE_LOCI.length, LOCI.length, appended(mother), 'maternal'));
  paternal.push(...transmit(stream, APPEARANCE_LOCI.length, LOCI.length, appended(father), 'paternal'));
  return { genome: { version, maternal, paternal }, mutations };
}

const withStructure = (genome: Genome, maternal: number[], paternal = maternal): Genome =>
  ({ version: 3, maternal: [...genome.maternal.slice(0, 60), ...maternal], paternal: [...genome.paternal.slice(0, 60), ...paternal] });

describe('FS-601 locus registry', () => {
  it('defines every locus in stable order with valid founder weights, labels, baselines and mutation targets', () => {
    expect(LOCUS_REGISTRY.map(entry => entry.id)).toEqual([...GENOME_LOCI]);
    expect(LOCUS_REGISTRY.map(entry => entry.index)).toEqual(GENOME_LOCI.map((_, i) => i));
    expect(CHROMOSOMES).toHaveLength(11);
    expect(lociFor(1)).toHaveLength(48); expect(lociFor(2)).toHaveLength(60); expect(lociFor(3)).toHaveLength(66);
    for (const entry of LOCUS_REGISTRY) {
      expect(entry.chromosomeName).toBe(CHROMOSOMES[entry.chromosome - 1]);
      expect(entry.sinceGenome).toBe(entry.index < 48 ? 1 : entry.index < 60 ? 2 : 3);
      expect(close(entry.alleles.reduce((sum, allele) => sum + allele.founderWeight, 0), 1)).toBe(true);
      expect(entry.alleles.map(allele => allele.id)).toEqual(entry.alleles.map((_, i) => i));
      if (entry.sinceGenome === 1) expect(entry.baseline).toBeNull();
      else expect(entry.baseline).toBeLessThan(entry.alleles.length);
      for (const allele of entry.alleles) {
        expect(allele.label.length).toBeGreaterThan(0);
        expect(close(allele.mutationTargets.reduce((sum, target) => sum + target.weight, 0), 1)).toBe(true);
        for (const target of allele.mutationTargets) { expect(target.allele).not.toBe(allele.id); expect(target.allele).toBeLessThan(entry.alleles.length); }
      }
    }
    // The registry reproduces the constants genome v1 and v2 were built on.
    expect(LOCUS_REGISTRY.slice(0, 48).every(entry => entry.alleles.map(a => a.founderWeight).join() === FOUNDER_WEIGHTS.join() && entry.mutationRate === MUTATION_RATE)).toBe(true);
    APPEARANCE_LOCI.forEach((locus, i) => {
      const entry = LOCUS_REGISTRY[48 + i];
      expect([entry.alleles.map(a => a.founderWeight), entry.baseline]).toEqual([[...APPEARANCE_FOUNDER_WEIGHTS[locus]], APPEARANCE_BASELINE[i]]);
    });
    const structural = LOCUS_REGISTRY.slice(60);
    expect(structural.map(entry => entry.id)).toEqual([...STRUCTURE_LOCI]);
    expect(structural.map(entry => entry.baseline)).toEqual([...STRUCTURE_BASELINE]);
    expect(structural.filter(entry => entry.mutationRate === STRUCTURAL_MUTATION_RATE).map(entry => entry.id)).toEqual(['tail_topology', 'dorsal_form', 'barbel_count']);
    expect(structural.map(entry => entry.alleles.length)).toEqual([3, 6, 6, 3, 4, 6]);
  });

  it('reaches every supported structural allele from the baseline through mutation steps', () => {
    for (const entry of LOCUS_REGISTRY.slice(60)) {
      const seen = new Set([entry.baseline!]), queue = [entry.baseline!];
      while (queue.length) for (const target of entry.alleles[queue.shift()!].mutationTargets) if (!seen.has(target.allele)) { seen.add(target.allele); queue.push(target.allele); }
      expect(seen.size).toBe(entry.alleles.length);
    }
    // A crown-four tail only arises from a paired fan, and six barbels only from four.
    expect(LOCUS_REGISTRY[60].alleles[0].mutationTargets.map(t => t.allele)).toEqual([1]);
    expect(LOCUS_REGISTRY[64].alleles[0].mutationTargets.map(t => t.allele)).toEqual([1, 2]);
  });

  it('keeps every genome v1 and v2 birth identical to the pre-registry code', () => {
    const rng = random(601);
    for (let trial = 0; trial < 300; trial++) {
      const version = trial % 3 === 0 ? 1 : 2, rate = [0, MUTATION_RATE, 0.3][trial % 3];
      const mother = founderGenome(Math.floor(rng() * 1e9), trial % 4 === 0 ? 1 : version), father = founderGenome(Math.floor(rng() * 1e9), version);
      const seed = Math.floor(rng() * 4294967295);
      if (version === 1 && (mother.version !== 1 || father.version !== 1)) continue;
      expect(inherit(mother, father, seed, rate, version)).toEqual(legacyInherit(mother, father, seed, rate, version));
    }
  });

  it('adds genome v3 without changing the first 60 loci, and older parents transmit the structure baseline', () => {
    for (let seed = 0; seed < 200; seed++) {
      const v2 = founderGenome(seed, 2), v3 = founderGenome(seed, 3);
      expect([v3.maternal.slice(0, 60), v3.paternal.slice(0, 60)]).toEqual([v2.maternal, v2.paternal]);
      expect(genomeProblem(v3)).toBeNull();
      const mother = founderGenome(seed + 1000, 2), father = founderGenome(seed + 2000, 2);
      const asV2 = inherit(mother, father, seed, 0.2, 2), asV3 = inherit(mother, father, seed, 0.2, 3);
      expect([asV3.genome.maternal.slice(0, 60), asV3.genome.paternal.slice(0, 60)]).toEqual([asV2.genome.maternal, asV2.genome.paternal]);
      expect(asV3.mutations.filter(m => m.locus < 60)).toEqual(asV2.mutations);
      const noMutation = inherit(mother, father, seed, 0, 3);
      expect([noMutation.genome.maternal.slice(60), noMutation.genome.paternal.slice(60)]).toEqual([[...STRUCTURE_BASELINE], [...STRUCTURE_BASELINE]]);
    }
    expect(() => inherit(founderGenome(1, 3), founderGenome(2, 3), 5, 0, 2)).toThrow('genome v2 child');
  });

  it('mutates structure loci at the structural rate, only to supported neighbours, and replays exactly', () => {
    const standard = withStructure(founderGenome(3, 3), [...STRUCTURE_BASELINE]);
    const counts = { tail: 0, tailCopies: 0, lobe: 0 };
    for (let seed = 0; seed < 20_000; seed++) {
      const { genome, mutations } = inherit(standard, standard, seed);
      counts.tailCopies += 2;
      for (const mutation of mutations.filter(m => m.locus >= 60)) {
        if (mutation.locus === 60) { counts.tail++; expect([mutation.from, mutation.to]).toEqual([0, 1]); }
        if (mutation.locus === 61) counts.lobe++;
        expect(genome[mutation.copy][mutation.locus]).toBe(mutation.to);
      }
    }
    // 40,000 copies: about 40 structural and 120 small-effect mutations are expected.
    expect(counts.tail).toBeGreaterThan(20); expect(counts.tail).toBeLessThan(65);
    expect(counts.lobe).toBeGreaterThan(85); expect(counts.lobe).toBeLessThan(160);
    expect(inherit(standard, standard, 77)).toEqual(inherit(standard, standard, 77));
  });

  it('keeps older fish on their original expression and expresses structure only from genome v3', () => {
    for (let seed = 0; seed < 300; seed++) {
      const v2 = founderGenome(seed, 2), v1 = founderGenome(seed, 1), baseline = withStructure(v2, [...STRUCTURE_BASELINE]);
      expect(expressStructure(v1)).toBe(STANDARD_STRUCTURE);
      expect(expressStructure(v2)).toBe(STANDARD_STRUCTURE);
      // A genome v3 record with baseline structure alleles expresses exactly what the same genome v2 record did.
      expect(express(baseline)).toEqual(express(v2));
      expect(allelesAt(v2, 'tail_topology')).toEqual([0, 0]);
      expect(allelesAt(v1, 'base_color')).toEqual([0, 0]);
    }
    const base = founderGenome(9, 3);
    const s = (maternal: number[], paternal: number[]) => expressStructure(withStructure(base, maternal, paternal));
    // tail, lobe, spread, dorsal, barbels, rays
    expect(s([1, 2, 2, 0, 0, 2], [0, 2, 2, 0, 0, 2]).tail).toBe('standard');
    expect(s([1, 2, 2, 0, 0, 2], [1, 2, 2, 0, 0, 2]).tail).toBe('paired');
    expect(s([2, 2, 2, 0, 0, 2], [1, 2, 2, 0, 0, 2]).tail).toBe('paired');
    expect(s([2, 5, 5, 2, 0, 5], [2, 5, 5, 2, 0, 5])).toEqual({ tail: 'crown', lobeBalance: expect.closeTo(1.3, 9), spread: 1, dorsal: 'absent', barbels: 2, rays: expect.closeTo(1.36, 9) });
    expect(s([0, 0, 0, 1, 2, 0], [0, 0, 0, 2, 2, 0])).toMatchObject({ lobeBalance: expect.closeTo(0.8, 9), spread: 0, dorsal: 'reduced', barbels: 4, rays: expect.closeTo(0.76, 9) });
    expect([s([0, 2, 2, 0, 1, 2], [0, 2, 2, 0, 1, 2]).barbels, s([0, 2, 2, 0, 3, 2], [0, 2, 2, 0, 3, 2]).barbels, s([0, 2, 2, 0, 2, 2], [0, 2, 2, 0, 3, 2]).barbels, s([0, 2, 2, 0, 1, 2], [0, 2, 2, 0, 2, 2]).barbels]).toEqual([0, 6, 4, 2]);
    const carrier = describeStructure(withStructure(base, [1, 2, 2, 0, 0, 2], [0, 2, 2, 1, 0, 2]));
    expect(carrier.map(row => [row.value, row.carrier])).toEqual([['Standard single tail', true], ['Normal', true], ['2', false]]);
    // Founders carry topology variants rarely and almost never express them.
    let carriers = 0, expressed = 0;
    for (let seed = 0; seed < 10_000; seed++) {
      const genome = founderGenome(seed, 3), pair = allelesAt(genome, 'tail_topology');
      if (pair.some(allele => allele !== 0)) carriers++;
      if (expressStructure(genome).tail !== 'standard') expressed++;
    }
    expect(carriers).toBeGreaterThan(40); expect(carriers).toBeLessThan(130); expect(expressed).toBeLessThanOrEqual(2);
  });

  it('validates genome v3 records against the registry in saves', () => {
    const world = createWorld(NOW);
    expect(world.fish.every(fish => fish.genome.version === 3)).toBe(true);
    expect(decodeSave(JSON.stringify(world))).toEqual(world);
    const bad = (mutate: (copy: World) => void) => { const copy = structuredClone(world); mutate(copy); return () => decodeSave(JSON.stringify(copy)); };
    expect(bad(copy => { copy.fish[0].genome.maternal[STRUCTURE_OFFSET] = 3; })).toThrow('not supported at tail_topology');
    expect(bad(copy => { copy.fish[0].genome.paternal[STRUCTURE_OFFSET + 4] = 4; })).toThrow('not supported at barbel_count');
    expect(bad(copy => { copy.fish[0].genome.maternal.pop(); })).toThrow();
    expect(bad(copy => { copy.fish[0].mutations = [{ locus: 66, copy: 'maternal', from: 0, to: 1 }]; })).toThrow();
    expect(bad(copy => { copy.shop.model = 1; })).toThrow('shop model');
    expect(bad(copy => { copy.shop.listings[0].genome = founderGenome(4, 1); })).toThrow('shop model');
  });

  it('migrates world v9 saves and runtimes: old genomes stay, the shop moves to genome v3 stock only after the rebase', () => {
    // A world v9 as FS-504 recorded it: genome v2 founders and a shop model 1 with genome v2 listings.
    const asV9 = (world: World) => ({ ...world, version: 9 });
    let v9: World = createWorld(NOW, 481516, 2);
    v9 = { ...v9, shop: { ...v9.shop, model: 1, listings: v9.shop.listings.map(listing => ({ ...listing, genome: { ...listing.genome, version: 2 as const, maternal: listing.genome.maternal.slice(0, 60), paternal: listing.genome.paternal.slice(0, 60) } })) } };
    const decoded = decodeSave(JSON.stringify(asV9(v9)));
    expect(decoded).toEqual({ ...v9, version: WORLD_VERSION });
    expect(Object.keys(decoded)).toEqual(Object.keys(decodeSave(JSON.stringify(createWorld(NOW)))));

    let runtime = createRuntime(decoded, 'fs601-v9');
    runtime = executeCommand(runtime, commandEnvelope(runtime, { type: 'pair', motherId: 'FSH-000001', fatherId: 'FSH-000002', nurseryId: 'tank-2', size: 8, timestamp: NOW, genomeVersion: 2 }, 100));
    runtime = advanceRuntime(runtime, 7 * TICKS_PER_GAME_DAY);
    // Deliveries recorded under shop model 1 are genome v2, and replay must reproduce them.
    expect(runtime.world.shop.listings.every(listing => listing.genome.version === 2)).toBe(true);
    const stored = JSON.parse(JSON.stringify(runtime));
    stored.world.version = 9; stored.checkpoint.world.version = 9;
    const rebased = decodeRuntime(JSON.stringify(stored));
    expect(rebased.world.fish).toEqual(runtime.world.fish);
    expect(rebased.world.fish.every(fish => fish.genome.version === 2)).toBe(true);
    expect([rebased.world.shop.model, rebased.world.shop.listings]).toEqual([2, runtime.world.shop.listings]);
    expect(rebased.events).toHaveLength(0);
    const later = advanceRuntime(rebased, rebased.tick + 12 * TICKS_PER_GAME_DAY);
    expect(later.world.shop.listings.some(listing => listing.genome.version === 3)).toBe(true);
    expect(later.world.shop.listings.every(listing => listing.genome.version === LISTING_GENOME[2] || runtime.world.shop.listings.some(old => old.id === listing.id))).toBe(true);
    expect(decodeRuntime(JSON.stringify(later))).toEqual(later);
    // Old parents breed genome v3 children that carry the structure baseline and express standard anatomy.
    const bred = applyCommand(later.world, { type: 'breed', motherId: 'FSH-000003', fatherId: 'FSH-000004', tankId: 'tank-1', timestamp: NOW, genomeVersion: 3 });
    const children = bred.fish.slice(-20);
    expect(children.every(fish => fish.genome.version === 3 && fish.parents !== null)).toBe(true);
    expect(children.filter(fish => fish.mutations.every(m => m.locus < 60)).every(fish => fish.genome.maternal.slice(60).join() === STRUCTURE_BASELINE.join())).toBe(true);
    expect(decodeSave(JSON.stringify(bred))).toEqual(bred);
  });
});
