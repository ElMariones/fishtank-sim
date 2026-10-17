import { describe, expect, it } from 'vitest';
import { axolotlFounderGenome } from '../src/core/axolotlGenetics';
import { GENOME_VERSION } from '../src/core/catalog';
import { founderGenome, inherit } from '../src/core/genetics';
import { hash } from '../src/core/random';
import { goldfishFounderGenome } from '../src/core/goldfishGenetics';
import { RARITY_TIERS, rarityOf, reference, tierFor } from '../src/core/rarity';
import type { Species } from '../src/core/types';

describe('trait rarity for every species', () => {
  it('places frequencies on one six-step ladder', () => {
    expect([0.5, 0.1, 0.03, 0.006, 0.002, 0].map(tierFor)).toEqual([...RARITY_TIERS]);
  });

  it('builds a deterministic reference quickly and rates founders mostly common', () => {
    for (const species of ['koi', 'axolotl', 'goldfish'] as Species[]) {
      const start = performance.now();
      const table = reference(species);
      expect(performance.now() - start).toBeLessThan(4000);
      for (const values of table.values()) expect([...values.values()].reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    }
    const genomes = [founderGenome(1, GENOME_VERSION), axolotlFounderGenome(1, 2), goldfishFounderGenome(1)];
    (['koi', 'axolotl', 'goldfish'] as Species[]).forEach((species, i) => {
      const report = rarityOf(species, genomes[i]);
      expect(report.rows.length).toBeGreaterThan(8);
      expect(report.rows.filter(row => row.tier === 'common').length).toBeGreaterThan(report.rows.length / 3);
      expect(rarityOf(species, genomes[i])).toBe(report);
    });
  });

  it('spreads a sample of animals across several tiers', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 120; seed++) seen.add(rarityOf('goldfish', goldfishFounderGenome(500 + seed)).tier);
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });

  it('keeps specimen tiers calibrated: most bred animals common, legendary well under one in fifty', () => {
    for (const species of ['koi', 'axolotl', 'goldfish'] as Species[]) {
      const tally: Record<string, number> = {};
      const founder = (key: string) => species === 'koi' ? founderGenome(hash(key), GENOME_VERSION) : species === 'axolotl' ? axolotlFounderGenome(hash(key), 2) : goldfishFounderGenome(hash(key));
      for (let i = 0; i < 300; i++) {
        const genome = inherit(founder(`probe:${species}:m${i}`), founder(`probe:${species}:f${i}`), hash(`probe:${species}:c${i}`), 0.003, GENOME_VERSION, undefined, 2).genome;
        const tier = rarityOf(species, genome).tier; tally[tier] = (tally[tier] ?? 0) + 1;
      }
      expect(tally.common ?? 0).toBeGreaterThan(300 * 0.55);
      expect(tally.legendary ?? 0).toBeLessThan(300 * 0.02);
    }
  });
});
