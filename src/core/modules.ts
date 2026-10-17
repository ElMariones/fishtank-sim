import type { ModuleCopies } from './genesis';
import { clamp, hash, random } from './random';
import type { Phenotype, Species } from './types';

/**
 * Body-plan modules (R-203, Genesis model 2, world v18).
 *
 * A body plan is a small graph of modules: body, head, eyes, fins, limbs, gill rami, crests. Standard modules come from
 * the species' existing anatomy; module genes can **duplicate** one (a second dorsal fin, a fourth gill ramus, extra
 * digits), **transform** one (an eye socket that grows a fluid sac) or add a **novel** one (a wen over the head, a crest
 * along the back). Every module gene is a threshold or switch trait, so most animals carry hidden liability and a line
 * crosses the threshold only after selection. Module genes live beside the 72 locus arrays in the development block and
 * are transmitted on their own small chromosome (number 13, "Body plan").
 *
 * Genomes born before model 2 carry no module genes. When one parents a model 2 child, its module genotype is read from
 * its fingerprint (latent, like latent load), so old founders can turn out to carry a second dorsal fin.
 *
 * Synthetic rules for a game, inspired by fancy goldfish and axolotl phenotypes. Not a model of real genetics.
 */
export const MODULE_MODEL = 1;
export type ModuleRule = 'liability' | 'modifier' | 'recessive' | 'dominant';
export type ModuleLocus = {
  id: string; label: string; rule: ModuleRule;
  /** Allele labels; the allele count is the label count. */
  alleles: readonly string[];
  /** Frequencies of each allele in latent and founder copies. */
  weights: readonly number[];
  note: string;
};

const LIABILITY = ['none', 'low', 'medium', 'high'] as const;
const LEVELS = ['level 0', 'level 1', 'level 2', 'level 3'] as const;

export const KOI_MODULE_LOCI: readonly ModuleLocus[] = [
  { id: 'dorsal_duplication', label: 'Dorsal duplication', rule: 'liability', alleles: LIABILITY, weights: [0.86, 0.1, 0.03, 0.01],
    note: 'Liability for a second dorsal fin behind the first. A threshold trait: copies add up with the modifier and developmental noise.' },
  { id: 'dorsal_modifier', label: 'Dorsal duplication modifier', rule: 'modifier', alleles: LEVELS, weights: [0.45, 0.3, 0.17, 0.08],
    note: 'Adds a little liability toward a second dorsal fin and sets its height.' },
  { id: 'wen', label: 'Wen growth', rule: 'liability', alleles: LIABILITY, weights: [0.84, 0.11, 0.04, 0.01],
    note: 'Liability for a raspberry-like hood (wen) over the head, as in lionhead goldfish.' },
  { id: 'wen_extent', label: 'Wen extent', rule: 'modifier', alleles: LEVELS, weights: [0.4, 0.3, 0.2, 0.1],
    note: 'How far a wen spreads over the head once it grows.' },
  { id: 'bubble_eye', label: 'Bubble eye', rule: 'recessive', alleles: ['wild', 'sac'], weights: [0.9, 0.1],
    note: 'Recessive: two sac copies grow fluid-filled pouches under the eyes.' },
  { id: 'bubble_size', label: 'Bubble size', rule: 'modifier', alleles: LEVELS, weights: [0.4, 0.3, 0.2, 0.1],
    note: 'How large bubble-eye sacs grow.' },
];
export const AXOLOTL_MODULE_LOCI: readonly ModuleLocus[] = [
  { id: 'gill_ramus', label: 'Extra gill ramus', rule: 'recessive', alleles: ['three rami', 'four rami'], weights: [0.88, 0.12],
    note: 'Recessive: two copies grow a fourth gill ramus on each side, which takes up a little more oxygen.' },
  { id: 'ramus_length', label: 'Ramus length', rule: 'modifier', alleles: LEVELS, weights: [0.4, 0.3, 0.2, 0.1],
    note: 'Lengthens every gill ramus slightly.' },
  { id: 'polydactyly', label: 'Polydactyly', rule: 'liability', alleles: LIABILITY, weights: [0.84, 0.11, 0.04, 0.01],
    note: 'Liability for extra digits on every foot, on top of the digit program. Above a higher threshold two extra digits grow.' },
  { id: 'crest', label: 'Dorsal crest', rule: 'dominant', alleles: ['smooth', 'crested'], weights: [0.985, 0.015],
    note: 'Dominant: one copy grows a membrane crest along the back toward the head.' },
  { id: 'crest_height', label: 'Crest height', rule: 'modifier', alleles: LEVELS, weights: [0.4, 0.3, 0.2, 0.1],
    note: 'How tall a dorsal crest grows.' },
  { id: 'crest_reach', label: 'Crest reach', rule: 'modifier', alleles: LEVELS, weights: [0.4, 0.3, 0.2, 0.1],
    note: 'How far forward a dorsal crest reaches.' },
];
/**
 * Goldfish hoods, bubble eyes and lobed tails already come from their own loci. Their module genes (body-plan set 2,
 * world v19) duplicate fins instead: a second dorsal fin and a second pectoral pair.
 */
