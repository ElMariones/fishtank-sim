import { GENOME_LOCI } from './catalog';
import { AXOLOTL_LOCUS_REGISTRY, axolotlAlleleLabel } from './axolotlCatalog';
import { isAxolotlGenome } from './axolotlGenetics';
import { alleleLabel, LOCUS_REGISTRY } from './registry';
import type { AlleleOrigin, Fish, Mutation, World } from './types';

/**
 * Mutation origins (FS-603). Every de novo mutation is an origin named after the fish and the chromosome copy it arose on.
 * A child inherits an origin only when meiosis transmitted the parental homolog that carries it, so two fish share an
 * origin by descent, never because the same allele appeared again. Counts are local to one save: founders, shop stock
 * and rescued fish carry no origins, and nothing is compared with other players or a global population.
 */
export const ORIGIN_MODEL = 1;
export const MAX_ORIGINS_PER_FISH = GENOME_LOCI.length * 2;
/** Rows the notebook lists at once. */
export const NOTEBOOK_ROWS = 30;

/** Which homolog (0 maternal, 1 paternal) each parent transmitted at every locus, as recorded by `inherit`. */
export type InheritanceTrace = { maternal: (0 | 1)[]; paternal: (0 | 1)[] };
export const emptyTrace = (): InheritanceTrace => ({ maternal: [], paternal: [] });

const COPY_CODE = { maternal: 'm', paternal: 'p' } as const;
export const originId = (fishId: string, locus: number, copy: Mutation['copy']) => `${fishId}/${locus}${COPY_CODE[copy]}`;
export const ORIGIN_ID_PATTERN = /^(FSH-\d{6})\/(\d{1,2})([mp])$/;

export function parseOriginId(id: string): { fishId: string; locus: number; copy: Mutation['copy'] } | null {
  const match = ORIGIN_ID_PATTERN.exec(id);
  return match ? { fishId: match[1], locus: Number(match[2]), copy: match[3] === 'm' ? 'maternal' : 'paternal' } : null;
}

const byPosition = (a: AlleleOrigin, b: AlleleOrigin) => a.locus - b.locus || (a.copy === b.copy ? 0 : a.copy === 'maternal' ? -1 : 1);

/** A new fish's origins: the parental origins its transmitted homologs carried, replaced wherever a new mutation arose. */
export function childOrigins(childId: string, mother: Pick<Fish, 'origins'>, father: Pick<Fish, 'origins'>, trace: InheritanceTrace, mutations: readonly Mutation[]): AlleleOrigin[] {
  const origins = new Map<string, AlleleOrigin>();
  for (const [copy, parent] of [['maternal', mother], ['paternal', father]] as const) {
    const sides = trace[copy];
    for (const origin of parent.origins) {
      if (sides[origin.locus] === (origin.copy === 'maternal' ? 0 : 1)) origins.set(`${origin.locus}${copy}`, { locus: origin.locus, copy, id: origin.id });
    }
  }
  for (const mutation of mutations) origins.set(`${mutation.locus}${mutation.copy}`, { locus: mutation.locus, copy: mutation.copy, id: originId(childId, mutation.locus, mutation.copy) });
  return [...origins.values()].sort(byPosition);
}

/**
 * Origins for records saved before FS-603, rebuilt from genomes in ID order (parents precede children). A fish keeps its
 * own recorded mutations. It inherits a parental origin only when its allele matches the carrying homolog and differs
 * from the parent's other homolog, so the transmitted copy is certain; otherwise the origin is left untraced.
 */
export function reconstructOrigins(fish: readonly Omit<Fish, 'origins'>[]): { fish: Fish[]; untraced: number } {
  const done = new Map<string, Fish>();
  let untraced = 0;
  const ordered = [...fish].sort((a, b) => a.id.localeCompare(b.id));
  for (const member of ordered) {
    const origins: AlleleOrigin[] = member.mutations.map(mutation => ({ locus: mutation.locus, copy: mutation.copy, id: originId(member.id, mutation.locus, mutation.copy) }));
    const own = new Set(origins.map(origin => `${origin.locus}${origin.copy}`));
    if (member.parents) {
      for (const [copy, parentId] of [['maternal', member.parents[0]], ['paternal', member.parents[1]]] as const) {
        const parent = done.get(parentId);
        if (!parent || parent.species !== member.species) continue;
        for (const origin of parent.origins) {
          if (own.has(`${origin.locus}${copy}`) || origin.locus >= member.genome.maternal.length) continue;
          const other = origin.copy === 'maternal' ? 'paternal' : 'maternal';
          const carried = parent.genome[origin.copy][origin.locus], child = member.genome[copy][origin.locus];
          if (child === carried && parent.genome[other][origin.locus] !== carried) origins.push({ locus: origin.locus, copy, id: origin.id });
          else if (child === carried) untraced++;
        }
      }
    }
    done.set(member.id, { ...member, origins: origins.sort(byPosition) });
  }
  return { fish: fish.map(member => done.get(member.id)!), untraced };
}

