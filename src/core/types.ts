/** Genome v1 holds 48 loci per copy; genome v2 appends the 12 Color and Ornament loci (60 per copy). */
export type Genome = { version: 1 | 2; maternal: number[]; paternal: number[] };
export type Mutation = { locus: number; copy: 'maternal' | 'paternal'; from: number; to: number };
/** Life model v1 state (FS-302). Age, size and condition accumulate on game-day boundaries; genetics only set the potential. */
export type LifeState = {
  model: 1;
  /** Whole game days since the egg was laid, counted at absolute day boundaries. */
  ageDays: number;
  /** Current body length in cm; 0 while still an egg. */
  lengthCm: number;
  /** Developmental condition 0–1: a moving average of recent environment, so deficits and recovery both take days. */
  condition: number;
};
export type Fish = {
  id: string; name: string; sex: 'F' | 'M'; genome: Genome; birthSeed: number;
  generation: number; parents: [string, string] | null; bornAt: string;
  tankId: string; status: 'living' | 'sold'; mutations: Mutation[]; life: LifeState;
};
/** Water model v1 state for one tank (FS-301). Units are explicit; values are game approximations, not care advice. */
export type WaterState = {
  model: 1;
  /** Litres of water. */
  volumeL: number;
  /** Degrees Celsius. */
  temperatureC: number;
  /** Dissolved oxygen, mg O₂ per litre. */
  oxygenMgL: number;
  /** Total ammonia nitrogen proxy, mg N per litre. */
  ammoniaMgL: number;
  /** Uneaten food in grams. */
  foodG: number;
  /** Biofilter nitrification capacity at 20 °C, mg N per game day. */
  filterMgNPerDay: number;
  /** Aeration transfer coefficient (kLa), per game day. */
  aerationPerDay: number;
};
export type Ration = 'off' | 'light' | 'measured' | 'generous' | 'heavy';
/** Care model v1 state for one tank (FS-305). Equipment capacity lives on the water; settings and the feeding day live here. */
export type TankCare = {
  model: 1;
  /** Auto-feeder ration as a multiple of the residents' current food need. */
  ration: Ration;
  /** Thermostat setpoint, whole °C. Water temperature moves toward it at a bounded rate. */
  targetC: number;
  /** Food needed and eaten since the current game day began, grams. */
  dayNeedG: number;
  dayEatenG: number;
  /** Share of the residents' need eaten over the last completed game day, 0–1. */
  fed: number;
};
export type Tank = { id: string; name: string; capacity: number; planted: boolean; water: WaterState; care: TankCare };
/** World v2 added per-tank water (FS-301), v3 fish life state (FS-302), v4 tank care (FS-305). Older saves migrate with defaults. */
export type World = { version: 4; seed: number; nextId: number; credits: number; fish: Fish[]; tanks: Tank[] };
/**
 * Development v2 inherited marking anchor, derived from one phased two-locus haplotype block.
 * Body coordinates: u 0 = snout tip … 1 = peduncle; v −1 = dorsal edge … 1 = ventral edge.
 */
export type MarkingAnchor = {
  key: string; block: number; alleles: [number, number]; origin: 'maternal' | 'paternal' | 'both';
  u: number; v: number; size: number; angle: number; layer: 'warm' | 'dark'; priority: number;
};
export type BaseColor = 'classic' | 'gold' | 'slate' | 'charcoal' | 'lavender' | 'jade';
export type AccentColor = 'classic' | 'crimson' | 'sunflower' | 'cobalt' | 'violet' | 'pearl';
export type DotColor = 'ink' | 'pearl' | 'gold' | 'turquoise' | 'ruby' | 'rainbow';
export type IrisColor = 'natural' | 'amber' | 'ruby' | 'sapphire' | 'emerald' | 'silver';
export type ScaleType = 'smooth' | 'fine' | 'mirror' | 'net' | 'pearl' | 'armor';
export type BodyMotif = 'spots' | 'stripes' | 'marble' | 'calico' | 'rosettes';
export type FinMotif = 'spots' | 'bands' | 'edge' | 'tips' | 'flame';
export type Motif<T extends string> = { kind: T; strength: number };
/**
 * Development v3 appearance from genome v2 chromosomes 9 (Color) and 10 (Ornament). Color lists hold one entry, or two
 * when different variants blend. Motif strength is 1 when homozygous and lower for carriers and mixes.
 */
export type Appearance = {
  base: BaseColor[]; accent: AccentColor[]; dots: DotColor[]; iris: IrisColor[];
  shimmer: number; scales: ScaleType;
  /** Opacity multiplier for the development v2 patches: 0 once two motif copies replace them. */
  patches: number;
  motifs: Motif<BodyMotif>[]; density: number; motifScale: number; contrast: number; reach: number;
  finMotifs: Motif<FinMotif>[];
};
export type Phenotype = {
  length: number; depth: number; taper: number; curve: number; head: number; snout: number;
  eye: number; eyePosition: number; iris: number; pupil: number; mouth: number; barbel: number;
  tail: number; spread: number; fork: number; dorsal: number; pectoral: number; finPigment: number;
  red: number; yellow: number; black: number; white: number; metallic: number; translucency: number;
  frequency: number; patternScale: number; warp: number; symmetry: number; edge: number; speckle: number;
  adultLengthCm: number; growth: number; longevity: number; metabolism: number; oxygen: number;
  fertility: number; speed: number; turning: number; activity: number; social: number; bold: number; curious: number;
  markings: MarkingAnchor[];
  appearance: Appearance;
};
