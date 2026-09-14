import type { Fish } from './types';

/**
 * Genealogy queries for the family view (FS-404). Parent edges form a directed acyclic graph, so an ancestor reached by
 * several paths is one node that records every position it fills. Views are bounded to six generations back and six
 * forward; focusing a relative continues from there.
 */
export const MAX_ANCESTOR_DEPTH = 6;
export const MAX_DESCENDANT_DEPTH = 6;
/** Family breadcrumbs kept for Back; older steps drop off. */
export const MAX_TRAIL = 12;
export const SEARCH_LIMIT = 8;

export type GenealogyIndex = { byId: ReadonlyMap<string, Fish>; childrenOf: ReadonlyMap<string, readonly string[]> };

const idOrder = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

/** One pass over every record; rebuild it when the fish list changes. Children are listed in ID (birth) order. */
export function genealogyIndex(fish: readonly Fish[]): GenealogyIndex {
  const byId = new Map<string, Fish>(), childrenOf = new Map<string, string[]>();
  for (const member of fish) {
    byId.set(member.id, member);
    for (const parent of member.parents ?? []) {
      const children = childrenOf.get(parent);
      if (children) children.push(member.id); else childrenOf.set(parent, [member.id]);
    }
  }
  for (const children of childrenOf.values()) children.sort(idOrder);
  return { byId, childrenOf };
}

export type AncestorEdge = { childId: string; role: 'mother' | 'father' };
export type AncestorNode = {
  id: string;
  /** Nearest generation back where this ancestor appears (1 = parent); the view lists it there once. */
  depth: number;
  /** Every generation back where it appears within the view, nearest first. */
  depths: number[];
  /** Pedigree positions it fills within the view. More than one means repeated ancestry. */
  positions: number;
  /** Fish in the view, the focus included, that record it as a parent. */
  edges: AncestorEdge[];
  /** It has a recorded parent the view does not show; focusing it continues further back. */
  continues: boolean;
};
export type AncestorGeneration = {
  depth: number;
  /** 2^depth pedigree positions: recorded + unknown + missing. */
  positions: number;
  recorded: number;
  /** Positions above founder stock, whose parents were never recorded. Pedigree F assumes them unrelated and not inbred. */
  unknown: number;
  /** Positions whose recorded parent ID has no record in this world, and every position above them. */
  missing: number;
  /** Ancestors first reached at this generation, in pedigree position order (maternal line first). */
  nodes: AncestorNode[];
  /** Ancestors already listed at a nearer generation that appear here again. */
  repeated: string[];
};
export type AncestorGraph = {
  focusId: string;
  /** Generations shown, clamped to 1–6. */
  depth: number;
  generations: AncestorGeneration[];
  /** Distinct ancestors shown: at most 2 + 4 + … + 64 = 126. */
  size: number;
  /** An ancestor in the deepest generation shown has recorded parents. */
  deeper: boolean;
};

/** Ancestors of one fish up to `depth` generations back, each listed once at its nearest generation. */
export function ancestorGraph(index: GenealogyIndex, focusId: string, depth = 2): AncestorGraph {
  const bound = Math.max(1, Math.min(MAX_ANCESTOR_DEPTH, Math.floor(depth)));
  const focus = index.byId.get(focusId);
  const nodes = new Map<string, AncestorNode>(), generations: AncestorGeneration[] = [];
  if (!focus) return { focusId, depth: bound, generations, size: 0, deeper: false };
  // Positions each fish fills at the current generation. Unknown and missing positions double with every step back.
  let level = new Map([[focusId, 1]]), unknown = 0, missing = 0;
  for (let d = 1; d <= bound; d++) {
    const next = new Map<string, number>();
    unknown *= 2; missing *= 2;
    for (const [id, count] of level) {
      const parents = index.byId.get(id)!.parents;
      if (!parents) { unknown += 2 * count; continue; }
      for (const parent of parents) {
        if (index.byId.has(parent)) next.set(parent, (next.get(parent) ?? 0) + count);
        else missing += count;
      }
    }
    const generation: AncestorGeneration = { depth: d, positions: 2 ** d, recorded: 0, unknown, missing, nodes: [], repeated: [] };
    for (const [id, count] of next) {
      generation.recorded += count;
      const listed = nodes.get(id);
      if (listed) { listed.depths.push(d); listed.positions += count; generation.repeated.push(id); continue; }
      const node: AncestorNode = { id, depth: d, depths: [d], positions: count, edges: [], continues: false };
      nodes.set(id, node); generation.nodes.push(node);
    }
    generations.push(generation);
    level = next;
  }
  for (const child of [focus, ...[...nodes.keys()].map(id => index.byId.get(id)!)]) {
    child.parents?.forEach((parent, i) => nodes.get(parent)?.edges.push({ childId: child.id, role: i === 0 ? 'mother' : 'father' }));
  }
  const unshownParent = (id: string) => index.byId.get(id)!.parents?.some(parent => index.byId.has(parent) && !nodes.has(parent)) ?? false;
  for (const node of nodes.values()) node.continues = unshownParent(node.id);
  const deeper = [...level.keys()].some(id => index.byId.get(id)!.parents?.some(parent => index.byId.has(parent)) ?? false);
  return { focusId, depth: bound, generations, size: nodes.size, deeper };
}

