import { anatomyFor, tailLobes, TAIL_WAVE, type Vec } from '../core/anatomy';
import type { Phenotype } from '../core/types';
import { drawFish } from '../rendering/fish';
import { FULL_DETAIL, detailFor, effortBucket, phaseBucket, sizeBucket, sizeOf } from '../rendering/lod';
import { FishSpriteCache, rasterizeFish, type Frame } from '../rendering/spriteCache';
import { bodyLengthOf, sizeOfFish, type BenchFish } from './scene';

/**
 * The renderer backends the FS-701 spike compares.
 *
 * Every backend draws the same scene into its own canvas of the same size at the same pixel ratio. They are not all
 * visually identical, and the ones that are not say so in `note`: a timing is only worth reading next to what it drew.
 */
export type Backend = {
  id: string;
  label: string;
  /** What this backend draws, including where it differs from the shipped renderer. Printed with its results. */
  note: string;
  init(host: HTMLElement, width: number, height: number, dpr: number): Promise<void>;
  /** Draw one frame of the already-stepped scene. */
  frame(fish: BenchFish[], width: number, height: number, time: number): void;
  /**
   * Block until the frame just drawn has actually been produced.
   *
   * Both backends queue work: Canvas 2D behind the compositor, WebGL behind the driver. Without a flush, a timing
   * measures how fast a backend can *describe* a frame, which is exactly the measurement that would flatter the GPU
   * path and mislead the decision.
   */
  flush(): void;

  /** Bytes this backend holds in caches it owns, measured rather than sampled. Null when it caches nothing. */
  cacheBytes(): number | null;
  /** A short diagnostic about the backend's own caching, shown beside its timings. */
  stats?(): string | null;
  destroy(): void;
};

/** The tank's own transform chain, so a fish lands where the live renderer would put it. */
function poseOf(f: BenchFish, width: number, height: number) {
  const size = sizeOfFish(f, width);
  return {
    x: f.x * width,
    y: f.y * height,
    flip: f.vx > 0 ? -1 : 1,
    angle: Math.atan2(f.vy, Math.max(Math.abs(f.vx), 0.01)) * (f.vx > 0 ? -0.3 : 0.3),
    size,
  };
}

function make2d(host: HTMLElement, width: number, height: number, dpr: number) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
  host.replaceChildren(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { canvas, ctx };
}

/** Canvas 2D drawing every fish at full detail: the renderer exactly as it shipped before FS-701. */
export function canvasBaseline(): Backend {
  let ctx: CanvasRenderingContext2D | null = null;
  return {
    id: 'canvas-full',
    label: 'Canvas 2D, full detail',
    note: 'The shipped renderer. Every fish draws all of renderer v7 regardless of how small it is on screen.',
    async init(host, width, height, dpr) { ctx = make2d(host, width, height, dpr).ctx; },
    frame(fish, width, height, time) {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      for (const f of fish) {
        const pose = poseOf(f, width, height);
        ctx.save();
        ctx.translate(pose.x, pose.y);
        ctx.scale(pose.flip, 1);
        ctx.rotate(pose.angle);
        drawFish(ctx, f.phenotype, f.seed, pose.size, time, { tailPhase: f.tailPhase, finPhase: f.finPhase, effort: f.effort }, FULL_DETAIL);
        ctx.restore();
      }
    },
    flush() { ctx?.getImageData(0, 0, 1, 1); },
    cacheBytes: () => null,
    destroy() { ctx = null; },
  };
}

/** Canvas 2D with the FS-701 tiers: full detail where it shows, reduced below that, flipbook sprites for fry. */
export function canvasLod(): Backend {
  let ctx: CanvasRenderingContext2D | null = null;
  let ratio = 1;
  const sprites = new FishSpriteCache();
  return {
    id: 'canvas-lod',
    label: 'Canvas 2D, tiers + sprite cache',
    note: 'Full detail at and above 96 device px of body length, reduced below it, cached flipbook frames below 44.',
    async init(host, width, height, dpr) { ctx = make2d(host, width, height, dpr).ctx; ratio = dpr; sprites.clear(); },
    frame(fish, width, height, time) {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      for (const f of fish) {
        const pose = poseOf(f, width, height);
        const motion = { tailPhase: f.tailPhase, finPhase: f.finPhase, effort: f.effort };
        const detail = detailFor(bodyLengthOf(f, width) * ratio);
        ctx.save();
        ctx.translate(pose.x, pose.y);
        ctx.scale(pose.flip, 1);
        ctx.rotate(pose.angle);
        // A sprite miss falls back to drawing the vectors, so a fish is never skipped.
        if (detail.tier !== 'sprite' || !sprites.draw(ctx, f.phenotype, f.seed, pose.size, motion, ratio)) {
          drawFish(ctx, f.phenotype, f.seed, pose.size, time, motion, detail);
        }
        ctx.restore();
      }
    },
    flush() { ctx?.getImageData(0, 0, 1, 1); },
    stats: () => {
      const s = sprites.stats();
      return `${s.frames} frames, ${s.hits} hit / ${s.misses} miss, ${s.evictions} evicted`;
    },
    cacheBytes: () => sprites.stats().bytes,
    destroy() { ctx = null; sprites.clear(); },
  };
}

