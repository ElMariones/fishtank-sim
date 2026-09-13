import { useEffect, useMemo, useRef } from 'react';
import { express } from '../core/genetics';
import type { Fish, Phenotype } from '../core/types';
import { drawFish } from '../rendering/fish';

export function FishPortrait({ fish, large = false }: { fish: Fish; large?: boolean }) {
  const phenotype = useMemo(() => express(fish.genome), [fish.genome]);
  return <PhenotypePortrait phenotype={phenotype} seed={fish.birthSeed} label={`${fish.name}, generation ${fish.generation}, procedural genetic appearance`} large={large} />;
}

export function PhenotypePortrait({ phenotype, seed, label, large = false }: { phenotype: Phenotype; seed: number; label: string; large?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const p = phenotype, w = large ? 600 : 260, h = large ? 330 : 140;
    canvas.width = w; canvas.height = h;
    ctx.clearRect(0, 0, w, h); ctx.translate(w * 0.39, h * 0.51);
    drawFish(ctx, p, seed, Math.min(w * 0.8 / (p.length * (1.2 + p.tail + p.barbel)), h * 0.72 / (p.length * (p.depth + p.dorsal + p.pectoral))), 0);
  }, [phenotype, seed, large]);
  return <canvas className={large ? 'portrait large' : 'portrait'} ref={ref} role="img" aria-label={label} />;
}