export type Descendants = {
  /** Descendant IDs by nearest generation forward (first entry = children), each in ID order. Stops at an empty generation. */
  generations: string[][];
  total: number;
  /** Descendants in the deepest generation shown whose own children lie beyond the view. */
  continuing: number;
};

/** Descendants of one fish up to `depth` generations forward, each listed once at its nearest generation. */
export function descendantGenerations(index: GenealogyIndex, focusId: string, depth = MAX_DESCENDANT_DEPTH): Descendants {
  const bound = Math.max(1, Math.min(MAX_DESCENDANT_DEPTH, Math.floor(depth)));
  const seen = new Set([focusId]), generations: string[][] = [];
  let frontier = [focusId];
  while (generations.length < bound) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const child of index.childrenOf.get(id) ?? []) if (!seen.has(child)) { seen.add(child); next.push(child); }
    }
    if (!next.length) break;
    generations.push(next.sort(idOrder));
    frontier = next;
  }
  const continuing = generations.length === bound
    ? frontier.filter(id => (index.childrenOf.get(id) ?? []).some(child => !seen.has(child))).length : 0;
  return { generations, total: seen.size - 1, continuing };
}

/** "Parents", "Grandparents", "Great-grandparents", then "2× great-grandparents" and so on. */
export function ancestorLabel(depth: number): string {
  return depth === 1 ? 'Parents' : depth === 2 ? 'Grandparents' : depth === 3 ? 'Great-grandparents' : `${depth - 2}× great-grandparents`;
}

export function descendantLabel(depth: number): string {
  return depth === 1 ? 'Children' : depth === 2 ? 'Grandchildren' : depth === 3 ? 'Great-grandchildren' : `${depth - 2}× great-grandchildren`;
}

/**
 * Living and sold records matching a name or ID. An exact ID, also typed as digits such as "47", ranks first, then an
 * exact name, a name prefix and any other match, each in ID order.
 */
export function findRecords(fish: readonly Fish[], query: string, limit = SEARCH_LIMIT): { matches: Fish[]; total: number } {
  const text = query.trim().toLowerCase();
  if (!text) return { matches: [], total: 0 };
  const digits = /^(?:fsh-?)?(\d{1,6})$/.exec(text);
  const exactId = digits ? `FSH-${digits[1].padStart(6, '0')}` : null;
  const ranked: [number, Fish][] = [];
  for (const member of fish) {
    const name = member.name.toLowerCase();
    const rank = member.id === exactId ? 0 : name === text ? 1 : name.startsWith(text) ? 2
      : name.includes(text) || member.id.toLowerCase().includes(text) ? 3 : -1;
    if (rank >= 0) ranked.push([rank, member]);
  }
  ranked.sort((a, b) => a[0] - b[0] || idOrder(a[1].id, b[1].id));
  return { matches: ranked.slice(0, limit).map(([, member]) => member), total: ranked.length };
}

/** Breadcrumbs after moving from one fish to another. Revisiting a fish already on the trail returns there instead of looping. */
export function visitTrail(trail: readonly string[], fromId: string, toId: string): string[] {
  const earlier = trail.indexOf(toId);
  if (earlier >= 0) return trail.slice(0, earlier);
  return fromId === toId ? [...trail] : [...trail, fromId].slice(-MAX_TRAIL);
}
