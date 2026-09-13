import { APPEARANCE_LOCI, FOUNDER_WEIGHTS, LOCI, type AppearanceLocus } from './catalog';
import type { AccentColor, Appearance, BaseColor, BodyMotif, DotColor, FinMotif, Genome, IrisColor, Motif, ScaleType } from './types';

/**
 * Development v3 appearance (FS-113). Genome v2 chromosome 9 (Color) and chromosome 10 (Ornament) add body, accent,
 * dot and eye colors, shimmer, scale types, body motifs and fin patterns. Allele ID 0 is the classic state; genome v1
 * fish are read as homozygous for APPEARANCE_BASELINE, which reproduces the development v2 look exactly.
 */
export const BASE_COLORS: readonly BaseColor[] = ['classic', 'gold', 'slate', 'charcoal', 'lavender', 'jade'];
export const ACCENT_COLORS: readonly AccentColor[] = ['classic', 'crimson', 'sunflower', 'cobalt', 'violet', 'pearl'];
export const DOT_COLORS: readonly DotColor[] = ['ink', 'pearl', 'gold', 'turquoise', 'ruby', 'rainbow'];
export const IRIS_COLORS: readonly IrisColor[] = ['natural', 'amber', 'ruby', 'sapphire', 'emerald', 'silver'];
export const SCALE_TYPES: readonly ScaleType[] = ['smooth', 'fine', 'mirror', 'net', 'pearl', 'armor'];
export const BODY_MOTIFS: readonly (BodyMotif | null)[] = [null, 'spots', 'stripes', 'marble', 'calico', 'rosettes'];
export const FIN_MOTIFS: readonly (FinMotif | null)[] = [null, 'spots', 'bands', 'edge', 'tips', 'flame'];

/** Human-readable allele identity, distinct from dominance and the expressed phenotype. */
export function appearanceAlleleLabel(locus: string, allele: number): string {
  const names: Partial<Record<string, readonly (string | null)[]>> = {
    base_color: BASE_COLORS, accent_color: ACCENT_COLORS, dot_color: DOT_COLORS, iris_color: IRIS_COLORS,
    scale_type: SCALE_TYPES, body_motif: BODY_MOTIFS, fin_motif: FIN_MOTIFS,
  };
  return names[locus] ? names[locus]![allele] ?? 'classic' : `level ${allele}`;
}

/** Genome v1 fish are read as homozygous for these alleles, in APPEARANCE_LOCI order. */
export const APPEARANCE_BASELINE: readonly number[] = [0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0];

/**
 * Locus-specific founder weights for Newcomer stock. About one founder in four shows at least one new feature; the
 * most striking variants (rosettes, jade bodies, silver eyes, armored scales, flame fins) stay well under 1%.
 */
export const APPEARANCE_FOUNDER_WEIGHTS: Record<AppearanceLocus, readonly number[]> = {
  base_color: [0.84, 0.06, 0.045, 0.03, 0.018, 0.007],
  accent_color: [0.84, 0.05, 0.05, 0.03, 0.02, 0.01],
  dot_color: [0.5, 0.18, 0.14, 0.1, 0.07, 0.01],
  iris_color: [0.82, 0.07, 0.045, 0.035, 0.022, 0.008],
  shimmer: [0.9, 0.06, 0.025, 0.01, 0.004, 0.001],
  scale_type: [0.82, 0.08, 0.05, 0.03, 0.015, 0.005],
  body_motif: [0.95, 0.02, 0.015, 0.008, 0.005, 0.002],
  motif_density: FOUNDER_WEIGHTS, motif_scale: FOUNDER_WEIGHTS, motif_contrast: FOUNDER_WEIGHTS, motif_reach: FOUNDER_WEIGHTS,
  fin_motif: [0.97, 0.012, 0.009, 0.005, 0.003, 0.001],
};

/** One motif copy beside the classic allele shows faintly; two different motifs mix. */
export const CARRIER_STRENGTH = 0.55;
export const MIXED_STRENGTH = 0.8;
/** Additive shimmer below this value is not drawn. */
export const SHIMMER_VISIBLE = 0.3;
/** Body motifs spread onto the tail and dorsal fin from this additive reach. */
export const REACH_VISIBLE = 0.3;

type Pair = [number, number];

export function appearanceAlleles(genome: Genome, locus: AppearanceLocus): Pair {
  const offset = APPEARANCE_LOCI.indexOf(locus);
  if (genome.version === 1) return [APPEARANCE_BASELINE[offset], APPEARANCE_BASELINE[offset]];
  return [genome.maternal[LOCI.length + offset], genome.paternal[LOCI.length + offset]];
}

