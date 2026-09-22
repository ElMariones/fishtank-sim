import { describe, expect, it } from 'vitest';
import { competitionSchedule, eligibility, negotiationFloor } from '../src/core/competitions';
import { openingLedger } from '../src/core/economy';
import { advanceWorld } from '../src/core/habitat';
import { advanceRuntime, commandEnvelope, createRuntime, decodeRuntime, executeCommand, importRuntime } from '../src/core/runtime';
import { decodeSave } from '../src/core/save';
import { TICKS_PER_GAME_DAY } from '../src/core/water';
import { applyCommand, createWorld, type Command } from '../src/core/world';
import type { World } from '../src/core/types';
const NOW = '2026-09-21T12:00:00.000Z';
const base = () => createWorld(NOW);
const eventFor = (world: World) => competitionSchedule(world.seed, world.circuit.day)[0];
const entry = (world: World, fishIds = [world.fish[0].id]): Command => ({ type: 'enter-competition', eventId: eventFor(world).id, fishIds });
const judged = () => applyCommand(applyCommand(base(), entry(base())), { type: 'judge-competition' });
function rejection(world: World, command: Command, message?: string) { const before = JSON.stringify(world); expect(() => applyCommand(world, command)).toThrow(message); expect(JSON.stringify(world)).toBe(before); }

