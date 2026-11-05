import { axolotlGenomeProblem } from './axolotlGenetics';
import { isEgg } from './development';
import { recordEntry } from './economy';
import { carriedNovel, isNovel, type NovelAllele } from './genesis';
import { modulesOf } from './genetics';
import { goldfishGenomeProblem } from './goldfishGenetics';
import { SEX_LOCUS } from './guppyCatalog';
import { guppyGenomeProblem } from './guppyGenetics';
import { pinLatentSource } from './latentPin';
import { genomeProblem } from './registry';
import type { AlleleOrigin, CreatureGenome, Fish, Genome, Species, World } from './types';

/**
 * Genome Editor (FS-132, world v21). A **gene cassette** is one allele copy taken from one homolog of a living donor; a
 * **germline edit** writes a cassette's allele into one homolog of a recipient's germline. The recipient's own genome
 * record never changes (genomes are immutable): every later birth reads the parent through `germlineFish`, so its
 * offspring inherit the edit by ordinary meiosis. The minigames that gate both actions run in the interface; commands
 * carry only their integer score, so journals replay exactly.
 */
export type Copy = 'maternal' | 'paternal';
export type SpliceTarget = Copy | 'both';
export type Cassette = {
  id: string; species: Species; locus: number; allele: number;
  /** Definition of an open-ended allele, carried so it can be written into another Genesis genome. */
  novel: NovelAllele | null;
  /** Mutation origin of the copy (FS-603), kept so a spliced allele still traces to the fish where it arose. */
  origin: string | null;
  donorId: string; donorCopy: Copy;
  /** Restriction Cut score 0–100. */
  integrity: number;
  /** Splices left in this cassette. */
  doses: number;
  /** Player label; null shows the locus and donor. */
  label: string | null;
};
export type GermlineEdit = {
  fishId: string; locus: number; copy: Copy; allele: number; novel: NovelAllele | null; origin: string | null;
  cassetteId: string;
  /** Mean of the Sticky Ends and Anneal scores, 0–100. */
  fidelity: number;
};
export type GeneLab = { model: 1; nextCassette: number; cassettes: Cassette[]; edits: GermlineEdit[] };

export const GENE_LAB_MODEL = 1;
export const EXTRACT_COST = 25;
export const SPLICE_COST = 40;
export const MAX_CASSETTES = 12;
export const MAX_EDITS_PER_FISH = 6;
export const MAX_EDIT_RECORDS = 1200;
export const MIN_INTEGRITY = 30;
export const MIN_FIDELITY = 40;
export const BOTH_COPIES_FIDELITY = 70;
export const MAX_DOSES = 3;
export const CASSETTE_ID_PATTERN = /^GC-\d{6}$/;

export const initialGeneLab = (): GeneLab => ({ model: GENE_LAB_MODEL, nextCassette: 1, cassettes: [], edits: [] });
export const cassetteId = (n: number) => `GC-${String(n).padStart(6, '0')}`;
/** Integrity sets how many splices one cassette holds. */
export const dosesFor = (integrity: number) => integrity >= 85 ? 3 : integrity >= 60 ? 2 : 1;
export const copiesOf = (target: SpliceTarget): Copy[] => target === 'both' ? ['maternal', 'paternal'] : [target];
export const COPY_WORD: Record<Copy, string> = { maternal: 'maternal', paternal: 'paternal' };

export const editsOf = (lab: Pick<GeneLab, 'edits'>, fishId: string) => lab.edits.filter(edit => edit.fishId === fishId);

/** The loci an animal's genome carries; edits outside them mean nothing. */
export const lociCount = (genome: CreatureGenome) => genome.maternal.length;

/** Which loci may be cut or spliced: every carried locus except the guppy sex locus, whose copies decide sex. */
export function editableLocus(species: Species, genome: CreatureGenome, locus: number): boolean {
  if (!Number.isInteger(locus) || locus < 0 || locus >= lociCount(genome)) return false;
  return !(species === 'guppy' && locus === SEX_LOCUS);
}

