/**
 * Standalone synthetic goldfish genome catalog (goldfish genome v1, world v17).
 *
 * Goldfish arrive Genesis-native: every goldfish genome has 72 loci on 12 synthetic chromosomes plus a development block
 * (development seed, genetic load, open-ended alleles). Nothing here reuses koi or axolotl loci, allele IDs or streams.
 *
 * Several loci are anchored to real domestication genetics, simplified for a game (see docs/research/FS-130-GOLDFISH.md):
 * - `gf_twin_tail` follows the chordin A stop mutation (chdA E127X): recessive, two copies split the caudal fin.
 * - `gf_eye_program` follows the lrp2 allelic series: independent loss-of-function alleles give telescope or celestial
 *   eyes, and because they hit the same gene they fail to complement each other.
 * - `gf_transparency` follows the transparent-scale T locus: incompletely dominant, tt metallic, Tt nacreous, TT matte.
 * - `gf_longfin` follows the dominant long-fin variant associated with kcnk5b.
 * - Dorsal-fin loss is polygenic with a parent-of-origin effect, as reciprocal crosses of egg and wen fish suggest.
 * Everything else (hood growth, pearl scales, color break, patterns) is a game model inspired by breeders' observations.
 */

export const GOLDFISH_GENOME_VERSION = 1 as const;
export type GoldfishGenomeVersion = typeof GOLDFISH_GENOME_VERSION;
export const GOLDFISH_ALLELE_COUNT = 6;
export const GOLDFISH_DEFAULT_MUTATION_RATE = 0.0015;

export const GOLDFISH_LOCI = [
  'gf_body_length', 'gf_body_depth', 'gf_roundness', 'gf_back_arch', 'gf_peduncle', 'gf_adult_size',
  'gf_head_width', 'gf_snout', 'gf_mouth', 'gf_hood_a', 'gf_hood_b', 'gf_hood_extent',
  'gf_eye_size', 'gf_eye_program', 'gf_eye_protrusion', 'gf_bubble_program', 'gf_bubble_size', 'gf_iris',
  'gf_longfin', 'gf_fin_length', 'gf_dorsal_loss_a', 'gf_dorsal_loss_b', 'gf_dorsal_height', 'gf_fin_edge',
  'gf_twin_tail', 'gf_tail_split', 'gf_tail_spread', 'gf_tail_fork', 'gf_tail_carriage', 'gf_paired_anal',
  'gf_transparency', 'gf_pearlscale', 'gf_scale_size', 'gf_reflectivity', 'gf_reticulation', 'gf_sparkle',
  'gf_melanophore', 'gf_xanthophore', 'gf_red_depth', 'gf_albino', 'gf_blue', 'gf_chocolate',
  'gf_color_break', 'gf_break_completeness', 'gf_white_spread', 'gf_black_persistence', 'gf_lavender', 'gf_yellow_shift',
  'gf_pattern_mode', 'gf_patch_scale', 'gf_patch_coverage', 'gf_patch_edge', 'gf_patch_symmetry', 'gf_fin_color',
  'gf_pompon', 'gf_pompon_size', 'gf_gill_curl', 'gf_crown_tint', 'gf_nacre_blue', 'gf_fin_rays',
  'gf_growth_rate', 'gf_longevity', 'gf_metabolism', 'gf_fertility', 'gf_maturity_timing', 'gf_swim_bladder',
  'gf_activity', 'gf_boldness', 'gf_sociability', 'gf_foraging', 'gf_canalization', 'gf_vigor',
] as const;

export type GoldfishLocus = typeof GOLDFISH_LOCI[number];
/**
 * How a locus' two copies combine. Quantitative loci use Genesis dominance; the others have their own rule:
 * recessive (two variant copies), dominant (one variant copy), incomplete (each variant copy adds a step) or categorical.
 */
export type GoldfishExpressionKind = 'quantitative' | 'categorical' | 'recessive' | 'dominant' | 'incomplete';

