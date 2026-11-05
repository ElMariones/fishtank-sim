import {
  GUPPY_CHROMOSOMES, GUPPY_DEFAULT_MUTATION_RATE, GUPPY_GENOME_VERSION, GUPPY_LOCI, GUPPY_LOCUS_INDEX, GUPPY_LOCUS_REGISTRY, GUPPY_RECESSIVES,
  GUPPY_VARIANT_FROM, guppyLocusDefinition, SEX_CHROMOSOME, SEX_LOCUS, TAIL_PATTERNS, WINGE_CROSSOVER, Y_FROM, Y_PROGRAM_IDS, Y_PROGRAM_LOCUS,
  Y_PROGRAM_WEIGHTS, type GuppyAlleleDefinition, type GuppyLocus, type GuppyLocusDefinition, type GuppyRecessive, type GuppyTailPattern, type YProgram,
} from './guppyCatalog';
import {
  carriedNovel, channelEffects, combine, createNovel, defectsFor, developmentNoise, founderLoadPair, founderPotency, genesisProblem, GUPPY_LOAD,
  GUPPY_SCALE, isNovel, NOVEL_SHARE, novelId, novelMap, transmitLoad, vigorFor,
  type Channel, type DominanceClass, type GenesisTraits, type GenesisBlock, type NovelAllele, type Resolved,
} from './genesis';
import { expressModules, moduleAlleleCounts, somaticFor } from './modules';
import { clamp, hash, random } from './random';

/**
 * Guppy genome v1 (world v20): Genesis-native, with a sex chromosome. The maternal homolog always holds an X; the
 * paternal homolog holds the X or Y the father transmitted, so a fish's sex is read from its genome, never rolled.
 */
export type GuppyGenome = { species: 'guppy'; version: 1; maternal: number[]; paternal: number[]; genesis: GenesisBlock };
export type GuppyMutation = { locus: number; copy: 'maternal' | 'paternal'; from: number; to: number };
export type GuppyInheritanceTrace = { maternal: (0 | 1)[]; paternal: (0 | 1)[] };
export type GuppyColor = { h: number; s: number; l: number };
export type GuppySex = 'F' | 'M';

export type GuppyTailShape = 'round' | 'spade' | 'spear' | 'pin' | 'lyre' | 'top-sword' | 'bottom-sword' | 'double-sword' | 'veil' | 'fantail' | 'delta';
export type GuppyBase = 'wild' | 'blond' | 'golden' | 'albino' | 'blue';
export type GuppyStrain =
  | 'wild' | 'endler' | 'full-red' | 'full-black' | 'moscow' | 'tuxedo' | 'snakeskin' | 'king-cobra' | 'mosaic' | 'grass'
  | 'lace' | 'leopard' | 'tiger' | 'metal-head' | 'japan-blue' | 'pingu' | 'maculatus' | 'female';

export type GuppyPhenotype = {
  model: 1;
  sex: GuppySex;
  adultLengthCm: number; growth: number; longevity: number; metabolism: number; oxygen: number; fertility: number;
  speed: number; turning: number; activity: number; social: number; bold: number; curious: number;
  strain: { id: GuppyStrain; label: string; base: GuppyBase; baseLabel: string; tail: GuppyTailShape; tailLabel: string; name: string; rarity: 0 | 1 | 2 | 3; standard: number };
  body: { length: number; depth: number; profile: number; peduncle: number; gonopodium: number };
  /** The male tail as genes build it; females always carry a short rounded fan (see `display`). */
  tail: { shape: GuppyTailShape; length: number; spread: number; top: number; bottom: number; edge: number; rays: number };
  fins: { dorsal: number; dorsalShape: number; dumbo: number; ribbon: 0 | 1 | 2; swallow: number; pelvic: number };
  color: {
    base: GuppyBase;
    body: GuppyColor; belly: GuppyColor; dark: GuppyColor; red: GuppyColor; iri: GuppyColor; iris: GuppyColor;
    /** Shares 0–1 of each male color layer before sex-limited expression is applied. */
    iriAmount: number; redAmount: number; melanin: number; orangeSpots: number; blackSpots: number; spotSize: number; edging: number;
    tailBorder: number; finRed: number; magenta: number;
    metalHead: boolean; asianBlau: boolean; halfBlack: number; snakeskin: number;
    /** Y color programs carried (either homolog). Males show them; females carry them hidden. */
    programs: YProgram[];
    /** How much of the male color program shows: 1 for adult males, the leak share for females. Stage appearance lowers it for young males. */
    expression: number;
    /** Days after birth when a young male starts to color up. */
    onsetDay: number;
    /** Share of a female's hidden program she leaks as a tail tint. */
    leak: number;
  };
  pattern: { tail: GuppyTailPattern[]; scale: number; coverage: number; edge: number; symmetry: number; dorsal: number; seed: number };
  carriers: GuppyRecessive[];
  health: { vision: number; canSire: boolean };
  life: { growthMultiplier: number; maturityDays: number; longevityYears: number; metabolism: number; fertility: number; oxygenDemand: number; regeneration: number; gestationDays: number };
  behavior: { activity: number; boldness: number; shoaling: number; foraging: number; display: number; choosiness: number; appeal: number; cruiseSpeed: number; turning: number };
  genesis: GenesisTraits;
  /** Stage appearance only: belly swelling of a female carrying a brood, 0–1. */
  gravid?: number;
};

export type GuppyGenotypeDescriptor = {
  locus: GuppyLocus; label: string; chromosome: string; positionCm: number; maternal: number; paternal: number;
  maternalAllele: string; paternalAllele: string; zygosity: 'homozygous' | 'heterozygous' | 'hemizygous';
  carrierFor: string | null; expressed: boolean;
};
export type GuppyPhenotypeDescriptor = { group: 'Strain' | 'Body' | 'Fins' | 'Color' | 'Sex chromosome' | 'Life' | 'Behavior'; trait: string; value: string; note?: string };

const weighted = (rng: () => number, weights: readonly number[]): number => {
  const draw = rng();
  let cumulative = 0;
  for (let i = 0; i < weights.length; i++) { cumulative += weights[i]; if (draw < cumulative || i === weights.length - 1) return i; }
  return weights.length - 1;
};
/** One founder homolog. `y` marks the homolog that carries a Y: its sex-chromosome Y program draws from Y weights. */
const founderCopy = (rng: () => number, y: boolean): number[] => GUPPY_LOCUS_REGISTRY.map((entry, index) => {
  if (index === SEX_LOCUS) { const roll = rng(); return y ? (roll < 0.8 ? Y_FROM : Y_FROM + 1) : roll < 0.7 ? 0 : roll < 0.85 ? 1 : roll < 0.95 ? 2 : 3; }
  if (index === Y_PROGRAM_LOCUS) return weighted(rng, y ? Y_PROGRAM_WEIGHTS.y : Y_PROGRAM_WEIGHTS.x);
  return weighted(rng, entry.alleles.map(allele => allele.founderWeight));
});