/** Classic is dominant; two variant copies blend. Sorted by allele ID, so maternal/paternal order never matters. */
function classicDominant<T>(names: readonly T[], [a, b]: Pair): T[] {
  if (a === 0 || b === 0) return [names[0]];
  return a === b ? [names[a]] : [names[Math.min(a, b)], names[Math.max(a, b)]];
}

function overlay<T extends string>(names: readonly (T | null)[], [a, b]: Pair): Motif<T>[] {
  const low = Math.min(a, b), high = Math.max(a, b);
  if (high === 0) return [];
  if (low === 0) return [{ kind: names[high]!, strength: CARRIER_STRENGTH }];
  if (low === high) return [{ kind: names[high]!, strength: 1 }];
  return [{ kind: names[low]!, strength: MIXED_STRENGTH }, { kind: names[high]!, strength: MIXED_STRENGTH }];
}

/** Rainbow is dominant; otherwise two different dot colors alternate. */
const dotColors = ([a, b]: Pair): DotColor[] => a === 5 || b === 5 ? ['rainbow'] : a === b ? [DOT_COLORS[a]] : [DOT_COLORS[Math.min(a, b)], DOT_COLORS[Math.max(a, b)]];
/** Scale variants are recessive: both copies must differ from smooth, and the higher variant is expressed. */
const scaleType = ([a, b]: Pair): ScaleType => a && b ? SCALE_TYPES[Math.max(a, b)] : 'smooth';
const additive = ([a, b]: Pair) => (a + b) / 10;

/** Pure and deterministic. Genome v1 always yields the classic appearance. */
export function expressAppearance(genome: Genome): Appearance {
  const alleles = (locus: AppearanceLocus) => appearanceAlleles(genome, locus);
  const motif = alleles('body_motif');
  return {
    base: classicDominant(BASE_COLORS, alleles('base_color')),
    accent: classicDominant(ACCENT_COLORS, alleles('accent_color')),
    dots: dotColors(alleles('dot_color')),
    iris: classicDominant(IRIS_COLORS, alleles('iris_color')),
    shimmer: additive(alleles('shimmer')),
    scales: scaleType(alleles('scale_type')),
    patches: motif[0] && motif[1] ? 0 : 1,
    motifs: overlay(BODY_MOTIFS, motif),
    density: additive(alleles('motif_density')),
    motifScale: additive(alleles('motif_scale')),
    contrast: 0.55 + 0.45 * additive(alleles('motif_contrast')),
    reach: additive(alleles('motif_reach')),
    finMotifs: overlay(FIN_MOTIFS, alleles('fin_motif')),
  };
}

export const CLASSIC_APPEARANCE: Appearance = expressAppearance({ version: 1, maternal: [], paternal: [] });

/** Names of the new features a fish visibly shows; empty for the classic look. */
export function appearanceFeatures(a: Appearance): string[] {
  const features: string[] = [];
  if (a.base[0] !== 'classic') features.push('body color');
  if (a.accent[0] !== 'classic') features.push('accent color');
  if (a.iris[0] !== 'natural') features.push('eye color');
  if (a.shimmer >= SHIMMER_VISIBLE) features.push('shimmer');
  if (a.scales !== 'smooth') features.push('scales');
  if (a.motifs.length) features.push('body pattern');
  if (a.finMotifs.length) features.push('fin pattern');
  return features;
}

const CATEGORY_VALUE = {
  base_color: (pair: Pair) => classicDominant(BASE_COLORS, pair),
  accent_color: (pair: Pair) => classicDominant(ACCENT_COLORS, pair),
  dot_color: dotColors,
  iris_color: (pair: Pair) => classicDominant(IRIS_COLORS, pair),
  scale_type: scaleType,
  body_motif: (pair: Pair) => overlay(BODY_MOTIFS, pair),
  fin_motif: (pair: Pair) => overlay(FIN_MOTIFS, pair),
} satisfies Partial<Record<AppearanceLocus, (pair: Pair) => unknown>>;

/** Exact probability that a founder expresses the same value as this allele pair at one locus. */
export function founderFrequency(locus: keyof typeof CATEGORY_VALUE, pair: Pair): number {
  const weights = APPEARANCE_FOUNDER_WEIGHTS[locus], expressed = CATEGORY_VALUE[locus] as (pair: Pair) => unknown;
  const target = JSON.stringify(expressed(pair));
  let total = 0;
  for (let a = 0; a < weights.length; a++) for (let b = 0; b < weights.length; b++) {
    if (JSON.stringify(expressed([a, b])) === target) total += weights[a] * weights[b];
  }
  return total;
}

