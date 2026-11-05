/**
 * Standalone synthetic guppy genome catalog (guppy genome v1, world v20).
 *
 * Guppies arrive Genesis-native like goldfish: 72 loci on 12 synthetic chromosomes plus a development block. Nothing here
 * reuses koi, axolotl or goldfish loci, allele IDs or streams.
 *
 * What is new for the lab is chromosome 12, a sex chromosome modelled on the guppy's real sex chromosome (linkage group
 * 12). Its last locus is the sex-determining region: an XY male carries a Y allele on the homolog he received from his
 * father. Near that region a male's X and Y almost never recombine, so color genes there travel from father to son; a
 * rare crossover (about 1.5% of male meioses, as Winge observed) moves one onto the X. See docs/research/FS-131-GUPPY.md.
 *
 * Real anchors, simplified for a game: Y-linked color programs (maculatus, Moscow, armatus, pingu), recessive blond,
 * golden, albino and blue (no red pigment) base colors, dominant Asian Blau, the half-black (tuxedo) rear, snakeskin, the
 * ribbon fins whose heterozygous males cannot sire, and color that only males show. Everything else is a game model.
 */

export const GUPPY_GENOME_VERSION = 1 as const;
export const GUPPY_ALLELE_COUNT = 6;
export const GUPPY_DEFAULT_MUTATION_RATE = 0.0015;

export const GUPPY_LOCI = [
  'gp_body_length', 'gp_body_depth', 'gp_adult_size', 'gp_peduncle', 'gp_back_profile', 'gp_gonopodium',
  'gp_tail_length', 'gp_tail_spread', 'gp_top_sword', 'gp_bottom_sword', 'gp_tail_edge', 'gp_tail_rays',
  'gp_dorsal_length', 'gp_dorsal_shape', 'gp_dumbo', 'gp_ribbon', 'gp_swallow', 'gp_pelvic',
  'gp_blond', 'gp_golden', 'gp_albino', 'gp_blue', 'gp_melanophore', 'gp_xanthophore',
  'gp_asian_blau', 'gp_metal_head', 'gp_sheen', 'gp_iri_hue', 'gp_iri_depth', 'gp_magenta',
  'gp_red_depth', 'gp_red_spread', 'gp_orange_spots', 'gp_yellow_shift', 'gp_diet_response', 'gp_fin_red',
  'gp_tail_pattern', 'gp_pattern_scale', 'gp_pattern_coverage', 'gp_pattern_edge', 'gp_tail_border', 'gp_pattern_symmetry',
  'gp_half_black', 'gp_spot_count', 'gp_spot_size', 'gp_black_edging', 'gp_spot_symmetry', 'gp_dorsal_pattern',
  'gp_growth_rate', 'gp_longevity', 'gp_metabolism', 'gp_maturity_timing', 'gp_brood_size', 'gp_gestation',
  'gp_activity', 'gp_boldness', 'gp_shoaling', 'gp_display', 'gp_choosiness', 'gp_foraging',
  'gp_canalization', 'gp_vigor', 'gp_fertility', 'gp_color_onset', 'gp_female_leak', 'gp_temp_tolerance',
  'gp_pseudo_sheen', 'gp_red_tail', 'gp_snakeskin', 'gp_double_sword', 'gp_y_program', 'gp_sex',
] as const;

export type GuppyLocus = typeof GUPPY_LOCI[number];
export type GuppyExpressionKind = 'quantitative' | 'categorical' | 'recessive' | 'dominant' | 'incomplete' | 'sex';

export type GuppyMutationTarget = { allele: number; weight: number };
export type GuppyAlleleDefinition = {
  id: string; label: string;
  /** Quantitative loci use −1…1; switch loci use 0 (wild) to 1 (full variant). */
  effect: number;
  founderWeight: number;
  mutationTargets: readonly GuppyMutationTarget[];
};
export type GuppyLocusDefinition = {
  id: GuppyLocus; label: string; chromosomeId: string; chromosomeLabel: string; positionCm: number;
  expression: GuppyExpressionKind; mutationMultiplier: number; alleles: readonly GuppyAlleleDefinition[];
};
export type GuppyChromosomeDefinition = { id: string; label: string; loci: readonly GuppyLocus[] };