/** One unrelated guppy founder of the given sex. A male's Y is always on his paternal homolog. */
export function guppyFounderGenome(seed: number, sex: GuppySex): GuppyGenome {
  const maternal = founderCopy(random(hash(`guppy:v1:founder:mother:${seed}`)), false);
  const paternal = founderCopy(random(hash(`guppy:v1:founder:father:${seed}`)), sex === 'M');
  const load = founderLoadPair(random(hash(`guppy:v1:founder:load:${seed}`)), GUPPY_LOAD);
  return { species: 'guppy', version: GUPPY_GENOME_VERSION, maternal, paternal, genesis: { dev: hash(`guppy:v1:founder:devseed:${seed}`), load, novel: [] } };
}

/** Sex is genetic: a Y allele at the sex-determining region makes a male. */
export const guppySex = (genome: Pick<GuppyGenome, 'maternal' | 'paternal'>): GuppySex =>
  genome.maternal[SEX_LOCUS] >= Y_FROM || genome.paternal[SEX_LOCUS] >= Y_FROM ? 'M' : 'F';

const OVER = new Set<GuppyLocus>(['gp_fertility', 'gp_longevity', 'gp_vigor']);
const DOWN = new Set<GuppyLocus>(['gp_metabolism', 'gp_black_edging', 'gp_magenta', 'gp_choosiness']);
const UP = new Set<GuppyLocus>([
  'gp_tail_length', 'gp_tail_spread', 'gp_red_spread', 'gp_red_depth', 'gp_sheen', 'gp_iri_depth', 'gp_adult_size', 'gp_growth_rate',
  'gp_boldness', 'gp_activity', 'gp_foraging', 'gp_canalization', 'gp_display', 'gp_red_tail', 'gp_orange_spots',
]);
/** Dominance class of each quantitative guppy locus; switch, categorical and sex loci keep their own rule. */
export function guppyDominance(index: number): DominanceClass | null {
  const entry = GUPPY_LOCUS_REGISTRY[index];
  if (!entry || entry.expression !== 'quantitative') return null;
  return OVER.has(entry.id) ? 'over' : DOWN.has(entry.id) ? 'down' : UP.has(entry.id) ? 'up' : 'additive';
}
export const guppyNovelEligible = (index: number) => guppyDominance(index) !== null;
const OVER_BONUS = 0.12;

const DEFAULT_CROSSOVER = (left: GuppyLocusDefinition, right: GuppyLocusDefinition) => clamp((right.positionCm - left.positionCm) / 100, 0, 0.45);
/**
 * Crossover probability between two neighbouring loci. In a male's sex chromosome the X and Y barely recombine near the
 * sex-determining region: never between the Y program and the region, and only at Winge's rare rate between the double
 * sword and the Y program. Further out (toward the pseudoautosomal end) they recombine as any chromosome does.
 */
export function guppyCrossover(left: GuppyLocusDefinition, right: GuppyLocusDefinition, male: boolean): number {
  if (!male || right.chromosomeId !== SEX_CHROMOSOME) return DEFAULT_CROSSOVER(left, right);
  if (right.id === 'gp_sex') return 0;
  if (right.id === 'gp_y_program') return WINGE_CROSSOVER;
  return DEFAULT_CROSSOVER(left, right);
}
const mutateAllele = (rng: () => number, allele: GuppyAlleleDefinition) =>
  allele.mutationTargets.length === 1 ? allele.mutationTargets[0].allele : allele.mutationTargets[weighted(rng, allele.mutationTargets.map(target => target.weight))].allele;

/**
 * Linked guppy meiosis. Autosomes behave as for goldfish. For the sex chromosome the homolog choice is the sex draw: the
 * father passes either his X (maternal homolog) or his Y (paternal homolog), with recombination suppressed near the
 * sex-determining region. The sex-determining region never mutates.
 */
export function inheritGuppy(mother: GuppyGenome, father: GuppyGenome, seed: number, mutationRate = GUPPY_DEFAULT_MUTATION_RATE, trace?: GuppyInheritanceTrace): { genome: GuppyGenome; mutations: GuppyMutation[] } {
  validateGuppyGenome(mother); validateGuppyGenome(father);
  if (guppySex(mother) !== 'F' || guppySex(father) !== 'M') throw new Error('A guppy cross needs an XX mother and an XY father.');
  if (!Number.isFinite(mutationRate) || mutationRate < 0 || mutationRate > 1) throw new Error('Invalid guppy mutation rate.');
  if (trace) { trace.maternal.length = 0; trace.paternal.length = 0; }
  const pool = new Map<number, NovelAllele>([...novelMap(mother.genesis), ...novelMap(father.genesis)]);
  const sides: Record<'maternal' | 'paternal', (0 | 1)[]> = { maternal: [], paternal: [] };
  const novelRng = random(hash(`guppy:v1:novel-choice:${seed}`));
  const mutations: GuppyMutation[] = [];
  const mutate = (rng: () => number, index: number, from: number, locus: GuppyLocusDefinition, copy: 'maternal' | 'paternal'): number => {
    if (isNovel(from)) {
      const parent = pool.get(from)!;
      if (novelRng() < 0.25) return clamp(Math.round((parent.value + 1) * 2.5), 0, 5);
      const created = createNovel(novelRng, novelId(seed, `gp${copy}`, index), index, from, { value: parent.value, potency: parent.potency, novel: parent }, GUPPY_SCALE);
      pool.set(created.id, created);
      return created.id;
    }
    const to = mutateAllele(rng, locus.alleles[from]), dominance = guppyDominance(index);
    if (dominance && novelRng() < NOVEL_SHARE) {
      const created = createNovel(novelRng, novelId(seed, `gp${copy}`, index), index, from, { value: locus.alleles[from].effect, potency: founderPotency(dominance, from), novel: null }, GUPPY_SCALE);
      pool.set(created.id, created);
      return created.id;
    }
    return to;
  };
  const transmit = (parent: GuppyGenome, copy: 'maternal' | 'paternal', rng: () => number): number[] => {
    const gamete = Array<number>(GUPPY_LOCI.length), male = copy === 'paternal';
    for (const chromosome of GUPPY_CHROMOSOMES) {
      let side: 0 | 1 = rng() < 0.5 ? 0 : 1;
      chromosome.loci.forEach((id, offset) => {
        const index = GUPPY_LOCUS_INDEX[id], locus = GUPPY_LOCUS_REGISTRY[index];
        if (offset > 0 && rng() < guppyCrossover(guppyLocusDefinition(chromosome.loci[offset - 1]), locus, male)) side = side === 0 ? 1 : 0;
        trace?.[copy].push(side); sides[copy].push(side);
        const from = (side === 0 ? parent.maternal : parent.paternal)[index];
        const rate = locus.mutationMultiplier === 0 ? 0 : mutationRate === GUPPY_DEFAULT_MUTATION_RATE ? clamp(mutationRate * locus.mutationMultiplier) : mutationRate;
        if (rng() >= rate) { gamete[index] = from; return; }
        const to = mutate(rng, index, from, locus, copy);
        gamete[index] = to;
        mutations.push({ locus: index, copy, from, to });
      });
    }
    return gamete;
  };
  const maternal = transmit(mother, 'maternal', random(hash(`guppy:v1:birth:mother:${seed}`)));
  const paternal = transmit(father, 'paternal', random(hash(`guppy:v1:birth:father:${seed}`)));
  const loadRng = random(hash(`guppy:v1:load:${seed}`));
  const load = { maternal: transmitLoad(mother.genesis.load, sides.maternal, GUPPY_LOAD, loadRng), paternal: transmitLoad(father.genesis.load, sides.paternal, GUPPY_LOAD, loadRng) };
  return { genome: { species: 'guppy', version: GUPPY_GENOME_VERSION, maternal, paternal, genesis: { dev: hash(`guppy:v1:dev:${seed}`), load, novel: carriedNovel(maternal, paternal, pool) } }, mutations };
}

