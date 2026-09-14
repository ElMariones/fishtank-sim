import { describe, expect, it } from 'vitest';
import { createWorld } from '../src/core/world';
import { random } from '../src/core/random';
import { createBehaviorWorld, NEIGHBOR_RADIUS, stepBehavior, chooseBehavior } from '../src/simulation/behavior';
import { BODY_CLEARANCE, habitatFootprints, resolveObstacles } from '../src/simulation/footprints';
import { SpatialHash } from '../src/simulation/spatial';

describe('FS-304 spatial steering', () => {
  it('matches ordered brute-force neighbors across cell boundaries, negative coordinates and coincidences', () => {
    const rng = random(304);
    const points = Array.from({ length: 300 }, (_, id) => ({ id, x: rng() * 2 - 1, y: rng() * 2 - 1 }));
    points.push({ id: 300, x: 0, y: 0 }, { id: 301, x: 0, y: 0 }, { id: 302, x: 0.22, y: 0 });
    const grid = new SpatialHash(points, NEIGHBOR_RADIUS);
    for (const point of points) {
      const near = (other: typeof point) => Math.hypot(other.x - point.x, other.y - point.y) <= NEIGHBOR_RADIUS;
      expect(grid.query(point, NEIGHBOR_RADIUS).filter(near)).toEqual(points.filter(near));
    }
  });

  it('keeps utility decisions identical to a brute-force neighborhood', () => {
    const world = createBehaviorWorld(createWorld('2026-09-14T00:00:00.000Z').fish);
    const grid = new SpatialHash(world.actors, NEIGHBOR_RADIUS);
    for (const actor of world.actors) expect(chooseBehavior(actor, world, grid.query(actor, NEIGHBOR_RADIUS))).toEqual(chooseBehavior(actor, world));
  });

  it('bounds candidate work at constant density as the spatial population grows', () => {
    const visits = (side: number) => {
      const points = Array.from({ length: side * side }, (_, i) => ({ x: (i % side) * 0.1, y: Math.floor(i / side) * 0.1 }));
      const grid = new SpatialHash(points, NEIGHBOR_RADIUS);
      return points.reduce((sum, point) => sum + grid.query(point, NEIGHBOR_RADIUS).length, 0);
    };
    const small = visits(20), large = visits(40);
    expect(large / small).toBeLessThan(5); // 4× population, not the 16× all-pairs cost.
    expect(large).toBeLessThan(1600 * 1600 / 10);
  });

  it('excludes solid footprints for every step, including a fish initially inside a newly enabled rock', () => {
    const fish = createWorld('2026-09-14T00:00:00.000Z').fish;
    let world = createBehaviorWorld(fish, true);
    const rocks = habitatFootprints(true).filter(f => f.kind === 'rock');
    world.actors[0] = { ...world.actors[0], x: rocks[0].x, y: rocks[0].y, vx: 0, vy: 0 };
    for (let i = 0; i < 2000; i++) {
      world = stepBehavior(world);
      for (const actor of world.actors) for (const rock of rocks) {
        expect(Math.hypot(actor.x - rock.x, actor.y - rock.y)).toBeGreaterThanOrEqual(rock.radius + BODY_CLEARANCE - 1e-12);
        expect([actor.x, actor.y, actor.vx, actor.vy].every(Number.isFinite)).toBe(true);
        expect(actor.x).toBeGreaterThanOrEqual(0.08); expect(actor.x).toBeLessThanOrEqual(0.92);
        expect(actor.y).toBeGreaterThanOrEqual(0.12); expect(actor.y).toBeLessThanOrEqual(0.88);
      }
    }
  });

  it('removes inward velocity, preserves tangent movement and leaves permeable cover accessible', () => {
    const rocks = habitatFootprints(true).filter(f => f.kind === 'rock'), rock = rocks[0];
    const resolved = resolveObstacles({ x: rock.x, y: rock.y - 0.02 }, { x: 0.03, y: 0.04 }, rocks);
    expect(resolved.vx).toBe(0.03); expect(resolved.vy).toBe(0);
    const cover = habitatFootprints(true).find(f => f.kind === 'cover')!;
    expect(resolveObstacles(cover, { x: 0, y: 0 }, rocks)).toEqual({ x: cover.x, y: cover.y, vx: 0, vy: 0 });
    expect(habitatFootprints(false)).toEqual([]);
  });
});
