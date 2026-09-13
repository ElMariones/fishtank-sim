import { describe, expect, it } from 'vitest';
import {
  cohortsOf, decodePreferences, DEFAULT_PREFERENCES, goalLeaders, goalValue, PREFERENCES_KEY, sortCollection, toggleFavorite, type LabPreferences,
} from '../src/core/collection';
import { measureDescriptors } from '../src/core/descriptors';
import { INCUBATION_DAYS } from '../src/core/development';
import { express } from '../src/core/genetics';
import { advanceWorld } from '../src/core/habitat';
import { TICKS_PER_GAME_DAY } from '../src/core/water';
import { applyCommand, createWorld } from '../src/core/world';

const NOW = '2026-09-13T12:00:00.000Z';
const bred = applyCommand(applyCommand(createWorld(NOW), { type: 'breed', motherId: 'FSH-000001', fatherId: 'FSH-000002', tankId: 'tank-1', timestamp: NOW }),
  { type: 'breed', motherId: 'FSH-000003', fatherId: 'FSH-000004', tankId: 'tank-2', timestamp: NOW });
const ids = new Set(bred.fish.map(f => f.id));

describe('FS-104 collection preferences and ordering', () => {
  it('round-trips valid preferences and drops unknown or duplicate favorites', () => {
    const stored: LabPreferences = { version: 1, goal: { descriptor: 'tail', direction: 'higher' }, sort: 'goal', favorites: ['FSH-000007', 'FSH-000007', 'FSH-999999'] };
    expect(PREFERENCES_KEY).not.toBe('fishtank-sim.lab.v1');
    expect(decodePreferences(JSON.stringify(stored), ids)).toEqual({ ...stored, favorites: ['FSH-000007'] });
    expect(toggleFavorite(toggleFavorite(DEFAULT_PREFERENCES, 'FSH-000008'), 'FSH-000008').favorites).toEqual([]);
  });

  it('falls back to defaults for missing, malformed or unsupported preferences', () => {
    for (const raw of [null, '', '{oops', JSON.stringify({ version: 2, goal: null, sort: 'newest', favorites: [] }),
      JSON.stringify({ version: 1, goal: { descriptor: 'wings', direction: 'higher' }, sort: 'newest', favorites: [] }),
      JSON.stringify({ version: 1, goal: null, sort: 'random', favorites: [] }), JSON.stringify({ version: 1, goal: null, sort: 'name', favorites: ['<script>'] })]) {
      expect(decodePreferences(raw, ids)).toEqual(DEFAULT_PREFERENCES);
    }
  });

  it('sorts by newest, oldest, name and breeding goal without mutating the input', () => {
    const cohort = bred.fish.slice(6, 26), before = cohort.map(f => f.id);
    expect(sortCollection(cohort, 'newest', null).map(f => f.id)).toEqual([...before].reverse());
    expect(sortCollection(cohort, 'oldest', null).map(f => f.id)).toEqual(before);
    const renamed = cohort.map((f, i) => ({ ...f, name: i % 2 ? `Beta ${i}` : `Alpha ${i}` }));
    expect(sortCollection(renamed, 'name', null).map(f => f.name)).toEqual([...renamed.map(f => f.name)].sort((a, b) => a.localeCompare(b)));
    const goal = { descriptor: 'tail', direction: 'higher' } as const;
    const values = sortCollection(cohort, 'goal', goal).map(f => goalValue(f, goal));
    values.slice(1).forEach((value, i) => expect(value).toBeLessThanOrEqual(values[i]));
    const lower = sortCollection(cohort, 'goal', { ...goal, direction: 'lower' }).map(f => goalValue(f, goal));
    lower.slice(1).forEach((value, i) => expect(value).toBeGreaterThanOrEqual(lower[i]));
    expect(goalValue(cohort[0], goal)).toBe(measureDescriptors(express(cohort[0].genome)).tail);
    expect(sortCollection(cohort, 'goal', null).map(f => f.id)).toEqual([...before].reverse());
    expect(cohort.map(f => f.id)).toEqual(before);
  });

  it('groups cohorts by parent pair and names goal leaders by sex among living, hatched fish', () => {
    const cohorts = cohortsOf(bred.fish);
    expect(cohorts.map(c => [c.motherId, c.fatherId, c.size])).toEqual([['FSH-000003', 'FSH-000004', 20], ['FSH-000001', 'FSH-000002', 20]]);
    const goal = { descriptor: 'depth', direction: 'higher' } as const;
    // Eggs cannot breed, so they never lead; once hatched, the whole cohort competes.
    const eggLeaders = goalLeaders(bred.fish, goal);
    expect([eggLeaders.mother, eggLeaders.father].every(leader => leader !== null && leader.life.lengthCm > 0)).toBe(true);
    const hatched = advanceWorld(bred, 0, INCUBATION_DAYS * TICKS_PER_GAME_DAY);
    const leaders = goalLeaders(hatched.fish, goal);
    expect(leaders.mother?.sex).toBe('F');
    expect(leaders.father?.sex).toBe('M');
    const bestFemale = Math.max(...hatched.fish.filter(f => f.sex === 'F').map(f => goalValue(f, goal)));
    expect(goalValue(leaders.mother!, goal)).toBe(bestFemale);
    const sold = applyCommand(hatched, { type: 'sell', fishId: leaders.mother!.id });
    expect(goalLeaders(sold.fish, goal).mother?.id).not.toBe(leaders.mother!.id);
  });
});