export const GOLDFISH_MODULE_LOCI: readonly ModuleLocus[] = [
  { id: 'dorsal_duplication', label: 'Dorsal duplication', rule: 'liability', alleles: LIABILITY, weights: [0.86, 0.1, 0.03, 0.01],
    note: 'Liability for a second dorsal fin behind the first. A threshold trait; fish without a full dorsal fin never show it.' },
  { id: 'dorsal_modifier', label: 'Dorsal duplication modifier', rule: 'modifier', alleles: LEVELS, weights: [0.45, 0.3, 0.17, 0.08],
    note: 'Adds a little liability toward a second dorsal fin and sets its height.' },
  { id: 'pectoral_duplication', label: 'Pectoral duplication', rule: 'recessive', alleles: ['single', 'double'], weights: [0.87, 0.13],
    note: 'Recessive: two double copies grow a second, smaller pectoral pair behind the first.' },
  { id: 'pectoral_length', label: 'Second pectoral length', rule: 'modifier', alleles: LEVELS, weights: [0.4, 0.3, 0.2, 0.1],
    note: 'How long a second pectoral pair grows.' },
];

/**
 * Body-plan sets. Set 1 is the R-203 registry (no goldfish module genes); set 2 adds the goldfish fin duplications. A world
 * v18 journal recorded goldfish births under set 1, so it replays there and moves to set 2 when the runtime rebases.
 */
export type BodyPlanSet = 1 | 2;
export const BODY_PLAN_SET: BodyPlanSet = 2;
const NO_LOCI: readonly ModuleLocus[] = [];
export const moduleLoci = (species: Species, set: BodyPlanSet = BODY_PLAN_SET): readonly ModuleLocus[] =>
  species === 'koi' ? KOI_MODULE_LOCI : species === 'axolotl' ? AXOLOTL_MODULE_LOCI : set >= 2 ? GOLDFISH_MODULE_LOCI : NO_LOCI;
/** Allele count per module locus, for validation. */
export const moduleAlleleCounts = (species: Species): number[] => moduleLoci(species).map(locus => locus.alleles.length);
/** Module loci follow the 72 locus arrays in Atlas numbering. */
export const MODULE_INDEX_OFFSET = 72;
/** Mutation probability per transmitted module copy: higher than ordinary loci, so body plans keep changing. */
export const MODULE_MUTATION_RATE = 0.005;
const MODULE_CROSSOVER = 0.18;

function weighted(rng: () => number, weights: readonly number[]): number {
  const draw = rng();
  let sum = 0;
  return weights.findIndex((weight, i) => { sum += weight; return draw < sum || i === weights.length - 1; });
}

/** Module genes for a genome that carries none: deterministic from its fingerprint, hidden like any carrier state. */
export function latentModules(species: Species, fingerprint: string, set: BodyPlanSet = BODY_PLAN_SET): ModuleCopies {
  const loci = moduleLoci(species, set), rng = random(hash(`genesis-v2:latent-modules:${species}:${fingerprint}`));
  return { maternal: loci.map(locus => weighted(rng, locus.weights)), paternal: loci.map(locus => weighted(rng, locus.weights)) };
}

export type ModuleMutation = { locus: number; copy: 'maternal' | 'paternal'; from: number; to: number };

