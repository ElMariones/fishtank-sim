import { describe, expect, it } from 'vitest';
import {
  ancestorGraph, ancestorLabel, descendantGenerations, descendantLabel, findRecords, genealogyIndex, MAX_ANCESTOR_DEPTH, MAX_DESCENDANT_DEPTH,
  MAX_TRAIL, visitTrail, type AncestorGraph, type GenealogyIndex,
} from '../src/core/genealogy';
import { random } from '../src/core/random';
import type { Fish } from '../src/core/types';
import { applyCommand, createWorld, MAX_RECORDS } from '../src/core/world';

const NOW = '2026-09-13T12:00:00.000Z';
const base = createWorld(NOW);
const fishId = (n: number) => `FSH-${String(n).padStart(6, '0')}`;
const make = (n: number, sex: Fish['sex'], parents: readonly [Fish, Fish] | null): Fish => ({
  ...base.fish[0], id: fishId(n), name: `Fish ${n}`, sex,
  parents: parents ? [parents[0].id, parents[1].id] : null, generation: parents ? Math.max(parents[0].generation, parents[1].generation) + 1 : 0,
});

/** Reference: the full pedigree written out as 2^d explicit positions per generation, with nothing shared. */
function positionsByGeneration(index: GenealogyIndex, focusId: string, depth: number): string[][] {
  const levels: string[][] = [];
  let level = [focusId];
  for (let d = 1; d <= depth; d++) {
    level = level.flatMap(slot => {
      if (slot === 'unknown' || slot === 'missing') return [slot, slot];
      const parents = index.byId.get(slot)!.parents;
      return parents ? parents.map(parent => index.byId.has(parent) ? parent : 'missing') : ['unknown', 'unknown'];
    });
    levels.push(level);
  }
  return levels;
}

function expectMatchesReference(graph: AncestorGraph, index: GenealogyIndex) {
  const levels = positionsByGeneration(index, graph.focusId, graph.depth), first = new Map<string, number>();
  levels.forEach((level, i) => level.forEach(slot => { if (index.byId.has(slot) && !first.has(slot)) first.set(slot, i + 1); }));
  expect(graph.generations).toHaveLength(graph.depth);
  graph.generations.forEach((generation, i) => {
    const level = levels[i], distinct = [...new Set(level.filter(slot => index.byId.has(slot)))];
    expect([generation.positions, generation.recorded, generation.unknown, generation.missing]).toEqual([
      2 ** (i + 1), level.filter(slot => index.byId.has(slot)).length, level.filter(slot => slot === 'unknown').length, level.filter(slot => slot === 'missing').length,
    ]);
    expect(generation.nodes.map(node => node.id)).toEqual(distinct.filter(id => first.get(id) === i + 1));
    expect(generation.repeated).toEqual(distinct.filter(id => first.get(id)! < i + 1));
  });
  const listed = graph.generations.flatMap(generation => generation.nodes), shown = new Set(listed.map(node => node.id));
  expect(graph.size).toBe(first.size);
  expect(listed).toHaveLength(first.size);
  const viewed = [graph.focusId, ...listed.map(node => node.id)];
  for (const node of listed) {
    expect(node.depth).toBe(first.get(node.id));
    expect(node.positions).toBe(levels.flat().filter(slot => slot === node.id).length);
    expect(node.depths).toEqual(levels.flatMap((level, i) => level.includes(node.id) ? [i + 1] : []));
    expect(node.edges).toEqual(viewed.flatMap(id => (index.byId.get(id)!.parents ?? [])
      .flatMap((parent, i) => parent === node.id ? [{ childId: id, role: i === 0 ? 'mother' : 'father' }] : [])));
    expect(node.continues).toBe(index.byId.get(node.id)!.parents?.some(parent => index.byId.has(parent) && !shown.has(parent)) ?? false);
    if (node.continues) expect(node.depth).toBe(graph.depth);
  }
  expect(graph.deeper).toBe(levels.at(-1)!.some(slot => index.byId.get(slot)?.parents?.some(parent => index.byId.has(parent)) ?? false));
}

