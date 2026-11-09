/**
 * Specimen Studio (FS-134): read-only projections of one animal for the isolated studio view. Nothing here changes a
 * fish, the world or any replay contract. The appraisal is a lab summary computed from the phenotype, condition, rarity
 * and pedigree; it is not a judge's verdict and not a market price, and the studio labels it that way.
 */
import { axolotlRegistryFor } from './axolotlCatalog';
import { isAxolotlGenome } from './axolotlGenetics';
import { label as koiLabel } from './catalog';
import { finishedRuns, projectEntry, tierUnlocked, titleOf, type Projection } from './circuitCareer';
import { COMPETITION_TIERS, competitionSchedule, competitionScores, eligibility, type CompetitionEvent } from './competitions';
import { isEgg, lifeStage } from './development';
import { isNovel } from './genesis';
import { express, heterozygosity, metabolicPotential } from './genetics';
import { GOLDFISH_LOCUS_REGISTRY } from './goldfishCatalog';
import { GUPPY_LOCUS_REGISTRY } from './guppyCatalog';
import { hash, random, clamp } from './random';
import { rarityOf, tierRank, type RarityTier } from './rarity';
import { alleleLabel, LOCUS_REGISTRY } from './registry';
import { exhibitLabel, temperament } from './tournament';
import { genotypeVisible, locusStage } from './atlas';
import type { Fish, World } from './types';

// ---- Appraisal ---------------------------------------------------------------------------------------------------

export type AppraisalAxis = { key: 'form' | 'pattern' | 'condition' | 'rarity' | 'diversity'; label: string; score: number; detail: string };
export type Grade = 'S' | 'A' | 'B' | 'C' | 'D';
export type Appraisal = { axes: AppraisalAxis[]; overall: number; stars: number; grade: Grade; verdict: string; potentialOnly: boolean };

/** Weights of the five axes; they sum to 1. Form and pattern lead, as at a show; rarity and diversity add character. */
export const APPRAISAL_WEIGHTS: Record<AppraisalAxis['key'], number> = { form: 0.27, pattern: 0.27, condition: 0.18, rarity: 0.14, diversity: 0.14 };
/** Show-score ranges mapped onto 0–100 (show scores cluster high, so the appraisal spreads them). */
export const FORM_RANGE = [50, 85] as const, PATTERN_RANGE = [62, 95] as const;
/** Heterozygosity at which the diversity axis's heterozygosity half is full. */
export const DIVERSE_HET = 0.85;
export const GRADE_FLOORS: readonly [Grade, number][] = [['S', 82], ['A', 70], ['B', 58], ['C', 46], ['D', 0]];
export const APPRAISAL_NOTE = 'A studio appraisal summarises form, pattern, condition, rarity and genetic diversity. It is not a judge’s verdict and not a price: buyers pay for what they want.';

const VERDICTS: Record<Grade, string> = {
  S: 'Exhibition class. A specimen to build a line around.',
  A: 'Excellent. Worth showing and worth breeding from.',
  B: 'A sound, attractive animal with a clear strength.',
  C: 'Pleasant, with room to improve through selection.',
  D: 'Modest on paper; its value may lie in what it carries.',
};

/** The appraisal panel judges every species on one neutral bench, so the judges' style draw is fixed per species. */
const benchEvent = (fish: Fish) => ({ id: `studio-bench:${fish.species}`, species: fish.species }) as CompetitionEvent;

export const gradeFor = (overall: number): Grade => GRADE_FLOORS.find(([, floor]) => overall >= floor)![0];
/** Stars out of five in half steps. */
export const starsFor = (overall: number) => Math.round(clamp(overall / 20, 0.5, 5) * 2) / 2;

