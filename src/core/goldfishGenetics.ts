import {
  EYE_VARIANT_FROM, GOLDFISH_CHROMOSOMES, GOLDFISH_DEFAULT_MUTATION_RATE, GOLDFISH_GENOME_VERSION, GOLDFISH_LOCI, GOLDFISH_LOCUS_INDEX,
  GOLDFISH_LOCUS_REGISTRY, GOLDFISH_RECESSIVES, GOLDFISH_VARIANT_FROM, goldfishLocusDefinition,
  type GoldfishAlleleDefinition, type GoldfishLocus, type GoldfishLocusDefinition, type GoldfishRecessive,
} from './goldfishCatalog';
import {
  carriedNovel, channelEffects, combine, createNovel, defectsFor, developmentNoise, founderLoadPair, founderPotency, genesisProblem, GOLDFISH_LOAD,
  GOLDFISH_SCALE, isNovel, NOVEL_SHARE, novelId, novelMap, transmitLoad, vigorFor,
  type Channel, type DominanceClass, type GenesisTraits, type GenesisBlock, type NovelAllele, type Resolved,
} from './genesis';
import { expressModules, moduleAlleleCounts, somaticFor } from './modules';
import { clamp, hash, random } from './random';

/**
 * Goldfish genome v1 (world v17): Genesis-native from the start, so every goldfish carries a development block. The
 * phased homologs index the goldfish catalog; open-ended alleles (IDs ≥ 1000) are defined in the development block.
 */
export type GoldfishGenome = { species: 'goldfish'; version: 1; maternal: number[]; paternal: number[]; genesis: GenesisBlock };
export type GoldfishMutation = { locus: number; copy: 'maternal' | 'paternal'; from: number; to: number };
export type GoldfishInheritanceTrace = { maternal: (0 | 1)[]; paternal: (0 | 1)[] };
export type GoldfishColor = { h: number; s: number; l: number };

export type GoldfishTail = 'single' | 'tri' | 'twin' | 'quad';
export type GoldfishEyes = 'normal' | 'telescope' | 'celestial' | 'skygazer';
export type GoldfishDorsal = 'full' | 'remnant' | 'absent';
export type GoldfishHood = 'none' | 'crown' | 'cheeks' | 'full';
export type GoldfishScales = 'metallic' | 'nacreous' | 'matte';
export type GoldfishPattern = 'solid' | 'sarasa' | 'redcap' | 'panda' | 'calico' | 'tri-color';
export type GoldfishDilution = 'none' | 'blue' | 'chocolate' | 'lavender';
export type GoldfishVariety =
  | 'common' | 'comet' | 'shubunkin' | 'tamasaba' | 'wakin' | 'fantail' | 'ryukin' | 'veiltail' | 'tosakin'
  | 'oranda' | 'lionhead' | 'ranchu' | 'eggfish' | 'telescope' | 'butterfly' | 'black-moor'
  | 'celestial' | 'skygazer' | 'bubble-eye' | 'pearlscale' | 'crown-pearlscale' | 'pompon';

export type GoldfishPhenotype = {
  model: 1;
  adultLengthCm: number; growth: number; longevity: number; metabolism: number; oxygen: number; fertility: number;
  speed: number; turning: number; activity: number; social: number; bold: number; curious: number;
  variety: { id: GoldfishVariety; label: string; color: string; name: string; rarity: 0 | 1 | 2 | 3; standard: number };
  body: { length: number; depth: number; roundness: number; arch: number; peduncle: number; slim: boolean };
  head: { width: number; snout: number; mouth: number; hood: number; hoodKind: GoldfishHood; crownTint: number; pompon: number; gillCurl: boolean };
  eyes: { size: number; kind: GoldfishEyes; protrusion: number; bubble: number; iris: GoldfishColor };
  fins: { long: 0 | 1 | 2; length: number; dorsal: GoldfishDorsal; dorsalHeight: number; edge: number; rays: number; analPaired: boolean };
  tail: { kind: GoldfishTail; split: number; spread: number; fork: number; carriage: number; butterfly: boolean; veil: boolean };
  scales: { type: GoldfishScales; pearl: number; size: number; reflectivity: number; reticulation: number; sparkle: number };
  color: {
    /** False for wild-type fish that never lose their juvenile bronze. */
    broken: boolean;
    /** Days after hatching when the bronze juvenile color breaks to the adult color. */
    breakDay: number;
    body: GoldfishColor; bronze: GoldfishColor; dark: GoldfishColor; fin: GoldfishColor;
    /** Dark pigment left on the adult, 0–1. */
    darkAmount: number;
    /** Share of the body without orange pigment (white). */
    whiteShare: number;
    nacreBlue: number; finTint: number; albino: boolean; dilution: GoldfishDilution;
    /** Stage appearance only: how much of the bronze juvenile color still shows (1 before the break, 0 after). */
    bronzeShare?: number;
  };
  pattern: { modes: GoldfishPattern[]; coverage: number; scale: number; edge: number; symmetry: number; seed: number };
  /** Recessive traits carried as one hidden copy. */
  carriers: GoldfishRecessive[];
  health: { buoyancy: number; vision: number };
  life: { growthMultiplier: number; maturityDays: number; longevityYears: number; metabolism: number; fertility: number; oxygenDemand: number; regeneration: number };
  behavior: { activity: number; boldness: number; sociability: number; foraging: number; cruiseSpeed: number; turning: number };
  genesis: GenesisTraits;
};

export type GoldfishGenotypeDescriptor = {
  locus: GoldfishLocus; label: string; chromosome: string; positionCm: number; maternal: number; paternal: number;
  maternalAllele: string; paternalAllele: string; zygosity: 'homozygous' | 'heterozygous';
  carrierFor: string | null; expressed: boolean;
};
export type GoldfishPhenotypeDescriptor = { group: 'Variety' | 'Body' | 'Head and eyes' | 'Fins' | 'Scales and color' | 'Life' | 'Behavior'; trait: string; value: string; note?: string };

const weighted = (rng: () => number, weights: readonly number[]): number => {
  const draw = rng();
  let cumulative = 0;
  for (let i = 0; i < weights.length; i++) { cumulative += weights[i]; if (draw < cumulative || i === weights.length - 1) return i; }
  return weights.length - 1;
};
const founderCopy = (rng: () => number): number[] => GOLDFISH_LOCUS_REGISTRY.map(entry => weighted(rng, entry.alleles.map(allele => allele.founderWeight)));

