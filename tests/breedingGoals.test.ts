import { describe, expect, it } from 'vitest';
import { APPEARANCE_BASELINE } from '../src/core/appearance';
import { GOAL_DESCRIPTORS, carrierCopies, targetCopyOdds, traitValue } from '../src/core/breedingGoals';
import { batchSaleCandidates, decodePreferences, goalValue, sortCollection } from '../src/core/collection';
import { applyCommand, createWorld } from '../src/core/world';
import type { Fish } from '../src/core/types';

const world = createWorld('2026-09-13T12:00:00.000Z');
const variant = (a: number, b: number): Fish => ({ ...world.fish[0], genome: { version: 2,
  maternal: [...world.fish[0].genome.maternal.slice(0, 48), a, ...APPEARANCE_BASELINE.slice(1)],
  paternal: [...world.fish[0].genome.paternal.slice(0, 48), b, ...APPEARANCE_BASELINE.slice(1)] } });

describe('compound breeding goals and favorite protection', () => {
  it('distinguishes hidden color copies, blends and exact offspring copy odds', () => {
    const key = 'base_color:1', goal = { descriptor: key, direction: 'higher' } as const;
    expect(traitValue(variant(0, 1), goal)).toBe(0);
    expect(carrierCopies(variant(0, 1), key)).toBe(1);
    expect(traitValue(variant(1, 2), goal)).toBe(1);
    expect(targetCopyOdds(variant(0, 1), variant(0, 1), key)).toEqual({ atLeastOne: .75, both: .25 });
    expect(targetCopyOdds(variant(1, 1), variant(1, 1), key)).toEqual({ atLeastOne: 1, both: 1 });
    expect(targetCopyOdds(variant(0, 0), variant(0, 0), key)).toEqual({ atLeastOne: 0, both: 0 });
  });
  it('combines opposing goals equally and preserves them across preference reloads', () => {
    const goal = { descriptor: 'length', direction: 'higher', secondary: [{ descriptor: 'depth', direction: 'lower' }] } as const;
    const mutable = { ...goal, secondary: [...goal.secondary] };
    const fish = world.fish[0];
    expect(goalValue(fish, mutable)).toBeCloseTo((traitValue(fish, goal) + 1 - traitValue(fish, goal.secondary[0])) / 2);
    const ranked = sortCollection(world.fish, 'goal', mutable);
    expect(goalValue(ranked[0], mutable)).toBeGreaterThanOrEqual(goalValue(ranked.at(-1)!, mutable));
    const prefs = { version: 1, goal: mutable, sort: 'goal', favorites: [fish.id] };
    expect(decodePreferences(JSON.stringify(prefs), new Set(world.fish.map(f => f.id)))).toEqual(prefs);
    expect(new Set(GOAL_DESCRIPTORS.map(d => d.key)).size).toBe(GOAL_DESCRIPTORS.length);
    for (const d of GOAL_DESCRIPTORS) {
      const value = traitValue(fish, { descriptor: d.key, direction: 'higher' });
      expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThanOrEqual(1);
    }
  });
  it('excludes favorites and eggs, rechecks protection after selection, and preserves sold ancestry', () => {
    const bred = applyCommand(world, { type: 'breed', motherId: world.fish[0].id, fatherId: world.fish[1].id, tankId: 'tank-1', timestamp: '2026-09-13T12:00:00.000Z' });
    const selected = batchSaleCandidates(bred.fish, new Set([world.fish[0].id]));
    expect(selected).toHaveLength(5);
    const confirmed = batchSaleCandidates(selected, new Set([world.fish[1].id]));
    expect(confirmed).toHaveLength(4);
    const sold = applyCommand(bred, { type: 'sell-batch', fishIds: confirmed.map(f => f.id) });
    expect(sold.fish[0].status).toBe('living'); expect(sold.fish[1].status).toBe('living');
    expect(sold.fish).toHaveLength(bred.fish.length);
    expect(sold.fish[2].genome).toEqual(bred.fish[2].genome);
    expect(sold.fish.slice(6).every(f => f.status === 'living')).toBe(true);
  });
});