export type OriginSummary = {
  id: string; locus: number; locusId: string; locusLabel: string; from: number; to: number; change: string;
  firstCarrierId: string; firstCarrierName: string; generation: number; structural: boolean;
  /** Living fish carrying at least one copy, of those living fish carrying two, and every record carrying it. */
  living: number; homozygous: number; records: number;
};
export type MutationNotebook = { living: number; records: number; origins: OriginSummary[] };

function originLabels(first: Fish, mutation: Mutation, locus: number): Pick<OriginSummary, 'locusId' | 'locusLabel' | 'change' | 'structural'> {
  if (isAxolotlGenome(first.genome)) {
    const entry = AXOLOTL_LOCUS_REGISTRY[locus];
    if (!entry) return { locusId: `axo-locus-${locus}`, locusLabel: `Axolotl locus ${locus}`, change: `A${mutation.from} → A${mutation.to}`, structural: false };
    const from = axolotlAlleleLabel(entry.id, mutation.from), to = axolotlAlleleLabel(entry.id, mutation.to);
    return {
      locusId: entry.id,
      locusLabel: entry.label,
      change: `A${mutation.from} → A${mutation.to} (${from} → ${to})`,
      structural: false,
    };
  }
  const entry = LOCUS_REGISTRY[locus];
  const named = entry.index >= 48 ? ` (${alleleLabel(entry.id, mutation.from)} → ${alleleLabel(entry.id, mutation.to)})` : '';
  return {
    locusId: entry.id,
    locusLabel: entry.id.replaceAll('_', ' '),
    change: `A${mutation.from} → A${mutation.to}${named}`,
    structural: entry.sinceGenome === 3 && entry.mutationRate < 0.003,
  };
}

/** Save-local carrier counts for every origin, in one pass over the records; living carriers first, then oldest. */
export function mutationNotebook(world: Pick<World, 'fish'>): MutationNotebook {
  const byId = new Map(world.fish.map(member => [member.id, member]));
  const summaries = new Map<string, OriginSummary>();
  let living = 0;
  for (const member of world.fish) {
    const alive = member.status === 'living';
    if (alive) living++;
    const seen = new Map<string, number>();
    for (const origin of member.origins) seen.set(origin.id, (seen.get(origin.id) ?? 0) + 1);
    for (const [id, copies] of seen) {
      let summary = summaries.get(id);
      if (!summary) {
        const parsed = parseOriginId(id)!, first = byId.get(parsed.fishId), mutation = first?.mutations.find(m => m.locus === parsed.locus && m.copy === parsed.copy);
        if (!first || !mutation) continue;
        const labels = originLabels(first, mutation, parsed.locus), from = mutation.from, to = mutation.to;
        summary = {
          id, locus: parsed.locus, ...labels, from, to,
          firstCarrierId: parsed.fishId, firstCarrierName: first.name, generation: first.generation,
          living: 0, homozygous: 0, records: 0,
        };
        summaries.set(id, summary);
      }
      summary.records++;
      if (alive) { summary.living++; if (copies > 1) summary.homozygous++; }
    }
  }
  const origins = [...summaries.values()].sort((a, b) => b.living - a.living || a.firstCarrierId.localeCompare(b.firstCarrierId) || a.locus - b.locus);
  return { living, records: world.fish.length, origins };
}

/** Why a record's origins are inconsistent with the world, or null. */
export function originProblem(member: Fish, byId: ReadonlyMap<string, Fish>): string | null {
  const positions = new Set<string>();
  for (const origin of member.origins) {
    const parsed = parseOriginId(origin.id), key = `${origin.locus}${origin.copy}`;
    if (!parsed || positions.has(key) || origin.locus >= member.genome.maternal.length) return 'Invalid mutation origin.';
    positions.add(key);
    const first = byId.get(parsed.fishId), mutation = first?.mutations.find(m => m.locus === parsed.locus && m.copy === parsed.copy);
    if (!first || !mutation || parsed.locus !== origin.locus) return 'A mutation origin names no recorded mutation.';
    if (first.species !== member.species || isAxolotlGenome(first.genome) !== isAxolotlGenome(member.genome)) return 'A mutation origin cannot cross species.';
    if (member.genome[origin.copy][origin.locus] !== mutation.to) return 'A carried mutation origin does not match the allele.';
    if (first.id === member.id ? parsed.copy !== origin.copy : !member.parents) return 'A founder cannot inherit a mutation origin.';
  }
  for (const mutation of member.mutations) if (!member.origins.some(origin => origin.id === originId(member.id, mutation.locus, mutation.copy))) return 'A new mutation is missing its origin.';
  return null;
}
