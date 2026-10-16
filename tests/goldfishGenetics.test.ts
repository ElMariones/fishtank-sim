import { describe, expect, it } from 'vitest';
import { GOLDFISH_LOCI, GOLDFISH_LOCUS_INDEX, type GoldfishLocus } from '../src/core/goldfishCatalog';
import {
  describeGoldfishGenotype, expressGoldfish, goldfishFounderGenome, goldfishGenomeProblem, goldfishHeterozygosity, inheritGoldfish, isGoldfishGenome,
  type GoldfishGenome, type GoldfishInheritanceTrace, type GoldfishVariety,
} from '../src/core/goldfishGenetics';
import { VARIETY_TEMPLATES, withGoldfishAlleles } from '../src/core/goldfishShop';
import { homozygousSites, isNovel } from '../src/core/genesis';
import { goldfishMaturity, stagePhenotype } from '../src/core/juvenile';
import { express, inherit } from '../src/core/genetics';
import { founderGenome } from '../src/core/genetics';
import { axolotlFounderGenome } from '../src/core/axolotlGenetics';
import { INCUBATION_DAYS } from '../src/core/development';

const founder = (n: number) => goldfishFounderGenome(1000 + n * 7919);
const set = (genome: GoldfishGenome, alleles: Partial<Record<GoldfishLocus, [number, number]>>) => withGoldfishAlleles(genome, alleles);
const at = (genome: GoldfishGenome, locus: GoldfishLocus) => [genome.maternal[GOLDFISH_LOCUS_INDEX[locus]], genome.paternal[GOLDFISH_LOCUS_INDEX[locus]]];
const children = (mother: GoldfishGenome, father: GoldfishGenome, n: number, salt = 0) =>
  Array.from({ length: n }, (_, i) => inheritGoldfish(mother, father, 50_000 + salt * 10_000 + i, 0).genome);

describe('goldfish genome v1', () => {
  it('builds deterministic, valid, Genesis-native founders that never express their own load', () => {
    const a = founder(1), b = founder(1);
    expect(a).toEqual(b);
    expect(a.maternal).toHaveLength(72); expect(GOLDFISH_LOCI).toHaveLength(72);
    expect(goldfishGenomeProblem(a)).toBeNull(); expect(isGoldfishGenome(a)).toBe(true);
    for (let i = 0; i < 200; i++) expect(homozygousSites(founder(i).genesis.load)).toEqual([]);
    // Species tags keep the three genomes apart.
    expect(isGoldfishGenome(axolotlFounderGenome(5, 2))).toBe(false);
    expect(isGoldfishGenome(founderGenome(5, 4))).toBe(false);
  });

  it('rejects malformed genomes', () => {
    const a = founder(2);
    expect(goldfishGenomeProblem({ ...a, maternal: a.maternal.slice(1) })).toMatch(/72 loci/);
    expect(goldfishGenomeProblem({ ...a, species: 'axolotl' })).toMatch(/species/);
    expect(goldfishGenomeProblem({ ...a, maternal: [...a.maternal.slice(0, 71), 9] })).toMatch(/Invalid goldfish allele/);
    expect(goldfishGenomeProblem({ ...a, paternal: [1000123, ...a.paternal.slice(1)] })).toMatch(/novel/i);
  });

  it('inherits deterministically with a full trace and keeps both species apart', () => {
    const trace: GoldfishInheritanceTrace = { maternal: [], paternal: [] };
    const one = inheritGoldfish(founder(3), founder(4), 77, undefined, trace), two = inheritGoldfish(founder(3), founder(4), 77);
    expect(one).toEqual(two);
    expect(trace.maternal).toHaveLength(72); expect(trace.paternal).toHaveLength(72);
    expect(goldfishGenomeProblem(one.genome)).toBeNull();
    expect(() => inherit(founder(3), founderGenome(9, 4), 1)).toThrow(/Different species/);
    // Each child copy comes from one parental homolog, per locus.
    const mother = founder(3);
    one.genome.maternal.forEach((allele, i) => expect([mother.maternal[i], mother.paternal[i]]).toContain(allele));
  });

  it('creates valid open-ended alleles under heavy mutation and carries their definitions', () => {
    let novel = 0;
    for (let i = 0; i < 40; i++) {
      const result = inheritGoldfish(founder(5), founder(6), 900 + i, 0.08);
      expect(goldfishGenomeProblem(result.genome)).toBeNull();
      novel += result.genome.genesis.novel.length;
      for (const id of [...result.genome.maternal, ...result.genome.paternal].filter(isNovel)) expect(result.genome.genesis.novel.some(n => n.id === id)).toBe(true);
    }
    expect(novel).toBeGreaterThan(10);
  });
});

