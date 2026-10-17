import { expressAppearance } from './appearance';
import { APPEARANCE_LOCI, GENOME_LOCI, LOCI, STRUCTURE_LOCI, type DevelopmentLocus, type GenomeLocus } from './catalog';
import {
  channelEffects, combine, defectsFor, developmentNoise, founderPotency, isNovel, KOI_LOAD, novelMap, vigorFor,
  type Channel, type DominanceClass, type GenesisTraits, type Resolved,
} from './genesis';
import { expressModules, somaticFor } from './modules';
import { markingAnchors } from './pattern';
import { clamp } from './random';
import { expressStructure } from './structure';
import type { Genome, Phenotype } from './types';

/**
 * Koi genome v4 (Genesis): development v6 expression. Chromosomes 1–11 keep their loci and founder streams; what changes
 * is how a genotype is read. Quantitative loci use potency-weighted dominance instead of averaging, carry open-ended
 * alleles, and feed pleiotropic trade-offs. Chromosome 12 (Development) adds epistatic switches and life history.
 * Genome v1–v3 fish never pass through this file, so their appearance and behavior stay exactly as recorded.
 */
export const DEVELOPMENT_OFFSET = LOCI.length + APPEARANCE_LOCI.length + STRUCTURE_LOCI.length;
/** Older genomes are read as homozygous for these, in DEVELOPMENT_LOCI order: functional pigment, standard fins, no glow. */
export const DEVELOPMENT_BASELINE: readonly number[] = [3, 0, 3, 0, 2, 2];
export const DEVELOPMENT_FOUNDER_WEIGHTS: Record<DevelopmentLocus, readonly number[]> = {
  // ~11% of founder copies are null or weak: ghosts (two such copies) appear in about 1 founder in 80, carriers in 1 in 5.
  pigment_cascade: [0.055, 0.055, 0.3, 0.32, 0.2, 0.07],
  // The veil allele is dominant and rare; butterfly fins need two copies.
  fin_program: [0.3, 0.3, 0.25, 0.115, 0.03, 0.005],
  canalization: [0.06, 0.14, 0.3, 0.3, 0.14, 0.06],
  // Photophore alleles show faintly with one copy and fully with two.
  glow: [0.4, 0.3, 0.2, 0.077, 0.018, 0.005],
  maturity_timing: [0.1, 0.22, 0.32, 0.24, 0.1, 0.02],
  regeneration: [0.12, 0.24, 0.3, 0.2, 0.1, 0.04],
};
export const DEVELOPMENT_ALLELE_LABELS: Record<DevelopmentLocus, readonly string[]> = {
  pigment_cascade: ['null cascade', 'weak cascade', 'functional', 'functional+', 'strong', 'super-pigment'],
  fin_program: ['standard', 'standard', 'standard', 'standard', 'veil', 'veil (strong)'],
  canalization: ['level 0', 'level 1', 'level 2', 'level 3', 'level 4', 'level 5'],
  glow: ['dark', 'dark', 'dark', 'dark', 'photophore', 'radiant'],
  maturity_timing: ['late', 'level 1', 'level 2', 'level 3', 'level 4', 'early'],
  regeneration: ['level 0', 'level 1', 'level 2', 'level 3', 'level 4', 'level 5'],
};

/**
 * Dominance class of each quantitative koi locus. Loci without an entry follow their own categorical rules (colors,
 * motifs, scale types, topology, switches) and never receive open-ended alleles.
 */
