import type { Point } from './spatial';

/** Normalized tank coordinates shared by Canvas and steering. Cover is permeable; rocks are solid. */
export type Footprint = Point & { id: string; radius: number; kind: 'cover' | 'rock' };
const PLANTED: readonly Footprint[] = [
  { id: 'left-plants', kind: 'cover', x: 0.13, y: 0.8, radius: 0.09 },
  { id: 'right-plants', kind: 'cover', x: 0.87, y: 0.8, radius: 0.09 },
  { id: 'left-rock', kind: 'rock', x: 0.3, y: 0.76, radius: 0.055 },
  { id: 'right-rock', kind: 'rock', x: 0.7, y: 0.76, radius: 0.055 },
];
export const habitatFootprints = (planted: boolean): readonly Footprint[] => planted ? PLANTED : [];
/** Conservative visual body-center clearance, not anatomy collision physics. Fins may overlap at extreme shapes. */
export const BODY_CLEARANCE = 0.045;

export function obstacleForce(point: Point, velocity: Point, rocks: readonly Footprint[]): Point {
  let x = 0, y = 0;
  for (const rock of rocks) {
    const dx = point.x + velocity.x * 0.8 - rock.x, dy = point.y + velocity.y * 0.8 - rock.y;
    const distance = Math.hypot(dx, dy), reach = rock.radius + BODY_CLEARANCE + 0.07;
    if (distance >= reach) continue;
    const nx = distance > 1e-9 ? dx / distance : 0, ny = distance > 1e-9 ? dy / distance : -1;
    const strength = (1 - distance / reach) * 0.35;
    x += nx * strength; y += ny * strength;
  }
  return { x, y };
}

/** Resolve initial overlap and a step into a solid footprint; discard inward velocity, retain tangential movement. */
export function resolveObstacles(point: Point, velocity: Point, rocks: readonly Footprint[]) {
  let { x, y } = point, vx = velocity.x, vy = velocity.y;
  for (const rock of rocks) {
    const dx = x - rock.x, dy = y - rock.y, distance = Math.hypot(dx, dy), radius = rock.radius + BODY_CLEARANCE;
    if (distance >= radius) continue;
    const nx = distance > 1e-9 ? dx / distance : 0, ny = distance > 1e-9 ? dy / distance : -1;
    x = rock.x + nx * radius; y = rock.y + ny * radius;
    const inward = Math.min(0, vx * nx + vy * ny);
    vx -= inward * nx; vy -= inward * ny;
  }
  return { x, y, vx, vy };
}
