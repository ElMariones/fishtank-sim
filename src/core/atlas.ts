import { AXOLOTL_V2_REGISTRY } from './axolotlCatalog';
import { axolotlDominance, axolotlPair } from './axolotlGenetics';
import { CHROMOSOMES } from './catalog';
import { DOMINANCE_LABELS, loadCatalog, isNovel, type DominanceClass } from './genesis';
import { koiResolver } from './koiGenesis';
import { LOCUS_REGISTRY } from './registry';
import type { AxolotlGenome } from './axolotlGenetics';
import type { Fish, Genome, Species, World } from './types';

/**
 * Genome Atlas v1 (world v16). In discovery mode a species' loci start unidentified, and the player learns them the way a
 * geneticist would: clutches whose parents carry two visibly different alleles at a locus show it segregating (evidence),
 * enough evidence identifies the trait and then its dominance, and offspring of parents heterozygous at two neighbouring
 * loci reveal how often those loci recombine, which places the locus on its chromosome map. Sequencing a fish reveals its
 * genotype (and doubles the evidence its clutches give), but not what the loci do. Scientist mode shows everything,
 * as the lab always did. Evidence is computed from the true genomes the simulation knows; the player sees only results.
 */
export const ATLAS_MODEL = 1;
export type AtlasMode = 'discovery' | 'scientist';
export type AtlasSpecies = {
  /** Segregation evidence per locus index. */
  evidence: number[];
  /** 0 unidentified · 1 trait identified · 2 inheritance characterized · 3 mapped. Never decreases. */
  stage: number[];
  /** Adjacent-locus linkage tallies keyed "i-j": [recombinant, informative] meioses. */
  links: Record<string, [number, number]>;
  /** Load site IDs seen expressed (defect notebook). */
  defects: number[];
};
export type AtlasState = { model: 1; mode: AtlasMode; koi: AtlasSpecies; axolotl: AtlasSpecies; sequenced: string[] };
/** A named open-ended allele. Its value and effects live in every genome that carries it; this holds the name. */
export type AlleleRecord = { id: number; species: Species; locus: number; origin: string; name: string; named: boolean };

export const ATLAS_LOCI = 72;
export const STAGE_EVIDENCE = [0, 16, 48] as const;
/** Informative meioses with a neighbouring locus needed to place a characterized locus on its chromosome map. */
export const MAP_MEIOSES = 40;
/** One clutch is a sample: at most this many offspring count toward evidence and linkage per parent. */
export const CLUTCH_SAMPLE = 8;
export const LINKAGE_SAMPLE = 10;
export const SEQUENCE_COST = 60;
export const MAX_SEQUENCED = 600;
export const MAX_ALLELE_RECORDS = 4000;
export const STAGE_LABELS = ['Unidentified', 'Trait identified', 'Inheritance known', 'Mapped'] as const;

const emptySpecies = (): AtlasSpecies => ({ evidence: Array(ATLAS_LOCI).fill(0), stage: Array(ATLAS_LOCI).fill(0), links: {}, defects: [] });
export const initialAtlas = (mode: AtlasMode): AtlasState => ({ model: 1, mode, koi: emptySpecies(), axolotl: emptySpecies(), sequenced: [] });

export type AtlasLocus = {
  index: number; id: string; label: string; chromosome: number; chromosomeLabel: string; position: number;
  dominance: DominanceClass | null; categorical: boolean; visibility: number;
};
const KOI_VISIBILITY = [0.7, 0.6, 0.9, 1, 0.9, 0.35, 0.35, 0.7, 1, 1, 1, 0.8];
const AXOLOTL_VISIBILITY: Record<string, number> = {
  'AX-BODY': 0.7, 'AX-HEAD': 0.6, 'AX-LIMB': 0.7, 'AX-TAIL': 0.8, 'AX-GILL': 0.9, 'AX-SKIN': 0.7, 'AX-PIG': 1, 'AX-COLOR': 1, 'AX-PATTERN': 0.9,
  'AX-LIFE': 0.35, 'AX-BEH': 0.35, 'AX-DEV': 0.8,
};
const AXOLOTL_CHROMOSOME_IDS = ['AX-BODY', 'AX-HEAD', 'AX-LIMB', 'AX-TAIL', 'AX-GILL', 'AX-SKIN', 'AX-PIG', 'AX-COLOR', 'AX-PATTERN', 'AX-LIFE', 'AX-BEH', 'AX-DEV'];

