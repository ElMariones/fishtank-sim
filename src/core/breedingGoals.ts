import { ACCENT_COLORS, appearanceAlleles, BASE_COLORS, BODY_MOTIFS, DOT_COLORS, FIN_MOTIFS, IRIS_COLORS, SCALE_TYPES } from './appearance';
import type { AppearanceLocus } from './catalog';
import { VISUAL_DESCRIPTORS } from './descriptors';
import { clamp } from './random';
import { express } from './genetics';
import type { Fish, Phenotype } from './types';

type GoalDescriptor = { key: string; label: string; group: string; value: (p: Phenotype) => number; locus?: AppearanceLocus; allele?: number };
const categories = (locus: AppearanceLocus, label: string, names: readonly (string | null)[], visible: (p: Phenotype, name: string) => number): GoalDescriptor[] =>
  names.flatMap((name, allele) => name === null ? [] : [{ key: `${locus}:${allele}`, label: `${label} · ${name}`, group: 'Genome 2 appearance', locus, allele, value: (p: Phenotype) => visible(p, name) }]);

/** Targets use expressed adult traits. Hidden copies are reported separately and never called visible. */
export const GOAL_DESCRIPTORS: GoalDescriptor[] = [
  ...VISUAL_DESCRIPTORS.map(d => ({ key: d.key, label: d.label, group: 'Shape and pigment', value: (p: Phenotype) => clamp((p[d.key] - d.min) / (d.max - d.min)) })),
  ...categories('base_color', 'Body', BASE_COLORS, (p, n) => Number(p.appearance.base.some(v => v === n))),
  ...categories('accent_color', 'Accent', ACCENT_COLORS, (p, n) => Number(p.appearance.accent.some(v => v === n))),
  ...categories('iris_color', 'Eyes', IRIS_COLORS, (p, n) => Number(p.appearance.iris.some(v => v === n))),
  ...categories('dot_color', 'Dots', DOT_COLORS, (p, n) => Number((p.appearance.motifs.some(m => m.kind === 'spots' || m.kind === 'calico') || p.appearance.finMotifs.some(m => m.kind === 'spots')) && p.appearance.dots.some(v => v === n))),
  ...categories('body_motif', 'Body pattern', BODY_MOTIFS, (p, n) => p.appearance.motifs.find(m => m.kind === n)?.strength ?? 0),
  ...categories('fin_motif', 'Fin pattern', FIN_MOTIFS, (p, n) => p.appearance.finMotifs.find(m => m.kind === n)?.strength ?? 0),
  ...categories('scale_type', 'Scales', SCALE_TYPES, (p, n) => Number(p.appearance.scales === n)),
  { key: 'shimmer', label: 'Shimmer', group: 'Genome 2 appearance', value: p => p.appearance.shimmer },
  { key: 'motifDensity', label: 'Motif density', group: 'Genome 2 appearance', value: p => p.appearance.motifs.length ? p.appearance.density : 0 },
  { key: 'motifReach', label: 'Pattern reach onto fins', group: 'Genome 2 appearance', value: p => p.appearance.motifs.length ? p.appearance.reach : 0 },
  ...(['bold', 'social', 'activity'] as const).map(key => ({ key, label: { bold: 'Boldness', social: 'Sociability', activity: 'Activity' }[key], group: 'Behavior', value: (p: Phenotype) => p[key] })),
];
export const GOAL_BY_KEY = new Map(GOAL_DESCRIPTORS.map(d => [d.key, d]));
export type GoalTrait = { descriptor: string; direction: 'higher' | 'lower' };
export const traitValue = (fish: Fish, goal: GoalTrait) => {
  const descriptor = GOAL_BY_KEY.get(goal.descriptor);
  // The current goal catalog is a koi catalog. Shared behavior values can still be read on axolotls, but koi shape/color
  // descriptors and loci must never be projected onto the independent axolotl genome.
  if (!descriptor || (fish.species === 'axolotl' && descriptor.group !== 'Behavior')) return 0;
  return descriptor.value(express(fish.genome));
};
export function carrierCopies(fish: Fish, key: string): number | null {
  if (fish.species === 'axolotl') return null;
  const d = GOAL_BY_KEY.get(key);
  return d?.locus === undefined ? null : appearanceAlleles(fish.genome, d.locus).filter(a => a === d.allele).length;
}

/** Exact marginal Mendelian copy odds before mutation; not joint or expression probabilities. */
export function targetCopyOdds(mother: Fish, father: Fish, key: string): { atLeastOne: number; both: number } | null {
  const maternal = carrierCopies(mother, key), paternal = carrierCopies(father, key);
  if (maternal === null || paternal === null) return null;
  const a = maternal / 2, b = paternal / 2;
  return { atLeastOne: 1 - (1 - a) * (1 - b), both: a * b };
}