export type AppearanceRarity = 'uncommon' | 'rare' | 'very rare';
export type AppearanceTrait = { trait: string; value: string; rarity: AppearanceRarity | null };

/** Founder-stock rarity only: it says nothing about a player's aquarium or any global population. */
export const rarityFor = (frequency: number): AppearanceRarity => frequency >= 0.02 ? 'uncommon' : frequency >= 0.003 ? 'rare' : 'very rare';

const BODY_MOTIF_LABELS: Record<BodyMotif, string> = { spots: 'fine spots', stripes: 'tiger stripes', marble: 'marbling', calico: 'calico flecks', rosettes: 'rosettes' };
const FIN_MOTIF_LABELS: Record<FinMotif, string> = { spots: 'spotted fins', bands: 'banded fins', edge: 'colored fin edges', tips: 'dark fin tips', flame: 'flame rays' };
const SCALE_LABELS: Record<ScaleType, string> = { smooth: 'Smooth', fine: 'Fine scales', mirror: 'Mirror scales', net: 'Netted scales', pearl: 'Pearl scales', armor: 'Armored scales' };
const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const both = (names: readonly string[]) => names.join(' and ');
const motifText = <T extends string>(motifs: readonly Motif<T>[], labels: Record<T, string>) =>
  both(motifs.map(motif => `${motif.strength === CARRIER_STRENGTH ? 'faint ' : ''}${labels[motif.kind]}`));

/** Inspector rows. Rarity is the exact founder-stock frequency of the expressed value, never a population census. */
export function describeAppearance(genome: Genome): AppearanceTrait[] {
  const a = expressAppearance(genome), pair = (locus: AppearanceLocus) => appearanceAlleles(genome, locus);
  const rarity = (locus: keyof typeof CATEGORY_VALUE, classic: boolean) => classic ? null : rarityFor(founderFrequency(locus, pair(locus)));
  const shimmerSum = pair('shimmer')[0] + pair('shimmer')[1], weights = APPEARANCE_FOUNDER_WEIGHTS.shimmer;
  let shimmerAtLeast = 0;
  for (let x = 0; x < 6; x++) for (let y = 0; y < 6; y++) if (x + y >= shimmerSum) shimmerAtLeast += weights[x] * weights[y];
  const showsDots = a.motifs.some(m => m.kind === 'spots' || m.kind === 'calico') || a.finMotifs.some(m => m.kind === 'spots');
  const rows: AppearanceTrait[] = [
    { trait: 'Body color', value: a.base[0] === 'classic' ? 'Classic' : sentence(`${both(a.base)}${a.base.length > 1 ? ' blend' : ''}`), rarity: rarity('base_color', a.base[0] === 'classic') },
    { trait: 'Accent color', value: a.accent[0] === 'classic' ? 'Classic orange' : sentence(`${both(a.accent)}${a.accent.length > 1 ? ' blend' : ''}`), rarity: rarity('accent_color', a.accent[0] === 'classic') },
    { trait: 'Eyes', value: a.iris[0] === 'natural' ? 'Natural' : sentence(`${both(a.iris)}${a.iris.length > 1 ? ' two-tone' : ''}`), rarity: rarity('iris_color', a.iris[0] === 'natural') },
    { trait: 'Body pattern', value: a.motifs.length ? sentence(`${motifText(a.motifs, BODY_MOTIF_LABELS)}${a.patches ? ' over classic patches' : ''}`) : 'Classic patches', rarity: rarity('body_motif', !a.motifs.length) },
  ];
  if (showsDots) rows.push({ trait: 'Dot color', value: sentence(both(a.dots)), rarity: rarity('dot_color', a.dots.length === 1 && a.dots[0] === 'ink') });
  rows.push(
    { trait: 'Scales', value: SCALE_LABELS[a.scales], rarity: rarity('scale_type', a.scales === 'smooth') },
    { trait: 'Shimmer', value: a.shimmer >= 0.7 ? 'Strong' : a.shimmer >= SHIMMER_VISIBLE ? 'Soft' : 'None', rarity: a.shimmer >= SHIMMER_VISIBLE ? rarityFor(shimmerAtLeast) : null },
    {
      trait: 'Fins',
      value: sentence([a.finMotifs.length ? motifText(a.finMotifs, FIN_MOTIF_LABELS) : '', a.motifs.length && a.reach >= REACH_VISIBLE ? 'body pattern on tail and dorsal' : ''].filter(Boolean).join('; ') || 'plain'),
      rarity: rarity('fin_motif', !a.finMotifs.length),
    },
  );
  return rows;
}