/** Parents drawn from the most recent ten of each sex, so lines inbreed and ancestors repeat. */
function randomPedigree(seed: number, size: number): Fish[] {
  const rng = random(seed);
  const fish: Fish[] = Array.from({ length: 12 }, (_, i) => make(i + 1, i % 2 ? 'M' : 'F', null));
  while (fish.length < size) {
    const recent = (sex: Fish['sex']) => { const group = fish.filter(f => f.sex === sex); return group[group.length - 1 - Math.floor(rng() * Math.min(group.length, 10))]; };
    fish.push(make(fish.length + 1, rng() < 0.5 ? 'F' : 'M', [recent('F'), recent('M')]));
  }
  return fish;
}

describe('FS-404 ancestor graph', () => {
  it('lists a repeated ancestor once, with every position it fills and every child it links to', () => {
    const [a, b, c] = [make(1, 'F', null), make(2, 'M', null), make(3, 'F', null)];
    const halfSister = make(4, 'F', [a, b]), halfBrother = make(5, 'M', [c, b]);
    const focus = make(6, 'F', [halfSister, halfBrother]), backcross = make(7, 'M', [focus, b]);
    const index = genealogyIndex([backcross, focus, halfBrother, halfSister, c, b, a]);

    const graph = ancestorGraph(index, focus.id, 3);
    expect(graph.generations.map(g => [g.recorded, g.unknown, g.missing, g.nodes.map(n => n.id), g.repeated])).toEqual([
      [2, 0, 0, [halfSister.id, halfBrother.id], []],
      [4, 0, 0, [a.id, b.id, c.id], []],
      [0, 8, 0, [], []],
    ]);
    expect(graph.generations[1].nodes[1]).toMatchObject({
      id: b.id, positions: 2, depths: [2], continues: false,
      edges: [{ childId: halfSister.id, role: 'father' }, { childId: halfBrother.id, role: 'father' }],
    });
    expect([graph.size, graph.deeper]).toEqual([5, false]);

    const back = ancestorGraph(index, backcross.id, 3);
    expect(back.generations.map(g => [g.recorded, g.unknown, g.nodes.map(n => n.id), g.repeated])).toEqual([
      [2, 0, [focus.id, b.id], []],
      [2, 2, [halfSister.id, halfBrother.id], []],
      [4, 4, [a.id, c.id], [b.id]],
    ]);
    expect(back.generations[0].nodes[1]).toMatchObject({
      id: b.id, depth: 1, depths: [1, 3], positions: 3,
      edges: [{ childId: backcross.id, role: 'father' }, { childId: halfSister.id, role: 'father' }, { childId: halfBrother.id, role: 'father' }],
    });
    expectMatchesReference(graph, index);
    expectMatchesReference(back, index);
    expect(ancestorGraph(index, 'FSH-999999', 3)).toEqual({ focusId: 'FSH-999999', depth: 3, generations: [], size: 0, deeper: false });
  });

  it('matches an explicit position-by-position pedigree on random inbred lines with missing records', () => {
    const rng = random(404), dropped = new Set([fishId(15), fishId(120), fishId(260)]);
    const fish = randomPedigree(404, 400).filter(f => !dropped.has(f.id));
    const index = genealogyIndex(fish);
    let repeated = 0, missing = 0, continuing = 0;
    const check = (focus: Fish, depth: number) => {
      const graph = ancestorGraph(index, focus.id, depth);
      expectMatchesReference(graph, index);
      expect(graph.size).toBeLessThanOrEqual(126);
      for (const generation of graph.generations) {
        expect(generation.nodes.length + generation.repeated.length).toBeLessThanOrEqual(generation.positions);
        if (generation.repeated.length || generation.nodes.some(node => node.positions > 1)) repeated++;
        if (generation.missing) missing++;
      }
      continuing += graph.generations.flatMap(generation => generation.nodes).filter(node => node.continues).length;
    };
    for (const focus of fish) check(focus, MAX_ANCESTOR_DEPTH);
    for (let trial = 0; trial < 120; trial++) check(fish[Math.floor(rng() * fish.length)], 1 + Math.floor(rng() * MAX_ANCESTOR_DEPTH));
    expect(repeated).toBeGreaterThan(0);
    expect(missing).toBeGreaterThan(0);
    expect(continuing).toBeGreaterThan(0);
  });

  it('reaches ten recorded generations six at a time by focusing an ancestor', () => {
    const line: Fish[] = [make(1, 'F', null), make(2, 'M', null)];
    for (let generation = 1; generation <= 10; generation++) {
      const [sister, brother] = line.slice(-2);
      line.push(make(line.length + 1, 'F', [sister, brother]), make(line.length + 2, 'M', [sister, brother]));
    }
    const index = genealogyIndex(line), focus = line.at(-2)!;
    const view = ancestorGraph(index, focus.id, 9);
    expect(view.depth).toBe(MAX_ANCESTOR_DEPTH);
    expect(view.generations.map(g => [g.recorded, g.nodes.length, g.nodes[0].positions])).toEqual([1, 2, 3, 4, 5, 6].map(d => [2 ** d, 2, 2 ** (d - 1)]));
    const oldest = view.generations[5].nodes;
    expect(oldest.map(node => index.byId.get(node.id)!.generation)).toEqual([4, 4]);
    expect([view.deeper, oldest.every(node => node.continues)]).toEqual([true, true]);

    const further = ancestorGraph(index, oldest[0].id, MAX_ANCESTOR_DEPTH);
    expect(further.generations.map(g => [g.recorded, g.unknown])).toEqual([[2, 0], [4, 0], [8, 0], [16, 0], [0, 32], [0, 64]]);
    expect(further.generations[3].nodes.map(node => node.id)).toEqual([line[0].id, line[1].id]);
    expect(further.deeper).toBe(false);
    expect([1, 2, 3, 4, 5, 6].map(depth => ancestorLabel(depth))).toEqual(['Parents', 'Grandparents', 'Great-grandparents', '2× great-grandparents', '3× great-grandparents', '4× great-grandparents']);

    const down = descendantGenerations(index, line[0].id);
    expect(down.generations.map(ids => ids.length)).toEqual([2, 2, 2, 2, 2, 2]);
    expect([down.total, down.continuing]).toEqual([12, 2]);
    expect(descendantGenerations(index, line.at(-1)!.id)).toEqual({ generations: [], total: 0, continuing: 0 });
    expect([1, 2, 3, 4].map(depth => descendantLabel(depth))).toEqual(['Children', 'Grandchildren', 'Great-grandchildren', '2× great-grandchildren']);
  });

  it('keeps sold and cross-tank relatives in the graph whatever the record order', () => {
    const bred = applyCommand(base, { type: 'breed', motherId: fishId(1), fatherId: fishId(2), tankId: 'tank-2', timestamp: NOW });
    const moved = applyCommand(bred, { type: 'move', fishId: fishId(1), tankId: 'tank-2' });
    const sold = applyCommand(moved, { type: 'sell', fishId: fishId(2) });
    const index = genealogyIndex(sold.fish), reversed = genealogyIndex([...sold.fish].reverse());
    const graph = ancestorGraph(index, fishId(7), 2);
    expect(ancestorGraph(reversed, fishId(7), 2)).toEqual(graph);
    const [mother, father] = graph.generations[0].nodes.map(node => index.byId.get(node.id)!);
    expect([mother.name, mother.tankId, mother.status, father.name, father.status]).toEqual(['Haru', 'tank-2', 'living', 'Sumi', 'sold']);
    expect(graph.generations[1]).toMatchObject({ recorded: 0, unknown: 4, nodes: [] });

    const brood = descendantGenerations(index, fishId(2));
    expect(brood.generations).toEqual([Array.from({ length: 20 }, (_, i) => fishId(i + 7))]);
    expect(reversed.childrenOf.get(fishId(1))).toEqual(brood.generations[0]);
  });
});

