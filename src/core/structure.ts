import { LOCI, APPEARANCE_LOCI, STRUCTURE_LOCI, type StructureLocus } from './catalog';
import type { BarbelCount, DorsalForm, Genome, Structure, TailTopology } from './types';

/**
 * Structure v1 (FS-601), genome v3 chromosome 11. Supported topology variants only: a paired fan tail, a four-lobed crown,
 * reduced or absent dorsal fin, and zero, four or six barbels. Topology alleles are recessive to the standard form, so one
 * copy is a hidden carrier. Additive loci shape a topology within bounded ranges. Genome v1 and v2 fish carry no
 * chromosome 11 and always express STANDARD_STRUCTURE, so their anatomy never changes.
 */
export const STRUCTURE_MODEL = 1;
export const STRUCTURE_OFFSET = LOCI.length + APPEARANCE_LOCI.length;

export const TAIL_TOPOLOGIES: readonly TailTopology[] = ['standard', 'paired', 'crown'];
export const DORSAL_FORMS: readonly DorsalForm[] = ['normal', 'reduced', 'absent'];
/** Barbel count per allele: A0 two (standard), A1 none, A2 four, A3 six. */
export const BARBEL_COUNTS: readonly BarbelCount[] = [2, 0, 4, 6];

/** Allele labels in allele-ID order; only these IDs are valid at each locus. Additive loci use level labels 0–5. */
export const STRUCTURE_ALLELE_LABELS: Record<StructureLocus, readonly string[]> = {
  tail_topology: ['standard tail', 'paired fan', 'crown-four'],
  lobe_balance: ['level 0', 'level 1', 'level 2', 'level 3', 'level 4', 'level 5'],
  topology_spread: ['level 0', 'level 1', 'level 2', 'level 3', 'level 4', 'level 5'],
  dorsal_form: ['normal dorsal', 'reduced dorsal', 'no dorsal'],
  barbel_count: ['two barbels', 'no barbels', 'four barbels', 'six barbels'],
  fin_ray_density: ['level 0', 'level 1', 'level 2', 'level 3', 'level 4', 'level 5'],
};

/** Genome v1 and v2 records are read as homozygous for these alleles, in STRUCTURE_LOCI order. */
export const STRUCTURE_BASELINE: readonly number[] = [0, 2, 2, 0, 0, 2];

const LEVELS = [0.1, 0.22, 0.32, 0.24, 0.1, 0.02] as const;
/** Founder weights per supported allele. Topology variants are carried by a few founders and expressed by almost none. */
export const STRUCTURE_FOUNDER_WEIGHTS: Record<StructureLocus, readonly number[]> = {
  tail_topology: [0.996, 0.0035, 0.0005],
  lobe_balance: LEVELS,
  topology_spread: LEVELS,
  dorsal_form: [0.97, 0.025, 0.005],
  barbel_count: [0.965, 0.02, 0.013, 0.002],
  fin_ray_density: LEVELS,
};

export type MutationTarget = { allele: number; weight: number };
/**
 * Structural mutation class: a lower per-copy rate than the lab's small-effect 0.003, and transitions only between
 * compatible neighbours (a crown arises from a paired fan, six barbels from four). Additive loci keep adjacent steps.
 */
export const STRUCTURAL_MUTATION_RATE = 0.001;
const step = (...targets: number[]): MutationTarget[] => targets.map(allele => ({ allele, weight: 1 / targets.length }));
export const STRUCTURE_MUTATION_TARGETS: Partial<Record<StructureLocus, readonly (readonly MutationTarget[])[]>> = {
  tail_topology: [step(1), step(0, 2), step(1)],
  dorsal_form: [step(1), step(0, 2), step(1)],
  barbel_count: [step(1, 2), step(0), step(0, 3), step(2)],
};

export const STANDARD_STRUCTURE: Structure = { tail: 'standard', lobeBalance: 1, spread: 0.4, dorsal: 'normal', barbels: 2, rays: 1 };

type Pair = [number, number];
export function structureAlleles(genome: Genome, locus: StructureLocus): Pair {
  const offset = STRUCTURE_LOCI.indexOf(locus);
  if (genome.version < 3) return [STRUCTURE_BASELINE[offset], STRUCTURE_BASELINE[offset]];
  return [genome.maternal[STRUCTURE_OFFSET + offset], genome.paternal[STRUCTURE_OFFSET + offset]];
}

const additive = ([a, b]: Pair) => (a + b) / 10;
/** Recessive series: both copies must be variants, and the lower variant in the series is expressed. */
const recessiveSeries = <T>(names: readonly T[], [a, b]: Pair): T => a && b ? names[Math.min(a, b)] : names[0];

function barbels([a, b]: Pair): BarbelCount {
  if (a === b) return BARBEL_COUNTS[a];
  if (a === 0 || b === 0 || a === 1 || b === 1) return 2;
  return 4; // A2 with A3: six barbels need both copies.
}

/** Pure and deterministic. Baseline alleles give exactly STANDARD_STRUCTURE. */
export function expressStructure(genome: Genome): Structure {
  if (genome.version < 3) return STANDARD_STRUCTURE;
  const pair = (locus: StructureLocus) => structureAlleles(genome, locus);
  return {
    tail: recessiveSeries(TAIL_TOPOLOGIES, pair('tail_topology')),
    lobeBalance: 1 + (additive(pair('lobe_balance')) - 0.4) * 0.5,
    spread: additive(pair('topology_spread')),
    dorsal: recessiveSeries(DORSAL_FORMS, pair('dorsal_form')),
    barbels: barbels(pair('barbel_count')),
    rays: 1 + (additive(pair('fin_ray_density')) - 0.4) * 0.6,
  };
}

export const isStandardStructure = (structure: Structure) =>
  structure.tail === 'standard' && structure.dorsal === 'normal' && structure.barbels === 2;

const TAIL_TEXT: Record<TailTopology, string> = { standard: 'Standard single tail', paired: 'Paired fan tail', crown: 'Crown-four tail' };
const DORSAL_TEXT: Record<DorsalForm, string> = { normal: 'Normal', reduced: 'Reduced', absent: 'No dorsal fin' };
export type StructureTrait = { trait: string; value: string; carrier: boolean };

/** Inspector rows, including hidden single copies, which matter for breeding but do not show. */
export function describeStructure(genome: Genome): StructureTrait[] {
  const s = expressStructure(genome), pair = (locus: StructureLocus) => structureAlleles(genome, locus);
  const hidden = (locus: StructureLocus, shown: boolean) => !shown && pair(locus).some(allele => allele !== 0);
  return [
    { trait: 'Tail', value: TAIL_TEXT[s.tail], carrier: hidden('tail_topology', s.tail !== 'standard') },
    { trait: 'Dorsal fin', value: DORSAL_TEXT[s.dorsal], carrier: hidden('dorsal_form', s.dorsal !== 'normal') },
    { trait: 'Barbels', value: `${s.barbels}`, carrier: hidden('barbel_count', s.barbels !== 2) },
  ];
}