/** One unrelated goldfish founder. The species-prefixed streams never touch koi or axolotl draws. */
export function goldfishFounderGenome(seed: number): GoldfishGenome {
  const maternal = founderCopy(random(hash(`goldfish:v1:founder:mother:${seed}`)));
  const paternal = founderCopy(random(hash(`goldfish:v1:founder:father:${seed}`)));
  const load = founderLoadPair(random(hash(`goldfish:v1:founder:load:${seed}`)), GOLDFISH_LOAD);
  return { species: 'goldfish', version: GOLDFISH_GENOME_VERSION, maternal, paternal, genesis: { dev: hash(`goldfish:v1:founder:devseed:${seed}`), load, novel: [] } };
}

const OVER = new Set<GoldfishLocus>(['gf_fertility', 'gf_longevity', 'gf_vigor']);
const DOWN = new Set<GoldfishLocus>(['gf_dorsal_loss_a', 'gf_dorsal_loss_b', 'gf_metabolism', 'gf_reticulation', 'gf_lavender']);
const UP = new Set<GoldfishLocus>([
  'gf_hood_a', 'gf_hood_b', 'gf_pearlscale', 'gf_adult_size', 'gf_growth_rate', 'gf_reflectivity', 'gf_xanthophore', 'gf_red_depth', 'gf_color_break',
  'gf_boldness', 'gf_activity', 'gf_foraging', 'gf_canalization', 'gf_swim_bladder', 'gf_break_completeness',
]);
/** Dominance class of each quantitative goldfish locus; switch and categorical loci keep their own rule. */
export function goldfishDominance(index: number): DominanceClass | null {
  const entry = GOLDFISH_LOCUS_REGISTRY[index];
  if (!entry || entry.expression !== 'quantitative') return null;
  return OVER.has(entry.id) ? 'over' : DOWN.has(entry.id) ? 'down' : UP.has(entry.id) ? 'up' : 'additive';
}
export const goldfishNovelEligible = (index: number) => goldfishDominance(index) !== null;
const OVER_BONUS = 0.12;

const crossoverProbability = (left: GoldfishLocusDefinition, right: GoldfishLocusDefinition) => clamp((right.positionCm - left.positionCm) / 100, 0, 0.45);
const mutateAllele = (rng: () => number, allele: GoldfishAlleleDefinition) =>
  allele.mutationTargets.length === 1 ? allele.mutationTargets[0].allele : allele.mutationTargets[weighted(rng, allele.mutationTargets.map(target => target.weight))].allele;

/**
 * Linked goldfish meiosis. Each chromosome starts from a fresh homolog choice and may cross over at later map positions.
 * Mutation follows the copied allele; at quantitative loci some mutations create open-ended alleles. Genetic load
 * travels with the homolog transmitted at its anchor locus.
 */
export function inheritGoldfish(mother: GoldfishGenome, father: GoldfishGenome, seed: number, mutationRate = GOLDFISH_DEFAULT_MUTATION_RATE, trace?: GoldfishInheritanceTrace): { genome: GoldfishGenome; mutations: GoldfishMutation[] } {
  validateGoldfishGenome(mother); validateGoldfishGenome(father);
  if (!Number.isFinite(mutationRate) || mutationRate < 0 || mutationRate > 1) throw new Error('Invalid goldfish mutation rate.');
  if (trace) { trace.maternal.length = 0; trace.paternal.length = 0; }
  const pool = new Map<number, NovelAllele>([...novelMap(mother.genesis), ...novelMap(father.genesis)]);
  const sides: Record<'maternal' | 'paternal', (0 | 1)[]> = { maternal: [], paternal: [] };
  const novelRng = random(hash(`goldfish:v1:novel-choice:${seed}`));
  const mutations: GoldfishMutation[] = [];
  const mutate = (rng: () => number, index: number, from: number, locus: GoldfishLocusDefinition, copy: 'maternal' | 'paternal'): number => {
    if (isNovel(from)) {
      const parent = pool.get(from)!;
      if (novelRng() < 0.25) return clamp(Math.round((parent.value + 1) * 2.5), 0, 5);
      const created = createNovel(novelRng, novelId(seed, `gf${copy}`, index), index, from, { value: parent.value, potency: parent.potency, novel: parent }, GOLDFISH_SCALE);
      pool.set(created.id, created);
      return created.id;
    }
    const to = mutateAllele(rng, locus.alleles[from]), dominance = goldfishDominance(index);
    if (dominance && novelRng() < NOVEL_SHARE) {
      const created = createNovel(novelRng, novelId(seed, `gf${copy}`, index), index, from, { value: locus.alleles[from].effect, potency: founderPotency(dominance, from), novel: null }, GOLDFISH_SCALE);
      pool.set(created.id, created);
      return created.id;
    }
    return to;
  };
  const transmit = (parent: GoldfishGenome, copy: 'maternal' | 'paternal', rng: () => number): number[] => {
    const gamete = Array<number>(GOLDFISH_LOCI.length);
    for (const chromosome of GOLDFISH_CHROMOSOMES) {
      let side: 0 | 1 = rng() < 0.5 ? 0 : 1;
      chromosome.loci.forEach((id, offset) => {
        const index = GOLDFISH_LOCUS_INDEX[id], locus = GOLDFISH_LOCUS_REGISTRY[index];
        if (offset > 0 && rng() < crossoverProbability(goldfishLocusDefinition(chromosome.loci[offset - 1]), locus)) side = side === 0 ? 1 : 0;
        trace?.[copy].push(side); sides[copy].push(side);
        const from = (side === 0 ? parent.maternal : parent.paternal)[index];
        const rate = mutationRate === GOLDFISH_DEFAULT_MUTATION_RATE ? clamp(mutationRate * locus.mutationMultiplier) : mutationRate;
        if (rng() >= rate) { gamete[index] = from; return; }
        const to = mutate(rng, index, from, locus, copy);
        gamete[index] = to;
        mutations.push({ locus: index, copy, from, to });
      });
    }
    return gamete;
  };
  const maternal = transmit(mother, 'maternal', random(hash(`goldfish:v1:birth:mother:${seed}`)));
  const paternal = transmit(father, 'paternal', random(hash(`goldfish:v1:birth:father:${seed}`)));
  const loadRng = random(hash(`goldfish:v1:load:${seed}`));
  const load = { maternal: transmitLoad(mother.genesis.load, sides.maternal, GOLDFISH_LOAD, loadRng), paternal: transmitLoad(father.genesis.load, sides.paternal, GOLDFISH_LOAD, loadRng) };
  return { genome: { species: 'goldfish', version: GOLDFISH_GENOME_VERSION, maternal, paternal, genesis: { dev: hash(`goldfish:v1:dev:${seed}`), load, novel: carriedNovel(maternal, paternal, pool) } }, mutations };
}

