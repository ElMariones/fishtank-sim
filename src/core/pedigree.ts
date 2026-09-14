import type { Fish } from './types';

/**
 * What pedigree kinship assumes about founders, whose parents were never recorded (FS-405). The lab default treats founder
 * stock as unrelated and not inbred; a base population may instead share a coancestry and inbreeding level. A parent ID
 * with no record is treated as one more founder.
 */
export type FounderAssumption = {
  /** Kinship between two different founders. */
  coancestry: number;
  /** Inbreeding coefficient of every founder, 0 to below 1. */
  inbreeding: number;
};
export const UNRELATED_FOUNDERS: FounderAssumption = { coancestry: 0, inbreeding: 0 };
/** Cached pairs kept before the cache starts over; recorded parent links are always kept. */
export const KINSHIP_CACHE_LIMIT = 500_000;

type PedigreeRecord = { id: string; generation: number; parents: readonly [string, string] | null };
export type KinshipStats = { records: number; entries: number; computed: number; resets: number; clears: number };

export type KinshipCache = {
  readonly assumption: FounderAssumption;
  /** Adds new records and keeps every cached value. A changed, duplicated or missing record rebuilds the cache; returns true then. */
  sync(fish: readonly Fish[]): boolean;
  /** Exact recorded-pedigree kinship: A[i,j] / 2 of the numerator relationship matrix. */
  kinship(first: string, second: string): number;
  /** Pedigree F: kinship of the parents, or the founder assumption for founders and unknown IDs. */
  inbreeding(id: string): number;
  /** Founders behind these fish (themselves included), and parent IDs without a record; their relatedness is assumed. */
  founders(ids: readonly string[]): { founders: string[]; missing: string[] };
  stats(): KinshipStats;
};

/**
 * Incremental kinship cache (FS-405). Parent links never change and records are never deleted, so a computed pair stays
 * valid as the world grows: syncing new births keeps every cached value. An explicit stack avoids deep call stacks, and
 * only the ancestor pairs a query needs are evaluated, with no generational cutoff.
 */
export function createKinshipCache(fish: readonly Fish[] = [], assumption: FounderAssumption = UNRELATED_FOUNDERS, limit = KINSHIP_CACHE_LIMIT): KinshipCache {
  const { coancestry, inbreeding: founderF } = assumption;
  if (!(founderF >= 0 && founderF < 1 && coancestry >= 0 && coancestry <= (1 + founderF) / 2)) throw new Error('Founder assumption is out of range.');
  const records = new Map<string, PedigreeRecord>(), memo = new Map<string, number>();
  let last: readonly Fish[] | null = null, computed = 0, resets = 0, clears = 0;
  const record = (member: Fish): PedigreeRecord => ({ id: member.id, generation: member.generation, parents: member.parents ? [member.parents[0], member.parents[1]] : null });

  function sync(list: readonly Fish[]): boolean {
    if (list === last) return false;
    last = list;
    let changed = list.length < records.size;
    for (let i = 0; !changed && i < list.length; i++) {
      const member = list[i], known = records.get(member.id);
      if (!known) records.set(member.id, record(member));
      else changed = known.generation !== member.generation || known.parents?.[0] !== member.parents?.[0] || known.parents?.[1] !== member.parents?.[1];
    }
    if (!changed && records.size === list.length) return false;
    records.clear(); memo.clear(); resets++;
    for (const member of list) records.set(member.id, record(member));
    return true;
  }

  type Pair = [PedigreeRecord | undefined, PedigreeRecord | undefined];
  // The younger fish is expanded first, so the recursion always moves toward founders.
  const ordered = ([a, b]: Pair): Pair => a && b && (a.generation < b.generation || (a.generation === b.generation && a.id < b.id)) ? [b, a] : [a, b];
  const key = ([a, b]: Pair) => `${a?.id ?? ''}|${b?.id ?? ''}`;
  const store = (id: string, value: number) => { memo.set(id, value); computed++; };

  function kinship(first: string, second: string): number {
    const root = ordered([records.get(first), records.get(second)]), rootKey = key(root);
    const cached = memo.get(rootKey);
    if (cached !== undefined) return cached;
    if (memo.size > limit) { memo.clear(); clears++; }
    const stack: Pair[] = [root];
    while (stack.length) {
      const pair = stack[stack.length - 1], [a, b] = pair, id = key(pair);
      if (memo.has(id)) { stack.pop(); continue; }
      if (!a || !b) { store(id, coancestry); continue; }
      if (!a.parents) { store(id, a.id === b.id ? (1 + founderF) / 2 : coancestry); continue; }
      const mother = records.get(a.parents[0]), father = records.get(a.parents[1]);
      const dependencies: Pair[] = a.id === b.id ? [ordered([mother, father])] : [ordered([mother, b]), ordered([father, b])];
      const missing = dependencies.find(dependency => !memo.has(key(dependency)));
      if (missing) { stack.push(missing); continue; }
      store(id, a.id === b.id ? (1 + memo.get(key(dependencies[0]))!) / 2
        : (memo.get(key(dependencies[0]))! + memo.get(key(dependencies[1]))!) / 2);
    }
    return memo.get(rootKey)!;
  }

  function inbreeding(id: string): number {
    const parents = records.get(id)?.parents;
    return parents ? kinship(parents[0], parents[1]) : founderF;
  }

  function founders(ids: readonly string[]) {
    const seen = new Set<string>(), found: string[] = [], missing: string[] = [], stack = ids.filter(Boolean);
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const known = records.get(id);
      if (!known) missing.push(id);
      else if (!known.parents) found.push(id);
      else stack.push(known.parents[0], known.parents[1]);
    }
    return { founders: found.sort(), missing: missing.sort() };
  }

  sync(fish);
  return { assumption, sync, kinship, inbreeding, founders, stats: () => ({ records: records.size, entries: memo.size, computed, resets, clears }) };
}

/** One-off exact kinship under the lab default: founders unrelated and not inbred. Sessions keep a cache instead. */
export function kinship(fish: readonly Fish[], first: string, second: string): number {
  return createKinshipCache(fish).kinship(first, second);
}
