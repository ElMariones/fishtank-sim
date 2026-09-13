import { describe, expect, it } from 'vitest';
import { createWorld } from '../src/core/world';
import {
  BEHAVIOR_STATES, coverPoints, createBehaviorWorld, DECISION_STEPS, describeBehavior, feed, REASONS, startle, stepBehavior,
  synchronizeActors, type BehaviorWorld,
} from '../src/simulation/behavior';

const founders = createWorld('2026-09-13T12:00:00.000Z').fish;
type Traits = Partial<{ bold: number; social: number; activity: number }>;
type Drives = Partial<{ hunger: number; fear: number; x: number; y: number }>;

/** Scenario setup: traits and drives are set directly so each fixture isolates one desire. */
function scenario(count: number, traits: Traits[], drives: Drives[], planted = false): BehaviorWorld {
  const world = createBehaviorWorld(founders.slice(0, count), planted);
  return { ...world, actors: world.actors.map((actor, i) => ({ ...actor, vx: 0, vy: 0, ...drives[i], phenotype: { ...actor.phenotype, ...traits[i] } })) };
}
const run = (world: BehaviorWorld, steps: number) => { let current = world; for (let i = 0; i < steps; i++) current = stepBehavior(current); return current; };
const coverDistance = (actor: { x: number; y: number }, planted: boolean) => Math.min(...coverPoints(planted).map(point => Math.hypot(point.x - actor.x, point.y - actor.y)));