const resolvers = new WeakMap<GoldfishGenome, (index: number) => [Resolved, Resolved]>();
/** Each copy's value and potency at a locus, catalog or novel. */
export function goldfishPair(genome: GoldfishGenome): (index: number) => [Resolved, Resolved] {
  let resolver = resolvers.get(genome);
  if (resolver) return resolver;
  const pool = novelMap(genome.genesis);
  const one = (index: number, allele: number): Resolved => {
    const novel = isNovel(allele) ? pool.get(allele) ?? null : null;
    if (novel) return { value: novel.value, potency: novel.potency, novel };
    return { value: GOLDFISH_LOCUS_REGISTRY[index].alleles[allele]?.effect ?? 0, potency: founderPotency(goldfishDominance(index) ?? 'additive', allele), novel: null };
  };
  resolver = index => [one(index, genome.maternal[index]), one(index, genome.paternal[index])];
  resolvers.set(genome, resolver);
  return resolver;
}

const round = (value: number, digits = 4) => { const f = 10 ** digits; return Math.round(value * f) / f; };
const hsl = (h: number, s: number, l: number): GoldfishColor => ({ h: round(((h % 360) + 360) % 360, 2), s: round(clamp(s)), l: round(clamp(l)) });

const VARIETY_LABELS: Record<GoldfishVariety, string> = {
  common: 'Common', comet: 'Comet', shubunkin: 'Shubunkin', tamasaba: 'Tamasaba', wakin: 'Wakin', fantail: 'Fantail', ryukin: 'Ryukin', veiltail: 'Veiltail',
  tosakin: 'Tosakin', oranda: 'Oranda', lionhead: 'Lionhead', ranchu: 'Ranchu', eggfish: 'Egg fish', telescope: 'Telescope', butterfly: 'Butterfly telescope',
  'black-moor': 'Black moor', celestial: 'Celestial eye', skygazer: 'Skygazer', 'bubble-eye': 'Bubble eye', pearlscale: 'Pearlscale', 'crown-pearlscale': 'Crown pearlscale', pompon: 'Pompon',
};
export const GOLDFISH_VARIETY_LABELS = VARIETY_LABELS;
/** How unusual each variety is in mixed domestic stock: buyers, the shop and shows read it the same way. */
export const GOLDFISH_VARIETY_RARITY: Record<GoldfishVariety, 0 | 1 | 2 | 3> = {
  common: 0, comet: 0, wakin: 0, fantail: 0, shubunkin: 1, ryukin: 1, oranda: 1, telescope: 1, 'black-moor': 1, eggfish: 1, veiltail: 1, tamasaba: 2,
  lionhead: 2, ranchu: 2, pearlscale: 2, butterfly: 2, pompon: 2, celestial: 3, 'bubble-eye': 3, skygazer: 3, tosakin: 3, 'crown-pearlscale': 3,
};
const RARE_COLORS = new Set(['Albino', 'Blue', 'Chocolate', 'Lavender', 'Calico', 'Tri-color', 'Panda', 'Redcap']);

const phenotypes = new WeakMap<GoldfishGenome, GoldfishPhenotype>();
/** Deterministic adult genetic potential. Age, water and feeding never enter here; juvenile color comes from life state later. */
export function expressGoldfish(genome: GoldfishGenome): GoldfishPhenotype {
  const cached = phenotypes.get(genome);
  if (cached) return cached;
  validateGoldfishGenome(genome);
  const phenotype = genome.genesis.model === 2 ? developGoldfishV7(develop(genome), genome) : develop(genome);
  phenotypes.set(genome, phenotype);
  return phenotype;
}

/**
 * Goldfish development v7 (Genesis model 2): model 2 side-effect channels, one-off somatic marks and, from body-plan set 2,
 * module genes. Hoods, bubble eyes and lobed tails still come from their own loci; modules duplicate fins. A second dorsal
 * fin needs a full first dorsal (dorsal loss masks it, as it would in a ranchu), adds drag and slows cruising; a second
 * pectoral pair adds drag too but sharpens turning.
 */
function developGoldfishV7(developed: GoldfishPhenotype, genome: GoldfishGenome): GoldfishPhenotype {
  const block = genome.genesis, p: GoldfishPhenotype = structuredClone(developed), pair = goldfishPair(genome);
  const effects = channelEffects(Array.from({ length: GOLDFISH_LOCI.length }, (_, i) => pair(i)));
  const e = (channel: Channel) => effects[channel] ?? 0;
  p.body.depth *= clamp(1 + 0.4 * e('depth'), 0.7, 1.35);
  p.eyes.size *= clamp(1 + 0.6 * e('eye'), 0.6, 1.5);
  p.pattern.edge = clamp(p.pattern.edge + 0.35 * e('contrast'));
  p.longevity = p.life.longevityYears = Math.max(4, p.longevity + 8 * e('longevity'));
  const modules = expressModules('goldfish', block.modules!, block.dev, p.genesis.canalization);
  if (modules.secondDorsal && p.fins.dorsal !== 'full') modules.secondDorsal = 0;
  if (modules.secondDorsal) p.behavior.cruiseSpeed = round(p.behavior.cruiseSpeed * (1 - 0.05 * modules.secondDorsal), 6);
  if (modules.doublePectoral) {
    p.behavior.cruiseSpeed = round(p.behavior.cruiseSpeed * (1 - 0.03 * modules.doublePectoral), 6);
    p.behavior.turning = round(p.behavior.turning * (1 + 0.12 * modules.doublePectoral));
  }
  p.speed = p.behavior.cruiseSpeed; p.turning = p.behavior.turning;
  p.genesis = { ...p.genesis, modules, somatic: somaticFor(block.dev, p.genesis.canalization) };
  return p;
}

