import { APPEARANCE_LOCI, CROSSOVER_RATE, DEVELOPMENT_LOCI, LOCI, MUTATION_RATE, RESEARCH_GENOME_VERSION, STRUCTURE_LOCI, type GenomeVersion, type Locus } from './catalog';
import { expressAppearance } from './appearance';
import type { InheritanceTrace } from './origins';
import { LOCUS_REGISTRY, type LocusDefinition } from './registry';
import { expressStructure } from './structure';
import { markingAnchors } from './pattern';
import { clamp, hash, random } from './random';
import {
  AXOLOTL_DEFAULT_MUTATION_RATE,
} from './axolotlCatalog';
import {
  axolotlFingerprint, axolotlHeterozygosity, expressAxolotl, inheritAxolotl, isAxolotlGenome,
  type AxolotlGenome, type AxolotlPhenotype,
} from './axolotlGenetics';
import {
  expressGoldfish, goldfishFingerprint, goldfishHeterozygosity, inheritGoldfish, isGoldfishGenome, type GoldfishGenome, type GoldfishPhenotype,
} from './goldfishGenetics';
import { GOLDFISH_DEFAULT_MUTATION_RATE } from './goldfishCatalog';
import type { CreatureGenome, Genome, Mutation, Phenotype, Species } from './types';
import { upgradeChild } from './genesis2';
import { BODY_PLAN_SET, latentModules, moduleLoci, type BodyPlanSet } from './modules';
import {
  carriedNovel, createNovel, founderLoadPair, isNovel, KOI_LOAD, KOI_SCALE, NOVEL_SHARE, novelId, novelMap, transmitLoad, type GenesisModel, type LoadCopies,
  type ModuleCopies, type NovelAllele,
} from './genesis';
import { expressKoiGenesis, koiGenesisHeterozygosity, koiNovelEligible, koiResolver } from './koiGenesis';

function weighted(rng: () => number, weights: readonly number[]): number {
  const draw = rng();
  let sum = 0;
  return weights.findIndex((weight, i) => { sum += weight; return draw < sum || i === weights.length - 1; });
}

/** One founder copy per chromosome block, with registry founder weights. */
const founderCopy = (rng: () => number, loci: readonly LocusDefinition[]) => loci.map(entry => weighted(rng, entry.alleles.map(allele => allele.founderWeight)));

/**
 * Genome v1 loci always consume the original stream, so a seed's first 48 loci never change. Genome v2 draws the
 * appended Color and Ornament chromosomes, and genome v3 the Structure chromosome, from separate streams with
 * locus-specific founder weights from the registry (FS-601).
 */
/** Research fixtures and harnesses use genome v3 by default; the live game passes GENOME_VERSION (Genesis) explicitly. */
export function founderGenome(seed: number, version: GenomeVersion = RESEARCH_GENOME_VERSION): Genome {
  const rng = random(seed), [core, appearance, structure, development] = LOCUS_BLOCKS;
  const maternal = founderCopy(rng, core), paternal = founderCopy(rng, core);
  if (version === 1) return { version, maternal, paternal };
  const stream = random(hash(`appearance-v2:founder:${seed}`));
  maternal.push(...founderCopy(stream, appearance)); paternal.push(...founderCopy(stream, appearance));
  if (version === 2) return { version, maternal, paternal };
  const structural = random(hash(`structure-v3:founder:${seed}`));
  maternal.push(...founderCopy(structural, structure)); paternal.push(...founderCopy(structural, structure));
  if (version === 3) return { version, maternal, paternal };
  // Genome v4: the Development chromosome from its own stream, plus a development seed and founder genetic load.
  const developmental = random(hash(`development-v4:founder:${seed}`));
  maternal.push(...founderCopy(developmental, development)); paternal.push(...founderCopy(developmental, development));
  const load = random(hash(`genesis:founder-load:${seed}`));
  return { version, maternal, paternal, genesis: { dev: hash(`genesis:founder-dev:${seed}`), load: founderLoadPair(load, KOI_LOAD), novel: [] } };
}

/**
 * Genome v1–v3 records carry no recorded load. When one of them parents a Genesis child, its latent load is read from its
 * genome fingerprint: deterministic, the same every time, and hidden like any carrier state.
 */