/** `inbreeding` is the pedigree F the caller already holds (the app keeps one kinship cache per session). */
export function appraise(fish: Fish, inbreeding: number): Appraisal {
  const scores = competitionScores(fish, benchEvent(fish)), rarity = rarityOf(fish.species, fish.genome), het = heterozygosity(fish.genome);
  const egg = isEgg(fish.life);
  // Axes are rescaled so a typical animal sits mid-range; the curves were measured on seeded founder offspring (FS-134).
  // Rarity: `share` is the fraction of reference animals at least as rare. Common animals tie at share 1, so a floor keeps
  // them off zero.
  const form = Math.round(100 * clamp((scores.presentation - FORM_RANGE[0]) / (FORM_RANGE[1] - FORM_RANGE[0])));
  const pattern = Math.round(100 * clamp((scores.pattern - PATTERN_RANGE[0]) / (PATTERN_RANGE[1] - PATTERN_RANGE[0])));
  const rare = Math.round(20 + 80 * clamp(1 - rarity.share));
  const diversity = Math.round(100 * (0.5 * clamp(het / DIVERSE_HET) + 0.5 * (1 - clamp(inbreeding / 0.25))));
  const condition = egg ? 70 : scores.condition;
  const axes: AppraisalAxis[] = [
    { key: 'form', label: 'Form', score: form, detail: 'Body, finnage and symmetry against the species standard, plus presence.' },
    { key: 'pattern', label: 'Pattern', score: pattern, detail: 'Contrast, density and colour richness of the markings.' },
    { key: 'condition', label: 'Condition', score: condition, detail: egg ? 'Still an egg: condition is read once it hatches.' : 'Developmental condition from the water it has lived in.' },
    { key: 'rarity', label: 'Rarity', score: rare, detail: `${rarity.standouts} standout trait${rarity.standouts === 1 ? '' : 's'}; overall ${rarity.tier} against founder offspring.` },
    { key: 'diversity', label: 'Diversity', score: diversity, detail: `${Math.round(het * 100)}% of loci heterozygous; pedigree F ${(inbreeding * 100).toFixed(1)}%.` },
  ];
  const overall = Math.round(axes.reduce((sum, axis) => sum + axis.score * APPRAISAL_WEIGHTS[axis.key], 0));
  const grade = gradeFor(overall);
  return { axes, overall, stars: starsFor(overall), grade, verdict: VERDICTS[grade], potentialOnly: egg };
}

export type ShowProspect = { event: CompetitionEvent; projection: Projection | null; blocker: string | null };

/**
 * Open, licensed, not-yet-entered shows for this animal's species with its projected finishing band. Ineligible animals
 * still see the show with the reason, so the studio can say what to work on.
 */
export function showProspects(world: World, fish: Fish, limit = 3): ShowProspect[] {
  const entered = new Set(world.circuit.history.map(run => run.event.id)), genesis = world.shop.model >= 3, day = world.circuit.day;
  return competitionSchedule(world.seed, day)
    .filter(event => event.species === fish.species && !entered.has(event.id) && tierUnlocked(world, event.tier) && day >= event.opensDay && day < event.closesDay)
    .map(event => { const blocker = eligibility(fish, event); return { event, blocker, projection: blocker ? null : projectEntry(world.seed, event, fish, genesis) }; })
    .sort((a, b) => (b.projection?.total ?? -1) - (a.projection?.total ?? -1) || COMPETITION_TIERS.indexOf(b.event.tier) - COMPETITION_TIERS.indexOf(a.event.tier))
    .slice(0, limit);
}

// ---- Studio marks: derived achievements ---------------------------------------------------------------------------

export type StudioMark = { id: string; name: string; detail: string; icon: 'star' | 'crown' | 'medal' | 'spark' | 'dna' | 'family' | 'leaf' | 'sun' | 'trophy' | 'alert' | 'clock' | 'scale'; tone: 'brass' | 'gene' | 'lume' | 'kelp' | 'koi' | 'warn'; earned: boolean };

