import { express } from '../core/genetics';
import { clamp, hash, random } from '../core/random';
import type { Fish, Phenotype } from '../core/types';

export type Actor = { id: string; x: number; y: number; vx: number; vy: number; phase: number; phenotype: Phenotype };
export type Food = { x: number; y: number; remaining: number };

export function createActor(fish: Fish): Actor {
  const rng = random(hash(fish.id));
  return { id: fish.id, x: 0.18 + rng() * 0.64, y: 0.25 + rng() * 0.5, vx: rng() < 0.5 ? -0.03 : 0.03, vy: 0, phase: rng() * Math.PI * 2, phenotype: express(fish.genome) };
}

/** Fixed 50 ms visual motion. This does not advance age, health, or authoritative game time. */
export function stepMotion(actors: Actor[], time: number, food: Food | null, dt = 0.05): Actor[] {
  return actors.map(actor => {
    const p = actor.phenotype;
    let ax = Math.cos(time * 0.17 + actor.phase) * 0.016;
    let ay = Math.sin(time * 0.3 + actor.phase) * 0.012;
    if (food && food.remaining > 0) {
      const dx = food.x - actor.x, dy = food.y - actor.y;
      const distance = Math.max(0.08, Math.hypot(dx, dy));
      ax += dx / distance * (0.025 + p.bold * 0.05);
      ay += dy / distance * (0.025 + p.bold * 0.05);
    } else {
      for (const other of actors) {
        if (other.id === actor.id) continue;
        const dx = other.x - actor.x, dy = other.y - actor.y, distance = Math.hypot(dx, dy);
        if (distance < 0.08) { ax -= dx * 0.7; ay -= dy * 0.7; }
        else if (distance < 0.22) { ax += dx * p.social * 0.018; ay += dy * p.social * 0.018; }
      }
    }
    if (actor.x < 0.15) ax += (0.15 - actor.x) * 1.4;
    if (actor.x > 0.85) ax -= (actor.x - 0.85) * 1.4;
    if (actor.y < 0.18) ay += (0.18 - actor.y) * 0.8;
    if (actor.y > 0.83) ay -= (actor.y - 0.83) * 0.8;
    let vx = actor.vx + ax * dt * p.turning, vy = actor.vy + ay * dt * p.turning;
    const maxSpeed = p.speed * (0.7 + p.activity * 0.6) * (food ? 1.3 : 1);
    const speed = Math.hypot(vx, vy);
    if (speed > maxSpeed) { vx *= maxSpeed / speed; vy *= maxSpeed / speed; }
    const x = clamp(actor.x + vx * dt, 0.08, 0.92), y = clamp(actor.y + vy * dt, 0.12, 0.88);
    if (x === 0.08 || x === 0.92) vx = x === 0.08 ? Math.abs(vx) : -Math.abs(vx);
    if (y === 0.12 || y === 0.88) vy = y === 0.12 ? Math.abs(vy) : -Math.abs(vy);
    return { ...actor, x, y, vx, vy };
  });
}