export const KOI_ATLAS: readonly AtlasLocus[] = LOCUS_REGISTRY.map(entry => ({
  index: entry.index, id: entry.id, label: entry.id.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase()), chromosome: entry.chromosome,
  chromosomeLabel: CHROMOSOMES[entry.chromosome - 1], position: entry.index % 6, dominance: entry.dominance, categorical: entry.dominance === null,
  visibility: KOI_VISIBILITY[entry.chromosome - 1],
}));
export const AXOLOTL_ATLAS: readonly AtlasLocus[] = AXOLOTL_V2_REGISTRY.map((entry, index) => ({
  index, id: entry.id, label: entry.label, chromosome: AXOLOTL_CHROMOSOME_IDS.indexOf(entry.chromosomeId) + 1, chromosomeLabel: entry.chromosomeLabel,
  position: index % 6, dominance: axolotlDominance(index), categorical: axolotlDominance(index) === null, visibility: AXOLOTL_VISIBILITY[entry.chromosomeId] ?? 0.6,
}));
export const atlasLoci = (species: Species) => species === 'koi' ? KOI_ATLAS : AXOLOTL_ATLAS;

/** How a genome's two copies at one locus read for the atlas: comparable values, or categorical identities. */
function values(fish: Fish): (index: number) => [number, number] | null {
  const genome = fish.genome;
  if (fish.species === 'axolotl') {
    const axolotl = genome as AxolotlGenome;
    if (axolotl.genesis) { const pair = axolotlPair(axolotl); return index => index < axolotl.maternal.length ? pair(index).map(r => r.value) as [number, number] : null; }
    return index => index < axolotl.maternal.length ? [AXOLOTL_V2_REGISTRY[index].alleles[axolotl.maternal[index]].effect, AXOLOTL_V2_REGISTRY[index].alleles[axolotl.paternal[index]].effect] : null;
  }
  const koi = genome as Genome, resolver = koi.genesis ? koiResolver(koi) : null;
  return index => {
    if (index >= koi.maternal.length) return null;
    if (resolver) return resolver.pair(index).map(r => r.value) as [number, number];
    return [koi.maternal[index], koi.paternal[index]];
  };
}

/** True when a parent's two copies at a locus differ enough for its offspring to show segregation. */
function informative(fish: Fish, locus: AtlasLocus, read: (index: number) => [number, number] | null): boolean {
  const pair = read(locus.index);
  if (!pair) return false;
  const ids = [fish.genome.maternal[locus.index], fish.genome.paternal[locus.index]];
  if (ids[0] === ids[1]) return false;
  if (locus.categorical) return true;
  return Math.abs(pair[0] - pair[1]) >= (fish.species === 'koi' ? 0.8 : 0.3);
}

/** Which parental homolog (0 maternal, 1 paternal) a child copy carries at a locus, or null when it cannot be told. */
function transmitted(parent: Fish, child: Fish, copy: 'maternal' | 'paternal', index: number): 0 | 1 | null {
  if (index >= parent.genome.maternal.length || index >= child.genome[copy].length) return null;
  const allele = child.genome[copy][index], m = parent.genome.maternal[index], p = parent.genome.paternal[index];
  if (m === p) return null;
  return allele === m ? 0 : allele === p ? 1 : null;
}

export type Observation = { atlas: AtlasState; discoveries: string[] };

/**
 * Learn from one family's hatched offspring. Pure: returns the updated atlas and plain-language discoveries.
 */
