import { describe, expect, it } from 'vitest';
import { clutchMembers } from '../src/core/breeding';
import { birthGroupsOf, cohortsOf } from '../src/core/collection';
import { advanceWorld } from '../src/core/habitat';
import { LIFECYCLE_DAY_LIMIT, lifecycleDemonstration } from '../src/core/lifecycleScenario';
import { commandEnvelope, createRuntime, decodeRuntime, executeCommand } from '../src/core/runtime';
import type { World } from '../src/core/types';
import { TICKS_PER_GAME_DAY } from '../src/core/water';
import { applyCommand, createWorld, type Command } from '../src/core/world';

const NOW = '2026-09-14T12:00:00.000Z', LATER = '2026-09-14T12:05:00.000Z';
const DAY = TICKS_PER_GAME_DAY;
const labCross = (tankId: string, timestamp = NOW, motherId = 'FSH-000001', fatherId = 'FSH-000002'): Command => ({ type: 'breed', motherId, fatherId, tankId, timestamp, genomeVersion: 2 });
const ids = (from: number, count: number) => Array.from({ length: count }, (_, i) => `FSH-${String(from + i).padStart(6, '0')}`);
const residents = (world: World, tankId: string) => world.fish.filter(f => f.status === 'living' && f.tankId === tankId).length;

describe('FS-406 batch rehoming and clutch selection', () => {
  it('moves a batch in one command and rejects any invalid batch without change', () => {
    const world = applyCommand(createWorld(NOW), labCross('tank-2'));
    const moved = applyCommand(world, { type: 'move-batch', fishIds: [...ids(7, 10), 'FSH-000001'], tankId: 'tank-1' });
    expect([residents(moved, 'tank-1'), residents(moved, 'tank-2')]).toEqual([16, 10]);
    const original = new Map(world.fish.map(f => [f.id, f]));
    for (const fish of moved.fish) expect({ ...fish, tankId: original.get(fish.id)!.tankId }).toEqual(original.get(fish.id));
    expect(moved.fish.filter(f => ids(7, 10).includes(f.id)).every(f => f.tankId === 'tank-1')).toBe(true);

    const refused = (candidate: World, command: Command, message: string) => {
      const before = JSON.stringify(candidate);
      expect(() => applyCommand(candidate, command)).toThrow(message);
      expect(JSON.stringify(candidate)).toBe(before);
    };
    refused(world, { type: 'move-batch', fishIds: ['FSH-000007', 'FSH-000007'], tankId: 'tank-1' }, 'only be moved once');
    refused(world, { type: 'move-batch', fishIds: ['FSH-000007', 'FSH-999999'], tankId: 'tank-1' }, 'archived or unavailable');
    refused(applyCommand(world, { type: 'sell', fishId: 'FSH-000003' }), { type: 'move-batch', fishIds: ['FSH-000007', 'FSH-000003'], tankId: 'tank-2' }, 'archived or unavailable');
    refused(world, { type: 'move-batch', fishIds: ['FSH-000007'], tankId: 'tank-9' }, 'Tank not found');
    refused(world, { type: 'move-batch', fishIds: ids(7, 3), tankId: 'tank-2' }, 'already live in Breeding Studio');
    refused(world, { type: 'move-batch', fishIds: [], tankId: 'tank-1' }, '');

    // Breeding Studio holds 20 eggs and a 24-place courtship, which leaves 16 places for arrivals.
    const reserved = applyCommand(applyCommand(world, labCross('tank-1', LATER, 'FSH-000003', 'FSH-000004')),
      { type: 'pair', motherId: 'FSH-000001', fatherId: 'FSH-000002', nurseryId: 'tank-2', size: 24, timestamp: NOW, genomeVersion: 2 });
    refused(reserved, { type: 'move-batch', fishIds: ids(27, 17), tankId: 'tank-2' }, 'reserved for a courting clutch');
    expect(residents(applyCommand(reserved, { type: 'move-batch', fishIds: ids(27, 16), tankId: 'tank-2' }), 'tank-2')).toBe(36);

    let runtime = createRuntime(world, 'fs406-rehome');
    runtime = executeCommand(runtime, commandEnvelope(runtime, { type: 'move-batch', fishIds: ids(7, 5), tankId: 'tank-1' }));
    expect(decodeRuntime(JSON.stringify(runtime)).world).toEqual(runtime.world);
  });

  it("groups a pair's offspring by clutch while the Parents filter keeps the whole pair", () => {
    const twice = applyCommand(applyCommand(createWorld(NOW), labCross('tank-1')), labCross('tank-2', LATER));
    expect(birthGroupsOf(twice.fish, 'FSH-000001', 'FSH-000002')).toEqual([
      { key: LATER, bornAt: LATER, size: 20, firstId: 'FSH-000027', lastId: 'FSH-000046' },
      { key: NOW, bornAt: NOW, size: 20, firstId: 'FSH-000007', lastId: 'FSH-000026' },
    ]);
    expect(cohortsOf(twice.fish).map(cohort => cohort.size)).toEqual([40]);
    expect(birthGroupsOf(twice.fish, 'FSH-000003', 'FSH-000004')).toEqual([]);

    let courting = applyCommand(createWorld(NOW), { type: 'pair', motherId: 'FSH-000003', fatherId: 'FSH-000004', nurseryId: 'tank-2', size: 16, timestamp: NOW, genomeVersion: 2 });
    for (let day = 0; day < 6 && courting.clutches[0].stage === 'courting'; day++) courting = advanceWorld(courting, day * DAY, (day + 1) * DAY);
    const laid = clutchMembers(courting, courting.clutches[0]);
    expect(birthGroupsOf(courting.fish, 'FSH-000003', 'FSH-000004')).toEqual([{ key: laid[0].bornAt, bornAt: laid[0].bornAt, size: 16, firstId: laid[0].id, lastId: laid.at(-1)!.id }]);
  });
});

