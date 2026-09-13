import { describe, expect, it } from 'vitest';
import { advanceRuntime, applyOfflineCatchup, createRuntime, decodeRuntime } from '../src/core/runtime';
import { createWorld } from '../src/core/world';
import { OFFLINE_CAP_MS, TICK_MS, timelineSegments } from '../src/simulation/time';

const NOW = '2026-09-13T12:00:00.000Z';

describe('FS-205 shared and protected time integration', () => {
  it('splits bounded work exactly at event boundaries without gaps or overlap', () => {
    const segments = timelineSegments(10, 105, [25, 25, 70, 200], 20);
    expect(segments).toEqual([
      { fromTick: 10, toTick: 25, boundary: true },
      { fromTick: 25, toTick: 45, boundary: false },
      { fromTick: 45, toTick: 65, boundary: false },
      { fromTick: 65, toTick: 70, boundary: true },
      { fromTick: 70, toTick: 90, boundary: false },
      { fromTick: 90, toTick: 105, boundary: false },
    ]);
    expect(segments.reduce((sum, part) => sum + part.toTick - part.fromTick, 0)).toBe(95);
  });

  it('gives visible and background tanks the same persistent time', () => {
    let runtime = createRuntime(createWorld(NOW), 'time-world');
    runtime = advanceRuntime(runtime, 1_000, [300, 750]);
    expect(runtime.tick).toBe(1_000);
    expect(Object.values(runtime.simulation.tankTicks)).toEqual([1_000, 1_000]);
    expect(decodeRuntime(JSON.stringify(runtime))).toEqual(runtime);
  });

  it('makes fine active steps and coarse background steps agree exactly', () => {
    let fine = createRuntime(createWorld(NOW), 'fine');
    for (let tick = 1; tick <= 10_000; tick++) fine = advanceRuntime(fine, tick);
    const coarse = advanceRuntime(createRuntime(createWorld(NOW), 'coarse'), 10_000, [2_500, 7_500]);
    expect(fine.tick).toBe(coarse.tick);
    expect(fine.simulation.tankTicks).toEqual(coarse.simulation.tankTicks);
    expect(fine.world).toEqual(coarse.world);
  });

  it('treats backwards clocks as zero and caps offline time at eight hours at 1x', () => {
    const initial = createRuntime(createWorld(NOW), 'offline');
    const backwards = applyOfflineCatchup(initial, 2_000, 1_000);
    expect(backwards.window).toMatchObject({ appliedTicks: 0, remainingTicks: 0, clockWentBackwards: true });
    expect(backwards.runtime).toBe(initial);
    const elapsed = OFFLINE_CAP_MS + 90 * 60 * 1000;
    const capped = applyOfflineCatchup(initial, 10_000, 10_000 + elapsed);
    expect(capped.window.appliedTicks).toBe(OFFLINE_CAP_MS / TICK_MS);
    expect(capped.window.remainingTicks).toBe(90 * 60 * 1000 / TICK_MS);
    expect(new Set(Object.values(capped.runtime.simulation.tankTicks))).toEqual(new Set([OFFLINE_CAP_MS / TICK_MS]));
  });

  it('migrates earlier runtime-v2 snapshots by deriving tank clocks from their tick', () => {
    const runtime = advanceRuntime(createRuntime(createWorld(NOW), 'older-v2'), 345);
    const raw = JSON.parse(JSON.stringify(runtime)); delete raw.simulation;
    expect(decodeRuntime(JSON.stringify(raw)).simulation.tankTicks).toEqual({ 'tank-1': 345, 'tank-2': 345 });
  });
});
