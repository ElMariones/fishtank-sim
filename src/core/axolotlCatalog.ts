/**
 * Standalone synthetic axolotl genome catalog.
 *
 * This intentionally does not import or reuse koi loci, allele IDs, chromosomes, or the koi registry.
 * The only shared contract expected by later integration is that a diploid genome stores phased numeric
 * allele IDs. Locus IDs and semantics in this file are axolotl-specific and versioned independently.
 */

export const AXOLOTL_GENOME_VERSION = 1 as const;
export const AXOLOTL_ALLELE_COUNT = 6;
export const AXOLOTL_DEFAULT_MUTATION_RATE = 0.0015;

export const AXOLOTL_LOCI = [
  'axo_body_length', 'axo_body_width', 'axo_body_depth', 'axo_body_taper', 'axo_trunk_flex', 'axo_mass_bias',
  'axo_head_width', 'axo_head_length', 'axo_snout_roundness', 'axo_mouth_width', 'axo_jaw_depth', 'axo_neck_width',
  'axo_forelimb_length', 'axo_hindlimb_length', 'axo_limb_thickness', 'axo_digit_length', 'axo_digit_spread', 'axo_digit_count',
  'axo_tail_length', 'axo_tail_height', 'axo_tail_taper', 'axo_fin_height', 'axo_fin_reach', 'axo_tail_wave',
  'axo_gill_stalk_length', 'axo_gill_branch_density', 'axo_gill_filament_length', 'axo_gill_angle', 'axo_gill_saturation', 'axo_oxygen_efficiency',
  'axo_eye_size', 'axo_eye_spacing', 'axo_eye_height', 'axo_pupil_size', 'axo_skin_texture', 'axo_skin_luster',
  'axo_melanophore_density', 'axo_xanthophore_density', 'axo_iridophore_density', 'axo_leucistic_switch', 'axo_albinism_switch', 'axo_melanoid_switch',
  'axo_base_hue', 'axo_gill_hue', 'axo_iris_hue', 'axo_pink_flush', 'axo_iridescence', 'axo_translucency',
  'axo_pattern_mode', 'axo_pattern_density', 'axo_pattern_scale', 'axo_pattern_contrast', 'axo_pattern_edge', 'axo_pattern_symmetry',
  'axo_adult_size', 'axo_growth_rate', 'axo_maturity_timing', 'axo_longevity', 'axo_metabolism', 'axo_fertility',
  'axo_activity', 'axo_boldness', 'axo_sociability', 'axo_curiosity', 'axo_feeding_drive', 'axo_regeneration',
] as const;

export type AxolotlLocus = typeof AXOLOTL_LOCI[number];
export type AxolotlExpressionKind = 'quantitative' | 'categorical' | 'recessive-switch';

export type AxolotlMutationTarget = { allele: number; weight: number };
export type AxolotlAlleleDefinition = {
  id: string;
  label: string;
  /** Numeric expression effect. Meaning is locus-specific; quantitative loci use -1..1. */
  effect: number;
  founderWeight: number;
  mutationTargets: readonly AxolotlMutationTarget[];
};

export type AxolotlLocusDefinition = {
  id: AxolotlLocus;
  label: string;
  chromosomeId: string;
  chromosomeLabel: string;
  positionCm: number;
  expression: AxolotlExpressionKind;
  mutationMultiplier: number;
  alleles: readonly AxolotlAlleleDefinition[];
};

export type AxolotlChromosomeDefinition = {
  id: string;
  label: string;
  loci: readonly AxolotlLocus[];
};

type Weights = readonly [number, number, number, number, number, number];
const BALANCED: Weights = [0.04, 0.15, 0.31, 0.31, 0.15, 0.04];
const CONSERVATIVE: Weights = [0.015, 0.10, 0.385, 0.385, 0.10, 0.015];
const RARE_HIGH: Weights = [0.24, 0.28, 0.25, 0.15, 0.065, 0.015];
const RECESSIVE_SWITCH: Weights = [0.80, 0.07, 0.05, 0.035, 0.03, 0.015];
const PATTERN_MODES: Weights = [0.55, 0.18, 0.11, 0.08, 0.05, 0.03];
const TEXTURES: Weights = [0.55, 0.20, 0.12, 0.07, 0.04, 0.02];
const COLOR_VARIANTS: Weights = [0.40, 0.20, 0.15, 0.10, 0.09, 0.06];

