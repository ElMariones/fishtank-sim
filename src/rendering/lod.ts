/**
 * Renderer level of detail (FS-701).
 *
 * The spike set out to shed "detail" from small fish and found there is almost none to shed. Measured against full
 * detail over 14 fixtures at body lengths from 16 to 192 device pixels (`src/bench/calibrate.ts`), the mean per-channel
 * difference of dropping each feature was:
 *
 * | dropped        | 16px | 44px | 96px | 192px | shape                      |
 * |----------------|-----:|-----:|-----:|------:|----------------------------|
 * | marking glow   | 13.2 | 17.0 | 19.1 |  20.4 | flat, large at every size  |
 * | fin rays       | 13.7 | 11.1 |  6.6 |   3.7 | **worst when small**       |
 * | shimmer sparks |  1.3 |  2.4 |  3.0 |   3.2 | grows with size            |
 * | stipple        |  0.4 |  0.5 |  0.6 |   0.6 | negligible                 |
 *
 * Two of those are heritable traits made visible — a marking's soft edge and a shimmering skin — and the third is the
 * cue that reads as a fin. None of them fade as a fish gets smaller; fin rays get *more* important, because their
 * stroke width is absolute while the fish around them shrinks. A tier that dropped them would hide genetics at exactly
 * the sizes a nursery is full of, which is the opposite of what this project promises.
 *
 * So nothing is dropped for quality. What remains is a cache: below `SPRITE_DETAIL_PX` a fish is drawn from a
 * rasterized flipbook frame instead of its vector paths, and that frame is drawn at full detail. The one thing a cached
 * frame cannot do is animate on the clock, so shimmer sparkles are absent from it — the only measured loss, and the
 * smallest of the four at the sizes where it applies.
 */

/** How a fish is drawn. `full` issues the vector paths; `sprite` blits a cached frame of those same paths. */
export type DetailTier = 'full' | 'sprite';

/** Individual features `drawFish` reads. It never reads the tier name. */
export type Detail = {
  tier: DetailTier;
  /** Up to 55 stippled arcs of radius `bodyLength * 0.008`. */
  speckle: boolean;
  /** Shimmer sparkles, which twinkle on the clock and so cannot be baked into a cached frame. */
  sparkle: boolean;
  /** Per-ray strokes inside the caudal and dorsal fins, and the flame gradient over them. */
  finRays: boolean;
  /** The radial gradient that softens each marking's edge. */
  markingGlow: boolean;
};

/** Renderer v7 exactly as it drew before FS-701. Portraits, fixtures and every vector path use this. */
export const FULL_DETAIL: Detail = { tier: 'full', speckle: true, sparkle: true, finRays: true, markingGlow: true };

/**
 * What a flipbook frame is rasterized with: full detail apart from the clock-driven sparkles.
 *
 * This is a structural consequence of caching, not a quality setting. A frame is reused across many moments, so
 * anything that changes with time cannot be in it.
 */
export const SPRITE_DETAIL: Detail = { tier: 'sprite', speckle: true, sparkle: false, finRays: true, markingGlow: true };

/**
 * Body length in device pixels below which a fish is drawn from the sprite cache.
 *
 * Set from two measurements. Below 44 px, dropping the clock-driven sparkles moves a pixel by 2.4/255 on average, the
 * smallest of the measured differences; and the tail beat's amplitude across one quantized phase step stays under a
 * pixel, so the flipbook's 12 steps are not visible as stepping. Above it, both become noticeable and the fish draws
 * its vectors.
 */
export const SPRITE_DETAIL_PX = 44;

/**
 * The detail a fish of this drawn body length gets. `bodyLengthPx` is in device pixels: multiply the CSS body length by
 * the canvas pixel ratio before calling, or a high-density screen will use sprites it has the pixels to beat.
 */
export function detailFor(bodyLengthPx: number): Detail {
  // A size that is not a number is a bug upstream, not a tiny fish: draw it properly rather than cache a broken sprite.
  return bodyLengthPx < SPRITE_DETAIL_PX ? SPRITE_DETAIL : FULL_DETAIL;
}

/**
 * Clamp into `0 … steps - 1`, sending anything that is not a number to the first step.
 *
 * Motion reaches the renderer through the worker's Float32Arrays. A NaN there must not become a NaN bucket: that would
 * key a cache entry on "NaN" and rasterize a frame from NaN geometry, which every later NaN would then be shown.
 */
const step = (value: number, steps: number) => (Number.isFinite(value) ? Math.max(0, Math.min(steps - 1, Math.round(value))) : 0);

/**
 * Sprite tier quantizes the tail beat into this many frames over its 2π period. `drawFish`'s wave is `sin(tailPhase)`
 * and its sweep is `cos(2 * tailPhase)`, so one 2π ladder covers both.
 */
export const PHASE_STEPS = 12;

/** Sprite sizes climb in steps of this ratio, so a growing fish reuses a cached frame instead of rasterizing each pixel. */
export const SIZE_STEP = 1.12;

/** The quantized tail phase a sprite is cached and drawn at. Always in `0 … PHASE_STEPS - 1`. */
export function phaseBucket(tailPhase: number): number {
  if (!Number.isFinite(tailPhase)) return 0;
  const turns = tailPhase / (Math.PI * 2);
  return ((Math.round(turns * PHASE_STEPS) % PHASE_STEPS) + PHASE_STEPS) % PHASE_STEPS;
}

/** The phase a bucket is rasterized at, so the cached frame matches the bucket it is keyed by. */
export const phaseOf = (bucket: number) => (bucket / PHASE_STEPS) * Math.PI * 2;

/** The size a sprite is rasterized at: the next step up the ladder, so a sprite is never scaled up when drawn. */
export function sizeBucket(size: number): number {
  if (!Number.isFinite(size)) return 0;
  return Math.max(0, Math.ceil(Math.log(Math.max(size, 1e-6)) / Math.log(SIZE_STEP)));
}

/** The pixel size a bucket is rasterized at. */
export const sizeOf = (bucket: number) => Math.pow(SIZE_STEP, bucket);

/**
 * Effort (swim speed over top speed) scales the tail beat's amplitude by `0.55 + 0.45 * effort`. Two steps keep a
 * darting fish from sharing a cruising fish's frames without doubling the flipbook twice over.
 */
export const EFFORT_STEPS = 2;
export const effortBucket = (effort: number) => step(effort * (EFFORT_STEPS - 1), EFFORT_STEPS);
export const effortOf = (bucket: number) => bucket / (EFFORT_STEPS - 1);

/** Axolotls settle onto the substrate; their pose reads `grounded`, so a sprite has to be keyed by it as well. */
export const GROUNDED_STEPS = 4;
export const groundedBucket = (grounded: number) => step(grounded * (GROUNDED_STEPS - 1), GROUNDED_STEPS);
export const groundedOf = (bucket: number) => bucket / (GROUNDED_STEPS - 1);
