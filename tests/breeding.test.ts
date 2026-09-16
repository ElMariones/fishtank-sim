import { describe, expect, it } from 'vitest';
import { absenceObserver } from '../src/core/absence';
import { clutchMembers, COOLDOWN_DAYS, courtingClutchOf, courtshipRate, MS_PER_GAME_DAY, pairingBlockers, reservedPlaces } from '../src/core/breeding';
import { INCUBATION_DAYS, isEgg, lifeStage } from '../src/core/development';
import { metabolicPotential } from '../src/core/genetics';
import { advanceWorld } from '../src/core/habitat';
import { random } from '../src/core/random';
import { advanceRuntime, applyOfflineCatchup, commandEnvelope, createRuntime, decodeRuntime, executeCommand } from '../src/core/runtime';
import { decodeSave } from '../src/core/save';
import type { World } from '../src/core/types';
import { TICKS_PER_GAME_DAY } from '../src/core/water';
import { applyCommand, createWorld, MAX_LIVING, MAX_RECORDS, type Command } from '../src/core/world';
import { TICK_MS } from '../src/simulation/time';

const NOW = '2026-09-14T12:00:00.000Z';
const DAY = TICKS_PER_GAME_DAY;
const limits = { maxLiving: MAX_LIVING, maxRecords: MAX_RECORDS };
type Pair = Extract<Command, { type: 'pair' }>;
/** Haru (FSH-000001, female) and Sumi (FSH-000002, male) share The Koi Garden as healthy adults. */
const pair = (overrides: Partial<Pair> = {}): Pair => ({ type: 'pair', motherId: 'FSH-000001', fatherId: 'FSH-000002', nurseryId: 'tank-2', size: 20, timestamp: NOW, genomeVersion: 3, ...overrides });
const labCross = (tankId: string, motherId = 'FSH-000003', fatherId = 'FSH-000004'): Command => ({ type: 'breed', motherId, fatherId, tankId, timestamp: NOW, genomeVersion: 3 });
const requestOf = (command: Pair) => ({ motherId: command.motherId, fatherId: command.fatherId, nurseryId: command.nurseryId, size: command.size });

/** Advance one game day at a time until the first clutch leaves courtship; returns the world and the boundary tick. */
function untilLaid(world: World, fromTick: number): { world: World; tick: number } {
  let current = world, tick = fromTick;
  for (let day = 0; day < 10 && current.clutches[0].stage === 'courting'; day++) { current = advanceWorld(current, tick, tick + DAY); tick += DAY; }
  return { world: current, tick };
}

