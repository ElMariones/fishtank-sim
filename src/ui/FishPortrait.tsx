import { useEffect, useMemo, useRef } from 'react';
import { portraitFrame, type Extent } from '../core/anatomy';
import { express } from '../core/genetics';
import type { Fish, Phenotype } from '../core/types';
import { drawFish } from '../rendering/fish';

export function FishPortrait({ fish, large = false, shared }: { fish: Fish; large?: boolean; shared?: Extent }) {
  const phenotype = useMemo(() => express(fish.genome), [fish.genome]);
  return <PhenotypePortrait phenotype={phenotype} seed={fish.birthSeed} label={`${fish.name}, generation ${fish.generation}, procedural genetic appearance`} large={large} shared={shared} />;
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
