import { describe, expect, it } from 'vitest';
import { buildAnatomy, silhouettePoints, validateAnatomy } from '../src/core/anatomy';
import { observeFamily } from '../src/core/atlas';
import { axolotlAnatomyFor, validateAxolotlAnatomy } from '../src/core/axolotlAnatomy';
import { axolotlFounderGenome, axolotlGenomeProblem } from '../src/core/axolotlGenetics';
import { GENOME_VERSION, MUTATION_RATE } from '../src/core/catalog';
import { CODEX, CODEX_BY_KEY, codexMatches, discover, emptyCodex } from '../src/core/codex';
import { ALL_CHANNELS, CHANNELS, EXTRA_CHANNELS, isNovel } from '../src/core/genesis';
import { enrichAllele, LEAP_SHARE } from '../src/core/genesis2';
import { express, fingerprint, founderGenome, inherit, modulesOf } from '../src/core/genetics';
import { goldfishFounderGenome, goldfishGenomeProblem } from '../src/core/goldfishGenetics';
import { bodyPlanFor, expressModules, KOI_MODULE_LOCI, latentModules, moduleLoci, somaticFor } from '../src/core/modules';
import { genomeProblem } from '../src/core/registry';
import { commandEnvelope, createRuntime, decodeRuntime, executeCommand } from '../src/core/runtime';
import { decodeSave } from '../src/core/save';
import { applyCommand, createWorld, type Command } from '../src/core/world';
import { drawFish } from '../src/rendering/fish';
import { measureWork } from './support/recordingContext';
import type { CreatureGenome, Fish, Genome, Phenotype, World } from '../src/core/types';

const NOW = '2026-10-17T12:00:00.000Z';
const koiFounders = (n: number, salt = 0) => Array.from({ length: n }, (_, i) => founderGenome(7000 + i * 13 + salt, 4));

describe('Genesis model 2 inheritance', () => {
  it('leaves model 1 inheritance exactly as before', () => {
    const [mother, father] = koiFounders(2);
    for (let seed = 0; seed < 40; seed++) {
      expect(inherit(mother, father, seed, MUTATION_RATE, 4)).toEqual(inherit(mother, father, seed, MUTATION_RATE, 4, undefined, 1));
    }
  });

  it('adds valid module genes to children of every species, deterministically', () => {
    const pairs: [CreatureGenome, CreatureGenome, (g: never) => string | null][] = [
      [founderGenome(11, 4), founderGenome(12, 4), genomeProblem as never],
      [axolotlFounderGenome(21, 2), axolotlFounderGenome(22, 2), axolotlGenomeProblem as never],
      [goldfishFounderGenome(31), goldfishFounderGenome(32), goldfishGenomeProblem as never],
    ];
    for (const [mother, father, problem] of pairs) {
      for (let seed = 0; seed < 30; seed++) {
        const child = inherit(mother, father, seed, MUTATION_RATE, GENOME_VERSION, undefined, 2).genome;
        expect(child.genesis?.model).toBe(2);
        expect(problem(child as never)).toBeNull();
        expect(inherit(mother, father, seed, MUTATION_RATE, GENOME_VERSION, undefined, 2).genome).toEqual(child);
        // The model 1 part of the child is untouched.
        const plain = inherit(mother, father, seed, MUTATION_RATE, GENOME_VERSION).genome;
        expect(child.maternal).toEqual(plain.maternal); expect(child.paternal).toEqual(plain.paternal);
      }
    }
  });

  it('reads latent module genes from older genomes and keeps model 2 fingerprints distinct', () => {
    const founder = founderGenome(5, 4);
    expect(modulesOf(founder)).toEqual(latentModules('koi', fingerprint(founder)));
    const child = inherit(founder, founderGenome(6, 4), 3, MUTATION_RATE, 4, undefined, 2).genome as Genome;
    const swapped = { ...child, genesis: { ...child.genesis!, modules: { maternal: child.genesis!.modules!.maternal.map(a => (a + 1) % 2), paternal: child.genesis!.modules!.paternal } } };
    expect(fingerprint(swapped)).not.toBe(fingerprint(child));
  });

  it('enriches new alleles: leaps, regulatory flips and the new side-effect channels all occur', () => {
    const kinds = { drift: 0, leap: 0, regulatory: 0 }, channels = new Set<string>();
    const base = { locus: 0, parent: 2, value: 2.6, potency: 0.7, effects: {} };
    for (let i = 0; i < 4000; i++) {
      const allele = enrichAllele({ ...base, id: 1000 + i }, 'koi', new Map());
      kinds[allele.kind!]++;
      Object.keys(allele.effects).forEach(channel => channels.add(channel));
      expect(allele.potency).toBeGreaterThan(0); expect(allele.potency).toBeLessThanOrEqual(1.9);
      if (allele.kind === 'leap') expect(Math.abs(allele.value - 2)).toBeGreaterThan(Math.abs(base.value - 2) * 1.9);
    }
    expect(kinds.leap / 4000).toBeCloseTo(LEAP_SHARE, 1);
    expect(kinds.regulatory).toBeGreaterThan(300);
    for (const channel of EXTRA_CHANNELS) expect(channels.has(channel)).toBe(true);
    expect(ALL_CHANNELS.slice(0, CHANNELS.length)).toEqual([...CHANNELS]);
  });
});