export const KOI_DOMINANCE: Partial<Record<GenomeLocus, DominanceClass>> = {
  body_length: 'up', body_depth: 'down', body_taper: 'additive', spine_curve: 'additive', head_length: 'additive', snout_length: 'down',
  eye_size: 'down', eye_position: 'additive', iris_hue: 'additive', pupil_size: 'additive', mouth_size: 'additive', barbel_length: 'up',
  tail_length: 'up', tail_spread: 'additive', tail_fork: 'down', dorsal_height: 'up', pectoral_length: 'additive', fin_pigment: 'up',
  red: 'up', yellow: 'additive', black: 'up', white: 'down', reflectivity: 'additive', translucency: 'down',
  pattern_frequency: 'up', pattern_scale: 'additive', pattern_warp: 'additive', pattern_symmetry: 'down', pattern_edge: 'additive', speckle: 'down',
  size_1: 'up', growth_rate: 'up', longevity: 'over', metabolism: 'down', oxygen_demand: 'additive', fertility: 'over',
  thrust: 'additive', turning: 'additive', activity: 'up', sociability: 'additive', boldness: 'up', curiosity: 'down',
  size_2: 'additive', pigment_gain: 'up', fin_gain: 'up', head_gain: 'additive',
  shimmer: 'up', motif_density: 'additive', motif_scale: 'additive', motif_contrast: 'up', motif_reach: 'additive',
  lobe_balance: 'additive', topology_spread: 'additive', fin_ray_density: 'up',
  canalization: 'up', maturity_timing: 'additive', regeneration: 'up',
};
export const koiNovelEligible = (index: number) => KOI_DOMINANCE[GENOME_LOCI[index]] !== undefined;
/** Heterozygote bonus per level of difference at overdominant loci. */
const OVER_BONUS = 0.18;

export type KoiResolver = {
  pair: (index: number) => [Resolved, Resolved];
  /** A catalog allele read under its locus' dominance class. */
  catalog: (index: number, allele: number) => Resolved;
  /** Expressed level of a quantitative locus, 0–1 for catalog alleles and slightly beyond for novel ones. */
  g: (name: GenomeLocus) => number;
  ids: (name: GenomeLocus) => [number, number];
};

export function koiResolver(genome: Genome): KoiResolver {
  const pool = novelMap(genome.genesis);
  const resolve = (index: number, allele: number): Resolved => {
    const novel = isNovel(allele) ? pool.get(allele) ?? null : null;
    if (novel) return { value: novel.value, potency: novel.potency, novel };
    return { value: allele, potency: founderPotency(KOI_DOMINANCE[GENOME_LOCI[index]] ?? 'additive', allele), novel: null };
  };
  const pair = (index: number): [Resolved, Resolved] => [resolve(index, genome.maternal[index]), resolve(index, genome.paternal[index])];
  return {
    pair,
    catalog: (index, allele) => ({ value: allele, potency: founderPotency(KOI_DOMINANCE[GENOME_LOCI[index]] ?? 'additive', allele), novel: null }),
    ids: name => { const i = GENOME_LOCI.indexOf(name); return [genome.maternal[i], genome.paternal[i]]; },
    g: name => {
      const i = GENOME_LOCI.indexOf(name), [a, b] = pair(i);
      return clamp(combine(a, b, KOI_DOMINANCE[name] ?? 'additive', OVER_BONUS) / 5, -0.1, 1.15);
    },
  };
}

/** The nearest catalog allele for a novel one; categorical rules then read a valid genome v3 view. */
function projected(genome: Genome): Genome {
  const pool = novelMap(genome.genesis), length = LOCI.length + APPEARANCE_LOCI.length + STRUCTURE_LOCI.length;
  const map = (copy: number[]) => copy.slice(0, length).map(allele => isNovel(allele) ? Math.round(clamp(pool.get(allele)?.value ?? 2, 0, 5)) : allele);
  return { version: 3, maternal: map(genome.maternal), paternal: map(genome.paternal) };
}

/** Share of the 72 loci whose two copies express differently. */
export function koiGenesisHeterozygosity(genome: Genome): number {
  const { pair } = koiResolver(genome);
  let different = 0;
  for (let i = 0; i < GENOME_LOCI.length; i++) {
    const [a, b] = pair(i);
    if (genome.maternal[i] !== genome.paternal[i] && Math.abs(a.value - b.value) > 0.01) different++;
  }
  return different / GENOME_LOCI.length;
}

