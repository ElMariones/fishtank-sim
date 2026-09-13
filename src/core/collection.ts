import { z } from 'zod';
import { measureDescriptors, VISUAL_DESCRIPTORS, type VisualDescriptorKey } from './descriptors';
import { isEgg } from './development';
import { express } from './genetics';
import type { Fish } from './types';

/**
 * Collection preferences are device-local player annotations (breeding goal, sort, favorites). They are stored apart
 * from the world save, never change fish records, and reset to defaults if missing or invalid (ADR-020).
 */
export const PREFERENCES_KEY = 'fishtank-sim.lab.v1.preferences';

export type GoalDirection = 'higher' | 'lower';
export type BreedingGoal = { descriptor: VisualDescriptorKey; direction: GoalDirection };
export const COLLECTION_SORTS = ['newest', 'oldest', 'name', 'goal'] as const;
export type CollectionSort = typeof COLLECTION_SORTS[number];
export type LabPreferences = { version: 1; goal: BreedingGoal | null; sort: CollectionSort; favorites: string[] };

export const DEFAULT_PREFERENCES: LabPreferences = { version: 1, goal: null, sort: 'newest', favorites: [] };

const descriptorKeys = VISUAL_DESCRIPTORS.map(descriptor => descriptor.key) as [VisualDescriptorKey, ...VisualDescriptorKey[]];
const schema = z.object({
  version: z.literal(1),
  goal: z.object({ descriptor: z.enum(descriptorKeys), direction: z.enum(['higher', 'lower']) }).nullable(),
  sort: z.enum(COLLECTION_SORTS),
  favorites: z.array(z.string().regex(/^FSH-\d{6}$/)).max(10_000),
});

/** Parses stored preferences for this world. Unknown fish IDs and duplicates are dropped; anything invalid yields defaults. */
export function decodePreferences(raw: string | null, fishIds: ReadonlySet<string>): LabPreferences {
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    const parsed = schema.parse(JSON.parse(raw));
    return { version: 1, goal: parsed.goal, sort: parsed.sort, favorites: [...new Set(parsed.favorites)].filter(id => fishIds.has(id)) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function toggleFavorite(preferences: LabPreferences, fishId: string): LabPreferences {
  const favorites = preferences.favorites.includes(fishId) ? preferences.favorites.filter(id => id !== fishId) : [...preferences.favorites, fishId];
  return { ...preferences, favorites };
}

/** Normalized 0–1 value of the goal descriptor (adult genetic potential). */
export function goalValue(fish: Fish, goal: BreedingGoal): number {
  return measureDescriptors(express(fish.genome))[goal.descriptor];
}

const sequence = (fish: Fish) => Number(fish.id.slice(4));

/** Stable ordering for the collection. "goal" without a goal falls back to newest first. Input is not mutated. */
export function sortCollection(fish: readonly Fish[], sort: CollectionSort, goal: BreedingGoal | null): Fish[] {
  const sorted = [...fish];
  if (sort === 'goal' && goal) {
    const values = new Map(sorted.map(f => [f.id, goalValue(f, goal)]));
    const sign = goal.direction === 'higher' ? -1 : 1;
    return sorted.sort((a, b) => sign * (values.get(a.id)! - values.get(b.id)!) || sequence(a) - sequence(b));
  }
  if (sort === 'oldest') return sorted.sort((a, b) => sequence(a) - sequence(b));
  if (sort === 'name') return sorted.sort((a, b) => a.name.localeCompare(b.name) || sequence(a) - sequence(b));
  return sorted.sort((a, b) => sequence(b) - sequence(a));
}

export type Cohort = { key: string; motherId: string; fatherId: string; size: number; newest: number };

/** Parent pairs among the given fish, most recent cohort first. */
export function cohortsOf(fish: readonly Fish[]): Cohort[] {
  const cohorts = new Map<string, Cohort>();
  for (const f of fish) {
    if (!f.parents) continue;
    const key = `${f.parents[0]}×${f.parents[1]}`;
    const cohort = cohorts.get(key) ?? { key, motherId: f.parents[0], fatherId: f.parents[1], size: 0, newest: 0 };
    cohort.size++;
    cohort.newest = Math.max(cohort.newest, sequence(f));
    cohorts.set(key, cohort);
  }
  return [...cohorts.values()].sort((a, b) => b.newest - a.newest);
}

/** Highest-ranked living, hatched fish of each sex for the goal: a convenience, not a universal "best match". Eggs cannot breed. */
export function goalLeaders(fish: readonly Fish[], goal: BreedingGoal): { mother: Fish | null; father: Fish | null } {
  const ranked = sortCollection(fish.filter(f => f.status === 'living' && !isEgg(f.life)), 'goal', goal);
  return { mother: ranked.find(f => f.sex === 'F') ?? null, father: ranked.find(f => f.sex === 'M') ?? null };
}