function develop(genome: GoldfishGenome): GoldfishPhenotype {
  const pair = goldfishPair(genome), at = (locus: GoldfishLocus) => GOLDFISH_LOCUS_INDEX[locus];
  const ids = (locus: GoldfishLocus): [number, number] => [genome.maternal[at(locus)], genome.paternal[at(locus)]];
  const q = (locus: GoldfishLocus) => { const [a, b] = pair(at(locus)); return clamp(combine(a, b, goldfishDominance(at(locus)) ?? 'additive', OVER_BONUS), -1.25, 1.25); };
  const u = (locus: GoldfishLocus) => clamp((q(locus) + 1) / 2, 0, 1.1);
  const copies = (locus: GoldfishLocus, from = GOLDFISH_VARIANT_FROM) => ids(locus).filter(allele => allele >= from).length;
  const effects = channelEffects(Array.from({ length: GOLDFISH_LOCI.length }, (_, i) => pair(i)));
  const e = (channel: keyof typeof effects) => effects[channel] ?? 0;
  const canalization = clamp(u('gf_canalization'));
  const noise = developmentNoise(genome.genesis.dev), amplitude = 0.012 + 0.085 * (1 - canalization), jitter = () => 1 + amplitude * noise();

  // ── Body plan ──
  const roundness = clamp(u('gf_roundness') * jitter()), depthUnit = clamp(u('gf_body_depth') * jitter());
  const body = {
    length: round(clamp(0.86 + 0.36 * u('gf_body_length') - 0.12 * roundness, 0.74, 1.24) * jitter()),
    depth: round(0.3 + 0.3 * depthUnit + 0.06 * roundness),
    roundness: round(roundness), arch: round(clamp(u('gf_back_arch') * jitter())), peduncle: round(clamp(u('gf_peduncle'))), slim: false,
  };
  body.slim = roundness < 0.42 && body.depth < 0.44;

  // ── Tail (chdA) and fins (kcnk long fin, polygenic dorsal loss) ──
  const twin = copies('gf_twin_tail'), split = clamp(u('gf_tail_split') + noise() * 0.08 * (1.2 - canalization));
  const tailKind: GoldfishTail = twin === 2 ? (split < 0.26 ? 'tri' : split > 0.86 ? 'quad' : 'twin') : twin === 1 && split > 0.97 ? 'tri' : 'single';
  const long = copies('gf_longfin') as 0 | 1 | 2;
  const spread = clamp(u('gf_tail_spread') * jitter()), fork = clamp(u('gf_tail_fork')), carriage = clamp(u('gf_tail_carriage'));
  const finLength = clamp((1 + 0.55 * long + 0.5 * (u('gf_fin_length') - 0.5)) * clamp(1 + e('fins') * 0.8, 0.5, 1.6) * jitter(), 0.6, 2.4);
  // Dorsal loss: the mother's copy weighs more than the father's (a parent-of-origin effect), and loss alleles are recessive.
  const weightedLoss = (locus: GoldfishLocus) => {
    const [m, p] = pair(at(locus)), wm = 0.6 * m.potency, wp = 0.4 * p.potency;
    return (m.value * wm + p.value * wp) / (wm + wp);
  };
  const liability = ((weightedLoss('gf_dorsal_loss_a') + 1) / 2 + (weightedLoss('gf_dorsal_loss_b') + 1) / 2) / 2 + noise() * (0.025 + 0.05 * (1 - canalization));
  const dorsal: GoldfishDorsal = liability > 0.7 ? 'absent' : liability > 0.61 ? 'remnant' : 'full';
  const fins: GoldfishPhenotype['fins'] = {
    long, length: round(finLength), dorsal, dorsalHeight: round(0.12 + 0.16 * u('gf_dorsal_height')), edge: round(clamp(u('gf_fin_edge'))),
    rays: round(clamp(u('gf_fin_rays'))), analPaired: tailKind !== 'single' && u('gf_paired_anal') > 0.3,
  };
  const tail: GoldfishPhenotype['tail'] = {
    kind: tailKind, split: round(split), spread: round(spread), fork: round(fork), carriage: round(carriage),
    butterfly: tailKind !== 'single' && spread > 0.72, veil: tailKind !== 'single' && long > 0 && fork < 0.32,
  };

  // ── Head: hood (two loci over a threshold), pompons, curled gills ──
  const hoodGrowth = (u('gf_hood_a') + u('gf_hood_b')) / 2 * jitter();
  const hood = round(clamp((hoodGrowth - 0.56) / 0.38));
  const extent = u('gf_hood_extent');
  const head = {
    width: round(0.24 + 0.14 * u('gf_head_width')), snout: round(0.2 + 0.6 * u('gf_snout')), mouth: round(0.3 + 0.5 * u('gf_mouth')),
    hood, hoodKind: (hood <= 0 ? 'none' : extent < 0.36 ? 'crown' : extent < 0.7 ? 'cheeks' : 'full') as GoldfishHood, crownTint: round(clamp(u('gf_crown_tint'))),
    pompon: copies('gf_pompon') ? round(clamp(0.35 + 0.3 * copies('gf_pompon') + 0.35 * u('gf_pompon_size'))) : 0, gillCurl: copies('gf_gill_curl') === 2,
  };

  // ── Eyes: the lrp2 allelic series fails to complement ──
  const eyeIds = ids('gf_eye_program'), lof = eyeIds.filter(allele => allele >= EYE_VARIANT_FROM);
  const eyeKind: GoldfishEyes = lof.length < 2 ? 'normal' : lof.every(allele => allele === 5) ? 'celestial' : lof.some(allele => allele === 5) ? 'skygazer' : 'telescope';
  const bubble = copies('gf_bubble_program') === 2 ? round(clamp(0.45 + 0.55 * u('gf_bubble_size'))) : 0;

  // ── Scales (T locus) ──
  const tCopies = copies('gf_transparency'), scaleType: GoldfishScales = tCopies === 0 ? 'metallic' : tCopies === 1 ? 'nacreous' : 'matte';
  const shine = clamp(u('gf_reflectivity') + e('sheen') + Math.max(0, e('glow')) * 0.5);
  const scales = {
    type: scaleType, pearl: round(clamp((u('gf_pearlscale') - 0.56) / 0.34)), size: round(0.35 + 0.5 * u('gf_scale_size')),
    reflectivity: round(scaleType === 'metallic' ? 0.5 + 0.5 * shine : scaleType === 'nacreous' ? 0.25 + 0.45 * shine : 0.04 + 0.06 * shine),
    reticulation: round(clamp(u('gf_reticulation'))), sparkle: round(scaleType === 'metallic' ? 0 : clamp(u('gf_sparkle'))),
  };

  // ── Color: wild bronze until the color break; pigment switches; pattern ──
  const albino = copies('gf_albino') === 2, blueDilute = copies('gf_blue') === 2, chocolate = copies('gf_chocolate') === 2, lavender = u('gf_lavender');
  const breakUnit = u('gf_color_break'), broken = breakUnit > 0.2 || albino;
  const breakDay = Math.round(clamp(38 - 28 * breakUnit, 8, 38));
  const melanin = 0.15 + 0.8 * u('gf_melanophore');
  const persistence = clamp((u('gf_black_persistence') - 0.55) / 0.4);
  const completeness = 0.45 + 0.55 * u('gf_break_completeness');
  let darkAmount = albino ? 0 : broken ? Math.max(melanin * (1 - completeness), persistence * (0.6 + 0.4 * melanin)) : melanin;
  const xanth = clamp(0.1 + 0.9 * u('gf_xanthophore'));
  let whiteShare = broken ? clamp((u('gf_white_spread') - 0.55) / 0.42 + (xanth < 0.2 ? 1 : 0)) : 0;
  const modes = patternModes(ids('gf_pattern_mode'));
  if (modes.includes('redcap')) whiteShare = Math.max(whiteShare, 0.9);
  if (modes.includes('panda') && broken && !albino) { darkAmount = Math.max(darkAmount, 0.55); whiteShare = Math.max(whiteShare, 0.55); }
  const hue = 30 - 30 * u('gf_red_depth') + 22 * u('gf_yellow_shift') + e('hue') * 60;
  const dilution: GoldfishDilution = blueDilute ? 'blue' : chocolate ? 'chocolate' : lavender > 0.78 ? 'lavender' : 'none';
  let dark = hsl(222, 0.12, 0.09);
  if (dilution === 'blue') dark = hsl(210, 0.3, 0.36);
  else if (dilution === 'chocolate') dark = hsl(22, 0.46, 0.22);
  if (dilution === 'lavender' || lavender > 0.6) dark = hsl(dilution === 'lavender' ? 266 : dark.h, Math.min(dark.s, 0.2), dark.l + 0.38 * clamp((lavender - 0.6) / 0.4));
  const bodyColor = albino ? hsl(hue + 8, 0.62 * xanth, 0.72) : hsl(hue, 0.55 + 0.35 * xanth, 0.56 - 0.08 * u('gf_red_depth') + 0.1 * u('gf_yellow_shift'));
  const bronze = hsl(42 + 8 * u('gf_yellow_shift'), 0.42, 0.36 - 0.12 * melanin);
  const finTint = round(clamp(u('gf_fin_color')));
  const color: GoldfishPhenotype['color'] = {
    broken, breakDay, body: bodyColor, bronze, dark, fin: finTint > 0.7 ? hsl(hue - 4, 0.85, 0.5) : bodyColor,
    darkAmount: round(clamp(darkAmount)), whiteShare: round(clamp(whiteShare)), nacreBlue: round(tCopies ? 0.25 + 0.75 * u('gf_nacre_blue') : 0), finTint,
    albino, dilution,
  };
  const pattern = {
    modes, coverage: round(clamp(0.25 + 0.6 * u('gf_patch_coverage') + e('pattern') * 0.5)), scale: round(0.08 + 0.2 * u('gf_patch_scale')),
    edge: round(clamp(u('gf_patch_edge'))), symmetry: round(clamp(u('gf_patch_symmetry'))), seed: unphasedSeed(genome),
  };
  // Iris: the darker allele is dominant (black over gold ring over silver…), so two copies never blend into an odd hue.
  const IRIS: readonly [number, number, number][] = [[30, 0.25, 0.1], [42, 0.78, 0.5], [210, 0.12, 0.74], [22, 0.62, 0.42], [222, 0.45, 0.3], [40, 0.22, 0.86]];
  const [irisH, irisS, irisL] = IRIS[Math.min(5, ...ids('gf_iris').map(allele => Math.min(5, allele)))];
  const iris = albino ? hsl(352, 0.7, 0.55) : hsl(irisH, irisS, irisL);
  const eyes = {
    size: round(clamp((0.042 + 0.026 * u('gf_eye_size')) * jitter(), 0.03, 0.08)), kind: eyeKind,
    protrusion: eyeKind === 'normal' ? 0 : round(0.45 + 0.55 * u('gf_eye_protrusion')), bubble, iris,
  };

  // ── Life and behavior ──
  let adultLengthCm = (9 + 24 * (0.6 * u('gf_adult_size') + 0.4 * u('gf_body_length'))) * (1 - 0.16 * roundness) * clamp(1 + e('size') * 0.5, 0.65, 1.35);
  const regeneration = clamp(0.4 + 0.45 * u('gf_growth_rate') + 0.15 * canalization);
  let growth = Math.max(0.3, 0.7 + 0.8 * u('gf_growth_rate') + e('growth'));
  let metabolism = Math.max(0.3, 0.75 + 0.6 * u('gf_metabolism') + e('metabolism'));
  let fertility = clamp(0.42 + 0.56 * u('gf_fertility') + e('fertility') * 0.4, 0.1, 1);
  const activity = u('gf_activity'), boldness = clamp(u('gf_boldness') + e('boldness')), sociability = u('gf_sociability'), foraging = u('gf_foraging');
  const longevityYears = 10 + 20 * clamp(u('gf_longevity'));
  // Buoyancy: a weak swim bladder in a round, deep body floats head-down.
  const buoyancyRisk = 0.55 * roundness + 0.35 * clamp((body.depth - 0.3) / 0.36) - 0.75 * u('gf_swim_bladder') + 0.25 + noise() * 0.06;
  const buoyancy = buoyancyRisk > 0.56 ? round(0.22 + 0.5 * clamp(buoyancyRisk - 0.56)) : 0;
  const hoodBlind = head.hood > 0.85 && head.hoodKind === 'full';
  const vision = round(clamp((eyeKind === 'telescope' ? 0.3 : eyeKind === 'normal' ? 0 : 0.6) + (bubble ? 0.45 : 0) + (hoodBlind ? 0.4 : 0)));
  const drag = 1 + 0.9 * (body.depth - 0.3) + 0.6 * roundness + (tailKind === 'single' ? 0 : 0.25) + 0.18 * long + (tail.butterfly ? 0.1 : 0) + bubble * 0.2;
  let speed = (0.022 + 0.04 * activity) / drag * clamp(1 + e('speed'), 0.5, 1.5) * (buoyancy ? 0.75 : 1);

  // Genetic load: homozygous recessives, milder with canalization; fins regrow when growth is strong.
  const defects = defectsFor(genome.genesis.load, GOLDFISH_LOAD, regeneration), severity = 1 - 0.35 * canalization;
  let conditionCap = buoyancy ? 0.78 : 1, subfertile = false, eyeCloud = 0, depigment = 0, finFray = 0, kink = 0, gillDefect = false;
  for (const defect of defects) {
    if (defect.rescued) continue;
    switch (defect.kind) {
      case 'dwarf': adultLengthCm *= 1 - 0.3 * severity; break;
      case 'spine': speed *= 1 - 0.25 * severity; kink = 0.05 * severity; break;
      case 'fins': finFray = Math.max(finFray, 0.4 + 0.4 * severity); break;
      case 'eye': eyeCloud = Math.max(eyeCloud, 0.55 + 0.4 * severity); break;
      case 'pigment': depigment = Math.max(depigment, 0.6 + 0.4 * severity); break;
      case 'gill': gillDefect = true; break;
      case 'frail': conditionCap = Math.min(conditionCap, 0.6 + 0.14 * (1 - severity)); break;
      case 'subfertile': subfertile = true; break;
      default: break;
    }
  }
  const viable = !defects.some(defect => defect.kind === 'lethal');
  const vigorPair = pair(at('gf_vigor')), heterozygosity = goldfishHeterozygosity(genome);
  const vigor = vigorFor(heterozygosity) + 0.04 * Math.abs(vigorPair[0].value - vigorPair[1].value);
  growth *= vigor;
  const oxygen = metabolism * (adultLengthCm / 20) ** 2 * (head.gillCurl || gillDefect ? 1.25 : 1) * (1 + 0.08 * long);
  adultLengthCm = round(adultLengthCm, 3); metabolism = round(metabolism); fertility = round(clamp(fertility));
  const maturityDays = Math.round(clamp(14 + 22 * (1 - u('gf_maturity_timing')) + (adultLengthCm - 18) / 3 - e('maturity') * 20, 12, 46));
  const competitiveness = clamp(0.25 + 0.35 * boldness + 0.15 * activity + 0.4 * foraging - 0.4 * vision - 0.1 * long - (tailKind === 'single' ? 0 : 0.06), 0.05, 1.3);
  const genesis: GenesisTraits = {
    model: 1, fins: long === 0 ? 'standard' : long === 1 ? 'veil' : 'butterfly', ghost: 0, glow: 0, glowHue: 0, hueShift: e('hue') * 60,
    sheen: round(clamp(scales.reflectivity * 0.5 + e('sheen'))), canalization, asymmetry: amplitude * (0.5 + 0.5 * Math.abs(noise())),
    maturityDays, regeneration, vigor, heterozygosity, competitiveness, conditionCap,
    clutchFactor: clamp((0.5 + 0.6 * fertility) * Math.min(1.05, vigor) * (subfertile ? 0.45 : 1), 0.15, 1), oxygenDemand: oxygen, viable, defects,
    finFray, eyeCloud, depigment, kink, novelAlleles: genome.genesis.novel.length,
  };

  const carriers = (Object.keys(GOLDFISH_RECESSIVES) as GoldfishRecessive[]).filter(locus => {
    const n = locus === 'gf_eye_program' ? lof.length : copies(locus);
    return n === 1;
  });
  const behavior = { activity: round(activity), boldness: round(boldness), sociability: round(sociability), foraging: round(foraging), cruiseSpeed: round(speed, 6), turning: round(0.6 + 0.9 * activity + 0.3 * boldness - 0.2 * roundness) };
  const partial: Omit<GoldfishPhenotype, 'variety'> = {
    model: 1, adultLengthCm, growth: round(growth), longevity: round(longevityYears, 2), metabolism, oxygen: round(oxygen), fertility,
    speed: behavior.cruiseSpeed, turning: behavior.turning, activity: behavior.activity, social: behavior.sociability, bold: behavior.boldness, curious: round(0.3 + 0.5 * foraging),
    body, head, eyes, fins, tail, scales, color, pattern, carriers, health: { buoyancy, vision },
    life: { growthMultiplier: round(growth), maturityDays, longevityYears: round(longevityYears, 2), metabolism, fertility, oxygenDemand: round(oxygen), regeneration: round(regeneration) },
    behavior, genesis,
  };
  return { ...partial, variety: classify(partial) };
}

