/** Genome v1 holds 48 loci per copy; genome v2 appends the 12 Color and Ornament loci (60 per copy). */
export type Genome = { version: 1 | 2; maternal: number[]; paternal: number[] };
export type Mutation = { locus: number; copy: 'maternal' | 'paternal'; from: number; to: number };
export type Fish = {
  id: string; name: string; sex: 'F' | 'M'; genome: Genome; birthSeed: number;
  generation: number; parents: [string, string] | null; bornAt: string;
  tankId: string; status: 'living' | 'sold'; mutations: Mutation[];
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
export type Tank = { id: string; name: string; capacity: number; planted: boolean; water: WaterState };
/** World v2 adds per-tank water (FS-301). World v1 saves migrate with default water. */
export type World = { version: 2; seed: number; nextId: number; credits: number; fish: Fish[]; tanks: Tank[] };
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