export type GoldfishMutationTarget = { allele: number; weight: number };
export type GoldfishAlleleDefinition = {
  id: string; label: string;
  /** Quantitative loci use −1…1; switch loci use 0 (wild) to 1 (full variant). */
  effect: number;
  founderWeight: number;
  mutationTargets: readonly GoldfishMutationTarget[];
};
export type GoldfishLocusDefinition = {
  id: GoldfishLocus; label: string; chromosomeId: string; chromosomeLabel: string; positionCm: number;
  expression: GoldfishExpressionKind; mutationMultiplier: number; alleles: readonly GoldfishAlleleDefinition[];
};
export type GoldfishChromosomeDefinition = { id: string; label: string; loci: readonly GoldfishLocus[] };

type Weights = readonly [number, number, number, number, number, number];
const BALANCED: Weights = [0.04, 0.15, 0.31, 0.31, 0.15, 0.04];
const CONSERVATIVE: Weights = [0.015, 0.10, 0.385, 0.385, 0.10, 0.015];
const RARE_HIGH: Weights = [0.24, 0.28, 0.25, 0.15, 0.065, 0.015];
/** Domestic stock: fancy traits are common enough in founders that a few clutches reveal them. */
const FANCY_HIGH: Weights = [0.12, 0.2, 0.24, 0.2, 0.15, 0.09];

const Q_EFFECTS = [-1, -0.6, -0.2, 0.2, 0.6, 1] as const;
const Q_LABELS = ['very low', 'low', 'subtle', 'moderate', 'high', 'extreme'] as const;
const POSITIONS = [0, 9, 19, 31, 44, 60] as const;
/** Allele index from which a switch locus' allele is a variant (loss-of-function or gain) copy. */
export const GOLDFISH_VARIANT_FROM = 4;
/** The eye program's variant alleles start one step earlier: two telescope alleles and one celestial allele. */
export const EYE_VARIANT_FROM = 3;

const mutationTargets = (index: number): readonly GoldfishMutationTarget[] => {
  if (index === 0) return [{ allele: 1, weight: 1 }];
  if (index === GOLDFISH_ALLELE_COUNT - 1) return [{ allele: GOLDFISH_ALLELE_COUNT - 2, weight: 1 }];
  return [{ allele: index - 1, weight: 0.5 }, { allele: index + 1, weight: 0.5 }];
};
const quantitative = (weights: Weights): readonly GoldfishAlleleDefinition[] =>
  Q_EFFECTS.map((effect, index) => ({ id: `Q${index}`, label: Q_LABELS[index], effect, founderWeight: weights[index], mutationTargets: mutationTargets(index) }));
const named = (labels: readonly [string, string, string, string, string, string], effects: readonly [number, number, number, number, number, number], weights: Weights, targets = mutationTargets): readonly GoldfishAlleleDefinition[] =>
  labels.map((label, index) => ({ id: `G${index}`, label, effect: effects[index], founderWeight: weights[index], mutationTargets: targets(index) }));
/** A loss-of-function variant mostly arises from the wild allele next to it, and reverts rarely. */
const switchTargets = (index: number): readonly GoldfishMutationTarget[] =>
  index < 3 ? mutationTargets(index) : index === 3 ? [{ allele: 2, weight: 0.4 }, { allele: 4, weight: 0.6 }] : mutationTargets(index);
const SWITCH_EFFECTS = [0, 0, 0.05, 0.15, 1, 1] as const;

