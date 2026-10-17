import { clamp, hash, random } from './random';
import type { ModuleTraits, SomaticMark } from './modules';

/**
 * Genesis model v1: the species-independent layer that koi genome v4 and axolotl genome v2 share.
 *
 * - **Dominance.** Every allele has a value and a potency. A genotype expresses the potency-weighted mean of its two
 *   values, so a potent allele dominates a weak one and equal potencies are additive. Overdominant loci add a bonus for
 *   two different alleles. Hidden carriers and "two plain parents, one spectacular child" both follow from this.
 * - **Open-ended alleles.** A mutation at a quantitative locus can create a new allele with its own value, potency and
 *   pleiotropic side effects, instead of stepping to a neighbouring catalog allele. Its ID is derived from the birth seed,
 *   so creation stays pure and replayable; the definition travels inside every genome that carries it.
 * - **Genetic load.** Each chromosome copy carries a few hidden deleterious recessives anchored to a locus position. They
 *   are inherited with that position (so they are linked to visible traits) and only act when both copies carry the same
 *   site. Inbreeding raises homozygosity and therefore defects; selection against affected fish purges them.
 * - **Developmental noise.** A per-genome development seed jitters shape within a range that canalization narrows, so
 *   identical genotypes still differ a little and asymmetry is heritable through canalization.
 *
 * Synthetic rules for a game, inspired by real mechanisms. Not a model of koi or axolotl biology.
 */
export const GENESIS_MODEL = 1;
/** Allele IDs at or above this are open-ended (novel) alleles; below it they index the locus catalog. */
export const NOVEL_ID_MIN = 1000;
const NOVEL_ID_SPAN = 2_000_000_000;
export const MAX_NOVEL_PER_GENOME = 144;
export const MAX_LOAD_PER_COPY = 12;
/** Share of mutations at an eligible locus that create a new allele rather than stepping to a catalog neighbour. */
export const NOVEL_SHARE = 0.42;
/** Chance per gamete of a new deleterious recessive appearing at a random load site. */
export const LOAD_MUTATION_RATE = 0.03;

/** Side effects a novel allele can carry beyond its own locus. Values are small signed shifts, interpreted per species. */
export const CHANNELS = ['hue', 'glow', 'sheen', 'size', 'speed', 'metabolism', 'boldness', 'fertility', 'maturity', 'growth', 'pattern', 'fins'] as const;
/**
 * Genesis model 2 (world v18) channels. Model 1 alleles never draw these, so `createNovel` keeps its exact stream; model 2
 * enrichment (`genesis2.ts`) adds them. Canonical order is CHANNELS then these, so model 1 effects serialize unchanged.
 */
export const EXTRA_CHANNELS = ['depth', 'eye', 'contrast', 'longevity'] as const;
export const ALL_CHANNELS = [...CHANNELS, ...EXTRA_CHANNELS] as const;
export type Channel = typeof ALL_CHANNELS[number];
export const CHANNEL_LABELS: Record<Channel, string> = {
  hue: 'color hue', glow: 'glow', sheen: 'sheen', size: 'adult size', speed: 'swimming speed', metabolism: 'metabolism', boldness: 'boldness',
  fertility: 'fertility', maturity: 'maturity age', growth: 'growth rate', pattern: 'pattern density', fins: 'fin length',
  depth: 'body depth', eye: 'eye size', contrast: 'pattern contrast', longevity: 'lifespan',
};
/** How a model 2 allele arose: a small step, a large leap, or a change in dominance with little change in value. */
export type AlleleKind = 'drift' | 'leap' | 'regulatory';
export const ALLELE_KINDS: readonly AlleleKind[] = ['drift', 'leap', 'regulatory'];

