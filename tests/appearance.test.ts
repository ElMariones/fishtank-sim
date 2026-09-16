import { describe, expect, it } from 'vitest';
import { anatomyFor } from '../src/core/anatomy';
import {
  APPEARANCE_BASELINE, APPEARANCE_FOUNDER_WEIGHTS, appearanceFeatures, CARRIER_STRENGTH, CLASSIC_APPEARANCE, describeAppearance, expressAppearance, MIXED_STRENGTH,
} from '../src/core/appearance';
import { ALL_LOCI, APPEARANCE_LOCI, LOCI, type AppearanceLocus } from '../src/core/catalog';
import { express, founderGenome, inherit } from '../src/core/genetics';
import { buildOrnament, isEmptyOrnament, type OrnamentShape } from '../src/core/ornament';
import { commandEnvelope, createRuntime, decodeRuntime, executeCommand } from '../src/core/runtime';
import { decodeSave } from '../src/core/save';
import type { Genome, Phenotype } from '../src/core/types';
import { APPEARANCE_VISUAL_FIXTURES, appearanceFounderSurvey } from '../src/core/visualFixtures';
import { applyCommand, createWorld } from '../src/core/world';

const NOW = '2026-09-13T12:00:00.000Z';
const indexOf = (locus: AppearanceLocus) => LOCI.length + APPEARANCE_LOCI.indexOf(locus);
function withAlleles(base: Genome, alleles: Partial<Record<AppearanceLocus, [number, number]>>): Genome {
  const genome: Genome = { version: 2, maternal: [...base.maternal.slice(0, LOCI.length), ...APPEARANCE_BASELINE], paternal: [...base.paternal.slice(0, LOCI.length), ...APPEARANCE_BASELINE] };
  for (const [locus, [maternal, paternal]] of Object.entries(alleles) as [AppearanceLocus, [number, number]][]) {
    genome.maternal[indexOf(locus)] = maternal;
    genome.paternal[indexOf(locus)] = paternal;
  }
  return genome;
}
const withoutAppearance = (p: Phenotype) => { const copy: Partial<Phenotype> = { ...p }; delete copy.appearance; return copy; };

