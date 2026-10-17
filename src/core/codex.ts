import { express } from './genetics';
import { GOLDFISH_VARIETY_LABELS, GOLDFISH_VARIETY_RARITY, type GoldfishVariety } from './goldfishGenetics';
import type { Fish, Phenotype, Species, World } from './types';

/**
 * The Codex (R-202, world v18): a gallery of named phenotypes. Each entry is recognized from an animal's expressed adult
 * phenotype; the first animal hatched in this world that shows it is credited with the discovery, and the entry stays
 * discovered after that animal is sold. Entry keys are save data and must never be renamed or removed.
 *
 * Discovery runs only in Genesis model 2 worlds, so recorded journals replay unchanged; a migrated world credits the
 * animals it already bred when it moves to model 2.
 */
export const CODEX_MODEL = 1;
export type CodexDiscovery = { key: string; fishId: string; day: number };
export type CodexState = { model: 1; entries: CodexDiscovery[] };
export const emptyCodex = (): CodexState => ({ model: 1, entries: [] });

/** 1 uncommon in bred stock … 4 legendary: needs a deliberate, multi-generation program. Labels share the rarity ladder. */
export type CodexTier = 1 | 2 | 3 | 4;
export type CodexEntry = { key: string; species: Species; name: string; tier: CodexTier; text: string; test: (p: Phenotype) => boolean };

const koi = (key: string, name: string, tier: CodexTier, text: string, test: (p: Phenotype) => boolean): CodexEntry => ({ key: `koi:${key}`, species: 'koi', name, tier, text, test });
const axo = (key: string, name: string, tier: CodexTier, text: string, test: (p: Phenotype) => boolean): CodexEntry => ({ key: `axolotl:${key}`, species: 'axolotl', name, tier, text, test });
const gold = (key: string, name: string, tier: CodexTier, text: string, test: (p: Phenotype) => boolean): CodexEntry => ({ key: `goldfish:${key}`, species: 'goldfish', name, tier, text, test });

const g = (p: Phenotype) => p.genesis;
const m = (p: Phenotype) => p.genesis?.modules;
const isKoi = (p: Phenotype) => !p.species;

const KOI_ENTRIES: CodexEntry[] = [
  koi('veil', 'Veiltail', 1, 'One dominant veil copy: long, translucent flowing fins.', p => isKoi(p) && g(p)?.fins === 'veil'),
  koi('butterfly', 'Butterfly', 2, 'Two veil copies: the longest fins and streamers.', p => isKoi(p) && g(p)?.fins === 'butterfly'),
  koi('ghost', 'Ghost', 2, 'Two null pigment-cascade copies silence every color.', p => isKoi(p) && (g(p)?.ghost ?? 0) >= 0.9),
  koi('faded', 'Faded', 1, 'A weak pigment cascade: colors show, washed out.', p => isKoi(p) && (g(p)?.ghost ?? 0) > 0.3 && (g(p)?.ghost ?? 0) < 0.9),
  koi('lantern', 'Lantern', 2, 'Two photophore copies light the flank.', p => isKoi(p) && (g(p)?.glow ?? 0) >= 0.7),
  koi('ghost-lantern', 'Ghost Lantern', 3, 'A colorless ghost whose photophores glow.', p => isKoi(p) && (g(p)?.ghost ?? 0) >= 0.5 && (g(p)?.glow ?? 0) >= 0.5),
  koi('paired', 'Twin Tail', 2, 'Paired caudal lobes from the recessive tail topology.', p => isKoi(p) && p.structure.tail === 'paired'),
  koi('crown', 'Crown Tail', 3, 'Three caudal lobes.', p => isKoi(p) && p.structure.tail === 'crown'),
  koi('inkblot-crown', 'Inkblot Crown', 4, 'A crown tail on a heavily inked body.', p => isKoi(p) && p.structure.tail === 'crown' && p.black >= 0.55),
  koi('bald', 'Bald Back', 2, 'No dorsal fin at all.', p => isKoi(p) && p.structure.dorsal === 'absent'),
  koi('six-whisker', 'Six-Whisker', 2, 'Three pairs of barbels.', p => isKoi(p) && p.structure.barbels === 6),
  koi('mirror', 'Mirror Scale', 1, 'Large, sparse mirror scales.', p => isKoi(p) && p.appearance.scales === 'mirror'),
  koi('armor', 'Armored', 2, 'Heavy plated armor scales.', p => isKoi(p) && p.appearance.scales === 'armor'),
  koi('rainbow', 'Rainbow Dotted', 2, 'Rainbow-dominant dot color.', p => isKoi(p) && p.appearance.dots.includes('rainbow')),
  koi('giant', 'Giant', 2, 'An adult potential of 88 cm or more.', p => isKoi(p) && p.adultLengthCm >= 88),
  koi('miniature', 'Miniature', 2, 'An adult potential of 30 cm or less.', p => isKoi(p) && p.adultLengthCm <= 30),
  koi('shifted-hue', 'Shifted Hue', 2, 'New alleles rotate the accent color far from any catalog color.', p => isKoi(p) && Math.abs(g(p)?.hueShift ?? 0) >= 40),
  koi('twin-sail', 'Twin Sail', 3, 'A duplicated dorsal fin: a second sail behind the first.', p => isKoi(p) && (m(p)?.secondDorsal ?? 0) > 0),
  koi('lionhead', 'Lionhead Koi', 3, 'A raspberry wen grows over the head.', p => isKoi(p) && (m(p)?.wen ?? 0) > 0),
  koi('bubble-eye', 'Bubble-Eye Koi', 3, 'Two sac copies grow fluid pouches under the eyes.', p => isKoi(p) && (m(p)?.bubble ?? 0) > 0),
  koi('dragon', 'Dragon', 4, 'A wen and a second dorsal fin on the same fish.', p => isKoi(p) && (m(p)?.wen ?? 0) > 0 && (m(p)?.secondDorsal ?? 0) > 0),
  koi('veiled-sail', 'Veiled Sail', 4, 'Veil or butterfly fins on a twin-sail body.', p => isKoi(p) && (m(p)?.secondDorsal ?? 0) > 0 && g(p)?.fins !== undefined && g(p)?.fins !== 'standard'),
  koi('mosaic', 'Mosaic', 3, 'A somatic patch of differently colored skin. Never inherited.', p => isKoi(p) && g(p)?.somatic?.kind === 'mosaic'),
  koi('birthmark', 'Birthmarked', 1, 'A small unique mark from development. Never inherited.', p => isKoi(p) && g(p)?.somatic?.kind === 'birthmark'),
];