export function latentKoiLoad(genome: Genome): LoadCopies {
  if (genome.genesis) return genome.genesis.load;
  const rng = random(hash(`genesis:latent-load:${fingerprint(genome)}`));
  return founderLoadPair(rng, KOI_LOAD);
}

/** Registry blocks in genome order: v1 core loci, v2 appearance loci, v3 structure loci, v4 development loci. */
const STRUCTURE_START = LOCI.length + APPEARANCE_LOCI.length, DEVELOPMENT_START = STRUCTURE_START + STRUCTURE_LOCI.length;
const LOCUS_BLOCKS = [LOCUS_REGISTRY.slice(0, LOCI.length), LOCUS_REGISTRY.slice(LOCI.length, STRUCTURE_START), LOCUS_REGISTRY.slice(STRUCTURE_START, DEVELOPMENT_START),
  LOCUS_REGISTRY.slice(DEVELOPMENT_START, DEVELOPMENT_START + DEVELOPMENT_LOCI.length)] as const;

/**
 * Linked meiosis with per-copy mutation from the registry. The genome v1 loci of a child are identical for a seed whatever
 * the requested version, and each appended chromosome block draws from its own stream. A parent whose genome predates a
 * block transmits that block's baseline alleles, so its offspring look standard there unless a new mutation appears.
 * `mutationRate` sets the small-effect rate; registry loci with their own class (structural) keep their rate unless it is 0.
 * A `trace` receives the homolog each parent transmitted at every locus (FS-603) without changing any random draw.
 */
export function inherit(mother: Genome, father: Genome, seed: number, mutationRate?: number, version?: GenomeVersion, trace?: InheritanceTrace, model?: GenesisModel, bodyPlan?: BodyPlanSet): { genome: Genome; mutations: Mutation[] };
export function inherit(mother: AxolotlGenome, father: AxolotlGenome, seed: number, mutationRate?: number, version?: GenomeVersion, trace?: InheritanceTrace, model?: GenesisModel, bodyPlan?: BodyPlanSet): { genome: AxolotlGenome; mutations: Mutation[] };
export function inherit(mother: GoldfishGenome, father: GoldfishGenome, seed: number, mutationRate?: number, version?: GenomeVersion, trace?: InheritanceTrace, model?: GenesisModel, bodyPlan?: BodyPlanSet): { genome: GoldfishGenome; mutations: Mutation[] };
export function inherit(mother: CreatureGenome, father: CreatureGenome, seed: number, mutationRate?: number, version?: GenomeVersion, trace?: InheritanceTrace, model?: GenesisModel, bodyPlan?: BodyPlanSet): { genome: CreatureGenome; mutations: Mutation[] };
/**
 * `model` is the world's Genesis model (world v18). Model 2 runs the model 1 meiosis unchanged and then adds module genes
 * and enriches the open-ended alleles that arose in this birth (`genesis2.ts`); model 1 (the default) is exactly the
 * historical behavior, so recorded journals replay unchanged. `bodyPlan` is the world's body-plan set (world v19): set 1
 * gives goldfish no module genes, as world v18 journals recorded them.
 */
export function inherit(mother: CreatureGenome, father: CreatureGenome, seed: number, mutationRate = MUTATION_RATE, requested?: GenomeVersion, trace?: InheritanceTrace, model: GenesisModel = 1, bodyPlan: BodyPlanSet = BODY_PLAN_SET): { genome: CreatureGenome; mutations: Mutation[] } {
  const result = inheritModel1(mother, father, seed, mutationRate, requested, trace);
  if (model !== 2 || !result.genome.genesis) return result;
  // The model 1 child is not a valid genome yet when it carries model 2 (enriched) alleles, so its own species check falls
  // back to koi. Body-plan set 2 reads the species from the mother; set 1 keeps the world v18 reading so its journals replay.
  const species = bodyPlan >= 2 ? speciesOf(mother) : speciesOf(result.genome);
  const pool = new Map<number, NovelAllele>([...novelMap(mother.genesis), ...novelMap(father.genesis)]);
  const { genome } = upgradeChild(species, result.genome, modulesOf(mother), modulesOf(father), pool, seed, bodyPlan);
  return { genome, mutations: result.mutations };
}

