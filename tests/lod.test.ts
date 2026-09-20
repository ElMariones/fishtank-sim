import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_AXOLOTL_SHAPE } from '../src/core/axolotlAnatomy';
import {
  APPEARANCE_VISUAL_FIXTURES,
  COHORT_VISUAL_FIXTURES,
  EXTREME_VISUAL_FIXTURES,
  FOUNDER_VISUAL_FIXTURES,
  STRUCTURE_VISUAL_FIXTURES,
  type VisualFixtureSubject,
} from '../src/core/visualFixtures';
import { drawAxolotl } from '../src/rendering/axolotl';
import { drawFish, type SwimMotion } from '../src/rendering/fish';
import {
  EFFORT_STEPS,
  FULL_DETAIL,
  GROUNDED_STEPS,
  PHASE_STEPS,
  SIZE_STEP,
  SPRITE_DETAIL,
  SPRITE_DETAIL_PX,
  detailFor,
  effortBucket,
  effortOf,
  groundedBucket,
  phaseBucket,
  phaseOf,
  sizeBucket,
  sizeOf,
  type Detail,
} from '../src/rendering/lod';
import { measureWork, type DrawWork } from './support/recordingContext';

const SUBJECTS: VisualFixtureSubject[] = [
  ...FOUNDER_VISUAL_FIXTURES,
  ...COHORT_VISUAL_FIXTURES.flatMap(cohort => [cohort.mother, cohort.father, ...cohort.children]),
  ...EXTREME_VISUAL_FIXTURES,
  ...APPEARANCE_VISUAL_FIXTURES,
  ...STRUCTURE_VISUAL_FIXTURES,
];

const MOTION: SwimMotion = { tailPhase: 1.3, finPhase: 2.1, effort: 0.6 };

/**
 * The size every work comparison is made at.
 *
 * Tier and size are separate causes of work: the axolotl renderer already drops its pigment granules below a body
 * length of 65px on its own. Measuring at one size isolates what the tier itself changes.
 */
const MEASURE_PX = 120;

const workAt = (subject: VisualFixtureSubject, detail: Detail, size = MEASURE_PX) =>
  measureWork(ctx => drawFish(ctx, subject.phenotype, subject.birthSeed, size, 3.5, MOTION, detail));

/**
 * Ornament paths, palettes and marking placements are cached per phenotype, so a subject's first paint builds geometry
 * every later frame reuses. Warming them first makes every measurement a steady-state frame rather than a first paint.
 */
beforeAll(() => {
  for (const subject of SUBJECTS) {
    for (const detail of [FULL_DETAIL, SPRITE_DETAIL]) workAt(subject, detail);
  }
});