const chromosome = (id: string, label: string, loci: readonly GoldfishLocus[]): GoldfishChromosomeDefinition => ({ id, label, loci });
export const GOLDFISH_CHROMOSOMES = [
  chromosome('GF-BODY', 'Body plan', GOLDFISH_LOCI.slice(0, 6)),
  chromosome('GF-HEAD', 'Head and hood', GOLDFISH_LOCI.slice(6, 12)),
  chromosome('GF-EYE', 'Eyes', GOLDFISH_LOCI.slice(12, 18)),
  chromosome('GF-FIN', 'Fins', GOLDFISH_LOCI.slice(18, 24)),
  chromosome('GF-TAIL', 'Caudal fin', GOLDFISH_LOCI.slice(24, 30)),
  chromosome('GF-SCALE', 'Scales', GOLDFISH_LOCI.slice(30, 36)),
  chromosome('GF-PIG', 'Pigment cells', GOLDFISH_LOCI.slice(36, 42)),
  chromosome('GF-CHANGE', 'Color change', GOLDFISH_LOCI.slice(42, 48)),
  chromosome('GF-PATTERN', 'Pattern', GOLDFISH_LOCI.slice(48, 54)),
  chromosome('GF-ORN', 'Ornaments', GOLDFISH_LOCI.slice(54, 60)),
  chromosome('GF-LIFE', 'Life history', GOLDFISH_LOCI.slice(60, 66)),
  chromosome('GF-BEH', 'Behavior and development', GOLDFISH_LOCI.slice(66, 72)),
] as const satisfies readonly GoldfishChromosomeDefinition[];

const LABELS: Record<GoldfishLocus, string> = {
  gf_body_length: 'Body length', gf_body_depth: 'Body depth', gf_roundness: 'Egg roundness', gf_back_arch: 'Back arch', gf_peduncle: 'Peduncle thickness', gf_adult_size: 'Adult size',
  gf_head_width: 'Head width', gf_snout: 'Snout length', gf_mouth: 'Mouth size', gf_hood_a: 'Hood growth A', gf_hood_b: 'Hood growth B', gf_hood_extent: 'Hood extent',
  gf_eye_size: 'Eye size', gf_eye_program: 'Eye program (lrp2)', gf_eye_protrusion: 'Eye protrusion', gf_bubble_program: 'Bubble sac program', gf_bubble_size: 'Bubble sac size', gf_iris: 'Iris',
  gf_longfin: 'Long fin (kcnk)', gf_fin_length: 'Fin length', gf_dorsal_loss_a: 'Dorsal loss A', gf_dorsal_loss_b: 'Dorsal loss B', gf_dorsal_height: 'Dorsal height', gf_fin_edge: 'Fin edge',
  gf_twin_tail: 'Twin tail (chdA)', gf_tail_split: 'Tail split', gf_tail_spread: 'Tail spread', gf_tail_fork: 'Tail fork', gf_tail_carriage: 'Tail carriage', gf_paired_anal: 'Paired anal fin',
  gf_transparency: 'Scale transparency (T)', gf_pearlscale: 'Pearl scale', gf_scale_size: 'Scale size', gf_reflectivity: 'Reflectivity', gf_reticulation: 'Scale outline', gf_sparkle: 'Sparkle scales',
  gf_melanophore: 'Melanophores', gf_xanthophore: 'Xanthophores', gf_red_depth: 'Red depth', gf_albino: 'Albinism', gf_blue: 'Blue', gf_chocolate: 'Chocolate',
  gf_color_break: 'Color break', gf_break_completeness: 'Break completeness', gf_white_spread: 'White spread', gf_black_persistence: 'Black persistence', gf_lavender: 'Lavender dilution', gf_yellow_shift: 'Yellow shift',
  gf_pattern_mode: 'Pattern', gf_patch_scale: 'Patch size', gf_patch_coverage: 'Patch coverage', gf_patch_edge: 'Patch edge', gf_patch_symmetry: 'Patch symmetry', gf_fin_color: 'Fin color',
  gf_pompon: 'Pompon (narial)', gf_pompon_size: 'Pompon size', gf_gill_curl: 'Gill curl', gf_crown_tint: 'Crown tint', gf_nacre_blue: 'Nacreous blue', gf_fin_rays: 'Fin ray stiffness',
  gf_growth_rate: 'Growth rate', gf_longevity: 'Longevity', gf_metabolism: 'Metabolism', gf_fertility: 'Fertility', gf_maturity_timing: 'Maturity timing', gf_swim_bladder: 'Swim bladder',
  gf_activity: 'Activity', gf_boldness: 'Boldness', gf_sociability: 'Sociability', gf_foraging: 'Foraging', gf_canalization: 'Canalization', gf_vigor: 'Vigor',
};