const resolvers = new WeakMap<GuppyGenome, (index: number) => [Resolved, Resolved]>();
/** Each copy's value and potency at a locus, catalog or novel. */
export function guppyPair(genome: GuppyGenome): (index: number) => [Resolved, Resolved] {
  let resolver = resolvers.get(genome);
  if (resolver) return resolver;
  const pool = novelMap(genome.genesis);
  const one = (index: number, allele: number): Resolved => {
    const novel = isNovel(allele) ? pool.get(allele) ?? null : null;
    if (novel) return { value: novel.value, potency: novel.potency, novel };
    return { value: GUPPY_LOCUS_REGISTRY[index].alleles[allele]?.effect ?? 0, potency: founderPotency(guppyDominance(index) ?? 'additive', allele), novel: null };
  };
  resolver = index => [one(index, genome.maternal[index]), one(index, genome.paternal[index])];
  resolvers.set(genome, resolver);
  return resolver;
}

const round = (value: number, digits = 4) => { const f = 10 ** digits; return Math.round(value * f) / f; };
const hsl = (h: number, s: number, l: number): GuppyColor => ({ h: round(((h % 360) + 360) % 360, 2), s: round(clamp(s)), l: round(clamp(l)) });

export const GUPPY_STRAIN_LABELS: Record<GuppyStrain, string> = {
  wild: 'Wild-type', endler: 'Endler-type', 'full-red': 'Full Red', 'full-black': 'Full Black', moscow: 'Moscow', tuxedo: 'Tuxedo',
  snakeskin: 'Snakeskin', 'king-cobra': 'King Cobra', mosaic: 'Mosaic', grass: 'Grass', lace: 'Lace', leopard: 'Leopard', tiger: 'Tiger',
  'metal-head': 'Metal Head', 'japan-blue': 'Japan Blue', pingu: 'Pingu', maculatus: 'Maculatus', female: 'Female',
};
export const GUPPY_STRAIN_RARITY: Record<GuppyStrain, 0 | 1 | 2 | 3> = {
  wild: 0, female: 0, grass: 0, mosaic: 1, tuxedo: 1, maculatus: 1, endler: 1, snakeskin: 1, leopard: 2, lace: 2, tiger: 2,
  'metal-head': 2, pingu: 2, 'full-red': 2, 'full-black': 3, moscow: 2, 'king-cobra': 3, 'japan-blue': 3,
};
export const GUPPY_TAIL_LABELS: Record<GuppyTailShape, string> = {
  round: 'Roundtail', spade: 'Spadetail', spear: 'Speartail', pin: 'Pintail', lyre: 'Lyretail', 'top-sword': 'Top Sword',
  'bottom-sword': 'Bottom Sword', 'double-sword': 'Double Sword', veil: 'Veiltail', fantail: 'Fantail', delta: 'Delta',
};
export const GUPPY_TAIL_RARITY: Record<GuppyTailShape, number> = {
  round: 0, fantail: 0, spade: 0, veil: 0.5, spear: 0.5, delta: 1, 'top-sword': 0.5, 'bottom-sword': 0.5, pin: 1, lyre: 1, 'double-sword': 1,
};
export const GUPPY_BASE_LABELS: Record<GuppyBase, string> = { wild: '', blond: 'Blond', golden: 'Golden', albino: 'Albino', blue: 'Blue' };
const IRI_HUES = [176, 150, 205, 232, 268, 300];

const phenotypes = new WeakMap<GuppyGenome, GuppyPhenotype>();
/** Deterministic adult genetic potential. Sex comes from the genome; age, water and broods never enter here. */
export function expressGuppy(genome: GuppyGenome): GuppyPhenotype {
  const cached = phenotypes.get(genome);
  if (cached) return cached;
  validateGuppyGenome(genome);
  const phenotype = genome.genesis.model === 2 ? developGuppyV7(develop(genome), genome) : develop(genome);
  phenotypes.set(genome, phenotype);
  return phenotype;
}

/** Guppy development v7 (Genesis model 2): side-effect channels, somatic marks and the dorsal-duplication module. */
function developGuppyV7(developed: GuppyPhenotype, genome: GuppyGenome): GuppyPhenotype {
  const block = genome.genesis, p: GuppyPhenotype = structuredClone(developed), pair = guppyPair(genome);
  const effects = channelEffects(Array.from({ length: GUPPY_LOCI.length }, (_, i) => pair(i)));
  const e = (channel: Channel) => effects[channel] ?? 0;
  p.body.depth *= clamp(1 + 0.4 * e('depth'), 0.7, 1.35);
  p.pattern.edge = clamp(p.pattern.edge + 0.35 * e('contrast'));
  p.longevity = p.life.longevityYears = Math.max(1.2, p.longevity + 1.2 * e('longevity'));
  const modules = expressModules('guppy', block.modules!, block.dev, p.genesis.canalization);
  if (modules.secondDorsal) p.behavior.cruiseSpeed = round(p.behavior.cruiseSpeed * (1 - 0.04 * modules.secondDorsal), 6);
  p.speed = p.behavior.cruiseSpeed;
  p.genesis = { ...p.genesis, modules, somatic: somaticFor(block.dev, p.genesis.canalization) };
  return p;
}