export const speciesOf = (genome: CreatureGenome): Species => isGoldfishGenome(genome) ? 'goldfish' : isAxolotlGenome(genome) ? 'axolotl' : 'koi';
/**
 * A genome's module genes: its own under Genesis model 2, otherwise the latent genotype read from its fingerprint. A model 2
 * genome born under an older body-plan set (a goldfish from a world v18 journal) carries fewer module loci than the current
 * registry; the missing ones are read from its latent genotype, like an older founder's.
 */
export function modulesOf(genome: CreatureGenome): ModuleCopies {
  const own = genome.genesis?.modules, species = speciesOf(genome);
  if (own && own.maternal.length >= moduleLoci(species).length) return own;
  const latent = latentModules(species, fingerprint(genome));
  if (!own) return latent;
  return { maternal: [...own.maternal, ...latent.maternal.slice(own.maternal.length)], paternal: [...own.paternal, ...latent.paternal.slice(own.paternal.length)] };
}

function inheritModel1(mother: CreatureGenome, father: CreatureGenome, seed: number, mutationRate: number, requested?: GenomeVersion, trace?: InheritanceTrace): { genome: CreatureGenome; mutations: Mutation[] } {
  const motherGoldfish = isGoldfishGenome(mother), fatherGoldfish = isGoldfishGenome(father);
  if (motherGoldfish !== fatherGoldfish) throw new Error('Different species cannot produce offspring.');
  if (motherGoldfish && fatherGoldfish) {
    // Goldfish are Genesis-native: the requested koi genome version does not apply, and their own baseline rate does.
    const result = inheritGoldfish(mother, father, seed, mutationRate === MUTATION_RATE ? GOLDFISH_DEFAULT_MUTATION_RATE : mutationRate, trace);
    return { genome: result.genome, mutations: result.mutations };
  }
  // Without an explicit version a child takes genome v3 rules, or its parents' newer version (a clutch never downgrades).
  const version: GenomeVersion = requested ?? (Math.max(RESEARCH_GENOME_VERSION, (mother as Genome).genesis || (father as Genome).genesis ? 4 : 0, isAxolotlGenome(mother) ? 0 : (mother as Genome).version, isAxolotlGenome(father) ? 0 : (father as Genome).version) as GenomeVersion);
  const motherAxolotl = isAxolotlGenome(mother), fatherAxolotl = isAxolotlGenome(father);
  if (motherAxolotl !== fatherAxolotl) throw new Error('Different species cannot produce offspring.');
  if (motherAxolotl && fatherAxolotl) {
    // Normal shared breeding passes the koi default; axolotls retain their own species-local baseline mutation rate.
    const rate = mutationRate === MUTATION_RATE ? AXOLOTL_DEFAULT_MUTATION_RATE : mutationRate;
    // The koi genome version doubles as the clutch's generation of rules: genome v4 (Genesis) asks for axolotl genome v2.
    const result = inheritAxolotl(mother, father, seed, rate, trace, version >= 4 ? 2 : 1);
    return { genome: result.genome, mutations: result.mutations };
  }
  const koiMother = mother as Genome, koiFather = father as Genome;
  if (mutationRate < 0 || mutationRate > 1 || !Number.isFinite(mutationRate)) throw new Error('Invalid mutation rate.');
  if (version < Math.max(koiMother.version, koiFather.version)) throw new Error(`Genome v${Math.max(koiMother.version, koiFather.version)} parents cannot produce a genome v${version} child.`);
  const mutations: Mutation[] = [];
  const genesis = version === 4;
  // Genesis: novel-allele decisions and load use their own streams, so the shared loci draw exactly as in genome v3.
  const pool = new Map<number, NovelAllele>([...novelMap(koiMother.genesis), ...novelMap(koiFather.genesis)]);
  const sides: Record<Mutation['copy'], (0 | 1)[]> = { maternal: [], paternal: [] };
  const novelRng = genesis ? random(hash(`genesis:novel-choice:${seed}`)) : null;
  const transmit = (rng: () => number, loci: readonly LocusDefinition[], parent: Genome, copy: Mutation['copy']) => {
    let side: 0 | 1 = 0;
    return loci.map((entry, i) => {
      if (i % 6 === 0) side = rng() < 0.5 ? 0 : 1;
      else if (rng() < CROSSOVER_RATE) side = side ? 0 : 1;
      trace?.[copy].push(side);
      sides[copy].push(side);
      const from = parent.version < entry.sinceGenome ? entry.baseline! : (side === 0 ? parent.maternal : parent.paternal)[entry.index];
      const rate = entry.mutationRate === MUTATION_RATE || mutationRate === 0 ? mutationRate : entry.mutationRate;
      if (rng() >= rate) return from;
      if (isNovel(from)) {
        // An open-ended allele mutates again: a quarter revert to the nearest catalog allele, the rest become derived alleles.
        const parentAllele = pool.get(from)!, choice = novelRng ?? rng;
        if (choice() < 0.25) {
          const to = Math.round(Math.min(5, Math.max(0, parentAllele.value)));
          mutations.push({ locus: entry.index, copy, from, to });
          return to;
        }
        const created = createNovel(choice, novelId(seed, copy, entry.index), entry.index, from, { value: parentAllele.value, potency: parentAllele.potency, novel: parentAllele }, KOI_SCALE);
        pool.set(created.id, created);
        mutations.push({ locus: entry.index, copy, from, to: created.id });
        return created.id;
      }
      const targets = entry.alleles[from].mutationTargets;
      const to = targets.length === 1 ? targets[0].allele : targets[weighted(rng, targets.map(target => target.weight))].allele;
      if (novelRng && koiNovelEligible(entry.index) && novelRng() < NOVEL_SHARE) {
        const created = createNovel(novelRng, novelId(seed, copy, entry.index), entry.index, from, koiResolver({ version: 4, maternal: [], paternal: [] }).catalog(entry.index, from), KOI_SCALE);
        pool.set(created.id, created);
        mutations.push({ locus: entry.index, copy, from, to: created.id });
        return created.id;
      }
      mutations.push({ locus: entry.index, copy, from, to });
      return to;
    });
  };
  const [core, appearance, structure, development] = LOCUS_BLOCKS;
  const rng = random(seed);
  const maternal = transmit(rng, core, koiMother, 'maternal');
  const paternal = transmit(rng, core, koiFather, 'paternal');
  if (version === 1) return { genome: { version, maternal, paternal }, mutations };
  const stream = random(hash(`appearance-v2:birth:${seed}`));
  maternal.push(...transmit(stream, appearance, koiMother, 'maternal'));
  paternal.push(...transmit(stream, appearance, koiFather, 'paternal'));
  if (version === 2) return { genome: { version, maternal, paternal }, mutations };
  const structural = random(hash(`structure-v3:birth:${seed}`));
  maternal.push(...transmit(structural, structure, koiMother, 'maternal'));
  paternal.push(...transmit(structural, structure, koiFather, 'paternal'));
  if (version === 3) return { genome: { version, maternal, paternal }, mutations };
  const developmental = random(hash(`development-v4:birth:${seed}`));
  maternal.push(...transmit(developmental, development, koiMother, 'maternal'));
  paternal.push(...transmit(developmental, development, koiFather, 'paternal'));
  // Load sites travel with the homolog transmitted at their anchor locus, so they are linked to visible traits.
  const loadRng = random(hash(`genesis:load:${seed}`));
  const load = { maternal: transmitLoad(latentKoiLoad(koiMother), sides.maternal, KOI_LOAD, loadRng), paternal: transmitLoad(latentKoiLoad(koiFather), sides.paternal, KOI_LOAD, loadRng) };
  return { genome: { version, maternal, paternal, genesis: { dev: hash(`genesis:dev:${seed}`), load, novel: carriedNovel(maternal, paternal, pool) } }, mutations };
}

