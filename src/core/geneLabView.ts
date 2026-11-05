import { atlasLoci, genotypeVisible, locusStage } from './atlas';
import { AXOLOTL_V2_REGISTRY } from './axolotlCatalog';
import { isNovel } from './genesis';
import { editableLocus, editsOf, germlineFish, type Cassette, type Copy, type GermlineEdit } from './geneLab';
import { GOLDFISH_LOCUS_REGISTRY } from './goldfishCatalog';
import { GUPPY_LOCUS_REGISTRY } from './guppyCatalog';
import { hash, random } from './random';
import { LOCUS_REGISTRY } from './registry';
import type { Fish, Species, World } from './types';

/**
 * Read-only views for the Genome Editor (FS-132). Labels follow the Genome Atlas: an unidentified locus shows only its
 * position, and alleles of an animal that is not sequenced (in discovery mode) stay hidden, so the editor never reveals
 * more than the inspector does.
 */
export type KaryoLocus = { index: number; position: number; known: boolean; name: string; editable: boolean };
export type KaryoChromosome = { number: number; label: string; known: boolean; loci: KaryoLocus[]; carried: boolean };

const ALLELE_LABELS: Record<Species, (index: number) => readonly { label: string }[] | undefined> = {
  koi: index => LOCUS_REGISTRY[index]?.alleles,
  axolotl: index => AXOLOTL_V2_REGISTRY[index]?.alleles,
  goldfish: index => GOLDFISH_LOCUS_REGISTRY[index]?.alleles,
  guppy: index => GUPPY_LOCUS_REGISTRY[index]?.alleles,
};

export function locusName(world: Pick<World, 'atlas'>, species: Species, index: number): string {
  const locus = atlasLoci(species)[index];
  if (!locus) return `Locus ${index}`;
  return locusStage(world, species, index) >= 1 ? locus.label : `Locus ${locus.chromosome}.${locus.position + 1}`;
}

export function chromosomeName(world: Pick<World, 'atlas'>, species: Species, number: number): string {
  const loci = atlasLoci(species).filter(locus => locus.chromosome === number && locus.index < 72);
  return loci.some(locus => locusStage(world, species, locus.index) >= 1) ? loci[0]?.chromosomeLabel ?? `Chromosome ${number}` : `Chromosome ${String(number).padStart(2, '0')}`;
}

/** The twelve locus chromosomes of a species, each with its six loci, as the karyogram draws them. */
export function karyotype(world: Pick<World, 'atlas'>, fish: Pick<Fish, 'species' | 'genome'>): KaryoChromosome[] {
  const loci = atlasLoci(fish.species).filter(locus => locus.index < 72), byNumber = new Map<number, KaryoLocus[]>();
  for (const locus of loci) {
    const entry: KaryoLocus = {
      index: locus.index, position: locus.position, known: locusStage(world, fish.species, locus.index) >= 1, name: locusName(world, fish.species, locus.index),
      editable: editableLocus(fish.species, fish.genome, locus.index),
    };
    byNumber.set(locus.chromosome, [...(byNumber.get(locus.chromosome) ?? []), entry]);
  }
  return [...byNumber.entries()].sort((a, b) => a[0] - b[0]).map(([number, entries]) => ({
    number, label: chromosomeName(world, fish.species, number), known: entries.some(entry => entry.known), loci: entries.sort((a, b) => a.index - b.index),
    carried: entries.some(entry => entry.index < fish.genome.maternal.length),
  }));
}

/** Short code and readable name of an allele, or null when the genotype is hidden. */
export function alleleText(world: Pick<World, 'alleles' | 'atlas'>, species: Species, index: number, allele: number): { code: string; name: string } {
  if (isNovel(allele)) return { code: 'N', name: world.alleles.find(record => record.id === allele)?.name ?? 'new allele' };
  const label = locusStage(world, species, index) >= 2 ? ALLELE_LABELS[species](index)?.[allele]?.label : undefined;
  return { code: `${species === 'guppy' ? 'P' : 'A'}${allele}`, name: label ?? `allele ${allele}` };
}

export const genotypeShown = (world: Pick<World, 'atlas'>, fish: Pick<Fish, 'id'>) => genotypeVisible(world, fish);
/** A cassette is read when its donor's genotype is visible (scientist mode or a sequenced donor). */
export const cassetteRead = (world: Pick<World, 'atlas'>, cassette: Pick<Cassette, 'donorId'>) => genotypeVisible(world, { id: cassette.donorId });

export function cassetteTitle(world: Pick<World, 'atlas' | 'fish'>, cassette: Cassette): string {
  if (cassette.label) return cassette.label;
  return locusName(world, cassette.species, cassette.locus);
}

/** Germline view of one animal: its edits keyed by position and the germline genome. */
export function germlineView(world: World, fish: Fish) {
  const edits = editsOf(world.geneLab, fish.id), byPosition = new Map<string, GermlineEdit>(edits.map(edit => [`${edit.locus}${edit.copy}`, edit]));
  return { edits, germline: germlineFish(world, fish).genome, editAt: (locus: number, copy: Copy) => byPosition.get(`${locus}${copy}`) ?? null };
}

/** How many of one parent's offspring receive an allele written on these copies (before crossovers next to it). */
export const inheritanceShare = (copies: number) => copies >= 2 ? 1 : copies === 1 ? 0.5 : 0;

/** Score grade shown after every minigame. */
export function grade(score: number): { letter: 'S' | 'A' | 'B' | 'C' | 'D'; word: string } {
  if (score >= 92) return { letter: 'S', word: 'Flawless' };
  if (score >= 78) return { letter: 'A', word: 'Clean' };
  if (score >= 60) return { letter: 'B', word: 'Steady' };
  if (score >= 40) return { letter: 'C', word: 'Rough' };
  return { letter: 'D', word: 'Damaged' };
}

export type Base = 'A' | 'T' | 'G' | 'C';
export const BASES: readonly Base[] = ['A', 'T', 'G', 'C'];
export const COMPLEMENT: Record<Base, Base> = { A: 'T', T: 'A', G: 'C', C: 'G' };

/**
 * Display sequence for a locus copy: decorative bases derived from the species, locus and allele, so the same allele
 * always shows the same overhang. It is art, not the model's genotype.
 */
export function overhang(species: Species, locus: number, allele: number, length: number): Base[] {
  const rng = random(hash(`splice-bench:${species}:${locus}:${allele}`));
  return Array.from({ length }, () => BASES[Math.floor(rng() * 4)]);
}

/** Sticky-end length: weaker cassettes leave longer, frayed overhangs to pair. */
export const overhangLength = (integrity: number) => integrity >= 85 ? 6 : integrity >= 60 ? 7 : 9;
/** Annealing window half-width in degrees of the thermocycler dial. */
export const annealWindow = (integrity: number, round: number) => Math.max(7, (14 + integrity * 0.14) * (1 - round * 0.18));
