import { describe, expect, it } from 'vitest';
import { GENOME_LOCI } from '../src/core/catalog';
import {
  AXOLOTL_CHROMOSOMES,
  AXOLOTL_GENOME_METADATA,
  AXOLOTL_LOCI,
  AXOLOTL_LOCUS_INDEX,
  AXOLOTL_LOCUS_REGISTRY,
  axolotlAlleleLabel,
  axolotlLocusLabel,
  type AxolotlLocus,
} from '../src/core/axolotlCatalog';
import {
  axolotlFingerprint,
  axolotlFounderGenome,
  axolotlGenomeProblem,
  axolotlHeterozygosity,
  describeAxolotlGenotype,
  describeAxolotlPhenotype,
  expressAxolotl,
  inheritAxolotl,
  isAxolotlGenome,
  type AxolotlGenome,
  type AxolotlInheritanceTrace,
} from '../src/core/axolotlGenetics';

const neutralGenome = (): AxolotlGenome => {
  const homolog = AXOLOTL_LOCUS_REGISTRY.map(entry =>
    entry.expression === 'quantitative' ? 2 : 0,
  );
  return { species: 'axolotl', version: 1, maternal: [...homolog], paternal: [...homolog] };
};

const withLoci = (
  genome: AxolotlGenome,
  changes: Partial<Record<AxolotlLocus, readonly [number, number]>>,
): AxolotlGenome => {
  const next = structuredClone(genome);
  for (const [locus, pair] of Object.entries(changes) as [AxolotlLocus, readonly [number, number]][]) {
    const index = AXOLOTL_LOCUS_INDEX[locus];
    next.maternal[index] = pair[0];
    next.paternal[index] = pair[1];
  }
  return next;
};

const quantitativeGenome = (allele: 0 | 5): AxolotlGenome => {
  const genome = neutralGenome();
  AXOLOTL_LOCUS_REGISTRY.forEach((entry, index) => {
    if (entry.expression === 'quantitative') genome.maternal[index] = genome.paternal[index] = allele;
  });
  return genome;
};

const numericLeaves = (value: unknown): number[] => {
  if (typeof value === 'number') return [value];
  if (Array.isArray(value)) return value.flatMap(numericLeaves);
  if (value && typeof value === 'object') return Object.values(value).flatMap(numericLeaves);
  return [];
};