const SPECIAL: Partial<Record<GoldfishLocus, { expression: GoldfishExpressionKind; alleles: readonly GoldfishAlleleDefinition[] }>> = {
  gf_eye_program: { expression: 'recessive', alleles: named(
    ['wild', 'wild (b)', 'wild (modifier)', 'telescope dm-1', 'telescope dm-2', 'celestial ce'], [0, 0, 0.05, 1, 1, 1], [0.76, 0.07, 0.035, 0.06, 0.045, 0.03],
    index => index === 2 ? [{ allele: 3, weight: 0.4 }, { allele: 4, weight: 0.3 }, { allele: 5, weight: 0.3 }] : index >= 3 ? [{ allele: 2, weight: 1 }] : mutationTargets(index)) },
  gf_bubble_program: { expression: 'recessive', alleles: named(['wild', 'wild (b)', 'wild (c)', 'reduced sac', 'bubble', 'bubble (full)'], SWITCH_EFFECTS, [0.82, 0.07, 0.04, 0.03, 0.03, 0.01], switchTargets) },
  gf_iris: { expression: 'categorical', alleles: named(['black', 'gold ring', 'silver', 'copper', 'dark blue', 'pearl'], [0, 0.2, 0.4, 0.6, 0.8, 1], [0.42, 0.22, 0.14, 0.1, 0.07, 0.05]) },
  gf_longfin: { expression: 'dominant', alleles: named(['standard', 'standard (b)', 'standard (c)', 'standard (d)', 'long', 'long (strong)'], [0, 0, 0, 0, 1, 1], [0.48, 0.2, 0.1, 0.06, 0.12, 0.04], switchTargets) },
  gf_twin_tail: { expression: 'recessive', alleles: named(['chdA wild', 'chdA wild (b)', 'chdA wild (c)', 'chdA wild (d)', 'chdA E127X', 'chdA E127X (b)'], SWITCH_EFFECTS, [0.36, 0.14, 0.07, 0.05, 0.28, 0.1], switchTargets) },
  gf_transparency: { expression: 'incomplete', alleles: named(['metallic t', 'metallic t (b)', 'metallic t (c)', 'metallic t (dull)', 'transparent T', 'transparent T (strong)'], [0, 0, 0, 0.1, 1, 1], [0.5, 0.2, 0.08, 0.05, 0.13, 0.04], switchTargets) },
  gf_albino: { expression: 'recessive', alleles: named(['wild', 'wild (b)', 'wild (c)', 'reduced melanin', 'albino', 'albino (full)'], SWITCH_EFFECTS, [0.86, 0.05, 0.03, 0.025, 0.025, 0.01], switchTargets) },
  gf_blue: { expression: 'recessive', alleles: named(['wild', 'wild (b)', 'wild (c)', 'steel modifier', 'blue', 'blue (deep)'], SWITCH_EFFECTS, [0.82, 0.06, 0.04, 0.03, 0.04, 0.01], switchTargets) },
  gf_chocolate: { expression: 'recessive', alleles: named(['wild', 'wild (b)', 'wild (c)', 'brown modifier', 'chocolate', 'chocolate (deep)'], SWITCH_EFFECTS, [0.83, 0.06, 0.04, 0.025, 0.035, 0.01], switchTargets) },
  gf_pattern_mode: { expression: 'categorical', alleles: named(['solid', 'sarasa', 'redcap', 'panda', 'calico', 'tri-color'], [0, 1, 2, 3, 4, 5], [0.6, 0.13, 0.07, 0.06, 0.1, 0.04]) },
  gf_pompon: { expression: 'dominant', alleles: named(['plain', 'plain (b)', 'plain (c)', 'plain (d)', 'pompon', 'pompon (large)'], [0, 0, 0, 0, 1, 1], [0.63, 0.19, 0.1, 0.064, 0.012, 0.004], switchTargets) },
  gf_gill_curl: { expression: 'recessive', alleles: named(['flat', 'flat (b)', 'flat (c)', 'flat (d)', 'curled', 'curled (strong)'], SWITCH_EFFECTS, [0.86, 0.06, 0.03, 0.02, 0.025, 0.005], switchTargets) },
};
const CONSERVATIVE_LOCI = new Set<GoldfishLocus>(['gf_peduncle', 'gf_snout', 'gf_mouth', 'gf_patch_symmetry', 'gf_metabolism', 'gf_maturity_timing', 'gf_sociability', 'gf_canalization']);
const RARE_LOCI = new Set<GoldfishLocus>(['gf_sparkle', 'gf_lavender', 'gf_crown_tint', 'gf_nacre_blue', 'gf_pompon_size', 'gf_black_persistence', 'gf_hood_a', 'gf_hood_b', 'gf_pearlscale']);
const FANCY_LOCI = new Set<GoldfishLocus>(['gf_roundness', 'gf_body_depth', 'gf_back_arch', 'gf_dorsal_loss_a', 'gf_dorsal_loss_b', 'gf_tail_spread', 'gf_fin_length']);