describe('FS-404 descendants, search and trail', () => {
  it('lists each descendant once at its nearest generation', () => {
    const sire = make(1, 'M', null), dam = make(2, 'F', null);
    const daughter = make(3, 'F', [dam, sire]), grandson = make(4, 'M', [daughter, sire]), later = make(5, 'F', [daughter, grandson]);
    const index = genealogyIndex([later, grandson, daughter, dam, sire]);
    expect(descendantGenerations(index, sire.id).generations).toEqual([[daughter.id, grandson.id], [later.id]]);
    expect(descendantGenerations(index, dam.id).generations).toEqual([[daughter.id], [grandson.id, later.id]]);
    expect(descendantGenerations(index, dam.id, 1)).toEqual({ generations: [[daughter.id]], total: 1, continuing: 1 });
  });

  it('stays bounded and quick on a 10,000-record world', () => {
    const rng = random(10_000);
    const fish: Fish[] = Array.from({ length: 200 }, (_, i) => make(i + 1, i % 2 ? 'M' : 'F', null));
    while (fish.length < MAX_RECORDS) {
      const pick = (sex: Fish['sex']) => {
        let candidate: Fish;
        do candidate = fish[fish.length - 1 - Math.floor(rng() * Math.min(fish.length, 400))]; while (candidate.sex !== sex);
        return candidate;
      };
      fish.push(make(fish.length + 1, rng() < 0.5 ? 'F' : 'M', [pick('F'), pick('M')]));
    }
    const started = performance.now();
    const index = genealogyIndex(fish);
    const graphs = fish.slice(-50).map(focus => ancestorGraph(index, focus.id, MAX_ANCESTOR_DEPTH));
    const busiest = fish.slice(0, 400).reduce((best, f) => (index.childrenOf.get(f.id)?.length ?? 0) > (index.childrenOf.get(best.id)?.length ?? 0) ? f : best);
    const descendants = descendantGenerations(index, busiest.id);
    expect(performance.now() - started).toBeLessThan(500);
    for (const graph of graphs) {
      expect(graph.size).toBeLessThanOrEqual(126);
      for (const generation of graph.generations) expect(generation.recorded + generation.unknown + generation.missing).toBe(generation.positions);
    }
    expect(descendants.generations).toHaveLength(MAX_DESCENDANT_DEPTH);
    expect(new Set(descendants.generations.flat()).size).toBe(descendants.total);
  });

  it('finds living and sold records by ID, digits or name, best matches first', () => {
    const sold = applyCommand(base, { type: 'sell', fishId: fishId(2) });
    expect(findRecords(sold.fish, '  2 ').matches.map(f => [f.name, f.status])).toEqual([['Sumi', 'sold']]);
    expect(findRecords(sold.fish, 'fsh-000005').matches.map(f => f.name)).toEqual(['Akira']);
    expect(findRecords(sold.fish, 'MOMO').matches.map(f => f.id)).toEqual([fishId(6)]);
    expect(findRecords(sold.fish, 'a').matches.map(f => f.name)).toEqual(['Akira', 'Haru', 'Kohaku']);
    expect(findRecords(sold.fish, '   ')).toEqual({ matches: [], total: 0 });
    const crowd = Array.from({ length: 30 }, (_, i) => make(i + 1, 'F', null));
    const found = findRecords(crowd, 'fish 1');
    expect(found.total).toBe(11);
    expect(found.matches.map(f => f.name)).toEqual(['Fish 1', 'Fish 10', 'Fish 11', 'Fish 12', 'Fish 13', 'Fish 14', 'Fish 15', 'Fish 16']);
  });

  it('keeps a bounded family trail that steps back instead of looping', () => {
    let trail = visitTrail(visitTrail([], 'A', 'B'), 'B', 'C');
    expect(trail).toEqual(['A', 'B']);
    expect(visitTrail(trail, 'C', 'A')).toEqual([]);
    expect(visitTrail(trail, 'C', 'B')).toEqual(['A']);
    expect(visitTrail(trail, 'C', 'C')).toEqual(['A', 'B']);
    let current = 'C';
    for (let i = 0; i < 40; i++) { trail = visitTrail(trail, current, `F${i}`); current = `F${i}`; }
    expect(trail).toHaveLength(MAX_TRAIL);
    expect(trail.at(-1)).toBe('F38');
  });
});