function patternModes([a, b]: [number, number]): GoldfishPattern[] {
  const labels: GoldfishPattern[] = ['solid', 'sarasa', 'redcap', 'panda', 'calico', 'tri-color'];
  const first = labels[Math.min(5, a)], second = labels[Math.min(5, b)];
  if (first === second) return [first];
  // Sarasa and calico are dominant over solid; redcap, panda and tri-color stay hidden behind a solid copy.
  const shows = (mode: GoldfishPattern) => mode === 'sarasa' || mode === 'calico';
  if (first === 'solid') return shows(second) ? [second] : ['solid'];
  if (second === 'solid') return shows(first) ? [first] : ['solid'];
  return [first, second];
}

function unphasedSeed(genome: GoldfishGenome): number {
  return hash(`goldfish:v1:pattern:${genome.maternal.map((a, i) => { const b = genome.paternal[i]; return a < b ? `${a}.${b}` : `${b}.${a}`; }).join('|')}`);
}

/** The adult color as a breeder would name it. */
export function goldfishColorName(p: Omit<GoldfishPhenotype, 'variety'>): string {
  const c = p.color, modes = p.pattern.modes;
  if (c.albino) return 'Albino';
  if (!c.broken) return 'Bronze';
  const ground = p.scales.type !== 'metallic';
  if (modes.includes('calico') && ground) return 'Calico';
  if (modes.includes('tri-color') && c.darkAmount > 0.2) return 'Tri-color';
  if (modes.includes('panda') && c.darkAmount > 0.3) return 'Panda';
  if (modes.includes('redcap') && p.head.hood > 0) return 'Redcap';
  if (c.darkAmount > 0.7) return c.dilution === 'blue' ? 'Blue' : c.dilution === 'chocolate' ? 'Chocolate' : c.dilution === 'lavender' ? 'Lavender' : 'Black';
  if (c.darkAmount > 0.32) return c.dilution === 'blue' ? 'Blue and orange' : c.dilution === 'chocolate' ? 'Chocolate and orange' : 'Red and black';
  if (c.whiteShare > 0.86) return p.scales.type === 'metallic' ? 'Platinum' : 'White';
  if (modes.includes('sarasa') || c.whiteShare > 0.25) return 'Red and white';
  return c.body.h > 38 ? 'Lemon' : c.body.h < 20 ? 'Red' : 'Orange';
}

