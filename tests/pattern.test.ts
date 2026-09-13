import { describe, expect, it } from 'vitest';
import { LOCI } from '../src/core/catalog';
import { express, founderGenome, inherit } from '../src/core/genetics';
import { MARKING_BLOCKS, markingAnchors, placeMarkings } from '../src/core/pattern';
import { maskSimilarity, patternResemblanceReport, separation } from '../src/core/patternResemblance';
import { hash } from '../src/core/random';
import { fixturePatternComparison } from '../src/core/visualFixtures';

describe('FS-103 inherited marking structure', () => {
  it('derives anchors only from phased pigment and pattern haplotype blocks, independent of array order', () => {
    const genome = founderGenome(hash('fs-103:test:anchors'));
    expect(MARKING_BLOCKS.flatMap(block => block.loci)).toEqual(Array.from({ length: 12 }, (_, i) => 18 + i));
    const swapped = { version: 1 as const, maternal: [...genome.paternal], paternal: [...genome.maternal] };
    expect(markingAnchors(swapped).map(anchor => anchor.key)).toEqual(markingAnchors(genome).map(anchor => anchor.key));
    const elsewhere = structuredClone(genome);
    LOCI.forEach((_, i) => { if (i < 18 || i > 29) { elsewhere.maternal[i] = 5 - elsewhere.maternal[i]; elsewhere.paternal[i] = 5 - elsewhere.paternal[i]; } });
    expect(markingAnchors(elsewhere)).toEqual(markingAnchors(genome));
    const homozygous = structuredClone(genome);
    homozygous.paternal[18] = homozygous.maternal[18]; homozygous.paternal[19] = homozygous.maternal[19];
    const merged = markingAnchors(homozygous).filter(anchor => anchor.block === 0);
    expect(merged).toHaveLength(1);
    expect(merged[0].origin).toBe('both');
    const mutated = structuredClone(homozygous);
    mutated.maternal[19] = mutated.maternal[19] === 5 ? 4 : mutated.maternal[19] + 1;
    const before = new Set(markingAnchors(homozygous).map(anchor => anchor.key));
    expect(markingAnchors(mutated).map(anchor => anchor.key).filter(key => !before.has(key))).toHaveLength(1);
  });

  it('transmits block haplotypes with the chromosome copy, except at crossovers', () => {
    const mother = founderGenome(hash('fs-103:test:mother')), father = founderGenome(hash('fs-103:test:father'));
    const parental = new Set([...markingAnchors(mother), ...markingAnchors(father)].map(anchor => anchor.key));
    let inherited = 0, total = 0;
    for (let seed = 0; seed < 400; seed++) {
      for (const anchor of markingAnchors(inherit(mother, father, seed, 0).genome)) { total++; if (parental.has(anchor.key)) inherited++; }
    }
    expect(inherited / total).toBeGreaterThan(0.85);
  });

  it('places deterministic finite markings where the birth seed adds only small jitter', () => {
    const p = express(founderGenome(hash('fs-103:test:placement')));
    const first = placeMarkings(p, 1), second = placeMarkings(p, 2);
    expect(placeMarkings(p, 1)).toEqual(first);
    expect(first).toHaveLength(p.frequency);
    first.forEach((marking, i) => {
      expect([marking.u, marking.v, marking.radius, marking.angle].every(Number.isFinite)).toBe(true);
      expect(marking.u).toBeGreaterThanOrEqual(0);
      expect(marking.u).toBeLessThanOrEqual(1);
      expect(Math.abs(marking.v)).toBeLessThanOrEqual(1);
      expect(marking.radius).toBeGreaterThan(0);
      expect(marking.key).toBe(second[i].key);
      expect(Math.abs(marking.u - second[i].u)).toBeLessThanOrEqual(0.06 + 1e-9);
      expect(Math.abs(marking.v - second[i].v)).toBeLessThanOrEqual(0.16 + 1e-9);
    });
  });

  it('scores mask overlap and rank separation as documented', () => {
    const a = Uint8Array.from([1, 1, 0, 0]), b = Uint8Array.from([1, 0, 1, 0]);
    expect(maskSimilarity(a, a)).toBe(1);
    expect(maskSimilarity(a, b)).toBeCloseTo(1 / 3, 12);
    expect(maskSimilarity(new Uint8Array(4), new Uint8Array(4))).toBe(1);
    expect(separation([0.9, 0.8], [0.1, 0.2])).toBe(1);
    expect(separation([0.5], [0.5])).toBe(0.5);
    expect(separation([0.1, 0.9], [0.5, 0.5])).toBe(0.5);
  });

  it('makes related fish measurably more alike than unrelated fish, unlike independent placement', () => {
    const { inherited, independent } = patternResemblanceReport(24, 10);
    expect(independent.siblingSeparation).toBeLessThan(0.58);
    expect(inherited.siblingSeparation).toBeGreaterThan(0.68);
    expect(inherited.parentSeparation).toBeGreaterThan(0.66);
    expect(inherited.siblingSeparation - independent.siblingSeparation).toBeGreaterThan(0.15);
    expect(inherited.siblingMean - inherited.unrelatedMean).toBeGreaterThan(0.08);
    expect(inherited.siblingMean).toBeGreaterThan(independent.siblingMean * 1.6);
  });

  it('shows the frozen FS-101 cohorts sharing marking structure within each cross', () => {
    const [independent, inherited] = fixturePatternComparison();
    expect([independent.model, inherited.model]).toEqual(['independent', 'inherited']);
    expect(independent.siblingSeparation).toBeLessThan(0.6);
    expect(inherited.siblingSeparation).toBeGreaterThan(0.75);
    expect(inherited.siblingMean - inherited.crossCohortMean).toBeGreaterThan(0.1);
  });
});
