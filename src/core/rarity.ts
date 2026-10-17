import { CARRIER_STRENGTH, SHIMMER_VISIBLE } from './appearance';
import { axolotlColorName, axolotlFounderGenome } from './axolotlGenetics';
import { GENOME_VERSION, MUTATION_RATE } from './catalog';
import { express, founderGenome, inherit } from './genetics';
import { goldfishFounderGenome } from './goldfishGenetics';
import { SOMATIC_LABELS } from './modules';
import { hash } from './random';
import type { CreatureGenome, Phenotype, Species } from './types';

/**
 * Trait rarity for every species (inspector, cards and the shop). Each visible trait value is placed on one six-step
 * ladder by how often it shows in a fixed reference population: first-generation offspring of unrelated founder stock,
 * bred under Genesis model 2. The reference is deterministic and the same for every world, so rarity says how unusual a
 * look is in domestic stock, never how many exist in a player's aquarium or anywhere online.
 *
 * Display only. Buyer prices keep their own founder-frequency rarity (`appearance.ts`), so saves and pricing are unchanged.
 */
export const RARITY_TIERS = ['common', 'uncommon', 'rare', 'very rare', 'epic', 'legendary'] as const;
export type RarityTier = typeof RARITY_TIERS[number];
/** Lowest reference frequency for each tier; anything rarer than epic, including values never seen in the reference, is legendary. */
const FLOORS: Record<Exclude<RarityTier, 'legendary'>, number> = { common: 0.25, uncommon: 0.08, rare: 0.02, 'very rare': 0.005, epic: 0.0012 };
export const tierFor = (frequency: number): RarityTier =>
  frequency >= FLOORS.common ? 'common' : frequency >= FLOORS.uncommon ? 'uncommon' : frequency >= FLOORS.rare ? 'rare' : frequency >= FLOORS['very rare'] ? 'very rare' : frequency >= FLOORS.epic ? 'epic' : 'legendary';
export const tierRank = (tier: RarityTier) => RARITY_TIERS.indexOf(tier);

type Extractor = { trait: string; value: (p: Phenotype, genome: CreatureGenome) => string };
const sizeClass = (cm: number, small: number, large: number) => cm <= small ? 'Miniature' : cm >= large ? 'Giant' : 'Typical size';
const somatic = (p: Phenotype) => p.genesis?.somatic ? SOMATIC_LABELS[p.genesis.somatic.kind] : 'None';
const title = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Canonical, display-ready classes: one value per visible variant, so combinations of unrelated features never inflate rarity. */
const MOTIF_LABELS: Record<string, string> = { spots: 'fine spots', stripes: 'tiger stripes', marble: 'marbling', calico: 'calico flecks', rosettes: 'rosettes' };
const FIN_LABELS: Record<string, string> = { spots: 'spotted fins', bands: 'banded fins', edge: 'colored fin edges', tips: 'dark fin tips', flame: 'flame rays' };
const motifs = (list: readonly { kind: string; strength: number }[], labels: Record<string, string>, none: string) => list.length
  ? title([...list].sort((a, b) => a.kind.localeCompare(b.kind)).map(m => `${m.strength <= CARRIER_STRENGTH ? 'faint ' : ''}${labels[m.kind] ?? m.kind}`).join(' and ')) : none;
