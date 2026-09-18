import {
  AXOLOTL_CHROMOSOMES,
  AXOLOTL_DEFAULT_MUTATION_RATE,
  AXOLOTL_GENOME_VERSION,
  AXOLOTL_LOCI,
  AXOLOTL_LOCUS_INDEX,
  AXOLOTL_LOCUS_REGISTRY,
  axolotlLocusDefinition,
  type AxolotlAlleleDefinition,
  type AxolotlLocus,
  type AxolotlLocusDefinition,
} from './axolotlCatalog';
import { clamp, hash, random } from './random';

export type AxolotlGenome = {
  species: 'axolotl';
  version: typeof AXOLOTL_GENOME_VERSION;
  /** Phased homolog inherited from the mother. */
  maternal: number[];
  /** Phased homolog inherited from the father. */
  paternal: number[];
};

export type AxolotlMutation = {
  locus: number;
  locusId: AxolotlLocus;
  copy: 'maternal' | 'paternal';
  from: number;
  to: number;
};

export type AxolotlInheritanceTrace = {
  maternal: (0 | 1)[];
  paternal: (0 | 1)[];
};

export type AxolotlColor = { h: number; s: number; l: number };
export type AxolotlPigmentMorph =
  | 'wild'
  | 'leucistic-like'
  | 'albino-like'
  | 'melanoid-like'
  | 'axanthic-like'
  | 'hypomelanistic'
  | 'xanthic-like';
export type AxolotlPatternMode = 'plain' | 'speckled' | 'spotted' | 'mottled' | 'dappled' | 'marbled';
export type AxolotlSkinTexture = 'silken smooth' | 'satin' | 'fine pebbled' | 'velvet' | 'granular' | 'ridged';

export type AxolotlPhenotype = {
  model: 1;
  /** Common simulation potentials, shaped to be easy for future species dispatch. */
  adultLengthCm: number;
  growth: number;
  longevity: number;
  metabolism: number;
  oxygen: number;
  fertility: number;
  speed: number;
  turning: number;
  activity: number;
  social: number;
  bold: number;
  curious: number;
  morphology: {
    adultLengthCm: number;
    body: { length: number; width: number; depth: number; taper: number; flex: number; mass: number };
    head: { width: number; length: number; snoutRoundness: number; mouthWidth: number; jawDepth: number; neckWidth: number };
    limbs: {
      foreLength: number; hindLength: number; thickness: number;
      digitLength: number; digitSpread: number; frontDigits: number; rearDigits: number;
    };
    tail: { length: number; height: number; taper: number; finHeight: number; finReach: number; wave: number };
    gills: {
      stalkLength: number; branchCount: number; filamentLength: number; angleDeg: number;
      saturation: number; oxygenEfficiency: number;
    };
    eyes: { size: number; spacing: number; height: number; pupilRatio: number };
  };
  pigmentation: {
    morph: AxolotlPigmentMorph;
    carriers: ('leucistic' | 'albino' | 'melanoid')[];
    melanin: number;
    xanthophore: number;
    iridophore: number;
    leucisticExpression: number;
    albinismExpression: number;
    melanoidExpression: number;
    iridescence: number;
    translucency: number;
    texture: AxolotlSkinTexture;
    skinLuster: number;
    bodyColor: AxolotlColor;
    gillColor: AxolotlColor;
    irisColor: AxolotlColor;
  };
  pattern: {
    modes: AxolotlPatternMode[];
    density: number;
    scale: number;
    contrast: number;
    edge: number;
    symmetry: number;
    /** Stable unphased-genotype seed for future procedural pattern geometry. */
    seed: number;
  };
  life: {
    growthMultiplier: number;
    maturityMonths: number;
    longevityYears: number;
    metabolism: number;
    fertility: number;
    oxygenDemand: number;
    regeneration: number;
  };
  behavior: {
    activity: number;
    boldness: number;
    sociability: number;
    curiosity: number;
    feedingDrive: number;
    cruiseSpeed: number;
    turning: number;
  };
};