function develop(genome: GuppyGenome): GuppyPhenotype {
  const pair = guppyPair(genome), at = (locus: GuppyLocus) => GUPPY_LOCUS_INDEX[locus];
  const ids = (locus: GuppyLocus): [number, number] => [genome.maternal[at(locus)], genome.paternal[at(locus)]];
  const q = (locus: GuppyLocus) => { const [a, b] = pair(at(locus)); return clamp(combine(a, b, guppyDominance(at(locus)) ?? 'additive', OVER_BONUS), -1.25, 1.25); };
  const u = (locus: GuppyLocus) => clamp((q(locus) + 1) / 2, 0, 1.1);
  const copies = (locus: GuppyLocus) => ids(locus).filter(allele => allele >= GUPPY_VARIANT_FROM).length;
  const effects = channelEffects(Array.from({ length: GUPPY_LOCI.length }, (_, i) => pair(i)));
  const e = (channel: keyof typeof effects) => effects[channel] ?? 0;
  const sex = guppySex(genome), male = sex === 'M';
  const canalization = clamp(u('gp_canalization'));
  const noise = developmentNoise(genome.genesis.dev), amplitude = 0.012 + 0.085 * (1 - canalization), jitter = () => 1 + amplitude * noise();

  // ── Body: strong sexual dimorphism. Females are bigger and deeper; males are slim with a gonopodium. ──
  const sizeUnit = 0.6 * u('gp_adult_size') + 0.4 * u('gp_body_length');
  let adultLengthCm = (male ? 2.3 + 1.7 * sizeUnit : 3.8 + 2.8 * sizeUnit) * clamp(1 + e('size') * 0.5, 0.65, 1.35);
  const body = {
    length: round(clamp((male ? 0.82 : 0.9) + 0.22 * u('gp_body_length'), 0.75, 1.2) * jitter()),
    depth: round((male ? 0.2 : 0.27) + 0.09 * u('gp_body_depth') * jitter()),
    profile: round(clamp(u('gp_back_profile'))), peduncle: round(clamp(u('gp_peduncle'))),
    gonopodium: male ? round(0.1 + 0.08 * u('gp_gonopodium')) : 0,
  };

  // ── Tail shape (male genes; females always show a short fan) ──
  const doubleSword = copies('gp_double_sword');
  const top = clamp(u('gp_top_sword') * jitter() + 0.42 * Math.min(1, doubleSword)), bottom = clamp(u('gp_bottom_sword') * jitter() + 0.42 * Math.min(1, doubleSword));
  const length = clamp(u('gp_tail_length') * jitter()), spread = clamp(u('gp_tail_spread') * jitter()), edge = clamp(u('gp_tail_edge'));
  let shape: GuppyTailShape;
  if (top > 0.78 && bottom > 0.78) shape = 'double-sword';
  else if (top > 0.62 && bottom > 0.62) shape = 'lyre';
  else if (top > 0.82) shape = 'top-sword';
  else if (bottom > 0.82) shape = 'bottom-sword';
  else if (spread > 0.78 && length > 0.6) shape = 'delta';
  else if (spread > 0.58) shape = length > 0.72 ? 'veil' : 'fantail';
  else if (edge > 0.86) shape = 'pin';
  else if (edge > 0.66) shape = 'spear';
  else if (edge > 0.4) shape = 'spade';
  else shape = 'round';
  const tail = { shape, length: round(length), spread: round(spread), top: round(top), bottom: round(bottom), edge: round(edge), rays: round(clamp(u('gp_tail_rays'))) };

  // ── Fins ──
  const dumbo = copies('gp_dumbo') === 2 ? round(0.6 + 0.4 * (ids('gp_dumbo').every(a => a === 5) ? 1 : 0.5)) : 0;
  const ribbon = copies('gp_ribbon') as 0 | 1 | 2;
  const swallow = copies('gp_swallow') === 2 ? round(0.6 + 0.4 * (ids('gp_swallow').every(a => a === 5) ? 1 : 0.4)) : 0;
  const fins = {
    dorsal: round(clamp((male ? 0.35 : 0.15) + (male ? 0.6 : 0.15) * u('gp_dorsal_length') + 0.6 * swallow) * clamp(1 + e('fins') * 0.6, 0.5, 1.6)),
    dorsalShape: round(clamp(u('gp_dorsal_shape'))), dumbo, ribbon, swallow, pelvic: round(clamp(0.3 + 0.4 * u('gp_pelvic') + 0.5 * swallow + 0.35 * ribbon)),
  };

  // ── Base color (recessives), iridophores, carotenoids, pattern ──
  const albino = copies('gp_albino') === 2, blond = copies('gp_blond') === 2, golden = copies('gp_golden') === 2, blueBase = copies('gp_blue') === 2;
  const base: GuppyBase = albino ? 'albino' : blueBase ? 'blue' : golden ? 'golden' : blond ? 'blond' : 'wild';
  const asianBlau = copies('gp_asian_blau') > 0, metalHead = copies('gp_metal_head') > 0;
  const melanin = albino ? 0 : clamp((0.25 + 0.75 * u('gp_melanophore')) * (blond ? 0.45 : 1) * (golden ? 0.6 : 1));
  const xanth = blueBase ? 0 : clamp(0.15 + 0.85 * u('gp_xanthophore'));
  const bodyColor = albino ? hsl(14, 0.35, 0.86) : blueBase ? hsl(205, 0.12, 0.68) : golden ? hsl(42, 0.62, 0.62) : blond ? hsl(40, 0.32, 0.78) : hsl(48, 0.16, 0.58 - 0.12 * melanin);
  const belly = hsl(bodyColor.h, bodyColor.s * 0.6, Math.min(0.94, bodyColor.l + 0.18));
  const redHue = 2 + 34 * u('gp_yellow_shift') + e('hue') * 50 + (u('gp_magenta') > 0.75 ? -22 : 0);
  const redAmount = round(clamp(xanth * (0.35 + 0.65 * u('gp_red_spread')) * (asianBlau ? 0.3 : 1) * (0.75 + 0.25 * u('gp_diet_response')) + 0.25 * u('gp_red_tail') * (blueBase ? 0 : 1)));
  const red = hsl(redHue, 0.88 - 0.2 * u('gp_yellow_shift'), 0.47 + 0.05 * (1 - u('gp_red_depth')));
  const iriHue = asianBlau ? 208 : IRI_HUES[Math.min(5, Math.floor(u('gp_iri_hue') * 6))] + e('hue') * 30;
  const iriAmount = round(clamp(0.18 + 0.5 * u('gp_sheen') + 0.3 * u('gp_iri_depth') + (asianBlau ? 0.25 : 0) + 0.15 * u('gp_pseudo_sheen') + e('sheen')));
  const iri = hsl(iriHue, 0.62 + 0.25 * u('gp_iri_depth'), 0.55 + 0.1 * u('gp_sheen'));
  const dark = albino ? hsl(8, 0.4, 0.75) : blueBase ? hsl(220, 0.25, 0.12) : hsl(30, 0.2, 0.08 + (blond ? 0.22 : 0));
  const programs = [...new Set(ids('gp_y_program').map(allele => Y_PROGRAM_IDS[Math.min(5, allele)]).filter((p): p is YProgram => p !== null))];
  const patterns = tailPatterns(ids('gp_tail_pattern'));
  const halfBlack = copies('gp_half_black') ? round(albino ? 0 : copies('gp_half_black') === 2 ? 1 : 0.75) : 0;
  const snakeskin = copies('gp_snakeskin') ? round(copies('gp_snakeskin') === 2 ? 1 : 0.75) : 0;
  const leak = round(0.06 + 0.3 * u('gp_female_leak'));
  const IRIS: readonly [number, number, number][] = [[30, 0.2, 0.12], [42, 0.6, 0.45], [196, 0.4, 0.55], [32, 0.62, 0.46], [210, 0.25, 0.7], [48, 0.5, 0.75]];
  const [ih, is, il] = IRIS[Math.min(5, Math.floor(u('gp_iri_hue') * 6))];
  const color: GuppyPhenotype['color'] = {
    base, body: bodyColor, belly, dark, red, iri, iris: albino ? hsl(352, 0.75, 0.5) : hsl(ih, is, il),
    iriAmount, redAmount, melanin: round(melanin),
    orangeSpots: blueBase ? 0 : Math.round(6 * u('gp_orange_spots')), blackSpots: albino ? 0 : Math.round(5 * u('gp_spot_count')), spotSize: round(0.02 + 0.03 * u('gp_spot_size')),
    edging: round(albino ? 0 : clamp(u('gp_black_edging'))), tailBorder: round(clamp(u('gp_tail_border'))), finRed: round(clamp(u('gp_fin_red') * xanth)), magenta: round(clamp((u('gp_magenta') - 0.5) * 2)),
    metalHead, asianBlau, halfBlack, snakeskin, programs,
    expression: male ? 1 : leak, onsetDay: Math.round(clamp(8 + 14 * (1 - u('gp_color_onset')), 6, 24)), leak,
  };
  const pattern = {
    tail: patterns, scale: round(0.05 + 0.1 * u('gp_pattern_scale')), coverage: round(clamp(0.3 + 0.65 * u('gp_pattern_coverage') + e('pattern') * 0.5)),
    edge: round(clamp(u('gp_pattern_edge'))), symmetry: round(clamp(u('gp_pattern_symmetry'))), dorsal: round(clamp(u('gp_dorsal_pattern'))), seed: unphasedSeed(genome),
  };

  // ── Life and behavior ──
  const regeneration = clamp(0.45 + 0.4 * u('gp_growth_rate') + 0.15 * canalization);
  let growth = Math.max(0.3, 0.8 + 0.8 * u('gp_growth_rate') + e('growth'));
  let metabolism = Math.max(0.3, 0.8 + 0.6 * u('gp_metabolism') + e('metabolism'));
  let fertility = clamp(0.45 + 0.35 * u('gp_fertility') + 0.2 * u('gp_brood_size') + e('fertility') * 0.4, 0.1, 1);
  const activity = u('gp_activity'), boldness = clamp(u('gp_boldness') + e('boldness')), shoaling = u('gp_shoaling'), foraging = u('gp_foraging');
  const display = male ? round(clamp(u('gp_display'))) : 0, choosiness = male ? 0 : round(clamp(u('gp_choosiness')));
  const longevityYears = 2 + 2 * clamp(u('gp_longevity'));
  const vision = round(albino ? 0.35 : 0);
  // A big tail is beautiful and heavy: drag slows a male; ribbons and dumbo ears add a little more.
  const tailMass = male ? 0.6 * length + 0.4 * spread + 0.3 * Math.max(top, bottom) * (top > 0.6 || bottom > 0.6 ? 1 : 0) : 0.1;
  const drag = 1 + 0.9 * tailMass + 0.15 * ribbon + 0.2 * dumbo + 0.1 * swallow;
  let speed = (0.03 + 0.045 * activity) / drag * clamp(1 + e('speed'), 0.5, 1.5);

  const defects = defectsFor(genome.genesis.load, GUPPY_LOAD, regeneration), severity = 1 - 0.35 * canalization;
  let conditionCap = 1, subfertile = false, eyeCloud = 0, depigment = 0, finFray = 0, kink = 0;
  for (const defect of defects) {
    if (defect.rescued) continue;
    switch (defect.kind) {
      case 'dwarf': adultLengthCm *= 1 - 0.25 * severity; break;
      case 'spine': speed *= 1 - 0.25 * severity; kink = 0.05 * severity; break;
      case 'fins': finFray = Math.max(finFray, 0.4 + 0.4 * severity); break;
      case 'eye': eyeCloud = Math.max(eyeCloud, 0.55 + 0.4 * severity); break;
      case 'pigment': depigment = Math.max(depigment, 0.6 + 0.4 * severity); break;
      case 'frail': conditionCap = Math.min(conditionCap, 0.6 + 0.14 * (1 - severity)); break;
      case 'subfertile': subfertile = true; break;
      default: break;
    }
  }
  const viable = !defects.some(defect => defect.kind === 'lethal');
  const vigorPair = pair(at('gp_vigor')), heterozygosity = guppyHeterozygosity(genome);
  const vigor = vigorFor(heterozygosity) + 0.04 * Math.abs(vigorPair[0].value - vigorPair[1].value);
  growth *= vigor;
  const oxygen = metabolism * (adultLengthCm / 20) ** 2 * (1 + 0.1 * tailMass);
  adultLengthCm = round(adultLengthCm, 3); metabolism = round(metabolism); fertility = round(clamp(fertility));
  const maturityDays = Math.round(clamp(10 + 16 * (1 - u('gp_maturity_timing')) + (male ? -2 : 2) - e('maturity') * 14, 8, 30));
  const gestationDays = Math.round(clamp(5 + 5 * u('gp_gestation'), 5, 10));
  const competitiveness = clamp(0.3 + 0.35 * boldness + 0.2 * activity + 0.4 * foraging - 0.4 * vision - 0.18 * tailMass, 0.05, 1.3);
  // Orange is what females look for (Houde, Endler); a hard display helps; a huge tail helps a little.
  const orangeArea = color.orangeSpots / 6 * 0.6 + redAmount * 0.4;
  const appeal = male ? round(clamp(0.45 * orangeArea + 0.35 * display + 0.2 * tailMass)) : 0;
  const ribbonMale = male && ribbon > 0;
  const genesis: GenesisTraits = {
    model: 1, fins: !male || length < 0.5 ? 'standard' : length < 0.8 ? 'veil' : 'butterfly', ghost: 0, glow: 0, glowHue: 0, hueShift: e('hue') * 50,
    sheen: round(clamp(iriAmount * 0.6 + e('sheen'))), canalization, asymmetry: amplitude * (0.5 + 0.5 * Math.abs(noise())),
    maturityDays, regeneration, vigor, heterozygosity, competitiveness, conditionCap,
    clutchFactor: clamp((0.45 + 0.4 * fertility + 0.3 * u('gp_brood_size')) * Math.min(1.05, vigor) * (subfertile ? 0.45 : 1), 0.15, 1), oxygenDemand: oxygen, viable, defects,
    finFray, eyeCloud, depigment, kink, novelAlleles: genome.genesis.novel.length,
  };
  const carriers = (Object.keys(GUPPY_RECESSIVES) as GuppyRecessive[]).filter(locus => copies(locus) === 1);
  const behavior = {
    activity: round(activity), boldness: round(boldness), shoaling: round(shoaling), foraging: round(foraging), display, choosiness, appeal,
    cruiseSpeed: round(speed, 6), turning: round(0.9 + 0.9 * activity + 0.3 * boldness - 0.3 * tailMass),
  };
  const partial: Omit<GuppyPhenotype, 'strain'> = {
    model: 1, sex, adultLengthCm, growth: round(growth), longevity: round(longevityYears, 2), metabolism, oxygen: round(oxygen, 6), fertility,
    speed: behavior.cruiseSpeed, turning: behavior.turning, activity: behavior.activity, social: behavior.shoaling, bold: behavior.boldness, curious: round(0.35 + 0.5 * foraging),
    body, tail, fins, color, pattern, carriers, health: { vision, canSire: !ribbonMale },
    life: { growthMultiplier: round(growth), maturityDays, longevityYears: round(longevityYears, 2), metabolism, fertility, oxygenDemand: round(oxygen, 6), regeneration: round(regeneration), gestationDays },
    behavior, genesis,
  };
  return { ...partial, strain: classify(partial) };
}

