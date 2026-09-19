import { AXOLOTL_TAIL_WAVE, type AxolotlAnatomy, type AxolotlGill, type AxolotlLimb, type AxolotlVec } from './axolotlAnatomy';

/** Transient display pose; never changes phenotype, genome or persistent life state. */
export type AxolotlMotion = { tailPhase: number; limbPhase: number; effort: number; grounded?: number };
const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

export function axolotlPose(a: AxolotlAnatomy, time: number, seed: number, motion?: AxolotlMotion) {
  const t = Number.isFinite(time) ? time : 0;
  const phase = motion && Number.isFinite(motion.tailPhase) ? motion.tailPhase : t * 1.8 + (seed >>> 0) % 31;
  const gait = motion && Number.isFinite(motion.limbPhase) ? motion.limbPhase : t * 1.1;
  const effort = motion ? clamp(motion.effort) : 0.3;
  const grounded = clamp(motion?.grounded ?? 0);
  const breath = Math.sin(t * 2.1 + (seed >>> 0) % 17);
  const point = (v: AxolotlVec): AxolotlVec => {
    const u = clamp((v.x - 0.18) / (a.top.at(-1)!.x - 0.18));
    const wave = Math.sin(phase - u * 3.4) * AXOLOTL_TAIL_WAVE * u * u
      * (0.30 + a.shape.tailWave * 0.7) * (0.2 + effort * 0.8) * (1 - grounded * 0.55);
    const chest = Math.exp(-(((v.x + 0.1) / 0.35) ** 2));
    return { x: v.x, y: v.y * (1 + breath * 0.018 * chest) + wave };
  };
  const limb = (l: AxolotlLimb): AxolotlLimb => {
    // Diagonal limbs alternate; while swimming, elbows and hands sweep gently aft.
    const phaseOffset = (l.kind === 'hind' ? Math.PI : 0) + (l.side === 'far' ? Math.PI : 0);
    const cycle = gait + phaseOffset;
    const stride = (0.012 + grounded * 0.042) * Math.min(1, effort * 3);
    const dx = Math.cos(cycle) * stride + (1 - grounded) * effort * 0.032;
    const dy = -Math.max(0, Math.sin(cycle)) * stride * 0.5;
    const shift = (v: AxolotlVec) => ({ x: v.x + dx, y: v.y + dy });
    return { ...l, joint: { x: l.joint.x + dx * 0.45, y: l.joint.y + dy * 0.5 }, hand: shift(l.hand),
      toes: l.toes.map(toe => ({ start: shift(toe.start), control: shift(toe.control), end: shift(toe.end) })) };
  };
  const gill = (g: AxolotlGill): AxolotlGill => {
    const sway = Math.sin(t * 1.55 + g.index * 0.7 + (g.side === 'far' ? 0.8 : 0) + (seed >>> 0) % 13) * 0.025;
    const ventilate = Math.pow(Math.max(0, Math.sin(t * 0.65 + (seed >>> 0) % 11)), 12) * 0.022;
    const move = (v: AxolotlVec) => {
      const distance = clamp(Math.hypot(v.x - g.stalk.start.x, v.y - g.stalk.start.y) / 0.4);
      return { x: v.x + (sway + ventilate) * distance, y: v.y + breath * 0.006 * distance };
    };
    const curve = (c: AxolotlGill['stalk']) => ({ start: move(c.start), control: move(c.control), end: move(c.end) });
    return { ...g, stalk: curve(g.stalk), fronds: g.fronds.map(curve) };
  };
  return { point, limb, gill, breath };
}