describe('standalone axolotl genome', () => {
  it('owns a disjoint 66-locus, 11-chromosome catalog instead of reusing koi loci', () => {
    expect(AXOLOTL_GENOME_METADATA).toEqual({
      species: 'axolotl', version: 1, lociPerHomolog: 66, chromosomes: 11, maxAllelesPerLocus: 6,
    });
    expect(AXOLOTL_LOCI).toHaveLength(66);
    expect(new Set(AXOLOTL_LOCI)).toHaveLength(66);
    expect(AXOLOTL_LOCUS_REGISTRY.map(entry => entry.id)).toEqual(AXOLOTL_LOCI);
    expect(AXOLOTL_CHROMOSOMES).toHaveLength(11);
    expect(AXOLOTL_CHROMOSOMES.every(chromosome => chromosome.loci.length === 6)).toBe(true);
    expect(AXOLOTL_LOCI.filter(locus => (GENOME_LOCI as readonly string[]).includes(locus))).toEqual([]);
    expect(AXOLOTL_LOCI.every(locus => locus.startsWith('axo_'))).toBe(true);
  });

  it('has valid founder distributions, ordered maps, and non-silent mutation targets at every locus', () => {
    for (const chromosome of AXOLOTL_CHROMOSOMES) {
      const entries = chromosome.loci.map(locus => AXOLOTL_LOCUS_REGISTRY[AXOLOTL_LOCUS_INDEX[locus]]);
      expect(entries.map(entry => entry.positionCm)).toEqual([...entries.map(entry => entry.positionCm)].sort((a, b) => a - b));
      for (const entry of entries) {
        expect(entry.chromosomeId).toBe(chromosome.id);
        expect(entry.alleles).toHaveLength(6);
        expect(entry.alleles.reduce((sum, allele) => sum + allele.founderWeight, 0)).toBeCloseTo(1, 12);
        for (let from = 0; from < entry.alleles.length; from++) {
          const targets = entry.alleles[from].mutationTargets;
          expect(targets.length).toBeGreaterThan(0);
          expect(targets.reduce((sum, target) => sum + target.weight, 0)).toBeCloseTo(1, 12);
          expect(targets.every(target =>
            target.allele >= 0 && target.allele < 6 && Math.abs(target.allele - from) === 1
          )).toBe(true);
        }
      }
    }
  });

  it('creates valid deterministic founders on species-specific seeded streams', () => {
    const first = axolotlFounderGenome(481516);
    expect(axolotlFounderGenome(481516)).toEqual(first);
    expect(axolotlFounderGenome(481517)).not.toEqual(first);
    expect(isAxolotlGenome(first)).toBe(true);
    expect(axolotlGenomeProblem(first)).toBeNull();
    expect(axolotlFingerprint(first)).toMatch(/^AX1-[0-9A-F]{8}$/);
    expect(axolotlHeterozygosity(first)).toBeGreaterThan(0);
    expect(axolotlHeterozygosity(first)).toBeLessThan(1);
  });

  it('uses only the seeded PRNG for founding, meiosis, mutation, and expression', () => {
    const saved = Math.random;
    Math.random = () => { throw new Error('Math.random must not be used'); };
    try {
      const mother = axolotlFounderGenome(10), father = axolotlFounderGenome(11);
      const child = inheritAxolotl(mother, father, 12, 0.2).genome;
      expect(expressAxolotl(child).adultLengthCm).toBeGreaterThan(0);
    } finally {
      Math.random = saved;
    }
  });

  it('matches configured founder allele weights over a deterministic cohort', () => {
    const locus = AXOLOTL_LOCUS_INDEX.axo_body_length;
    const expected = AXOLOTL_LOCUS_REGISTRY[locus].alleles.map(allele => allele.founderWeight);
    const counts = Array(6).fill(0) as number[];
    const founders = 4_000;
    for (let seed = 0; seed < founders; seed++) {
      const genome = axolotlFounderGenome(seed);
      counts[genome.maternal[locus]]++;
      counts[genome.paternal[locus]]++;
    }
    counts.forEach((count, allele) => expect(count / (founders * 2)).toBeCloseTo(expected[allele], 1));
  });

  it('makes recessive classic-light, albino, and melanoid-like founders rare but reachable', () => {
    const morphs = new Map<string, number>();
    const carriers = new Map<string, number>();
    const founders = 12_000;
    for (let seed = 0; seed < founders; seed++) {
      const p = expressAxolotl(axolotlFounderGenome(seed));
      morphs.set(p.pigmentation.morph, (morphs.get(p.pigmentation.morph) ?? 0) + 1);
      for (const carrier of p.pigmentation.carriers) carriers.set(carrier, (carriers.get(carrier) ?? 0) + 1);
    }
    for (const morph of ['leucistic-like', 'albino-like', 'melanoid-like']) {
      expect(morphs.get(morph) ?? 0).toBeGreaterThan(0);
      expect((morphs.get(morph) ?? 0) / founders).toBeLessThan(0.01);
    }
    for (const carrier of ['leucistic', 'albino', 'melanoid']) {
      expect((carriers.get(carrier) ?? 0) / founders).toBeGreaterThan(0.05);
      expect((carriers.get(carrier) ?? 0) / founders).toBeLessThan(0.12);
    }
  });

  it('performs linked phased meiosis with independent chromosome starts', () => {
    const mother = neutralGenome(), father = neutralGenome();
    mother.maternal.fill(0); mother.paternal.fill(1);
    father.maternal.fill(4); father.paternal.fill(5);

    let switches = 0, gametes = 0;
    const firstSides = new Set<number>();
    for (let seed = 0; seed < 300; seed++) {
      const trace: AxolotlInheritanceTrace = { maternal: [], paternal: [] };
      const { genome, mutations } = inheritAxolotl(mother, father, seed, 0, trace);
      expect(mutations).toEqual([]);
      expect(genome.maternal.every(allele => allele === 0 || allele === 1)).toBe(true);
      expect(genome.paternal.every(allele => allele === 4 || allele === 5)).toBe(true);
      expect(trace.maternal).toHaveLength(66);
      expect(trace.paternal).toHaveLength(66);

      for (const sides of [trace.maternal, trace.paternal]) {
        for (const chromosome of AXOLOTL_CHROMOSOMES) {
          const indices = chromosome.loci.map(locus => AXOLOTL_LOCUS_INDEX[locus]);
          firstSides.add(sides[indices[0]]);
          for (let i = 1; i < indices.length; i++) {
            if (sides[indices[i]] !== sides[indices[i - 1]]) switches++;
          }
          gametes++;
        }
      }
    }
    // The map has ~0.60 expected switches per six-locus chromosome, far below independent assortment.
    expect(switches / gametes).toBeGreaterThan(0.45);
    expect(switches / gametes).toBeLessThan(0.75);
    expect(firstSides).toEqual(new Set([0, 1]));
  });

  it('applies explicit mutation after transmission and never records a no-op', () => {
    const parent = neutralGenome();
    const noMutation = inheritAxolotl(parent, parent, 55, 0);
    expect(noMutation.mutations).toEqual([]);

    const forced = inheritAxolotl(parent, parent, 55, 1);
    expect(forced.mutations).toHaveLength(AXOLOTL_LOCI.length * 2);
    for (const mutation of forced.mutations) {
      expect(mutation.to).not.toBe(mutation.from);
      expect(AXOLOTL_LOCI[mutation.locus]).toBe(mutation.locusId);
      const childCopy = forced.genome[mutation.copy];
      expect(childCopy[mutation.locus]).toBe(mutation.to);
    }
    expect(() => inheritAxolotl(parent, parent, 1, -0.01)).toThrow('Invalid axolotl mutation rate');
    expect(() => inheritAxolotl(parent, parent, 1, 1.01)).toThrow('Invalid axolotl mutation rate');
  });

  it('expresses the same phenotype when whole parental homolog labels are swapped', () => {
    const genome = axolotlFounderGenome(90210);
    const swapped: AxolotlGenome = {
      species: 'axolotl', version: 1, maternal: [...genome.paternal], paternal: [...genome.maternal],
    };
    expect(expressAxolotl(swapped)).toEqual(expressAxolotl(genome));
  });
});