type Weights = readonly [number, number, number, number, number, number];
const BALANCED: Weights = [0.04, 0.15, 0.31, 0.31, 0.15, 0.04];
const CONSERVATIVE: Weights = [0.015, 0.10, 0.385, 0.385, 0.10, 0.015];
const RARE_HIGH: Weights = [0.24, 0.28, 0.25, 0.15, 0.065, 0.015];
/** Domestic stock has been selected for big, colorful tails for decades. */
const FANCY_HIGH: Weights = [0.08, 0.16, 0.24, 0.24, 0.18, 0.1];

const Q_EFFECTS = [-1, -0.6, -0.2, 0.2, 0.6, 1] as const;
const Q_LABELS = ['very low', 'low', 'subtle', 'moderate', 'high', 'extreme'] as const;
const POSITIONS = [0, 9, 19, 31, 44, 60] as const;
/** Allele index from which a switch locus' allele is a variant copy. */
export const GUPPY_VARIANT_FROM = 4;
/** Sex-determining region: alleles from this index are Y. */
export const Y_FROM = 4;
/** Share of male meioses in which a crossover moves the Y color program onto the X (Winge's rare exchange). */
export const WINGE_CROSSOVER = 0.015;

const mutationTargets = (index: number): readonly GuppyMutationTarget[] => {
  if (index === 0) return [{ allele: 1, weight: 1 }];
  if (index === GUPPY_ALLELE_COUNT - 1) return [{ allele: GUPPY_ALLELE_COUNT - 2, weight: 1 }];
  return [{ allele: index - 1, weight: 0.5 }, { allele: index + 1, weight: 0.5 }];
};
const quantitative = (weights: Weights): readonly GuppyAlleleDefinition[] =>
  Q_EFFECTS.map((effect, index) => ({ id: `Q${index}`, label: Q_LABELS[index], effect, founderWeight: weights[index], mutationTargets: mutationTargets(index) }));
type Six<T> = readonly [T, T, T, T, T, T];
const named = (labels: Six<string>, effects: Six<number>, weights: Weights, targets = mutationTargets): readonly GuppyAlleleDefinition[] =>
  labels.map((label, index) => ({ id: `P${index}`, label, effect: effects[index], founderWeight: weights[index], mutationTargets: targets(index) }));
/** A loss-of-function variant mostly arises from the wild allele next to it, and reverts rarely. */
const switchTargets = (index: number): readonly GuppyMutationTarget[] =>
  index < 3 ? mutationTargets(index) : index === 3 ? [{ allele: 2, weight: 0.4 }, { allele: 4, weight: 0.6 }] : mutationTargets(index);
const SWITCH_EFFECTS = [0, 0, 0.05, 0.15, 1, 1] as const;
/** Categorical loci mutate to any other state, mostly the neighbouring one. */
const categoricalTargets = (index: number): readonly GuppyMutationTarget[] =>
  [0, 1, 2, 3, 4, 5].filter(i => i !== index).map(i => ({ allele: i, weight: Math.abs(i - index) === 1 ? 2 : 1 }));

const chromosome = (id: string, label: string, loci: readonly GuppyLocus[]): GuppyChromosomeDefinition => ({ id, label, loci });
export const GUPPY_CHROMOSOMES = [
  chromosome('GP-BODY', 'Body', GUPPY_LOCI.slice(0, 6)),
  chromosome('GP-TAIL', 'Caudal fin', GUPPY_LOCI.slice(6, 12)),
  chromosome('GP-FIN', 'Fins', GUPPY_LOCI.slice(12, 18)),
  chromosome('GP-BASE', 'Base color', GUPPY_LOCI.slice(18, 24)),
  chromosome('GP-IRI', 'Iridophores', GUPPY_LOCI.slice(24, 30)),
  chromosome('GP-CARO', 'Carotenoids', GUPPY_LOCI.slice(30, 36)),
  chromosome('GP-TPAT', 'Tail pattern', GUPPY_LOCI.slice(36, 42)),
  chromosome('GP-MARK', 'Body marks', GUPPY_LOCI.slice(42, 48)),
  chromosome('GP-LIFE', 'Life history', GUPPY_LOCI.slice(48, 54)),
  chromosome('GP-BEH', 'Behavior', GUPPY_LOCI.slice(54, 60)),
  chromosome('GP-DEV', 'Development', GUPPY_LOCI.slice(60, 66)),
  chromosome('GP-SEX', 'Sex chromosome (XY)', GUPPY_LOCI.slice(66, 72)),
] as const satisfies readonly GuppyChromosomeDefinition[];
export const SEX_CHROMOSOME = 'GP-SEX';