/** Plain is recessive to every pattern; two different patterns are codominant and both show. */
function tailPatterns([a, b]: [number, number]): GuppyTailPattern[] {
  const first = TAIL_PATTERNS[Math.min(5, a)], second = TAIL_PATTERNS[Math.min(5, b)];
  if (first === second) return [first];
  if (first === 'plain') return [second];
  if (second === 'plain') return [first];
  return [first, second];
}

function unphasedSeed(genome: GuppyGenome): number {
  return hash(`guppy:v1:pattern:${genome.maternal.map((a, i) => { const b = genome.paternal[i]; return a < b ? `${a}.${b}` : `${b}.${a}`; }).join('|')}`);
}

/** The strain a breeder would name, by fixed precedence, and how close the fish comes to its ideal (0–1). */
function classify(p: Omit<GuppyPhenotype, 'strain'>): GuppyPhenotype['strain'] {
  const c = p.color, base = c.base, baseLabel = GUPPY_BASE_LABELS[base];
  const tailShape: GuppyTailShape = p.sex === 'M' ? p.tail.shape : 'round';
  let id: GuppyStrain;
  if (p.sex === 'F') id = 'female';
  else if (c.programs.includes('moscow') && base !== 'albino') id = 'moscow';
  else if (c.halfBlack > 0) id = 'tuxedo';
  else if (c.snakeskin > 0) id = c.programs.includes('armatus') || c.edging > 0.72 ? 'king-cobra' : 'snakeskin';
  else if (c.metalHead) id = 'metal-head';
  else if (c.asianBlau && (base === 'blue' || c.redAmount < 0.3)) id = 'japan-blue';
  else if (c.redAmount > 0.72 && p.pattern.tail[0] === 'plain') id = 'full-red';
  else if (c.melanin > 0.82 && c.edging > 0.6 && base === 'wild') id = 'full-black';
  else if (p.pattern.tail[0] !== 'plain') id = p.pattern.tail[0] as GuppyStrain;
  else if (c.programs.includes('pingu')) id = 'pingu';
  else if (c.programs.includes('maculatus')) id = 'maculatus';
  else if (p.adultLengthCm < 2.95 && c.orangeSpots >= 3) id = 'endler';
  else id = 'wild';
  const s = (...parts: number[]) => clamp(parts.reduce((a, b) => a + b, 0) / parts.length);
  const tailIdeal = s(p.tail.length, p.tail.spread, p.tail.rays);
  const ideal: Record<GuppyStrain, number> = {
    wild: s(c.iriAmount, c.orangeSpots / 6), endler: s(c.orangeSpots / 6, c.iriAmount, 1 - p.tail.length), 'full-red': s(c.redAmount, tailIdeal, 1 - c.melanin),
    'full-black': s(c.melanin, c.edging, tailIdeal), moscow: s(c.iriAmount, tailIdeal, c.melanin), tuxedo: s(c.halfBlack, tailIdeal, c.redAmount),
    snakeskin: s(c.snakeskin, p.pattern.coverage, p.pattern.symmetry), 'king-cobra': s(c.snakeskin, c.edging, p.pattern.coverage), mosaic: s(p.pattern.coverage, tailIdeal, p.pattern.edge),
    grass: s(p.pattern.coverage, 1 - p.pattern.scale * 6, tailIdeal), lace: s(p.pattern.coverage, p.pattern.symmetry, tailIdeal), leopard: s(p.pattern.coverage, p.pattern.edge, c.edging),
    tiger: s(p.pattern.coverage, p.pattern.symmetry, p.pattern.edge), 'metal-head': s(c.iriAmount, tailIdeal), 'japan-blue': s(c.iriAmount, 1 - c.redAmount, tailIdeal),
    pingu: s(c.redAmount, c.iriAmount), maculatus: s(c.melanin, c.redAmount, p.fins.dorsal), female: s(p.body.depth / 0.36, 1 - p.genesis.asymmetry * 4),
  };
  const flaws = p.genesis.defects.filter(d => !d.rescued && !['lethal', 'frail', 'subfertile'].includes(d.kind)).length * 0.12 + p.genesis.asymmetry;
  const label = GUPPY_STRAIN_LABELS[id], tailLabel = GUPPY_TAIL_LABELS[tailShape];
  const baseBonus = base === 'albino' || base === 'blue' ? 1 : base === 'golden' || base === 'blond' ? 0.5 : 0;
  const fancy = p.fins.dumbo || p.fins.ribbon || p.fins.swallow ? 0.5 : 0;
  const rarity = Math.min(3, Math.round(GUPPY_STRAIN_RARITY[id] + baseBonus + (p.sex === 'M' ? GUPPY_TAIL_RARITY[tailShape] : 0) + fancy)) as 0 | 1 | 2 | 3;
  const finWords = [p.fins.dumbo ? 'Dumbo' : '', p.fins.ribbon ? 'Ribbon' : p.fins.swallow ? 'Swallow' : ''].filter(Boolean).join(' ');
  const name = p.sex === 'F'
    ? `${baseLabel || 'Grey'}${finWords ? ` ${finWords.toLowerCase()}` : ''} female`
    : [baseLabel, finWords, label === 'Wild-type' && (baseLabel || finWords) ? '' : label, tailLabel].filter(Boolean).join(' ');
  return { id, label, base, baseLabel: baseLabel || (p.sex === 'F' ? 'Grey' : 'Wild'), tail: tailShape, tailLabel, name, rarity, standard: round(clamp(ideal[id] - flaws)) };
}

