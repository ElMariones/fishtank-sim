import { anatomyFor, containsPoint } from '../core/anatomy';
import { axolotlAnatomyFor, axolotlContainsPoint, axolotlShapeFromPhenotype } from '../core/axolotlAnatomy';
import type { Actor } from '../simulation/motion';

/**
 * One tank transform for drawing and picking, so a click can never disagree with what is drawn. `flip` is the horizontal
 * scale: 1 faces left, −1 faces right, and values between are a fish swinging round side-on (FS-306).
 */
export type FishPose = { x: number; y: number; flip: number; angle: number; size: number; bodyLength: number };

/** Drawn size follows current length (FS-302), with a floor so the smallest fry stay visible and clickable. */
export const visualGrowth = (lengthCm: number, adultLengthCm: number) => Math.max(0.25, Math.min(1, lengthCm / adultLengthCm));
/** Picking treats a nearly edge-on fish as at least this wide, so the inverse transform stays finite. */
export const MIN_PICK_FACING = 0.35;

export const facingFor = (actor: Pick<Actor, 'vx'>) => (actor.vx > 0 ? -1 : 1);

export function fishPose(actor: Actor, width: number, height: number, growth = 1, facing = facingFor(actor)): FishPose {
  const size = Math.min(width / 10, 79) * (0.8 + actor.phenotype.adultLengthCm / 200) * growth;
  const displayLength = actor.phenotype.species === 'axolotl' && actor.phenotype.axolotl
    ? axolotlShapeFromPhenotype(actor.phenotype.axolotl).length : actor.phenotype.length;
  return {
    x: actor.x * width, y: actor.y * height, flip: facing,
    angle: Math.atan2(actor.vy, Math.max(Math.abs(actor.vx), 0.01)) * (facing < 0 ? -0.3 : 0.3),
    size, bodyLength: size * displayLength,
  };
}

/** Inverse of translate(x, y) → scale(flip, 1) → rotate(angle), returned in body lengths. */
export function toBodySpace(pose: FishPose, px: number, py: number) {
  const flip = (pose.flip < 0 ? -1 : 1) * Math.max(Math.abs(pose.flip), MIN_PICK_FACING);
  const dx = (px - pose.x) / flip, dy = py - pose.y;
  const cos = Math.cos(pose.angle), sin = Math.sin(pose.angle);
  return { x: (dx * cos + dy * sin) / pose.bodyLength, y: (-dx * sin + dy * cos) / pose.bodyLength };
}

/** Fish-shaped hit test at each actor's drawn size and facing. Later actors are drawn on top, so they win overlaps. */
export function pickActor(actors: readonly Actor[], width: number, height: number, px: number, py: number, slopPixels = 6,
  growth: (actor: Actor) => number = () => 1, facing: (actor: Actor) => number = facingFor): string | null {
  for (let i = actors.length - 1; i >= 0; i--) {
    const pose = fishPose(actors[i], width, height, growth(actors[i]), facing(actors[i])), local = toBodySpace(pose, px, py);
    const phenotype = actors[i].phenotype;
    const hit = phenotype.species === 'axolotl' && phenotype.axolotl
      ? axolotlContainsPoint(axolotlAnatomyFor(phenotype.axolotl), local, slopPixels / pose.bodyLength)
      : containsPoint(anatomyFor(phenotype), local.x, local.y, slopPixels / pose.bodyLength);
    if (hit) return actors[i].id;
  }
  return null;
}