describe('goldfish Mendelian anchors', () => {
  it('twin tail (chdA E127X) is recessive: carriers × carriers give about a quarter twin-tailed', () => {
    const mother = set(founder(7), { gf_twin_tail: [4, 0] }), father = set(founder(8), { gf_twin_tail: [0, 5] });
    expect(expressGoldfish(mother).carriers).toContain('gf_twin_tail');
    const kids = children(mother, father, 400);
    const homozygous = kids.filter(k => at(k, 'gf_twin_tail').every(a => a >= 4));
    expect(homozygous.length / kids.length).toBeGreaterThan(0.18); expect(homozygous.length / kids.length).toBeLessThan(0.32);
    for (const kid of homozygous) expect(expressGoldfish(kid).tail.kind).not.toBe('single');
    const hets = kids.filter(k => at(k, 'gf_twin_tail').filter(a => a >= 4).length === 1);
    expect(hets.filter(k => expressGoldfish(k).tail.kind !== 'single').length / hets.length).toBeLessThan(0.08);
  });

  it('telescope and celestial alleles of the lrp2-like locus fail to complement', () => {
    const base = founder(9);
    expect(expressGoldfish(set(base, { gf_eye_program: [3, 4], gf_bubble_program: [0, 0] })).eyes.kind).toBe('telescope');
    expect(expressGoldfish(set(base, { gf_eye_program: [5, 5] })).eyes.kind).toBe('celestial');
    expect(expressGoldfish(set(base, { gf_eye_program: [4, 5] })).eyes.kind).toBe('skygazer');
    const carrier = expressGoldfish(set(base, { gf_eye_program: [5, 0] }));
    expect(carrier.eyes.kind).toBe('normal'); expect(carrier.carriers).toContain('gf_eye_program');
  });

  it('transparent scales (T) are incompletely dominant and segregate 1:2:1', () => {
    const base = founder(10);
    expect(expressGoldfish(set(base, { gf_transparency: [0, 1] })).scales.type).toBe('metallic');
    expect(expressGoldfish(set(base, { gf_transparency: [4, 0] })).scales.type).toBe('nacreous');
    expect(expressGoldfish(set(base, { gf_transparency: [4, 5] })).scales.type).toBe('matte');
    const kids = children(set(founder(11), { gf_transparency: [4, 0] }), set(founder(12), { gf_transparency: [0, 4] }), 400, 1).map(k => expressGoldfish(k).scales.type);
    const share = (type: string) => kids.filter(t => t === type).length / kids.length;
    expect(share('nacreous')).toBeGreaterThan(0.4); expect(share('nacreous')).toBeLessThan(0.6);
    expect(share('metallic')).toBeGreaterThan(0.17); expect(share('matte')).toBeGreaterThan(0.17);
  });

  it('long fins are dominant, two copies longer', () => {
    const base = founder(13);
    const none = expressGoldfish(set(base, { gf_longfin: [0, 1] })), one = expressGoldfish(set(base, { gf_longfin: [4, 1] })), two = expressGoldfish(set(base, { gf_longfin: [4, 5] }));
    expect([none.fins.long, one.fins.long, two.fins.long]).toEqual([0, 1, 2]);
    expect(two.fins.length).toBeGreaterThan(one.fins.length); expect(one.fins.length).toBeGreaterThan(none.fins.length);
    // Long fins cost swimming speed.
    expect(two.speed).toBeLessThan(none.speed);
  });

  it('dorsal-fin loss carries a parent-of-origin effect: reciprocal crosses differ', () => {
    const loss = set(founder(14), { gf_dorsal_loss_a: [5, 5], gf_dorsal_loss_b: [5, 5], gf_canalization: [5, 5] });
    const keep = set(founder(15), { gf_dorsal_loss_a: [2, 2], gf_dorsal_loss_b: [2, 2], gf_canalization: [5, 5] });
    const reduced = (kids: GoldfishGenome[]) => kids.filter(k => expressGoldfish(k).fins.dorsal !== 'full').length;
    expect(expressGoldfish(loss).fins.dorsal).toBe('absent'); expect(expressGoldfish(keep).fins.dorsal).toBe('full');
    expect(reduced(children(loss, keep, 200, 2))).toBeGreaterThan(reduced(children(keep, loss, 200, 3)) + 40);
  });

  it('hoods need both growth loci, and grow in with maturity', () => {
    const hooded = expressGoldfish(set(founder(16), { gf_hood_a: [5, 5], gf_hood_b: [5, 5] }));
    expect(hooded.head.hood).toBeGreaterThan(0.5);
    expect(expressGoldfish(set(founder(16), { gf_hood_a: [5, 5], gf_hood_b: [0, 0] })).head.hood).toBe(0);
    const young = stagePhenotype(express(set(founder(16), { gf_hood_a: [5, 5], gf_hood_b: [5, 5] })), { body: 0.4, pigment: 1, color: 1 });
    expect(young.goldfish!.head.hood).toBeLessThan(hooded.head.hood * 0.25);
  });
});

