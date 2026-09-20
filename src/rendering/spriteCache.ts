import { anatomyFor } from '../core/anatomy';
import { axolotlAnatomyFor } from '../core/axolotlAnatomy';
import type { Phenotype } from '../core/types';
import { drawFish, type SwimMotion } from './fish';
import { SPRITE_DETAIL, effortBucket, effortOf, groundedBucket, groundedOf, phaseBucket, phaseOf, sizeBucket, sizeOf } from './lod';

/**
 * Flipbook sprite cache for the sprite detail tier (FS-701).
 *
 * A fish small enough to reach this tier is redrawn from a rasterized frame instead of its vector paths. The frames are
 * keyed by everything that changes the drawing — phenotype object, birth seed, size step, tail phase step, effort step
 * and (for axolotls) how grounded the pose is — so a cached frame is never shown for a fish it does not belong to.
 *
 * The cache is a plain LRU over a byte budget. It holds pixels, never identity: nothing here reads or writes a fish
 * record, and dropping the whole cache only costs the rasterization again.
 */

/** Sprites are padded by this fraction of body length, so strokes that ride just outside the anatomy bounds still fit. */
const PADDING = 0.06;

/** Default budget. About 90 small fish worth of frames on a 1.5x display; beyond it, the least recently used frame goes. */
export const DEFAULT_BUDGET_BYTES = 24 * 1024 * 1024;

/** One rasterized flipbook frame. The offsets place its top-left corner relative to the fish's drawing origin. */
export type Frame = { canvas: HTMLCanvasElement | OffscreenCanvas; width: number; height: number; offsetX: number; offsetY: number; bytes: number };

/** The buckets a frame is keyed by. Anything that changes the drawing has to appear here. */
export type FrameKey = { size: number; phase: number; effort: number; grounded: number };

/** A phenotype object's identity. Phenotypes are shared and cached by object, exactly as the anatomy caches key them. */
const identities = new WeakMap<Phenotype, number>();
let nextIdentity = 1;
function identityOf(p: Phenotype): number {
  let id = identities.get(p);
  if (id === undefined) { id = nextIdentity++; identities.set(p, id); }
  return id;
}

function createCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  return canvas;
}

export type SpriteStats = { frames: number; bytes: number; hits: number; misses: number; evictions: number };

export class FishSpriteCache {
  /** Insertion order is recency: a hit deletes and reinserts, so the first key is always the least recently used. */
  private frames = new Map<string, Frame>();
  private bytes = 0;
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(private budgetBytes = DEFAULT_BUDGET_BYTES) {}

  stats(): SpriteStats {
    return { frames: this.frames.size, bytes: this.bytes, hits: this.hits, misses: this.misses, evictions: this.evictions };
  }

  clear() {
    this.frames.clear();
    this.bytes = 0;
  }

  /**
   * Draw `p` at the current transform's origin from a cached frame, rasterizing it first if needed.
   *
   * `size` is the same size `drawFish` takes, in CSS pixels; `dpr` is the canvas pixel ratio, so the frame is rasterized
   * at the density it will be shown at. Returns false without drawing if the fish has no area to rasterize.
   */
  draw(ctx: CanvasRenderingContext2D, p: Phenotype, seed: number, size: number, motion: SwimMotion, dpr: number): boolean {
    const phase = phaseBucket(motion.tailPhase), effort = effortBucket(motion.effort), grounded = groundedBucket(motion.grounded ?? 0);
    const bucket = sizeBucket(size * dpr);
    const key = `${identityOf(p)}:${seed}:${bucket}:${phase}:${effort}:${grounded}`;
    let frame = this.frames.get(key);
    if (frame) {
      this.hits++;
      this.frames.delete(key);
      this.frames.set(key, frame);
    } else {
      this.misses++;
      const made = this.rasterize(p, seed, bucket, phase, effort, grounded);
      if (!made) return false;
      frame = made;
      this.frames.set(key, frame);
      this.bytes += frame.bytes;
      this.evict();
    }
    // The frame holds device pixels and the caller's transform is in CSS pixels, so shrink it by exactly that ratio.
    const scale = size / sizeOf(bucket);
    ctx.drawImage(frame.canvas as CanvasImageSource, frame.offsetX * scale, frame.offsetY * scale, frame.width * scale, frame.height * scale);
    return true;
  }

  private evict() {
    while (this.bytes > this.budgetBytes && this.frames.size > 1) {
      const oldest = this.frames.keys().next();
      if (oldest.done) return;
      const frame = this.frames.get(oldest.value)!;
      this.frames.delete(oldest.value);
      this.bytes -= frame.bytes;
      this.evictions++;
    }
  }

  private rasterize(p: Phenotype, seed: number, bucket: number, phase: number, effort: number, grounded: number): Frame | null {
    return rasterizeFish(p, seed, { size: bucket, phase, effort, grounded });
  }
}

/**
 * Rasterize one flipbook frame at the sprite tier.
 *
 * Exported so a different backend can draw from exactly the pixels the Canvas cache would have used; a comparison
 * between renderers is only fair if both are showing the same image.
 */
export function rasterizeFish(p: Phenotype, seed: number, key: FrameKey): Frame | null {
  // `sizeOf` is already in device pixels: the frame is rasterized at the density it will be drawn at.
  const size = sizeOf(key.size);
  const bounds = p.species === 'axolotl' && p.axolotl ? axolotlAnatomyFor(p.axolotl).bounds : anatomyFor(p).bounds;
  const bodyLength = size * p.length;
  const pad = bodyLength * PADDING;
  const offsetX = bounds.minX * bodyLength - pad, offsetY = bounds.minY * bodyLength - pad;
  const width = Math.ceil((bounds.maxX - bounds.minX) * bodyLength + pad * 2);
  const height = Math.ceil((bounds.maxY - bounds.minY) * bodyLength + pad * 2);
  if (!(width > 0) || !(height > 0)) return null;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
  if (!ctx) return null;
  ctx.translate(-offsetX, -offsetY);
  // Sprites are time-independent: the tier drops sparkles and iridophores, the only clock-driven marks.
  const motion: SwimMotion = { tailPhase: phaseOf(key.phase), finPhase: phaseOf(key.phase), effort: effortOf(key.effort), grounded: groundedOf(key.grounded) };
  drawFish(ctx, p, seed, size, 0, motion, SPRITE_DETAIL);
  return { canvas, width, height, offsetX, offsetY, bytes: width * height * 4 };
}