const definitions: GoldfishLocusDefinition[] = [];
for (const chr of GOLDFISH_CHROMOSOMES) {
  chr.loci.forEach((id, offset) => {
    const special = SPECIAL[id], expression = special?.expression ?? 'quantitative';
    definitions.push({
      id, label: LABELS[id], chromosomeId: chr.id, chromosomeLabel: chr.label, positionCm: POSITIONS[offset], expression,
      mutationMultiplier: expression === 'quantitative' ? 1 : expression === 'categorical' ? 0.75 : 0.55,
      alleles: special?.alleles ?? quantitative(FANCY_LOCI.has(id) ? FANCY_HIGH : RARE_LOCI.has(id) ? RARE_HIGH : CONSERVATIVE_LOCI.has(id) ? CONSERVATIVE : BALANCED),
    });
  });
}

/** Stable goldfish registry order. Never reorder within goldfish genome v1. */
export const GOLDFISH_LOCUS_REGISTRY = definitions as readonly GoldfishLocusDefinition[];
export const GOLDFISH_LOCI_COUNT = GOLDFISH_LOCUS_REGISTRY.length;
export const GOLDFISH_LOCUS_INDEX = Object.fromEntries(GOLDFISH_LOCUS_REGISTRY.map((entry, index) => [entry.id, index])) as Record<GoldfishLocus, number>;
export const goldfishLocusDefinition = (id: GoldfishLocus): GoldfishLocusDefinition => GOLDFISH_LOCUS_REGISTRY[GOLDFISH_LOCUS_INDEX[id]];
export const goldfishLabelAt = (index: number) => GOLDFISH_LOCUS_REGISTRY[index]?.label ?? `Locus ${index}`;
export const goldfishAlleleLabelAt = (index: number, allele: number) => allele >= 1000 ? 'new allele' : GOLDFISH_LOCUS_REGISTRY[index]?.alleles[allele]?.label ?? `G${allele}`;
/** Loci where a carrier hides a variant copy, with the name of the trait two copies show. */
export const GOLDFISH_RECESSIVES = {
  gf_twin_tail: 'twin tail', gf_eye_program: 'telescope or celestial eyes', gf_bubble_program: 'bubble eyes', gf_albino: 'albino',
  gf_blue: 'blue', gf_chocolate: 'chocolate', gf_gill_curl: 'curled gills',
} as const satisfies Partial<Record<GoldfishLocus, string>>;
export type GoldfishRecessive = keyof typeof GOLDFISH_RECESSIVES;

/**
 * Hover notes for the genome view. Text only: expression, inheritance and saves never read it. Each note says what the
 * locus does in this game, and where it borrows from real goldfish genetics.
 */