describe('FS-406 two-generation demonstration', () => {
  it('completes two generations through normal breeding and batch rehoming, replayable and repeatable', () => {
    const demo = lifecycleDemonstration();
    expect([demo.instantCrosses, demo.commands.includes('breed')]).toEqual([0, false]);
    expect(demo.commands).toEqual(['add-tank', 'pair', 'pair', 'add-tank', 'move-batch', 'move-batch', 'move-batch', 'pair']);
    expect(demo.clutches.map(c => [c.clutchId, c.generation, c.size, c.laidOnDay !== null, c.hatchedOnDay !== null, c.pedigreeF])).toEqual([
      ['CL-000001', 1, 20, true, true, 0], ['CL-000002', 1, 20, true, true, 0], ['CL-000003', 2, 20, true, true, 0],
    ]);
    const [first, second, next] = demo.clutches;
    expect(next.pairedOnDay).toBeGreaterThanOrEqual(Math.max(first.hatchedOnDay!, second.hatchedOnDay!));
    expect(next.laidOnDay!).toBeGreaterThan(next.pairedOnDay);
    expect(next.hatchedOnDay).toBe(demo.days);
    expect(demo.days).toBeLessThanOrEqual(LIFECYCLE_DAY_LIMIT);
    expect(demo.replayError).toBeNull();
    expect([demo.birthsFromClutches, demo.replayed, demo.rehomed, demo.records]).toEqual([true, true, 38, 66]);
    expect(demo.fullest.used).toBeLessThanOrEqual(demo.fullest.capacity);
    expect(demo.events.map(event => event.day)).toEqual([...demo.events.map(event => event.day)].sort((a, b) => a - b));
    expect(new Set(demo.events.map(event => event.kind))).toEqual(new Set(['pair', 'laid', 'hatched', 'ready', 'rehome', 'complete']));
    expect(lifecycleDemonstration()).toEqual(demo);
  });
});
