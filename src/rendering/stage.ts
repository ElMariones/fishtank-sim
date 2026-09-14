import { appearanceMaturity, stagePhenotype, type Maturity } from '../core/juvenile';
import type { Fish, Phenotype } from '../core/types';

const stages = new WeakMap<Phenotype, Map<string, Phenotype>>();

/**
 * Stage phenotypes cached per adult phenotype and quantized maturity. The anatomy and ornament caches key on phenotype
 * identity, so reusing the same object keeps a growing fish from rebuilding its geometry every frame.
 */
export function stagePhenotypeFor(adult: Phenotype, maturity: Maturity): Phenotype {
  if (maturity.body >= 1 && maturity.pigment >= 1) return adult;
  let byMaturity = stages.get(adult);
  if (!byMaturity) { byMaturity = new Map(); stages.set(adult, byMaturity); }
  const key = `${maturity.body}:${maturity.pigment}`;
  let stage = byMaturity.get(key);
  if (!stage) { stage = stagePhenotype(adult, maturity); byMaturity.set(key, stage); }
  return stage;
}

/** What this fish looks like now, from its adult phenotype and saved life state. */
export const currentPhenotype = (adult: Phenotype, fish: Pick<Fish, 'life'>) => stagePhenotypeFor(adult, appearanceMaturity(fish.life, adult.adultLengthCm));