/** Which named variety a fish conforms to, by fixed precedence, and how close it comes to that variety's ideal (0–1). */
function classify(p: Omit<GoldfishPhenotype, 'variety'>): GoldfishPhenotype['variety'] {
  const color = goldfishColorName(p), noDorsal = p.fins.dorsal === 'absent', twin = p.tail.kind !== 'single';
  let id: GoldfishVariety;
  if (p.eyes.bubble) id = 'bubble-eye';
  else if (p.eyes.kind === 'celestial') id = 'celestial';
  else if (p.eyes.kind === 'skygazer') id = 'skygazer';
  else if (p.eyes.kind === 'telescope') id = color === 'Black' ? 'black-moor' : p.tail.butterfly ? 'butterfly' : 'telescope';
  else if (p.head.pompon) id = 'pompon';
  else if (p.scales.pearl > 0.5) id = p.head.hood > 0.3 ? 'crown-pearlscale' : 'pearlscale';
  else if (noDorsal) id = p.head.hood > 0.25 ? (p.body.arch > 0.6 ? 'ranchu' : 'lionhead') : 'eggfish';
  else if (p.head.hood > 0.25) id = 'oranda';
  else if (twin) id = p.tail.spread > 0.88 && p.tail.carriage > 0.7 ? 'tosakin' : p.tail.veil ? 'veiltail' : p.body.slim ? 'wakin' : p.body.arch > 0.6 ? 'ryukin' : 'fantail';
  else id = p.scales.type !== 'metallic' && p.pattern.modes.includes('calico') ? 'shubunkin' : p.body.slim && (p.fins.long || p.tail.fork > 0.65) ? 'comet' : !p.body.slim && p.body.arch > 0.72 && p.body.roundness > 0.55 ? 'tamasaba' : 'common';
  const sym = p.pattern.symmetry, g = p.genesis, s = (...parts: number[]) => clamp(parts.reduce((a, b) => a + b, 0) / parts.length);
  const ideal: Record<GoldfishVariety, number> = {
    common: s(1 - p.body.roundness, p.scales.reflectivity), comet: s(p.tail.fork, Math.min(1, p.fins.length / 1.5), 1 - p.body.roundness),
    shubunkin: s(p.color.nacreBlue, p.pattern.coverage, sym), tamasaba: s(p.body.arch, p.fins.length / 1.8), wakin: s(1 - p.body.roundness, p.tail.spread),
    fantail: s(p.body.roundness, p.tail.spread, sym), ryukin: s(p.body.arch, p.body.depth / 0.66, p.fins.dorsalHeight / 0.28), veiltail: s(1 - p.tail.fork, p.fins.length / 2.2, p.fins.rays),
    tosakin: s(p.tail.spread, p.tail.carriage, p.tail.split), oranda: s(p.head.hood, p.fins.dorsalHeight / 0.28), lionhead: s(p.head.hood, p.fins.dorsal === 'absent' ? 1 : 0.4, p.body.roundness),
    ranchu: s(p.head.hood, p.body.arch, 1 - p.tail.carriage, p.fins.dorsal === 'absent' ? 1 : 0.3), eggfish: s(p.body.roundness, p.fins.dorsal === 'absent' ? 1 : 0.4),
    telescope: s(p.eyes.protrusion, sym), butterfly: s(p.tail.spread, p.eyes.protrusion), 'black-moor': s(p.color.darkAmount, p.eyes.protrusion, p.scales.type === 'matte' ? 1 : 0.6),
    celestial: s(p.eyes.protrusion, p.fins.dorsal === 'absent' ? 1 : 0.3), skygazer: s(p.eyes.protrusion, sym), 'bubble-eye': s(p.eyes.bubble, p.fins.dorsal === 'absent' ? 1 : 0.3, sym),
    pearlscale: s(p.scales.pearl, p.body.roundness), 'crown-pearlscale': s(p.scales.pearl, p.head.hood), pompon: s(p.head.pompon, sym),
  };
  const flaws = g.defects.filter(d => !d.rescued && !['lethal', 'frail', 'subfertile'].includes(d.kind)).length * 0.12 + (p.health.buoyancy ? 0.15 : 0) + g.asymmetry;
  const label = VARIETY_LABELS[id], prefix = id === 'black-moor' ? '' : color;
  const rarity = Math.min(3, GOLDFISH_VARIETY_RARITY[id] + (RARE_COLORS.has(color) ? 1 : 0)) as 0 | 1 | 2 | 3;
  return { id, label, color, name: prefix ? `${prefix} ${label.toLowerCase()}` : label, rarity, standard: round(clamp(ideal[id] - flaws)) };
}