/** Linked transmission of the Body plan chromosome with its own streams, plus per-copy mutation by one allele step. */
export function inheritModules(species: Species, mother: ModuleCopies, father: ModuleCopies, seed: number, set: BodyPlanSet = BODY_PLAN_SET): { modules: ModuleCopies; mutations: ModuleMutation[] } {
  const loci = moduleLoci(species, set), mutations: ModuleMutation[] = [];
  const gamete = (parent: ModuleCopies, copy: 'maternal' | 'paternal') => {
    const rng = random(hash(`genesis-v2:modules:${copy}:${seed}`));
    let side = rng() < 0.5 ? 0 : 1;
    return loci.map((locus, i) => {
      if (i > 0 && rng() < MODULE_CROSSOVER) side = side ? 0 : 1;
      const from = (side === 0 ? parent.maternal : parent.paternal)[i] ?? 0;
      if (rng() >= MODULE_MUTATION_RATE) return from;
      const top = locus.alleles.length - 1;
      const to = top === 1 ? 1 - from : from === 0 ? 1 : from === top ? top - 1 : from + (rng() < 0.5 ? -1 : 1);
      mutations.push({ locus: i, copy, from, to });
      return to;
    });
  };
  return { modules: { maternal: gamete(mother, 'maternal'), paternal: gamete(father, 'paternal') }, mutations };
}

/** Expressed body-plan modules. Zero means absent; sizes are relative 0–1. */
export type ModuleTraits = {
  secondDorsal: number; wen: number; bubble: number;
  extraRami: number; ramusLength: number; polydactyly: number; crest: number; crestReach: number;
  /** Goldfish (body-plan set 2): a second pectoral pair, relative length 0–1. */
  doublePectoral: number;
  /** Liability against threshold per liability trait (1 = exactly at threshold), for the inspector. */
  liability: Record<string, number>;
};
export const NO_MODULES: ModuleTraits = { secondDorsal: 0, wen: 0, bubble: 0, extraRami: 0, ramusLength: 0, polydactyly: 0, crest: 0, crestReach: 0, doublePectoral: 0, liability: {} };

const round = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Develop module genes into module traits. Developmental noise (from the dev seed, widened by low canalization) moves an
 * animal across a threshold, so siblings with the same module genotype can differ.
 */
export function expressModules(species: Species, copies: ModuleCopies, dev: number, canalization: number): ModuleTraits {
  const rng = random(hash(`genesis-v2:module-noise:${dev}`)), spread = 0.55 + 0.7 * (1 - clamp(canalization));
  const noise = () => (rng() * 2 - 1) * spread;
  const sum = (i: number) => (copies.maternal[i] ?? 0) + (copies.paternal[i] ?? 0);
  const both = (i: number) => (copies.maternal[i] ?? 0) > 0 && (copies.paternal[i] ?? 0) > 0;
  const either = (i: number) => (copies.maternal[i] ?? 0) > 0 || (copies.paternal[i] ?? 0) > 0;
  const traits: ModuleTraits = { ...NO_MODULES, liability: {} };
  if (species === 'koi') {
    const dorsal = sum(0) + 0.35 * sum(1) + 0.7 * noise(), wen = sum(2) + 0.3 * sum(3) + 0.7 * noise(), sac = noise();
    traits.liability = { 'second dorsal': round(dorsal / 3.4), wen: round(wen / 3.4) };
    if (dorsal >= 3.4) traits.secondDorsal = round(clamp(0.45 + 0.16 * (dorsal - 3.4) + 0.05 * sum(1), 0.4, 1));
    if (wen >= 3.4) traits.wen = round(clamp(0.35 + 0.18 * (wen - 3.4) + 0.06 * sum(3), 0.3, 1));
    if (both(4)) traits.bubble = round(clamp(0.5 + 0.08 * sum(5) + 0.06 * sac, 0.4, 1));
  } else if (species === 'axolotl') {
    const digits = sum(2) + 0.7 * noise(), crestNoise = noise();
    traits.liability = { polydactyly: round(digits / 3) };
    if (both(0)) traits.extraRami = 1;
    traits.ramusLength = round(0.04 * sum(1));
    traits.polydactyly = digits >= 4.6 ? 2 : digits >= 3 ? 1 : 0;
    if (either(3)) {
      traits.crest = round(clamp(0.38 + 0.1 * sum(4) + 0.06 * crestNoise, 0.3, 1));
      traits.crestReach = round(clamp(0.3 + 0.12 * sum(5), 0.3, 1));
    }
  } else if (copies.maternal.length) {
    // Goldfish, body-plan set 2. A set 1 genome (empty module copies) expresses nothing and draws no noise.
    const dorsal = sum(0) + 0.35 * sum(1) + 0.7 * noise(), pec = noise();
    traits.liability = { 'second dorsal': round(dorsal / 3.4) };
    if (dorsal >= 3.4) traits.secondDorsal = round(clamp(0.45 + 0.16 * (dorsal - 3.4) + 0.05 * sum(1), 0.4, 1));
    if (both(2)) traits.doublePectoral = round(clamp(0.55 + 0.07 * sum(3) + 0.05 * pec, 0.45, 1));
  }
  return traits;
}