/** Full locus-by-locus genotype for the genome view. The sex region of a male reads X/Y. */
export function describeGuppyGenotype(genome: GuppyGenome): GuppyGenotypeDescriptor[] {
  validateGuppyGenome(genome);
  return GUPPY_LOCUS_REGISTRY.map((entry, index) => {
    const maternal = genome.maternal[index], paternal = genome.paternal[index];
    const switchLocus = entry.expression === 'recessive' || entry.expression === 'dominant' || entry.expression === 'incomplete';
    const variant = switchLocus ? Number(maternal >= GUPPY_VARIANT_FROM) + Number(paternal >= GUPPY_VARIANT_FROM) : 0;
    const recessiveName = (GUPPY_RECESSIVES as Partial<Record<GuppyLocus, string>>)[entry.id] ?? null;
    const label = (allele: number) => isNovel(allele) ? 'new allele' : entry.alleles[allele].label;
    return {
      locus: entry.id, label: entry.label, chromosome: entry.chromosomeLabel, positionCm: entry.positionCm, maternal, paternal,
      maternalAllele: label(maternal), paternalAllele: label(paternal),
      zygosity: entry.expression === 'sex' && (maternal >= Y_FROM) !== (paternal >= Y_FROM) ? 'hemizygous' : maternal === paternal ? 'homozygous' : 'heterozygous',
      carrierFor: entry.expression === 'recessive' && variant === 1 ? recessiveName : null,
      expressed: entry.expression === 'recessive' ? variant === 2 : entry.expression === 'sex' ? paternal >= Y_FROM : switchLocus && variant > 0,
    };
  });
}

