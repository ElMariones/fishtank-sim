import { describe, expect, it } from 'vitest';
import { GUPPY_LOCUS_INDEX, GUPPY_VARIANT_FROM, SEX_LOCUS, Y_FROM, Y_PROGRAM_LOCUS } from '../src/core/guppyCatalog';
import {
  expressGuppy, guppyFounderGenome, guppyGenomeProblem, guppySex, inheritGuppy, isGuppyGenome, type GuppyGenome,
} from '../src/core/guppyGenetics';
import { guppyAnatomyFor, guppyContainsPoint, guppyPortraitFrame } from '../src/core/guppyAnatomy';
import { STRAIN_TEMPLATES, withGuppyAlleles } from '../src/core/guppyShop';
import { express } from '../src/core/genetics';
import { guppyMaturity, stagePhenotype } from '../src/core/juvenile';
import { livebirthLife } from '../src/core/breeding';
import { drawFish } from '../src/rendering/fish';
import { measureWork } from './support/recordingContext';

const female = (seed = 11) => guppyFounderGenome(seed, 'F');
const male = (seed = 12) => guppyFounderGenome(seed, 'M');
const set = (genome: GuppyGenome, locus: keyof typeof GUPPY_LOCUS_INDEX, maternal: number, paternal: number): GuppyGenome => {
  const i = GUPPY_LOCUS_INDEX[locus], next = structuredClone(genome);
  next.maternal[i] = maternal; next.paternal[i] = paternal;
  return next;
};
const brood = (mother: GuppyGenome, father: GuppyGenome, count: number, salt = 'brood') =>
  Array.from({ length: count }, (_, i) => inheritGuppy(mother, father, hash32(`${salt}:${i}`), 0).genome);
