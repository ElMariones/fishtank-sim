import { anatomyFor, section, type Anatomy } from './anatomy';
import { LOCI, MUTATION_RATE } from './catalog';
import { express, founderGenome, inherit } from './genetics';
import { MARKING_VISIBLE_ALPHA, markingPosition, placeMarkings, type PlacedMarking } from './pattern';
import { clamp, hash, random } from './random';
import type { Genome, Phenotype } from './types';

/** Mask grid over body coordinates: columns along the body, rows from dorsal to ventral edge. */
export const MASK_COLUMNS = 36;
export const MASK_ROWS = 14;

export type PatternModel = 'inherited' | 'independent';

let standard: Anatomy | undefined;
/** Markings are compared on one all-A2 body so silhouette differences cannot pass for pattern resemblance. */
function standardAnatomy(): Anatomy {
  return standard ??= anatomyFor(express({ version: 1, maternal: Array(LOCI.length).fill(2), paternal: Array(LOCI.length).fill(2) }));
}

/** Renderer v1/v2 placement, independent per birth seed, re-expressed in body coordinates for comparison. */
export function independentPlacedMarkings(p: Phenotype, seed: number): PlacedMarking[] {
  const a = anatomyFor(p), rng = random(seed);
  return Array.from({ length: p.frequency }, (_, i) => {
    const x = (rng() - 0.5) * 1.2, y = (rng() - 0.5) * p.depth * (1 - p.symmetry * 0.5);
    const radius = p.patternScale * (0.5 + rng()), angle = rng() * 3;
    const s = section(a, clamp(x, a.snoutX, 0.5));
    return {
      key: `independent-${i}`, u: (x - a.snoutX) / (0.5 - a.snoutX), v: s.half > 1e-9 ? (y - s.center) / s.half : Math.sign(y - s.center) * 9,
      radius, aspect: 0.5 + p.warp, angle, layer: i % 3 === 0 ? 'dark' : 'warm', satellite: false,
    };
  });
}

/** Binary visible-marking mask (warm and dark channels) on the standard body. */
export function markingMask(p: Phenotype, seed: number, model: PatternModel = 'inherited'): Uint8Array {
  const a = standardAnatomy();
  const visible = { warm: p.red * (1 - p.translucency) >= MARKING_VISIBLE_ALPHA, dark: p.black * (1 - p.translucency) >= MARKING_VISIBLE_ALPHA };
  const shapes = (model === 'inherited' ? placeMarkings(p, seed) : independentPlacedMarkings(p, seed)).filter(m => visible[m.layer]).map(m => ({
    channel: m.layer === 'dark' ? 1 : 0, center: markingPosition(a, m), rx: m.radius, ry: m.radius * m.aspect, cos: Math.cos(m.angle), sin: Math.sin(m.angle),
  }));
  const mask = new Uint8Array(MASK_COLUMNS * MASK_ROWS * 2);
  for (let column = 0; column < MASK_COLUMNS; column++) {
    const x = a.snoutX + (0.5 - a.snoutX) * (column + 0.5) / MASK_COLUMNS, s = section(a, x);
    for (let row = 0; row < MASK_ROWS; row++) {
      const y = s.center + s.half * (((row + 0.5) / MASK_ROWS) * 2 - 1);
      for (const shape of shapes) {
        const dx = x - shape.center.x, dy = y - shape.center.y;
        const along = dx * shape.cos + dy * shape.sin, across = -dx * shape.sin + dy * shape.cos;
        if ((along / shape.rx) ** 2 + (across / shape.ry) ** 2 <= 1) mask[(column * MASK_ROWS + row) * 2 + shape.channel] = 1;
      }
    }
  }
  return mask;
}

/** Jaccard overlap of two masks; two unmarked fish are identical. */
export function maskSimilarity(a: Uint8Array, b: Uint8Array): number {
  let both = 0, either = 0;
  for (let i = 0; i < a.length; i++) { both += a[i] & b[i]; either += a[i] | b[i]; }
  return either ? both / either : 1;
}