type PixiModule = typeof import('pixi.js');

/**
 * Force the GPU to catch up with everything Pixi has submitted.
 *
 * `gl.finish()` is advisory on some drivers, so a 1x1 `readPixels` is used as well: a read cannot be answered until
 * the frame it reads from exists.
 */
function glFinish(app: { renderer?: unknown } | null) {
  const gl = (app?.renderer as { gl?: WebGLRenderingContext } | undefined)?.gl;
  if (!gl) return;
  const pixel = new Uint8Array(4);
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  gl.finish();
}

/**
 * PixiJS drawing the same rasterized flipbook frames as batched GPU sprites.
 *
 * Pixel-identical to the Canvas sprite tier by construction: both take their images from `rasterizeFish`. This is the
 * fair form of the Pixi comparison, and the one a renderer swap would actually be built on.
 */
export function pixiSprites(): Backend {
  let pixi: PixiModule | null = null;
  let app: InstanceType<PixiModule['Application']> | null = null;
  let stage: InstanceType<PixiModule['Container']> | null = null;
  let ratio = 1;
  let bytes = 0;
  const textures = new Map<string, { texture: InstanceType<PixiModule['Texture']>; frame: Frame }>();
  const pool: InstanceType<PixiModule['Sprite']>[] = [];
  const identities = new WeakMap<Phenotype, number>();
  let nextIdentity = 1;
  const identityOf = (p: Phenotype) => {
    let id = identities.get(p);
    if (id === undefined) { id = nextIdentity++; identities.set(p, id); }
    return id;
  };

  return {
    id: 'pixi-sprites',
    label: 'PixiJS, batched sprites',
    note: 'Draws the identical flipbook frames the Canvas sprite tier uses, uploaded as GPU textures and batched.',
    async init(host, width, height, dpr) {
      pixi = await import('pixi.js');
      ratio = dpr;
      const canvas = document.createElement('canvas');
      canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
      host.replaceChildren(canvas);
      app = new pixi.Application();
      await app.init({ canvas, width, height, resolution: dpr, autoDensity: true, backgroundAlpha: 0, antialias: true, preference: 'webgl' });
      // The spike drives its own loop so every backend is measured the same way.
      app.ticker.stop();
      stage = new pixi.Container();
      app.stage.addChild(stage);
      textures.clear(); pool.length = 0; bytes = 0;
    },
    frame(fish, width, height) {
      if (!pixi || !app || !stage) return;
      let used = 0;
      for (const f of fish) {
        const pose = poseOf(f, width, height);
        const bucket = sizeBucket(pose.size * ratio);
        const phase = phaseBucket(f.tailPhase), effort = effortBucket(f.effort);
        const key = `${identityOf(f.phenotype)}:${f.seed}:${bucket}:${phase}:${effort}`;
        let entry = textures.get(key);
        if (!entry) {
          const frame = rasterizeFish(f.phenotype, f.seed, { size: bucket, phase, effort, grounded: 0 });
          if (!frame) continue;
          entry = { texture: pixi.Texture.from(frame.canvas as HTMLCanvasElement), frame };
          textures.set(key, entry);
          bytes += frame.bytes;
        }
        const sprite = pool[used] ?? (pool[used] = (() => { const s = new pixi!.Sprite(); stage!.addChild(s); return s; })());
        used++;
        sprite.visible = true;
        sprite.texture = entry.texture;
        // The frame's offsets place its corner relative to the drawing origin; as an anchor that is a texture fraction.
        sprite.anchor.set(-entry.frame.offsetX / entry.frame.width, -entry.frame.offsetY / entry.frame.height);
        const scale = pose.size / sizeOf(bucket);
        sprite.scale.set(scale * pose.flip, scale);
        sprite.position.set(pose.x, pose.y);
        sprite.rotation = pose.angle;
      }
      for (let i = used; i < pool.length; i++) pool[i].visible = false;
      app.render();
    },
    flush() { glFinish(app); },
    stats: () => `${textures.size} textures`,
    cacheBytes: () => bytes,
    destroy() {
      app?.destroy(true, { children: true, texture: true });
      app = null; stage = null; pixi = null; textures.clear(); pool.length = 0;
    },
  };
}