const pct = (value: number) => `${Math.round(value * 100)}%`;
const cap = (text: string) => text ? text[0].toUpperCase() + text.slice(1) : text;
const PROGRAM_TEXT: Record<YProgram, string> = { maculatus: 'maculatus (black dorsal spot)', moscow: 'Moscow (dark metallic body)', armatus: 'armatus (black tail bar)', pingu: 'pingu (red front)' };
export const guppyProgramText = (program: YProgram) => PROGRAM_TEXT[program];

/** Which homolog carries each Y program in a male: "on the Y" (father-to-son) or "on the X" (after a crossover). */
export function guppyProgramLinkage(genome: GuppyGenome): { program: YProgram; on: 'X' | 'Y' }[] {
  const out: { program: YProgram; on: 'X' | 'Y' }[] = [];
  for (const [copy, allele] of [['maternal', genome.maternal[Y_PROGRAM_LOCUS]], ['paternal', genome.paternal[Y_PROGRAM_LOCUS]]] as const) {
    const program = Y_PROGRAM_IDS[Math.min(5, allele)];
    const onY = (copy === 'maternal' ? genome.maternal : genome.paternal)[SEX_LOCUS] >= Y_FROM;
    if (program) out.push({ program, on: onY ? 'Y' : 'X' });
  }
  return out;
}

