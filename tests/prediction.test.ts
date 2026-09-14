import { describe, expect, it } from 'vitest';
import { ALL_LOCI, LOCI } from '../src/core/catalog';
import { founderGenome } from '../src/core/genetics';
import { predictOffspring, singleLocusOdds } from '../src/core/prediction';
import { applyCommand, createWorld, type Command } from '../src/core/world';

describe('FS-403 independent offspring prediction', () => {
  it('returns Mendelian 1:2:1 and certain homozygous outcomes, with normalized odds for every locus', () => {
    const mother = founderGenome(403), father = founderGenome(404);
    mother.maternal[1] = father.maternal[1] = 1;
    mother.paternal[1] = father.paternal[1] = 5;
    expect(singleLocusOdds(mother, father, 'body_depth')).toEqual([
      { alleles: [1, 1], probability: 0.25 }, { alleles: [1, 5], probability: 0.5 }, { alleles: [5, 5], probability: 0.25 },
    ]);
    mother.paternal[1] = father.paternal[1] = 1;
    expect(singleLocusOdds(mother, father, 'body_depth')).toEqual([{ alleles: [1, 1], probability: 1 }]);
    for (const locus of ALL_LOCI) expect(singleLocusOdds(mother, father, locus).reduce((sum, row) => sum + row.probability, 0)).toBe(1);
  });

  it('uses the classic appearance baseline for genome v1 in mixed crosses', () => {
    const mother = founderGenome(403, 1), father = founderGenome(404, 2);
    father.maternal[LOCI.length] = father.paternal[LOCI.length] = 2;
    expect(singleLocusOdds(mother, father, 'base_color')).toEqual([{ alleles: [0, 2], probability: 1 }]);
  });

  it('never changes parents, future birth records, world IDs, balances or replay inputs', () => {
    const world = createWorld('2026-09-14T00:00:00.000Z'), raw = JSON.stringify(world);
    const command: Command = { type: 'breed', motherId: world.fish[0].id, fatherId: world.fish[1].id, tankId: 'tank-1', timestamp: '2026-09-14T00:01:00.000Z', genomeVersion: 2 };
    const withoutPreview = applyCommand(world, command);
    for (const goals of [[], ['tail'], ['tail', 'base_color:1']]) predictOffspring(world.fish[0].genome, world.fish[1].genome, goals);
    expect(JSON.stringify(world)).toBe(raw);
    expect(applyCommand(world, command)).toEqual(withoutPreview);
  });

  it('is reproducible and keeps the same sample when goals change, with bounded ordered ranges', () => {
    const mother = founderGenome(403), father = founderGenome(404);
    const a = predictOffspring(mother, father, ['tail', 'base_color:1']);
    expect(predictOffspring(structuredClone(mother), structuredClone(father), ['tail', 'base_color:1'])).toEqual(a);
    expect(predictOffspring(mother, father, ['tail']).ranges).toEqual(a.ranges.slice(0, 2));
    expect(a.samples).toBe(256);
    for (const range of a.ranges) {
      expect(range.low).toBeLessThanOrEqual(range.median); expect(range.median).toBeLessThanOrEqual(range.high);
      expect(range.low).toBeGreaterThanOrEqual(range.unit === 'cm' ? 22 : 0);
      expect(range.high).toBeLessThanOrEqual(range.unit === 'cm' ? 98 : 1);
    }
    const low = { version: 1 as const, maternal: LOCI.map(() => 0), paternal: LOCI.map(() => 0) };
    const high = { version: 1 as const, maternal: LOCI.map(() => 5), paternal: LOCI.map(() => 5) };
    expect(predictOffspring(low, low).ranges[0].median).toBe(22);
    expect(predictOffspring(high, high).ranges[0].median).toBe(98);
  });

  it('rejects unknown loci and invalid or unbounded goal requests', () => {
    const genome = founderGenome(403);
    expect(() => singleLocusOdds(genome, genome, 'missing')).toThrow();
    expect(() => predictOffspring(genome, genome, ['missing'])).toThrow();
    expect(() => predictOffspring(genome, genome, ['tail', 'depth', 'head', 'eye', 'red'])).toThrow();
  });
});
