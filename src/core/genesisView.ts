import { alleleLocusLabel, atlasLoci, genotypeVisible, locusStage, type AlleleRecord } from './atlas';
import { CHANNEL_LABELS, carriedSites, homozygousSites, loadCatalog, type Channel, type LoadSite, type NovelAllele } from './genesis';

import type { Fish, Species, World } from './types';

/**
 * Read-only views of Genesis state for the interface: carried novel alleles with their names, hidden load as far as the
 * player may see it, and exact load risk for a pair whose genotypes are known. Nothing here changes a world.
 */
export type CarriedAllele = { definition: NovelAllele; record: AlleleRecord | null; copies: 1 | 2; locusLabel: string; locusKnown: boolean; arose: boolean };

export function carriedAlleles(world: Pick<World, 'alleles' | 'atlas'>, fish: Fish): CarriedAllele[] {
  const block = fish.genome.genesis;
  if (!block) return [];
  const records = new Map(world.alleles.map(record => [record.id, record]));
  return block.novel.map(definition => {
    const copies = (Number(fish.genome.maternal[definition.locus] === definition.id) + Number(fish.genome.paternal[definition.locus] === definition.id)) as 1 | 2;
    const record = records.get(definition.id) ?? null, locusKnown = locusStage(world, fish.species, definition.locus) >= 1;
    return { definition, record, copies, locusKnown, arose: fish.mutations.some(m => m.to === definition.id),
      locusLabel: locusKnown ? alleleLocusLabel({ species: fish.species, locus: definition.locus }) : `an unidentified locus (${atlasLoci(fish.species)[definition.locus]?.chromosome ?? '?'}.${definition.locus % 6 + 1})` };
  });
}

/** A short name: the player's name for it, or the name of the fish where it arose. */
export const alleleName = (allele: Pick<CarriedAllele, 'record' | 'definition'>) => allele.record?.name ?? `Allele ${allele.definition.id}`;

/** Plain-language summary of what a novel allele does, in the units a player can read. */
export function alleleEffectText(definition: NovelAllele, species: Species): string {
  const scale = species === 'koi' ? 5 : 2, parentValue = definition.parent >= 1000 ? null : species === 'koi' ? definition.parent : null;
  const shift = parentValue === null ? '' : `${definition.value >= parentValue ? 'raises' : 'lowers'} its locus ${Math.abs(Math.round((definition.value - parentValue) / scale * 100))}%`;
  const dominance = definition.potency >= 1.05 ? 'dominant over every catalog allele' : definition.potency <= 0.35 ? 'mostly recessive' : 'partly dominant';
  const effects = (Object.entries(definition.effects) as [Channel, number][]).map(([channel, amount]) => `${amount > 0 ? '+' : '−'}${CHANNEL_LABELS[channel]}`);
  return [shift, dominance, effects.length ? `side effects: ${effects.join(', ')}` : 'no side effects'].filter(Boolean).join(' · ');
}

/** Living animals in this world carrying an allele, and of those how many carry two copies. */
export function alleleCarriers(world: Pick<World, 'fish'>, record: Pick<AlleleRecord, 'id' | 'locus' | 'species'>): { living: number; homozygous: number } {
  let living = 0, homozygous = 0;
  for (const fish of world.fish) {
    if (fish.status !== 'living' || fish.species !== record.species || !fish.genome.genesis) continue;
    const copies = Number(fish.genome.maternal[record.locus] === record.id) + Number(fish.genome.paternal[record.locus] === record.id);
    if (copies) { living++; if (copies === 2) homozygous++; }
  }
  return { living, homozygous };
}

export type LoadView = { known: boolean; expressed: LoadSite[]; carried: LoadSite[] };
/** Load the player may see: expressed defects always (they show), hidden carrier sites only once sequenced or in scientist mode. */
export function loadView(world: Pick<World, 'atlas'>, fish: Fish): LoadView {
  const catalog = loadCatalog(fish.species), load = fish.genome.genesis?.load, byId = new Map(catalog.map(site => [site.id, site]));
  if (!load) return { known: genotypeVisible(world, fish), expressed: [], carried: [] };
  const known = genotypeVisible(world, fish);
  return {
    known,
    expressed: homozygousSites(load).map(id => byId.get(id)!).filter(Boolean),
    carried: known ? carriedSites(load).map(id => byId.get(id)!).filter(Boolean) : [],
  };
}

/**
 * Exact share of a pair's offspring expected to express at least one recessive defect (ignoring new load mutations and
 * linkage between sites), or null when either parent's hidden load is unknown to the player.
 */
export function loadRisk(world: Pick<World, 'atlas'>, mother: Fish, father: Fish): { risk: number; lethal: number; sites: string[] } | null {
  if (!mother.genome.genesis || !father.genome.genesis || mother.species !== father.species) return null;
  if (!genotypeVisible(world, mother) || !genotypeVisible(world, father)) return null;
  const catalog = loadCatalog(mother.species), frequency = (fish: Fish, id: number) => (Number(fish.genome.genesis!.load.maternal.includes(id)) + Number(fish.genome.genesis!.load.paternal.includes(id))) / 2;
  let clear = 1, viable = 1;
  const sites: string[] = [];
  for (const site of catalog) {
    const p = frequency(mother, site.id) * frequency(father, site.id);
    if (!p) continue;
    clear *= 1 - p; if (site.kind === 'lethal') viable *= 1 - p;
    sites.push(`${site.label} (${Math.round(p * 100)}%)`);
  }
  return { risk: 1 - clear, lethal: 1 - viable, sites };
}

export const FINS_TEXT: Record<Species, Record<'standard' | 'veil' | 'butterfly', string>> = {
  koi: { standard: 'Standard fins', veil: 'Veil fins (one dominant copy)', butterfly: 'Butterfly fins (two copies)' },
  axolotl: { standard: 'Standard crest', veil: 'Frilled crest (one dominant copy)', butterfly: 'Sail crest (two copies)' },
  goldfish: { standard: 'Standard-length fins', veil: 'Long fins (one dominant copy)', butterfly: 'Veil-length fins (two copies)' },
};


