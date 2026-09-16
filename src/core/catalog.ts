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
/**
 * Genome v3 (FS-601) appends chromosome 11 (Structure): supported tail topologies, dorsal and barbel variants and bounded
 * shape modifiers. Genome v1 and v2 fish do not carry it and always express the standard structure.
 */
export const STRUCTURE_LOCI = ['tail_topology', 'lobe_balance', 'topology_spread', 'dorsal_form', 'barbel_count', 'fin_ray_density'] as const;
/** Every locus of the current genome version, in stable order. */
export const GENOME_LOCI = [...ALL_LOCI, ...STRUCTURE_LOCI] as const;

export type Locus = typeof LOCI[number];
export type AppearanceLocus = typeof APPEARANCE_LOCI[number];
export type StructureLocus = typeof STRUCTURE_LOCI[number];
export type GenomeLocus = typeof GENOME_LOCI[number];
export const CHROMOSOMES = ['Body', 'Face', 'Fins', 'Pigments', 'Pattern', 'Life history', 'Behavior', 'Regulation', 'Color', 'Ornament', 'Structure'];
export type GenomeVersion = 1 | 2 | 3;
export const GENOME_VERSIONS = [1, 2, 3] as const satisfies readonly GenomeVersion[];
export const GENOME_VERSION: GenomeVersion = 3;
/** Loci carried by each genome version. */
export const LOCI_PER_GENOME: Record<GenomeVersion, number> = { 1: 48, 2: 60, 3: 66 };
export const ALLELE_COUNT = 6;
export const MUTATION_RATE = 0.003; // Per transmitted copy, NOT per offspring.
export const CROSSOVER_RATE = 0.12; // Switch probability at each adjacent boundary.
export const FOUNDER_WEIGHTS = [0.1, 0.22, 0.32, 0.24, 0.1, 0.02];
/** Appearance pipeline versions. Lab records do not store per-fish model versions yet (see ADR-018). */
export const MODEL_VERSIONS = { genome: 3, development: 5, anatomy: 2, renderer: 6 } as const;
export const label = (name: string) => name.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase());
