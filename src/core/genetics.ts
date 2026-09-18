import { APPEARANCE_LOCI, CROSSOVER_RATE, GENOME_VERSION, LOCI, MUTATION_RATE, type GenomeVersion, type Locus } from './catalog';
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
import type { CreatureGenome, Genome, Mutation, Phenotype } from './types';

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
export function founderGenome(seed: number, version: GenomeVersion = GENOME_VERSION): Genome {
  const rng = random(seed), [core, appearance, structure] = LOCUS_BLOCKS;
  const maternal = founderCopy(rng, core), paternal = founderCopy(rng, core);
  if (version === 1) return { version, maternal, paternal };
  const stream = random(hash(`appearance-v2:founder:${seed}`));
  maternal.push(...founderCopy(stream, appearance)); paternal.push(...founderCopy(stream, appearance));
  if (version === 2) return { version, maternal, paternal };
  const structural = random(hash(`structure-v3:founder:${seed}`));
  maternal.push(...founderCopy(structural, structure)); paternal.push(...founderCopy(structural, structure));
  return { version, maternal, paternal };
}

/** Registry blocks in genome order: v1 core loci, v2 appearance loci, v3 structure loci. */
const LOCUS_BLOCKS = [LOCUS_REGISTRY.slice(0, LOCI.length), LOCUS_REGISTRY.slice(LOCI.length, LOCI.length + APPEARANCE_LOCI.length), LOCUS_REGISTRY.slice(LOCI.length + APPEARANCE_LOCI.length)] as const;

/**
 * Linked meiosis with per-copy mutation from the registry. The genome v1 loci of a child are identical for a seed whatever
 * the requested version, and each appended chromosome block draws from its own stream. A parent whose genome predates a
 * block transmits that block's baseline alleles, so its offspring look standard there unless a new mutation appears.
 * `mutationRate` sets the small-effect rate; registry loci with their own class (structural) keep their rate unless it is 0.
 * A `trace` receives the homolog each parent transmitted at every locus (FS-603) without changing any random draw.
 */
export function inherit(mother: Genome, father: Genome, seed: number, mutationRate?: number, version?: GenomeVersion, trace?: InheritanceTrace): { genome: Genome; mutations: Mutation[] };
export function inherit(mother: AxolotlGenome, father: AxolotlGenome, seed: number, mutationRate?: number, version?: GenomeVersion, trace?: InheritanceTrace): { genome: AxolotlGenome; mutations: Mutation[] };
export function inherit(mother: CreatureGenome, father: CreatureGenome, seed: number, mutationRate?: number, version?: GenomeVersion, trace?: InheritanceTrace): { genome: CreatureGenome; mutations: Mutation[] };
export function inherit(mother: CreatureGenome, father: CreatureGenome, seed: number, mutationRate = MUTATION_RATE, version: GenomeVersion = GENOME_VERSION, trace?: InheritanceTrace): { genome: CreatureGenome; mutations: Mutation[] } {
  const motherAxolotl = isAxolotlGenome(mother), fatherAxolotl = isAxolotlGenome(father);
  if (motherAxolotl !== fatherAxolotl) throw new Error('Different species cannot produce offspring.');
  if (motherAxolotl && fatherAxolotl) {
    // Normal shared breeding passes the koi default; axolotls retain their own species-local baseline mutation rate.
    const rate = mutationRate === MUTATION_RATE ? AXOLOTL_DEFAULT_MUTATION_RATE : mutationRate;
    const result = inheritAxolotl(mother, father, seed, rate, trace);
    return { genome: result.genome, mutations: result.mutations };
  }
  const koiMother = mother as Genome, koiFather = father as Genome;
  if (mutationRate < 0 || mutationRate > 1 || !Number.isFinite(mutationRate)) throw new Error('Invalid mutation rate.');
  if (version < Math.max(koiMother.version, koiFather.version)) throw new Error(`Genome v${Math.max(koiMother.version, koiFather.version)} parents cannot produce a genome v${version} child.`);
  const mutations: Mutation[] = [];
  const transmit = (rng: () => number, loci: readonly LocusDefinition[], parent: Genome, copy: Mutation['copy']) => {
    let side: 0 | 1 = 0;
    return loci.map((entry, i) => {
      if (i % 6 === 0) side = rng() < 0.5 ? 0 : 1;
      else if (rng() < CROSSOVER_RATE) side = side ? 0 : 1;
      trace?.[copy].push(side);
      const from = parent.version < entry.sinceGenome ? entry.baseline! : (side === 0 ? parent.maternal : parent.paternal)[entry.index];
      const rate = entry.mutationRate === MUTATION_RATE || mutationRate === 0 ? mutationRate : entry.mutationRate;
      if (rng() >= rate) return from;
      const targets = entry.alleles[from].mutationTargets;
      const to = targets.length === 1 ? targets[0].allele : targets[weighted(rng, targets.map(target => target.weight))].allele;
      mutations.push({ locus: entry.index, copy, from, to });
      return to;
    });
  };
  const [core, appearance, structure] = LOCUS_BLOCKS;
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
  return { genome: { version, maternal, paternal }, mutations };
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
  };
}

/** Development v3: adult genetic potential, inherited marking anchors and appearance; age/environment come later. */
export function express(genome: CreatureGenome): Phenotype {
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
    markings: markingAnchors(koi),
    appearance: expressAppearance(koi),
    structure: expressStructure(koi),
  };
}

/**
 * Size and metabolic potential from genome v1 loci using basic arithmetic only: cheap enough for every simulation advance
 * and identical on every browser. Values match express() for adult length and metabolism.
 */
export function metabolicPotential(genome: CreatureGenome): { adultLengthCm: number; metabolism: number; oxygenDemand: number; growth: number; longevityYears: number; fertility: number } {
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

export function fingerprint(genome: CreatureGenome): string {
  if (isAxolotlGenome(genome)) return axolotlFingerprint(genome);
  return hash(`g${genome.version}:${genome.maternal.join(',')}|${genome.paternal.join(',')}`).toString(16).padStart(8, '0').toUpperCase();
}

/** Share of carried loci that are heterozygous; genome v1 fish are assayed over their 48 loci. */
export function heterozygosity(genome: CreatureGenome): number {
  if (isAxolotlGenome(genome)) return axolotlHeterozygosity(genome);
  return genome.maternal.filter((allele, i) => allele !== genome.paternal[i]).length / genome.maternal.length;
}