/** Full locus-by-locus genotype for the genome view. */
export function describeGoldfishGenotype(genome: GoldfishGenome): GoldfishGenotypeDescriptor[] {
  validateGoldfishGenome(genome);
  return GOLDFISH_LOCUS_REGISTRY.map((entry, index) => {
    const maternal = genome.maternal[index], paternal = genome.paternal[index];
    const from = entry.id === 'gf_eye_program' ? EYE_VARIANT_FROM : GOLDFISH_VARIANT_FROM;
    const switchLocus = entry.expression === 'recessive' || entry.expression === 'dominant' || entry.expression === 'incomplete';
    const variant = switchLocus ? Number(maternal >= from) + Number(paternal >= from) : 0;
    const recessiveName = (GOLDFISH_RECESSIVES as Partial<Record<GoldfishLocus, string>>)[entry.id] ?? null;
    return {
      locus: entry.id, label: entry.label, chromosome: entry.chromosomeLabel, positionCm: entry.positionCm, maternal, paternal,
      maternalAllele: isNovel(maternal) ? 'new allele' : entry.alleles[maternal].label, paternalAllele: isNovel(paternal) ? 'new allele' : entry.alleles[paternal].label,
      zygosity: maternal === paternal ? 'homozygous' : 'heterozygous',
      carrierFor: entry.expression === 'recessive' && variant === 1 ? recessiveName : null,
      expressed: entry.expression === 'recessive' ? variant === 2 : switchLocus && variant > 0,
    };
  });
}

const TAIL_TEXT: Record<GoldfishTail, string> = { single: 'Single tail', tri: 'Tri-tail (upper lobes joined)', twin: 'Twin tail', quad: 'Four-lobed twin tail' };
const EYE_TEXT: Record<GoldfishEyes, string> = { normal: 'Normal eyes', telescope: 'Telescope eyes', celestial: 'Celestial eyes (gazing upward)', skygazer: 'Skygazer (one telescope and one celestial allele)' };
const pct = (value: number) => `${Math.round(value * 100)}%`;
export const goldfishTailText = (p: GoldfishPhenotype) => `${TAIL_TEXT[p.tail.kind]}${p.tail.butterfly ? ', butterfly spread' : ''}${p.tail.veil ? ', veil edge' : ''}`;
export const goldfishEyeText = (p: GoldfishPhenotype) => `${EYE_TEXT[p.eyes.kind]}${p.eyes.bubble ? ' with bubble sacs' : ''}`;

