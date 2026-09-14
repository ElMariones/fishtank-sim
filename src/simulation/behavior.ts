import { clamp, hash, random } from '../core/random';
import type { Fish } from '../core/types';
import { createActor, type Actor } from './motion';
import { SpatialHash } from './spatial';
import { habitatFootprints, obstacleForce, resolveObstacles } from './footprints';

/**
 * Behavior model v2 (FS-303/304). A utility system chooses each fish's desire (cruise, forage, eat, hide or school), then
 * steering pursues it. Hunger and fear are transient drives in the motion worker: they are never saved and never change
 * growth or condition, which belong to the persistent world. Every step is seeded and deterministic for the same inputs.
 */
export const BEHAVIOR_MODEL = 2;
export const STEP_SECONDS = 0.05;
/** Utilities are re-evaluated every half second. */
export const DECISION_STEPS = 10;
/** A voluntary switch waits this many steps; eating and hiding may interrupt sooner. */
export const MIN_DWELL_STEPS = 30;
export const NEIGHBOR_RADIUS = 0.22;
export const SEPARATION_RADIUS = 0.08;
export const EAT_RADIUS = 0.035;
export const STARTLE_RADIUS = 0.35;
export const BOTTOM_Y = 0.84;
/** Hunger drive gained per second at metabolism 1, and removed by one pellet. */
export const HUNGER_PER_SECOND = 0.012;
export const PELLET_MEAL = 0.3;
/** Fear lost per second after a startle. */
export const FEAR_DECAY_PER_SECOND = 0.15;

export type BehaviorState = 'cruise' | 'forage' | 'eat' | 'hide' | 'school';
export const BEHAVIOR_STATES: readonly BehaviorState[] = ['cruise', 'forage', 'eat', 'hide', 'school'];
/** Reason flags combined as a bitmask, so frames can carry them compactly. */
export const REASONS = { hungry: 1, food: 2, bold: 4, shy: 8, startled: 16, cover: 32, social: 64, active: 128 } as const;

export type BehaviorActor = Actor & {
  state: BehaviorState; reasons: number; leader: string | null;
  hunger: number; fear: number; dwell: number; meals: number;
};
export type Pellet = { x: number; y: number; settled: number };
export type BehaviorWorld = { actors: BehaviorActor[]; pellets: Pellet[]; planted: boolean; step: number; feeds: number };
export type BehaviorSummary = { state: BehaviorState; reasons: number; leaderId: string | null };

export function createBehaviorActor(fish: Fish): BehaviorActor {
  const rng = random(hash(`behavior-v1:${fish.id}`));
  return { ...createActor(fish), state: 'cruise', reasons: 0, leader: null, hunger: 0.2 + rng() * 0.4, fear: 0, dwell: MIN_DWELL_STEPS, meals: 0 };
}

export function createBehaviorWorld(fish: readonly Fish[], planted = false): BehaviorWorld {
  return { actors: fish.map(createBehaviorActor), pellets: [], planted, step: 0, feeds: 0 };
}

/** Existing fish keep their position and drives; newcomers get a fresh actor. */
export function synchronizeActors(world: BehaviorWorld, fish: readonly Fish[]): BehaviorWorld {
  const existing = new Map(world.actors.map(actor => [actor.id, actor]));
  return { ...world, actors: fish.map(member => existing.get(member.id) ?? createBehaviorActor(member)) };
}

/** A deterministic spread of sinking pellets near the surface. Visual only: nutrition and water effects arrive in FS-305. */
export function feed(world: BehaviorWorld, count = 18): BehaviorWorld {
  const rng = random(hash(`pellets-v1:${world.feeds}`));
  const pellets = Array.from({ length: count }, () => ({ x: 0.3 + rng() * 0.4, y: 0.14 + rng() * 0.06, settled: 0 }));
  return { ...world, pellets: [...world.pellets, ...pellets].slice(-80), feeds: world.feeds + 1 };
}

/** A tap on the glass: nearby fish grow afraid in proportion to closeness and shyness, and reconsider at once. */
export function startle(world: BehaviorWorld, x: number, y: number): BehaviorWorld {
  return {
    ...world,
    actors: world.actors.map(actor => {
      const distance = Math.hypot(actor.x - x, actor.y - y);
      if (distance > STARTLE_RADIUS) return actor;
      const fear = clamp((1 - distance / STARTLE_RADIUS * 0.5) * (1.2 - actor.phenotype.bold));
      return { ...actor, fear: Math.max(actor.fear, fear), dwell: MIN_DWELL_STEPS };
    }),
  };
}