describe('FS-303 utility behavior', () => {
  it('eats sinking pellets when hungry, explains why, and stops once the food is gone', () => {
    let world = feed(scenario(1, [{ bold: 0.9, social: 0, activity: 0.5 }], [{ hunger: 0.9, x: 0.5, y: 0.35 }]), 6);
    world = run(world, DECISION_STEPS);
    const eater = world.actors[0];
    expect(eater.state).toBe('eat');
    expect([REASONS.food, REASONS.hungry, REASONS.bold].every(flag => eater.reasons & flag)).toBe(true);
    world = run(world, 1_200);
    expect(world.actors[0].meals).toBeGreaterThan(0);
    const unfed = run(scenario(1, [{ bold: 0.9, social: 0, activity: 0.5 }], [{ hunger: 0.9, x: 0.5, y: 0.35 }]), DECISION_STEPS + 1_200);
    expect(world.actors[0].hunger).toBeLessThan(unfed.actors[0].hunger);
    world = run(world, 800);
    expect(world.pellets).toHaveLength(0);
    expect(world.actors[0].state).not.toBe('eat');
  });

  it('forages toward the bottom when hungry without food', () => {
    let world = run(scenario(1, [{ bold: 0.5, social: 0, activity: 0.3 }], [{ hunger: 0.95, x: 0.5, y: 0.3 }]), DECISION_STEPS);
    expect(world.actors[0].state).toBe('forage');
    expect(world.actors[0].reasons & REASONS.hungry).toBeTruthy();
    world = run(world, 400);
    expect(world.actors[0].y).toBeGreaterThan(0.6);
  });

  it('hides near plants after a startle when shy, ignores it when bold, and leaves cover as fear fades', () => {
    const traits = [{ bold: 0.1, social: 0, activity: 0.3 }, { bold: 0.95, social: 0, activity: 0.3 }];
    let world = startle(scenario(2, traits, [{ hunger: 0.1, x: 0.45, y: 0.4 }, { hunger: 0.1, x: 0.6, y: 0.4 }], true), 0.52, 0.4);
    world = run(world, DECISION_STEPS);
    const shy = world.actors[0];
    expect(shy.state).toBe('hide');
    expect([REASONS.startled, REASONS.shy, REASONS.cover].every(flag => shy.reasons & flag)).toBe(true);
    expect(world.actors[1].state).not.toBe('hide');
    const before = coverDistance(shy, true);
    world = run(world, 200);
    expect(coverDistance(world.actors[0], true)).toBeLessThan(before);
    world = run(world, 400);
    expect(world.actors[0].fear).toBe(0);
    expect(world.actors[0].state).not.toBe('hide');
  });

  it('schools behind the boldest neighbor when sociable; a solitary fish cruises', () => {
    const traits = [{ social: 0.9, bold: 0.3, activity: 0.3 }, { social: 0.9, bold: 0.8, activity: 0.3 }, { social: 0.9, bold: 0.5, activity: 0.3 }, { social: 0.05, bold: 0.2, activity: 0.3 }];
    const drives = [{ hunger: 0.1, x: 0.5, y: 0.5 }, { hunger: 0.1, x: 0.56, y: 0.5 }, { hunger: 0.1, x: 0.5, y: 0.56 }, { hunger: 0.1, x: 0.44, y: 0.5 }];
    const world = run(scenario(4, traits, drives), DECISION_STEPS);
    expect(world.actors[0].state).toBe('school');
    expect(world.actors[0].leader).toBe(world.actors[1].id);
    expect(world.actors[0].reasons & REASONS.social).toBeTruthy();
    expect(world.actors[3].state).toBe('cruise');
  });

  it('waits out the dwell time before a voluntary switch, but lets eating interrupt', () => {
    const base = scenario(1, [{ social: 0.9, activity: 0.3, bold: 0.5 }], [{ hunger: 0.1, x: 0.5, y: 0.5 }]);
    const schooling: BehaviorWorld = { ...base, actors: base.actors.map(actor => ({ ...actor, state: 'school', dwell: 0 })) };
    expect(run(schooling, 3 * DECISION_STEPS).actors[0].state).toBe('school');
    expect(run(schooling, 4 * DECISION_STEPS).actors[0].state).toBe('cruise');
    const hungry = feed({ ...schooling, actors: schooling.actors.map(actor => ({ ...actor, hunger: 0.9 })) }, 4);
    expect(run(hungry, DECISION_STEPS).actors[0].state).toBe('eat');
  });

  it('is deterministic, finite and bounded over a long mixed run', () => {
    const start = startle(feed(createBehaviorWorld(founders, true), 12), 0.4, 0.6);
    const a = run(start, 2_000), b = run(start, 2_000);
    expect(a).toEqual(b);
    for (const actor of a.actors) {
      expect([actor.x, actor.y, actor.vx, actor.vy, actor.hunger, actor.fear].every(Number.isFinite)).toBe(true);
      expect(actor.x).toBeGreaterThanOrEqual(0.08); expect(actor.x).toBeLessThanOrEqual(0.92);
      expect(actor.y).toBeGreaterThanOrEqual(0.12); expect(actor.y).toBeLessThanOrEqual(0.88);
      expect(BEHAVIOR_STATES).toContain(actor.state);
      expect(Math.min(actor.hunger, actor.fear)).toBeGreaterThanOrEqual(0);
      expect(Math.max(actor.hunger, actor.fear)).toBeLessThanOrEqual(1);
    }
  });

  it('keeps drives when fish are synchronized and describes behavior with its reasons', () => {
    let world = run(createBehaviorWorld(founders.slice(0, 3)), 100);
    const hunger = world.actors[1].hunger;
    world = synchronizeActors(world, [founders[1], founders[4]]);
    expect(world.actors.map(actor => actor.id)).toEqual([founders[1].id, founders[4].id]);
    expect(world.actors[0].hunger).toBe(hunger);
    const names = (id: string) => founders.find(member => member.id === id)?.name ?? id;
    expect(describeBehavior({ state: 'school', reasons: REASONS.social, leaderId: founders[1].id }, names)).toBe('Schooling · following Sumi · high sociability');
    expect(describeBehavior({ state: 'hide', reasons: REASONS.startled | REASONS.shy | REASONS.cover, leaderId: null }, names)).toBe('Hiding · startled · low boldness · near plants');
    expect(describeBehavior({ state: 'eat', reasons: REASONS.food | REASONS.hungry, leaderId: null }, names)).toBe('Eating · hungry · food nearby');
    expect(describeBehavior({ state: 'cruise', reasons: 0, leaderId: null }, names)).toBe('Cruising');
  });
});
