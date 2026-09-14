/** Stable ordered genome v1 loci: 8 synthetic chromosomes, 6 loci each. Not a real koi genome. Never reorder. */
export const LOCI = [
  'body_length', 'body_depth', 'body_taper', 'spine_curve', 'head_length', 'snout_length',
  'eye_size', 'eye_position', 'iris_hue', 'pupil_size', 'mouth_size', 'barbel_length',
  'tail_length', 'tail_spread', 'tail_fork', 'dorsal_height', 'pectoral_length', 'fin_pigment',
  'red', 'yellow', 'black', 'white', 'reflectivity', 'translucency',
  'pattern_frequency', 'pattern_scale', 'pattern_warp', 'pattern_symmetry', 'pattern_edge', 'speckle',
  'size_1', 'growth_rate', 'longevity', 'metabolism', 'oxygen_demand', 'fertility',
  'thrust', 'turning', 'activity', 'sociability', 'boldness', 'curiosity',
  'size_2', 'pigment_gain', 'fin_gain', 'head_gain', 'melanin_switch', 'metallic_switch',
] as const;

/**
 * Genome v2 appends chromosome 9 (Color) and chromosome 10 (Ornament). Genome v1 fish do not carry them and are read
 * as homozygous for the classic baseline, so their appearance never changes.
 */
export const APPEARANCE_LOCI = [
  'base_color', 'accent_color', 'dot_color', 'iris_color', 'shimmer', 'scale_type',
  'body_motif', 'motif_density', 'motif_scale', 'motif_contrast', 'motif_reach', 'fin_motif',
] as const;
export const ALL_LOCI = [...LOCI, ...APPEARANCE_LOCI] as const;

export type Locus = typeof LOCI[number];
export type AppearanceLocus = typeof APPEARANCE_LOCI[number];
export const CHROMOSOMES = ['Body', 'Face', 'Fins', 'Pigments', 'Pattern', 'Life history', 'Behavior', 'Regulation', 'Color', 'Ornament'];
export type GenomeVersion = 1 | 2;
export const GENOME_VERSION: GenomeVersion = 2;
export const ALLELE_COUNT = 6;
export const MUTATION_RATE = 0.003; // Per transmitted copy, NOT per offspring.
export const CROSSOVER_RATE = 0.12; // Switch probability at each adjacent boundary.
export const FOUNDER_WEIGHTS = [0.1, 0.22, 0.32, 0.24, 0.1, 0.02];
/** Appearance pipeline versions. Lab records do not store per-fish model versions yet (see ADR-018). */
export const MODEL_VERSIONS = { genome: 2, development: 4, anatomy: 2, renderer: 6 } as const;
export const label = (name: string) => name.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase());