const count = (ids: [number, number], test: (allele: number) => boolean) => Number(test(ids[0])) + Number(test(ids[1]));

/**
 * Genome v4 → phenotype. `core` builds the shared koi body from a level reader (the same formulas as genome v1–v3);
 * this function supplies dominance-aware levels and then applies the development chromosome, novel side effects,
 * developmental noise, genetic load and hybrid vigor.
 */
export function expressKoiGenesis(genome: Genome, core: (g: (name: GenomeLocus) => number, recessive: (name: GenomeLocus) => boolean) => Omit<Phenotype, 'markings' | 'appearance' | 'structure'>): Phenotype {
  const block = genome.genesis!, resolver = koiResolver(genome), { g, ids } = resolver;
  const recessive = (name: GenomeLocus) => { const [a, b] = ids(name); return a === 5 && b === 5; };
  const view = projected(genome);
  const p: Phenotype = { ...core(g, recessive), markings: markingAnchors(genome), appearance: expressAppearance(view), structure: expressStructure(view) };
  // Relative oxygen need per unit of size, so size changes below rescale respiration consistently.
  let oxygenDemand = p.oxygen / (p.adultLengthCm / 50) ** 2;
  // Dominance-aware levels for the additive appearance and structure loci.
  p.appearance = {
    ...p.appearance, shimmer: clamp(g('shimmer'), 0, 1.1), density: clamp(g('motif_density')), motifScale: clamp(g('motif_scale')),
    contrast: 0.55 + 0.45 * clamp(g('motif_contrast')), reach: clamp(g('motif_reach')),
  };
  p.structure = { ...p.structure, lobeBalance: 1 + (clamp(g('lobe_balance')) - 0.4) * 0.5, spread: clamp(g('topology_spread')), rays: 1 + (clamp(g('fin_ray_density')) - 0.4) * 0.6 };

  // Chromosome 12. Pigment cascade: two null or weak copies silence every color locus (epistasis); the colors stay hidden.
  const cascade = ids('pigment_cascade'), weak = count(cascade, allele => allele <= 1);
  const ghost = weak === 2 ? (cascade[0] === 0 && cascade[1] === 0 ? 1 : 0.62) : 0;
  const superPigment = count(cascade, allele => allele === 5) === 2 ? 0.14 : 0;
  // Fin program: one veil copy gives veil fins (dominant), two give butterfly fins.
  const veilCopies = count(ids('fin_program'), allele => allele >= 4);
  const fins: GenesisTraits['fins'] = veilCopies === 0 ? 'standard' : veilCopies === 1 ? 'veil' : 'butterfly';
  const canalization = clamp(g('canalization'));
  const glowIds = ids('glow'), glowCopies = count(glowIds, allele => allele >= 4);
  let glow = glowCopies === 0 ? 0 : glowCopies === 1 ? (Math.max(...glowIds) === 5 ? 0.34 : 0.22) : (glowIds[0] === 5 && glowIds[1] === 5 ? 1 : 0.76);
  const regeneration = clamp(0.15 + 0.8 * g('regeneration'));

  // Novel allele side effects across every locus.
  const effects = channelEffects(GENOME_LOCI.map((_, i) => resolver.pair(i)));
  const e = (channel: keyof typeof effects) => effects[channel] ?? 0;
  glow = clamp(glow + Math.max(0, e('glow')) * 1.4);

  // Development noise, narrowed by canalization.
  const noise = developmentNoise(block.dev), amplitude = 0.012 + 0.085 * (1 - canalization);
  const jitter = () => 1 + amplitude * noise();
  p.length *= jitter(); p.depth *= jitter(); p.tail *= jitter(); p.dorsal *= jitter(); p.pectoral *= jitter(); p.head *= jitter(); p.eye *= jitter();
  p.spread *= jitter();
  p.red = clamp(p.red * (1 + amplitude * 0.6 * noise())); p.black = clamp(p.black * (1 + amplitude * 0.6 * noise()));
  const asymmetry = amplitude * (0.5 + 0.5 * Math.abs(noise()));
  p.structure = { ...p.structure, lobeBalance: clamp(p.structure.lobeBalance + amplitude * 0.9 * noise(), 0.75, 1.35) };

  // Epistasis and trade-offs.
  if (ghost) {
    p.red *= 1 - 0.93 * ghost; p.yellow *= 1 - 0.85 * ghost; p.black *= 1 - 0.95 * ghost; p.finPigment *= 1 - 0.9 * ghost;
    p.white = clamp(p.white + 0.5 * ghost); p.translucency = clamp(p.translucency + 0.22 * ghost, 0, 0.6);
    p.appearance = { ...p.appearance, patches: p.appearance.patches * (1 - 0.88 * ghost), shimmer: p.appearance.shimmer * (1 - 0.5 * ghost),
      motifs: p.appearance.motifs.map(m => ({ ...m, strength: m.strength * (1 - 0.82 * ghost) })), finMotifs: p.appearance.finMotifs.map(m => ({ ...m, strength: m.strength * (1 - 0.82 * ghost) })) };
  } else if (superPigment) {
    p.red = clamp(p.red * (1 + superPigment)); p.black = clamp(p.black * (1 + superPigment));
  }
  const finScale = 1 + e('fins') * 0.8;
  if (fins !== 'standard') {
    const veil = fins === 'veil';
    p.tail *= veil ? 1.28 : 1.52; p.dorsal *= veil ? 1.35 : 1.62; p.pectoral *= veil ? 1.3 : 1.55;
    p.fork *= veil ? 0.55 : 0.25; p.spread *= veil ? 1.1 : 1.22;
  }
  p.tail *= finScale; p.dorsal *= finScale; p.pectoral *= finScale;
  p.speed /= 1 + 0.18 * veilCopies; oxygenDemand *= 1 + 0.1 * veilCopies;
  p.metabolism += 0.12 * glow + e('metabolism');
  p.adultLengthCm *= clamp(1 + e('size') * 0.6, 0.6, 1.4);
  p.speed *= clamp(1 + e('speed'), 0.5, 1.5);
  p.bold = clamp(p.bold + e('boldness'));
  p.growth = Math.max(0.3, p.growth + e('growth'));
  p.fertility = clamp(p.fertility + e('fertility') * 0.4, 0.1, 1);
  p.frequency = Math.max(1, Math.min(22, Math.round(p.frequency + e('pattern') * 8)));
  p.patternScale *= clamp(1 + e('pattern') * 0.5, 0.6, 1.5);
  p.appearance = { ...p.appearance, shimmer: clamp(p.appearance.shimmer + e('sheen'), 0, 1.1) };
  // Long fins cost speed and oxygen; long life slows growth.
  p.growth *= 1.08 - 0.16 * clamp(g('longevity'));

  // Genetic load: homozygous recessives, made milder by canalization; strong regeneration regrows fins.
  const defects = defectsFor(block.load, KOI_LOAD, regeneration), severity = 1 - 0.35 * canalization;
  let conditionCap = 1, subfertile = false, finFray = 0, eyeCloud = 0, depigment = 0, kink = 0;
  const spineSign = noise() < 0 ? -1 : 1;
  for (const defect of defects) {
    if (defect.rescued) { finFray = Math.max(finFray, 0.18); continue; }
    switch (defect.kind) {
      case 'dwarf': p.adultLengthCm *= 1 - 0.32 * severity; p.depth *= 1.08; break;
      case 'spine': p.curve += 0.1 * severity * spineSign; p.speed *= 1 - 0.25 * severity; kink = 0.055 * severity * spineSign; break;
      case 'fins': p.tail *= 1 - 0.35 * severity; p.dorsal *= 1 - 0.35 * severity; p.pectoral *= 1 - 0.3 * severity; finFray = Math.max(finFray, severity); break;
      case 'eye': p.eye *= 0.72; eyeCloud = Math.max(eyeCloud, 0.55 + 0.4 * severity); break;
      case 'pigment': depigment = Math.max(depigment, 0.6 + 0.4 * severity); p.red *= 0.72; p.black *= 0.72; break;
      case 'frail': conditionCap = Math.min(conditionCap, 0.6 + 0.14 * (1 - severity)); break;
      case 'subfertile': subfertile = true; break;
      default: break;
    }
  }
  const viable = !defects.some(defect => defect.kind === 'lethal');
  const heterozygosity = koiGenesisHeterozygosity(genome), vigor = vigorFor(heterozygosity);
  p.growth *= vigor;
  p.oxygen = oxygenDemand * (p.adultLengthCm / 50) ** 2;
  const maturityDays = Math.round(clamp(36 - 22 * clamp(g('maturity_timing')) + (p.adultLengthCm - 60) / 10 - e('maturity') * 20, 12, 48));
  const competitiveness = clamp(0.25 + 0.45 * p.bold + 0.2 * p.activity + 0.2 * p.curious - 0.12 * veilCopies - (defects.some(d => d.kind === 'spine' && !d.rescued) ? 0.12 : 0), 0.05, 1.3);
  const clutchFactor = clamp((0.45 + 0.6 * p.fertility) * Math.min(1.05, vigor) * (subfertile ? 0.45 : 1), 0.15, 1);
  p.genesis = {
    model: 1, fins, ghost, glow, glowHue: (p.iris + 120 + e('hue') * 90 + 360) % 360, hueShift: e('hue') * 140, sheen: clamp(e('sheen') + p.appearance.shimmer * 0.3),
    canalization, asymmetry, maturityDays, regeneration, vigor, heterozygosity, competitiveness, conditionCap, clutchFactor, viable, oxygenDemand,
    defects, finFray, eyeCloud, depigment, kink, novelAlleles: block.novel.length,
  };
  return block.model === 2 ? developKoiV7(p, genome, resolver) : p;
}