describe('Body-plan modules (R-203)', () => {
  it('express rarely in random crosses and much more often in a selected line', () => {
    const founders = koiFounders(60);
    let shown = 0, total = 0, selected = 0;
    for (let i = 0; i < 30; i++) for (let k = 0; k < 40; k++) {
      const child = inherit(founders[i * 2], founders[i * 2 + 1], i * 100 + k, MUTATION_RATE, 4, undefined, 2).genome;
      const m = express(child).genesis!.modules!;
      total++; if (m.secondDorsal || m.wen || m.bubble) shown++;
    }
    // A line fixed for high dorsal-duplication liability.
    const high = (genome: Genome): Genome => ({ ...genome, genesis: { ...genome.genesis!, model: 2, modules: { maternal: [2, 2, 0, 0, 0, 0], paternal: [2, 1, 0, 0, 0, 0] } } });
    for (let k = 0; k < 200; k++) {
      const child = inherit(high(founders[0]), high(founders[1]), 9000 + k, MUTATION_RATE, 4, undefined, 2).genome;
      if (express(child).genesis!.modules!.secondDorsal) selected++;
    }
    expect(shown / total).toBeGreaterThan(0.005); expect(shown / total).toBeLessThan(0.12);
    expect(selected / 200).toBeGreaterThan(0.5);
  });

  it('builds valid koi anatomy with every module at its extremes, inside its bounds', () => {
    const genome = founderGenome(99, 4);
    for (const modules of [[3, 3, 3, 3, 1, 3], [3, 0, 0, 0, 1, 0], [0, 0, 3, 3, 0, 0]]) {
      for (const dev of [1, 2, 3]) {
        const g: Genome = { ...genome, genesis: { ...genome.genesis!, dev, model: 2, modules: { maternal: modules, paternal: modules } } };
        const p = express(g), a = buildAnatomy(p);
        expect(validateAnatomy(a)).toEqual([]);
        for (const point of silhouettePoints(a)) {
          expect(point.x).toBeGreaterThanOrEqual(a.bounds.minX - 1e-9); expect(point.x).toBeLessThanOrEqual(a.bounds.maxX + 1e-9);
          expect(point.y).toBeGreaterThanOrEqual(a.bounds.minY - 1e-9); expect(point.y).toBeLessThanOrEqual(a.bounds.maxY + 1e-9);
        }
        expect(() => measureWork(ctx => drawFish(ctx, p, 7, 120, 0.4, { tailPhase: 1, finPhase: 2, effort: 0.5 }))).not.toThrow();
      }
    }
  });

  it('grows a fourth gill ramus, extra digits and a crest on axolotls', () => {
    const genome = axolotlFounderGenome(41, 2);
    const g = { ...genome, genesis: { ...genome.genesis!, model: 2 as const, modules: { maternal: [1, 3, 3, 1, 3, 3], paternal: [1, 3, 3, 1, 3, 3] } } };
    const p = express(g), m = p.genesis!.modules!;
    expect(m.extraRami).toBe(1); expect(m.polydactyly).toBeGreaterThan(0); expect(m.crest).toBeGreaterThan(0);
    const a = axolotlAnatomyFor(p.axolotl!);
    expect(a.gills).toHaveLength(8);
    expect(validateAxolotlAnatomy(a)).toEqual([]);
    const plan = bodyPlanFor(p);
    expect(plan.find(node => node.kind === 'gill')?.origin).toBe('duplication');
    expect(plan.some(node => node.kind === 'crest')).toBe(true);
    expect(() => measureWork(ctx => drawFish(ctx, p, 3, 140, 0.2, { tailPhase: 1, finPhase: 2, effort: 0.4 }))).not.toThrow();
  });

  it('describes module loci for every species and keeps somatic marks rare and one-off', () => {
    expect(moduleLoci('koi')).toBe(KOI_MODULE_LOCI);
    expect(moduleLoci('goldfish')).toHaveLength(0);
    let marks = 0;
    for (let dev = 0; dev < 5000; dev++) if (somaticFor(dev, 0.5)) marks++;
    expect(marks / 5000).toBeGreaterThan(0.06); expect(marks / 5000).toBeLessThan(0.14);
    expect(expressModules('koi', { maternal: [0, 0, 0, 0, 0, 0], paternal: [0, 0, 0, 0, 0, 0] }, 1, 1).secondDorsal).toBe(0);
  });
});