export type AxolotlGenotypeDescriptor = {
  locus: AxolotlLocus;
  label: string;
  chromosome: string;
  positionCm: number;
  maternal: number;
  paternal: number;
  maternalAllele: string;
  paternalAllele: string;
  zygosity: 'homozygous' | 'heterozygous';
  carrierFor: 'leucistic' | 'albino' | 'melanoid' | null;
  expressedRecessive: boolean;
};

export type AxolotlPhenotypeDescriptor = {
  group: 'Morphology' | 'Pigmentation' | 'Pattern' | 'Life' | 'Behavior';
  trait: string;
  value: string;
};

const weighted = (rng: () => number, weights: readonly number[]): number => {
  const draw = rng();
  let cumulative = 0;
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i];
    if (draw < cumulative || i === weights.length - 1) return i;
  }
  return weights.length - 1;
};

const founderCopy = (rng: () => number): number[] =>
  AXOLOTL_LOCUS_REGISTRY.map(entry => weighted(rng, entry.alleles.map(allele => allele.founderWeight)));

/**
 * Creates one independent axolotl founder genome. The species-prefixed substreams ensure that using
 * the same world seed for koi and axolotls does not couple either species' genetic draw sequence.
 */
export function axolotlFounderGenome(seed: number): AxolotlGenome {
  const maternal = founderCopy(random(hash(`axolotl:v1:founder:mother:${seed}`)));
  const paternal = founderCopy(random(hash(`axolotl:v1:founder:father:${seed}`)));
  return { species: 'axolotl', version: AXOLOTL_GENOME_VERSION, maternal, paternal };
}

const crossoverProbability = (left: AxolotlLocusDefinition, right: AxolotlLocusDefinition): number =>
  clamp((right.positionCm - left.positionCm) / 100, 0, 0.45);

function mutateAllele(rng: () => number, allele: AxolotlAlleleDefinition): number {
  if (allele.mutationTargets.length === 1) return allele.mutationTargets[0].allele;
  return allele.mutationTargets[weighted(rng, allele.mutationTargets.map(target => target.weight))].allele;
}

/**
 * Linked axolotl meiosis. Every chromosome begins from a fresh homolog choice and can switch homolog
 * at later map boundaries. Mutation happens only after the parental copy has been selected.
 *
 * Passing a non-default mutationRate is an explicit test/research override for every locus. With the
 * default rate, locus-specific mutation multipliers from the axolotl catalog are applied.
 */
export function inheritAxolotl(
  mother: AxolotlGenome,
  father: AxolotlGenome,
  seed: number,
  mutationRate = AXOLOTL_DEFAULT_MUTATION_RATE,
  trace?: AxolotlInheritanceTrace,
): { genome: AxolotlGenome; mutations: AxolotlMutation[] } {
  validateAxolotlGenome(mother);
  validateAxolotlGenome(father);
  if (!Number.isFinite(mutationRate) || mutationRate < 0 || mutationRate > 1) throw new Error('Invalid axolotl mutation rate.');
  if (trace) {
    trace.maternal.length = 0;
    trace.paternal.length = 0;
  }
  const mutations: AxolotlMutation[] = [];
  const transmit = (
    parent: AxolotlGenome,
    copy: 'maternal' | 'paternal',
    rng: () => number,
  ): number[] => {
    const gamete = Array<number>(AXOLOTL_LOCI.length);
    for (const chromosome of AXOLOTL_CHROMOSOMES) {
      let side: 0 | 1 = rng() < 0.5 ? 0 : 1;
      for (let offset = 0; offset < chromosome.loci.length; offset++) {
        const locusId = chromosome.loci[offset];
        const locusIndex = AXOLOTL_LOCUS_INDEX[locusId];
        const locus = AXOLOTL_LOCUS_REGISTRY[locusIndex];
        if (offset > 0) {
          const previous = axolotlLocusDefinition(chromosome.loci[offset - 1]);
          if (rng() < crossoverProbability(previous, locus)) side = side === 0 ? 1 : 0;
        }
        trace?.[copy].push(side);
        const source = side === 0 ? parent.maternal : parent.paternal;
        const from = source[locusIndex];
        const effectiveRate = mutationRate === AXOLOTL_DEFAULT_MUTATION_RATE
          ? clamp(mutationRate * locus.mutationMultiplier)
          : mutationRate;
        if (rng() >= effectiveRate) {
          gamete[locusIndex] = from;
          continue;
        }
        const to = mutateAllele(rng, locus.alleles[from]);
        gamete[locusIndex] = to;
        mutations.push({ locus: locusIndex, locusId, copy, from, to });
      }
    }
    return gamete;
  };

  const maternal = transmit(mother, 'maternal', random(hash(`axolotl:v1:birth:mother:${seed}`)));
  const paternal = transmit(father, 'paternal', random(hash(`axolotl:v1:birth:father:${seed}`)));
  return {
    genome: { species: 'axolotl', version: AXOLOTL_GENOME_VERSION, maternal, paternal },
    mutations,
  };
}

