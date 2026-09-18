import { ADULT_FROM, developDay, eggLife, environmentFor, INCUBATION_DAYS, isEgg, lifeStage, type LifeStage } from './development';
import { metabolicPotential } from './genetics';
import { clamp } from './random';
import type { Genome, LifeState, Motif, Phenotype } from './types';
import { defaultWater } from './water';

/**
 * Stage appearance v1 (FS-306). Development reads life state as well as the genome: hatchlings have large heads and eyes,
 * a slimmer body, short fins and faint, translucent pigment. Proportions approach the adult as length approaches the
 * adult stage threshold; pigment, motifs, scales and shimmer reveal with age between game days 5 and 15. The adult
 * phenotype stays the genetic potential and remains available as a labeled preview. Renderers only consume the result.
 */
export const STAGE_APPEARANCE_MODEL = 1;
export const REVEAL_START_DAYS = INCUBATION_DAYS + 2;
export const REVEAL_END_DAYS = INCUBATION_DAYS + 12;
/** Maturity rounds to twentieths, so a growing fish has few distinct stage phenotypes and renderer caches stay warm. */
export const MATURITY_STEPS = 20;
/** Hatchling proportions as multiples of the adult value; each returns to 1 with body maturity. */
export const HATCHLING_PROPORTIONS = { head: 1.35, eye: 1.7, depth: 0.78, snout: 0.6, tail: 0.55, spread: 0.7, dorsal: 0.45, pectoral: 0.7, barbel: 0.3 } as const;
/** Hatchlings are at least this translucent until pigment reveals. */
export const HATCHLING_TRANSLUCENCY = 0.5;
/** A juvenile head never grows past this relative length, keeping the outline x-monotonic. */
export const JUVENILE_HEAD_LIMIT = 0.5;
/** Scale textures appear once pigment is half revealed. */
export const SCALE_REVEAL = 0.5;

export type Maturity = { body: number; pigment: number };
export const ADULT_MATURITY: Maturity = { body: 1, pigment: 1 };

const smooth = (t: number) => { const x = clamp(t); return x * x * (3 - 2 * x); };
const quantize = (value: number) => Math.round(value * MATURITY_STEPS) / MATURITY_STEPS;

/** Body maturity follows current length toward the adult stage threshold; pigment maturity follows age. Eggs are 0. */
export function appearanceMaturity(life: LifeState, adultLengthCm: number): Maturity {
  if (isEgg(life)) return { body: 0, pigment: 0 };
  return {
    body: quantize(smooth(life.lengthCm / (adultLengthCm * ADULT_FROM))),
    pigment: quantize(smooth((life.ageDays - REVEAL_START_DAYS) / (REVEAL_END_DAYS - REVEAL_START_DAYS))),
  };
}

/** The appearance a fish shows at a maturity. Full maturity returns the adult phenotype itself; nothing genetic changes. */
export function stagePhenotype(p: Phenotype, maturity: Maturity): Phenotype {
  const b = clamp(maturity.body), g = clamp(maturity.pigment), h = HATCHLING_PROPORTIONS;
  if (b === 1 && g === 1) return p;
  const toward = (ratio: number, adult: number) => adult * (ratio + (1 - ratio) * b);
  if (p.species === 'axolotl' && p.axolotl) {
    const ax = p.axolotl, m = ax.morphology, pigment = ax.pigmentation;
    // Axolotl juveniles keep the species' recognizable broad head/external gills while their tail and limbs approach
    // adult proportions. Pigment and pattern reveal independently; the genome itself is never modified.
    const staged = {
      ...ax,
      morphology: {
        ...m,
        body: { ...m.body, depth: toward(0.82, m.body.depth), mass: toward(0.86, m.body.mass) },
        head: {
          ...m.head,
          width: toward(1.18, m.head.width), length: toward(1.14, m.head.length),
          neckWidth: toward(0.9, m.head.neckWidth),
        },
        limbs: {
          ...m.limbs,
          foreLength: toward(0.58, m.limbs.foreLength), hindLength: toward(0.52, m.limbs.hindLength),
          thickness: toward(0.72, m.limbs.thickness), digitLength: toward(0.55, m.limbs.digitLength),
        },
        tail: { ...m.tail, length: toward(0.68, m.tail.length), height: toward(0.84, m.tail.height), finHeight: toward(0.74, m.tail.finHeight) },
        gills: {
          ...m.gills,
          stalkLength: toward(1.16, m.gills.stalkLength), filamentLength: toward(1.12, m.gills.filamentLength),
          saturation: m.gills.saturation * (0.45 + 0.55 * g),
        },
        eyes: { ...m.eyes, size: toward(1.28, m.eyes.size) },
      },
      pigmentation: {
        ...pigment,
        melanin: pigment.melanin * (0.35 + 0.65 * g),
        xanthophore: pigment.xanthophore * (0.35 + 0.65 * g),
        iridophore: pigment.iridophore * g,
        iridescence: pigment.iridescence * g,
        translucency: Math.max(pigment.translucency, 0.52) + (pigment.translucency - Math.max(pigment.translucency, 0.52)) * g,
        skinLuster: pigment.skinLuster * (0.55 + 0.45 * g),
      },
      pattern: { ...ax.pattern, density: ax.pattern.density * g, contrast: ax.pattern.contrast * g },
    };
    return { ...p, axolotl: staged };
  }
  const reveal = <T extends string>(motifs: readonly Motif<T>[]): Motif<T>[] => g === 0 ? [] : motifs.map(motif => ({ ...motif, strength: motif.strength * g }));
  const pale = Math.max(p.translucency, HATCHLING_TRANSLUCENCY), a = p.appearance;
  return {
    ...p,
    head: Math.min(toward(h.head, p.head), Math.max(p.head, JUVENILE_HEAD_LIMIT)),
    eye: toward(h.eye, p.eye), depth: toward(h.depth, p.depth), snout: toward(h.snout, p.snout),
    tail: toward(h.tail, p.tail), spread: toward(h.spread, p.spread), dorsal: toward(h.dorsal, p.dorsal),
    pectoral: toward(h.pectoral, p.pectoral), barbel: toward(h.barbel, p.barbel),
    red: p.red * g, black: p.black * g, metallic: p.metallic * g, finPigment: p.finPigment * g, speckle: p.speckle * g,
    translucency: pale + (p.translucency - pale) * g,
    appearance: { ...a, shimmer: a.shimmer * g, contrast: a.contrast * g, motifs: reveal(a.motifs), finMotifs: reveal(a.finMotifs), scales: g >= SCALE_REVEAL ? a.scales : 'smooth' },
  };
}

export type RevealFrame = { day: number; life: LifeState; maturity: Maturity; stage: LifeStage; phenotype: Phenotype };

/** One genome raised in healthy default water, sampled on the given game days: a deterministic reveal fixture. */
export function stageRevealSeries(adult: Phenotype, genome: Genome, days: readonly number[]): RevealFrame[] {
  const potential = metabolicPotential(genome), environment = environmentFor(defaultWater(), 5), frames: RevealFrame[] = [];
  let life = eggLife();
  for (let day = 0; day <= Math.max(0, ...days); day++) {
    if (days.includes(day)) {
      const maturity = appearanceMaturity(life, potential.adultLengthCm);
      frames.push({ day, life, maturity, stage: lifeStage(life, potential), phenotype: stagePhenotype(adult, maturity) });
    }
    life = developDay(life, potential, environment);
  }
  return frames;
}