/**
 * Development v7 (Genesis model 2): the model 2 side-effect channels, body-plan modules and one-off somatic marks, applied
 * over the development v6 phenotype. Model 1 genomes never reach this function.
 */
function developKoiV7(p: Phenotype, genome: Genome, resolver: KoiResolver): Phenotype {
  const block = genome.genesis!, traits = p.genesis!;
  const effects = channelEffects(GENOME_LOCI.map((_, i) => resolver.pair(i)));
  const e = (channel: Channel) => effects[channel] ?? 0;
  p.depth *= clamp(1 + 0.45 * e('depth'), 0.7, 1.35);
  p.eye *= clamp(1 + 0.7 * e('eye'), 0.6, 1.5);
  p.appearance = { ...p.appearance, contrast: clamp(p.appearance.contrast + 0.35 * e('contrast'), 0.3, 1) };
  p.longevity = Math.max(4, p.longevity + 10 * e('longevity'));
  const modules = expressModules('koi', block.modules!, block.dev, traits.canalization);
  let { competitiveness, conditionCap } = traits;
  // Trade-offs: a second dorsal adds drag; a wen hides the eyes a little; bubble sacs are fragile and slow the fish.
  if (modules.secondDorsal) p.speed *= 1 - 0.04 * modules.secondDorsal;
  if (modules.wen) competitiveness -= 0.08 * modules.wen;
  if (modules.bubble) { p.speed *= 0.94; competitiveness -= 0.1; conditionCap = Math.min(conditionCap, 0.92); }
  p.genesis = { ...traits, competitiveness: clamp(competitiveness, 0.05, 1.3), conditionCap, modules, somatic: somaticFor(block.dev, traits.canalization) };
  return p;
}