describe('FS-701 detail tiers', () => {
  it('draws vectors at and above the sprite threshold, and only below it uses a cached frame', () => {
    expect(detailFor(SPRITE_DETAIL_PX)).toBe(FULL_DETAIL);
    expect(detailFor(SPRITE_DETAIL_PX + 1000)).toBe(FULL_DETAIL);
    expect(detailFor(SPRITE_DETAIL_PX - 0.001)).toBe(SPRITE_DETAIL);
    expect(detailFor(0)).toBe(SPRITE_DETAIL);
    // A size that is not a number means a bug upstream; it must draw fully rather than cache a broken sprite.
    expect(detailFor(Number.NaN)).toBe(FULL_DETAIL);
    expect(detailFor(Number.POSITIVE_INFINITY)).toBe(FULL_DETAIL);
  });

  it('draws a full-detail fish exactly as renderer v7 did before the tiers existed', () => {
    for (const subject of SUBJECTS) {
      const original = measureWork(ctx => drawFish(ctx, subject.phenotype, subject.birthSeed, MEASURE_PX, 3.5, MOTION));
      expect(workAt(subject, FULL_DETAIL)).toEqual(original);
    }
  });

  /**
   * The measured reason the tiers drop nothing else: a marking's soft edge, its fin rays and its stipple are all
   * heritable traits made visible. Only the clock-driven sparkles are absent from a cached frame, because a frame
   * reused across moments cannot twinkle.
   */
  it('keeps every trait in a sprite frame except the one a cached frame cannot animate', () => {
    expect(SPRITE_DETAIL.markingGlow).toBe(true);
    expect(SPRITE_DETAIL.finRays).toBe(true);
    expect(SPRITE_DETAIL.speckle).toBe(true);
    expect(SPRITE_DETAIL.sparkle).toBe(false);
  });

  it('issues no more work for a sprite frame than for the vector draw it replaces', () => {
    for (const subject of SUBJECTS) {
      expect(workAt(subject, SPRITE_DETAIL).total).toBeLessThanOrEqual(workAt(subject, FULL_DETAIL).total);
    }
  });

  it('honours the tier in the axolotl renderer too, which has no visual fixtures of its own', () => {
    const full = measureWork(ctx => drawAxolotl(ctx, DEFAULT_AXOLOTL_SHAPE, 4242, 120, 3.5, undefined, FULL_DETAIL));
    const sprite = measureWork(ctx => drawAxolotl(ctx, DEFAULT_AXOLOTL_SHAPE, 4242, 120, 3.5, undefined, SPRITE_DETAIL));
    const original = measureWork(ctx => drawAxolotl(ctx, DEFAULT_AXOLOTL_SHAPE, 4242, 120, 3.5));
    // Unchanged by default, and the sprite frame skips only the clock-driven iridophore twinkle.
    expect(full).toEqual(original);
    expect(sprite.total).toBeLessThan(full.total);
  });

  it('reports the per-frame work each tier issues, for the FS-701 evidence table', () => {
    const per = (n: number) => +(n / SUBJECTS.length).toFixed(1);
    const sum = (detail: Detail): DrawWork => SUBJECTS.reduce<DrawWork>((acc, subject) => {
      const w = workAt(subject, detail);
      return {
        segments: acc.segments + w.segments, fills: acc.fills + w.fills, strokes: acc.strokes + w.strokes,
        clips: acc.clips + w.clips, gradients: acc.gradients + w.gradients, images: acc.images + w.images,
        saves: acc.saves + w.saves, total: acc.total + w.total,
      };
    }, { segments: 0, fills: 0, strokes: 0, clips: 0, gradients: 0, images: 0, saves: 0, total: 0 });
    const rows = ([['full (drawn every frame)', FULL_DETAIL], ['sprite (rasterized once, then blitted)', SPRITE_DETAIL]] as const)
      .map(([name, detail]) => {
        const work = sum(detail);
        return { tier: name, perFish: per(work.total), segments: per(work.segments), fills: per(work.fills), strokes: per(work.strokes), clips: per(work.clips), gradients: per(work.gradients) };
      });
    // Printed so the evidence doc can quote measured numbers rather than estimates.
    console.table(rows);
    console.log(`fixtures: ${SUBJECTS.length}, measured at ${MEASURE_PX}px body length; a cached frame costs 1 drawImage instead of the whole row`);
    expect(rows[0].perFish).toBeGreaterThan(rows[1].perFish);
  });
});

describe('FS-701 sprite flipbook buckets', () => {
  it('quantizes the tail beat over its 2π period and wraps cleanly', () => {
    expect(phaseBucket(0)).toBe(0);
    expect(phaseBucket(Math.PI * 2)).toBe(0);
    expect(phaseBucket(-Math.PI * 2)).toBe(0);
    expect(phaseBucket(Math.PI)).toBe(PHASE_STEPS / 2);
    for (let i = 0; i < PHASE_STEPS; i++) expect(phaseBucket(phaseOf(i))).toBe(i);
    // The tank wraps tailPhase at 4π, not 2π, and a paused tank can hold a large accumulated phase.
    for (const phase of [7.9, 12.4, 1000.25, -55.5, Number.NaN]) {
      const bucket = phaseBucket(phase);
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThan(PHASE_STEPS);
    }
  });

  it('never scales a sprite up, and never rasterizes more than one step larger than needed', () => {
    for (const size of [1, 7.5, 12, 30.2, 43.9, 44, 96, 240]) {
      expect(sizeOf(sizeBucket(size))).toBeGreaterThanOrEqual(size - 1e-9);
      expect(sizeOf(sizeBucket(size))).toBeLessThan(size * SIZE_STEP + 1e-9);
    }
    expect(sizeBucket(Number.NaN)).toBe(0);
  });

  it('keeps effort and grounded buckets inside their ladders', () => {
    for (const effort of [-1, 0, 0.49, 0.5, 1, 4, Number.NaN]) {
      const bucket = effortBucket(effort);
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThan(EFFORT_STEPS);
      expect(effortOf(bucket)).toBeGreaterThanOrEqual(0);
      expect(effortOf(bucket)).toBeLessThanOrEqual(1);
    }
    for (const grounded of [-1, 0, 0.33, 0.9, 1, 3, Number.NaN]) {
      const bucket = groundedBucket(grounded);
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThan(GROUNDED_STEPS);
    }
  });

  it('bounds one fish\'s flipbook at one size, so the cache stays predictable', () => {
    expect(PHASE_STEPS * EFFORT_STEPS * GROUNDED_STEPS).toBe(96);
  });
});