describe('goldfish development', () => {
  it('fry are bronze until their genetic break day, then show the adult color', () => {
    const genome = set(founder(17), { gf_color_break: [5, 5], gf_albino: [0, 0], gf_xanthophore: [5, 5], gf_white_spread: [0, 0], gf_pattern_mode: [0, 0] });
    const adult = express(genome), gf = adult.goldfish!;
    expect(gf.color.broken).toBe(true);
    const day = (age: number) => stagePhenotype(adult, goldfishMaturity({ model: 1, ageDays: age, lengthCm: gf.adultLengthCm * 0.5, condition: 1 }, gf)).goldfish!;
    const before = day(INCUBATION_DAYS + gf.color.breakDay - 1), after = day(INCUBATION_DAYS + gf.color.breakDay + 8);
    expect(before.color.body).toEqual(gf.color.bronze);
    expect(before.color.darkAmount).toBeGreaterThan(0.4);
    expect(after.color.body).toEqual(gf.color.body);
    // A wild-type fish that never breaks stays bronze.
    const wild = expressGoldfish(set(founder(17), { gf_color_break: [0, 0], gf_albino: [0, 0] }));
    expect(wild.color.broken).toBe(false); expect(wild.variety.color).toBe('Bronze');
  });

  it('weak swim bladders in round bodies float head-down and cap condition', () => {
    const round = expressGoldfish(set(founder(18), { gf_roundness: [5, 5], gf_body_depth: [5, 5], gf_swim_bladder: [0, 0] }));
    const sound = expressGoldfish(set(founder(18), { gf_roundness: [5, 5], gf_body_depth: [5, 5], gf_swim_bladder: [5, 5] }));
    expect(round.health.buoyancy).toBeGreaterThan(0); expect(round.genesis.conditionCap).toBeLessThan(1);
    expect(sound.health.buoyancy).toBe(0);
  });

  it('protruding eyes and bubble sacs cost food competition', () => {
    const base = set(founder(19), { gf_eye_program: [0, 0], gf_bubble_program: [0, 0] });
    const normal = expressGoldfish(base), bubble = expressGoldfish(set(base, { gf_bubble_program: [4, 4] })), celestial = expressGoldfish(set(base, { gf_eye_program: [5, 5] }));
    expect(bubble.genesis.competitiveness).toBeLessThan(normal.genesis.competitiveness);
    expect(celestial.genesis.competitiveness).toBeLessThan(normal.genesis.competitiveness);
  });

  it('breed standards produce their named variety on most founder backgrounds', () => {
    const clean: Partial<Record<GoldfishLocus, [number, number]>> = {
      gf_eye_program: [0, 0], gf_bubble_program: [0, 0], gf_pompon: [0, 0], gf_pearlscale: [1, 1], gf_hood_a: [1, 1], gf_hood_b: [1, 1],
      gf_dorsal_loss_a: [0, 0], gf_dorsal_loss_b: [0, 0], gf_color_break: [4, 4], gf_albino: [0, 0], gf_swim_bladder: [4, 4],
    };
    for (const [variety, template] of Object.entries(VARIETY_TEMPLATES) as [GoldfishVariety, Partial<Record<GoldfishLocus, [number, number]>>][]) {
      const hits = Array.from({ length: 30 }, (_, i) => expressGoldfish(set(founder(100 + i), { ...clean, ...template })).variety.id).filter(id => id === variety).length;
      expect(hits, variety).toBeGreaterThanOrEqual(18);
    }
  });

  it('describes every locus and keeps phenotypes finite', () => {
    for (let i = 0; i < 60; i++) {
      const genome = founder(200 + i), p = expressGoldfish(genome);
      expect(describeGoldfishGenotype(genome)).toHaveLength(72);
      for (const value of [p.adultLengthCm, p.speed, p.oxygen, p.growth, p.fertility, p.body.depth, p.fins.length, p.genesis.vigor]) expect(Number.isFinite(value)).toBe(true);
      expect(p.adultLengthCm).toBeGreaterThan(5); expect(p.adultLengthCm).toBeLessThan(40);
      expect(goldfishHeterozygosity(genome)).toBeGreaterThan(0.2);
      expect(p.variety.name.length).toBeGreaterThan(2);
    }
  });
});