function hash32(text: string) { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

describe('guppy genome v1: XY sex chromosome', () => {
  it('founds valid females and males whose Y sits on the paternal homolog', () => {
    const f = female(), m = male();
    expect(isGuppyGenome(f)).toBe(true); expect(isGuppyGenome(m)).toBe(true);
    expect(guppySex(f)).toBe('F'); expect(guppySex(m)).toBe('M');
    expect(f.maternal[SEX_LOCUS]).toBeLessThan(Y_FROM); expect(f.paternal[SEX_LOCUS]).toBeLessThan(Y_FROM);
    expect(m.paternal[SEX_LOCUS]).toBeGreaterThanOrEqual(Y_FROM); expect(m.maternal[SEX_LOCUS]).toBeLessThan(Y_FROM);
  });

  it('rejects a Y inherited from a mother and a female-only sex region on a male copy', () => {
    const bad = set(female(), 'gp_sex', Y_FROM, 0);
    expect(guppyGenomeProblem(bad)).not.toBeNull();
    expect(isGuppyGenome(bad)).toBe(false);
  });

  it('gives a 1:1 sex ratio and passes the father’s Y program to every son unchanged', () => {
    const f = female(21), m = set(male(22), 'gp_y_program', 0, 3);
    const young = brood(f, m, 600);
    const sons = young.filter(g => guppySex(g) === 'M');
    expect(sons.length / young.length).toBeGreaterThan(0.44); expect(sons.length / young.length).toBeLessThan(0.56);
    for (const son of sons) { expect(son.paternal[SEX_LOCUS]).toBeGreaterThanOrEqual(Y_FROM); expect(son.paternal[Y_PROGRAM_LOCUS]).toBe(3); }
    for (const daughter of young.filter(g => guppySex(g) === 'F')) expect(daughter.paternal[Y_PROGRAM_LOCUS]).toBe(m.maternal[Y_PROGRAM_LOCUS]);
    expect(sons.every(son => expressGuppy(son).color.programs.includes('moscow'))).toBe(true);
  });

  it('moves double sword from Y to X at the Winge rate, and only rarely', () => {
    const f = set(female(31), 'gp_double_sword', 0, 0), m = set(male(32), 'gp_double_sword', 0, GUPPY_VARIANT_FROM);
    const daughters = brood(f, m, 6000, 'winge').filter(g => guppySex(g) === 'F');
    const moved = daughters.filter(g => g.paternal[GUPPY_LOCUS_INDEX.gp_double_sword] >= GUPPY_VARIANT_FROM).length / daughters.length;
    expect(moved).toBeGreaterThan(0.004); expect(moved).toBeLessThan(0.035);
  });

  it('limits male color to males: a female shows only her leak, a male shows all of it', () => {
    const f = expressGuppy(female(41)), m = expressGuppy(male(42));
    expect(m.color.expression).toBe(1);
    expect(f.color.expression).toBe(f.color.leak); expect(f.color.leak).toBeLessThan(0.4);
    expect(f.strain.id).toBe('female'); expect(f.adultLengthCm).toBeGreaterThan(m.adultLengthCm * 0.9);
  });

  it('segregates an albino recessive about 1:3 from two carriers', () => {
    const i = GUPPY_LOCUS_INDEX.gp_albino;
    const f = set(female(51), 'gp_albino', GUPPY_VARIANT_FROM, 0), m = set(male(52), 'gp_albino', 0, GUPPY_VARIANT_FROM);
    expect(expressGuppy(f).carriers).toContain('gp_albino');
    const young = brood(f, m, 800, 'albino');
    const albino = young.filter(g => g.maternal[i] >= GUPPY_VARIANT_FROM && g.paternal[i] >= GUPPY_VARIANT_FROM);
    expect(albino.length / young.length).toBeGreaterThan(0.19); expect(albino.length / young.length).toBeLessThan(0.31);
    for (const g of albino.slice(0, 5)) expect(expressGuppy(g).color.base).toBe('albino');
  });

  it('makes ribbon males unable to sire', () => {
    const ribbon = expressGuppy(set(male(61), 'gp_ribbon', 0, GUPPY_VARIANT_FROM));
    expect(ribbon.fins.ribbon).toBeGreaterThan(0); expect(ribbon.health.canSire).toBe(false);
    expect(expressGuppy(set(female(62), 'gp_ribbon', GUPPY_VARIANT_FROM, 0)).health.canSire).toBe(true);
  });
});

describe('guppy anatomy and rendering', () => {
  const strains = Object.keys(STRAIN_TEMPLATES) as (keyof typeof STRAIN_TEMPLATES)[];
  it('builds finite, framed, pickable anatomy for every strain template and both sexes', () => {
    [...strains.map((strain, i) => withGuppyAlleles(male(100 + i), STRAIN_TEMPLATES[strain]!)), female(90), female(91)].forEach(genome => {
      const p = expressGuppy(genome), a = guppyAnatomyFor(p);
      for (const v of Object.values(a.bounds)) expect(Number.isFinite(v)).toBe(true);
      expect(guppyContainsPoint(a, { x: -0.1, y: 0 })).toBe(true);
      expect(guppyContainsPoint(a, { x: 3, y: 3 })).toBe(false);
      const frame = guppyPortraitFrame(p, 240, 160), l = frame.size * p.body.length;
      expect(frame.originX + a.bounds.minX * l).toBeGreaterThanOrEqual(-0.5); expect(frame.originX + a.bounds.maxX * l).toBeLessThanOrEqual(240.5);
      expect(frame.originY + a.bounds.minY * l).toBeGreaterThanOrEqual(-0.5); expect(frame.originY + a.bounds.maxY * l).toBeLessThanOrEqual(160.5);
    });
  });

  it('draws guppies through the shared fish entry point', () => {
    for (const genome of [withGuppyAlleles(male(120), STRAIN_TEMPLATES[strains[0]]!), female(121)]) {
      const work = measureWork(ctx => drawFish(ctx, express(genome), 7, 60, 1.2, { tailPhase: 1, finPhase: 2, effort: 0.5, grounded: 0 }));
      expect(work.fills).toBeGreaterThan(5); expect(work.total).toBeGreaterThan(50);
    }
  });

  it('keeps a newborn male grey until his color onset, and swells a gravid female', () => {
    const adult = express(male(130)), p = adult.guppy!;
    const newborn = stagePhenotype(adult, guppyMaturity(livebirthLife(), p));
    expect(newborn.guppy!.color.expression).toBeLessThan(0.5);
    const grown = guppyMaturity({ ...livebirthLife(), ageDays: 200, lengthCm: p.adultLengthCm }, p);
    expect(grown.color).toBe(1);
    const mother = express(female(131));
    const gravid = stagePhenotype(mother, { body: 1, pigment: 1, gravid: 0.8 });
    expect(gravid.guppy!.gravid).toBe(0.8);
    expect(guppyAnatomyFor(gravid.guppy!).bounds.maxY).toBeGreaterThan(guppyAnatomyFor(mother.guppy!).bounds.maxY);
  });
});