function allelePair(genome: AxolotlGenome, locus: AxolotlLocus): [number, number] {
  const index = AXOLOTL_LOCUS_INDEX[locus];
  return [genome.maternal[index], genome.paternal[index]];
}

function alleleDefinitions(genome: AxolotlGenome, locus: AxolotlLocus): [AxolotlAlleleDefinition, AxolotlAlleleDefinition] {
  const [a, b] = allelePair(genome, locus);
  const entry = axolotlLocusDefinition(locus);
  return [entry.alleles[a], entry.alleles[b]];
}

/** Mean quantitative effect in -1..1. */
function q(genome: AxolotlGenome, locus: AxolotlLocus): number {
  const [a, b] = alleleDefinitions(genome, locus);
  return clamp((a.effect + b.effect) / 2, -1, 1);
}

/** Quantitative effect mapped to 0..1. */
const unit = (genome: AxolotlGenome, locus: AxolotlLocus): number => (q(genome, locus) + 1) / 2;

function switchState(genome: AxolotlGenome, locus: 'axo_leucistic_switch' | 'axo_albinism_switch' | 'axo_melanoid_switch') {
  const [aId, bId] = allelePair(genome, locus);
  const [a, b] = alleleDefinitions(genome, locus);
  const severeA = aId >= 4, severeB = bId >= 4;
  return {
    carrier: severeA !== severeB,
    expressed: severeA && severeB,
    severity: severeA && severeB ? (a.effect + b.effect) / 2 : 0,
  };
}

const round = (value: number, digits = 4): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const circularHue = (a: number, b: number): number => {
  const ar = a * Math.PI / 180, br = b * Math.PI / 180;
  const x = Math.cos(ar) + Math.cos(br), y = Math.sin(ar) + Math.sin(br);
  const angle = Math.atan2(y, x) * 180 / Math.PI;
  return (angle + 360) % 360;
};

function categoricalHue(genome: AxolotlGenome, locus: 'axo_base_hue' | 'axo_gill_hue' | 'axo_iris_hue', hues: readonly number[]): number {
  const [a, b] = allelePair(genome, locus);
  return round(circularHue(hues[a], hues[b]), 2);
}

const hsl = (h: number, s: number, l: number): AxolotlColor => ({
  h: round((h + 360) % 360, 2),
  s: round(clamp(s)),
  l: round(clamp(l)),
});