export type NovelAllele = {
  id: number;
  /** Locus index in the species' genome. */
  locus: number;
  /** The allele it mutated from: a catalog ID or another novel ID. */
  parent: number;
  /** Expressed value on the locus scale (koi 0–5 levels, axolotl −1…1 effects), allowed slightly beyond the catalog. */
  value: number;
  /** Dominance weight; catalog alleles use 0.3–1, so above 1 dominates every catalog allele. */
  potency: number;
  effects: Partial<Record<Channel, number>>;
  /** Genesis model 2 only: how the allele arose. Model 1 alleles have none. */
  kind?: AlleleKind;
};
/** Load sites present on each chromosome copy, as site IDs from the species load catalog. */
export type LoadCopies = { maternal: number[]; paternal: number[] };
/** Body-plan module genes (Genesis model 2): one small allele array per homolog, in the species' module locus order. */
export type ModuleCopies = { maternal: number[]; paternal: number[] };
/**
 * `model` and `modules` are present only on genomes born under Genesis model 2 (world v18). Their absence means model 1,
 * so every earlier genome keeps its exact shape, expression and draw-op stream.
 */
export type GenesisBlock = { dev: number; load: LoadCopies; novel: NovelAllele[]; model?: 2; modules?: ModuleCopies };
export type GenesisModel = 1 | 2;
export const genesisModelOf = (block: GenesisBlock | undefined): GenesisModel => block?.model === 2 ? 2 : 1;

export type DominanceClass = 'additive' | 'up' | 'down' | 'over';
export const DOMINANCE_LABELS: Record<DominanceClass, string> = {
  additive: 'Additive: both copies count equally',
  up: 'Higher alleles dominant',
  down: 'Lower alleles dominant',
  over: 'Overdominant: two different copies do best',
};

/** Potency of a catalog allele by its index (0–5) under a dominance class. */
export function founderPotency(dominance: DominanceClass, index: number): number {
  if (dominance === 'up') return 0.3 + 0.14 * index;
  if (dominance === 'down') return 1 - 0.14 * index;
  return 1;
}

export type Resolved = { value: number; potency: number; novel: NovelAllele | null };
export const isNovel = (allele: number) => allele >= NOVEL_ID_MIN;
export const novelMap = (block: GenesisBlock | undefined) => new Map((block?.novel ?? []).map(entry => [entry.id, entry]));

/** Expressed value of a genotype: the potency-weighted mean, plus a heterozygote bonus at overdominant loci. */
export function combine(a: Resolved, b: Resolved, dominance: DominanceClass, overBonus: number): number {
  const mean = (a.value * a.potency + b.value * b.potency) / (a.potency + b.potency);
  return dominance === 'over' ? mean + overBonus * Math.abs(a.value - b.value) : mean;
}

/** Each copy's share of the expressed value; how strongly a novel allele's side effects show. */
export const shares = (a: Resolved, b: Resolved): [number, number] => [a.potency / (a.potency + b.potency), b.potency / (a.potency + b.potency)];

/** Sum of every carried novel allele's side effects, weighted by how much each copy is expressed. */
export function channelEffects(pairs: readonly [Resolved, Resolved][]): Partial<Record<Channel, number>> {
  const total: Partial<Record<Channel, number>> = {};
  for (const [a, b] of pairs) {
    const [sa, sb] = shares(a, b);
    for (const [allele, share] of [[a, sa], [b, sb]] as const) {
      if (!allele.novel) continue;
      for (const [channel, amount] of Object.entries(allele.novel.effects) as [Channel, number][]) total[channel] = (total[channel] ?? 0) + amount * share;
    }
  }
  return total;
}

export type NovelScale = { min: number; max: number; step: [number, number]; effect: number };
/** Koi alleles are levels 0–5; axolotl alleles are effects −1…1. Novel values may exceed the catalog by a little. */
export const KOI_SCALE: NovelScale = { min: -0.75, max: 5.9, step: [0.35, 1.6], effect: 0.28 };
export const AXOLOTL_SCALE: NovelScale = { min: -1.35, max: 1.35, step: [0.08, 0.42], effect: 0.28 };
/** Goldfish quantitative alleles share the axolotl −1…1 effect scale. */
export const GOLDFISH_SCALE: NovelScale = AXOLOTL_SCALE;

/** A deterministic novel allele ID for one mutation event. */
export const novelId = (seed: number, copy: string, locus: number) => NOVEL_ID_MIN + hash(`genesis:novel:${seed}:${copy}:${locus}`) % NOVEL_ID_SPAN;

