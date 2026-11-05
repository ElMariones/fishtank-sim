import { appearanceMaturity, goldfishMaturity, guppyMaturity, stagePhenotype, type Maturity } from '../core/juvenile';
import type { Fish, Phenotype } from '../core/types';

const stages = new WeakMap<Phenotype, Map<string, Phenotype>>();

/**
 * Stage phenotypes cached per adult phenotype and quantized maturity. The anatomy and ornament caches key on phenotype
 * identity, so reusing the same object keeps a growing fish from rebuilding its geometry every frame.
 */
export function stagePhenotypeFor(adult: Phenotype, maturity: Maturity): Phenotype {
  if (maturity.body >= 1 && maturity.pigment >= 1 && (maturity.color ?? 1) >= 1 && !maturity.gravid) return adult;
  let byMaturity = stages.get(adult);
  if (!byMaturity) { byMaturity = new Map(); stages.set(adult, byMaturity); }
  const key = `${maturity.body}:${maturity.pigment}:${maturity.color ?? 1}:${maturity.gravid ?? 0}`;
  let stage = byMaturity.get(key);
  if (!stage) { stage = stagePhenotype(adult, maturity); byMaturity.set(key, stage); }
  return stage;
}

/** What this fish looks like now, from its adult phenotype and saved life state. `gravid` (0–1) swells a guppy mother carrying a brood. */
export const currentPhenotype = (adult: Phenotype, fish: Pick<Fish, 'life'>, gravid = 0) =>
  stagePhenotypeFor(adult, adult.guppy ? guppyMaturity(fish.life, adult.guppy, gravid)
    : adult.goldfish ? goldfishMaturity(fish.life, adult.goldfish) : appearanceMaturity(fish.life, adult.adultLengthCm));