function patternModes(genome: AxolotlGenome): AxolotlPatternMode[] {
  const entry = axolotlLocusDefinition('axo_pattern_mode');
  const [a, b] = allelePair(genome, 'axo_pattern_mode');
  const first = entry.alleles[a].label as AxolotlPatternMode;
  const second = entry.alleles[b].label as AxolotlPatternMode;
  if (first === second) return [first];
  if (first === 'plain') return [second];
  if (second === 'plain') return [first];
  return [first, second];
}

function texture(genome: AxolotlGenome): AxolotlSkinTexture {
  const entry = axolotlLocusDefinition('axo_skin_texture');
  const [a, b] = allelePair(genome, 'axo_skin_texture');
  return entry.alleles[Math.max(a, b)].label as AxolotlSkinTexture;
}

function unphasedPatternSeed(genome: AxolotlGenome): number {
  const canonical = AXOLOTL_LOCI.map((_, index) => {
    const a = genome.maternal[index], b = genome.paternal[index];
    return a < b ? `${a}.${b}` : `${b}.${a}`;
  }).join('|');
  return hash(`axolotl:v1:phenotype:${canonical}`);
}

/** Deterministic adult genetic potential. No age, water, feeding, or runtime state is read here. */
export function expressAxolotl(genome: AxolotlGenome): AxolotlPhenotype {
  validateAxolotlGenome(genome);

  const adultLengthCm = 16 + 17 * (
    0.55 * unit(genome, 'axo_adult_size') +
    0.30 * unit(genome, 'axo_body_length') +
    0.15 * unit(genome, 'axo_mass_bias')
  );
  const bodyLength = 0.78 + 0.38 * unit(genome, 'axo_body_length');
  const bodyWidth = 0.18 + 0.18 * unit(genome, 'axo_body_width');
  const bodyDepth = 0.11 + 0.16 * unit(genome, 'axo_body_depth');
  const bodyTaper = 0.16 + 0.50 * unit(genome, 'axo_body_taper');
  const bodyFlex = -0.12 + 0.24 * unit(genome, 'axo_trunk_flex');
  const bodyMass = 0.72 + 0.58 * unit(genome, 'axo_mass_bias');

  const leucistic = switchState(genome, 'axo_leucistic_switch');
  const albino = switchState(genome, 'axo_albinism_switch');
  const melanoid = switchState(genome, 'axo_melanoid_switch');
  let melanin = 0.08 + 0.84 * unit(genome, 'axo_melanophore_density');
  let xanthophore = 0.05 + 0.88 * unit(genome, 'axo_xanthophore_density');
  let iridophore = 0.04 + 0.90 * unit(genome, 'axo_iridophore_density');

  let morph: AxolotlPigmentMorph = 'wild';
  // These named morphs are phenotype anchors for the game model, not claims that the synthetic
  // switch loci below are the real axolotl d, tyrosinase, m, or axanthic molecular loci.
  if (albino.expressed) {
    morph = 'albino-like';
    melanin = 0;
    iridophore *= 0.42;
  } else if (leucistic.expressed) {
    morph = 'leucistic-like';
    melanin *= 0.06 + 0.08 * (1 - leucistic.severity);
    xanthophore *= 0.30;
    iridophore *= 0.82;
  } else if (melanoid.expressed) {
    morph = 'melanoid-like';
    melanin = clamp(melanin * (1.12 + 0.18 * melanoid.severity));
    xanthophore *= 0.22;
    iridophore *= 0.08;
  } else if (xanthophore < 0.20 && melanin > 0.34) {
    morph = 'axanthic-like';
  } else if (melanin < 0.27) {
    morph = 'hypomelanistic';
  } else if (xanthophore > 0.76 && melanin < 0.48) {
    morph = 'xanthic-like';
  }
  melanin = clamp(melanin);
  xanthophore = clamp(xanthophore);
  iridophore = clamp(iridophore);

  const baseHue = categoricalHue(genome, 'axo_base_hue', [78, 34, 24, 49, 14, 286]);
  const gillHue = categoricalHue(genome, 'axo_gill_hue', [350, 8, 15, 354, 292, 330]);
  const irisHue = categoricalHue(genome, 'axo_iris_hue', [35, 40, 46, 28, 356, 210]);
  const flush = unit(genome, 'axo_pink_flush');
  const iridescence = clamp(0.04 + 0.90 * unit(genome, 'axo_iridescence') * (0.35 + 0.65 * iridophore));
  const translucency = clamp(0.04 + 0.62 * unit(genome, 'axo_translucency') + (morph === 'leucistic-like' ? 0.16 : 0));

  let bodySaturation = clamp(0.14 + xanthophore * 0.52 + melanin * 0.12);
  let bodyLightness = clamp(0.72 - melanin * 0.49 + iridophore * 0.08);
  if (morph === 'leucistic-like') {
    bodySaturation = clamp(0.08 + flush * 0.16);
    bodyLightness = clamp(0.82 + iridophore * 0.10);
  } else if (morph === 'albino-like') {
    bodySaturation = clamp(0.18 + xanthophore * 0.28 + flush * 0.16);
    bodyLightness = clamp(0.78 + xanthophore * 0.12);
  } else if (morph === 'melanoid-like') {
    bodySaturation = clamp(0.08 + xanthophore * 0.10);
    bodyLightness = clamp(0.14 + (1 - melanin) * 0.18);
  }

  const gillSaturation = clamp(0.35 + 0.55 * unit(genome, 'axo_gill_saturation') + flush * 0.10);
  const irisLightness = morph === 'albino-like'
    ? 0.42 + 0.16 * unit(genome, 'axo_iridescence')
    : clamp(0.18 + (1 - melanin) * 0.22 + iridophore * 0.20);

  const growthMultiplier = 0.70 + 0.80 * unit(genome, 'axo_growth_rate');
  const maturityMonths = 18 - 10 * unit(genome, 'axo_maturity_timing');
  const longevityYears = 8 + 10 * unit(genome, 'axo_longevity');
  const metabolism = 0.70 + 0.65 * unit(genome, 'axo_metabolism');
  const fertility = 0.28 + 0.68 * unit(genome, 'axo_fertility');
  const oxygenEfficiency = 0.65 + 0.75 * unit(genome, 'axo_oxygen_efficiency');
  const oxygenDemand = metabolism * (adultLengthCm / 25) ** 2 / oxygenEfficiency;
  const regeneration = 0.40 + 0.60 * unit(genome, 'axo_regeneration');

  const activity = unit(genome, 'axo_activity');
  const boldness = unit(genome, 'axo_boldness');
  const sociability = unit(genome, 'axo_sociability');
  const curiosity = unit(genome, 'axo_curiosity');
  const feedingDrive = unit(genome, 'axo_feeding_drive');
  const tailLength = 0.42 + 0.42 * unit(genome, 'axo_tail_length');
  const tailHeight = 0.15 + 0.22 * unit(genome, 'axo_tail_height');
  const drag = 1 + bodyWidth * 0.55 + tailHeight * 0.35;
  const cruiseSpeed = (0.018 + activity * 0.036 + oxygenEfficiency * 0.006) / drag;

  const carriers: AxolotlPhenotype['pigmentation']['carriers'] = [];
  if (leucistic.carrier) carriers.push('leucistic');
  if (albino.carrier) carriers.push('albino');
  if (melanoid.carrier) carriers.push('melanoid');

  return {
    model: 1,
    adultLengthCm: round(adultLengthCm, 3),
    growth: round(growthMultiplier),
    longevity: round(longevityYears, 2),
    metabolism: round(metabolism),
    oxygen: round(oxygenDemand),
    fertility: round(fertility),
    speed: round(cruiseSpeed, 6),
    turning: round(0.65 + 1.25 * curiosity + 0.35 * activity),
    activity: round(activity),
    social: round(sociability),
    bold: round(boldness),
    curious: round(curiosity),
    morphology: {
      adultLengthCm: round(adultLengthCm, 3),
      body: {
        length: round(bodyLength), width: round(bodyWidth), depth: round(bodyDepth),
        taper: round(bodyTaper), flex: round(bodyFlex), mass: round(bodyMass),
      },
      head: {
        width: round(0.22 + 0.18 * unit(genome, 'axo_head_width')),
        length: round(0.13 + 0.13 * unit(genome, 'axo_head_length')),
        snoutRoundness: round(0.18 + 0.76 * unit(genome, 'axo_snout_roundness')),
        mouthWidth: round(0.08 + 0.16 * unit(genome, 'axo_mouth_width')),
        jawDepth: round(0.035 + 0.075 * unit(genome, 'axo_jaw_depth')),
        neckWidth: round(0.13 + 0.16 * unit(genome, 'axo_neck_width')),
      },
      limbs: {
        foreLength: round(0.10 + 0.15 * unit(genome, 'axo_forelimb_length')),
        hindLength: round(0.11 + 0.17 * unit(genome, 'axo_hindlimb_length')),
        thickness: round(0.022 + 0.045 * unit(genome, 'axo_limb_thickness')),
        digitLength: round(0.026 + 0.060 * unit(genome, 'axo_digit_length')),
        digitSpread: round(0.32 + 0.66 * unit(genome, 'axo_digit_spread')),
        frontDigits: Math.round(4 + q(genome, 'axo_digit_count') * 0.9),
        rearDigits: Math.round(5 + q(genome, 'axo_digit_count') * 0.9),
      },
      tail: {
        length: round(tailLength),
        height: round(tailHeight),
        taper: round(0.22 + 0.58 * unit(genome, 'axo_tail_taper')),
        finHeight: round(0.05 + 0.19 * unit(genome, 'axo_fin_height')),
        finReach: round(0.42 + 0.53 * unit(genome, 'axo_fin_reach')),
        wave: round(-0.16 + 0.32 * unit(genome, 'axo_tail_wave')),
      },
      gills: {
        stalkLength: round(0.07 + 0.18 * unit(genome, 'axo_gill_stalk_length')),
        branchCount: Math.round(4 + 11 * unit(genome, 'axo_gill_branch_density')),
        filamentLength: round(0.025 + 0.105 * unit(genome, 'axo_gill_filament_length')),
        angleDeg: round(18 + 55 * unit(genome, 'axo_gill_angle'), 2),
        saturation: round(gillSaturation),
        oxygenEfficiency: round(oxygenEfficiency),
      },
      eyes: {
        size: round(0.018 + 0.040 * unit(genome, 'axo_eye_size')),
        spacing: round(0.13 + 0.15 * unit(genome, 'axo_eye_spacing')),
        height: round(0.30 + 0.38 * unit(genome, 'axo_eye_height')),
        pupilRatio: round(0.34 + 0.46 * unit(genome, 'axo_pupil_size')),
      },
    },
    pigmentation: {
      morph,
      carriers,
      melanin: round(melanin),
      xanthophore: round(xanthophore),
      iridophore: round(iridophore),
      leucisticExpression: round(leucistic.severity),
      albinismExpression: round(albino.severity),
      melanoidExpression: round(melanoid.severity),
      iridescence: round(iridescence),
      translucency: round(translucency),
      texture: texture(genome),
      skinLuster: round(0.08 + 0.86 * unit(genome, 'axo_skin_luster')),
      bodyColor: hsl(baseHue, bodySaturation, bodyLightness),
      gillColor: hsl(gillHue, gillSaturation, 0.48 + flush * 0.24),
      irisColor: hsl(morph === 'albino-like' ? 355 : irisHue, morph === 'albino-like' ? 0.78 : 0.36 + iridophore * 0.40, irisLightness),
    },
    pattern: {
      modes: patternModes(genome),
      density: round(0.05 + 0.90 * unit(genome, 'axo_pattern_density')),
      scale: round(0.025 + 0.17 * unit(genome, 'axo_pattern_scale')),
      contrast: round(0.08 + 0.86 * unit(genome, 'axo_pattern_contrast')),
      edge: round(unit(genome, 'axo_pattern_edge')),
      symmetry: round(unit(genome, 'axo_pattern_symmetry')),
      seed: unphasedPatternSeed(genome),
    },
    life: {
      growthMultiplier: round(growthMultiplier),
      maturityMonths: round(maturityMonths, 2),
      longevityYears: round(longevityYears, 2),
      metabolism: round(metabolism),
      fertility: round(fertility),
      oxygenDemand: round(oxygenDemand),
      regeneration: round(regeneration),
    },
    behavior: {
      activity: round(activity),
      boldness: round(boldness),
      sociability: round(sociability),
      curiosity: round(curiosity),
      feedingDrive: round(feedingDrive),
      cruiseSpeed: round(cruiseSpeed, 6),
      turning: round(0.65 + 1.25 * curiosity + 0.35 * activity),
    },
  };
}