describe('FS-113 genome v2 appearance', () => {
  it('leaves every genome v1 locus, mutation and phenotype unchanged for a seed', () => {
    for (let seed = 0; seed < 300; seed++) {
      const v1 = founderGenome(seed, 1), v2 = founderGenome(seed, 2);
      expect(v2.maternal.slice(0, LOCI.length)).toEqual(v1.maternal);
      expect(v2.paternal.slice(0, LOCI.length)).toEqual(v1.paternal);
      expect([v2.maternal.length, v2.paternal.length]).toEqual([ALL_LOCI.length, ALL_LOCI.length]);
      const mother = founderGenome(seed + 1000, 1), father = founderGenome(seed + 2000, 1);
      const before = inherit(mother, father, seed, 0.02, 1), after = inherit(mother, father, seed, 0.02, 2);
      expect(after.genome.maternal.slice(0, LOCI.length)).toEqual(before.genome.maternal);
      expect(after.genome.paternal.slice(0, LOCI.length)).toEqual(before.genome.paternal);
      expect(after.mutations.filter(mutation => mutation.locus < LOCI.length)).toEqual(before.mutations);
      expect(withoutAppearance(express(after.genome))).toEqual(withoutAppearance(express(before.genome)));
    }
  });

  it('reads genome v1 fish as classic and lets their offspring stay classic without mutation', () => {
    const v1 = founderGenome(7, 1);
    expect(expressAppearance(v1)).toEqual(CLASSIC_APPEARANCE);
    expect(appearanceFeatures(CLASSIC_APPEARANCE)).toEqual([]);
    expect(describeAppearance(v1).every(row => row.rarity === null)).toBe(true);
    const child = inherit(v1, founderGenome(8, 1), 99, 0, 2);
    expect(child.genome.version).toBe(2);
    expect(child.genome.maternal.slice(LOCI.length)).toEqual(APPEARANCE_BASELINE);
    expect(expressAppearance(child.genome)).toEqual(CLASSIC_APPEARANCE);
    expect(isEmptyOrnament(buildOrnament(express(child.genome), 99, anatomyFor(express(child.genome))))).toBe(true);
    expect(() => inherit(child.genome, v1, 1, 0, 1)).toThrow('genome v1 child');
  });

  it('transmits Color and Ornament alleles from each parent homolog', () => {
    const mother = founderGenome(31, 2), father = founderGenome(32, 2);
    for (let seed = 0; seed < 300; seed++) {
      const { genome } = inherit(mother, father, seed, 0);
      for (let i = LOCI.length; i < ALL_LOCI.length; i++) {
        expect([mother.maternal[i], mother.paternal[i]]).toContain(genome.maternal[i]);
        expect([father.maternal[i], father.paternal[i]]).toContain(genome.paternal[i]);
      }
    }
  });

  it('expresses dominance, blends, carriers and recessive scales independently of phase', () => {
    const base = founderGenome(5, 1);
    for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) {
      const loci = Object.fromEntries(APPEARANCE_LOCI.map(locus => [locus, [a, b]])) as Record<AppearanceLocus, [number, number]>;
      const swapped = Object.fromEntries(APPEARANCE_LOCI.map(locus => [locus, [b, a]])) as Record<AppearanceLocus, [number, number]>;
      const appearance = expressAppearance(withAlleles(base, loci));
      expect(expressAppearance(withAlleles(base, swapped))).toEqual(appearance);
      if (a === 0 || b === 0) {
        expect([appearance.base, appearance.accent, appearance.iris]).toEqual([['classic'], ['classic'], ['natural']]);
        expect(appearance.scales).toBe('smooth');
        expect(appearance.patches).toBe(1);
        expect(appearance.motifs.map(m => m.strength)).toEqual(a === b ? [] : [CARRIER_STRENGTH]);
      } else {
        expect(appearance.base).toHaveLength(a === b ? 1 : 2);
        expect(appearance.patches).toBe(0);
        expect(appearance.motifs.map(m => m.strength)).toEqual(a === b ? [1] : [MIXED_STRENGTH, MIXED_STRENGTH]);
        expect(appearance.scales).not.toBe('smooth');
      }
      if (a === 5 || b === 5) expect(appearance.dots).toEqual(['rainbow']);
    }
  });

  it('shows a new feature in about one founder in four, with striking variants under 1%', () => {
    for (const weights of Object.values(APPEARANCE_FOUNDER_WEIGHTS)) expect(weights.reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1, 9);
    const survey = appearanceFounderSurvey(10_000, 'fs-113:test');
    expect(survey.anyFeature).toBeGreaterThan(0.2);
    expect(survey.anyFeature).toBeLessThan(0.34);
    expect(survey.features['body pattern']).toBeGreaterThan(0.05);
    for (const share of Object.values(survey.striking)) expect(share).toBeLessThan(0.01);
    expect(survey.striking.Rosettes).toBeGreaterThan(0);
  });

  it('describes variants with founder-stock rarity', () => {
    const [spots, , carrier] = APPEARANCE_VISUAL_FIXTURES;
    expect(describeAppearance(spots.genome).find(row => row.trait === 'Body pattern')).toMatchObject({ value: 'Fine spots', rarity: 'very rare' });
    expect(describeAppearance(carrier.genome).find(row => row.trait === 'Body pattern')).toMatchObject({ value: 'Faint tiger stripes over classic patches', rarity: 'uncommon' });
    const rosettes = APPEARANCE_VISUAL_FIXTURES.find(fixture => fixture.id === 'appearance-rosettes')!;
    expect(describeAppearance(rosettes.genome).find(row => row.trait === 'Body color')).toMatchObject({ value: 'Gold', rarity: 'rare' });
  });

  it('stores genome v1 and v2 fish together and rejects mismatched genome shapes', () => {
    const legacy = createWorld(NOW, 481516, 1);
    const bred = applyCommand(applyCommand(legacy, { type: 'breed', motherId: 'FSH-000001', fatherId: 'FSH-000002', tankId: 'tank-2', timestamp: NOW, genomeVersion: 2 }), { type: 'buy', tankId: 'tank-1', timestamp: NOW, genomeVersion: 2 });
    expect(bred.fish.slice(0, 6).map(fish => fish.genome)).toEqual(legacy.fish.map(fish => fish.genome));
    expect(bred.fish.slice(6).every(fish => fish.genome.version === 2 && fish.genome.maternal.length === ALL_LOCI.length)).toBe(true);
    expect(decodeSave(JSON.stringify(bred))).toEqual(bred);
    const shortV2 = structuredClone(bred); shortV2.fish[6].genome.maternal = shortV2.fish[6].genome.maternal.slice(0, LOCI.length); shortV2.fish[6].genome.paternal = shortV2.fish[6].genome.paternal.slice(0, LOCI.length);
    const longV1 = structuredClone(bred); longV1.fish[0].genome.maternal.push(...APPEARANCE_BASELINE); longV1.fish[0].genome.paternal.push(...APPEARANCE_BASELINE);
    const strayMutation = structuredClone(bred); strayMutation.fish[0].mutations = [{ locus: 50, copy: 'maternal', from: 0, to: 1 }];
    for (const invalid of [shortV2, longV1, strayMutation]) expect(() => decodeSave(JSON.stringify(invalid))).toThrow();
  });

  it('replays command journals recorded before genome v2 exactly, then breeds genome v2 on request', () => {
    const breed = { type: 'breed' as const, motherId: 'FSH-000001', fatherId: 'FSH-000002', tankId: 'tank-2', timestamp: NOW };
    let runtime = createRuntime(createWorld(NOW, 481516, 1), 'legacy-journal');
    runtime = executeCommand(runtime, commandEnvelope(runtime, breed));
    runtime = executeCommand(runtime, commandEnvelope(runtime, { type: 'buy', tankId: 'tank-1', timestamp: NOW }));
    // These are the genomes the genome v1 reducer stored; replay must reproduce them for the snapshot to load.
    expect(runtime.world.fish.slice(6).every(fish => fish.genome.version === 1 && fish.genome.maternal.length === LOCI.length)).toBe(true);
    expect(decodeRuntime(JSON.stringify(runtime))).toEqual(runtime);
    const current = executeCommand(runtime, commandEnvelope(runtime, { ...breed, tankId: 'tank-1', genomeVersion: 2 }));
    expect(current.world.fish.slice(-20).every(fish => fish.genome.version === 2)).toBe(true);
    expect(decodeRuntime(JSON.stringify(current))).toEqual(current);
    const v2Parents = createWorld(NOW, 481516, 2);
    expect(() => applyCommand(v2Parents, { ...breed, genomeVersion: 1 })).toThrow('genome v1 child');
    expect(applyCommand(v2Parents, breed).fish.slice(6).every(fish => fish.genome.version === 2)).toBe(true);
    // Genome v3 parents (FS-601) breed genome v3 without a version and refuse a lossy genome v2 clutch.
    expect(applyCommand(createWorld(NOW), breed).fish.slice(6).every(fish => fish.genome.version === 3)).toBe(true);
    expect(() => applyCommand(createWorld(NOW), { ...breed, genomeVersion: 2 })).toThrow('genome v2 child');
  });

  it('renders both inherited calico dot colors rather than silently dropping the second', () => {
    const fixture = APPEARANCE_VISUAL_FIXTURES.find(f => f.phenotype.appearance.motifs.some(m => m.kind === 'calico'))!;
    const ornament = buildOrnament(fixture.phenotype, fixture.birthSeed, anatomyFor(fixture.phenotype));
    expect(ornament.body.find(layer => layer.tone === 'dot0')?.shapes.length).toBeGreaterThan(0);
    expect(ornament.body.find(layer => layer.tone === 'dot1')?.shapes.length).toBeGreaterThan(0);
  });

  it('builds finite, bounded and deterministic ornament geometry for every appearance fixture', () => {
    const points = (shape: OrnamentShape) => shape.type === 'polygon' || shape.type === 'polyline' ? shape.points : [{ x: shape.x, y: shape.y }];
    for (const fixture of APPEARANCE_VISUAL_FIXTURES) {
      const anatomy = anatomyFor(fixture.phenotype), ornament = buildOrnament(fixture.phenotype, fixture.birthSeed, anatomy), b = anatomy.bounds;
      // Color-only variants live in the renderer palette; geometry exists only for motifs, scales, shimmer and fin patterns.
      const a = fixture.phenotype.appearance, geometric = a.motifs.length > 0 || a.finMotifs.length > 0 || a.scales !== 'smooth' || a.shimmer >= 0.3;
      expect(isEmptyOrnament(ornament)).toBe(!geometric);
      expect(buildOrnament(fixture.phenotype, fixture.birthSeed, anatomy)).toEqual(ornament);
      const layers = [...ornament.body, ...ornament.caudal, ...ornament.dorsal];
      expect(layers.reduce((sum, layer) => sum + layer.shapes.length, 0)).toBeLessThan(2500);
      for (const layer of layers) {
        expect(layer.alpha).toBeGreaterThan(0); expect(layer.alpha).toBeLessThanOrEqual(1);
        for (const point of layer.shapes.flatMap(points)) {
          expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true);
          expect(point.x).toBeGreaterThanOrEqual(b.minX - 0.25); expect(point.x).toBeLessThanOrEqual(b.maxX + 0.25);
          expect(point.y).toBeGreaterThanOrEqual(b.minY - 0.25); expect(point.y).toBeLessThanOrEqual(b.maxY + 0.25);
        }
      }
    }
  });
});
