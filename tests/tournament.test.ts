import { describe, expect, it } from 'vitest';
import { competitionSchedule, competitionScores } from '../src/core/competitions';
import { circuitCareer, entrantReputation, licenceLevel, projectEntry, recommendations, rivals, tierUnlocked, titleOf } from '../src/core/circuitCareer';
import { commandEnvelope, createRuntime, decodeRuntime, executeCommand } from '../src/core/runtime';
import { decodeSave } from '../src/core/save';
import { BRIEFS, INCIDENT_IDS, showAdjustment, showFormat, TACTIC_IDS, weightedTotal } from '../src/core/tournament';
import { applyCommand, createWorld, type Command } from '../src/core/world';
import type { World } from '../src/core/types';

const NOW = '2026-11-09T12:00:00.000Z';
const base = () => createWorld(NOW);
const koiEvent = (world: World, tier = 'amateur') => competitionSchedule(world.seed, world.circuit.day).find(e => e.species === 'koi' && e.tier === tier)!;
const enter = (world: World, tier = 'amateur', fishIds = [world.fish[0].id]): Command => ({ type: 'enter-competition', eventId: koiEvent(world, tier).id, fishIds, format: 2 });
function rejection(world: World, command: Command, message?: string) { const before = JSON.stringify(world); expect(() => applyCommand(world, command)).toThrow(message); expect(JSON.stringify(world)).toBe(before); }