const Q_EFFECTS = [-1, -0.6, -0.2, 0.2, 0.6, 1] as const;
const Q_LABELS = ['very low', 'low', 'subtle', 'moderate', 'high', 'extreme'] as const;
const POSITIONS = [0, 9, 19, 31, 44, 60] as const;

const mutationTargets = (index: number): readonly AxolotlMutationTarget[] => {
  if (index === 0) return [{ allele: 1, weight: 1 }];
  if (index === AXOLOTL_ALLELE_COUNT - 1) return [{ allele: AXOLOTL_ALLELE_COUNT - 2, weight: 1 }];
  return [{ allele: index - 1, weight: 0.5 }, { allele: index + 1, weight: 0.5 }];
};

const quantitativeAlleles = (weights: Weights): readonly AxolotlAlleleDefinition[] =>
  Q_EFFECTS.map((effect, index) => ({
    id: `Q${index}`,
    label: Q_LABELS[index],
    effect,
    founderWeight: weights[index],
    mutationTargets: mutationTargets(index),
  }));

const namedAlleles = (
  labels: readonly [string, string, string, string, string, string],
  effects: readonly [number, number, number, number, number, number],
  weights: Weights,
): readonly AxolotlAlleleDefinition[] => labels.map((label, index) => ({
  id: `A${index}`,
  label,
  effect: effects[index],
  founderWeight: weights[index],
  mutationTargets: mutationTargets(index),
}));

const chromosome = (id: string, label: string, loci: readonly AxolotlLocus[]): AxolotlChromosomeDefinition => ({ id, label, loci });

export const AXOLOTL_CHROMOSOMES = [
  chromosome('AX-BODY', 'Body frame', AXOLOTL_LOCI.slice(0, 6)),
  chromosome('AX-HEAD', 'Head and jaw', AXOLOTL_LOCI.slice(6, 12)),
  chromosome('AX-LIMB', 'Limbs and digits', AXOLOTL_LOCI.slice(12, 18)),
  chromosome('AX-TAIL', 'Tail and fin', AXOLOTL_LOCI.slice(18, 24)),
  chromosome('AX-GILL', 'External gills', AXOLOTL_LOCI.slice(24, 30)),
  chromosome('AX-SKIN', 'Eyes and skin', AXOLOTL_LOCI.slice(30, 36)),
  chromosome('AX-PIG', 'Pigment cells', AXOLOTL_LOCI.slice(36, 42)),
  chromosome('AX-COLOR', 'Chromatics', AXOLOTL_LOCI.slice(42, 48)),
  chromosome('AX-PATTERN', 'Pattern', AXOLOTL_LOCI.slice(48, 54)),
  chromosome('AX-LIFE', 'Life history', AXOLOTL_LOCI.slice(54, 60)),
  chromosome('AX-BEH', 'Behavior and repair', AXOLOTL_LOCI.slice(60, 66)),
] as const satisfies readonly AxolotlChromosomeDefinition[];

const labels: Record<AxolotlLocus, string> = {
  axo_body_length: 'Body length', axo_body_width: 'Body width', axo_body_depth: 'Body depth', axo_body_taper: 'Body taper', axo_trunk_flex: 'Trunk flex', axo_mass_bias: 'Mass bias',
  axo_head_width: 'Head width', axo_head_length: 'Head length', axo_snout_roundness: 'Snout roundness', axo_mouth_width: 'Mouth width', axo_jaw_depth: 'Jaw depth', axo_neck_width: 'Neck width',
  axo_forelimb_length: 'Forelimb length', axo_hindlimb_length: 'Hindlimb length', axo_limb_thickness: 'Limb thickness', axo_digit_length: 'Digit length', axo_digit_spread: 'Digit spread', axo_digit_count: 'Digit count',
  axo_tail_length: 'Tail length', axo_tail_height: 'Tail height', axo_tail_taper: 'Tail taper', axo_fin_height: 'Tail fin height', axo_fin_reach: 'Tail fin reach', axo_tail_wave: 'Tail wave',
  axo_gill_stalk_length: 'Gill stalk length', axo_gill_branch_density: 'Gill branch density', axo_gill_filament_length: 'Gill filament length', axo_gill_angle: 'Gill angle', axo_gill_saturation: 'Gill saturation', axo_oxygen_efficiency: 'Oxygen efficiency',
  axo_eye_size: 'Eye size', axo_eye_spacing: 'Eye spacing', axo_eye_height: 'Eye height', axo_pupil_size: 'Pupil size', axo_skin_texture: 'Skin texture', axo_skin_luster: 'Skin luster',
  axo_melanophore_density: 'Melanophore density', axo_xanthophore_density: 'Xanthophore density', axo_iridophore_density: 'Iridophore density', axo_leucistic_switch: 'Leucistic pathway', axo_albinism_switch: 'Albinism pathway', axo_melanoid_switch: 'Melanoid pathway',
  axo_base_hue: 'Base hue', axo_gill_hue: 'Gill hue', axo_iris_hue: 'Iris hue', axo_pink_flush: 'Pink flush', axo_iridescence: 'Iridescence', axo_translucency: 'Translucency',
  axo_pattern_mode: 'Pattern mode', axo_pattern_density: 'Pattern density', axo_pattern_scale: 'Pattern scale', axo_pattern_contrast: 'Pattern contrast', axo_pattern_edge: 'Pattern edge', axo_pattern_symmetry: 'Pattern symmetry',
  axo_adult_size: 'Adult size', axo_growth_rate: 'Growth rate', axo_maturity_timing: 'Maturity timing', axo_longevity: 'Longevity', axo_metabolism: 'Metabolism', axo_fertility: 'Fertility',
  axo_activity: 'Activity', axo_boldness: 'Boldness', axo_sociability: 'Sociability', axo_curiosity: 'Curiosity', axo_feeding_drive: 'Feeding drive', axo_regeneration: 'Regeneration',
};