/** Probability that a random related pair scores above a random unrelated pair (ties count half). 0.5 = no family signal. */
export function separation(related: number[], unrelated: number[]): number {
  const ranked = [...related.map(value => ({ value, related: true })), ...unrelated.map(value => ({ value, related: false }))].sort((a, b) => a.value - b.value);
  let rankSum = 0;
  for (let i = 0; i < ranked.length;) {
    let j = i;
    while (j < ranked.length && ranked[j].value === ranked[i].value) j++;
    const averageRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) if (ranked[k].related) rankSum += averageRank;
    i = j;
  }
  return (rankSum - related.length * (related.length + 1) / 2) / (related.length * unrelated.length);
}

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);

export type StudyFish = { genome: Genome; phenotype: Phenotype; seed: number };
export type StudyFamily = { mother: StudyFish; father: StudyFish; children: StudyFish[] };

/** Unrelated founder pairs, each with a full-sibling cohort, at the lab mutation rate. Fully seeded; genome v1 keeps FS-103 results fixed. */
export function studyFamilies(families: number, childrenPerFamily: number, salt = 'fs-103'): StudyFamily[] {
  const fish = (genome: Genome, seed: number): StudyFish => ({ genome, phenotype: express(genome), seed });
  return Array.from({ length: families }, (_, f) => {
    const motherSeed = hash(`${salt}:family:${f}:mother`), fatherSeed = hash(`${salt}:family:${f}:father`);
    const mother = fish(founderGenome(motherSeed, 1), motherSeed), father = fish(founderGenome(fatherSeed, 1), fatherSeed);
    const children = Array.from({ length: childrenPerFamily }, (_, c) => {
      const seed = hash(`${salt}:family:${f}:child:${c}`);
      return fish(inherit(mother.genome, father.genome, seed, MUTATION_RATE, 1).genome, seed);
    });
    return { mother, father, children };
  });
}

export type ResemblanceSummary = {
  siblingMean: number; unrelatedMean: number; parentChildMean: number; unrelatedAdultChildMean: number;
  siblingSeparation: number; parentSeparation: number; siblingPairs: number; unrelatedPairs: number;
};

export function summarizeResemblance(families: StudyFamily[], model: PatternModel): ResemblanceSummary {
  const masks = families.map(family => ({
    mother: markingMask(family.mother.phenotype, family.mother.seed, model), father: markingMask(family.father.phenotype, family.father.seed, model),
    children: family.children.map(child => markingMask(child.phenotype, child.seed, model)),
  }));
  const sibling: number[] = [], unrelated: number[] = [], parent: number[] = [], unrelatedAdult: number[] = [];
  masks.forEach((family, f) => {
    const next = masks[(f + 1) % masks.length], distant = masks[(f + Math.ceil(masks.length / 2)) % masks.length];
    family.children.forEach((child, c) => {
      for (let d = c + 1; d < family.children.length; d++) sibling.push(maskSimilarity(child, family.children[d]));
      unrelated.push(maskSimilarity(child, next.children[c]), maskSimilarity(child, distant.children[(c + 1) % distant.children.length]));
      parent.push(maskSimilarity(child, family.mother), maskSimilarity(child, family.father));
      unrelatedAdult.push(maskSimilarity(child, next.mother), maskSimilarity(child, next.father));
    });
  });
  return {
    siblingMean: mean(sibling), unrelatedMean: mean(unrelated), parentChildMean: mean(parent), unrelatedAdultChildMean: mean(unrelatedAdult),
    siblingSeparation: separation(sibling, unrelated), parentSeparation: separation(parent, unrelatedAdult), siblingPairs: sibling.length, unrelatedPairs: unrelated.length,
  };
}

export type PatternResemblanceReport = { families: number; childrenPerFamily: number; inherited: ResemblanceSummary; independent: ResemblanceSummary };

export function patternResemblanceReport(families = 24, childrenPerFamily = 10): PatternResemblanceReport {
  const study = studyFamilies(families, childrenPerFamily);
  return { families, childrenPerFamily, inherited: summarizeResemblance(study, 'inherited'), independent: summarizeResemblance(study, 'independent') };
}