function carrierName(locus: AxolotlLocus): AxolotlGenotypeDescriptor['carrierFor'] {
  if (locus === 'axo_leucistic_switch') return 'leucistic';
  if (locus === 'axo_albinism_switch') return 'albino';
  if (locus === 'axo_melanoid_switch') return 'melanoid';
  return null;
}

/** Full locus-by-locus genotype inspection data for an axolotl. */
export function describeAxolotlGenotype(genome: AxolotlGenome): AxolotlGenotypeDescriptor[] {
  validateAxolotlGenome(genome);
  return AXOLOTL_LOCUS_REGISTRY.map((entry, index) => {
    const maternal = genome.maternal[index], paternal = genome.paternal[index];
    const special = carrierName(entry.id);
    const severeCopies = Number(maternal >= 4) + Number(paternal >= 4);
    return {
      locus: entry.id,
      label: entry.label,
      chromosome: entry.chromosomeLabel,
      positionCm: entry.positionCm,
      maternal,
      paternal,
      maternalAllele: entry.alleles[maternal].label,
      paternalAllele: entry.alleles[paternal].label,
      zygosity: maternal === paternal ? 'homozygous' : 'heterozygous',
      carrierFor: special && severeCopies === 1 ? special : null,
      expressedRecessive: Boolean(special && severeCopies === 2),
    };
  });
}