describe('FS-401 pairing eligibility and courtship blockers', () => {
  it('refuses ineligible pairings with a reason and a fix for each, changing nothing', () => {
    const world = createWorld(NOW);
    const refused = (candidate: World, command: Pair, code: string) => {
      const before = JSON.stringify(candidate), blockers = pairingBlockers(candidate, requestOf(command), limits);
      expect(blockers.map(blocker => blocker.code)).toContain(code);
      for (const blocker of blockers) { expect(blocker.message.length).toBeGreaterThan(10); expect(blocker.fix.length).toBeGreaterThan(5); }
      expect(() => applyCommand(candidate, command)).toThrow(blockers.find(blocker => blocker.code === code)!.message);
      expect(JSON.stringify(candidate)).toBe(before);
    };
    expect(pairingBlockers(world, requestOf(pair()), limits)).toEqual([]);
    refused(world, pair({ motherId: 'FSH-000002', fatherId: 'FSH-000001' }), 'role');
    refused(world, pair({ fatherId: 'FSH-000001' }), 'role');

    const eggs = applyCommand(world, labCross('tank-1'));
    const eggMother = eggs.fish.slice(6).find(f => f.sex === 'F')!, eggFather = eggs.fish.slice(6).find(f => f.sex === 'M')!;
    refused(eggs, pair({ motherId: eggMother.id, fatherId: eggFather.id }), 'immature');
    refused(advanceWorld(eggs, 0, 8 * DAY), pair({ motherId: eggMother.id, fatherId: eggFather.id }), 'immature');

    const weak = structuredClone(world); weak.fish[0].life.condition = 0.5;
    refused(weak, pair(), 'condition');
    const resting = structuredClone(world); resting.fish[1].breeding.cooldownDays = 3;
    refused(resting, pair(), 'cooldown');
    refused(applyCommand(world, { type: 'move', fishId: 'FSH-000002', tankId: 'tank-2' }), pair(), 'apart');

    const courting = applyCommand(world, pair());
    refused(courting, pair({ fatherId: 'FSH-000004', nurseryId: 'tank-1', size: 8 }), 'busy');
    refused(courting, pair({ motherId: 'FSH-000003', fatherId: 'FSH-000004' }), 'nursery-busy');
    const crowded = applyCommand(applyCommand(world, labCross('tank-2')), labCross('tank-2'));
    refused(crowded, pair({ size: 24 }), 'nursery-full');
    expect(pairingBlockers(crowded, requestOf(pair({ size: 20 })), limits)).toEqual([]);
    refused(world, pair({ nurseryId: 'tank-9' }), 'nursery-missing');
    expect(() => applyCommand(world, pair({ genomeVersion: 1 }))).toThrow('genome v1');
  });

  it('courts once per game day, pauses with recorded reasons, then lays the reserved eggs and rests the parents', () => {
    let world = applyCommand(createWorld(NOW), pair({ size: 12 }));
    const rate = courtshipRate(world.fish[0], world.fish[1]);
    expect(rate).toBeGreaterThanOrEqual(0.25); expect(rate).toBeLessThanOrEqual(0.75);
    world = advanceWorld(world, 0, DAY);
    expect(world.clutches[0]).toMatchObject({ stage: 'courting', days: 1, progress: rate, blockers: [] });

    // Separated, with their home tank warming: courtship pauses because they are apart.
    world = applyCommand(world, { type: 'move', fishId: 'FSH-000002', tankId: 'tank-2' });
    world = applyCommand(world, { type: 'set-care', tankId: 'tank-1', ration: 'measured', filterTier: 1, aerationTier: 1, targetC: 30 });
    world = advanceWorld(world, DAY, 3 * DAY);
    expect(world.clutches[0]).toMatchObject({ days: 3, progress: rate, blockers: ['apart'] });
    expect(world.tanks[0].water.temperatureC).toBeGreaterThan(28);

    // Reunited in water that is too warm to spawn: it pauses for the water instead, and says so.
    world = applyCommand(world, { type: 'move', fishId: 'FSH-000002', tankId: 'tank-1' });
    world = advanceWorld(world, 3 * DAY, 4 * DAY);
    expect(world.clutches[0]).toMatchObject({ days: 4, progress: rate, blockers: ['water'] });
    expect(world.fish.slice(0, 2).every(f => f.life.condition >= 0.7)).toBe(true);

    world = applyCommand(world, { type: 'set-care', tankId: 'tank-1', ration: 'measured', filterTier: 1, aerationTier: 1, targetC: 22 });
    const laid = untilLaid(world, 4 * DAY), clutch = laid.world.clutches[0];
    expect(clutch).toMatchObject({ stage: 'incubating', progress: 1, blockers: [] });
    const eggs = clutchMembers(laid.world, clutch);
    expect(eggs).toHaveLength(12);
    for (const egg of eggs) {
      expect(egg).toMatchObject({ parents: ['FSH-000001', 'FSH-000002'], tankId: 'tank-2', generation: 1, status: 'living' });
      expect(isEgg(egg.life)).toBe(true);
      expect(egg.bornAt).toBe(new Date(Date.parse(NOW) + clutch.spawnedDay! * MS_PER_GAME_DAY).toISOString());
    }
    expect(reservedPlaces(laid.world)).toBe(0);
    expect(laid.world.fish.slice(0, 2).map(f => f.breeding.cooldownDays)).toEqual([COOLDOWN_DAYS.F, COOLDOWN_DAYS.M]);

    const hatched = advanceWorld(laid.world, laid.tick, laid.tick + INCUBATION_DAYS * DAY);
    expect(hatched.fish.slice(0, 2).map(f => f.breeding.cooldownDays)).toEqual([COOLDOWN_DAYS.F - INCUBATION_DAYS, COOLDOWN_DAYS.M - INCUBATION_DAYS]);
    expect(hatched.clutches[0].stage).toBe('hatched');
    expect(clutchMembers(hatched, hatched.clutches[0]).every(member => !isEgg(member.life))).toBe(true);
  });
});