describe('Codex and world v18', () => {
  const live = () => createWorld(NOW, 4242, GENOME_VERSION);
  const breed = (world: World, count = 24): World => {
    const mother = world.fish.find(f => f.sex === 'F')!, father = world.fish.find(f => f.sex === 'M')!;
    return applyCommand(world, { type: 'breed', motherId: mother.id, fatherId: father.id, tankId: 'tank-2', timestamp: NOW, genomeVersion: GENOME_VERSION, count });
  };

  it('opens live worlds at Genesis model 2 and research worlds at model 1', () => {
    expect(live().genesisModel).toBe(2); expect(createWorld(NOW).genesisModel).toBe(1);
    expect(new Set(CODEX.map(entry => entry.key)).size).toBe(CODEX.length);
  });

  it('credits first discoveries to hatched animals and validates them on load', () => {
    let world = live();
    for (let i = 0; i < 4; i++) world = breed(world, 12);
    const born = world.fish.filter(f => f.generation > 0);
    expect(born.every(f => f.genome.genesis?.model === 2)).toBe(true);
    const expected = discover(emptyCodex(), born, world.circuit.day);
    expect(world.codex).toEqual(expected);
    for (const entry of world.codex.entries) {
      const fish = world.fish.find(f => f.id === entry.fishId)!;
      expect(codexMatches(fish).map(match => match.key)).toContain(entry.key);
      expect(CODEX_BY_KEY.get(entry.key)?.species).toBe(fish.species);
    }
    expect(decodeSave(JSON.stringify(world))).toEqual(world);
    expect(() => decodeSave(JSON.stringify({ ...world, codex: { model: 1, entries: [{ key: 'koi:not-a-thing', fishId: born[0].id, day: 0 }] } }))).toThrow();
  });

  it('replays a model 2 journal byte-identically', () => {
    let runtime = createRuntime(live(), 'g2');
    const run = (payload: Command) => { runtime = executeCommand(runtime, commandEnvelope(runtime, payload)); };
    const mother = runtime.world.fish.find(f => f.sex === 'F')!, father = runtime.world.fish.find(f => f.sex === 'M')!;
    for (let i = 0; i < 3; i++) run({ type: 'breed', motherId: mother.id, fatherId: father.id, tankId: 'tank-2', timestamp: NOW, genomeVersion: GENOME_VERSION, count: 12 });
    const second = runtime.world.fish.filter(f => f.generation === 0 && f.species === 'koi');
    run({ type: 'breed', motherId: second.filter(f => f.sex === 'F')[1].id, fatherId: second.filter(f => f.sex === 'M')[1].id, tankId: 'tank-1', timestamp: NOW, genomeVersion: GENOME_VERSION, count: 8 });
    expect(runtime.world.fish.filter(f => f.generation === 1).every(f => f.genome.genesis?.model === 2)).toBe(true);
    expect(decodeRuntime(JSON.stringify(runtime))).toEqual(runtime);
  });

  it('observes Body plan loci only under model 2', () => {
    const world = live(), mother = world.fish[0], father = world.fish[1];
    const offspring: Fish[] = Array.from({ length: 10 }, (_, i) => ({ ...mother, id: `FSH-9000${i.toString().padStart(2, '0')}`, generation: 1,
      genome: inherit(mother.genome as Genome, father.genome as Genome, i, MUTATION_RATE, 4, undefined, 2).genome }));
    const model1 = observeFamily(world.atlas, mother, father, offspring, false).atlas, model2 = observeFamily(world.atlas, mother, father, offspring, true).atlas;
    expect(model1.koi.evidence.slice(72).every(value => value === 0)).toBe(true);
    expect(model1.koi.evidence.slice(0, 72)).toEqual(model2.koi.evidence.slice(0, 72));
  });

  it('only matches Codex entries to the right species', () => {
    const koi = express(founderGenome(3, 4)) as Phenotype, axolotl = express(axolotlFounderGenome(3, 2));
    for (const entry of CODEX) {
      if (entry.species !== 'koi') expect(entry.test(koi)).toBe(false);
      if (entry.species !== 'axolotl') expect(entry.test(axolotl)).toBe(false);
    }
  });
});

it('novel allele IDs stay above the catalog range under model 2', () => {
  const [mother, father] = koiFounders(2, 5);
  for (let seed = 0; seed < 200; seed++) {
    const { genome, mutations } = inherit(mother, father, seed, 0.05, 4, undefined, 2);
    for (const mutation of mutations) if (isNovel(mutation.to)) expect(genome.genesis!.novel.some(entry => entry.id === mutation.to)).toBe(true);
    expect(genomeProblem(genome as Genome)).toBeNull();
  }
});