export const hasModules = (traits: ModuleTraits | undefined) =>
  Boolean(traits && (traits.secondDorsal || traits.wen || traits.bubble || traits.extraRami || traits.polydactyly || traits.crest || traits.doublePectoral));

// ── Somatic marks ──────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * One-off developmental marks (Genesis model 2): never inherited, drawn from the development seed. A mosaic sector is a
 * patch of skin whose pigment cells carry a somatic change; a birthmark is a small unique mark. Low canalization makes
 * mosaics more likely, so the tendency (not the mark) is heritable.
 */
export type SomaticMark = { kind: 'mosaic' | 'birthmark'; u: number; v: number; size: number; hue: number; shape: 'blot' | 'star' | 'crescent' | 'ring' };
export const SOMATIC_LABELS: Record<SomaticMark['kind'], string> = { mosaic: 'Mosaic sector', birthmark: 'Birthmark' };

export function somaticFor(dev: number, canalization: number): SomaticMark | null {
  const rng = random(hash(`genesis-v2:somatic:${dev}`)), roll = rng();
  const mosaic = 0.018 + 0.05 * (1 - clamp(canalization)), birthmark = 0.07;
  if (roll >= mosaic + birthmark) return null;
  const kind = roll < mosaic ? 'mosaic' : 'birthmark';
  const shapes = ['blot', 'star', 'crescent', 'ring'] as const;
  return {
    kind, u: round(0.22 + 0.56 * rng()), v: round((rng() * 2 - 1) * 0.55),
    size: round(kind === 'mosaic' ? 0.12 + 0.16 * rng() : 0.03 + 0.03 * rng()),
    hue: round((rng() < 0.5 ? -1 : 1) * (60 + 110 * rng())),
    shape: kind === 'mosaic' ? 'blot' : shapes[1 + Math.floor(rng() * 3)],
  };
}

// ── Body plan graph ────────────────────────────────────────────────────────────────────────────────────────────────────

export type ModuleKind = 'body' | 'head' | 'eye' | 'wen' | 'sac' | 'barbel' | 'dorsal' | 'pectoral' | 'pelvic' | 'anal' | 'caudal' | 'limb' | 'digit' | 'gill' | 'crest' | 'tail';
export type ModuleOrigin = 'standard' | 'duplication' | 'transformation' | 'novel' | 'reduced';
export type ModuleNode = { id: string; kind: ModuleKind; label: string; parent: string | null; count: number; origin: ModuleOrigin; size?: number };

/**
 * The body plan as a module graph, read from an expressed phenotype. Renderers draw from anatomy; this graph is the
 * species-independent description the inspector, Codex and future renderers share.
 */