const LABELS: Record<GuppyLocus, string> = {
  gp_body_length: 'Body length', gp_body_depth: 'Body depth', gp_adult_size: 'Adult size', gp_peduncle: 'Peduncle', gp_back_profile: 'Back profile', gp_gonopodium: 'Gonopodium length',
  gp_tail_length: 'Tail length', gp_tail_spread: 'Tail spread (delta)', gp_top_sword: 'Top sword', gp_bottom_sword: 'Bottom sword', gp_tail_edge: 'Tail edge', gp_tail_rays: 'Tail ray stiffness',
  gp_dorsal_length: 'Dorsal length', gp_dorsal_shape: 'Dorsal shape', gp_dumbo: 'Dumbo pectorals', gp_ribbon: 'Ribbon fins', gp_swallow: 'Swallow fins', gp_pelvic: 'Pelvic length',
  gp_blond: 'Blond (b)', gp_golden: 'Golden (g)', gp_albino: 'Albino (a)', gp_blue: 'Blue (r)', gp_melanophore: 'Melanophores', gp_xanthophore: 'Xanthophores',
  gp_asian_blau: 'Asian Blau (Ab)', gp_metal_head: 'Metal head', gp_sheen: 'Iridescent sheen', gp_iri_hue: 'Iridescent hue', gp_iri_depth: 'Iridophore depth', gp_magenta: 'Magenta',
  gp_red_depth: 'Red depth', gp_red_spread: 'Red spread', gp_orange_spots: 'Orange spots', gp_yellow_shift: 'Yellow shift', gp_diet_response: 'Diet response', gp_fin_red: 'Fin red',
  gp_tail_pattern: 'Tail pattern', gp_pattern_scale: 'Pattern scale', gp_pattern_coverage: 'Pattern coverage', gp_pattern_edge: 'Pattern edge', gp_tail_border: 'Tail border', gp_pattern_symmetry: 'Pattern symmetry',
  gp_half_black: 'Half-black (tuxedo)', gp_spot_count: 'Black spots', gp_spot_size: 'Spot size', gp_black_edging: 'Black edging', gp_spot_symmetry: 'Spot symmetry', gp_dorsal_pattern: 'Dorsal pattern',
  gp_growth_rate: 'Growth rate', gp_longevity: 'Longevity', gp_metabolism: 'Metabolism', gp_maturity_timing: 'Maturity timing', gp_brood_size: 'Brood size', gp_gestation: 'Gestation length',
  gp_activity: 'Activity', gp_boldness: 'Boldness', gp_shoaling: 'Shoaling', gp_display: 'Display vigor', gp_choosiness: 'Female choosiness', gp_foraging: 'Foraging',
  gp_canalization: 'Canalization', gp_vigor: 'Vigor', gp_fertility: 'Fertility', gp_color_onset: 'Color onset', gp_female_leak: 'Female color expression', gp_temp_tolerance: 'Temperature tolerance',
  gp_pseudo_sheen: 'Pseudoautosomal sheen', gp_red_tail: 'Red tail', gp_snakeskin: 'Snakeskin (Ssb)', gp_double_sword: 'Double sword', gp_y_program: 'Y color program', gp_sex: 'Sex-determining region',
};