/** The genome with a set of germline edits written in, its novel definitions re-derived from what it now carries. */
export function applyEdits<T extends CreatureGenome>(genome: T, edits: readonly Pick<GermlineEdit, 'locus' | 'copy' | 'allele' | 'novel'>[]): T {
  if (!edits.length) return genome;
  const maternal = [...genome.maternal], paternal = [...genome.paternal];
  for (const edit of edits) (edit.copy === 'maternal' ? maternal : paternal)[edit.locus] = edit.allele;
  const edited = { ...genome, maternal, paternal } as T;
  if (genome.genesis) {
    const pool = new Map((genome.genesis.novel ?? []).map(entry => [entry.id, entry]));
    for (const edit of edits) if (edit.novel) pool.set(edit.novel.id, edit.novel);
    edited.genesis = { ...genome.genesis, novel: carriedNovel(maternal, paternal, pool) };
  }
  return pinLatentSource(edited, genome);
}

const byPosition = (a: AlleleOrigin, b: AlleleOrigin) => a.locus - b.locus || (a.copy === b.copy ? 0 : a.copy === 'maternal' ? -1 : 1);

/** A parent as its gametes see it: the germline genome and the mutation origins its edited copies now carry. */
export function germlineFish<T extends Fish>(world: { geneLab?: GeneLab }, fish: T): T {
  const edits = world.geneLab ? editsOf(world.geneLab, fish.id) : [];
  if (!edits.length) return fish;
  const edited = new Set(edits.map(edit => `${edit.locus}${edit.copy}`));
  const origins = fish.origins.filter(origin => !edited.has(`${origin.locus}${origin.copy}`));
  for (const edit of edits) if (edit.origin) origins.push({ locus: edit.locus, copy: edit.copy, id: edit.origin });
  return { ...fish, genome: applyEdits(fish.genome, edits), origins: origins.sort(byPosition) };
}

export function creatureGenomeProblem(species: Species, genome: CreatureGenome): string | null {
  switch (species) {
    case 'axolotl': return axolotlGenomeProblem(genome);
    case 'goldfish': return goldfishGenomeProblem(genome);
    case 'guppy': return guppyGenomeProblem(genome);
    default: return genomeProblem(genome as Genome);
  }
}

/**
 * Whether a germline with these edits is a genome its offspring can inherit. Under Genesis model 2 every birth upgrades the
 * child to model 2, so a founder's model 1 block may carry a model 2 (enriched) allele in its germline: it is checked as the
 * model 2 genome its children will be. Model 1 (research) worlds check the germline as it stands.
 */
export function germlineProblem(world: Pick<World, 'genesisModel'>, species: Species, genome: CreatureGenome, edits: readonly Pick<GermlineEdit, 'locus' | 'copy' | 'allele' | 'novel'>[]): string | null {
  const trial = applyEdits(genome, edits);
  if (world.genesisModel === 2 && trial.genesis && trial.genesis.model !== 2) {
    return creatureGenomeProblem(species, { ...trial, genesis: { ...trial.genesis, model: 2, modules: modulesOf(genome) } });
  }
  return creatureGenomeProblem(species, trial);
}

/** Why a copy cannot be extracted, or null. Credits and the minigame score are checked by the command. */
export function extractProblem(world: Pick<World, 'geneLab'>, fish: Fish | undefined, locus: number): string | null {
  if (!fish || fish.status !== 'living') return 'Choose a living animal to sample.';
  if (isEgg(fish.life)) return 'Eggs are too small to sample. Wait until it hatches.';
  if (fish.species === 'guppy' && locus === SEX_LOCUS) return 'The sex locus decides a guppy’s sex, so the bench will not cut it.';
  if (!editableLocus(fish.species, fish.genome, locus)) return `${fish.name}’s genome does not carry that locus.`;
  if (world.geneLab.cassettes.length >= MAX_CASSETTES) return `The vault holds ${MAX_CASSETTES} cassettes. Splice or discard one first.`;
  return null;
}