/** Every mark is derived from records the world already keeps, so it can never disagree with them. */
export function studioMarks(world: World, fish: Fish, inbreeding: number): StudioMark[] {
  const p = express(fish.genome), potential = metabolicPotential(fish.genome), stage = lifeStage(fish.life, potential);
  const runs = finishedRuns(world), entries = runs.flatMap(run => run.participants.filter(entry => entry.fish.id === fish.id).map(entry => ({ run, entry })));
  const best = entries.length ? Math.min(...entries.map(item => item.entry.rank)) : Infinity, title = titleOf(runs, fish.id);
  const special = entries.some(item => item.run.show?.awardWinner === fish.id);
  let offspring = 0, grandchildren = 0;
  const children = new Set<string>();
  for (const member of world.fish) if (member.parents?.includes(fish.id)) { offspring++; children.add(member.id); }
  for (const member of world.fish) if (member.parents && (children.has(member.parents[0]) || children.has(member.parents[1]))) grandchildren++;
  const rarity = rarityOf(fish.species, fish.genome), adultShare = potential.adultLengthCm ? fish.life.lengthCm / potential.adultLengthCm : 0;
  const glow = p.genesis?.glow ?? 0;
  const marks: StudioMark[] = [
    { id: 'founder', name: fish.parents ? `Lab-bred · G${fish.generation}` : 'Founder', detail: fish.parents ? 'Hatched from a pairing recorded in this lab.' : 'Founder stock: the first of its recorded line.', icon: 'family', tone: 'lume', earned: true },
    { id: 'heirloom', name: 'Heirloom line', detail: 'Five or more recorded generations behind it.', icon: 'crown', tone: 'gene', earned: fish.generation >= 5 },
    { id: 'mutant', name: 'Fresh mutation', detail: 'A new mutation arose in this animal at birth.', icon: 'dna', tone: 'gene', earned: fish.mutations.length > 0 },
    { id: 'carrier', name: 'Mutation heir', detail: 'Carries an allele descended from a recorded mutation.', icon: 'spark', tone: 'gene', earned: fish.origins.length > 0 },
    { id: 'rare', name: 'Rare find', detail: 'Rated rare or better against founder offspring.', icon: 'star', tone: 'brass', earned: tierRank(rarity.tier) >= tierRank('rare') },
    { id: 'podium', name: 'Podium finisher', detail: 'Placed in the top three at a show.', icon: 'medal', tone: 'brass', earned: best <= 3 },
    { id: 'gold', name: 'Gold ribbon', detail: 'Won a show outright.', icon: 'trophy', tone: 'brass', earned: best === 1 },
    { id: 'special', name: 'Special award', detail: 'Took a show-day special award.', icon: 'sun', tone: 'brass', earned: special },
    { id: 'title', name: title ?? 'Champion title', detail: title ? 'A title earned on the circuit.' : 'Win at regional level or above for a title.', icon: 'crown', tone: 'brass', earned: !!title && title !== 'Podium Finisher' },
    { id: 'prolific', name: 'Prolific parent', detail: 'Ten or more recorded offspring.', icon: 'family', tone: 'koi', earned: offspring >= 10 },
    { id: 'grandparent', name: 'Grandparent', detail: 'Its offspring have offspring of their own.', icon: 'family', tone: 'koi', earned: grandchildren > 0 },
    { id: 'giant', name: 'Full grown', detail: 'Reached 95% of its adult length potential.', icon: 'scale', tone: 'kelp', earned: adultShare >= 0.95 },
    { id: 'elder', name: 'Elder', detail: 'Lived into old age.', icon: 'clock', tone: 'kelp', earned: stage === 'elderly' },
    { id: 'glow', name: 'Photophores', detail: 'Glows in the dark: try the Night lens.', icon: 'sun', tone: 'lume', earned: glow > 0.2 },
    { id: 'outbred', name: 'Outbred', detail: 'Bred here with no shared ancestry (pedigree F 0%).', icon: 'leaf', tone: 'kelp', earned: !!fish.parents && inbreeding === 0 },
  ];
  // Close kinship is shown as a caution when it applies and never as a locked goal.
  if (inbreeding >= 0.125) marks.push({ id: 'kin', name: 'Close kin', detail: `Pedigree F ${(inbreeding * 100).toFixed(1)}%: hidden recessives meet more often.`, icon: 'alert', tone: 'warn', earned: true });
  return marks;
}

// ---- Curator's commentary -----------------------------------------------------------------------------------------

const pick = <T,>(items: readonly T[], rng: () => number) => items[Math.floor(rng() * items.length) % items.length];
const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
const ordinal = (n: number) => ORDINAL[n - 1] ?? `${n}th`;
const OPENERS = ['On the bench:', 'Under the lens,', 'Seen in isolation,', 'Catalogued here:'];