const specialAlleles: Partial<Record<AxolotlLocus, readonly AxolotlAlleleDefinition[]>> = {
  axo_skin_texture: namedAlleles(
    ['silken smooth', 'satin', 'fine pebbled', 'velvet', 'granular', 'ridged'],
    [0, 0.2, 0.4, 0.6, 0.8, 1],
    TEXTURES,
  ),
  axo_leucistic_switch: namedAlleles(
    ['standard', 'quiet carrier', 'modifier', 'reduced signaling', 'severe reduction', 'null'],
    [0, 0.1, 0.25, 0.45, 0.75, 1],
    RECESSIVE_SWITCH,
  ),
  axo_albinism_switch: namedAlleles(
    ['standard', 'quiet carrier', 'modifier', 'reduced synthesis', 'severe reduction', 'null'],
    [0, 0.1, 0.25, 0.45, 0.75, 1],
    RECESSIVE_SWITCH,
  ),
  axo_melanoid_switch: namedAlleles(
    ['standard', 'quiet carrier', 'modifier', 'reduced iridophore cue', 'strong melanoid', 'full melanoid'],
    [0, 0.1, 0.25, 0.45, 0.75, 1],
    RECESSIVE_SWITCH,
  ),
  axo_base_hue: namedAlleles(
    ['olive', 'cocoa', 'copper', 'golden', 'peach', 'lavender'],
    [-0.45, -0.2, 0, 0.2, 0.45, 0.75],
    COLOR_VARIANTS,
  ),
  axo_gill_hue: namedAlleles(
    ['rose', 'coral', 'salmon', 'crimson', 'violet', 'pearl'],
    [-0.45, -0.15, 0.05, 0.3, 0.65, 1],
    COLOR_VARIANTS,
  ),
  axo_iris_hue: namedAlleles(
    ['charcoal', 'bronze', 'amber', 'copper', 'ruby', 'silver'],
    [-0.5, -0.2, 0, 0.25, 0.6, 1],
    COLOR_VARIANTS,
  ),
  axo_pattern_mode: namedAlleles(
    ['plain', 'speckled', 'spotted', 'mottled', 'dappled', 'marbled'],
    [0, 1, 2, 3, 4, 5],
    PATTERN_MODES,
  ),
};

const recessiveSwitches = new Set<AxolotlLocus>(['axo_leucistic_switch', 'axo_albinism_switch', 'axo_melanoid_switch']);
const categorical = new Set<AxolotlLocus>(['axo_skin_texture', 'axo_base_hue', 'axo_gill_hue', 'axo_iris_hue', 'axo_pattern_mode']);
const conservative = new Set<AxolotlLocus>([
  'axo_digit_count', 'axo_trunk_flex', 'axo_tail_wave', 'axo_eye_height', 'axo_pupil_size', 'axo_maturity_timing',
  'axo_metabolism', 'axo_fertility', 'axo_boldness', 'axo_sociability', 'axo_curiosity', 'axo_regeneration',
]);
const rareHigh = new Set<AxolotlLocus>(['axo_iridescence', 'axo_translucency', 'axo_skin_luster', 'axo_pink_flush']);

