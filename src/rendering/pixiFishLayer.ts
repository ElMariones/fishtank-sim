import type { Application, Container, Matrix, Sprite, Texture } from 'pixi.js';
import { anatomyFor } from '../core/anatomy';
import { axolotlAnatomyFor } from '../core/axolotlAnatomy';
import { goldfishAnatomyFor } from '../core/goldfishAnatomy';
import type { Phenotype } from '../core/types';
import { drawFish, type SwimMotion } from './fish';
import { effortBucket, groundedBucket, phaseBucket, sizeBucket, sizeOf, SPRITE_DETAIL_PX } from './lod';
import { rasterizeFish, type Frame } from './spriteCache';

/**
 * Renderer v9 fish layer (R-204): PixiJS draws every fish as a GPU sprite over the Canvas 2D aquascape.
 *
 * Pixels still come from the one vector renderer, `drawFish`, so a fish looks the same in every backend (FS-701):
 * - **Small fish** (below the sprite threshold) use the shared flipbook frames from `rasterizeFish`, uploaded once as
 *   textures and batched.
 * - **Larger fish** keep a canvas of their own, redrawn with the exact live motion, clock and full detail, then uploaded.
 *   In crowded tanks those redraws alternate frames, so the GPU path stays fast as tanks fill.
 *
 * The layer holds pixels only. It never reads or writes a fish record, and losing it costs only a re-rasterization.
 */
export type FishDraw = {
  id: string; phenotype: Phenotype; seed: number; size: number; bodyLength: number;
  x: number; y: number; flip: number; angle: number; motion: SwimMotion; time: number;
};
type PixiModule = typeof import('pixi.js');
type Live = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; texture: Texture; key: string; offsetX: number; offsetY: number; width: number; height: number };
type Entry = { sprite: Sprite; live: Live | null; seen: number };

/** Above this many live-drawn fish, each redraws every other frame. */
export const LIVE_BUDGET = 24;
const FRAME_BUDGET_BYTES = 32 * 1024 * 1024;
const PADDING = 0.06;

const identities = new WeakMap<Phenotype, number>();
let nextIdentity = 1;
const identityOf = (p: Phenotype) => { let id = identities.get(p); if (id === undefined) { id = nextIdentity++; identities.set(p, id); } return id; };
const boundsOf = (p: Phenotype) => p.species === 'goldfish' && p.goldfish ? goldfishAnatomyFor(p.goldfish).bounds
  : p.species === 'axolotl' && p.axolotl ? axolotlAnatomyFor(p.axolotl).bounds : anatomyFor(p).bounds;
const lengthOf = (p: Phenotype) => p.goldfish ? p.goldfish.body.length : p.length;

/**
 * The 2D affine matrix the Canvas renderer builds with translate(x, y) → scale(flip, 1) → rotate(angle) → scale(s).
 * `flip` is continuous (a turning fish narrows through side-on), so this is a general affine map, not a rotation.
 */
export function fishMatrix(x: number, y: number, flip: number, angle: number, s: number): [number, number, number, number, number, number] {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  return [flip * cos * s, sin * s, -flip * sin * s, cos * s, x, y];
}

/** Which live fish redraw on this frame: all of them under the budget, otherwise alternating halves. */
export const redrawsThisFrame = (index: number, liveCount: number, frame: number) => liveCount <= LIVE_BUDGET || (index + frame) % 2 === 0;

export class PixiFishLayer {
  private entries = new Map<string, Entry>();
  private frames = new Map<string, { texture: Texture; frame: Frame }>();
  private frameBytes = 0;
  private tick = 0;
  private matrix: Matrix;

  private constructor(private pixi: PixiModule, private app: Application, private stage: Container, private dpr: number) {
    this.matrix = new pixi.Matrix();
  }

  /** Null when WebGL (or WebGPU) cannot start; the caller then keeps the Canvas 2D path. */
  static async create(canvas: HTMLCanvasElement, width: number, height: number, dpr: number): Promise<PixiFishLayer | null> {
    try {
      const pixi = await import('pixi.js');
      const app = new pixi.Application();
      await app.init({ canvas, width: Math.max(1, width), height: Math.max(1, height), resolution: dpr, autoDensity: false, backgroundAlpha: 0, antialias: false, preference: 'webgl', autoStart: false, sharedTicker: false });
      app.ticker.stop();
      const stage = new pixi.Container();
      app.stage.addChild(stage);
      return new PixiFishLayer(pixi, app, stage, dpr);
    } catch (error) {
      console.warn('PixiJS fish layer unavailable; drawing fish with Canvas 2D.', error);
      return null;
    }
  }

  resize(width: number, height: number, dpr: number) {
    if (dpr !== this.dpr) { this.dpr = dpr; this.app.renderer.resolution = dpr; this.dropLive(); this.dropFrames(); }
    this.app.renderer.resize(Math.max(1, width), Math.max(1, height));
  }