function axolotlCompatibilityPhenotype(axolotl: AxolotlPhenotype): Phenotype {
  const m = axolotl.morphology, p = axolotl.pigmentation, pattern = axolotl.pattern;
  const bodyHue = p.bodyColor.h / 360;
  return {
    species: 'axolotl', axolotl,
    length: m.body.length, depth: m.body.depth, taper: m.body.taper * 0.25, curve: m.body.flex,
    head: m.head.length, snout: m.head.snoutRoundness * 0.12,
    eye: m.eyes.size, eyePosition: m.eyes.height, iris: p.irisColor.h, pupil: m.eyes.pupilRatio,
    mouth: m.head.mouthWidth, barbel: 0,
    tail: m.tail.length, spread: m.tail.height, fork: 0, dorsal: m.tail.finHeight,
    pectoral: (m.limbs.foreLength + m.limbs.hindLength) / 2, finPigment: p.melanin,
    red: clamp(1 - Math.abs(bodyHue - 0.02) * 2), yellow: p.xanthophore, black: p.melanin, white: 1 - p.melanin,
    metallic: p.iridophore, translucency: p.translucency,
    frequency: 3 + Math.round(pattern.density * 13), patternScale: pattern.scale, warp: m.tail.wave,
    symmetry: pattern.symmetry, edge: pattern.edge, speckle: pattern.density,
    adultLengthCm: axolotl.adultLengthCm, growth: axolotl.growth, longevity: axolotl.longevity,
    metabolism: axolotl.metabolism, oxygen: axolotl.oxygen, fertility: axolotl.fertility,
    speed: axolotl.speed, turning: axolotl.turning, activity: axolotl.activity, social: axolotl.social,
    bold: axolotl.bold, curious: axolotl.curious,
    markings: [],
    // Compatibility-only neutral koi surfaces. Species-specific UI/rendering never interprets these as axolotl loci.
    appearance: { base: ['classic'], accent: ['classic'], dots: ['ink'], iris: ['natural'], shimmer: p.iridescence, scales: 'smooth', patches: 0, motifs: [], density: pattern.density, motifScale: pattern.scale, contrast: pattern.contrast, reach: 0, finMotifs: [] },
    structure: { tail: 'standard', lobeBalance: 1, spread: 0, dorsal: 'normal', barbels: 0, rays: 1 },
    // Genesis (axolotl genome v2): life history, load and development read through the shared phenotype too.
    ...(axolotl.genesis ? { genesis: axolotl.genesis } : {}),
  };
}