/** Build a new allele from the one it mutated from. Most are small steps; a few are leaps with side effects. */
export function createNovel(rng: () => number, id: number, locus: number, parentId: number, from: Resolved, scale: NovelScale): NovelAllele {
  const u = rng(), size = scale.step[0] + (scale.step[1] - scale.step[0]) * u * u, sign = rng() < 0.5 ? -1 : 1;
  const value = clamp(from.value + sign * size, scale.min, scale.max);
  const potency = Math.round(clamp(from.potency * (0.55 + 0.95 * rng()), 0.12, 1.6) * 1000) / 1000;
  const effects: Partial<Record<Channel, number>> = {};
  const roll = rng(), count = roll < 0.5 ? 0 : roll < 0.88 ? 1 : 2;
  for (let i = 0; i < count; i++) {
    const channel = CHANNELS[Math.floor(rng() * CHANNELS.length)];
    const amount = (rng() < 0.5 ? -1 : 1) * scale.effect * (0.2 + 0.8 * rng());
    effects[channel] = Math.round(((effects[channel] ?? 0) + amount) * 1000) / 1000;
  }
  // Canonical channel order: saves are validated by comparing serialized worlds, and the decoder writes this order.
  const ordered: Partial<Record<Channel, number>> = {};
  for (const channel of CHANNELS) if (effects[channel] !== undefined) ordered[channel] = effects[channel];
  return { id, locus, parent: parentId, value: Math.round(value * 1000) / 1000, potency, effects: ordered };
}

// ── Genetic load ───────────────────────────────────────────────────────────────────────────────────────────────────────

export type DefectKind = 'lethal' | 'frail' | 'subfertile' | 'dwarf' | 'spine' | 'fins' | 'eye' | 'pigment' | 'gill' | 'limb';
export type LoadSite = {
  id: number; code: string; label: string; kind: DefectKind;
  /** Locus index the site sits beside; it is transmitted with that locus' homolog. */
  anchor: number;
  /** Founder frequency weight. */
  weight: number;
  text: string;
};
export const DEFECT_TEXT: Record<DefectKind, string> = {
  lethal: 'Embryo does not develop; the egg never hatches.',
  frail: 'Condition can never rise above a low ceiling.',
  subfertile: 'Lays and sires much smaller clutches.',
  dwarf: 'Stops growing about a third short of its potential.',
  spine: 'A bent spine: a kinked silhouette and slower swimming.',
  fins: 'Ragged, shortened fins. Strong regeneration regrows them.',
  eye: 'Small, clouded eyes.',
  pigment: 'Pale, washed-out blotches across the skin.',
  gill: 'Stunted or deformed gills and poorer oxygen uptake.',
  limb: 'Missing digits. Strong regeneration regrows them.',
};
const site = (id: number, kind: DefectKind, anchor: number, weight: number, label: string): LoadSite =>
  ({ id, code: `L-${id.toString().padStart(2, '0')}`, label, kind, anchor, weight, text: DEFECT_TEXT[kind] });

const LABELS: Record<DefectKind, readonly string[]> = {
  lethal: ['Yolk failure', 'Heart tube defect', 'Neural fold defect', 'Gastrulation arrest', 'Blood island failure', 'Somite fusion', 'Gut tube arrest', 'Kidney agenesis', 'Hatching gland failure', 'Liver bud failure', 'Notochord collapse', 'Membrane rupture'],
  frail: ['Weak constitution', 'Thin blood', 'Poor immunity', 'Weak liver'],
  subfertile: ['Low gamete count', 'Late gonads', 'Fragile eggs', 'Weak milt'],
  dwarf: ['Pituitary dwarfism', 'Short growth plate', 'Stunted frame'],
  spine: ['Curved spine', 'Short vertebrae', 'Kinked spine'],
  fins: ['Fin erosion', 'Fused rays', 'Brittle fins'],
  eye: ['Clouded lens', 'Small eye'],
  pigment: ['Pigment wash', 'Patchy chromatophores', 'Faded skin'],
  gill: ['Stunted gills', 'Short filaments', 'Clubbed gills'],
  limb: ['Missing digits', 'Limb bud failure', 'Fused toes'],
};
/**
 * 40 load sites per species with anchors spread across all twelve chromosomes. Many distinct sites mean two unrelated
 * founders rarely share one, while an inbred line quickly makes its own load homozygous.
 */
