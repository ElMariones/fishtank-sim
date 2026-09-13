import { describe, expect, it } from 'vitest';
import { commandEnvelope, createRuntime, decodeRuntime, executeCommand, importRuntime, JOURNAL_LIMIT } from '../src/core/runtime';
import { applyCommand, createWorld, type Command } from '../src/core/world';

const NOW = '2026-09-13T12:00:00.000Z';
const base = () => createRuntime(createWorld(NOW), 'test-world');
const breed: Command = { type: 'breed', motherId: 'FSH-000001', fatherId: 'FSH-000002', tankId: 'tank-1', timestamp: NOW };

describe('M2 versioned commands and replay', () => {
  it('retries births and sales without duplicate fish or credits, including after reload', () => {
    const initial = base(), command = commandEnvelope(initial, breed, 10);
    const born = executeCommand(initial, command);
    expect(executeCommand(born, command)).toBe(born);
    const restored = decodeRuntime(JSON.stringify(born));
    expect(executeCommand(restored, command)).toBe(restored);
    expect(restored.world.fish).toHaveLength(26);
    const sale = commandEnvelope(restored, { type: 'sell-batch', fishIds: restored.world.fish.slice(2, 6).map(f => f.id) }, 11);
    const sold = executeCommand(restored, sale);
    expect(executeCommand(sold, sale).world.credits).toBe(sold.world.credits);
    expect(decodeRuntime(JSON.stringify(sold))).toEqual(sold);
  });
  it('rejects conflicting IDs, stale/wrong-world commands, backwards time and unknown payloads atomically', () => {
    const initial = base(), command = commandEnvelope(initial, breed, 10), born = executeCommand(initial, command);
    const before = JSON.stringify(born);
    expect(() => executeCommand(born, { ...command, payload: { type: 'add-tank' } })).toThrow('different content');
    expect(() => executeCommand(born, { ...commandEnvelope(born, breed), worldId: 'other' })).toThrow('another world');
    expect(() => executeCommand(born, commandEnvelope(born, breed, 9))).toThrow('backwards');
    expect(() => executeCommand(born, { ...commandEnvelope(born, breed), expectedRevision: 0 })).toThrow('Stale');
    expect(() => applyCommand(born.world, { type: 'unknown' } as unknown as Command)).toThrow();
    expect(JSON.stringify(born)).toBe(before);
  });
  it('replays a mixed journal deterministically and rejects snapshot/event tampering', () => {
    let runtime = base();
    for (const payload of [breed, { type: 'rename', fishId: 'FSH-000007', name: 'Ember' }, { type: 'move', fishId: 'FSH-000007', tankId: 'tank-2' }] as Command[])
      runtime = executeCommand(runtime, commandEnvelope(runtime, payload, runtime.tick + 20));
    expect(decodeRuntime(JSON.stringify(runtime))).toEqual(runtime);
    const changed = structuredClone(runtime); changed.world.fish[6].genome.maternal[0] = 5 - changed.world.fish[6].genome.maternal[0];
    expect(() => decodeRuntime(JSON.stringify(changed))).toThrow('replay');
    const reversed = { ...runtime, events: [...runtime.events].reverse() };
    expect(() => decodeRuntime(JSON.stringify(reversed))).toThrow('sequence');
    expect(() => decodeRuntime(JSON.stringify({ ...runtime, runtimeVersion: 99 }))).toThrow();
  });
  it('compacts the replay journal without allowing old commands to execute again', () => {
    let runtime = base();
    const first = commandEnvelope(runtime, { type: 'decorate', tankId: 'tank-1' });
    runtime = executeCommand(runtime, first);
    for (let i = 1; i <= JOURNAL_LIMIT; i++) runtime = executeCommand(runtime, commandEnvelope(runtime, { type: 'decorate', tankId: 'tank-1' }, i));
    expect(runtime.checkpoint.revision).toBe(JOURNAL_LIMIT);
    expect(runtime.events).toHaveLength(1);
    runtime = decodeRuntime(JSON.stringify(runtime));
    expect(() => executeCommand(runtime, first)).toThrow('Stale');
  });
  it('migrates v1 without modifying any fish and rejects malformed/future schemas', () => {
    const world = applyCommand(createWorld(NOW), breed), raw = JSON.stringify(world);
    expect(importRuntime(raw, 'legacy').world).toEqual(world);
    expect(JSON.stringify(world)).toBe(raw);
    expect(() => importRuntime('{', 'legacy')).toThrow();
    expect(() => importRuntime(JSON.stringify({ ...world, version: 99 }), 'legacy')).toThrow();
    expect(() => importRuntime(JSON.stringify({ ...base(), schemaVersion: 99 }), 'legacy')).toThrow();
  });
});