const KOI: Extractor[] = [
  { trait: 'Body color', value: p => p.appearance.base[0] === 'classic' ? 'Classic' : title(p.appearance.base.join(' and ')) },
  { trait: 'Accent color', value: p => p.appearance.accent[0] === 'classic' ? 'Classic orange' : title(p.appearance.accent.join(' and ')) },
  { trait: 'Eyes', value: p => p.appearance.iris[0] === 'natural' ? 'Natural' : title(p.appearance.iris.join(' and ')) },
  { trait: 'Body pattern', value: p => motifs(p.appearance.motifs, MOTIF_LABELS, 'Classic patches') },
  { trait: 'Fin pattern', value: p => motifs(p.appearance.finMotifs, FIN_LABELS, 'Plain fins') },
  { trait: 'Scales', value: p => title(p.appearance.scales) },
  { trait: 'Shimmer', value: p => p.appearance.shimmer >= 0.7 ? 'Strong shimmer' : p.appearance.shimmer >= SHIMMER_VISIBLE ? 'Soft shimmer' : 'None' },
  { trait: 'Fin program', value: p => ({ standard: 'Standard fins', veil: 'Veil fins', butterfly: 'Butterfly fins' })[p.genesis?.fins ?? 'standard'] },
  { trait: 'Pigment', value: p => (p.genesis?.ghost ?? 0) >= 0.9 ? 'Ghost' : (p.genesis?.ghost ?? 0) > 0.3 ? 'Faded' : 'Full color' },
  { trait: 'Glow', value: p => (p.genesis?.glow ?? 0) >= 0.7 ? 'Radiant photophores' : (p.genesis?.glow ?? 0) > 0.05 ? 'Faint photophores' : 'None' },
  { trait: 'Tail', value: p => ({ standard: 'Single tail', paired: 'Twin tail', crown: 'Crown tail' })[p.structure.tail] },
  { trait: 'Dorsal', value: p => `${({ normal: 'Dorsal fin', reduced: 'Reduced dorsal', absent: 'No dorsal' })[p.structure.dorsal]}${p.genesis?.modules?.secondDorsal ? ' + second dorsal' : ''}` },
  { trait: 'Barbels', value: p => `${p.structure.barbels} barbels` },
  { trait: 'Head', value: p => (p.genesis?.modules?.wen ? 'Wen' : 'Smooth') },
  { trait: 'Eye sacs', value: p => (p.genesis?.modules?.bubble ? 'Bubble eyes' : 'None') },
  { trait: 'Size', value: p => sizeClass(p.adultLengthCm, 30, 88) },
  { trait: 'Somatic mark', value: somatic },
];
const AXOLOTL: Extractor[] = [
  { trait: 'Morph', value: p => title((p.axolotl?.pigmentation.morph ?? 'wild').replace('-like', '')) },
  { trait: 'Skin color', value: p => title(p.axolotl ? axolotlColorName(p.axolotl.pigmentation.bodyColor) : '—') },
  { trait: 'Pattern', value: p => title(p.axolotl?.pattern.modes.join(' and ') || 'plain') },
  { trait: 'Skin texture', value: p => title(p.axolotl?.pigmentation.texture ?? '—') },
  { trait: 'Tail crest', value: p => ({ standard: 'Standard tail', veil: 'Frilled crest', butterfly: 'Sail crest' })[p.genesis?.fins ?? 'standard'] },
  { trait: 'Gills', value: p => `${p.genesis?.plume ? 'Plume gills' : 'Standard gills'}${p.genesis?.modules?.extraRami ? ', four rami' : ''}` },
  { trait: 'Digits', value: p => p.axolotl ? `${p.axolotl.morphology.limbs.frontDigits} front · ${p.axolotl.morphology.limbs.rearDigits} rear` : '—' },
  { trait: 'Dorsal crest', value: p => (p.genesis?.modules?.crest ? 'Crested' : 'Smooth back') },
  { trait: 'Fluorescence', value: p => ((p.genesis?.glow ?? 0) >= 0.5 ? 'Fluorescent' : 'None') },
  { trait: 'Size', value: p => sizeClass(p.adultLengthCm, 16, 30) },
  { trait: 'Somatic mark', value: somatic },
];
const GOLDFISH: Extractor[] = [
  { trait: 'Variety', value: p => p.goldfish?.variety.label ?? '—' },
  { trait: 'Color', value: p => p.goldfish?.variety.color ?? '—' },
  { trait: 'Pattern', value: p => title(p.goldfish?.pattern.modes.join(' and ') || 'solid') },
  { trait: 'Tail', value: p => ({ single: 'Single tail', tri: 'Tri tail', twin: 'Twin tail', quad: 'Four-lobed tail' })[p.goldfish?.tail.kind ?? 'single'] + (p.goldfish?.tail.butterfly ? ', butterfly' : p.goldfish?.tail.veil ? ', veil' : '') },
  { trait: 'Eyes', value: p => title(p.goldfish?.eyes.kind ?? 'normal') + ((p.goldfish?.eyes.bubble ?? 0) > 0.05 ? ' with bubbles' : '') },
  { trait: 'Head', value: p => ({ none: 'No hood', crown: 'Crown hood', cheeks: 'Cheek hood', full: 'Full hood' })[p.goldfish?.head.hoodKind ?? 'none'] + ((p.goldfish?.head.pompon ?? 0) > 0.05 ? ', pompons' : '') },
  { trait: 'Scales', value: p => title(p.goldfish?.scales.type ?? 'metallic') + ((p.goldfish?.scales.pearl ?? 0) > 0.4 ? ', pearl' : '') },
  { trait: 'Dorsal', value: p => title(p.goldfish?.fins.dorsal ?? 'full') + (p.genesis?.modules?.secondDorsal ? ' + second dorsal' : '') },
  { trait: 'Pectorals', value: p => (p.genesis?.modules?.doublePectoral ? 'Two pairs' : 'One pair') },
  { trait: 'Size', value: p => sizeClass(p.adultLengthCm, 9, 26) },
  { trait: 'Somatic mark', value: somatic },
];
const EXTRACTORS: Record<Species, Extractor[]> = { koi: KOI, axolotl: AXOLOTL, goldfish: GOLDFISH };

