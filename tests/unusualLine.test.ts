import { describe, expect, it } from 'vitest';
import { expressStructure } from '../src/core/structure';
import { LOCUS_REGISTRY } from '../src/core/registry';
import type { Fish, World } from '../src/core/types';
import { mutationPacing, originFirstCarrier, UNUSUAL_LINE_DAY_LIMIT, UNUSUAL_LINE_SEED, unusualLineDemonstration } from '../src/core/unusualLineScenario';

function ancestors(world: World, fish: Fish): Set<string> {
  const byId = new Map(world.fish.map(f => [f.id, f])), seen = new Set<string>(), stack = [...(fish.parents ?? [])];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(byId.get(id)?.parents ?? []));
  }
  return seen;
}

describe('FS-605 koi to an unusual line', () => {
  const tail = unusualLineDemonstration(UNUSUAL_LINE_SEED, 'tail_topology');

  it('breeds a paired-fan line from ordinary koi through normal breeding, with valid ancestry and a replayed journal', () => {
    const demo = tail;
    expect([demo.completed, demo.instantCrosses, demo.replayed, demo.replayError]).toEqual([true, 0, true, null]);
    expect(demo.days).toBeLessThanOrEqual(UNUSUAL_LINE_DAY_LIMIT);
    expect(demo.mutation).toMatchObject({ locusId: 'tail_topology', variant: 'paired fan' });
    // The founders expressed a standard tail; only the bred line shows the paired fan.
    const founders = demo.world.fish.filter(f => !f.parents);
    expect(founders.every(f => expressStructure(f.genome).tail === 'standard')).toBe(true);
    expect(demo.generations.map(g => g.label)).toEqual(['Outcross offspring', 'Carrier intercross offspring', 'Line offspring']);
    const [outcross, intercross, final] = demo.generations;
    expect([outcross.expressing, outcross.pedigreeF]).toEqual([0, 0]);
    expect(outcross.carriers).toBeGreaterThan(4);
    expect(intercross.expressing).toBeGreaterThan(1);
    expect(intercross.pedigreeF).toBe(0.25);
    expect([final.expressing, final.count, demo.finalAllExpress, demo.finalAllCarryBothCopies]).toEqual([final.count, 24, true, true]);
    expect(demo.bloodline).toMatchObject({ name: 'Paired fan line', standardTail: 'paired' });
    expect(demo.bloodline!.finalAncestry.every(share => share === 1)).toBe(true);
    expect(demo.bloodline!.finalSimilarity.every(value => value > 0.6 && value <= 1)).toBe(true);

    // Valid ancestry: every final fish carries two copies of the origin by descent from the recorded first carrier.
    const first = originFirstCarrier(demo.world, demo.mutation!.originId)!;
    expect(first).toBeDefined();
    const line = demo.world.fish.filter(f => f.origins.filter(o => o.id === demo.mutation!.originId).length === 2 && f.generation === Math.max(...demo.world.fish.map(x => x.generation)));
    expect(line).toHaveLength(24);
    for (const fish of line) {
      expect(ancestors(demo.world, fish).has(first.id)).toBe(true);
      expect(expressStructure(fish.genome).tail).toBe('paired');
    }
    expect(demo.world.bloodlines[0].foundationIds.every(id => demo.world.fish.find(f => f.id === id)!.origins.filter(o => o.id === demo.mutation!.originId).length === 2)).toBe(true);
  }, 60_000);

  it('establishes a line sooner when any structural mutation counts', () => {
    const any = unusualLineDemonstration(UNUSUAL_LINE_SEED, 'any');
    expect([any.completed, any.replayed, any.finalAllExpress]).toEqual([true, true, true]);
    expect(any.days).toBeLessThan(tail.days);
    expect(any.mutation!.birthsBefore).toBeLessThanOrEqual(tail.mutation!.birthsBefore);
  }, 60_000);

  it('reports discovery pacing from registry odds and seeded births', () => {
    const report = mutationPacing(200);
    const weight = (id: string) => LOCUS_REGISTRY.find(entry => entry.id === id)!.alleles[0].founderWeight;
    for (const id of ['tail_topology', 'dorsal_form', 'barbel_count']) {
      expect(report.founderCarrier[id]).toBeCloseTo(1 - weight(id) ** 2, 12);
      expect(report.founderExpressing[id]).toBeCloseTo((1 - weight(id)) ** 2, 12);
      expect(report.firstLocus[id]).toBeGreaterThan(0.2);
      expect(report.firstLocus[id]).toBeLessThan(0.47);
    }
    // Three structural loci at 0.001 per copy: about 0.6% of births carry one, a median near 115 births.
    expect(report.birthsToMutation.median).toBeGreaterThan(60);
    expect(report.birthsToMutation.median).toBeLessThan(180);
    expect(report.birthsToMutation.p10).toBeLessThan(report.birthsToMutation.median);
    expect(report.birthsToMutation.p90).toBeGreaterThan(report.birthsToMutation.median);
  }, 60_000);
});