describe('axolotl morphology and pigmentation', () => {
  it('maps quantitative extremes into large visible changes while keeping anatomy bounded', () => {
    const low = expressAxolotl(quantitativeGenome(0));
    const high = expressAxolotl(quantitativeGenome(5));

    expect(low.adultLengthCm).toBe(16);
    expect(high.adultLengthCm).toBe(33);
    expect(high.morphology.body.length).toBeGreaterThan(low.morphology.body.length);
    expect(high.morphology.head.width).toBeGreaterThan(low.morphology.head.width);
    expect(high.morphology.limbs.foreLength).toBeGreaterThan(low.morphology.limbs.foreLength);
    expect(high.morphology.tail.length).toBeGreaterThan(low.morphology.tail.length);
    expect(high.morphology.gills.stalkLength).toBeGreaterThan(low.morphology.gills.stalkLength);
    expect(high.morphology.eyes.size).toBeGreaterThan(low.morphology.eyes.size);
    expect([low.morphology.limbs.frontDigits, low.morphology.limbs.rearDigits]).toEqual([3, 4]);
    expect([high.morphology.limbs.frontDigits, high.morphology.limbs.rearDigits]).toEqual([5, 6]);
    expect([low.morphology.gills.branchCount, high.morphology.gills.branchCount]).toEqual([4, 15]);
  });

  it('models classic light, albino, melanoid, axanthic, and carrier-like pigment outcomes independently', () => {
    const neutral = expressAxolotl(neutralGenome());
    expect(neutral.pigmentation.morph).toBe('wild');

    const carrier = expressAxolotl(withLoci(neutralGenome(), { axo_leucistic_switch: [5, 0] }));
    expect(carrier.pigmentation.morph).toBe('wild');
    expect(carrier.pigmentation.carriers).toContain('leucistic');
    expect(carrier.pigmentation.leucisticExpression).toBe(0);

    const leucistic = expressAxolotl(withLoci(neutralGenome(), { axo_leucistic_switch: [5, 5] }));
    expect(leucistic.pigmentation.morph).toBe('leucistic-like');
    expect(leucistic.pigmentation.melanin).toBeLessThan(0.1);
    expect(leucistic.pigmentation.bodyColor.l).toBeGreaterThan(neutral.pigmentation.bodyColor.l);

    const albino = expressAxolotl(withLoci(neutralGenome(), { axo_albinism_switch: [5, 5] }));
    expect(albino.pigmentation.morph).toBe('albino-like');
    expect(albino.pigmentation.melanin).toBe(0);
    expect(albino.pigmentation.irisColor.h).toBe(355);

    const melanoid = expressAxolotl(withLoci(neutralGenome(), { axo_melanoid_switch: [5, 5] }));
    expect(melanoid.pigmentation.morph).toBe('melanoid-like');
    expect(melanoid.pigmentation.iridophore).toBeLessThan(0.05);
    expect(melanoid.pigmentation.bodyColor.l).toBeLessThan(neutral.pigmentation.bodyColor.l);

    const axanthic = expressAxolotl(withLoci(neutralGenome(), { axo_xanthophore_density: [0, 0] }));
    expect(axanthic.pigmentation.morph).toBe('axanthic-like');
    expect(axanthic.pigmentation.xanthophore).toBe(0.05);
  });

  it('gives albino expression priority when multiple recessive pigment pathways coincide', () => {
    const combined = expressAxolotl(withLoci(neutralGenome(), {
      axo_leucistic_switch: [5, 5],
      axo_albinism_switch: [5, 5],
      axo_melanoid_switch: [5, 5],
    }));
    expect(combined.pigmentation.morph).toBe('albino-like');
    expect(combined.pigmentation.albinismExpression).toBe(1);
    expect(combined.pigmentation.leucisticExpression).toBe(1);
    expect(combined.pigmentation.melanoidExpression).toBe(1);
  });

  it('supports codominant synthetic patterns, color variation, texture, translucency, and iridescence', () => {
    const genome = withLoci(neutralGenome(), {
      axo_pattern_mode: [1, 4],
      axo_pattern_density: [5, 5],
      axo_pattern_contrast: [5, 5],
      axo_skin_texture: [1, 5],
      axo_iridescence: [5, 5],
      axo_translucency: [5, 5],
      axo_base_hue: [0, 5],
      axo_gill_hue: [3, 4],
      axo_iris_hue: [4, 5],
    });
    const p = expressAxolotl(genome);
    expect(p.pattern.modes).toEqual(['speckled', 'dappled']);
    expect(p.pattern.density).toBeCloseTo(0.95, 4);
    expect(p.pattern.contrast).toBeCloseTo(0.94, 4);
    expect(p.pigmentation.texture).toBe('ridged');
    expect(p.pigmentation.iridescence).toBeGreaterThan(0.5);
    expect(p.pigmentation.translucency).toBeGreaterThan(0.6);
    expect(p.pigmentation.bodyColor.h).not.toBe(p.pigmentation.gillColor.h);
    expect(p.pigmentation.irisColor.h).not.toBe(p.pigmentation.bodyColor.h);
  });

  it('keeps all phenotype numbers finite and bounded across a broad founder cohort', () => {
    for (let seed = 0; seed < 750; seed++) {
      const p = expressAxolotl(axolotlFounderGenome(seed));
      expect(numericLeaves(p).every(Number.isFinite)).toBe(true);
      expect(p.adultLengthCm).toBeGreaterThanOrEqual(16);
      expect(p.adultLengthCm).toBeLessThanOrEqual(33);
      expect(p.morphology.limbs.frontDigits).toBeGreaterThanOrEqual(3);
      expect(p.morphology.limbs.frontDigits).toBeLessThanOrEqual(5);
      expect(p.morphology.limbs.rearDigits).toBeGreaterThanOrEqual(4);
      expect(p.morphology.limbs.rearDigits).toBeLessThanOrEqual(6);
      expect(p.morphology.gills.branchCount).toBeGreaterThanOrEqual(4);
      expect(p.morphology.gills.branchCount).toBeLessThanOrEqual(15);
      for (const color of [p.pigmentation.bodyColor, p.pigmentation.gillColor, p.pigmentation.irisColor]) {
        expect(color.h).toBeGreaterThanOrEqual(0); expect(color.h).toBeLessThan(360);
        expect(color.s).toBeGreaterThanOrEqual(0); expect(color.s).toBeLessThanOrEqual(1);
        expect(color.l).toBeGreaterThanOrEqual(0); expect(color.l).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('axolotl life, behavior, and inspection contracts', () => {
  it('exposes shared simulation potentials without coupling them to koi phenotype semantics', () => {
    const low = expressAxolotl(quantitativeGenome(0)), high = expressAxolotl(quantitativeGenome(5));
    expect(high.growth).toBeGreaterThan(low.growth);
    expect(high.longevity).toBeGreaterThan(low.longevity);
    expect(high.fertility).toBeGreaterThan(low.fertility);
    expect(high.activity).toBeGreaterThan(low.activity);
    expect(high.social).toBeGreaterThan(low.social);
    expect(high.bold).toBeGreaterThan(low.bold);
    expect(high.curious).toBeGreaterThan(low.curious);
    expect(high.life.maturityMonths).toBeLessThan(low.life.maturityMonths);
    expect(high.life.regeneration).toBeGreaterThan(low.life.regeneration);
    expect(high.speed).toBe(high.behavior.cruiseSpeed);
    expect(high.turning).toBe(high.behavior.turning);
    expect(high.oxygen).toBe(high.life.oxygenDemand);
    expect(high.adultLengthCm).toBe(high.morphology.adultLengthCm);
  });

  it('provides complete named genotype rows including hidden recessive carriers', () => {
    const genome = withLoci(neutralGenome(), {
      axo_leucistic_switch: [5, 0],
      axo_albinism_switch: [4, 4],
      axo_pattern_mode: [2, 5],
    });
    const rows = describeAxolotlGenotype(genome);
    expect(rows).toHaveLength(66);
    expect(rows.find(row => row.locus === 'axo_leucistic_switch')).toMatchObject({
      label: 'Leucistic pathway',
      maternalAllele: 'null',
      paternalAllele: 'standard',
      carrierFor: 'leucistic',
      expressedRecessive: false,
    });
    expect(rows.find(row => row.locus === 'axo_albinism_switch')).toMatchObject({
      carrierFor: null,
      expressedRecessive: true,
    });
    expect(axolotlLocusLabel('axo_pattern_mode')).toBe('Pattern mode');
    expect(axolotlAlleleLabel('axo_pattern_mode', 5)).toBe('marbled');
    expect(() => axolotlAlleleLabel('axo_pattern_mode', 6)).toThrow('Invalid axolotl allele');
  });

  it('provides compact phenotype descriptors covering every major group', () => {
    const descriptors = describeAxolotlPhenotype(axolotlFounderGenome(7007));
    expect(descriptors.length).toBeGreaterThanOrEqual(15);
    expect(new Set(descriptors.map(row => row.group))).toEqual(
      new Set(['Morphology', 'Pigmentation', 'Pattern', 'Life', 'Behavior']),
    );
    expect(descriptors.find(row => row.trait === 'Adult length')?.value).toMatch(/cm$/);
    expect(descriptors.find(row => row.trait === 'Morph')?.value).toBeTruthy();
  });

  it('validates save-facing shape and allele constraints without throwing from its type guard', () => {
    const genome = axolotlFounderGenome(1);
    expect(isAxolotlGenome(null)).toBe(false);
    expect(isAxolotlGenome({})).toBe(false);
    expect(axolotlGenomeProblem({ ...genome, species: 'koi' })).toContain('wrong species');
    expect(axolotlGenomeProblem({ ...genome, version: 2 })).toContain('Unsupported');
    expect(axolotlGenomeProblem({ ...genome, maternal: genome.maternal.slice(1) })).toContain('66 loci');
    expect(axolotlGenomeProblem({ ...genome, maternal: genome.maternal.map((a, i) => i === 3 ? 9 : a) })).toContain('Invalid axolotl allele');
    expect(axolotlGenomeProblem({ ...genome, paternal: genome.paternal.map((a, i) => i === 4 ? 1.5 : a) })).toContain('Invalid axolotl allele');
  });
});
