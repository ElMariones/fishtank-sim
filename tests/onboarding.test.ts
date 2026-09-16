import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES, PREFERENCES_KEY, toggleFavorite, type LabPreferences } from '../src/core/collection';
import { isEgg } from '../src/core/development';
import { completeGuideSteps, decodeGuide, GUIDE_KEY, GUIDE_STEPS, GUIDE_TEXT, guideSteps, hasLineage, observedGuideSteps } from '../src/core/onboarding';
import { advanceRuntime, commandEnvelope, createRuntime, executeCommand } from '../src/core/runtime';
import { SAVE_KEY } from '../src/core/save';
import { TICKS_PER_GAME_DAY } from '../src/core/water';
import { applyCommand, createWorld, type Command } from '../src/core/world';

const NOW = '2026-09-15T12:00:00.000Z';
const DAY = TICKS_PER_GAME_DAY;
const cross: Command = { type: 'breed', motherId: 'FSH-000001', fatherId: 'FSH-000002', tankId: 'tank-2', timestamp: NOW, genomeVersion: 3 };

describe('FS-504 first-session guide', () => {
  it('stores progress apart from the world save and falls back to a fresh guide', () => {
    const fresh = createWorld(NOW);
    expect(decodeGuide(null, fresh)).toEqual({ version: 1, hidden: false, done: [] });
    // A world that already has a lineage starts with the guide tucked away.
    expect(decodeGuide(null, applyCommand(fresh, cross)).hidden).toBe(true);
    const stored = { version: 1, hidden: true, done: ['feed', 'select', 'feed'] };
    expect(decodeGuide(JSON.stringify(stored), fresh)).toEqual({ version: 1, hidden: true, done: ['select', 'feed'] });
    for (const raw of ['{', '[]', 'null', JSON.stringify({ ...stored, version: 2 }), JSON.stringify({ ...stored, done: ['dance'] }), JSON.stringify({ ...stored, extra: 1 })])
      expect(decodeGuide(raw, fresh)).toEqual({ version: 1, hidden: false, done: [] });
    expect(new Set([GUIDE_KEY, PREFERENCES_KEY, SAVE_KEY]).size).toBe(3);
    expect(Object.keys(fresh)).not.toContain('guide');
    for (const id of GUIDE_STEPS) expect(GUIDE_TEXT[id].title.length * GUIDE_TEXT[id].detail.length).toBeGreaterThan(0);
  });

  it('records steps in guide order and never unchecks one', () => {
    const start = decodeGuide(null, createWorld(NOW)), some = completeGuideSteps(start, ['feed', 'select']);
    expect(some.done).toEqual(['select', 'feed']);
    expect(completeGuideSteps(some, ['select'])).toBe(some);
    expect(guideSteps(some).map(step => [step.id, step.done])).toEqual(GUIDE_STEPS.map(id => [id, id === 'select' || id === 'feed']));
    expect(hasLineage({ fish: [], clutches: [{ ...applyCommand(createWorld(NOW), { type: 'pair', motherId: 'FSH-000001', fatherId: 'FSH-000002', nurseryId: 'tank-2', size: 8, timestamp: NOW, genomeVersion: 3 }).clutches[0], stage: 'cancelled' }] })).toBe(true);
  });

  it('follows a first session played through ordinary commands, with the first eggs hatched within eight game days', () => {
    let runtime = createRuntime(createWorld(NOW), 'fs504-guide');
    let preferences: LabPreferences = DEFAULT_PREFERENCES, progress = decodeGuide(null, runtime.world);
    const observe = () => { progress = completeGuideSteps(progress, observedGuideSteps(runtime.world, preferences)); };
    observe();
    expect(progress.done).toEqual([]);
    // Selecting, renaming and feeding are interface actions: the app records them once the commands succeed.
    runtime = executeCommand(runtime, commandEnvelope(runtime, { type: 'rename', fishId: 'FSH-000001', name: 'Ember' }, 20));
    runtime = executeCommand(runtime, commandEnvelope(runtime, { type: 'feed', tankId: 'tank-1' }, 40));
    progress = completeGuideSteps(progress, ['select', 'rename', 'feed']);
    runtime = executeCommand(runtime, commandEnvelope(runtime, { type: 'pair', motherId: 'FSH-000001', fatherId: 'FSH-000002', nurseryId: 'tank-2', size: 20, timestamp: NOW, genomeVersion: 3 }, 60));
    observe();
    expect(progress.done).toEqual(['select', 'rename', 'feed', 'court']);

    let day = 0, keptEgg = false;
    while (!runtime.world.fish.some(f => f.parents && !isEgg(f.life))) {
      day++;
      expect(day).toBeLessThanOrEqual(8);
      runtime = advanceRuntime(runtime, day * DAY);
      const egg = runtime.world.fish.find(f => f.parents && isEgg(f.life));
      if (egg && !keptEgg) {
        // Starring an egg does not complete the step; the same fish counts once it hatches.
        preferences = toggleFavorite(preferences, egg.id); keptEgg = true;
        observe();
        expect(progress.done).not.toContain('hatch');
      }
    }
    expect(keptEgg).toBe(true);
    observe();
    expect(progress.done).toContain('hatch');
    preferences = { ...preferences, goal: { descriptor: 'tail', direction: 'higher' } };
    observe();
    progress = completeGuideSteps(progress, ['family']);
    expect(guideSteps(progress).every(step => step.done)).toBe(true);

    // Rehoming the kept fish, then clearing its star and the goal, leave the guide complete.
    runtime = executeCommand(runtime, commandEnvelope(runtime, { type: 'rehome-batch', fishIds: [preferences.favorites[0]] }, runtime.tick + 1));
    preferences = { ...preferences, goal: null, favorites: [] };
    observe();
    expect(observedGuideSteps(runtime.world, preferences)).toEqual(['court']);
    expect(progress.done).toEqual([...GUIDE_STEPS]);
  });
});
