import { MUTATION_RATE, type GenomeVersion } from './catalog';
import { allelesAt, LOCUS_BY_ID } from './registry';
import { GOAL_BY_KEY } from './breedingGoals';
import { express, fingerprint, inherit } from './genetics';
import { hash } from './random';
import type { Genome } from './types';

export const PREDICTION_SAMPLES = 256;
export type GenotypeOdds = { alleles: [number, number]; probability: number };

/** Unordered genotype odds at one locus, before mutation; linkage does not change marginal odds. */
export function singleLocusOdds(mother: Genome, father: Genome, locus: string): GenotypeOdds[] {
  if (!LOCUS_BY_ID.has(locus as never)) throw new Error('Unknown prediction locus.');
  // Registry alleles: a parent whose genome predates the locus transmits its baseline (FS-601).
  const copies = (genome: Genome) => allelesAt(genome, locus);
  const outcomes = new Map<string, GenotypeOdds>();
  for (const a of copies(mother)) for (const b of copies(father)) {
    const alleles: [number, number] = [Math.min(a, b), Math.max(a, b)], key = alleles.join('/');
    const outcome = outcomes.get(key) ?? { alleles, probability: 0 };
    outcome.probability += 0.25;
    outcomes.set(key, outcome);
  }
  return [...outcomes.values()].sort((a, b) => a.alleles[0] - b.alleles[0] || a.alleles[1] - b.alleles[1]);
}

export type PredictedRange = { key: string; label: string; unit: 'cm' | 'score'; low: number; median: number; high: number };
/** Prediction v1 owns its seed namespace; no world, sequence IDs or birth PRNG are touched. Samples use genome v2, or v3 for genome v3 parents; the measured traits come from the shared v1 loci. */
export function predictOffspring(mother: Genome, father: Genome, goals: readonly string[] = []) {
  const keys = [...new Set(goals)];
  if (keys.length > 4 || keys.some(key => !GOAL_BY_KEY.has(key))) throw new Error('Choose up to four known prediction traits.');
  const seedKey = `prediction-v1:${fingerprint(mother)}:${fingerprint(father)}`;
  const traits = keys.map(key => GOAL_BY_KEY.get(key)!);
  const columns: number[][] = Array.from({ length: traits.length + 1 }, () => []);
  for (let i = 0; i < PREDICTION_SAMPLES; i++) {
    const { genome } = inherit(mother, father, hash(`${seedKey}:${i}`), MUTATION_RATE, Math.max(2, mother.version, father.version) as GenomeVersion);
    const phenotype = express(genome);
    columns[0].push(phenotype.adultLengthCm);
    traits.forEach((trait, index) => columns[index + 1].push(trait.value(phenotype)));
  }
  const ranges: PredictedRange[] = columns.map((column, i) => {
    column.sort((a, b) => a - b);
    const percentile = (q: number) => column[Math.floor((column.length - 1) * q)];
    return { key: i === 0 ? 'adultLengthCm' : keys[i - 1], label: i === 0 ? 'Adult length' : traits[i - 1].label,
      unit: i === 0 ? 'cm' : 'score', low: percentile(0.1), median: percentile(0.5), high: percentile(0.9) };
  });
  return { samples: PREDICTION_SAMPLES, mutationRate: MUTATION_RATE, ranges };
}