/** Human-facing adult-potential descriptors for the inspector. */
export function describeGuppyPhenotype(genome: GuppyGenome): GuppyPhenotypeDescriptor[] {
  const p = expressGuppy(genome), c = p.color, male = p.sex === 'M';
  const linkage = guppyProgramLinkage(genome);
  const programText = linkage.length ? linkage.map(entry => `${PROGRAM_TEXT[entry.program]} on the ${entry.on}`).join(' · ') : 'None';
  const visiblePatterns = p.pattern.tail.filter(mode => mode !== 'plain');
  return [
    { group: 'Strain', trait: male ? 'Strain' : 'Female', value: `${p.strain.name} · ${['common', 'uncommon', 'rare', 'very rare'][p.strain.rarity]}` },
    { group: 'Strain', trait: 'Standard', value: male ? `${pct(p.strain.standard)} of the ${p.strain.label.toLowerCase()} ideal` : `${pct(p.strain.standard)} of a well-formed female` },
    { group: 'Body', trait: 'Adult length', value: `${p.adultLengthCm.toFixed(1)} cm${male ? ' (males stay small)' : ' (females grow larger)'}` },
    { group: 'Fins', trait: 'Tail', value: male ? `${p.strain.tailLabel} · length ${pct(p.tail.length)} · spread ${pct(p.tail.spread)}` : `Short rounded fan · her genes for a male tail: ${GUPPY_TAIL_LABELS[p.tail.shape].toLowerCase()}` },
    { group: 'Fins', trait: 'Fins', value: [p.fins.dumbo ? 'dumbo pectorals' : null, p.fins.ribbon ? `ribbon fins (${p.fins.ribbon} cop${p.fins.ribbon === 1 ? 'y' : 'ies'})` : null, p.fins.swallow ? 'swallow streamers' : null].filter(Boolean).join(' · ') || 'Standard' },
    { group: 'Color', trait: 'Base', value: c.base === 'wild' ? 'Wild grey' : `${cap(c.base)}${c.base === 'blue' ? ' (no red pigment)' : c.base === 'albino' ? ' (red eyes)' : ''}` },
    { group: 'Color', trait: male ? 'Color' : 'Color shown', value: male
      ? [c.asianBlau ? 'Asian Blau' : null, c.metalHead ? 'metal head' : null, c.halfBlack ? 'half-black rear' : null, c.snakeskin ? 'snakeskin' : null, `red ${pct(c.redAmount)}`, `sheen ${pct(c.iriAmount)}`].filter(Boolean).join(' · ')
      : `Females show only ${pct(c.leak)} of their color program, as a tint on the tail` },
    { group: 'Color', trait: 'Tail pattern', value: visiblePatterns.length ? visiblePatterns.map(cap).join(' + ') + (male ? '' : ' (carried, shown faintly)') : 'Plain' },
    { group: 'Sex chromosome', trait: 'Sex', value: male ? 'XY male: passes his Y to every son' : 'XX female: passes an X to every child' },
    { group: 'Sex chromosome', trait: 'Y programs', value: programText, note: male ? undefined : 'A female shows none of these; her sons reveal them.' },
    { group: 'Sex chromosome', trait: 'Hidden copies', value: p.carriers.length ? `Carries ${p.carriers.map(locus => GUPPY_RECESSIVES[locus]).join(', ')}` : 'None detected' },
    { group: 'Life', trait: 'Growth', value: `${p.life.growthMultiplier.toFixed(2)}× the typical rate` },
    { group: 'Life', trait: 'Maturity', value: `ready to court ${p.life.maturityDays} days after birth${male ? `, colors up from day ${c.onsetDay}` : ''}` },
    { group: 'Life', trait: male ? 'Siring' : 'Broods', value: male ? (p.health.canSire ? 'Can sire broods' : 'Ribbon gonopodium: cannot sire. Carry the line through his sisters.') : `Livebearer: fry born ${p.life.gestationDays} days after mating` },
    { group: 'Life', trait: 'Longevity potential', value: `${p.life.longevityYears.toFixed(1)} years` },
    { group: 'Behavior', trait: male ? 'Courtship' : 'Choosiness', value: male ? `display ${pct(p.behavior.display)} · appeal to females ${pct(p.behavior.appeal)}` : `choosy ${pct(p.behavior.choosiness)}: courts slowly with dull males` },
    { group: 'Behavior', trait: 'Temperament', value: `active ${Math.round(p.activity * 100)} · bold ${Math.round(p.bold * 100)} · shoaling ${Math.round(p.social * 100)}${p.health.vision ? ` · vision limited ${pct(p.health.vision)}` : ''}` },
  ];
}

const validated = new WeakSet<object>();
export function guppyGenomeProblem(value: unknown): string | null {
  if (!value || typeof value !== 'object') return 'Guppy genome must be an object.';
  if (validated.has(value)) return null;
  const genome = value as Partial<GuppyGenome>;
  if (genome.species !== 'guppy') return 'Guppy genome has the wrong species tag.';
  if (genome.version !== GUPPY_GENOME_VERSION) return `Unsupported guppy genome version ${String(genome.version)}.`;
  if (!Array.isArray(genome.maternal) || !Array.isArray(genome.paternal)) return 'Guppy genome homologs must be arrays.';
  if (genome.maternal.length !== GUPPY_LOCI.length || genome.paternal.length !== GUPPY_LOCI.length) return `Guppy genome v1 requires ${GUPPY_LOCI.length} loci per homolog.`;
  const problem = genesisProblem(genome.genesis, GUPPY_LOAD, GUPPY_LOCI.length, guppyNovelEligible, moduleAlleleCounts('guppy'));
  if (problem) return problem;
  const novel = new Map(genome.genesis!.novel.map(entry => [entry.id, entry]));
  for (let index = 0; index < GUPPY_LOCI.length; index++) {
    const entry = GUPPY_LOCUS_REGISTRY[index];
    for (const [copy, allele] of [['maternal', genome.maternal[index]], ['paternal', genome.paternal[index]]] as const) {
      if (isNovel(allele)) { if (novel.get(allele)?.locus !== index) return `Undefined novel allele at ${entry.id} (${copy}).`; continue; }
      if (!Number.isInteger(allele) || allele < 0 || allele >= entry.alleles.length) return `Invalid guppy allele at ${entry.id} (${copy}).`;
    }
  }
  // A Y on the maternal homolog would need a mother with a Y, which never exists.
  if (genome.maternal[SEX_LOCUS] >= Y_FROM) return 'A guppy cannot inherit a Y from its mother.';
  const carried = new Set([...genome.maternal, ...genome.paternal]);
  if (genome.genesis!.novel.some(entry => !carried.has(entry.id))) return 'A guppy genome lists a novel allele it does not carry.';
  validated.add(value);
  return null;
}
export function validateGuppyGenome(genome: unknown): asserts genome is GuppyGenome {
  const problem = guppyGenomeProblem(genome);
  if (problem) throw new Error(problem);
}
export const isGuppyGenome = (value: unknown): value is GuppyGenome => !!value && typeof value === 'object' && (value as { species?: unknown }).species === 'guppy' && guppyGenomeProblem(value) === null;

export function guppyFingerprint(genome: GuppyGenome): string {
  validateGuppyGenome(genome);
  const modules = genome.genesis.modules ? `|m${genome.genesis.modules.maternal.join('')}/${genome.genesis.modules.paternal.join('')}` : '';
  return `GP1-${hash(`gp1:${genome.maternal.join(',')}|${genome.paternal.join(',')}|d${genome.genesis.dev}${modules}`).toString(16).padStart(8, '0').toUpperCase()}`;
}
export function guppyHeterozygosity(genome: GuppyGenome): number {
  // The sex region of a male is hemizygous, not a measure of diversity: leave it out.
  let different = 0;
  for (let i = 0; i < genome.maternal.length; i++) if (i !== SEX_LOCUS && genome.maternal[i] !== genome.paternal[i]) different++;
  return different / (genome.maternal.length - 1);
}
