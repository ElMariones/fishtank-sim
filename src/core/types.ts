export type Genome = { version: 1; maternal: number[]; paternal: number[] };
export type Mutation = { locus: number; copy: 'maternal' | 'paternal'; from: number; to: number };
export type Fish = {
  id: string; name: string; sex: 'F' | 'M'; genome: Genome; birthSeed: number;
  generation: number; parents: [string, string] | null; bornAt: string;
  tankId: string; status: 'living' | 'sold'; mutations: Mutation[];
};
export type Tank = { id: string; name: string; capacity: number; planted: boolean };
export type World = { version: 1; seed: number; nextId: number; credits: number; fish: Fish[]; tanks: Tank[] };
/**
 * Development v2 inherited marking anchor, derived from one phased two-locus haplotype block.
 * Body coordinates: u 0 = snout tip … 1 = peduncle; v −1 = dorsal edge … 1 = ventral edge.
 */
export type MarkingAnchor = {
  key: string; block: number; alleles: [number, number]; origin: 'maternal' | 'paternal' | 'both';
  u: number; v: number; size: number; angle: number; layer: 'warm' | 'dark'; priority: number;
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
};