/** Compact human-facing adult-potential descriptors; deliberately separate from koi descriptors. */
export function describeAxolotlPhenotype(genome: AxolotlGenome): AxolotlPhenotypeDescriptor[] {
  const p = expressAxolotl(genome);
  const title = (value: string) => value.replace(/^./, c => c.toUpperCase());
  return [
    { group: 'Morphology', trait: 'Adult length', value: `${p.morphology.adultLengthCm.toFixed(1)} cm` },
    { group: 'Morphology', trait: 'Body build', value: p.morphology.body.mass > 1.02 ? 'Heavy' : p.morphology.body.mass < 0.92 ? 'Slender' : 'Balanced' },
    { group: 'Morphology', trait: 'Tail', value: `${p.morphology.tail.length.toFixed(2)}× length · ${p.morphology.tail.finHeight.toFixed(2)} fin` },
    { group: 'Morphology', trait: 'Gills', value: `${p.morphology.gills.branchCount} branches · ${p.morphology.gills.stalkLength.toFixed(2)} stalk` },
    { group: 'Morphology', trait: 'Digits', value: `${p.morphology.limbs.frontDigits} front / ${p.morphology.limbs.rearDigits} rear` },
    { group: 'Pigmentation', trait: 'Morph', value: title(p.pigmentation.morph) },
    { group: 'Pigmentation', trait: 'Pigment cells', value: `M ${Math.round(p.pigmentation.melanin * 100)} · X ${Math.round(p.pigmentation.xanthophore * 100)} · I ${Math.round(p.pigmentation.iridophore * 100)}` },
    { group: 'Pigmentation', trait: 'Skin', value: `${title(p.pigmentation.texture)} · luster ${Math.round(p.pigmentation.skinLuster * 100)}%` },
    { group: 'Pigmentation', trait: 'Optics', value: `iridescence ${Math.round(p.pigmentation.iridescence * 100)}% · translucency ${Math.round(p.pigmentation.translucency * 100)}%` },
    { group: 'Pattern', trait: 'Pattern', value: p.pattern.modes.map(title).join(' + ') },
    { group: 'Pattern', trait: 'Pattern strength', value: `${Math.round(p.pattern.density * 100)}% density · ${Math.round(p.pattern.contrast * 100)}% contrast` },
    { group: 'Life', trait: 'Growth', value: `${p.life.growthMultiplier.toFixed(2)}×` },
    { group: 'Life', trait: 'Maturity', value: `${p.life.maturityMonths.toFixed(1)} months` },
    { group: 'Life', trait: 'Longevity potential', value: `${p.life.longevityYears.toFixed(1)} years` },
    { group: 'Life', trait: 'Regeneration potential', value: `${Math.round(p.life.regeneration * 100)}%` },
    { group: 'Behavior', trait: 'Activity', value: `${Math.round(p.behavior.activity * 100)}%` },
    { group: 'Behavior', trait: 'Temperament', value: `bold ${Math.round(p.behavior.boldness * 100)} · social ${Math.round(p.behavior.sociability * 100)} · curious ${Math.round(p.behavior.curiosity * 100)}` },
  ];
}

