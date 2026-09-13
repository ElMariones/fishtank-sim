import { CROSSOVER_RATE, FOUNDER_WEIGHTS, LOCI, MUTATION_RATE, type Locus } from './catalog';
import { clamp, hash, random } from './random';
import type { Genome, Mutation, Phenotype } from './types';

export function founderGenome(seed: number): Genome {
  const rng = random(seed);
  const allele = () => {
    const draw = rng();
    let sum = 0;
    return FOUNDER_WEIGHTS.findIndex((weight, i) => { sum += weight; return draw < sum || i === 5; });
  };
  return { version: 1, maternal: LOCI.map(allele), paternal: LOCI.map(allele) };
}

export function inherit(mother: Genome, father: Genome, seed: number, mutationRate = MUTATION_RATE): { genome: Genome; mutations: Mutation[] } {
  if (mutationRate < 0 || mutationRate > 1 || !Number.isFinite(mutationRate)) throw new Error('Invalid mutation rate.');
  const rng = random(seed);
  const mutations: Mutation[] = [];
  const gamete = (parent: Genome, copy: Mutation['copy']) => {
    let side = 0;
    return LOCI.map((_, i) => {
      if (i % 6 === 0) side = rng() < 0.5 ? 0 : 1;
      else if (rng() < CROSSOVER_RATE) side = 1 - side;
      const from = (side === 0 ? parent.maternal : parent.paternal)[i];
      if (rng() >= mutationRate) return from;
      const to = from === 0 ? 1 : from === 5 ? 4 : from + (rng() < 0.5 ? -1 : 1);
      mutations.push({ locus: i, copy, from, to });
      return to;
    });
  };
  return { genome: { version: 1, maternal: gamete(mother, 'maternal'), paternal: gamete(father, 'paternal') }, mutations };
}

/** Development v1: adult genetic potential; age/environmental expression is a later milestone. */
export function express(genome: Genome): Phenotype {
  const g = (name: Locus) => {
    const i = LOCI.indexOf(name);
    return (genome.maternal[i] + genome.paternal[i]) / 10;
  };
  const recessive = (name: Locus) => {
    const i = LOCI.indexOf(name);
    return genome.maternal[i] === 5 && genome.paternal[i] === 5;
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
  };
}

export function fingerprint(genome: Genome): string {
  return hash(`g${genome.version}:${genome.maternal.join(',')}|${genome.paternal.join(',')}`).toString(16).padStart(8, '0').toUpperCase();
}

export function heterozygosity(genome: Genome): number {
  return genome.maternal.filter((allele, i) => allele !== genome.paternal[i]).length / LOCI.length;
}