/** Y color programs. Categorical: every program a male carries shows, whether it sits on his Y or (after a crossover) his X. */
export const Y_PROGRAMS = ['none', 'none (b)', 'maculatus', 'Moscow', 'armatus', 'pingu'] as const;
export type YProgram = 'maculatus' | 'moscow' | 'armatus' | 'pingu';
export const Y_PROGRAM_IDS: readonly (YProgram | null)[] = [null, null, 'maculatus', 'moscow', 'armatus', 'pingu'];
/** Founder Y copies usually carry a program; founder X copies rarely do. */
export const Y_PROGRAM_WEIGHTS = { x: [0.62, 0.3, 0.03, 0.02, 0.02, 0.01], y: [0.2, 0.12, 0.24, 0.16, 0.16, 0.12] } as const;
export const TAIL_PATTERNS = ['plain', 'mosaic', 'grass', 'lace', 'leopard', 'tiger'] as const;
export type GuppyTailPattern = typeof TAIL_PATTERNS[number];

const SPECIAL: Partial<Record<GuppyLocus, { expression: GuppyExpressionKind; alleles: readonly GuppyAlleleDefinition[] }>> = {
  gp_dumbo: { expression: 'recessive', alleles: named(['normal', 'normal (b)', 'normal (c)', 'large', 'dumbo', 'dumbo (giant)'], SWITCH_EFFECTS, [0.78, 0.08, 0.04, 0.04, 0.05, 0.01], switchTargets) },
  gp_ribbon: { expression: 'incomplete', alleles: named(['normal', 'normal (b)', 'normal (c)', 'normal (d)', 'ribbon', 'ribbon (long)'], [0, 0, 0, 0.1, 1, 1], [0.8, 0.09, 0.04, 0.03, 0.03, 0.01], switchTargets) },
  gp_swallow: { expression: 'recessive', alleles: named(['normal', 'normal (b)', 'normal (c)', 'frayed', 'swallow', 'swallow (long)'], SWITCH_EFFECTS, [0.82, 0.07, 0.04, 0.03, 0.03, 0.01], switchTargets) },
  gp_blond: { expression: 'recessive', alleles: named(['wild B', 'wild B (b)', 'wild B (c)', 'pale', 'blond b', 'blond b (b)'], SWITCH_EFFECTS, [0.72, 0.08, 0.05, 0.04, 0.08, 0.03], switchTargets) },
  gp_golden: { expression: 'recessive', alleles: named(['wild G', 'wild G (b)', 'wild G (c)', 'pale', 'golden g', 'golden g (b)'], SWITCH_EFFECTS, [0.76, 0.07, 0.05, 0.03, 0.07, 0.02], switchTargets) },
  gp_albino: { expression: 'recessive', alleles: named(['wild A', 'wild A (b)', 'wild A (c)', 'reduced', 'albino a', 'albino a (b)'], SWITCH_EFFECTS, [0.85, 0.05, 0.03, 0.03, 0.03, 0.01], switchTargets) },
  gp_blue: { expression: 'recessive', alleles: named(['wild R', 'wild R (b)', 'wild R (c)', 'pale red', 'blue r', 'blue r (b)'], SWITCH_EFFECTS, [0.8, 0.06, 0.04, 0.03, 0.05, 0.02], switchTargets) },
  gp_asian_blau: { expression: 'dominant', alleles: named(['wild', 'wild (b)', 'wild (c)', 'wild (d)', 'Asian Blau', 'Asian Blau (strong)'], [0, 0, 0, 0, 1, 1], [0.7, 0.13, 0.06, 0.04, 0.05, 0.02], switchTargets) },
  gp_metal_head: { expression: 'dominant', alleles: named(['plain head', 'plain head (b)', 'plain head (c)', 'plain head (d)', 'metal head', 'metal head (full)'], [0, 0, 0, 0, 1, 1], [0.68, 0.14, 0.06, 0.04, 0.06, 0.02], switchTargets) },
  gp_tail_pattern: { expression: 'categorical', alleles: named(TAIL_PATTERNS, [0, 1, 2, 3, 4, 5], [0.5, 0.15, 0.12, 0.08, 0.1, 0.05], categoricalTargets) },
  gp_half_black: { expression: 'dominant', alleles: named(['plain', 'plain (b)', 'plain (c)', 'plain (d)', 'half-black', 'half-black (deep)'], [0, 0, 0, 0, 1, 1], [0.66, 0.15, 0.06, 0.04, 0.07, 0.02], switchTargets) },
  gp_snakeskin: { expression: 'dominant', alleles: named(['plain', 'plain (b)', 'plain (c)', 'plain (d)', 'snakeskin Ssb', 'snakeskin Ssb (bold)'], [0, 0, 0, 0, 1, 1], [0.66, 0.15, 0.06, 0.04, 0.07, 0.02], switchTargets) },
  gp_double_sword: { expression: 'dominant', alleles: named(['no sword', 'no sword (b)', 'no sword (c)', 'no sword (d)', 'double sword', 'double sword (long)'], [0, 0, 0, 0, 1, 1], [0.6, 0.18, 0.08, 0.04, 0.07, 0.03], switchTargets) },
  gp_y_program: { expression: 'categorical', alleles: named(Y_PROGRAMS, [0, 0, 1, 2, 3, 4], [0.62, 0.3, 0.03, 0.02, 0.02, 0.01], categoricalTargets) },
  gp_sex: { expression: 'sex', alleles: named(['X', 'X (b)', 'X (c)', 'X (d)', 'Y', 'Y (b)'], [0, 0, 0, 0, 1, 1], [1, 0, 0, 0, 0, 0], index => [{ allele: index, weight: 1 }]) },
};
const CONSERVATIVE_LOCI = new Set<GuppyLocus>(['gp_peduncle', 'gp_back_profile', 'gp_gonopodium', 'gp_pelvic', 'gp_metabolism', 'gp_maturity_timing', 'gp_canalization', 'gp_temp_tolerance', 'gp_spot_symmetry', 'gp_pattern_symmetry']);
const RARE_LOCI = new Set<GuppyLocus>(['gp_magenta', 'gp_top_sword', 'gp_bottom_sword', 'gp_black_edging', 'gp_tail_border', 'gp_pseudo_sheen']);
const FANCY_LOCI = new Set<GuppyLocus>(['gp_tail_length', 'gp_tail_spread', 'gp_red_spread', 'gp_sheen', 'gp_iri_depth', 'gp_red_tail']);