const AXOLOTL_ENTRIES: CodexEntry[] = [
  axo('leucistic', 'Leucistic', 1, 'Pale skin with dark eyes.', p => p.axolotl?.pigmentation.morph === 'leucistic-like'),
  axo('albino', 'Albino', 2, 'No melanin: pale skin and light eyes.', p => p.axolotl?.pigmentation.morph === 'albino-like'),
  axo('melanoid', 'Melanoid', 2, 'Dark, without iridophore flecks.', p => p.axolotl?.pigmentation.morph === 'melanoid-like'),
  axo('axanthic', 'Axanthic', 2, 'No yellow pigment: grey tones.', p => p.axolotl?.pigmentation.morph === 'axanthic-like'),
  axo('fluorescent', 'Fluorescent', 2, 'A dominant green glow over skin and gills.', p => p.species === 'axolotl' && (g(p)?.glow ?? 0) >= 0.5),
  axo('frilled', 'Frilled', 2, 'One frill copy: a tall ruffled tail crest.', p => p.species === 'axolotl' && g(p)?.fins === 'veil'),
  axo('sail', 'Sailback', 3, 'Two frill copies: a sail of a tail fin.', p => p.species === 'axolotl' && g(p)?.fins === 'butterfly'),
  axo('plume', 'Plume Gills', 2, 'Two recessive plume copies: huge feathery gills.', p => p.species === 'axolotl' && Boolean(g(p)?.plume)),
  axo('many-toed', 'Many-Toed', 2, 'Extra digits from the digit program.', p => p.species === 'axolotl' && (g(p)?.extraDigits ?? 0) > 0),
  axo('polydactyl', 'Polydactyl', 3, 'Polydactyly module: more digits than the digit program alone allows.', p => p.species === 'axolotl' && (m(p)?.polydactyly ?? 0) > 0),
  axo('four-rami', 'Four-Ramus', 3, 'A fourth gill ramus on each side.', p => p.species === 'axolotl' && (m(p)?.extraRami ?? 0) > 0),
  axo('crested', 'Crested', 3, 'A membrane crest runs along the back toward the head.', p => p.species === 'axolotl' && (m(p)?.crest ?? 0) > 0),
  axo('ghost-walker', 'Ghost Walker', 4, 'A pale leucistic animal with a dorsal crest and extra digits.', p => p.axolotl?.pigmentation.morph === 'leucistic-like' && (m(p)?.crest ?? 0) > 0 && ((m(p)?.polydactyly ?? 0) > 0 || (g(p)?.extraDigits ?? 0) > 0)),
  axo('dragon', 'Dragon Axolotl', 4, 'A crest, a sail and a fourth gill ramus together.', p => p.species === 'axolotl' && (m(p)?.crest ?? 0) > 0 && (m(p)?.extraRami ?? 0) > 0 && g(p)?.fins !== 'standard'),
  axo('giant', 'Giant', 2, 'An adult potential of 30 cm or more.', p => p.species === 'axolotl' && p.adultLengthCm >= 30),
  axo('mosaic', 'Mosaic', 3, 'A somatic patch of differently colored skin. Never inherited.', p => p.species === 'axolotl' && g(p)?.somatic?.kind === 'mosaic'),
  axo('birthmark', 'Birthmarked', 1, 'A small unique mark from development. Never inherited.', p => p.species === 'axolotl' && g(p)?.somatic?.kind === 'birthmark'),
];