/**
 * Goldfish read through the shared phenotype for motion, life, care and the compatibility surfaces; the renderer, names,
 * shows and buyers read the independent goldfish phenotype in `goldfish`.
 */
function goldfishCompatibilityPhenotype(goldfish: GoldfishPhenotype): Phenotype {
  const b = goldfish.body, c = goldfish.color, t = goldfish.tail;
  return {
    species: 'goldfish', goldfish,
    length: b.length, depth: b.depth, taper: 0.1, curve: 0, head: 0.2 + goldfish.head.hood * 0.06, snout: goldfish.head.snout * 0.05,
    eye: goldfish.eyes.size, eyePosition: 0.3, iris: goldfish.eyes.iris.h, pupil: 0.55, mouth: goldfish.head.mouth * 0.05, barbel: 0,
    tail: 0.3 * goldfish.fins.length, spread: t.spread, fork: t.fork, dorsal: goldfish.fins.dorsal === 'full' ? goldfish.fins.dorsalHeight : 0,
    pectoral: 0.12 * goldfish.fins.length, finPigment: goldfish.color.finTint,
    red: clamp(1 - Math.abs(c.body.h - 10) / 40) * (1 - c.whiteShare), yellow: clamp((c.body.h - 20) / 30), black: c.darkAmount, white: c.whiteShare,
    metallic: goldfish.scales.reflectivity, translucency: goldfish.scales.type === 'metallic' ? 0 : 0.2,
    frequency: 3 + Math.round(goldfish.pattern.coverage * 10), patternScale: goldfish.pattern.scale, warp: 0,
    symmetry: goldfish.pattern.symmetry, edge: goldfish.pattern.edge, speckle: goldfish.scales.sparkle,
    adultLengthCm: goldfish.adultLengthCm, growth: goldfish.growth, longevity: goldfish.longevity,
    metabolism: goldfish.metabolism, oxygen: goldfish.oxygen, fertility: goldfish.fertility,
    speed: goldfish.speed, turning: goldfish.turning, activity: goldfish.activity, social: goldfish.social,
    bold: goldfish.bold, curious: goldfish.curious,
    markings: [],
    // Compatibility-only neutral koi surfaces. Species-specific UI and rendering never read these as goldfish loci.
    appearance: { base: ['classic'], accent: ['classic'], dots: ['ink'], iris: ['natural'], shimmer: goldfish.scales.reflectivity, scales: 'smooth', patches: 0, motifs: [], density: goldfish.pattern.coverage, motifScale: goldfish.pattern.scale, contrast: 0.5, reach: 0, finMotifs: [] },
    structure: { tail: 'standard', lobeBalance: 1, spread: 0, dorsal: 'normal', barbels: 0, rays: 1 },
    genesis: goldfish.genesis,
  };
}