const definitions: GuppyLocusDefinition[] = [];
for (const chr of GUPPY_CHROMOSOMES) {
  chr.loci.forEach((id, offset) => {
    const special = SPECIAL[id], expression = special?.expression ?? 'quantitative';
    definitions.push({
      id, label: LABELS[id], chromosomeId: chr.id, chromosomeLabel: chr.label, positionCm: POSITIONS[offset], expression,
      // The sex-determining region never mutates: sex must always agree with the genome.
      mutationMultiplier: expression === 'sex' ? 0 : expression === 'quantitative' ? 1 : expression === 'categorical' ? 0.75 : 0.55,
      alleles: special?.alleles ?? quantitative(FANCY_LOCI.has(id) ? FANCY_HIGH : RARE_LOCI.has(id) ? RARE_HIGH : CONSERVATIVE_LOCI.has(id) ? CONSERVATIVE : BALANCED),
    });
  });
}

/** Stable guppy registry order. Never reorder within guppy genome v1. */
export const GUPPY_LOCUS_REGISTRY = definitions as readonly GuppyLocusDefinition[];
export const GUPPY_LOCI_COUNT = GUPPY_LOCUS_REGISTRY.length;
export const GUPPY_LOCUS_INDEX = Object.fromEntries(GUPPY_LOCUS_REGISTRY.map((entry, index) => [entry.id, index])) as Record<GuppyLocus, number>;
export const SEX_LOCUS = GUPPY_LOCUS_INDEX.gp_sex;
export const Y_PROGRAM_LOCUS = GUPPY_LOCUS_INDEX.gp_y_program;
export const guppyLocusDefinition = (id: GuppyLocus): GuppyLocusDefinition => GUPPY_LOCUS_REGISTRY[GUPPY_LOCUS_INDEX[id]];
export const guppyLabelAt = (index: number) => GUPPY_LOCUS_REGISTRY[index]?.label ?? `Locus ${index}`;
export const guppyAlleleLabelAt = (index: number, allele: number) => allele >= 1000 ? 'new allele' : GUPPY_LOCUS_REGISTRY[index]?.alleles[allele]?.label ?? `P${allele}`;
/** Loci where a carrier hides a variant copy, with the name of the trait two copies show. */
export const GUPPY_RECESSIVES = {
  gp_blond: 'blond', gp_golden: 'golden', gp_albino: 'albino', gp_blue: 'blue (no red)', gp_dumbo: 'dumbo pectorals', gp_swallow: 'swallow fins',
} as const satisfies Partial<Record<GuppyLocus, string>>;
export type GuppyRecessive = keyof typeof GUPPY_RECESSIVES;

