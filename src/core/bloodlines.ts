import { measureDescriptors, VISUAL_DESCRIPTORS, type VisualDescriptorKey } from './descriptors';
import { isAxolotlGenome } from './axolotlGenetics';
import { express } from './genetics';
import type { Bloodline, BloodlineStandard, Fish, World } from './types';

/**
 * Named bloodlines (FS-604). Registering a line records its foundation fish and a standard taken from them at that
 * moment. Two measures stay separate because they answer different questions:
 * - ancestry contribution: the expected share of a fish's genome descended from the foundation, from recorded parents only;
 * - standard similarity: how closely the fish's adult genetic phenotype matches the standard, whatever its ancestry.
 * An unrelated lookalike can match the standard closely, and a pure descendant can drift away from it.
 */
export const BLOODLINE_MODEL = 1;
export const MAX_BLOODLINES = 20;
export const MAX_FOUNDATION = 8;
/** Shared mutation origins kept as a line's signature. */
export const MAX_SIGNATURE_ORIGINS = 6;
export const SIMILARITY_WEIGHTS = { descriptors: 0.6, structure: 0.25, origins: 0.15 } as const;
/**
 * Mean normalized descriptor difference that scores 0 shape similarity. Measured on 400 seeded genome v3 pairs: median
 * 0.17 between unrelated founders, 0.105 between full siblings and 0.12 parent to child, so shape reads about 43%, 65% and
 * 60% for them.
 */
export const DESCRIPTOR_TOLERANCE = 0.3;

export const bloodlineId = (n: number) => `BL-${n.toString().padStart(6, '0')}`;
const normalizedName = (name: string) => name.trim().toLocaleLowerCase('en');

/** Descriptor means, the most common structure and origins every foundation fish carries. */
export function captureStandard(foundation: readonly Fish[]): BloodlineStandard {
  if (foundation.some(fish => fish.species === 'axolotl' || isAxolotlGenome(fish.genome))) {
    throw new Error('Only koi can found a koi bloodline.');
  }
  const descriptors = Object.fromEntries(VISUAL_DESCRIPTORS.map(({ key }) => [key, 0])) as Record<VisualDescriptorKey, number>;
  const tails = new Map<string, number>(), dorsals = new Map<string, number>(), barbels = new Map<number, number>();
  for (const fish of foundation) {
    const p = express(fish.genome), measured = measureDescriptors(p);
    for (const { key } of VISUAL_DESCRIPTORS) descriptors[key] += measured[key] / foundation.length;
    tails.set(p.structure.tail, (tails.get(p.structure.tail) ?? 0) + 1);
    dorsals.set(p.structure.dorsal, (dorsals.get(p.structure.dorsal) ?? 0) + 1);
    barbels.set(p.structure.barbels, (barbels.get(p.structure.barbels) ?? 0) + 1);
  }
  // Ties go to the first form seen in foundation order, so the standard does not depend on map internals.
  const common = <T>(counts: Map<T, number>) => [...counts].reduce((best, entry) => (entry[1] > best[1] ? entry : best))[0];
  const shared = foundation[0].origins.map(origin => origin.id).filter((id, i, ids) => ids.indexOf(id) === i && foundation.every(fish => fish.origins.some(origin => origin.id === id)));
  return {
    descriptors,
    tail: common(tails) as BloodlineStandard['tail'], dorsal: common(dorsals) as BloodlineStandard['dorsal'], barbels: common(barbels) as BloodlineStandard['barbels'],
    signatureOrigins: shared.slice(0, MAX_SIGNATURE_ORIGINS),
  };
}

/** Why a registration is refused, or null. */
export function registrationProblem(world: Pick<World, 'fish' | 'bloodlines'>, name: string, foundationIds: readonly string[]): string | null {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 32) return 'Name the bloodline with 1 to 32 characters.';
  if (world.bloodlines.some(line => normalizedName(line.name) === normalizedName(trimmed))) return `A bloodline named ${trimmed} is already registered.`;
  if (world.bloodlines.length >= MAX_BLOODLINES) return `This lab registers at most ${MAX_BLOODLINES} bloodlines.`;
  if (!foundationIds.length || foundationIds.length > MAX_FOUNDATION) return `Choose 1 to ${MAX_FOUNDATION} foundation fish.`;
  if (new Set(foundationIds).size !== foundationIds.length) return 'Each foundation fish can be listed once.';
  const byId = new Map(world.fish.map(fish => [fish.id, fish]));
  if (foundationIds.some(id => !byId.has(id))) return 'A foundation fish has no record in this aquarium.';
  if (foundationIds.some(id => {
    const fish = byId.get(id)!;
    return fish.species === 'axolotl' || isAxolotlGenome(fish.genome);
  })) return 'Only koi can found a koi bloodline.';
  if (foundationIds.some(id => byId.get(id)!.life.lengthCm === 0)) return 'Eggs cannot found a bloodline. Wait until they hatch.';
  return null;
}