/**
 * PixiJS rebuilding each fish's outline as GPU vector geometry every frame.
 *
 * **Not** a visual match for the shipped renderer: it draws the body, the tail lobes and the two fins, and none of the
 * clipped markings, ornament layers, gradients or stipple. It is here to answer one question — whether moving the
 * per-frame vector work onto the GPU is worth it — and it flatters Pixi, because it is drawing less.
 */
export function pixiGraphics(): Backend {
  let pixi: PixiModule | null = null;
  let app: InstanceType<PixiModule['Application']> | null = null;
  let stage: InstanceType<PixiModule['Container']> | null = null;
  const pool: InstanceType<PixiModule['Graphics']>[] = [];

  return {
    id: 'pixi-graphics',
    label: 'PixiJS, per-frame vectors',
    note: 'Rebuilds body, tail and fins as GPU geometry each frame. Draws no markings, ornament or stipple, so it is an optimistic lower bound.',
    async init(host, width, height, dpr) {
      pixi = await import('pixi.js');
      const canvas = document.createElement('canvas');
      canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
      host.replaceChildren(canvas);
      app = new pixi.Application();
      await app.init({ canvas, width, height, resolution: dpr, autoDensity: true, backgroundAlpha: 0, antialias: true, preference: 'webgl' });
      app.ticker.stop();
      stage = new pixi.Container();
      app.stage.addChild(stage);
      pool.length = 0;
    },
    frame(fish, width, height) {
      if (!pixi || !app || !stage) return;
      let used = 0;
      for (const f of fish) {
        const pose = poseOf(f, width, height);
        const a = anatomyFor(f.phenotype);
        const l = pose.size * f.phenotype.length;
        const wave = Math.sin(f.tailPhase) * TAIL_WAVE * Math.min(1, 0.55 + 0.45 * f.effort);
        const at = (v: Vec, dy = 0): [number, number] => [v.x * l, (v.y + dy) * l];
        const g = pool[used] ?? (pool[used] = (() => { const x = new pixi!.Graphics(); stage!.addChild(x); return x; })());
        used++;
        g.visible = true;
        g.clear();
        for (const lobe of tailLobes(a)) {
          g.moveTo(...at(lobe.root));
          g.bezierCurveTo(...at(lobe.upperInner), ...at(lobe.upperOuter, wave), ...at(lobe.upperTip, wave));
          g.lineTo(...at(lobe.notch, wave));
          g.lineTo(...at(lobe.lowerTip, wave));
          g.bezierCurveTo(...at(lobe.lowerOuter, wave), ...at(lobe.lowerInner), ...at(lobe.root));
          g.closePath();
        }
        g.fill({ color: 0xc5ded8, alpha: 0.67 });
        for (const fin of [a.dorsal, a.pectoral]) {
          if (!fin) continue;
          g.moveTo(...at(fin.start));
          g.quadraticCurveTo(...at(fin.control), ...at(fin.end));
          g.closePath();
        }
        g.fill({ color: 0xc5ded8, alpha: 0.67 });
        g.moveTo(...at(a.top[0]));
        for (const point of a.top) g.lineTo(...at(point));
        for (let i = a.bottom.length - 1; i >= 0; i--) g.lineTo(...at(a.bottom[i]));
        g.closePath();
        g.fill({ color: 0xe8c48a });
        g.stroke({ width: 0.7, color: 0xe3f2e2, alpha: 0.29 });
        g.scale.set(pose.flip, 1);
        g.rotation = pose.angle;
        g.position.set(pose.x, pose.y);
      }
      for (let i = used; i < pool.length; i++) pool[i].visible = false;
      app.render();
    },
    flush() { glFinish(app); },
    cacheBytes: () => null,
    destroy() {
      app?.destroy(true, { children: true });
      app = null; stage = null; pixi = null; pool.length = 0;
    },
  };
}

export const BACKENDS: Backend[] = [canvasBaseline(), canvasLod(), pixiSprites(), pixiGraphics()];