/** Human-facing adult-potential descriptors for the inspector. */
export function describeGoldfishPhenotype(genome: GoldfishGenome): GoldfishPhenotypeDescriptor[] {
  const p = expressGoldfish(genome), c = p.color;
  // A calico allele under metallic scales has no blue ground to show on, so it is a hidden copy rather than a visible pattern.
  const masked = p.pattern.modes.includes('calico') && p.scales.type === 'metallic';
  const visibleModes = p.pattern.modes.filter(mode => mode !== 'solid' && !(masked && mode === 'calico'));
  const carried = [...p.carriers.map(locus => GOLDFISH_RECESSIVES[locus] as string), ...(masked ? ['calico pattern masked by metallic scales'] : [])];
  return [
    { group: 'Variety', trait: 'Variety', value: `${p.variety.name} · ${['common', 'uncommon', 'rare', 'very rare'][p.variety.rarity]}` },
    { group: 'Variety', trait: 'Standard', value: `${pct(p.variety.standard)} of the ${p.variety.label.toLowerCase()} ideal` },
    { group: 'Body', trait: 'Adult length', value: `${p.adultLengthCm.toFixed(1)} cm` },
    { group: 'Body', trait: 'Body', value: `${p.body.slim ? 'Slim, streamlined' : p.body.roundness > 0.7 ? 'Egg-round' : 'Deep'} · back arch ${pct(p.body.arch)}` },
    { group: 'Head and eyes', trait: 'Hood', value: p.head.hood ? `${pct(p.head.hood)} grown · ${p.head.hoodKind === 'crown' ? 'crown on top' : p.head.hoodKind === 'cheeks' ? 'over the cheeks' : 'whole face'}` : 'None' },
    { group: 'Head and eyes', trait: 'Eyes', value: goldfishEyeText(p) },
    { group: 'Head and eyes', trait: 'Ornaments', value: [p.head.pompon ? 'nasal pompons' : null, p.head.gillCurl ? 'curled gill covers' : null].filter(Boolean).join(' · ') || 'None' },
    { group: 'Fins', trait: 'Tail', value: goldfishTailText(p) },
    { group: 'Fins', trait: 'Fins', value: `${p.fins.long === 2 ? 'Veil-length' : p.fins.long === 1 ? 'Long' : 'Standard'} · ${p.fins.dorsal === 'full' ? 'dorsal fin' : p.fins.dorsal === 'remnant' ? 'dorsal remnant' : 'no dorsal fin'}${p.fins.analPaired ? ' · paired anal fin' : ''}` },
    { group: 'Scales and color', trait: 'Scales', value: `${p.scales.type[0].toUpperCase()}${p.scales.type.slice(1)}${p.scales.pearl > 0.5 ? ', domed pearl scales' : ''}` },
    { group: 'Scales and color', trait: 'Adult color', value: c.broken ? `${p.variety.color} · breaks from bronze ${c.breakDay} days after hatching` : 'Wild bronze: this fish never changes color' },
    { group: 'Scales and color', trait: 'Pattern', value: visibleModes.length ? visibleModes.map(mode => mode[0].toUpperCase() + mode.slice(1)).join(' + ') : 'Solid' },
    { group: 'Scales and color', trait: 'Hidden copies', value: carried.length ? `Carries ${carried.join(', ')}` : 'None detected' },
    { group: 'Life', trait: 'Growth', value: `${p.life.growthMultiplier.toFixed(2)}× the typical rate` },
    { group: 'Life', trait: 'Maturity', value: `ready to court ${p.life.maturityDays} days after hatching` },
    { group: 'Life', trait: 'Longevity potential', value: `${p.life.longevityYears.toFixed(1)} years` },
    { group: 'Life', trait: 'Buoyancy', value: p.health.buoyancy ? 'Weak swim bladder: floats head-down, condition capped at 78%' : 'Balanced' },
    { group: 'Behavior', trait: 'Temperament', value: `active ${Math.round(p.activity * 100)} · bold ${Math.round(p.bold * 100)} · shoaling ${Math.round(p.social * 100)}` },
    { group: 'Behavior', trait: 'Feeding', value: `forages ${pct(p.behavior.foraging)} · wins ${pct(p.genesis.competitiveness / 1.3)} of contested food${p.health.vision ? ` · vision limited ${pct(p.health.vision)}` : ''}` },
  ];
}

const validated = new WeakSet<object>();
export function goldfishGenomeProblem(value: unknown): string | null {
  if (!value || typeof value !== 'object') return 'Goldfish genome must be an object.';
  if (validated.has(value)) return null;
  const genome = value as Partial<GoldfishGenome>;
  if (genome.species !== 'goldfish') return 'Goldfish genome has the wrong species tag.';
  if (genome.version !== GOLDFISH_GENOME_VERSION) return `Unsupported goldfish genome version ${String(genome.version)}.`;
  if (!Array.isArray(genome.maternal) || !Array.isArray(genome.paternal)) return 'Goldfish genome homologs must be arrays.';
  if (genome.maternal.length !== GOLDFISH_LOCI.length || genome.paternal.length !== GOLDFISH_LOCI.length) return `Goldfish genome v1 requires ${GOLDFISH_LOCI.length} loci per homolog.`;
  const problem = genesisProblem(genome.genesis, GOLDFISH_LOAD, GOLDFISH_LOCI.length, goldfishNovelEligible, moduleAlleleCounts('goldfish'), true);
  if (problem) return problem;
  const novel = new Map(genome.genesis!.novel.map(entry => [entry.id, entry]));
  for (let index = 0; index < GOLDFISH_LOCI.length; index++) {
    const entry = GOLDFISH_LOCUS_REGISTRY[index];
    for (const [copy, allele] of [['maternal', genome.maternal[index]], ['paternal', genome.paternal[index]]] as const) {
      if (isNovel(allele)) { if (novel.get(allele)?.locus !== index) return `Undefined novel allele at ${entry.id} (${copy}).`; continue; }
      if (!Number.isInteger(allele) || allele < 0 || allele >= entry.alleles.length) return `Invalid goldfish allele at ${entry.id} (${copy}).`;
    }
  }
  const carried = new Set([...genome.maternal, ...genome.paternal]);
  if (genome.genesis!.novel.some(entry => !carried.has(entry.id))) return 'A goldfish genome lists a novel allele it does not carry.';
  validated.add(value);
  return null;
}
export function validateGoldfishGenome(genome: unknown): asserts genome is GoldfishGenome {
  const problem = goldfishGenomeProblem(genome);
  if (problem) throw new Error(problem);
}
export const isGoldfishGenome = (value: unknown): value is GoldfishGenome => !!value && typeof value === 'object' && (value as { species?: unknown }).species === 'goldfish' && goldfishGenomeProblem(value) === null;

export function goldfishFingerprint(genome: GoldfishGenome): string {
  validateGoldfishGenome(genome);
  const modules = genome.genesis.modules ? `|m${genome.genesis.modules.maternal.join('')}/${genome.genesis.modules.paternal.join('')}` : '';
  return `GF1-${hash(`gf1:${genome.maternal.join(',')}|${genome.paternal.join(',')}|d${genome.genesis.dev}${modules}`).toString(16).padStart(8, '0').toUpperCase()}`;
}
export function goldfishHeterozygosity(genome: GoldfishGenome): number {
  return genome.maternal.filter((allele, index) => allele !== genome.paternal[index]).length / genome.maternal.length;
}