/**
 * Hover notes for the genome view. Text only: expression, inheritance and saves never read it.
 */
export const GUPPY_LOCUS_NOTES: Record<GuppyLocus, string> = {
  gp_body_length: 'Slim to compact bodies; also part of adult length.',
  gp_body_depth: 'Body height. Females are always deeper-bodied than males.',
  gp_adult_size: 'Major size locus. Females grow to about 4–6.5 cm, males to 2.5–4 cm.',
  gp_peduncle: 'Thickness of the tail root; thick peduncles carry big tails level.',
  gp_back_profile: 'Straight to gently arched back line.',
  gp_gonopodium: 'Length of the male\'s modified anal fin. Only males show it.',
  gp_tail_length: 'Male tail length, from a short round fan to a long veil.',
  gp_tail_spread: 'How wide the male tail opens. Very wide, long tails are deltas.',
  gp_top_sword: 'Liability for a sword extension on the top edge of the tail.',
  gp_bottom_sword: 'Liability for a sword extension on the bottom edge of the tail.',
  gp_tail_edge: 'Trailing edge: rounded, spade, spear or a single pin.',
  gp_tail_rays: 'Ray stiffness: big tails held open, or soft ones that fold and drag.',
  gp_dorsal_length: 'Male dorsal fin length.',
  gp_dorsal_shape: 'Dorsal fin shape, from short and rounded to a long flag.',
  gp_dumbo: 'Two dumbo copies grow huge pectoral fins ("ears") on both sexes (recessive).',
  gp_ribbon: 'Incompletely dominant. One copy elongates the gonopodium and pelvic fins into ribbons, and a ribbon male cannot sire; two copies make longer ribbons. Ribbon lines are carried through females.',
  gp_swallow: 'Two swallow copies extend the dorsal and pelvic fin rays into long streamers (recessive).',
  gp_pelvic: 'Pelvic fin length; swallow and ribbon fins lengthen them further.',
  gp_blond: 'Two blond copies shrink each dark pigment cell: a light body with fine dark dots (recessive).',
  gp_golden: 'Two golden copies thin the dark cells into a gold, reticulated body (recessive).',
  gp_albino: 'Two albino copies remove all dark pigment and turn the eyes red (recessive).',
  gp_blue: 'Two blue copies remove red and yellow pigment, leaving blue and black (recessive).',
  gp_melanophore: 'Dark pigment cell density on the body.',
  gp_xanthophore: 'Yellow and orange pigment cells.',
  gp_asian_blau: 'Dominant: one copy turns the iridescence a strong blue and suppresses most red, the Japan blue look.',
  gp_metal_head: 'Dominant: one copy covers the head and front body in metallic iridophores.',
  gp_sheen: 'How much the body shines with iridophores.',
  gp_iri_hue: 'Iridescent color: turquoise, green, blue or violet.',
  gp_iri_depth: 'How deep the iridescent layer reaches over the flank.',
  gp_magenta: 'A pink-violet overlay on the tail and body.',
  gp_red_depth: 'How deep the red is, from orange to blood red.',
  gp_red_spread: 'How much of a male\'s tail and body the red covers. Full spread gives full red.',
  gp_orange_spots: 'Number of orange body spots on males. Females prefer males with more orange.',
  gp_yellow_shift: 'Shifts red toward orange and yellow.',
  gp_diet_response: 'How much orange depends on food: a well-fed male shows his full orange.',
  gp_fin_red: 'Red in the dorsal fin.',
  gp_tail_pattern: 'Male tail pattern: mosaic (bold reticulation), grass (fine dots), lace, leopard or tiger bars. Plain is recessive to every pattern; two different patterns blend.',
  gp_pattern_scale: 'Size of each pattern mark.',
  gp_pattern_coverage: 'How much of the tail the pattern covers.',
  gp_pattern_edge: 'Crisp versus soft pattern marks.',
  gp_tail_border: 'A dark or light border along the tail edge.',
  gp_pattern_symmetry: 'How evenly the pattern is laid out.',
  gp_half_black: 'Dominant: one copy blackens the rear half of the body, the tuxedo look.',
  gp_spot_count: 'Number of black body spots on males.',
  gp_spot_size: 'Size of black spots.',
  gp_black_edging: 'Dark outline on scales and fins.',
  gp_spot_symmetry: 'Whether spots mirror between flanks.',
  gp_dorsal_pattern: 'Dots and marbling in the dorsal fin.',
  gp_growth_rate: 'How fast fry grow toward adult size.',
  gp_longevity: 'Lifespan potential, about 2 to 4 game years.',
  gp_metabolism: 'Food and oxygen use.',
  gp_maturity_timing: 'How many days after birth a guppy may court.',
  gp_brood_size: 'How many fry a female carries per brood.',
  gp_gestation: 'Days from mating to birth. Guppies are livebearers: fry are born free-swimming.',
  gp_activity: 'Time spent moving rather than hovering.',
  gp_boldness: 'Willingness to reach food first.',
  gp_shoaling: 'Tendency to swim with other guppies.',
  gp_display: 'How often and how hard a male performs his sigmoid courtship display.',
  gp_choosiness: 'How choosy a female is. Choosy females court slowly unless a male is bright orange and displays hard.',
  gp_foraging: 'Picking drive; decides how much contested food a guppy wins.',
  gp_canalization: 'Developmental stability. Low levels add noise and asymmetry.',
  gp_vigor: 'Overdominant: two different copies give a vigor bonus to growth and fertility.',
  gp_fertility: 'Brood readiness and size.',
  gp_color_onset: 'When a young male colors up. Before then, males look like females.',
  gp_female_leak: 'How much of her hidden color program a female shows, as a faint tint on her tail.',
  gp_temp_tolerance: 'Comfort range; guppies prefer warm water.',
  gp_pseudo_sheen: 'Near the free end of the sex chromosome: X and Y exchange it freely in both sexes.',
  gp_red_tail: 'Red tail color on the sex chromosome. It recombines in males, so it is only loosely sex-linked.',
  gp_snakeskin: 'Dominant snakeskin (Ssb) on the sex chromosome: a chain pattern on body and tail. It can sit on the X or the Y.',
  gp_double_sword: 'Dominant double sword, close to the sex-determining region: it mostly travels from father to son.',
  gp_y_program: 'Y-linked color program, right beside the sex-determining region: maculatus (black dorsal spot), Moscow (dark metallic body), armatus (black bar) or pingu (red front). In a male it passes to every son and no daughter, unless a rare crossover moves it onto his X.',
  gp_sex: 'Sex-determining region. A Y copy makes a male; a male always has his Y on the copy from his father. It never mutates.',
};

export const GUPPY_EXPRESSION_NOTES: Record<GuppyExpressionKind, string> = {
  quantitative: 'Quantitative: the two copies combine by their dominance, from very low to extreme.',
  categorical: 'Categorical: each allele is a named state; the note above says how two copies combine.',
  recessive: 'Recessive: only two variant copies change the fish. One variant copy is a hidden carrier.',
  dominant: 'Dominant: one variant copy is enough; two make the trait stronger.',
  incomplete: 'Incompletely dominant: each variant copy changes the fish one step further.',
  sex: 'Sex-determining: XX is female, XY is male. Males pass the Y to every son.',
};