/**
 * A short field-guide entry written from the animal's records. The phrasing is drawn deterministically from the fish ID,
 * so the same animal always reads the same way. Facts come only from phenotype, life and pedigree records.
 */
export function curatorNotes(world: World, fish: Fish): string[] {
  const rng = random(hash(`studio:${fish.id}:notes`)), p = express(fish.genome), potential = metabolicPotential(fish.genome);
  const stage = lifeStage(fish.life, potential), bold = temperament(fish);
  const social = p.guppy?.social ?? p.goldfish?.social ?? p.axolotl?.social ?? p.social;
  const activity = p.guppy?.activity ?? p.goldfish?.activity ?? p.axolotl?.activity ?? p.activity;
  const curious = p.guppy?.curious ?? p.goldfish?.curious ?? p.axolotl?.curious ?? p.curious;
  const kind = exhibitLabel(fish), sex = fish.sex === 'F' ? 'female' : 'male';
  const origin = fish.parents ? `${ordinal(Math.max(1, fish.generation))}-generation` : 'founder';
  const first = isEgg(fish.life)
    ? `${pick(OPENERS, rng)} an incubating egg, day ${fish.life.ageDays}. When it hatches it should become a ${sex} ${kind.toLowerCase()} of up to ${potential.adultLengthCm.toFixed(potential.adultLengthCm < 10 ? 1 : 0)} cm.`
    : `${pick(OPENERS, rng)} a ${origin} ${sex} ${kind.toLowerCase()}, ${stage} at ${fish.life.lengthCm.toFixed(fish.life.lengthCm < 10 ? 1 : 0)} cm of a possible ${potential.adultLengthCm.toFixed(potential.adultLengthCm < 10 ? 1 : 0)} cm.`;
  const rarity = rarityOf(fish.species, fish.genome);
  const standouts = [...rarity.rows].filter(row => tierRank(row.tier) >= tierRank('uncommon')).sort((a, b) => a.frequency - b.frequency).slice(0, 2);
  const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
  const second = standouts.length === 2
    ? `Its most distinctive features are ${lower(standouts[0].value)} (${lower(standouts[0].trait)}, ${standouts[0].tier}) and ${lower(standouts[1].value)} (${lower(standouts[1].trait)}, ${standouts[1].tier}).`
    : standouts.length === 1
    ? `Its most distinctive feature is its ${lower(standouts[0].trait)}: ${lower(standouts[0].value)}, ${standouts[0].tier} among founder offspring.`
    : 'Every trait falls within the common range of founder offspring: a reliable, typical animal.';
  const manner = bold > 0.66 ? pick(['Bold and assured', 'Confident', 'Unhurried and bold'], rng) : bold < 0.34 ? pick(['Shy', 'Retiring', 'Cautious'], rng) : pick(['Even-tempered', 'Steady', 'Balanced'], rng);
  const company = social > 0.62 ? 'it seeks company' : social < 0.38 ? 'it keeps its own counsel' : 'it mixes easily';
  const habit = activity > 0.62 ? 'patrols the open water' : activity < 0.38 ? 'rests long between short swims' : 'cruises at an easy pace';
  const third = `${manner}, ${company} and ${habit}${curious > 0.62 ? ', investigating anything new' : ''}.`;
  const extra: string[] = [];
  if (fish.mutations.length) extra.push(`${fish.mutations.length} new mutation${fish.mutations.length === 1 ? '' : 's'} arose at its birth.`);
  if (p.genesis?.glow && p.genesis.glow > 0.2) extra.push('Its photophores glow faintly in low light.');
  const honours = finishedRuns(world).flatMap(run => run.participants.filter(entry => entry.fish.id === fish.id)).length;
  if (honours) extra.push(`It has appeared at ${honours} show${honours === 1 ? '' : 's'}.`);
  if (fish.status !== 'living') extra.push(fish.status === 'sold' ? 'It now lives with a buyer; its record stays in the archive.' : 'It was rehomed; its record stays in the archive.');
  return [first, second, [third, ...extra].join(' ')];
}