const VARIETIES = Object.keys(GOLDFISH_VARIETY_LABELS) as GoldfishVariety[];
const GOLDFISH_ENTRIES: CodexEntry[] = [
  ...VARIETIES.map(variety => gold(variety, GOLDFISH_VARIETY_LABELS[variety], Math.min(4, GOLDFISH_VARIETY_RARITY[variety] + 1) as CodexTier,
    'A recognized goldfish variety.', p => p.goldfish?.variety.id === variety)),
  gold('blue', 'Blue', 2, 'Two recessive blue copies.', p => p.goldfish?.variety.color === 'Blue'),
  gold('chocolate', 'Chocolate', 2, 'Two recessive chocolate copies.', p => p.goldfish?.variety.color === 'Chocolate'),
  gold('lavender', 'Lavender', 3, 'Lavender dilution.', p => p.goldfish?.variety.color === 'Lavender'),
  gold('albino', 'Albino', 3, 'No melanin, pink eyes.', p => Boolean(p.goldfish?.color.albino)),
  gold('calico', 'Calico', 2, 'Nacreous calico pattern.', p => Boolean(p.goldfish?.pattern.modes.includes('calico'))),
  gold('panda', 'Panda', 3, 'Black-and-white panda pattern.', p => Boolean(p.goldfish?.pattern.modes.includes('panda'))),
  gold('mosaic', 'Mosaic', 3, 'A somatic patch of differently colored skin. Never inherited.', p => p.species === 'goldfish' && g(p)?.somatic?.kind === 'mosaic'),
  gold('birthmark', 'Birthmarked', 1, 'A small unique mark from development. Never inherited.', p => p.species === 'goldfish' && g(p)?.somatic?.kind === 'birthmark'),
  // Body-plan set 2 (world v19): goldfish module genes.
  gold('twin-dorsal', 'Twin Dorsal', 3, 'A duplicated dorsal fin: a second, smaller dorsal behind the first.', p => p.species === 'goldfish' && (m(p)?.secondDorsal ?? 0) > 0),
  gold('four-wing', 'Four-Winged', 3, 'Two recessive copies grow a second pectoral pair behind the first.', p => p.species === 'goldfish' && (m(p)?.doublePectoral ?? 0) > 0),
  gold('veiled-twin-dorsal', 'Veiled Twin Dorsal', 4, 'A second dorsal fin on a veil- or butterfly-tailed fish.', p => (m(p)?.secondDorsal ?? 0) > 0 && Boolean(p.goldfish?.tail.veil || p.goldfish?.tail.butterfly)),
  gold('full-rig', 'Full Rig', 4, 'Both fin modules on one fish: a second dorsal fin and a second pectoral pair.', p => p.species === 'goldfish' && (m(p)?.secondDorsal ?? 0) > 0 && (m(p)?.doublePectoral ?? 0) > 0),
];

export const CODEX: readonly CodexEntry[] = [...KOI_ENTRIES, ...AXOLOTL_ENTRIES, ...GOLDFISH_ENTRIES];
export const CODEX_BY_KEY = new Map(CODEX.map(entry => [entry.key, entry]));
export const codexFor = (species: Species) => CODEX.filter(entry => entry.species === species);

/** Every Codex entry an animal shows, from its adult genetic potential. */
export function codexMatches(fish: Pick<Fish, 'species' | 'genome'>): CodexEntry[] {
  const p = express(fish.genome);
  return codexFor(fish.species).filter(entry => { try { return entry.test(p); } catch { return false; } });
}

/** Credit first discoveries among newly hatched animals, in record order. Pure; returns the same state when nothing is new. */
export function discover(codex: CodexState, fish: readonly Fish[], day: number): CodexState {
  const known = new Set(codex.entries.map(entry => entry.key)), added: CodexDiscovery[] = [];
  for (const member of fish) {
    if (member.generation === 0) continue;
    for (const entry of codexMatches(member)) if (!known.has(entry.key)) { known.add(entry.key); added.push({ key: entry.key, fishId: member.id, day }); }
  }
  return added.length ? { ...codex, entries: [...codex.entries, ...added] } : codex;
}

/** World helper: Codex discovery runs only under Genesis model 2. */
export function withDiscoveries(world: World, fish: readonly Fish[]): World {
  if (world.genesisModel !== 2 || !fish.length) return world;
  const codex = discover(world.codex, fish, world.circuit.day);
  return codex === world.codex ? world : { ...world, codex };
}

/** Discoveries in this world for a species, with progress against the whole species Codex. */
export function codexProgress(world: Pick<World, 'codex'>, species: Species) {
  const entries = codexFor(species), found = new Map(world.codex.entries.map(entry => [entry.key, entry]));
  return { found: entries.filter(entry => found.has(entry.key)).length, total: entries.length };
}

export const CODEX_TIER_LABELS: Record<CodexTier, string> = { 1: 'Uncommon', 2: 'Rare', 3: 'Epic', 4: 'Legendary' };