  /** Draw one frame of fish, in paint order. */
  render(fish: readonly FishDraw[]) {
    this.tick++;
    const liveCount = fish.filter(f => f.bodyLength * this.dpr >= SPRITE_DETAIL_PX).length;
    let liveIndex = 0;
    fish.forEach((f, order) => {
      let entry = this.entries.get(f.id);
      if (!entry) { entry = { sprite: new this.pixi.Sprite(), live: null, seen: 0 }; this.stage.addChild(entry.sprite); this.entries.set(f.id, entry); }
      entry.seen = this.tick;
      entry.sprite.visible = true;
      entry.sprite.zIndex = order;
      const drawn = f.bodyLength * this.dpr >= SPRITE_DETAIL_PX
        ? this.live(entry, f, redrawsThisFrame(liveIndex++, liveCount, this.tick))
        : this.flipbook(entry, f);
      if (!drawn) entry.sprite.visible = false;
    });
    for (const [id, entry] of this.entries) {
      if (entry.seen === this.tick) continue;
      // Fish that left the tank: free their sprite and live canvas.
      entry.sprite.destroy(); if (entry.live) entry.live.texture.destroy(true);
      this.entries.delete(id);
    }
    this.stage.sortChildren();
    this.app.render();
  }

  private place(sprite: Sprite, f: FishDraw, scale: number) {
    const [a, b, c, d, tx, ty] = fishMatrix(f.x, f.y, f.flip, f.angle, scale);
    this.matrix.set(a, b, c, d, tx, ty);
    sprite.setFromMatrix(this.matrix);
  }

  /** A small fish from a cached flipbook frame. */
  private flipbook(entry: Entry, f: FishDraw): boolean {
    if (entry.live) { entry.live.texture.destroy(true); entry.live = null; }
    const bucket = sizeBucket(f.size * this.dpr), phase = phaseBucket(f.motion.tailPhase), effort = effortBucket(f.motion.effort), grounded = groundedBucket(f.motion.grounded ?? 0);
    const key = `${identityOf(f.phenotype)}:${f.seed}:${bucket}:${phase}:${effort}:${grounded}`;
    let cached = this.frames.get(key);
    if (cached) { this.frames.delete(key); this.frames.set(key, cached); }
    else {
      const frame = rasterizeFish(f.phenotype, f.seed, { size: bucket, phase, effort, grounded });
      if (!frame) return false;
      cached = { texture: this.pixi.Texture.from(frame.canvas as HTMLCanvasElement), frame };
      this.frames.set(key, cached); this.frameBytes += frame.bytes;
      this.evictFrames();
    }
    entry.sprite.texture = cached.texture;
    entry.sprite.anchor.set(-cached.frame.offsetX / cached.frame.width, -cached.frame.offsetY / cached.frame.height);
    this.place(entry.sprite, f, f.size / sizeOf(bucket));
    return true;
  }

  /** A larger fish redrawn into its own canvas with exact motion, then uploaded. */
  private live(entry: Entry, f: FishDraw, redraw: boolean): boolean {
    const dpr = this.dpr, bucket = sizeBucket(f.size * dpr), key = `${identityOf(f.phenotype)}:${f.seed}:${bucket}`;
    let live = entry.live;
    if (!live || live.key !== key) {
      if (live) live.texture.destroy(true);
      // Sized for the top of the size step, so a growing fish reuses its canvas until it reaches the next step.
      const top = sizeOf(bucket) / dpr, bounds = boundsOf(f.phenotype), length = top * lengthOf(f.phenotype), pad = length * PADDING;
      const offsetX = bounds.minX * length - pad, offsetY = bounds.minY * length - pad;
      const width = Math.ceil(((bounds.maxX - bounds.minX) * length + pad * 2) * dpr), height = Math.ceil(((bounds.maxY - bounds.minY) * length + pad * 2) * dpr);
      if (!(width > 0) || !(height > 0) || width > 4096 || height > 4096) return false;
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      live = { canvas, ctx, texture: this.pixi.Texture.from(canvas), key, offsetX, offsetY, width, height };
      entry.live = live; redraw = true;
    }
    if (redraw) {
      const { ctx } = live;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, live.width, live.height);
      ctx.setTransform(dpr, 0, 0, dpr, -live.offsetX * dpr, -live.offsetY * dpr);
      drawFish(ctx, f.phenotype, f.seed, f.size, f.time, f.motion);
      live.texture.source.update();
    }
    entry.sprite.texture = live.texture;
    entry.sprite.anchor.set(-live.offsetX * dpr / live.width, -live.offsetY * dpr / live.height);
    this.place(entry.sprite, f, 1 / dpr);
    return true;
  }

  private evictFrames() {
    while (this.frameBytes > FRAME_BUDGET_BYTES && this.frames.size > 1) {
      const oldest = this.frames.keys().next().value!;
      const cached = this.frames.get(oldest)!;
      // A frame still shown this tick stays; everything else in insertion order is older.
      if ([...this.entries.values()].some(entry => entry.sprite.texture === cached.texture)) { this.frames.delete(oldest); this.frames.set(oldest, cached); break; }
      this.frames.delete(oldest); this.frameBytes -= cached.frame.bytes;
      cached.texture.destroy(true);
    }
  }

  private dropLive() { for (const entry of this.entries.values()) { if (entry.live) entry.live.texture.destroy(true); entry.live = null; } }
  private dropFrames() { for (const cached of this.frames.values()) cached.texture.destroy(true); this.frames.clear(); this.frameBytes = 0; }

  stats() { return { sprites: this.entries.size, frames: this.frames.size, frameBytes: this.frameBytes, live: [...this.entries.values()].filter(entry => entry.live).length }; }

  /** Hide every fish (for example while the tank switches). */
  clear() { for (const entry of this.entries.values()) entry.sprite.visible = false; this.app.render(); }

  destroy() {
    this.dropLive(); this.dropFrames();
    this.app.destroy({ removeView: false }, { children: true, texture: false });
    this.entries.clear();
  }
}