const definitions: AxolotlLocusDefinition[] = [];
for (const chr of AXOLOTL_CHROMOSOMES) {
  chr.loci.forEach((id, offset) => {
    const expression: AxolotlExpressionKind = recessiveSwitches.has(id) ? 'recessive-switch' : categorical.has(id) ? 'categorical' : 'quantitative';
    const alleles = specialAlleles[id] ?? quantitativeAlleles(rareHigh.has(id) ? RARE_HIGH : conservative.has(id) ? CONSERVATIVE : BALANCED);
    definitions.push({
      id,
      label: labels[id],
      chromosomeId: chr.id,
      chromosomeLabel: chr.label,
      positionCm: POSITIONS[offset],
      expression,
      mutationMultiplier: recessiveSwitches.has(id) ? 0.55 : categorical.has(id) ? 0.75 : 1,
      alleles,
    });
  });
}

/** Stable axolotl registry order. Never reorder within genome version 1. */
export const AXOLOTL_LOCUS_REGISTRY = definitions as readonly AxolotlLocusDefinition[];

export const AXOLOTL_LOCUS_INDEX = Object.fromEntries(
  AXOLOTL_LOCUS_REGISTRY.map((entry, index) => [entry.id, index]),
) as Record<AxolotlLocus, number>;

/** Small save/inspector contract that can be consumed without importing axolotl expression code. */
export const AXOLOTL_GENOME_METADATA = {
  species: 'axolotl',
  version: AXOLOTL_GENOME_VERSION,
  lociPerHomolog: AXOLOTL_LOCI.length,
  chromosomes: AXOLOTL_CHROMOSOMES.length,
  maxAllelesPerLocus: AXOLOTL_ALLELE_COUNT,
} as const;

export function axolotlLocusDefinition(id: AxolotlLocus): AxolotlLocusDefinition {
  return AXOLOTL_LOCUS_REGISTRY[AXOLOTL_LOCUS_INDEX[id]];
}

export const axolotlLocusLabel = (id: AxolotlLocus): string => axolotlLocusDefinition(id).label;

export function axolotlAlleleLabel(id: AxolotlLocus, allele: number): string {
  const definition = axolotlLocusDefinition(id);
  if (!Number.isInteger(allele) || allele < 0 || allele >= definition.alleles.length) {
    throw new Error(`Invalid axolotl allele ${String(allele)} for ${id}.`);
  }
  return definition.alleles[allele].label;
}

/**
 * Short human descriptions of every axolotl locus for the genome view's hover notes. Text only: expression, inheritance
 * and saves never read it. Loci the simulation records but does not act on yet say so, to keep the lab honest.
 */