/** Plants along the lower edges give cover; an open tank only offers its bottom corners, which count for less. */
export const coverPoints = (planted: boolean) => planted ? habitatFootprints(true).filter(f => f.kind === 'cover') : [{ x: 0.12, y: 0.86 }, { x: 0.88, y: 0.86 }];

type Choice = { state: BehaviorState; score: number; reasons: number; leader: string | null };

/** Utility scores for one fish; the current state gets a small stickiness bonus, and ties keep declaration order. */
export function chooseBehavior(actor: BehaviorActor, world: BehaviorWorld, nearby: readonly BehaviorActor[] = world.actors): Choice {
  const p = actor.phenotype, food = world.pellets.length > 0;
  let neighbors = 0, leader: BehaviorActor | null = null;
  for (const other of nearby) {
    if (other.id === actor.id || Math.hypot(other.x - actor.x, other.y - actor.y) > NEIGHBOR_RADIUS) continue;
    neighbors++;
    if (!leader || other.phenotype.bold > leader.phenotype.bold || (other.phenotype.bold === leader.phenotype.bold && other.id < leader.id)) leader = other;
  }
  const hungry = actor.hunger > 0.5 ? REASONS.hungry : 0;
  const options: Choice[] = [
    { state: 'cruise', score: 0.25 + p.activity * 0.15, reasons: p.activity > 0.6 ? REASONS.active : 0, leader: null },
    { state: 'forage', score: food ? 0 : Math.max(0, actor.hunger - 0.35) * 1.2, reasons: REASONS.hungry, leader: null },
    { state: 'eat', score: food ? (0.35 + actor.hunger * 0.8) * (0.6 + p.bold * 0.4) * (1 - actor.fear * 0.8) : 0, reasons: REASONS.food | hungry | (p.bold > 0.6 ? REASONS.bold : 0), leader: null },
    { state: 'hide', score: actor.fear * (1.1 - p.bold) * (world.planted ? 1 : 0.6), reasons: REASONS.startled | (p.bold < 0.4 ? REASONS.shy : 0) | (world.planted ? REASONS.cover : 0), leader: null },
    { state: 'school', score: leader ? p.social * Math.min(1, neighbors / 3) * 0.8 : 0, reasons: p.social > 0.5 ? REASONS.social : 0, leader: leader?.id ?? null },
  ];
  for (const option of options) if (option.state === actor.state) option.score += 0.1;
  return options.reduce((best, option) => option.score > best.score ? option : best);
}