function catalogFor(kinds: readonly DefectKind[], salt: string): LoadSite[] {
  const used: Partial<Record<DefectKind, number>> = {};
  return kinds.map((kind, i) => {
    const n = used[kind] ?? 0; used[kind] = n + 1;
    const labels = LABELS[kind], label = n < labels.length ? labels[n] : `${labels[n % labels.length]} ${['II', 'III', 'IV', 'V'][Math.floor(n / labels.length) - 1] ?? n}`;
    const anchor = (i * 29 + (hash(`${salt}:${i}`) % 7)) % 72;
    return site(i + 1, kind, anchor, kind === 'lethal' ? 1.2 : 1, label);
  });
}
const KOI_KINDS: readonly DefectKind[] = [
  'lethal', 'frail', 'spine', 'lethal', 'subfertile', 'fins', 'lethal', 'dwarf', 'pigment', 'lethal', 'eye', 'frail', 'lethal', 'spine', 'subfertile', 'fins',
  'lethal', 'pigment', 'dwarf', 'lethal', 'frail', 'eye', 'lethal', 'spine', 'subfertile', 'fins', 'lethal', 'pigment', 'frail', 'lethal', 'dwarf', 'subfertile',
  'lethal', 'fins', 'spine', 'lethal', 'pigment', 'frail', 'lethal', 'subfertile',
];
const AXOLOTL_KINDS: readonly DefectKind[] = KOI_KINDS.map((kind, i) => kind === 'fins' ? (i % 2 ? 'limb' : 'gill') : kind === 'dwarf' && i > 20 ? 'gill' : kind === 'eye' && i > 20 ? 'limb' : kind);
/** Koi load sites. */
export const KOI_LOAD: readonly LoadSite[] = catalogFor(KOI_KINDS, 'koi-load');
/** Axolotl load sites, anchored across the 72-locus axolotl genome v2. */
export const AXOLOTL_LOAD: readonly LoadSite[] = catalogFor(AXOLOTL_KINDS, 'axolotl-load');
/** Goldfish load (world v17): curled-gill and eye defects replace some dwarf and eye sites, fin erosion stays. */
const GOLDFISH_KINDS: readonly DefectKind[] = KOI_KINDS.map((kind, i) => kind === 'dwarf' && i > 20 ? 'gill' : kind === 'pigment' && i > 30 ? 'eye' : kind);
export const GOLDFISH_LOAD: readonly LoadSite[] = catalogFor(GOLDFISH_KINDS, 'goldfish-load');
export const loadCatalog = (species: 'koi' | 'axolotl' | 'goldfish') => species === 'koi' ? KOI_LOAD : species === 'axolotl' ? AXOLOTL_LOAD : GOLDFISH_LOAD;

/**
 * About 1.6 hidden recessives per founder chromosome copy (a few founders carry none, a few carry four). A founder never
 * expresses its own load: the second copy avoids the first copy's sites.
 */
export function founderLoad(rng: () => number, catalog: readonly LoadSite[], avoid: readonly number[] = []): number[] {
  const roll = rng(), count = roll < 0.12 ? 0 : roll < 0.42 ? 1 : roll < 0.74 ? 2 : roll < 0.93 ? 3 : 4;
  const pool = catalog.filter(entry => !avoid.includes(entry.id)), total = pool.reduce((sum, entry) => sum + entry.weight, 0), sites = new Set<number>();
  for (let i = 0; i < count; i++) {
    let draw = rng() * total;
    const chosen = pool.find(entry => (draw -= entry.weight) < 0) ?? pool[pool.length - 1];
    sites.add(chosen.id);
  }
  return [...sites].sort((a, b) => a - b);
}
/** A founder's two load copies, never homozygous at any site. */
export function founderLoadPair(rng: () => number, catalog: readonly LoadSite[]): LoadCopies {
  const maternal = founderLoad(rng, catalog);
  return { maternal, paternal: founderLoad(rng, catalog, maternal) };
}