const genesisCache = new WeakMap<object, Phenotype>();

/**
 * Development v3: adult genetic potential, inherited marking anchors and appearance; age/environment come later.
 * Genome v4 (Genesis) and axolotl genome v2 read the same body through dominance-aware levels and add development v6
 * traits; their phenotypes are memoized per genome object because life, breeding and pricing read them every day.
 */
export function express(genome: CreatureGenome): Phenotype {
  if ((genome as Genome).genesis) {
    const cached = genesisCache.get(genome);
    if (cached) return cached;
    const phenotype = isGoldfishGenome(genome) ? goldfishCompatibilityPhenotype(expressGoldfish(genome))
      : isAxolotlGenome(genome) ? axolotlCompatibilityPhenotype(expressAxolotl(genome)) : expressKoiGenesis(genome as Genome, koiCore);
    genesisCache.set(genome, phenotype);
    return phenotype;
  }
  if (isAxolotlGenome(genome)) return axolotlCompatibilityPhenotype(expressAxolotl(genome));
  const koi = genome as Genome;
  const g = (name: Locus) => {
    const i = LOCI.indexOf(name);
    return (koi.maternal[i] + koi.paternal[i]) / 10;
  };
  const recessive = (name: Locus) => {
    const i = LOCI.indexOf(name);
    return koi.maternal[i] === 5 && koi.paternal[i] === 5;
  };
  return { ...koiCore(g, recessive), markings: markingAnchors(koi), appearance: expressAppearance(koi), structure: expressStructure(koi) };
}

/** The shared koi body from expressed levels (0–1 per locus). Genome v1–v3 pass (maternal + paternal) / 10. */
function koiCore(g: (name: Locus) => number, recessive: (name: Locus) => boolean): Omit<Phenotype, 'markings' | 'appearance' | 'structure'> {
  const fin = 0.65 + g('fin_gain') * 0.7;
  const pigment = 0.65 + g('pigment_gain') * 0.7;
  const tail = (0.14 + g('tail_length') * 0.62) * fin;
  const depth = 0.12 + g('body_depth') * 0.48;
  const length = 0.7 + g('body_length') * 0.9;
  const adultLengthCm = 22 + 76 * (0.45 * g('size_1') + 0.35 * g('size_2') + 0.2 * g('body_length'));
  return {
    length, depth, taper: 0.08 + g('body_taper') * 0.2, curve: (g('spine_curve') - 0.5) * 0.2,
    head: 0.13 + g('head_length') * (0.15 + g('head_gain') * 0.16), snout: 0.015 + g('snout_length') * 0.12,
    eye: 0.015 + g('eye_size') * 0.045, eyePosition: 0.1 + g('eye_position') * 0.45,
    iris: 35 + g('iris_hue') * 210, pupil: 0.35 + g('pupil_size') * 0.5,
    mouth: 0.015 + g('mouth_size') * 0.075, barbel: 0.015 + g('barbel_length') * 0.18,
    tail, spread: 0.12 + g('tail_spread') * 0.42, fork: g('tail_fork') * 0.75,
    dorsal: (0.035 + g('dorsal_height') * 0.24) * fin, pectoral: (0.06 + g('pectoral_length') * 0.26) * fin,
    finPigment: g('fin_pigment'), red: clamp(g('red') * pigment), yellow: g('yellow'),
    black: recessive('melanin_switch') ? 0 : clamp(g('black') * pigment), white: g('white'),
    metallic: recessive('metallic_switch') ? 1 : g('reflectivity') * 0.45,
    translucency: g('translucency') * 0.35, frequency: 3 + Math.round(g('pattern_frequency') * 13),
    patternScale: 0.05 + g('pattern_scale') * 0.15, warp: g('pattern_warp'), symmetry: g('pattern_symmetry'),
    edge: g('pattern_edge'), speckle: g('speckle'), adultLengthCm,
    growth: 0.5 + g('growth_rate'), longevity: 8 + 24 * g('longevity'), metabolism: 0.6 + g('metabolism'),
    oxygen: (0.6 + g('oxygen_demand')) * (adultLengthCm / 50) ** 2 * (1 + tail * 0.3),
    fertility: 0.3 + 0.6 * g('fertility'),
    speed: (0.035 + g('thrust') * 0.055) / (1 + tail * 0.7 + depth * 0.35),
    turning: 0.7 + g('turning') * 1.4, activity: g('activity'), social: g('sociability'), bold: g('boldness'), curious: g('curiosity'),
  };
}