// ---- Karyotype -----------------------------------------------------------------------------------------------------

export type KaryoLocus = {
  index: number; label: string; known: boolean;
  maternal: string | null; paternal: string | null; maternalName: string; paternalName: string;
  state: 'het' | 'hom' | 'novel' | 'hidden' | 'absent'; mutated: boolean; inherited: boolean;
};
export type KaryoChromosome = { label: string; loci: KaryoLocus[] };

type Entry = { label: string; chromosome: string; alleleName: (value: number) => string };
function registryOf(fish: Fish): Entry[] {
  const genome = fish.genome;
  if (fish.species === 'guppy') return GUPPY_LOCUS_REGISTRY.map(entry => ({ label: entry.label, chromosome: entry.chromosomeLabel, alleleName: v => entry.alleles[v]?.label ?? `P${v}` }));
  if (fish.species === 'goldfish') return GOLDFISH_LOCUS_REGISTRY.map(entry => ({ label: entry.label, chromosome: entry.chromosomeLabel, alleleName: v => entry.alleles[v]?.label ?? `G${v}` }));
  if (fish.species === 'axolotl' && isAxolotlGenome(genome)) return axolotlRegistryFor(genome.version).map(entry => ({ label: entry.label, chromosome: entry.chromosomeLabel, alleleName: v => entry.alleles[v]?.label ?? `A${v}` }));
  return LOCUS_REGISTRY.map(entry => ({ label: koiLabel(entry.id), chromosome: entry.chromosomeName, alleleName: v => alleleLabel(entry.id, v) }));
}
const prefix = (fish: Fish) => fish.species === 'guppy' ? 'P' : fish.species === 'goldfish' ? 'G' : 'A';

/**
 * Every locus of one animal grouped by chromosome, in stable registry order. Discovery mode is respected: unidentified
 * loci are numbered rather than named, and alleles stay hidden until the animal is sequenced.
 */
export function karyotype(world: World, fish: Fish): KaryoChromosome[] {
  const registry = registryOf(fish), seen = genotypeVisible(world, fish), names = new Map(world.alleles.map(record => [record.id, record.name]));
  const { maternal, paternal } = fish.genome, mark = prefix(fish);
  const chromosomes: KaryoChromosome[] = [];
  registry.forEach((entry, index) => {
    let chromosome = chromosomes.at(-1);
    if (!chromosome || chromosome.label !== entry.chromosome) { chromosome = { label: entry.chromosome, loci: [] }; chromosomes.push(chromosome); }
    const known = locusStage(world, fish.species, index) >= 1, carried = index < maternal.length;
    const code = (v: number) => isNovel(v) ? 'N' : `${mark}${v}`, name = (v: number) => isNovel(v) ? names.get(v) ?? 'new allele' : entry.alleleName(v);
    const m = maternal[index], f = paternal[index];
    const state: KaryoLocus['state'] = !carried ? 'absent' : !seen ? 'hidden' : isNovel(m) || isNovel(f) ? 'novel' : m === f ? 'hom' : 'het';
    chromosome.loci.push({
      index, label: known ? entry.label : `Locus ${chromosomes.length}.${chromosome.loci.length + 1}`, known,
      maternal: carried && seen ? code(m) : null, paternal: carried && seen ? code(f) : null,
      maternalName: carried && seen ? name(m) : '', paternalName: carried && seen ? name(f) : '',
      state, mutated: fish.mutations.some(mutation => mutation.locus === index), inherited: fish.origins.some(origin => origin.locus === index),
    });
  });
  return chromosomes;
}

// ---- Pedigree chart ------------------------------------------------------------------------------------------------

/** Three generations, focus first: [[focus], [mother, father], [four grandparents]]. Missing records are null. */
export function pedigreeRows(fish: readonly Fish[], focusId: string, depth = 3): (Fish | null)[][] {
  const byId = new Map(fish.map(member => [member.id, member]));
  const rows: (Fish | null)[][] = [[byId.get(focusId) ?? null]];
  for (let level = 1; level < depth; level++) {
    rows.push(rows[level - 1].flatMap(member => member?.parents ? member.parents.map(id => byId.get(id) ?? null) : [null, null]));
  }
  return rows;
}

