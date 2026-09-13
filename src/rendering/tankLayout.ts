import { anatomyFor, containsPoint } from '../core/anatomy';
import type { Actor } from '../simulation/motion';

/** One tank transform for drawing and picking, so a click can never disagree with what is drawn. */
export type FishPose = { x: number; y: number; flip: 1 | -1; angle: number; size: number; bodyLength: number };

export function fishPose(actor: Actor, width: number, height: number): FishPose {
  const size = Math.min(width / 10, 79) * (0.8 + actor.phenotype.adultLengthCm / 200);
  return {
    x: actor.x * width, y: actor.y * height, flip: actor.vx > 0 ? -1 : 1,
    angle: Math.atan2(actor.vy, Math.max(Math.abs(actor.vx), 0.01)) * (actor.vx > 0 ? -0.3 : 0.3),
    size, bodyLength: size * actor.phenotype.length,
  };
}

/** Inverse of translate(x, y) → scale(flip, 1) → rotate(angle), returned in body lengths. */
export function toBodySpace(pose: FishPose, px: number, py: number) {
  const dx = (px - pose.x) * pose.flip, dy = py - pose.y;
  const cos = Math.cos(pose.angle), sin = Math.sin(pose.angle);
  return { x: (dx * cos + dy * sin) / pose.bodyLength, y: (-dx * sin + dy * cos) / pose.bodyLength };
}

/** Fish-shaped hit test. Later actors are drawn on top, so they win overlaps. */
export function pickActor(actors: readonly Actor[], width: number, height: number, px: number, py: number, slopPixels = 6): string | null {
  for (let i = actors.length - 1; i >= 0; i--) {
    const pose = fishPose(actors[i], width, height), local = toBodySpace(pose, px, py);
    if (containsPoint(anatomyFor(actors[i].phenotype), local.x, local.y, slopPixels / pose.bodyLength)) return actors[i].id;
  }
  return null;
}