describe('FS-402 reserved clutch scheduler and bounded nursery', () => {
  it('reserves nursery places so no arrival can overflow a courting nursery, across random command sequences', () => {
    let world = applyCommand(applyCommand(createWorld(NOW), labCross('tank-2')), labCross('tank-2'));
    world = applyCommand(world, pair());
    expect(reservedPlaces(world, 'tank-2')).toBe(20);
    const before = JSON.stringify(world);
    expect(() => applyCommand(world, { type: 'buy', tankId: 'tank-2', timestamp: NOW, genomeVersion: 3 })).toThrow('reserved');
    expect(() => applyCommand(world, { type: 'move', fishId: 'FSH-000005', tankId: 'tank-2' })).toThrow('reserved');
    expect(() => applyCommand(world, labCross('tank-2', 'FSH-000005', 'FSH-000006'))).toThrow('reserved');
    expect(JSON.stringify(world)).toBe(before);

    // Weighted random commands. Pairing favors adults that share a tank so courtships really run, while purchases,
    // moves, lab crosses, cancellations and sales compete for the same places.
    const rng = random(402), pick = <T,>(items: readonly T[]) => items[Math.floor(rng() * items.length)];
    let spawningWalks = 0;
    for (let trial = 0; trial < 3; trial++) {
      let runtime = createRuntime(createWorld(NOW), `nursery-${trial}`);
      for (let step = 0; step < 90; step++) {
        const w = runtime.world, living = w.fish.filter(f => f.status === 'living'), tanks = w.tanks.map(t => t.id);
        const adults = (sex: 'F' | 'M') => living.filter(f => f.sex === sex && lifeStage(f.life, metabolicPotential(f.genome)) === 'adult');
        const homes = [...new Set(adults('F').map(f => f.tankId))].filter(home => adults('M').some(f => f.tankId === home));
        const couple = () => { const home = pick(homes); return [pick(adults('F').filter(f => f.tankId === home)).id, pick(adults('M').filter(f => f.tankId === home)).id] as const; };
        const courting = w.clutches.filter(c => c.stage === 'courting'), roll = rng();
        let command: Command | null = null, advance = 1;
        if (roll < 0.25 && homes.length) { const [motherId, fatherId] = couple(); command = pair({ motherId, fatherId, nurseryId: pick(tanks), size: pick([8, 12, 16, 20, 24] as const) }); }
        else if (roll < 0.35) command = { type: 'buy', tankId: pick(tanks), timestamp: NOW, genomeVersion: 3 };
        else if (roll < 0.45 && living.length) command = { type: 'move', fishId: pick(living).id, tankId: pick(tanks) };
        else if (roll < 0.55 && homes.length) { const [motherId, fatherId] = couple(); command = labCross(pick(tanks), motherId, fatherId); }
        else if (roll < 0.6 && courting.length) command = { type: 'cancel-clutch', clutchId: pick(courting).id };
        else if (roll < 0.65 && living.length) command = { type: 'sell', fishId: pick(living).id };
        else if (roll < 0.7 && w.tanks.length < 4) command = { type: 'add-tank' };
        else advance = 1 + Math.floor(rng() * 3 * DAY);
        const tick = runtime.tick + advance;
        try { runtime = command ? executeCommand(runtime, commandEnvelope(runtime, command, tick)) : advanceRuntime(runtime, tick); }
        catch { runtime = advanceRuntime(runtime, tick); }
        const world = runtime.world;
        for (const tank of world.tanks) expect(world.fish.filter(f => f.status === 'living' && f.tankId === tank.id).length + reservedPlaces(world, tank.id)).toBeLessThanOrEqual(tank.capacity);
        expect(world.fish.filter(f => f.status === 'living').length + reservedPlaces(world)).toBeLessThanOrEqual(MAX_LIVING);
        expect(new Set(world.fish.map(f => f.id)).size).toBe(world.fish.length);
      }
      if (runtime.world.clutches.some(clutch => clutch.stage === 'incubating' || clutch.stage === 'hatched')) spawningWalks++;
      expect(decodeRuntime(JSON.stringify(runtime))).toEqual(runtime);
    }
    // The walks must actually lay eggs, or the reservation checks above would say little about spawning.
    expect(spawningWalks).toBeGreaterThanOrEqual(2);
  });

  it('never duplicates courtship, spawning or hatching across reloads, time splits and offline catch-up', () => {
    const start = createRuntime(createWorld(NOW), 'clutch-world'), command = commandEnvelope(start, pair({ size: 16 }), 25);
    const runtime = executeCommand(start, command), end = 12 * DAY + 17;
    const straight = advanceRuntime(runtime, end);
    let reloaded = runtime;
    for (const stop of [DAY - 1, DAY, DAY + 1, 2 * DAY + 600, 3 * DAY, 5 * DAY + 3, 8 * DAY, end]) reloaded = decodeRuntime(JSON.stringify(advanceRuntime(reloaded, stop)));
    expect(reloaded.world).toEqual(straight.world);
    const observer = absenceObserver(runtime.world), offline = applyOfflineCatchup(runtime, 0, (end - runtime.tick) * TICK_MS, observer.onDay).runtime;
    expect(offline.world).toEqual(straight.world);
    expect(straight.world.fish).toHaveLength(6 + 16);
    expect(straight.world.nextId).toBe(6 + 16 + 1);
    expect(straight.world.clutches[0].stage).toBe('hatched');
    expect(executeCommand(straight, command)).toBe(straight);
    const summary = observer.summarize(offline.world);
    expect(summary.tanks.find(tank => tank.tankId === 'tank-2')).toMatchObject({ eggsLaid: 16, unexplainedDeclines: 0 });
  });

  it('cancels only a courtship, releasing its places, and keeps courting parents from being sold', () => {
    const world = applyCommand(createWorld(NOW), pair()), clutch = world.clutches[0], before = JSON.stringify(world);
    expect(() => applyCommand(world, { type: 'sell', fishId: 'FSH-000001' })).toThrow('courting');
    expect(() => applyCommand(world, { type: 'sell-batch', fishIds: ['FSH-000003', 'FSH-000002'] })).toThrow('courting');
    expect(JSON.stringify(world)).toBe(before);
    const cancelled = applyCommand(world, { type: 'cancel-clutch', clutchId: clutch.id });
    expect(cancelled.clutches[0]).toMatchObject({ stage: 'cancelled', blockers: [] });
    expect(reservedPlaces(cancelled)).toBe(0);
    expect(courtingClutchOf(cancelled, 'FSH-000001')).toBeUndefined();
    expect(applyCommand(cancelled, { type: 'sell', fishId: 'FSH-000001' }).fish[0].status).toBe('sold');
    expect(() => applyCommand(cancelled, { type: 'cancel-clutch', clutchId: clutch.id })).toThrow('Only a courtship');
    expect(applyCommand(cancelled, pair()).clutches.map(entry => entry.id)).toEqual(['CL-000001', 'CL-000002']);
    expect(() => applyCommand(untilLaid(world, 0).world, { type: 'cancel-clutch', clutchId: clutch.id })).toThrow('Only a courtship');
    expect(() => applyCommand(world, { type: 'cancel-clutch', clutchId: 'CL-000099' })).toThrow('not found');
  });

  it('migrates world v4 saves with rested fish and no clutches, and rejects inconsistent clutch records', () => {
    const current = createWorld(NOW), older = JSON.parse(JSON.stringify(current));
    older.version = 4; delete older.nextClutchId; delete older.clutches;
    for (const member of older.fish) delete member.breeding;
    expect(decodeSave(JSON.stringify(older))).toEqual(current);
    const courting = applyCommand(current, pair()), laid = untilLaid(courting, 0).world;
    expect(decodeSave(JSON.stringify(courting))).toEqual(courting);
    expect(decodeSave(JSON.stringify(laid))).toEqual(laid);
    type Editable = { nextClutchId: number; tanks: { capacity: number }[]; fish: { breeding: { cooldownDays: number } }[]; clutches: Record<string, unknown>[] };
    const mutate = (base: World, edit: (world: Editable) => void) => { const copy = JSON.parse(JSON.stringify(base)); edit(copy); return JSON.stringify(copy); };
    for (const raw of [
      mutate(courting, w => { w.clutches[0].motherId = 'FSH-000002'; }),
      mutate(courting, w => { w.clutches[0].firstFishId = 'FSH-000007'; }),
      mutate(courting, w => { w.clutches.push({ ...w.clutches[0], id: 'CL-000002', motherId: 'FSH-000003', fatherId: 'FSH-000004' }); w.nextClutchId = 3; }),
      mutate(courting, w => { w.tanks[1].capacity = 10; }),
      mutate(courting, w => { w.clutches[0].id = 'CL-000005'; }),
      mutate(laid, w => { w.clutches[0].firstFishId = 'FSH-000001'; }),
      mutate(current, w => { w.fish[0].breeding.cooldownDays = 400; }),
    ]) expect(() => decodeSave(raw)).toThrow();

    let runtime = createRuntime(createWorld(NOW), 'v4-runtime');
    runtime = advanceRuntime(executeCommand(runtime, commandEnvelope(runtime, labCross('tank-2'), 30)), DAY + 9);
    const legacy = JSON.parse(JSON.stringify(runtime));
    for (const stored of [legacy.world, legacy.checkpoint.world]) {
      stored.version = 4; delete stored.nextClutchId; delete stored.clutches;
      for (const member of stored.fish) delete member.breeding;
    }
    const decoded = decodeRuntime(JSON.stringify(legacy));
    expect(decoded).toMatchObject({ tick: DAY + 9, revision: 1, events: [] });
    expect(decoded.world.fish).toHaveLength(26);
    expect(decoded.world.clutches).toEqual([]);
  });
});