/** Full siblings first (same mother and father), then half siblings; never the animal itself. */
export function siblingsOf(fish: readonly Fish[], focus: Fish): { full: Fish[]; half: Fish[] } {
  const full: Fish[] = [], half: Fish[] = [];
  if (!focus.parents) return { full, half };
  for (const member of fish) {
    if (member.id === focus.id || !member.parents) continue;
    if (member.parents[0] === focus.parents[0] && member.parents[1] === focus.parents[1]) full.push(member);
    else if (member.parents[0] === focus.parents[0] || member.parents[1] === focus.parents[1]) half.push(member);
  }
  return { full, half };
}

// ---- Keeper's journal (device-local, like favorites) ---------------------------------------------------------------

export const JOURNAL_KEY = 'fishtank:specimen-journal';
export const JOURNAL_TAGS = ['Keeper', 'Breeder', 'Show prospect', 'For sale', 'Watch'] as const;
export type JournalTag = typeof JOURNAL_TAGS[number];
export type JournalEntry = { text: string; tags: JournalTag[]; updatedAt: string };
export type Journal = Record<string, JournalEntry>;
export const JOURNAL_TEXT_LIMIT = 1200;

/**
 * Decodes stored journal notes. Anything malformed is dropped entry by entry rather than replacing the whole journal,
 * and notes for animals not in this world are kept (they may belong to an imported save the player returns to).
 */
export function decodeJournal(raw: string | null): Journal {
  if (!raw) return {};
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return {}; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const journal: Journal = {};
  for (const [id, value] of Object.entries(data as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const entry = value as Partial<JournalEntry>;
    if (typeof entry.text !== 'string' || !Array.isArray(entry.tags)) continue;
    const tags = entry.tags.filter((tag): tag is JournalTag => (JOURNAL_TAGS as readonly string[]).includes(tag as string));
    journal[id] = { text: entry.text.slice(0, JOURNAL_TEXT_LIMIT), tags: [...new Set(tags)], updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : '' };
  }
  return journal;
}

/** Returns a new journal; an entry with no text and no tags is removed. */
export function withJournalEntry(journal: Journal, id: string, entry: Omit<JournalEntry, 'updatedAt'>, at: string): Journal {
  const next = { ...journal };
  const text = entry.text.slice(0, JOURNAL_TEXT_LIMIT), tags = [...new Set(entry.tags)];
  if (!text.trim() && !tags.length) delete next[id]; else next[id] = { text, tags, updatedAt: at };
  return next;
}

// ---- Stage view math -----------------------------------------------------------------------------------------------

export type StageView = { zoom: number; x: number; y: number };
export const MIN_ZOOM = 0.5, MAX_ZOOM = 8;
export const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

/** Zooms by `factor` keeping the stage point (px, py), measured from the stage centre, fixed under the pointer. */
export function zoomAt(view: StageView, factor: number, px: number, py: number): StageView {
  const zoom = clampZoom(view.zoom * factor), k = zoom / view.zoom;
  return { zoom, x: px - (px - view.x) * k, y: py - (py - view.y) * k };
}

/** A scale bar between `minPx` and `maxPx` long, on a 1–2–5 sequence of centimetres. */
export function scaleBar(cmPerPx: number, minPx = 60, maxPx = 160): { cm: number; px: number } {
  const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];
  for (const cm of steps) { const px = cm / cmPerPx; if (px >= minPx && px <= maxPx) return { cm, px }; }
  const cm = steps.reduce((best, step) => Math.abs(step / cmPerPx - (minPx + maxPx) / 2) < Math.abs(best / cmPerPx - (minPx + maxPx) / 2) ? step : best, 1);
  return { cm, px: cm / cmPerPx };
}

export const formatCm = (cm: number) => cm >= 10 ? `${cm.toFixed(0)} cm` : cm >= 1 ? `${cm.toFixed(1)} cm` : `${(cm * 10).toFixed(1)} mm`;

/** A rarity tier's share of the six tiers, for meters. */
export const tierShare = (tier: RarityTier) => (tierRank(tier) + 1) / 6;