export const AXOLOTL_LOCUS_NOTES: Record<AxolotlLocus, string> = {
  axo_body_length: 'Trunk length relative to the head; also 30% of adult length potential.',
  axo_body_width: 'Trunk width seen from above. Wider bodies add drag and swim slower.',
  axo_body_depth: 'Trunk height from back to belly.',
  axo_body_taper: 'How sharply the trunk narrows into the tail.',
  axo_trunk_flex: 'A slight resting bend of the trunk around a straight midpoint.',
  axo_mass_bias: 'Overall heft, from slender to heavy; also 15% of adult length potential.',
  axo_head_width: 'Width of the broad, flat head.',
  axo_head_length: 'Head length from snout to gills.',
  axo_snout_roundness: 'From a narrow, pointed snout to a wide, rounded one.',
  axo_mouth_width: 'Width of the mouth line, the familiar axolotl smile.',
  axo_jaw_depth: 'Depth of the lower jaw below the mouth line.',
  axo_neck_width: 'How much the neck narrows behind the gills.',
  axo_forelimb_length: 'Front leg length.',
  axo_hindlimb_length: 'Hind leg length.',
  axo_limb_thickness: 'Thickness of all four legs.',
  axo_digit_length: 'Toe length on every foot.',
  axo_digit_spread: 'How widely the toes fan out.',
  axo_digit_count: 'Moves toe counts from the usual 4 front and 5 rear by at most one.',
  axo_tail_length: 'Tail length relative to the trunk.',
  axo_tail_height: 'Tail height. Taller tails add drag and swim slower.',
  axo_tail_taper: 'How quickly the tail narrows to its tip.',
  axo_fin_height: 'Height of the soft fin crest around the tail.',
  axo_fin_reach: 'How far the fin crest runs forward along the back.',
  axo_tail_wave: 'A slight resting sideways wave in the tail.',
  axo_gill_stalk_length: 'Length of the three stalks on each side of the head.',
  axo_gill_branch_density: 'Filament branches per stalk, about 4 to 15.',
  axo_gill_filament_length: 'Length of each feathery gill filament.',
  axo_gill_angle: 'How far the gill stalks sweep back, about 18° to 73°.',
  axo_gill_saturation: 'Color strength of the gills.',
  axo_oxygen_efficiency: 'Oxygen use: efficient animals need less oxygen and cruise a little faster.',
  axo_eye_size: 'Eye diameter.',
  axo_eye_spacing: 'How far apart the eyes sit on the head.',
  axo_eye_height: 'Where the eyes sit, from the side of the head to the top.',
  axo_pupil_size: 'Pupil size within the iris.',
  axo_skin_texture: 'Skin surface. Of the two copies, the rougher texture is expressed.',
  axo_skin_luster: 'Glossy sheen of the skin.',
  axo_melanophore_density: 'Dark pigment cells. Low levels give a hypomelanistic look.',
  axo_xanthophore_density: 'Yellow pigment cells. Very low with dark skin reads as axanthic-like; very high with pale skin as xanthic-like.',
  axo_iridophore_density: 'Reflective pigment cells that add shine and gold flecks.',
  axo_leucistic_switch: 'Two severe copies (A4–A5) give a pale leucistic-like morph with dark eyes. One is a hidden carrier.',
  axo_albinism_switch: 'Two severe copies (A4–A5) remove all dark pigment and redden the eyes; albino overrides leucistic. One is a hidden carrier.',
  axo_melanoid_switch: 'Two severe copies (A4–A5) give a dark melanoid-like morph with little yellow and shine. One is a hidden carrier.',
  axo_base_hue: 'Named skin hue. Two different copies blend around the color wheel.',
  axo_gill_hue: 'Named gill hue. Two different copies blend around the color wheel.',
  axo_iris_hue: 'Named eye hue. Albino-like animals always have red eyes.',
  axo_pink_flush: 'Pink flush in the gills and pale skin.',
  axo_iridescence: 'Iridescent sheen, only visible where reflective cells are present.',
  axo_translucency: 'How see-through the skin looks; leucistic-like animals add more.',
  axo_pattern_mode: 'Pattern type. Plain yields to any pattern, and two different patterns both show.',
  axo_pattern_density: 'How much of the body the pattern covers.',
  axo_pattern_scale: 'Size of each pattern mark.',
  axo_pattern_contrast: 'How strongly marks stand out from the skin.',
  axo_pattern_edge: 'Crisp versus soft mark outlines.',
  axo_pattern_symmetry: 'How closely the two flanks mirror each other.',
  axo_adult_size: 'Major size locus: 55% of adult length potential, about 16 to 33 cm.',
  axo_growth_rate: 'How fast the animal approaches its adult size.',
  axo_maturity_timing: 'Recorded maturity age, 8 to 18 months. Not simulated yet: axolotls mature on the shared lab schedule.',
  axo_longevity: 'Lifespan potential, about 8 to 18 game years.',
  axo_metabolism: 'Food and oxygen use. Higher metabolism eats more of the tank food pool.',
  axo_fertility: 'Courtship readiness and how quickly a pair completes courtship.',
  axo_activity: 'How much time the animal spends moving rather than resting.',
  axo_boldness: 'Willingness to leave cover and approach food first.',
  axo_sociability: 'Tendency to stay near tankmates.',
  axo_curiosity: 'Interest in its surroundings; also tightens turns.',
  axo_feeding_drive: 'Recorded appetite. Not simulated yet: feeding uses metabolism.',
  axo_regeneration: 'Recorded regeneration potential. Not simulated yet: animals are never injured.',
};

export const AXOLOTL_EXPRESSION_NOTES: Record<AxolotlExpressionKind, string> = {
  quantitative: 'Quantitative: the two copies average, from very low to extreme.',
  categorical: 'Categorical: each allele is a named state; the note above says how two copies combine.',
  'recessive-switch': 'Recessive: only two severe copies change the animal. Milder alleles (A1–A3) are recorded but have no visible effect.',
};