/** One gamete's load: each site travels with the homolog transmitted at its anchor locus, plus rare new load. */
export function transmitLoad(load: LoadCopies, sides: readonly (0 | 1)[], catalog: readonly LoadSite[], rng: () => number): number[] {
  const byId = new Map(catalog.map(entry => [entry.id, entry])), out = new Set<number>();
  for (const [copy, side] of [[load.maternal, 0], [load.paternal, 1]] as const) {
    for (const id of copy) { const entry = byId.get(id); if (entry && sides[entry.anchor] === side) out.add(id); }
  }
  if (rng() < LOAD_MUTATION_RATE) out.add(catalog[Math.floor(rng() * catalog.length)].id);
  return [...out].sort((a, b) => a - b).slice(0, MAX_LOAD_PER_COPY);
}

/** Sites carried on both copies: the defects a fish expresses. */
export const homozygousSites = (load: LoadCopies) => load.maternal.filter(id => load.paternal.includes(id));
/** Sites carried on exactly one copy: hidden, but passed to half the offspring. */
export const carriedSites = (load: LoadCopies) => [...new Set([...load.maternal, ...load.paternal])].filter(id => !(load.maternal.includes(id) && load.paternal.includes(id)));

/**
 * Hybrid vigor from genome-wide heterozygosity: 0.8 at none, 1.05 at a typical founder's 60%, up to 1.11 for a wide
 * outcross. Inbred lines lose it; crossing two inbred lines restores it (heterosis).
 */
export const vigorFor = (heterozygosity: number) => 0.8 + 0.25 * clamp(heterozygosity / 0.6, 0, 1.25);

/** A symmetric noise stream for one genome's development: values in −1…1. */
export function developmentNoise(dev: number): () => number {
  const rng = random(hash(`genesis:dev:${dev}`));
  return () => rng() * 2 - 1;
}

export type GenesisDefect = { site: number; code: string; kind: DefectKind; label: string; rescued: boolean };
/** Development v6 traits a Genesis phenotype adds; legacy phenotypes have none. */
export type GenesisTraits = {
  model: 1;
  /** Fin program: standard, or the dominant veil, or two veil copies' butterfly fins (axolotls: frilled and sail crests). */
  fins: 'standard' | 'veil' | 'butterfly';
  /** 0 normal pigment … 1 every color silenced by the pigment cascade. */
  ghost: number;
  /** Photophore or fluorescent glow 0–1, and its hue in degrees. */
  glow: number; glowHue: number;
  /** Hue rotation of the accent color from novel alleles, degrees. */
  hueShift: number;
  sheen: number;
  /** 0 noisy, asymmetric development … 1 tightly canalized. */
  canalization: number;
  asymmetry: number;
  /** Game days from hatching before the animal may court. */
  maturityDays: number;
  regeneration: number;
  vigor: number;
  heterozygosity: number;
  /** Share of scarce food this animal wins against tankmates, relative 0.05–1.3. */
  competitiveness: number;
  /** Highest condition the animal can reach (frail load lowers it). */
  conditionCap: number;
  /** Multiplier on clutch size from fertility, vigor and load. */
  clutchFactor: number;
  /** Relative respiration per unit of body mass, after fin and glow costs. */
  oxygenDemand: number;
  /** False when a lethal recessive is homozygous: the egg never develops. */
  viable: boolean;
  defects: GenesisDefect[];
  finFray: number; eyeCloud: number; depigment: number;
  /** Signed spinal bend from a spine defect, in body lengths at its peak; 0 when straight. */
  kink: number;
  novelAlleles: number;
  /** Axolotl only. */
  extraDigits?: number; plume?: boolean;
  /** Genesis model 2 (development v7) only: expressed body-plan modules and a one-off somatic mark. */
  modules?: ModuleTraits;
  somatic?: SomaticMark | null;
};