describe('calendar competition circuit', () => {
  it('generates stable species/tier fields and renews editions at calendar windows and years', () => {
    const events = competitionSchedule(123, 0);
    expect(events).toHaveLength(12); expect(new Set(events.map(e => e.id)).size).toBe(12);
    expect(competitionSchedule(123, 29)).toEqual(events);
    expect(competitionSchedule(123, 30)).not.toEqual(events);
    expect(competitionSchedule(124, 0)).not.toEqual(events);
    expect(competitionSchedule(123, 360).every(e => e.year === 2)).toBe(true);
  });
  it('advances all life and the calendar identically in one skip and daily skips', () => {
    const start = base(), week = advanceWorld(start, 0, 7 * TICKS_PER_GAME_DAY);
    let daily = start;
    for (let day = 0; day < 7; day++) daily = advanceWorld(daily, day * TICKS_PER_GAME_DAY, (day + 1) * TICKS_PER_GAME_DAY);
    expect(week).toEqual(daily); expect(week.circuit.day).toBe(7); expect(week.fish[0].life.ageDays).toBe(start.fish[0].life.ageDays + 7);
  });
  it('a month skip preserves daily courtship, hatching and growth and crosses the show year safely', () => {
    let start = createRuntime(base(), 'calendar-breeding');
    start = executeCommand(start, commandEnvelope(start, { type: 'pair', motherId: 'FSH-000001', fatherId: 'FSH-000002', nurseryId: 'tank-2', size: 8, timestamp: NOW, genomeVersion: 3 }));
    const month = advanceRuntime(start, 30 * TICKS_PER_GAME_DAY);
    let daily = start;
    for (let day = 1; day <= 30; day++) daily = advanceRuntime(daily, day * TICKS_PER_GAME_DAY);
    expect(month).toEqual(daily); expect(month.world.circuit.day).toBe(30);
    expect(month.world.clutches[0].stage).toBe('hatched'); expect(month.world.fish.slice(6).every(f => f.life.lengthCm > 0.6)).toBe(true);
    expect(decodeRuntime(JSON.stringify(month))).toEqual(month);
    const year = advanceRuntime(month, 361 * TICKS_PER_GAME_DAY);
    expect(year.world.circuit.day).toBe(361); expect(competitionSchedule(year.world.seed, year.world.circuit.day)[0].year).toBe(2);
    expect(decodeRuntime(JSON.stringify(year))).toEqual(year);
    const imported = importRuntime(JSON.stringify(year.world), 'bare-year');
    expect(imported.tick).toBe(year.tick); expect(decodeRuntime(JSON.stringify(imported))).toEqual(imported);
  });
  it('supports independent axolotl competitors and their exact purchased genomes', () => {
    let world = applyCommand(base(), { type: 'buy', species: 'axolotl', tankId: 'tank-2', timestamp: NOW });
    const fish = world.fish.at(-1)!;
    world = applyCommand(world, { type: 'enter-competition', eventId: competitionSchedule(world.seed, 0)[1].id, fishIds: [fish.id] });
    expect(world.circuit.active!.participants.every(p => p.fish.species === 'axolotl')).toBe(true);
    expect(decodeSave(JSON.stringify(world))).toEqual(world);
    world = applyCommand(world, { type: 'judge-competition' });
    const npc = world.circuit.active!.participants.find(p => !p.isPlayer)!;
    world = applyCommand(world, { type: 'competition-offer', participantId: npc.fish.id, amount: npc.askingPrice, tankId: 'tank-2', timestamp: NOW });
    expect(decodeSave(JSON.stringify(world))).toEqual(world);
    expect(world.fish.at(-1)!.genome).toEqual(npc.fish.genome);
  });
  it('enters one or two adults atomically and preserves deterministic competition specimens', () => {
    const world = base(), entered = applyCommand(world, entry(world, world.fish.slice(0, 2).map(f => f.id)));
    expect(entered.credits).toBe(world.credits - 80); expect(entered.circuit.active?.participants).toHaveLength(10);
    expect(applyCommand(world, entry(world, world.fish.slice(0, 2).map(f => f.id)))).toEqual(entered);
    expect(decodeSave(JSON.stringify(entered))).toEqual(entered);
    rejection(world, entry(world, [world.fish[0].id, world.fish[0].id]), 'once');
    rejection(entered, entry(entered), 'current competition');
    const poor = { ...world, credits: 0, ledger: openingLedger(0) }; rejection(poor, entry(poor), 'costs');
    world.fish[0].life.condition = 0.6; rejection(world, entry(world), 'condition');
    expect(eligibility(world.fish[1], competitionSchedule(world.seed, 0)[1])).toContain('axolotl');
    rejection(world, { ...entry(world), eventId: 'missing' } as Command, 'closed');
  });
  it('pays exact ranked prizes once and persists immutable results and event lockout', () => {
    const entered = applyCommand(base(), entry(base(), ['FSH-000001', 'FSH-000002']));
    rejection(entered, { type: 'close-competition' }, 'Judge');
    const results = applyCommand(entered, { type: 'judge-competition' });
    const run = results.circuit.active!;
    const prize = run.participants.filter(p => p.isPlayer && p.rank <= 3).reduce((sum, p) => sum + run.event.prizes[p.rank - 1], 0);
    expect(results.credits).toBe(entered.credits + prize);
    rejection(results, { type: 'judge-competition' });
    const closed = applyCommand(results, { type: 'close-competition' });
    expect(closed.circuit.active).toBeNull(); expect(closed.circuit.history).toEqual([run]);
    rejection(closed, entry(closed), 'already entered'); expect(decodeSave(JSON.stringify(closed))).toEqual(closed);
  });
  it('negotiates without charges until acceptance and retains the exact acquired identity and medals', () => {
    let world = judged(); const npc = world.circuit.active!.participants.find(p => !p.isPlayer)!;
    const offer = (amount: number): Command => ({ type: 'competition-offer', participantId: npc.fish.id, amount, tankId: 'tank-2', timestamp: NOW });
    const before = world.credits; world = applyCommand(world, offer(1));
    expect(world.credits).toBe(before); expect(world.circuit.active!.participants.find(p => p.fish.id === npc.fish.id)!.negotiation.counter).toBeGreaterThan(1);
    expect(decodeSave(JSON.stringify(world))).toEqual(world);
    const price = negotiationFloor(world.circuit.active!.event, npc); world = applyCommand(world, offer(price));
    expect(world.credits).toBe(before - price); expect(world.fish.find(f => f.id === npc.fish.id)).toEqual({ ...npc.fish, tankId: 'tank-2' });
    rejection(world, offer(price), 'no longer');
    world = applyCommand(world, { type: 'rename', fishId: npc.fish.id, name: 'Champion' });
    world = applyCommand(world, { type: 'sell', fishId: npc.fish.id, priceModel: 2 });
    expect(decodeSave(JSON.stringify(world))).toEqual(world);
    expect(world.circuit.active!.participants.find(p => p.fish.id === npc.fish.id)!.fish.name).toBe(npc.fish.name);
  });
  it('bounds negotiations and rejects capacity, unaffordable and premature offers without partial mutations', () => {
    let world = judged(); const npc = world.circuit.active!.participants.find(p => !p.isPlayer)!;
    const offer: Command = { type: 'competition-offer', participantId: npc.fish.id, amount: 1, tankId: 'tank-1', timestamp: NOW };
    rejection(world, { ...offer, amount: world.credits + 1 }, 'credits');
    const full = structuredClone(world); full.tanks[0].capacity = full.fish.length; rejection(full, offer, 'free places');
    for (let i = 0; i < 3; i++) world = applyCommand(world, offer);
    expect(world.circuit.active!.participants.find(p => p.fish.id === npc.fish.id)!.negotiation.status).toBe('declined');
    rejection(world, offer); expect(decodeSave(JSON.stringify(world))).toEqual(world);
    const exhibited = applyCommand(base(), entry(base())); rejection(exhibited, offer, 'after the results');
  });
  it('replays entry, prize and purchase exactly with retry protection', () => {
    let runtime = createRuntime(base(), 'circuit-test');
    runtime = executeCommand(runtime, commandEnvelope(runtime, entry(runtime.world)));
    const judge = commandEnvelope(runtime, { type: 'judge-competition' }); runtime = executeCommand(runtime, judge);
    expect(executeCommand(runtime, judge)).toBe(runtime);
    const npc = runtime.world.circuit.active!.participants.find(p => !p.isPlayer)!;
    runtime = executeCommand(runtime, commandEnvelope(runtime, { type: 'competition-offer', participantId: npc.fish.id, amount: npc.askingPrice, tankId: 'tank-2', timestamp: NOW }));
    runtime = executeCommand(runtime, commandEnvelope(runtime, { type: 'close-competition' }));
    expect(decodeRuntime(JSON.stringify(runtime))).toEqual(runtime);
  });
  it('migrates v14 at the saved tick without changing fish identity or credits', () => {
    const runtime = advanceRuntime(createRuntime(base(), 'old-calendar'), 37 * TICKS_PER_GAME_DAY);
    const raw = JSON.parse(JSON.stringify(runtime));
    for (const world of [raw.world, raw.checkpoint.world]) { world.version = 14; delete world.circuit; for (const key of ['competitionEntry', 'competitionPrize', 'competitionPurchase']) delete world.ledger.totals[key]; }
    const restored = decodeRuntime(JSON.stringify(raw));
    expect(restored.world.fish).toEqual(runtime.world.fish); expect(restored.world.credits).toBe(runtime.world.credits); expect(restored.world.version).toBe(15);
    expect(restored.world.circuit.day).toBe(37); expect(restored.tick).toBe(runtime.tick);
    expect(decodeRuntime(JSON.stringify(restored))).toEqual(restored);
  });
  it('rejects malformed schedules, score tampering, purchased identity mismatch and missing current state', () => {
    const world = judged();
    const changes = [(w: World) => { w.circuit.active!.event.fee++; }, (w: World) => { w.circuit.active!.participants[0].total++; },
      (w: World) => { w.circuit.active!.participants[0].fish.birthSeed++; }, (w: World) => { w.circuit.active!.participants[0].rank = 9; }];
    for (const change of changes) { const bad = structuredClone(world); change(bad); expect(() => decodeSave(JSON.stringify(bad))).toThrow(); }
    const raw = JSON.parse(JSON.stringify(world)); delete raw.circuit; expect(() => decodeSave(JSON.stringify(raw))).toThrow();
  });
});