describe('tournament format 2 (world v22)', () => {
  it('draws a stable brief, award and incident per event; amateur shows are Grand Classic', () => {
    const events = competitionSchedule(77, 0);
    for (const event of events) {
      expect(showFormat(77, event)).toEqual(showFormat(77, event));
      if (event.tier === 'amateur') { expect(showFormat(77, event).brief).toBe('classic'); expect(['heatwave', 'crowd']).not.toContain(showFormat(77, event).incident); }
    }
    const formats = new Set(competitionSchedule(77, 0).concat(competitionSchedule(77, 30), competitionSchedule(77, 60)).map(e => showFormat(77, e).incident));
    expect(formats.size).toBeGreaterThan(3);
    for (const w of Object.values(BRIEFS)) expect(w.weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
  });

  it('enters atomically with base scores, no comments and a saved show format', () => {
    const world = base(), entered = applyCommand(world, enter(world, 'amateur', world.fish.slice(0, 2).map(f => f.id)));
    const run = entered.circuit.active!;
    expect(run.show).toMatchObject({ model: 2, brief: 'classic', tactic: null, awardWinner: null });
    expect(run.participants).toHaveLength(10);
    expect(run.participants.every(p => p.comment === '' && JSON.stringify(p.adjust) === JSON.stringify({ presentation: 0, pattern: 0, condition: 0 }))).toBe(true);
    for (const p of run.participants) expect(p.scores).toEqual(competitionScores(p.fish, run.event));
    expect(entered.credits).toBe(world.credits - 2 * run.event.fee);
    expect(decodeSave(JSON.stringify(entered))).toEqual(entered);
    expect(applyCommand(world, enter(world, 'amateur', world.fish.slice(0, 2).map(f => f.id)))).toEqual(entered);
  });

  it('requires a preparation, applies published adjustments, re-ranks and pays prizes plus the special award once', () => {
    const entered = applyCommand(base(), enter(base(), 'amateur', ['FSH-000001', 'FSH-000002']));
    rejection(entered, { type: 'judge-competition' }, 'preparation');
    for (const tactic of TACTIC_IDS) {
      const judged = applyCommand(entered, { type: 'judge-competition', tactic });
      const run = judged.circuit.active!, show = run.show!;
      expect(show.tactic).toBe(tactic); expect(run.phase).toBe('results'); expect(show.awardWinner).toMatch(/^FSH-/);
      for (const [index, p] of run.participants.entries()) {
        expect(p.rank).toBe(index + 1); expect(p.comment.length).toBeGreaterThan(20); expect(p.comment).toContain(p.fish.name);
        const raw = competitionScores(p.fish, run.event);
        // The saved adjustment is the effective change after clamping: it always equals final minus raw.
        for (const key of ['presentation', 'pattern', 'condition'] as const) expect(p.adjust![key]).toBeCloseTo(p.scores[key] - raw[key], 5);
        expect(p.total).toBe(weightedTotal(p.scores, show.brief));
        if (index) expect(run.participants[index - 1].total).toBeGreaterThanOrEqual(p.total);
      }
      const award = run.participants.some(p => p.isPlayer && p.fish.id === show.awardWinner) ? run.event.fee : 0;
      const prize = run.participants.filter(p => p.isPlayer && p.rank <= 3).reduce((sum, p) => sum + run.event.prizes[p.rank - 1], 0) + award;
      expect(judged.credits).toBe(entered.credits + prize);
      expect(decodeSave(JSON.stringify(judged))).toEqual(judged);
      rejection(judged, { type: 'judge-competition', tactic }, 'no exhibition');
      const closed = applyCommand(judged, { type: 'close-competition' });
      expect(decodeSave(JSON.stringify(closed))).toEqual(closed);
    }
  });

  it('keeps format-1 shows unchanged and rejects a preparation for them', () => {
    const world = base(), legacy = applyCommand(world, { type: 'enter-competition', eventId: koiEvent(world).id, fishIds: [world.fish[0].id] });
    expect(legacy.circuit.active!.show).toBeUndefined();
    expect(legacy.circuit.active!.participants.every(p => p.adjust === undefined && p.comment.length > 0)).toBe(true);
    rejection(legacy, { type: 'judge-competition', tactic: 'lighting' }, 'no show-day');
    expect(decodeSave(JSON.stringify(applyCommand(legacy, { type: 'judge-competition' })))).toBeTruthy();
  });

  it('rejects forged adjustments, formats and award winners in saves', () => {
    const judged = applyCommand(applyCommand(base(), enter(base())), { type: 'judge-competition', tactic: 'acclimate' });
    const forge = (edit: (w: World) => void) => { const w = structuredClone(judged); edit(w); expect(() => decodeSave(JSON.stringify(w))).toThrow(); };
    forge(w => { w.circuit.active!.participants[0].adjust!.condition += 1; });
    forge(w => { w.circuit.active!.show!.incident = w.circuit.active!.show!.incident === 'calm' ? 'delay' : 'calm'; });
    forge(w => { w.circuit.active!.show!.tactic = 'spotlight'; });
    forge(w => { const p = w.circuit.active!.participants.find(x => x.fish.id !== w.circuit.active!.show!.awardWinner)!; w.circuit.active!.show!.awardWinner = p.fish.id; });
    forge(w => { w.circuit.active!.participants[1].comment = 'Forged praise.'; });
  });

  it('gates tiers behind licences for format 2 only, without partial changes', () => {
    const world = base();
    expect(tierUnlocked(world, 'amateur')).toBe(true); expect(tierUnlocked(world, 'regional')).toBe(false);
    rejection(world, enter(world, 'regional'), 'licence');
    expect(applyCommand(world, { type: 'enter-competition', eventId: koiEvent(world, 'regional').id, fishIds: [world.fish[0].id] }).circuit.active).toBeTruthy();
    expect(licenceLevel(0, [])).toBe(0); expect(licenceLevel(35, [])).toBe(2); expect(licenceLevel(400, [])).toBe(5);
  });

  it('derives reputation, titles, milestones and rivals from history alone', () => {
    let world = applyCommand(base(), enter(base(), 'amateur', ['FSH-000001', 'FSH-000002']));
    world = applyCommand(applyCommand(world, { type: 'judge-competition', tactic: 'acclimate' }), { type: 'close-competition' });
    const run = world.circuit.history[0], career = circuitCareer(world);
    const expected = run.participants.filter(p => p.isPlayer).reduce((sum, p) => sum + Math.round(4 * (p.rank === 1 ? 3 : p.rank === 2 ? 2 : p.rank === 3 ? 1.5 : p.rank <= 5 ? 1 : 0.5) + (run.show!.awardWinner === p.fish.id ? 4 : 0)), 0);
    expect(career.reputation).toBe(expected);
    expect(run.participants.filter(p => p.isPlayer).reduce((s, p) => s + entrantReputation(run, p), 0)).toBe(expected);
    expect(career.shows).toBe(1); expect(career.milestones.find(m => m.id === 'debut')!.done).toBe(true);
    expect(career.season.shows).toBe(1);
    const mine = run.participants.find(p => p.isPlayer)!;
    expect(titleOf(world.circuit.history, mine.fish.id)).toBe(mine.rank === 1 ? 'Show Winner' : mine.rank <= 3 ? 'Podium Finisher' : null);
    const table = rivals(world.circuit.history);
    expect(table.every(r => r.meetings === 1 && r.wins + r.losses === 1)).toBe(true);
  });

  it('projects and recommends only open, licensed, unentered shows with eligible animals', () => {
    const world = base(), events = competitionSchedule(world.seed, 0);
    const recs = recommendations(world, events);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.every(r => tierUnlocked(world, r.event.tier) && r.fish.species === r.event.species)).toBe(true);
    const p = projectEntry(world.seed, koiEvent(world), world.fish[0], false);
    expect(p.low).toBeGreaterThanOrEqual(1); expect(p.high).toBeGreaterThanOrEqual(p.low);
  });

  it('computes every incident and preparation combination as published', () => {
    const ctx = { bold: 0.3, lengthRank: 0, baseCondition: 80, isPlayer: true };
    expect(showAdjustment('calm', null, ctx).delta).toEqual({ presentation: 0, pattern: 0, condition: 0 });
    expect(showAdjustment('heatwave', 'acclimate', ctx).delta.condition).toBe(1.5);
    expect(showAdjustment('heatwave', 'lighting', ctx).delta).toEqual({ presentation: 0, pattern: 2.5, condition: -7 });
    expect(showAdjustment('flicker', 'lighting', ctx).delta.pattern).toBe(2.5);
    expect(showAdjustment('flicker', 'acclimate', ctx).delta.pattern).toBe(-4);
    expect(showAdjustment('crowd', 'spotlight', ctx).delta.presentation).toBe(-10);
    expect(showAdjustment('crowd', 'spotlight', { ...ctx, bold: 0.8 }).delta.presentation).toBe(7);
    expect(showAdjustment('crowd', 'acclimate', ctx).delta.presentation).toBe(0);
    expect(showAdjustment('guest-judge', null, { ...ctx, isPlayer: false }).delta.presentation).toBe(3);
    expect(showAdjustment('delay', 'spotlight', { ...ctx, isPlayer: false }).delta).toEqual({ presentation: 0, pattern: 0, condition: -3 });
    for (const incident of INCIDENT_IDS) expect(showAdjustment(incident, 'spotlight', { ...ctx, isPlayer: false }).notes.some(n => n.includes('Spotlight'))).toBe(false);
  });

  it('replays format-2 commands through the runtime journal', () => {
    let runtime = createRuntime(base(), 'tournament-replay');
    runtime = executeCommand(runtime, commandEnvelope(runtime, enter(runtime.world, 'amateur', ['FSH-000001'])));
    runtime = executeCommand(runtime, commandEnvelope(runtime, { type: 'judge-competition', tactic: 'spotlight' }));
    runtime = executeCommand(runtime, commandEnvelope(runtime, { type: 'close-competition' }));
    const restored = decodeRuntime(JSON.stringify(runtime));
    expect(restored.world.circuit).toEqual(runtime.world.circuit); expect(restored.world.version).toBe(22);
  });

  it('migrates a v21 save without touching its shows', () => {
    const legacy = applyCommand(applyCommand(base(), { type: 'enter-competition', eventId: koiEvent(base()).id, fishIds: ['FSH-000001'] }), { type: 'judge-competition' });
    const migrated = decodeSave(JSON.stringify({ ...legacy, version: 21 }));
    expect(migrated.version).toBe(22); expect(migrated.circuit).toEqual(legacy.circuit);
  });
});
