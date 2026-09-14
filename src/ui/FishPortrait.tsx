import { useEffect, useMemo, useRef } from 'react';
import { portraitFrame, type Extent } from '../core/anatomy';
import { INCUBATION_DAYS, isEgg, lifeStage } from '../core/development';
import { express, metabolicPotential } from '../core/genetics';
import type { Fish, Phenotype } from '../core/types';
import { drawEgg, drawFish } from '../rendering/fish';
import { currentPhenotype } from '../rendering/stage';

/** `current` draws the fish's stage appearance today (eggs as eggs); `adult` draws its adult genetic potential. */
export type PortraitView = 'current' | 'adult';

export function FishPortrait({ fish, large = false, shared, view = 'adult' }: { fish: Fish; large?: boolean; shared?: Extent; view?: PortraitView }) {
  const adult = useMemo(() => express(fish.genome), [fish.genome]);
  if (view === 'current' && isEgg(fish.life)) {
    return <EggPortrait seed={fish.birthSeed} progress={Math.min(1, fish.life.ageDays / INCUBATION_DAYS)} large={large}
      label={`${fish.name}, incubating egg, day ${fish.life.ageDays} of ${INCUBATION_DAYS}`} />;
  }
  const phenotype = view === 'current' ? currentPhenotype(adult, fish) : adult;
  const label = view === 'current'
    ? `${fish.name}, ${lifeStage(fish.life, metabolicPotential(fish.genome))} at ${fish.life.lengthCm.toFixed(1)} cm, current appearance`
    : `${fish.name}, generation ${fish.generation}, adult genetic potential`;
  return <PhenotypePortrait phenotype={phenotype} seed={fish.birthSeed} label={label} large={large} shared={shared} />;
}

/** Without `shared` each fish fills its frame; with it, a comparison group shares one scale so size differences stay visible. */
export function PhenotypePortrait({ phenotype, seed, label, large = false, shared }: { phenotype: Phenotype; seed: number; label: string; large?: boolean; shared?: Extent }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const sharedWidth = shared?.width, sharedHeight = shared?.height;
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const w = large ? 600 : 260, h = large ? 330 : 140;
    canvas.width = w; canvas.height = h;
    const frame = portraitFrame(phenotype, w, h, sharedWidth && sharedHeight ? { width: sharedWidth, height: sharedHeight } : undefined);
    ctx.clearRect(0, 0, w, h); ctx.translate(frame.originX, frame.originY);
    drawFish(ctx, phenotype, seed, frame.size, 0);
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