export function observeFamily(atlas: AtlasState, mother: Fish, father: Fish, offspring: readonly Fish[]): Observation {
  if (!offspring.length || mother.species !== father.species) return { atlas, discoveries: [] };
  const species = mother.species, loci = atlasLoci(species), before = atlas[species];
  const next: AtlasSpecies = { evidence: [...before.evidence], stage: [...before.stage], links: { ...before.links }, defects: [...before.defects] };
  const discoveries: string[] = [];
  const sequenced = new Set(atlas.sequenced), sample = Math.min(offspring.length, CLUTCH_SAMPLE);
  const hets = [mother, father].map(parent => { const read = values(parent); return loci.map(locus => informative(parent, locus, read)); });
  for (const [parent, copy, het] of [[mother, 'maternal', hets[0]], [father, 'paternal', hets[1]]] as const) {
    const weight = sequenced.has(parent.id) ? 2 : 1;
    // An intercross (both parents heterozygous) shows every genotype class, so it reveals dominance faster.
    loci.forEach((locus, i) => { if (het[i]) next.evidence[i] = Math.round((next.evidence[i] + sample * locus.visibility * weight * (hets[0][i] && hets[1][i] ? 0.75 : 0.5)) * 100) / 100; });
    // Linkage: offspring of a parent heterozygous at two neighbours on one chromosome.
    for (let i = 0; i < loci.length - 1; i++) {
      if (!het[i] || !het[i + 1] || loci[i].chromosome !== loci[i + 1].chromosome) continue;
      const key = `${i}-${i + 1}`, tally = [...(next.links[key] ?? [0, 0])] as [number, number];
      for (const child of offspring.slice(0, LINKAGE_SAMPLE)) {
        const a = transmitted(parent, child, copy, i), b = transmitted(parent, child, copy, i + 1);
        if (a === null || b === null) continue;
        tally[1]++; if (a !== b) tally[0]++;
      }
      next.links[key] = tally;
    }
  }
  loci.forEach((locus, i) => {
    let stage = next.stage[i];
    while (stage < 2 && next.evidence[i] >= STAGE_EVIDENCE[stage + 1]) stage++;
    const mapped = stage >= 2 && [`${i - 1}-${i}`, `${i}-${i + 1}`].some(key => (next.links[key]?.[1] ?? 0) >= MAP_MEIOSES);
    if (mapped) stage = 3;
    if (stage > next.stage[i]) {
      discoveries.push(stage === 1 ? `identified ${locus.label.toLowerCase()}` : stage === 2 ? `worked out how ${locus.label.toLowerCase()} is inherited` : `mapped ${locus.label.toLowerCase()} on chromosome ${locus.chromosome}`);
      next.stage[i] = stage;
    }
  });
  const catalog = loadCatalog(species);
  for (const child of offspring) {
    for (const site of child.genome.genesis?.load.maternal ?? []) {
      if (child.genome.genesis!.load.paternal.includes(site) && !next.defects.includes(site)) {
        next.defects.push(site);
        discoveries.push(`recorded a new defect, ${catalog.find(entry => entry.id === site)?.label.toLowerCase() ?? `site ${site}`}`);
      }
    }
  }
  return { atlas: { ...atlas, [species]: next }, discoveries };
}

/** Record lethal defects seen as eggs that never developed. */
export function recordLethal(atlas: AtlasState, species: Species, sites: readonly number[]): AtlasState {
  const known = atlas[species].defects, fresh = sites.filter(site => !known.includes(site));
  return fresh.length ? { ...atlas, [species]: { ...atlas[species], defects: [...known, ...fresh] } } : atlas;
}

/** What the player knows about a locus: everything in scientist mode. */
export const locusStage = (world: Pick<World, 'atlas'>, species: Species, index: number) => world.atlas.mode === 'scientist' ? 3 : world.atlas[species].stage[index] ?? 0;
/** Whether the inspector may show this fish's actual alleles. */
export const genotypeVisible = (world: Pick<World, 'atlas'>, fish: Pick<Fish, 'id'>) => world.atlas.mode === 'scientist' || world.atlas.sequenced.includes(fish.id);

/** Estimated map distance between two neighbours in centimorgans, from observed recombination; null before any data. */
export function mapDistance(atlas: AtlasState, species: Species, left: number): { cM: number; meioses: number } | null {
  const tally = atlas[species].links[`${left}-${left + 1}`];
  if (!tally || !tally[1]) return null;
  return { cM: Math.round(tally[0] / tally[1] * 1000) / 10, meioses: tally[1] };
}

export function atlasProgress(world: Pick<World, 'atlas'>, species: Species) {
  const stages = atlasLoci(species).map(locus => locusStage(world, species, locus.index));
  return { identified: stages.filter(s => s >= 1).length, characterized: stages.filter(s => s >= 2).length, mapped: stages.filter(s => s >= 3).length, total: stages.length };
}

export const dominanceText = (locus: AtlasLocus) => locus.dominance ? DOMINANCE_LABELS[locus.dominance] : 'Own rule: named variants (see note)';

/** Records for every open-ended allele a newborn carries that arose in it. */
export function newAlleleRecords(fish: Fish, existing: ReadonlySet<number>): AlleleRecord[] {
  return fish.mutations.filter(mutation => isNovel(mutation.to) && !existing.has(mutation.to))
    .map(mutation => ({ id: mutation.to, species: fish.species, locus: mutation.locus, origin: fish.id, name: fish.name, named: false }));
}

/** Label of a locus for an allele record. */
export const alleleLocusLabel = (record: Pick<AlleleRecord, 'species' | 'locus'>) => atlasLoci(record.species)[record.locus]?.label ?? `Locus ${record.locus}`;