/** Reference size: large enough that one sighting means "epic", small enough to build in a few hundred milliseconds. */
export const REFERENCE_SIZE = 800;
type Reference = { frequencies: Map<string, Map<string, number>>; scores: number[] };
const references = new Map<Species, Reference>();

function founderFor(species: Species, seed: number): CreatureGenome {
  return species === 'koi' ? founderGenome(seed, GENOME_VERSION) : species === 'axolotl' ? axolotlFounderGenome(seed, 2) : goldfishFounderGenome(seed);
}

/**
 * Rarity points: the surprise of each trait value beyond "common", in bits, summed over traits. A value never seen in the
 * reference counts as if seen half a time.
 */
const surprise = (frequency: number) => Math.max(0, Math.log2(FLOORS.common / Math.max(frequency, 0.5 / REFERENCE_SIZE)));

function build(species: Species): Reference {
  const counts = new Map<string, Map<string, number>>(EXTRACTORS[species].map(extractor => [extractor.trait, new Map()])), sampled: string[][] = [];
  for (let i = 0; i < REFERENCE_SIZE; i++) {
    // One unrelated pair per animal: siblings would share rare values and make the reference look less varied than stock.
    const family = i, mother = founderFor(species, hash(`rarity:${species}:mother:${family}`)), father = founderFor(species, hash(`rarity:${species}:father:${family}`));
    const genome = inherit(mother, father, hash(`rarity:${species}:child:${i}`), MUTATION_RATE, GENOME_VERSION, undefined, 2).genome, p = express(genome);
    sampled.push(EXTRACTORS[species].map(extractor => {
      const tally = counts.get(extractor.trait)!, value = extractor.value(p, genome);
      tally.set(value, (tally.get(value) ?? 0) + 1);
      return value;
    }));
  }
  const frequencies = new Map([...counts].map(([trait, tally]) => [trait, new Map([...tally].map(([value, n]) => [value, n / REFERENCE_SIZE]))]));
  // The specimen tier is calibrated on the reference's own scores, so "legendary" stays as rare as its trait meaning.
  // Each reference animal is scored without itself (leave-one-out), exactly as an animal outside the reference is.
  const scores = sampled.map(values => values.reduce((sum, value, i) => sum + surprise(frequencies.get(EXTRACTORS[species][i].trait)!.get(value)! - 1 / REFERENCE_SIZE), 0)).sort((a, b) => a - b);
  return { frequencies, scores };
}

/** Frequencies of every trait value in the reference population, built once per species on first use. */
export function reference(species: Species): Map<string, Map<string, number>> {
  let cached = references.get(species);
  if (!cached) { cached = build(species); references.set(species, cached); }
  return cached.frequencies;
}

export type RarityRow = { trait: string; value: string; tier: RarityTier; frequency: number };
/** `share` is the fraction of reference animals at least as rare overall; the specimen tier reads it like a trait frequency. */
export type RarityReport = { rows: RarityRow[]; tier: RarityTier; score: number; share: number; standouts: number };

const reports = new WeakMap<object, RarityReport>();
/** Trait-by-trait rarity of one animal's adult genetic potential, plus an overall tier and score. Memoized per genome. */
export function rarityOf(species: Species, genome: CreatureGenome): RarityReport {
  const cached = reports.get(genome);
  if (cached) return cached;
  const table = reference(species), scores = references.get(species)!.scores, p = express(genome);
  const rows = EXTRACTORS[species].map(extractor => {
    const value = extractor.value(p, genome), frequency = table.get(extractor.trait)?.get(value) ?? 0;
    return { trait: extractor.trait, value, tier: tierFor(frequency), frequency };
  });
  const bits = rows.reduce((sum, row) => sum + surprise(row.frequency), 0);
  // Share of the reference scoring at least as high (binary search over the sorted scores).
  let low = 0, high = scores.length;
  while (low < high) { const mid = (low + high) >> 1; if (scores[mid] < bits - 1e-9) low = mid + 1; else high = mid; }
  const share = (scores.length - low) / scores.length;
  const standouts = rows.filter(row => tierRank(row.tier) >= tierRank('rare')).length;
  const report = { rows, tier: tierFor(share), score: Math.round(bits * 10), share, standouts };
  reports.set(genome, report);
  return report;
}

export const RARITY_NOTE = 'Rarity compares each trait with first-generation offspring of unrelated founder stock: not your aquarium, and not any online population.';
