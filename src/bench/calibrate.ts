import type { Phenotype } from '../core/types';
import {
  APPEARANCE_VISUAL_FIXTURES,
  COHORT_VISUAL_FIXTURES,
  EXTREME_VISUAL_FIXTURES,
  FOUNDER_VISUAL_FIXTURES,
  STRUCTURE_VISUAL_FIXTURES,
} from '../core/visualFixtures';
import { anatomyFor } from '../core/anatomy';
import { drawFish, type SwimMotion } from '../rendering/fish';
import { FULL_DETAIL, SPRITE_DETAIL, type Detail } from '../rendering/lod';

/**
 * Threshold calibration for FS-701.
 *
 * The detail tiers are only honest if the marks they drop are genuinely invisible at the size they are dropped. This
 * renders the same fish twice — once at full detail, once at a reduced tier — and measures the difference in pixels,
 * at a ladder of sizes. The thresholds in `lod.ts` are read off the result, rather than asserted and hoped for.
 */

const SUBJECTS = [
  ...FOUNDER_VISUAL_FIXTURES,
  ...COHORT_VISUAL_FIXTURES.flatMap(cohort => [cohort.mother, cohort.father, ...cohort.children]),
  ...EXTREME_VISUAL_FIXTURES,
  ...APPEARANCE_VISUAL_FIXTURES,
  ...STRUCTURE_VISUAL_FIXTURES,
];

const MOTION: SwimMotion = { tailPhase: 1.3, finPhase: 2.1, effort: 0.6 };

export type Difference = {
  /** Body length in device pixels. */
  px: number;
  tier: string;
  /** Share of the fish's drawn pixels whose colour moved at all. */
  changedShare: number;
  /** Largest single-channel change anywhere, 0–255. Below about 2 nothing is perceptible on a lit screen. */
  maxDelta: number;
  /** Mean single-channel change over the fish's drawn pixels. */
  meanDelta: number;
};

function renderOne(p: Phenotype, seed: number, bodyLengthPx: number, detail: Detail): ImageData {
  const bounds = anatomyFor(p).bounds;
  const size = bodyLengthPx / p.length;
  const pad = bodyLengthPx * 0.1;
  const width = Math.ceil((bounds.maxX - bounds.minX) * bodyLengthPx + pad * 2);
  const height = Math.ceil((bounds.maxY - bounds.minY) * bodyLengthPx + pad * 2);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width); canvas.height = Math.max(1, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.translate(-(bounds.minX * bodyLengthPx - pad), -(bounds.minY * bodyLengthPx - pad));
  drawFish(ctx, p, seed, size, 0, MOTION, detail);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function compare(a: ImageData, b: ImageData): Omit<Difference, 'px' | 'tier'> {
  let changed = 0, drawn = 0, maxDelta = 0, sum = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    const opaque = a.data[i + 3] > 8 || b.data[i + 3] > 8;
    if (!opaque) continue;
    drawn++;
    let worst = 0;
    for (let c = 0; c < 4; c++) worst = Math.max(worst, Math.abs(a.data[i + c] - b.data[i + c]));
    if (worst > 0) changed++;
    sum += worst;
    maxDelta = Math.max(maxDelta, worst);
  }
  return {
    changedShare: drawn ? +(changed / drawn).toFixed(4) : 0,
    maxDelta,
    meanDelta: drawn ? +(sum / drawn).toFixed(3) : 0,
  };
}

/** The size ladder the thresholds are read off. Spans a fry on a small window to an adult on a large one. */
export const SIZES = [16, 24, 32, 40, 44, 56, 64, 72, 80, 88, 96, 112, 128, 160, 192];

/**
 * Measure every tier against full detail at every size, over `sampleCount` fixtures.
 *
 * Returns the worst case across the sample at each size: a threshold has to hold for the fish most affected by it, not
 * for an average fish.
 */
/**
 * Each feature on its own, plus the assembled tiers.
 *
 * Attributing the difference per feature is the point: a feature whose difference shrinks with size can be dropped
 * below some threshold, and one whose difference is flat cannot be dropped at any size at all.
 */
const CUTS: [string, Detail][] = [
  ['-speckle', { ...FULL_DETAIL, speckle: false }],
  ['-sparkle', { ...FULL_DETAIL, sparkle: false }],
  ['-finRays', { ...FULL_DETAIL, finRays: false }],
  ['-glow', { ...FULL_DETAIL, markingGlow: false }],
  ['sprite (shipped)', SPRITE_DETAIL],
];

export function calibrate(sampleCount = 12, cuts: [string, Detail][] = CUTS): Difference[] {
  const koi = SUBJECTS.filter(s => s.phenotype.species !== 'axolotl');
  const step = Math.max(1, Math.floor(koi.length / sampleCount));
  const sample = koi.filter((_, i) => i % step === 0).slice(0, sampleCount);
  const rows: Difference[] = [];
  for (const px of SIZES) {
    for (const [tier, detail] of cuts) {
      let worst: Omit<Difference, 'px' | 'tier'> = { changedShare: 0, maxDelta: 0, meanDelta: 0 };
      for (const subject of sample) {
        const full = renderOne(subject.phenotype, subject.birthSeed, px, FULL_DETAIL);
        const cut = renderOne(subject.phenotype, subject.birthSeed, px, detail);
        const diff = compare(full, cut);
        if (diff.meanDelta > worst.meanDelta) worst = diff;
      }
      rows.push({ px, tier, ...worst });
    }
  }
  return rows;
}

/** Body lengths the live tank actually produces, so a threshold can be checked against what players see. */
export function bodyLengthRange(canvasWidth: number, dpr: number) {
  const lengths = SUBJECTS.map(s => {
    const size = Math.min(canvasWidth / 10, 79) * (0.8 + s.phenotype.adultLengthCm / 200);
    return size * s.phenotype.length * dpr;
  }).sort((a, b) => a - b);
  const at = (p: number) => +lengths[Math.floor(lengths.length * p)].toFixed(1);
  return { adultMin: at(0), adultP10: at(0.1), adultP50: at(0.5), adultP90: at(0.9), adultMax: +lengths[lengths.length - 1].toFixed(1), fryP50: +(at(0.5) * 0.25).toFixed(1) };
}
