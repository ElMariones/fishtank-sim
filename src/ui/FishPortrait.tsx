import { memo, useEffect, useMemo, useRef } from 'react';
import { portraitFrame, type Extent } from '../core/anatomy';
import { axolotlPortraitFrame } from '../core/axolotlAnatomy';
import { INCUBATION_DAYS, isEgg, lifeStage } from '../core/development';
import { express, metabolicPotential } from '../core/genetics';
import type { Fish, Genome, Phenotype } from '../core/types';
import { drawEgg, drawFish } from '../rendering/fish';
import { currentPhenotype } from '../rendering/stage';

/** Genomes are immutable records, so each one is expressed once; the same phenotype object keeps the caches below warm. */
const adults = new WeakMap<Genome, Phenotype>();
const adultOf = (genome: Genome) => {
  let phenotype = adults.get(genome);
  if (!phenotype) { phenotype = express(genome); adults.set(genome, phenotype); }
  return phenotype;
};

/**
 * Painted small portraits, most recently used last. Reopening a tank's collection copies them instead of drawing each
 * fish again. About 150 KB each; the oldest are dropped past the limit.
 */
const PORTRAIT_CACHE_LIMIT = 240;
const portraitIds = new WeakMap<Phenotype, number>();
let nextPortraitId = 1;
const portraitCache = new Map<string, HTMLCanvasElement>();
const portraitKey = (phenotype: Phenotype, seed: number, w: number, h: number, shared?: string) => {
  let id = portraitIds.get(phenotype);
  if (!id) { id = nextPortraitId++; portraitIds.set(phenotype, id); }
  return `${id}:${seed}:${w}x${h}:${shared ?? ''}`;
};

/**
 * Portrait painting is spread over animation frames (about 8 ms of drawing per frame), so opening a collection of 60
 * fish never blocks the page; cards fill in over a few frames.
 */
const paintQueue: { run: () => void; cancelled: boolean }[] = [];
let paintScheduled = false;
function flushPaints() {
  const start = performance.now();
  while (paintQueue.length && performance.now() - start < 8) { const job = paintQueue.shift()!; if (!job.cancelled) job.run(); }
  if (paintQueue.length) requestAnimationFrame(flushPaints); else paintScheduled = false;
}
function queuePaint(run: () => void) {
  const job = { run, cancelled: false };
  paintQueue.push(job);
  if (!paintScheduled) { paintScheduled = true; requestAnimationFrame(flushPaints); }
  return () => { job.cancelled = true; };
}

/** `current` draws the fish's stage appearance today (eggs as eggs); `adult` draws its adult genetic potential. */
export type PortraitView = 'current' | 'adult';

/** Memoized: a parent re-render with the same fish record and view never rebuilds or repaints the portrait. */
export const FishPortrait = memo(function FishPortrait({ fish, large = false, shared, view = 'adult' }: { fish: Fish; large?: boolean; shared?: Extent; view?: PortraitView }) {
  const adult = useMemo(() => adultOf(fish.genome), [fish.genome]);
  if (view === 'current' && isEgg(fish.life)) {
    return <EggPortrait seed={fish.birthSeed} progress={Math.min(1, fish.life.ageDays / INCUBATION_DAYS)} large={large}
      label={`${fish.name}, incubating egg, day ${fish.life.ageDays} of ${INCUBATION_DAYS}`} />;
  }
  const phenotype = view === 'current' ? currentPhenotype(adult, fish) : adult;
  const label = view === 'current'
    ? `${fish.name}, ${lifeStage(fish.life, metabolicPotential(fish.genome))} at ${fish.life.lengthCm.toFixed(1)} cm, current appearance`
    : `${fish.name}, generation ${fish.generation}, adult genetic potential`;
  return <PhenotypePortrait phenotype={phenotype} seed={fish.birthSeed} label={label} large={large} shared={shared} />;
});

/** Without `shared` each fish fills its frame; with it, a comparison group shares one scale so size differences stay visible. */
export function PhenotypePortrait({ phenotype, seed, label, large = false, shared }: { phenotype: Phenotype; seed: number; label: string; large?: boolean; shared?: Extent }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const sharedWidth = shared?.width, sharedHeight = shared?.height;
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const w = large ? 600 : 260, h = large ? 330 : 140;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const sharedExtent = sharedWidth && sharedHeight ? { width: sharedWidth, height: sharedHeight } : undefined;
    const draw = (target: CanvasRenderingContext2D) => {
      const frame = phenotype.species === 'axolotl' && phenotype.axolotl
        ? axolotlPortraitFrame(phenotype.axolotl, w, h)
        : portraitFrame(phenotype, w, h, sharedExtent);
      target.setTransform(1, 0, 0, 1, 0, 0); target.clearRect(0, 0, w, h); target.translate(frame.originX, frame.originY);
      drawFish(target, phenotype, seed, frame.size, 0);
      target.setTransform(1, 0, 0, 1, 0, 0);
    };
    // The inspector's large portrait is one drawing and is shown at once.
    if (large) { draw(ctx); return; }
    const key = portraitKey(phenotype, seed, w, h, sharedExtent ? `${sharedWidth}x${sharedHeight}` : undefined), cached = portraitCache.get(key);
    const show = (image: HTMLCanvasElement) => { ctx.clearRect(0, 0, w, h); ctx.drawImage(image, 0, 0); };
    if (cached) { portraitCache.delete(key); portraitCache.set(key, cached); show(cached); return; }
    ctx.clearRect(0, 0, w, h);
    return queuePaint(() => {
      const image = document.createElement('canvas'); image.width = w; image.height = h;
      draw(image.getContext('2d')!);
      portraitCache.set(key, image);
      if (portraitCache.size > PORTRAIT_CACHE_LIMIT) portraitCache.delete(portraitCache.keys().next().value!);
      show(image);
    });
  }, [phenotype, seed, large, sharedWidth, sharedHeight]);
  return <canvas className={large ? 'portrait large' : 'portrait'} ref={ref} role="img" aria-label={label} />;
}

export function EggPortrait({ seed, progress, label, large = false }: { seed: number; progress: number; label: string; large?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const w = large ? 600 : 260, h = large ? 330 : 140;
    canvas.width = w; canvas.height = h;
    ctx.translate(w / 2, h / 2);
    drawEgg(ctx, Math.min(w, h) * 0.3, seed, progress, 0);
  }, [seed, progress, large]);
  return <canvas className={large ? 'portrait large' : 'portrait'} ref={ref} role="img" aria-label={label} />;
}