/** Why a cassette cannot be spliced into these copies, or null. Credits and the minigame score are checked by the command. */
export function spliceProblem(world: Pick<World, 'geneLab' | 'genesisModel'>, cassette: Cassette | undefined, fish: Fish | undefined, target: SpliceTarget): string | null {
  if (!cassette) return 'That cassette is no longer in the vault.';
  if (!fish || fish.status !== 'living') return 'Choose a living animal to edit.';
  if (fish.species !== cassette.species) return `This cassette holds ${cassette.species} DNA; it only splices into a ${cassette.species}.`;
  if (isEgg(fish.life)) return 'Eggs cannot be edited. Wait until it hatches.';
  if (!editableLocus(fish.species, fish.genome, cassette.locus)) return `${fish.name}’s genome (v${fish.genome.version}) does not carry this locus.`;
  if (cassette.novel && !fish.genome.genesis) return `A named allele needs a Genesis genome, and ${fish.name} predates Genesis.`;
  const copies = copiesOf(target);
  if (cassette.doses < copies.length) return `Both copies need two doses and this cassette has ${cassette.doses}.`;
  const germline = germlineFish(world, fish).genome;
  const already = copies.filter(copy => germline[copy][cassette.locus] === cassette.allele);
  if (already.length === copies.length) return copies.length === 2 ? `${fish.name} already carries this allele on both copies.` : `${fish.name}’s ${copies[0]} copy already carries this allele.`;
  const current = editsOf(world.geneLab, fish.id), positions = new Set(current.map(edit => `${edit.locus}${edit.copy}`));
  for (const copy of copies) positions.add(`${cassette.locus}${copy}`);
  if (positions.size > MAX_EDITS_PER_FISH) return `An animal holds at most ${MAX_EDITS_PER_FISH} edited copies. Restore one first.`;
  const trial = [...current.filter(edit => edit.locus !== cassette.locus || !copies.includes(edit.copy)), ...copies.map(copy => ({ locus: cassette.locus, copy, allele: cassette.allele, novel: cassette.novel }))];
  if (germlineProblem(world, fish.species, fish.genome, trial)) return cassette.novel
    ? `This named allele was written under a newer Genesis model than ${fish.name}’s genome uses.`
    : `This allele does not fit ${fish.name}’s genome version.`;
  return null;
}

const living = (world: World, fishId: string) => world.fish.find(fish => fish.id === fishId && fish.status === 'living');
const afford = (next: World, cost: number, what: string) => {
  if (next.credits < cost) throw new Error(`${what} costs ◈ ${cost.toLocaleString('en')} and you have ◈ ${next.credits.toLocaleString('en')}.`);
  next.credits -= cost;
};

/** `extract-gene`: copy one allele from a donor into a new cassette. Mutates the command's working copy only. */
export function extractGene(next: World, fishId: string, locus: number, copy: Copy, integrity: number): void {
  const fish = living(next, fishId), problem = extractProblem(next, fish, locus);
  if (problem) throw new Error(problem);
  if (integrity < MIN_INTEGRITY) throw new Error(`The sample is too damaged to keep (integrity ${integrity}; ${MIN_INTEGRITY} needed).`);
  const donor = fish!, allele = donor.genome[copy][locus];
  afford(next, EXTRACT_COST, 'A restriction digest');
  const novel = isNovel(allele) ? donor.genome.genesis?.novel.find(entry => entry.id === allele) ?? null : null;
  const origin = donor.origins.find(entry => entry.locus === locus && entry.copy === copy)?.id ?? null;
  const id = cassetteId(next.geneLab.nextCassette);
  next.geneLab = {
    ...next.geneLab, nextCassette: next.geneLab.nextCassette + 1,
    cassettes: [...next.geneLab.cassettes, { id, species: donor.species, locus, allele, novel, origin, donorId: donor.id, donorCopy: copy, integrity, doses: dosesFor(integrity), label: null }],
  };
  next.ledger = recordEntry(next.ledger, 'research', -EXTRACT_COST, 1, `Extracted ${id} from ${donor.name}`);
}

/** `splice-gene`: write a cassette's allele into one or both germline copies of a recipient. */
export function spliceGene(next: World, id: string, fishId: string, target: SpliceTarget, fidelity: number): void {
  const cassette = next.geneLab.cassettes.find(entry => entry.id === id), fish = living(next, fishId);
  const problem = spliceProblem(next, cassette, fish, target);
  if (problem) throw new Error(problem);
  if (fidelity < MIN_FIDELITY) throw new Error(`The ligation failed (fidelity ${fidelity}; ${MIN_FIDELITY} needed).`);
  if (target === 'both' && fidelity < BOTH_COPIES_FIDELITY) throw new Error(`Both copies need a fidelity of ${BOTH_COPIES_FIDELITY}. Land the edit on one copy instead.`);
  const source = cassette!, recipient = fish!, copies = copiesOf(target);
  afford(next, SPLICE_COST * copies.length, copies.length === 2 ? 'Splicing both copies' : 'A splice');
  if (next.geneLab.edits.length + copies.length > MAX_EDIT_RECORDS) throw new Error('The lab’s edit register is full.');
  const kept = next.geneLab.edits.filter(edit => edit.fishId !== recipient.id || edit.locus !== source.locus || !copies.includes(edit.copy));
  // Splicing a copy back to the allele it was born with simply restores it.
  const added = copies.filter(copy => recipient.genome[copy][source.locus] !== source.allele)
    .map(copy => ({ fishId: recipient.id, locus: source.locus, copy, allele: source.allele, novel: source.novel, origin: source.origin, cassetteId: source.id, fidelity }));
  const doses = source.doses - copies.length;
  next.geneLab = {
    ...next.geneLab, edits: [...kept, ...added],
    cassettes: doses > 0 ? next.geneLab.cassettes.map(entry => entry.id === source.id ? { ...entry, doses } : entry) : next.geneLab.cassettes.filter(entry => entry.id !== source.id),
  };
  next.ledger = recordEntry(next.ledger, 'research', -SPLICE_COST * copies.length, 1, `Spliced ${source.id} into ${recipient.name} (${target === 'both' ? 'both copies' : `${target} copy`})`);
}