/**
 * Size and metabolic potential from genome v1 loci using basic arithmetic only: cheap enough for every simulation advance
 * and identical on every browser. Values match express() for adult length and metabolism.
 */
export function metabolicPotential(genome: CreatureGenome): { adultLengthCm: number; metabolism: number; oxygenDemand: number; growth: number; longevityYears: number; fertility: number } {
  if ((genome as Genome).genesis) {
    // Genesis potentials include dominance, trade-offs, load and vigor, so they come from the memoized phenotype.
    const p = express(genome);
    return { adultLengthCm: p.adultLengthCm, metabolism: p.metabolism, oxygenDemand: p.genesis!.oxygenDemand, growth: p.growth, longevityYears: p.longevity, fertility: p.fertility };
  }
  if (isAxolotlGenome(genome)) {
    const p = expressAxolotl(genome);
    return { adultLengthCm: p.adultLengthCm, metabolism: p.metabolism, oxygenDemand: p.oxygen, growth: p.growth, longevityYears: p.longevity, fertility: p.fertility };
  }
  const koi = genome as Genome;
  const g = (name: Locus) => {
    const i = LOCI.indexOf(name);
    return (koi.maternal[i] + koi.paternal[i]) / 10;
  };
  const tail = (0.14 + g('tail_length') * 0.62) * (0.65 + g('fin_gain') * 0.7);
  return {
    adultLengthCm: 22 + 76 * (0.45 * g('size_1') + 0.35 * g('size_2') + 0.2 * g('body_length')),
    metabolism: 0.6 + g('metabolism'),
    /** Relative oxygen need from the oxygen_demand locus and tail drag, about 0.6–2.3. */
    oxygenDemand: (0.6 + g('oxygen_demand')) * (1 + tail * 0.3),
    /** Growth-rate multiplier, 0.5–1.5. */
    growth: 0.5 + g('growth_rate'),
    /** Potential lifespan in game years, 8–32. */
    longevityYears: 8 + 24 * g('longevity'),
    /** Courtship readiness, 0.3–0.9; matches express() fertility (FS-401). */
    fertility: 0.3 + 0.6 * g('fertility'),
  };
}

/** Model 2 genomes add their module genes to the fingerprint; model 1 fingerprints are unchanged. */
export const moduleTail = (modules: ModuleCopies | undefined) => modules ? `|m${modules.maternal.join('')}/${modules.paternal.join('')}` : '';

export function fingerprint(genome: CreatureGenome): string {
  if (isGoldfishGenome(genome)) return goldfishFingerprint(genome);
  if (isAxolotlGenome(genome)) return axolotlFingerprint(genome);
  const tail = genome.genesis ? `|d${genome.genesis.dev}${moduleTail(genome.genesis.modules)}` : '';
  return hash(`g${genome.version}:${genome.maternal.join(',')}|${genome.paternal.join(',')}${tail}`).toString(16).padStart(8, '0').toUpperCase();
}

/** Share of carried loci that are heterozygous; genome v1 fish are assayed over their 48 loci. */
export function heterozygosity(genome: CreatureGenome): number {
  if (isGoldfishGenome(genome)) return goldfishHeterozygosity(genome);
  if (isAxolotlGenome(genome)) return axolotlHeterozygosity(genome);
  if (genome.genesis) return koiGenesisHeterozygosity(genome);
  return genome.maternal.filter((allele, i) => allele !== genome.paternal[i]).length / genome.maternal.length;
}