export type Contributions = ReadonlyMap<string, number>;

/**
 * Expected foundation share for every record: 1 for a foundation fish, 0 for other founders and unrecorded parents,
 * otherwise half of each parent's share. Records are processed in ID order, so parents always precede children.
 */
export function ancestryContributions(world: Pick<World, 'fish'>, line: Pick<Bloodline, 'foundationIds'>): Contributions {
  const foundation = new Set(line.foundationIds), shares = new Map<string, number>();
  for (const fish of [...world.fish].sort((a, b) => a.id.localeCompare(b.id))) {
    shares.set(fish.id, foundation.has(fish.id) ? 1 : fish.parents ? ((shares.get(fish.parents[0]) ?? 0) + (shares.get(fish.parents[1]) ?? 0)) / 2 : 0);
  }
  return shares;
}

export type Similarity = { overall: number; descriptors: number; structure: number; origins: number | null };

/** Standard similarity of a fish, 0–1, with each component. Uses the adult genetic phenotype, never current size or care. */
export function standardSimilarity(fish: Pick<Fish, 'genome' | 'origins'>, standard: BloodlineStandard): Similarity {
  if (isAxolotlGenome(fish.genome)) {
    return { overall: 0, descriptors: 0, structure: 0, origins: standard.signatureOrigins.length ? 0 : null };
  }
  const p = express(fish.genome), measured = measureDescriptors(p);
  const difference = VISUAL_DESCRIPTORS.reduce((sum, { key }) => sum + Math.abs(measured[key] - standard.descriptors[key]), 0) / VISUAL_DESCRIPTORS.length;
  const descriptors = Math.max(0, 1 - difference / DESCRIPTOR_TOLERANCE);
  const structure = [p.structure.tail === standard.tail, p.structure.dorsal === standard.dorsal, p.structure.barbels === standard.barbels].filter(Boolean).length / 3;
  const origins = standard.signatureOrigins.length
    ? standard.signatureOrigins.filter(id => fish.origins.some(origin => origin.id === id)).length / standard.signatureOrigins.length : null;
  const weights = origins === null
    ? { descriptors: SIMILARITY_WEIGHTS.descriptors, structure: SIMILARITY_WEIGHTS.structure, origins: 0 }
    : SIMILARITY_WEIGHTS;
  const total = weights.descriptors + weights.structure + weights.origins;
  const overall = (weights.descriptors * descriptors + weights.structure * structure + weights.origins * (origins ?? 0)) / total;
  return { overall, descriptors, structure, origins };
}

export type BloodlineSummary = {
  line: Bloodline; foundationNames: string[];
  /** Living fish with any foundation ancestry, and their mean contribution and standard similarity. */
  livingMembers: number; meanContribution: number; meanSimilarity: number;
  /** The living member closest to the standard. */
  closest: { id: string; name: string; similarity: number; contribution: number } | null;
};

export function bloodlineSummaries(world: Pick<World, 'fish' | 'bloodlines'>): BloodlineSummary[] {
  const byId = new Map(world.fish.map(fish => [fish.id, fish]));
  return world.bloodlines.map(line => {
    const shares = ancestryContributions(world, line);
    let livingMembers = 0, contribution = 0, similarity = 0, closest: BloodlineSummary['closest'] = null;
    for (const fish of world.fish) {
      const share = shares.get(fish.id) ?? 0;
      if (fish.status !== 'living' || fish.species !== 'koi' || share === 0) continue;
      const match = standardSimilarity(fish, line.standard).overall;
      livingMembers++; contribution += share; similarity += match;
      if (!closest || match > closest.similarity) closest = { id: fish.id, name: fish.name, similarity: match, contribution: share };
    }
    return {
      line, foundationNames: line.foundationIds.map(id => byId.get(id)?.name ?? id), livingMembers,
      meanContribution: livingMembers ? contribution / livingMembers : 0, meanSimilarity: livingMembers ? similarity / livingMembers : 0, closest,
    };
  });
}

/** A standard whose structure is the baseline adds nothing to say about structure. */
export const standardStructureText = (standard: BloodlineStandard) =>
  standard.tail === 'standard' && standard.dorsal === 'normal' && standard.barbels === 2
    ? 'standard tail, dorsal fin and two barbels'
    : `${standard.tail === 'standard' ? 'standard' : standard.tail === 'paired' ? 'paired fan' : 'crown-four'} tail, ${standard.dorsal === 'normal' ? 'normal' : standard.dorsal} dorsal fin, ${standard.barbels} barbels`;
