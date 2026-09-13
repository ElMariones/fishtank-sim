import type { Fish } from './types';

/** Exact recorded-pedigree kinship. Founders are unrelated and non-inbred.
 * Explicit stack and memoized diagonal terms avoid deep call stacks and repeated work.
 * Only required ancestor pairs are evaluated, with no generational cutoff.
 */
export function kinship(fish: readonly Fish[], first: string, second: string): number {
  const byId = new Map(fish.map(f => [f.id, f]));
  type Pair = [Fish | undefined, Fish | undefined];
  const ordered = ([a, b]: Pair): Pair => a && b && (a.generation < b.generation || (a.generation === b.generation && a.id < b.id)) ? [b, a] : [a, b];
  const key = ([a, b]: Pair) => `${a?.id ?? ''}|${b?.id ?? ''}`;
  const root = ordered([byId.get(first), byId.get(second)]);
  const stack: Pair[] = [root], memo = new Map<string, number>();
  while (stack.length) {
    const pair = stack.at(-1)!, [a, b] = pair, id = key(pair);
    if (memo.has(id)) { stack.pop(); continue; }
    if (!a || !b) { memo.set(id, 0); continue; }
    if (!a.parents) { memo.set(id, a.id === b.id ? 0.5 : 0); continue; }
    const parents = a.parents.map(parent => byId.get(parent));
    const dependencies: Pair[] = a.id === b.id
      ? [ordered([parents[0], parents[1]])]
      : [ordered([parents[0], b]), ordered([parents[1], b])];
    const missing = dependencies.find(dependency => !memo.has(key(dependency)));
    if (missing) { stack.push(missing); continue; }
    memo.set(id, a.id === b.id ? (1 + memo.get(key(dependencies[0]))!) / 2
      : (memo.get(key(dependencies[0]))! + memo.get(key(dependencies[1]))!) / 2);
  }
  return memo.get(key(root))!;
}