export function discardCassette(next: World, id: string): void {
  if (!next.geneLab.cassettes.some(entry => entry.id === id)) throw new Error('That cassette is no longer in the vault.');
  next.geneLab = { ...next.geneLab, cassettes: next.geneLab.cassettes.filter(entry => entry.id !== id) };
}

export function labelCassette(next: World, id: string, label: string): void {
  const name = label.trim();
  if (!next.geneLab.cassettes.some(entry => entry.id === id)) throw new Error('That cassette is no longer in the vault.');
  if (name.length > 32) throw new Error('Label the cassette with at most 32 characters.');
  next.geneLab = { ...next.geneLab, cassettes: next.geneLab.cassettes.map(entry => entry.id === id ? { ...entry, label: name || null } : entry) };
}

/** `restore-germline`: drop an edit, so the copy transmits the allele the animal was born with again. Free. */
export function restoreGermline(next: World, fishId: string, locus: number, copy: Copy): void {
  if (!living(next, fishId)) throw new Error('Choose a living animal.');
  if (!next.geneLab.edits.some(edit => edit.fishId === fishId && edit.locus === locus && edit.copy === copy)) throw new Error('That copy carries no edit.');
  next.geneLab = { ...next.geneLab, edits: next.geneLab.edits.filter(edit => edit.fishId !== fishId || edit.locus !== locus || edit.copy !== copy) };
}

/** Save validation: references, bounds and that every edited germline is still a valid genome. */
export function geneLabProblem(world: World): string | null {
  const lab = world.geneLab, ids = new Map(world.fish.map(fish => [fish.id, fish]));
  if (lab.cassettes.length > MAX_CASSETTES || lab.edits.length > MAX_EDIT_RECORDS) return 'The gene vault is over its limits.';
  const seen = new Set<string>();
  for (const cassette of lab.cassettes) {
    const donor = ids.get(cassette.donorId);
    if (seen.has(cassette.id) || Number(cassette.id.slice(3)) >= lab.nextCassette || !donor || donor.species !== cassette.species
      || !editableLocus(donor.species, donor.genome, cassette.locus) || cassette.doses < 1 || cassette.doses > MAX_DOSES
      || (isNovel(cassette.allele) ? cassette.novel?.id !== cassette.allele || cassette.novel.locus !== cassette.locus : cassette.novel !== null)) return 'Invalid gene cassette.';
    seen.add(cassette.id);
  }
  const positions = new Set<string>(), perFish = new Map<string, GermlineEdit[]>();
  for (const edit of lab.edits) {
    const fish = ids.get(edit.fishId), key = `${edit.fishId}:${edit.locus}${edit.copy}`;
    if (!fish || positions.has(key) || Number(edit.cassetteId.slice(3)) >= lab.nextCassette || !editableLocus(fish.species, fish.genome, edit.locus)
      || fish.genome[edit.copy][edit.locus] === edit.allele
      || (isNovel(edit.allele) ? edit.novel?.id !== edit.allele || edit.novel.locus !== edit.locus : edit.novel !== null)) return 'Invalid germline edit.';
    positions.add(key);
    perFish.set(fish.id, [...(perFish.get(fish.id) ?? []), edit]);
  }
  for (const [fishId, edits] of perFish) {
    const fish = ids.get(fishId)!;
    if (new Set(edits.map(edit => `${edit.locus}${edit.copy}`)).size > MAX_EDITS_PER_FISH || germlineProblem(world, fish.species, fish.genome, edits)) return 'Invalid germline edit.';
  }
  return null;
}