/** One 50 ms step: pellets sink and dissolve, drives change, desires are reconsidered every half second, and steering follows. */
export function stepBehavior(world: BehaviorWorld): BehaviorWorld {
  const step = world.step + 1, time = step * STEP_SECONDS, decide = step % DECISION_STEPS === 0;
  let pellets = world.pellets
    .map(pellet => pellet.y < BOTTOM_Y ? { ...pellet, y: Math.min(BOTTOM_Y, pellet.y + 0.035 * STEP_SECONDS) } : { ...pellet, settled: pellet.settled + STEP_SECONDS })
    .filter(pellet => pellet.settled < 20);
  const context: BehaviorWorld = { ...world, pellets }, eaten = new Set<number>();
  const spatial = new SpatialHash(world.actors, NEIGHBOR_RADIUS);
  const byId = new Map(world.actors.map(actor => [actor.id, actor]));
  const rocks = habitatFootprints(world.planted).filter(f => f.kind === 'rock');
  const actors = world.actors.map(actor => {
    const nearby = spatial.query(actor, NEIGHBOR_RADIUS);
    const p = actor.phenotype;
    let { state, reasons, leader, dwell, meals } = actor;
    let hunger = clamp(actor.hunger + STEP_SECONDS * HUNGER_PER_SECOND * p.metabolism);
    const fear = Math.max(0, actor.fear - STEP_SECONDS * FEAR_DECAY_PER_SECOND);
    if (decide) {
      const choice = chooseBehavior({ ...actor, hunger, fear }, context, nearby);
      if (choice.state === state) ({ reasons, leader } = choice);
      else if (dwell >= MIN_DWELL_STEPS || choice.state === 'eat' || choice.state === 'hide') {
        ({ state, reasons, leader } = choice);
        dwell = 0;
      }
    }
    dwell++;
    let ax = Math.cos(time * 0.17 + actor.phase) * 0.016, ay = Math.sin(time * 0.3 + actor.phase) * 0.012, speedScale = 1;
    const seek = (x: number, y: number, strength: number) => {
      const dx = x - actor.x, dy = y - actor.y, distance = Math.max(0.05, Math.hypot(dx, dy));
      ax += dx / distance * strength; ay += dy / distance * strength;
    };
    if (state === 'eat') {
      let nearest = -1, best = Infinity;
      pellets.forEach((pellet, index) => {
        const distance = Math.hypot(pellet.x - actor.x, pellet.y - actor.y);
        if (!eaten.has(index) && distance < best) { best = distance; nearest = index; }
      });
      if (nearest >= 0) {
        seek(pellets[nearest].x, pellets[nearest].y, 0.03 + p.bold * 0.05);
        speedScale = 1.3;
        if (best < EAT_RADIUS) { eaten.add(nearest); hunger = Math.max(0, hunger - PELLET_MEAL); meals++; }
      }
    } else if (state === 'forage') {
      seek(actor.x + Math.cos(time * 0.4 + actor.phase) * 0.2, BOTTOM_Y - 0.04, 0.025);
      speedScale = 0.75;
    } else if (state === 'hide') {
      const cover = coverPoints(world.planted).reduce((a, b) => Math.hypot(a.x - actor.x, a.y - actor.y) <= Math.hypot(b.x - actor.x, b.y - actor.y) ? a : b);
      seek(cover.x, cover.y, 0.06);
      speedScale = fear > 0.5 ? 1.35 : 0.8;
    } else if (state === 'school') {
      const guide = leader ? byId.get(leader) : undefined;
      if (guide) {
        seek(guide.x - guide.vx * 2, guide.y - guide.vy * 2, 0.02 + p.social * 0.03);
        ax += (guide.vx - actor.vx) * 0.4; ay += (guide.vy - actor.vy) * 0.4;
      }
    }
    for (const other of nearby) {
      if (other.id === actor.id) continue;
      const dx = other.x - actor.x, dy = other.y - actor.y, distance = Math.hypot(dx, dy);
      if (distance < SEPARATION_RADIUS) { ax -= dx * 0.7; ay -= dy * 0.7; }
      else if (state === 'cruise' && distance < NEIGHBOR_RADIUS) { ax += dx * p.social * 0.018; ay += dy * p.social * 0.018; }
    }
    if (actor.x < 0.15) ax += (0.15 - actor.x) * 1.4;
    if (actor.x > 0.85) ax -= (actor.x - 0.85) * 1.4;
    if (actor.y < 0.18) ay += (0.18 - actor.y) * 0.8;
    if (actor.y > 0.83) ay -= (actor.y - 0.83) * 0.8;
    const avoidance = obstacleForce(actor, { x: actor.vx, y: actor.vy }, rocks);
    ax += avoidance.x; ay += avoidance.y;
    let vx = actor.vx + ax * STEP_SECONDS * p.turning, vy = actor.vy + ay * STEP_SECONDS * p.turning;
    const maxSpeed = p.speed * (0.7 + p.activity * 0.6) * speedScale, speed = Math.hypot(vx, vy);
    if (speed > maxSpeed) { vx *= maxSpeed / speed; vy *= maxSpeed / speed; }
    const x = clamp(actor.x + vx * STEP_SECONDS, 0.08, 0.92), y = clamp(actor.y + vy * STEP_SECONDS, 0.12, 0.88);
    if (x === 0.08 || x === 0.92) vx = x === 0.08 ? Math.abs(vx) : -Math.abs(vx);
    if (y === 0.12 || y === 0.88) vy = y === 0.12 ? Math.abs(vy) : -Math.abs(vy);
    const resolved = resolveObstacles({ x, y }, { x: vx, y: vy }, rocks);
    return { ...actor, ...resolved, state, reasons, leader, dwell, hunger, fear, meals };
  });
  if (eaten.size) pellets = pellets.filter((_, index) => !eaten.has(index));
  return { ...world, actors, pellets, step };
}

const STATE_LABELS: Record<BehaviorState, string> = { cruise: 'Cruising', forage: 'Foraging', eat: 'Eating', hide: 'Hiding', school: 'Schooling' };
const REASON_LABELS: readonly [number, string][] = [
  [REASONS.hungry, 'hungry'], [REASONS.food, 'food nearby'], [REASONS.startled, 'startled'], [REASONS.shy, 'low boldness'],
  [REASONS.bold, 'high boldness'], [REASONS.cover, 'near plants'], [REASONS.social, 'high sociability'], [REASONS.active, 'high activity'],
];

/** Inspector sentence, for example "Schooling · following Sumi · high sociability". */
export function describeBehavior(summary: BehaviorSummary, nameOf: (id: string) => string): string {
  const parts = [STATE_LABELS[summary.state]];
  if (summary.state === 'school' && summary.leaderId) parts.push(`following ${nameOf(summary.leaderId)}`);
  for (const [flag, text] of REASON_LABELS) if (summary.reasons & flag) parts.push(text);
  return parts.join(' · ');
}