export function bodyPlanFor(p: Phenotype): ModuleNode[] {
  const m = p.genesis?.modules ?? NO_MODULES;
  const node = (id: string, kind: ModuleKind, label: string, parent: string | null, count: number, origin: ModuleOrigin = 'standard', size?: number): ModuleNode =>
    ({ id, kind, label, parent, count, origin, ...(size === undefined ? {} : { size }) });
  if (p.species === 'axolotl' && p.axolotl) {
    const limbs = p.axolotl.morphology.limbs, rami = 3 + m.extraRami;
    return [
      node('body', 'body', 'Body', null, 1), node('head', 'head', 'Head', 'body', 1), node('eyes', 'eye', 'Eyes', 'head', 2),
      node('gills', 'gill', `Gill rami (${rami} per side)`, 'head', rami * 2, m.extraRami ? 'duplication' : 'standard'),
      node('forelimbs', 'limb', 'Forelimbs', 'body', 2), node('fore-digits', 'digit', `Front digits (${limbs.frontDigits} per foot)`, 'forelimbs', limbs.frontDigits * 2, limbs.frontDigits > 4 ? 'duplication' : limbs.frontDigits < 4 ? 'reduced' : 'standard'),
      node('hindlimbs', 'limb', 'Hindlimbs', 'body', 2), node('hind-digits', 'digit', `Rear digits (${limbs.rearDigits} per foot)`, 'hindlimbs', limbs.rearDigits * 2, limbs.rearDigits > 5 ? 'duplication' : limbs.rearDigits < 5 ? 'reduced' : 'standard'),
      ...(m.crest ? [node('crest', 'crest', 'Dorsal crest', 'body', 1, 'novel', m.crest)] : []),
      node('tail', 'tail', p.genesis?.fins === 'butterfly' ? 'Tail with sail crest' : p.genesis?.fins === 'veil' ? 'Tail with frilled crest' : 'Tail', 'body', 1),
    ];
  }
  if (p.species === 'goldfish' && p.goldfish) {
    const g = p.goldfish, eyes = g.eyes.kind;
    const lobes = g.tail.kind === 'single' ? 1 : g.tail.kind === 'tri' ? 3 : g.tail.kind === 'quad' ? 4 : 2;
    return [
      node('body', 'body', 'Body', null, 1), node('head', 'head', 'Head', 'body', 1),
      ...(g.head.hood > 0.05 ? [node('wen', 'wen', 'Hood (wen)', 'head', 1, 'novel', Math.round(g.head.hood * 100) / 100)] : []),
      node('eyes', 'eye', eyes === 'normal' ? 'Eyes' : `Eyes (${eyes})`, 'head', 2, eyes === 'normal' ? 'standard' : 'transformation'),
      ...(g.eyes.bubble > 0.05 ? [node('sacs', 'sac', 'Bubble sacs', 'eyes', 2, 'transformation', Math.round(g.eyes.bubble * 100) / 100)] : []),
      ...(g.fins.dorsal === 'absent' ? [] : [node('dorsal', 'dorsal', g.fins.dorsal === 'full' ? 'Dorsal fin' : 'Dorsal remnant', 'body', 1, g.fins.dorsal === 'full' ? 'standard' : 'reduced')]),
      ...(m.secondDorsal ? [node('dorsal-2', 'dorsal', 'Second dorsal fin', 'body', 1, 'duplication', m.secondDorsal)] : []),
      node('pectorals', 'pectoral', 'Pectoral fins', 'body', 2),
      ...(m.doublePectoral ? [node('pectorals-2', 'pectoral', 'Second pectoral pair', 'body', 2, 'duplication', m.doublePectoral)] : []),
      node('pelvics', 'pelvic', 'Pelvic fins', 'body', 2),
      node('anal', 'anal', g.fins.analPaired ? 'Paired anal fins' : 'Anal fin', 'body', g.fins.analPaired ? 2 : 1, g.fins.analPaired ? 'duplication' : 'standard'),
      node('caudal', 'caudal', `Caudal fin (${lobes} lobe${lobes === 1 ? '' : 's'})`, 'body', lobes, lobes > 1 ? 'duplication' : 'standard'),
    ];
  }
  const s = p.structure, lobes = s.tail === 'standard' ? 1 : s.tail === 'paired' ? 2 : 3;
  return [
    node('body', 'body', 'Body', null, 1), node('head', 'head', 'Head', 'body', 1),
    ...(m.wen ? [node('wen', 'wen', 'Wen', 'head', 1, 'novel', m.wen)] : []),
    node('eyes', 'eye', 'Eyes', 'head', 2),
    ...(m.bubble ? [node('sacs', 'sac', 'Bubble-eye sacs', 'eyes', 2, 'transformation', m.bubble)] : []),
    ...(s.barbels ? [node('barbels', 'barbel', 'Barbels', 'head', s.barbels)] : []),
    ...(s.dorsal === 'absent' ? [] : [node('dorsal', 'dorsal', s.dorsal === 'reduced' ? 'Reduced dorsal fin' : 'Dorsal fin', 'body', 1, s.dorsal === 'reduced' ? 'reduced' : 'standard')]),
    ...(m.secondDorsal ? [node('dorsal-2', 'dorsal', 'Second dorsal fin', 'body', 1, 'duplication', m.secondDorsal)] : []),
    node('pectorals', 'pectoral', 'Pectoral fins', 'body', 2), node('pelvics', 'pelvic', 'Pelvic fins', 'body', 2), node('anal', 'anal', 'Anal fin', 'body', 1),
    node('caudal', 'caudal', `Caudal fin (${lobes} lobe${lobes === 1 ? '' : 's'})`, 'body', lobes, lobes > 1 ? 'duplication' : 'standard'),
  ];
}
