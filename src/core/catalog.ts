/** Stable ordered loci: 8 synthetic chromosomes, 6 loci each. Not a real koi genome. */
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

export type Locus = typeof LOCI[number];
export const CHROMOSOMES = ['Body', 'Face', 'Fins', 'Pigments', 'Pattern', 'Life history', 'Behavior', 'Regulation'];
export const ALLELE_COUNT = 6;
export const MUTATION_RATE = 0.003; // Per transmitted copy, NOT per offspring.
export const CROSSOVER_RATE = 0.12; // Switch probability at each adjacent boundary.
export const FOUNDER_WEIGHTS = [0.1, 0.22, 0.32, 0.24, 0.1, 0.02];
export const label = (name: string) => name.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase());
