import { describe, expect, it } from 'vitest';
import { applyCommand, createWorld, type Command } from '../src/core/world';
import { decodeSave } from '../src/core/save';
import { advanceRuntime, commandEnvelope, createRuntime, decodeRuntime, executeCommand } from '../src/core/runtime';
import { decorationsOf, legacyDecorations, type Decoration } from '../src/core/tankManagement';
import { ledgerBalance, openingLedger } from '../src/core/economy';
import { habitatFootprints, BODY_CLEARANCE } from '../src/simulation/footprints';
import { createBehaviorWorld, stepBehavior } from '../src/simulation/behavior';

const NOW = '2026-09-15T12:00:00.000Z';
const rock: Decoration = { id: 'DC-1', kind: 'rock', x: 0.45, y: 0.5, scale: 1.2, rotation: 45 };
const cover: Decoration = { id: 'DC-2', kind: 'cover', x: 0.7, y: 0.65, scale: 0.75, rotation: 90 };
const layout = (decorations: Decoration[]): Command => ({ type: 'place-decorations', tankId: 'tank-2', decorations });
const funded = () => ({ ...createWorld(NOW), credits: 10000, ledger: openingLedger(10000) });

describe('FS-503 aquarium expansion and decoration placement', () => {
  it('charges purchases and upgrades, conserves pollutants and keeps reserved places', () => {
    let world = applyCommand(createWorld(NOW), { type: 'purchase-tank' });
    expect(world.tanks[2]).toMatchObject({ capacity: 20, water: { volumeL: 10000 }, decorations: [] });
    expect(world.credits).toBe(800);
    world = applyCommand(world, { type: 'pair', motherId: 'FSH-000001', fatherId: 'FSH-000002', nurseryId: 'tank-3', size: 20, timestamp: NOW, genomeVersion: 3 });
    expect(() => applyCommand(world, { type: 'move', fishId: 'FSH-000003', tankId: 'tank-3' })).toThrow('reserved');
    world.tanks[2].water.ammoniaMgL = 2;
    world.tanks[2].water.foodG = 17;
    const fish = structuredClone(world.fish), clutches = structuredClone(world.clutches);
    world = applyCommand(world, { type: 'upgrade-tank', tankId: 'tank-3' });
    expect(world.tanks[2]).toMatchObject({ capacity: 40, water: { volumeL: 20000, ammoniaMgL: 1, foodG: 17 } });
    expect(world.fish).toEqual(fish); expect(world.clutches).toEqual(clutches);
    world = applyCommand(world, { type: 'upgrade-tank', tankId: 'tank-3' });
    expect(world.tanks[2].capacity).toBe(60);
    expect(world.credits).toBe(200);
    expect(ledgerBalance(world.ledger)).toBe(200);
    expect(decodeSave(JSON.stringify(world))).toEqual(world);
    expect(() => applyCommand(world, { type: 'upgrade-tank', tankId: 'tank-3' })).toThrow('maximum');
  });

  it('replays purchases and expansions after active and offline time', () => {
    let runtime = createRuntime(createWorld(NOW), 'fs503-purchase');
    for (const command of [{ type: 'purchase-tank' }, { type: 'upgrade-tank', tankId: 'tank-3' }, layout([rock, cover])] as Command[]) {
      runtime = executeCommand(runtime, commandEnvelope(runtime, command, runtime.tick + 100));
      runtime = advanceRuntime(runtime, runtime.tick + 2400);
      expect(decodeRuntime(JSON.stringify(runtime))).toEqual(runtime);
    }
  });

  it('rejects funds, bounds, duplicate pieces and unsafe layouts atomically', () => {
    const world = createWorld(NOW), before = JSON.stringify(world);
    for (const command of [layout([rock, rock]), layout([{ ...rock, x: NaN }]), layout([{ ...rock, x: 0.1 }]), layout([rock, { ...rock, id: 'DC-3', x: 0.62 }]), layout([{ ...rock, scale: 9 }]), { type: 'upgrade-tank', tankId: 'missing' }] as Command[]) {
      expect(() => applyCommand(world, command)).toThrow(); expect(JSON.stringify(world)).toBe(before);
    }
    const poor = { ...world, credits: 0, ledger: openingLedger(0) }, poorBefore = JSON.stringify(poor);
    expect(() => applyCommand(poor, { type: 'purchase-tank' })).toThrow('costs');
    expect(() => applyCommand(poor, layout([rock]))).toThrow('costs');
    expect(JSON.stringify(poor)).toBe(poorBefore);
    let full = funded(); while (full.tanks.length < 8) full = applyCommand(full, { type: 'purchase-tank' });
    expect(() => applyCommand(full, { type: 'purchase-tank' })).toThrow('eight');
  });

  it('persists transforms, charges only added pieces and replays idempotently', () => {
    let runtime = createRuntime(createWorld(NOW), 'fs503-layout');
    const command = commandEnvelope(runtime, layout([rock, cover]));
    runtime = executeCommand(runtime, command);
    expect(executeCommand(runtime, command)).toBe(runtime);
    expect(runtime.world.credits).toBe(1150);
    const moved = [{ ...rock, x: 0.35, scale: 0.8, rotation: 125 }, cover];
    runtime = executeCommand(runtime, commandEnvelope(runtime, layout(moved)));
    expect(runtime.world.credits).toBe(1150);
    expect(decorationsOf(runtime.world.tanks[1])).toEqual(moved);
    expect(habitatFootprints(runtime.world.tanks[1])[0]).toMatchObject({ x: 0.35, radius: 0.055 * 0.8, rotation: 125 });
    runtime = advanceRuntime(runtime, 3600);
    expect(decodeRuntime(JSON.stringify(runtime))).toEqual(runtime);
    runtime = executeCommand(runtime, commandEnvelope(runtime, layout([])));
    expect(runtime.world.credits).toBe(1150);
    expect(habitatFootprints(runtime.world.tanks[1])).toEqual([]);
    const tampered = JSON.parse(JSON.stringify(runtime)); tampered.world.tanks[1].decorations = [rock];
    expect(() => decodeRuntime(JSON.stringify(tampered))).toThrow('replay');
  });

  it('migrates v7 without changing stock, water, identities, ledger or old free-tank journals', () => {
    let runtime = createRuntime(createWorld(NOW), 'fs503-v7');
    runtime = executeCommand(runtime, commandEnvelope(runtime, { type: 'add-tank' }));
    runtime = executeCommand(runtime, commandEnvelope(runtime, { type: 'decorate', tankId: 'tank-2' }));
    runtime = advanceRuntime(runtime, 12000);
    const raw = JSON.parse(JSON.stringify(runtime));
    for (const world of [raw.world, raw.checkpoint.world]) { world.version = 7; world.tanks.forEach((t: { decorations?: unknown }) => { delete t.decorations; }); }
    const migrated = decodeRuntime(JSON.stringify(raw));
    expect(migrated.world).toEqual(runtime.world);
    expect(migrated.world.tanks[1].decorations).toEqual(legacyDecorations());
    expect(migrated.events).toEqual([]);
    expect(decodeRuntime(JSON.stringify(migrated))).toEqual(migrated);
    raw.world.tanks[0].water.ammoniaMgL += 1;
    expect(() => decodeRuntime(JSON.stringify(raw))).toThrow('replay');
  });

  it('uses moved rocks for body clearance and moved plants as actual hiding targets', () => {
    const world = applyCommand(createWorld(NOW), layout([rock, cover]));
    const footprints = habitatFootprints(world.tanks[1]);
    let behavior = { ...createBehaviorWorld(world.fish, true), footprints };
    behavior.actors[0] = { ...behavior.actors[0], x: rock.x, y: rock.y };
    for (let i = 0; i < 400; i++) {
      behavior = stepBehavior(behavior) as typeof behavior;
      for (const actor of behavior.actors) expect(Math.hypot(actor.x - rock.x, actor.y - rock.y)).toBeGreaterThanOrEqual(footprints[0].radius + BODY_CLEARANCE - 1e-10);
    }
    const actor = behavior.actors[0];
    const targetWorld = { ...behavior, actors: [{ ...actor, x: 0.65, y: 0.65, fear: 1, state: 'hide' as const, dwell: 0 }], step: 0 };
    const near = stepBehavior(targetWorld).actors[0];
    const far = stepBehavior({ ...targetWorld, footprints: [{ ...footprints[1], x: 0.3 }] }).actors[0];
    expect(near.vx).toBeGreaterThan(far.vx);
  });
});
