import { alleleLocusLabel, locusStage, type AlleleRecord } from './atlas';
import { catalogValue } from './genesis2';
import { isNovel, type AlleleKind, type NovelAllele } from './genesis';
import { AXOLOTL_V2_REGISTRY } from './axolotlCatalog';
import { GENOME_LOCI } from './catalog';
import { GOLDFISH_LOCUS_REGISTRY } from './goldfishCatalog';
import { alleleLabel } from './registry';
import type { Species, World } from './types';

/**
 * The Allele Registry (R-201): every open-ended allele that arose in this world, with its definition (read from the genome
 * of the animal it arose in), its lineage (the allele it mutated from, and the alleles derived from it), and how common it
 * is among living animals right now. Read-only; nothing here changes a world.
 */
export type RegistryRow = {
  record: AlleleRecord;
  definition: NovelAllele | null;
  kind: AlleleKind | null;
  /** The allele it mutated from: a registry allele, or a catalog allele label. */
  parent: { id: number; label: string; registered: boolean };
  /** Number of novel ancestors in its lineage (0 when it mutated from a catalog allele). */
  depth: number;
  children: number[];
  living: number; homozygous: number;
  /** Share of this species' living copies at its locus that are this allele, 0–1. */
  frequency: number;
  /** Signed change from the parent allele, on the locus' own scale. */
  shift: number | null;
  locusLabel: string;
  locusKnown: boolean;
};

export function registryRows(world: Pick<World, 'alleles' | 'fish' | 'atlas'>, species: Species): RegistryRow[] {
  const records = world.alleles.filter(record => record.species === species), byId = new Map(records.map(record => [record.id, record]));
  const fishById = new Map(world.fish.map(fish => [fish.id, fish]));
  const definitions = new Map<number, NovelAllele>();
  for (const record of records) {
    const definition = fishById.get(record.origin)?.genome.genesis?.novel.find(entry => entry.id === record.id);
    if (definition) definitions.set(record.id, definition);
  }
  // One pass over living animals: copies of each registered allele and of each locus.
  const living = new Map<number, number>(), homozygous = new Map<number, number>(), locusCopies = new Map<number, number>();
  let animals = 0;
  for (const fish of world.fish) {
    if (fish.status !== 'living' || fish.species !== species || !fish.genome.genesis) continue;
    animals++;
    for (const definition of fish.genome.genesis.novel) {
      if (!byId.has(definition.id)) continue;
      const copies = Number(fish.genome.maternal[definition.locus] === definition.id) + Number(fish.genome.paternal[definition.locus] === definition.id);
      if (!copies) continue;
      living.set(definition.id, (living.get(definition.id) ?? 0) + 1);
      if (copies === 2) homozygous.set(definition.id, (homozygous.get(definition.id) ?? 0) + 1);
      locusCopies.set(definition.id, (locusCopies.get(definition.id) ?? 0) + copies);
    }
  }
  const children = new Map<number, number[]>();
  for (const [id, definition] of definitions) if (isNovel(definition.parent)) children.set(definition.parent, [...(children.get(definition.parent) ?? []), id]);
  const depthOf = (id: number, seen = new Set<number>()): number => {
    const parent = definitions.get(id)?.parent;
    if (parent === undefined || !isNovel(parent) || seen.has(id)) return 0;
    seen.add(id);
    return 1 + depthOf(parent, seen);
  };
  return records.map(record => {
    const definition = definitions.get(record.id) ?? null, parentId = definition?.parent ?? -1, parentRecord = byId.get(parentId);
    const parentValue = definition ? (isNovel(parentId) ? definitions.get(parentId)?.value ?? null : catalogValue(species, record.locus, parentId)) : null;
    return {
      record, definition, kind: definition?.kind ?? null,
      parent: { id: parentId, label: parentRecord ? parentRecord.name : isNovel(parentId) ? `Allele ${parentId}` : registryAlleleLabel(species, record.locus, parentId), registered: Boolean(parentRecord) },
      depth: depthOf(record.id), children: children.get(record.id) ?? [],
      living: living.get(record.id) ?? 0, homozygous: homozygous.get(record.id) ?? 0,
      frequency: animals ? (locusCopies.get(record.id) ?? 0) / (animals * 2) : 0,
      shift: definition && parentValue !== null ? Math.round((definition.value - parentValue) * 1000) / 1000 : null,
      locusLabel: alleleLocusLabel(record), locusKnown: locusStage(world, species, record.locus) >= 1,
    };
  });
}

/** A catalog allele's label at a locus, for any species. */
export function registryAlleleLabel(species: Species, locus: number, allele: number): string {
  if (species === 'koi') return GENOME_LOCI[locus] ? alleleLabel(GENOME_LOCI[locus], allele) : `A${allele}`;
  const entry = species === 'axolotl' ? AXOLOTL_V2_REGISTRY[locus] : GOLDFISH_LOCUS_REGISTRY[locus];
  return entry?.alleles[allele]?.label ?? `A${allele}`;
}

export type RegistrySort = 'newest' | 'carriers' | 'lineage';
export type RegistryFilter = 'all' | 'living' | 'lost' | 'leap' | 'regulatory';

export function sortedRows(rows: readonly RegistryRow[], sort: RegistrySort, filter: RegistryFilter): RegistryRow[] {
  const kept = rows.filter(row => filter === 'all' ? true : filter === 'living' ? row.living > 0 : filter === 'lost' ? row.living === 0 : row.kind === filter);
  if (sort === 'carriers') return [...kept].sort((a, b) => b.living - a.living || b.record.id - a.record.id);
  if (sort === 'lineage') return [...kept].sort((a, b) => b.depth - a.depth || b.children.length - a.children.length);
  return [...kept].reverse();
}

export const KIND_LABELS: Record<AlleleKind, string> = { drift: 'Drift', leap: 'Leap', regulatory: 'Regulatory' };
export const KIND_TEXT: Record<AlleleKind, string> = {
  drift: 'A small step from its parent allele.',
  leap: 'A large jump from its parent allele, with an extra side effect.',
  regulatory: 'Barely changes its value but changes how strongly it dominates.',
};