export const GOLDFISH_LOCUS_NOTES: Record<GoldfishLocus, string> = {
  gf_body_length: 'Long, slim bodies (commons, comets) to short ones; also 40% of adult length potential.',
  gf_body_depth: 'Body height relative to length. Deep bodies swim slower and risk buoyancy trouble.',
  gf_roundness: 'The egg shape of fancy goldfish. Very round bodies with a weak swim bladder float head-down.',
  gf_back_arch: 'The ryukin hump behind the head; without a dorsal fin it gives the ranchu back curve.',
  gf_peduncle: 'Thickness of the tail root. Thick peduncles carry big tails without drooping.',
  gf_adult_size: 'Major size locus: 60% of adult length potential, about 9 to 33 cm.',
  gf_head_width: 'Head width; broad heads frame a hood well.',
  gf_snout: 'Snout length, from blunt to pointed.',
  gf_mouth: 'Mouth size.',
  gf_hood_a: 'One of two hood (wen) growth loci. Higher alleles dominate. A hood grows when both loci together pass a threshold.',
  gf_hood_b: 'Second hood growth locus. Hoods keep growing as the fish matures; huge hoods can cover the eyes.',
  gf_hood_extent: 'Where the hood grows: a crown on top (oranda), over the cheeks, or the whole face (lionhead).',
  gf_eye_size: 'Eye diameter.',
  gf_eye_program: 'Modelled on lrp2. Two loss-of-function copies make protruding eyes: telescope, or celestial eyes that gaze upward when both copies are celestial. Telescope and celestial alleles hit the same gene, so they do not complement: one of each gives a skygazer. One copy is a hidden carrier.',
  gf_eye_protrusion: 'How far telescope eyes stand out.',
  gf_bubble_program: 'Two bubble copies grow fluid-filled sacs under the eyes (recessive). Bubble sacs cost food competition.',
  gf_bubble_size: 'Size of bubble sacs when present.',
  gf_iris: 'Iris color. Two different copies blend; albino fish always have pink eyes.',
  gf_longfin: 'Modelled on the kcnk5b long-fin variant: one long copy lengthens every fin (dominant), two give flowing veil-length fins. Long fins swim slower.',
  gf_fin_length: 'Fin length modifier on top of the long-fin program.',
  gf_dorsal_loss_a: 'One of two dorsal-loss loci (loss alleles recessive). The mother\'s copy counts more than the father\'s, so reciprocal crosses differ.',
  gf_dorsal_loss_b: 'Second dorsal-loss locus. When liability passes a threshold the dorsal fin is absent; just below, a remnant spike.',
  gf_dorsal_height: 'Height of the dorsal fin when present.',
  gf_fin_edge: 'Fin margins, from smooth to ruffled and fringed.',
  gf_twin_tail: 'Modelled on chordin A E127X: two copies split the caudal fin into a twin tail (recessive) and usually pair the anal fin. One copy is hidden.',
  gf_tail_split: 'How completely a twin tail divides: tri-tail (upper lobes joined), twin, or four-lobed.',
  gf_tail_spread: 'How widely the tail lobes open. Twin tails with a wide spread are butterfly tails.',
  gf_tail_fork: 'Deep fork versus a square, veil-like trailing edge.',
  gf_tail_carriage: 'Tail angle: drooping (ranchu style) to held level and flared.',
  gf_paired_anal: 'Whether a twin-tailed fish also has a paired anal fin.',
  gf_transparency: 'Modelled on the transparent-scale T locus, incompletely dominant: no T copy is metallic, one is nacreous (mixed shiny and see-through scales, the calico ground), two are matte.',
  gf_pearlscale: 'Domed, pearl-like scales; higher alleles dominate. Strong expression gives full pearlscale.',
  gf_scale_size: 'Scale size on the body.',
  gf_reflectivity: 'Guanine shine of metallic scales.',
  gf_reticulation: 'Dark outline on each scale, a net pattern.',
  gf_sparkle: 'Scattered single reflective scales on nacreous and matte fish.',
  gf_melanophore: 'Dark pigment cells: the wild bronze base, and what is left after color change.',
  gf_xanthophore: 'Orange and yellow pigment cells.',
  gf_red_depth: 'How deep the red is, from orange to blood red.',
  gf_albino: 'Two albino copies remove all dark pigment and turn the eyes pink (recessive).',
  gf_blue: 'Two blue copies turn dark pigment slate blue (recessive).',
  gf_chocolate: 'Two chocolate copies turn dark pigment brown (recessive).',
  gf_color_break: 'Goldfish hatch bronze and later lose their dark pigment. Higher alleles break earlier and dominate; the lowest never break and stay wild bronze.',
  gf_break_completeness: 'How much dark pigment the break removes: a clean red fish, or red and black.',
  gf_white_spread: 'How much orange the break also removes, leaving white.',
  gf_black_persistence: 'Black that survives the break, the black moor and panda look.',
  gf_lavender: 'Dilutes dark pigment toward lavender grey.',
  gf_yellow_shift: 'Shifts orange toward lemon yellow.',
  gf_pattern_mode: 'Pattern: sarasa red and white patches, a red cap, panda, calico or tri-color. Solid yields to sarasa and calico, but hides redcap, panda and tri-color, which need two copies. Two different patterns both show. Calico needs nacreous or matte scales to show its blue ground.',
  gf_patch_scale: 'Size of each pattern patch.',
  gf_patch_coverage: 'How much of the body the pattern covers.',
  gf_patch_edge: 'Crisp versus soft patch edges.',
  gf_patch_symmetry: 'How closely the flanks mirror each other.',
  gf_fin_color: 'Fin color, from clear to matching the body or tipped with red.',
  gf_pompon: 'Narial bouquets: one pompon copy grows fleshy pompons at the nostrils (dominant).',
  gf_pompon_size: 'Size of pompons when present.',
  gf_gill_curl: 'Two curled copies turn the gill covers outward (recessive). Curled gills cost oxygen.',
  gf_crown_tint: 'How strongly a hood takes its own red, as in redcap fish.',
  gf_nacre_blue: 'Intensity of the blue ground under nacreous and matte scales.',
  gf_fin_rays: 'Fin ray stiffness: upright, well-held fins or soft, drooping ones.',
  gf_growth_rate: 'How fast the fish approaches its adult size. Fin regrowth follows it.',
  gf_longevity: 'Lifespan potential, about 10 to 30 game years.',
  gf_metabolism: 'Food and oxygen use.',
  gf_fertility: 'Clutch size and courtship readiness. Goldfish are prolific.',
  gf_maturity_timing: 'How many days after hatching a goldfish may court.',
  gf_swim_bladder: 'Swim bladder robustness. Weak bladders in round bodies give buoyancy trouble: tilted swimming and a lower condition ceiling.',
  gf_activity: 'Time spent moving rather than hovering.',
  gf_boldness: 'Willingness to leave cover and reach food first.',
  gf_sociability: 'Tendency to shoal with other goldfish.',
  gf_foraging: 'Substrate rooting drive; decides how much contested food a goldfish wins.',
  gf_canalization: 'Developmental stability. Low levels add noise and asymmetry and let defects show more.',
  gf_vigor: 'Overdominant: two different copies give a vigor bonus to growth and fertility.',
};

export const GOLDFISH_EXPRESSION_NOTES: Record<GoldfishExpressionKind, string> = {
  quantitative: 'Quantitative: the two copies combine by their dominance, from very low to extreme.',
  categorical: 'Categorical: each allele is a named state; the note above says how two copies combine.',
  recessive: 'Recessive: only two variant copies change the fish. One variant copy is a hidden carrier.',
  dominant: 'Dominant: one variant copy is enough; two make the trait stronger.',
  incomplete: 'Incompletely dominant: each variant copy changes the fish one step further.',
};