export function axolotlGenomeProblem(value: unknown): string | null {
  if (!value || typeof value !== 'object') return 'Axolotl genome must be an object.';
  const genome = value as Partial<AxolotlGenome>;
  if (genome.species !== 'axolotl') return 'Axolotl genome has the wrong species tag.';
  if (genome.version !== AXOLOTL_GENOME_VERSION) return `Unsupported axolotl genome version ${String(genome.version)}.`;
  if (!Array.isArray(genome.maternal) || !Array.isArray(genome.paternal)) return 'Axolotl genome homologs must be arrays.';
  if (genome.maternal.length !== AXOLOTL_LOCI.length || genome.paternal.length !== AXOLOTL_LOCI.length) {
    return `Axolotl genome v1 requires ${AXOLOTL_LOCI.length} loci per homolog.`;
  }
  for (let index = 0; index < AXOLOTL_LOCI.length; index++) {
    const entry = AXOLOTL_LOCUS_REGISTRY[index];
    for (const [copy, allele] of [['maternal', genome.maternal[index]], ['paternal', genome.paternal[index]]] as const) {
      if (!Number.isInteger(allele) || allele < 0 || allele >= entry.alleles.length) {
        return `Invalid axolotl allele at ${entry.id} (${copy}).`;
      }
    }
  }
  return null;
}

export function validateAxolotlGenome(genome: unknown): asserts genome is AxolotlGenome {
  const problem = axolotlGenomeProblem(genome);
  if (problem) throw new Error(problem);
}

export const isAxolotlGenome = (value: unknown): value is AxolotlGenome => axolotlGenomeProblem(value) === null;

export function axolotlFingerprint(genome: AxolotlGenome): string {
  validateAxolotlGenome(genome);
  return `AX1-${hash(`ax1:${genome.maternal.join(',')}|${genome.paternal.join(',')}`).toString(16).padStart(8, '0').toUpperCase()}`;
}

export function axolotlHeterozygosity(genome: AxolotlGenome): number {
  validateAxolotlGenome(genome);
  return genome.maternal.filter((allele, index) => allele !== genome.paternal[index]).length / AXOLOTL_LOCI.length;
}