export function defectsFor(load: LoadCopies, catalog: readonly LoadSite[], regeneration: number): GenesisDefect[] {
  const byId = new Map(catalog.map(entry => [entry.id, entry]));
  return homozygousSites(load).flatMap(id => {
    const entry = byId.get(id);
    if (!entry) return [];
    const rescued = (entry.kind === 'fins' || entry.kind === 'limb') && regeneration >= 0.72;
    return [{ site: id, code: entry.code, kind: entry.kind, label: entry.label, rescued }];
  });
}

/** Validation shared by both species: bounded sizes and known IDs. */
export function genesisProblem(block: unknown, catalog: readonly LoadSite[], lociCount: number, eligible: (locus: number) => boolean, moduleAlleles: readonly number[] = []): string | null {
  if (!block || typeof block !== 'object') return 'Genesis genomes need a development block.';
  const value = block as Partial<GenesisBlock>;
  if (!Number.isInteger(value.dev) || value.dev! < 0 || value.dev! > 4294967295) return 'Invalid development seed.';
  if (!value.load || !Array.isArray(value.load.maternal) || !Array.isArray(value.load.paternal)) return 'Invalid genetic load.';
  const ids = new Set(catalog.map(entry => entry.id));
  for (const copy of [value.load.maternal, value.load.paternal]) {
    if (copy.length > MAX_LOAD_PER_COPY || copy.some(id => !ids.has(id)) || new Set(copy).size !== copy.length) return 'Invalid genetic load site.';
  }
  if (!Array.isArray(value.novel) || value.novel.length > MAX_NOVEL_PER_GENOME) return 'Invalid novel allele list.';
  const seen = new Set<number>();
  for (const entry of value.novel) {
    if (!entry || !Number.isInteger(entry.id) || entry.id < NOVEL_ID_MIN || seen.has(entry.id)) return 'Invalid novel allele ID.';
    seen.add(entry.id);
    if (!Number.isInteger(entry.locus) || entry.locus < 0 || entry.locus >= lociCount || !eligible(entry.locus)) return 'A novel allele sits at an unsupported locus.';
    if (!Number.isFinite(entry.value) || !Number.isFinite(entry.potency) || entry.potency <= 0 || entry.potency > 2) return 'Invalid novel allele value.';
    const channels: readonly string[] = value.model === 2 ? ALL_CHANNELS : CHANNELS;
    if (!entry.effects || typeof entry.effects !== 'object' || Object.entries(entry.effects).some(([channel, amount]) => !channels.includes(channel) || !Number.isFinite(amount) || Math.abs(amount as number) > 1)) return 'Invalid novel allele effect.';
    if (entry.kind !== undefined && (value.model !== 2 || !ALLELE_KINDS.includes(entry.kind))) return 'Invalid novel allele kind.';
  }
  if (value.model === undefined) return value.modules === undefined ? null : 'Only Genesis model 2 genomes carry module genes.';
  if (value.model !== 2) return 'Unsupported Genesis model.';
  // Module genes: one allele per module locus on each homolog, within that locus' allele range.
  const modules = value.modules;
  if (!modules || !Array.isArray(modules.maternal) || !Array.isArray(modules.paternal)) return 'Genesis model 2 genomes need module genes.';
  for (const copy of [modules.maternal, modules.paternal]) {
    if (copy.length !== moduleAlleles.length || copy.some((allele, i) => !Number.isInteger(allele) || allele < 0 || allele >= moduleAlleles[i])) return 'Invalid module gene.';
  }
  return null;
}

/** The novel definitions a child must carry: every novel ID present in its homologs, from either parent or new. */
export function carriedNovel(maternal: readonly number[], paternal: readonly number[], pool: ReadonlyMap<number, NovelAllele>): NovelAllele[] {
  const ids = new Set([...maternal, ...paternal].filter(isNovel));
  return [...ids].sort((a, b) => a - b).map(id => pool.get(id)!).filter(Boolean);
}
