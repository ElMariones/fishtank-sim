import { hash, random } from '../core/random';
import {
  AXOLOTL_TAIL_WAVE,
  axolotlAnatomyFor,
  type AxolotlAnatomy,
  type AxolotlCurve,
  type AxolotlGill,
  type AxolotlLimb,
  type AxolotlShape,
  type AxolotlShapeInput,
  type AxolotlPattern,
  type AxolotlVec,
} from '../core/axolotlAnatomy';

/** Optional live locomotion. Portraits can omit it and use deterministic idle motion from `time`. */
export type AxolotlSwimMotion = { tailPhase: number; limbPhase: number; effort: number };

const finite = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback;
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

function bodyPath(ctx: CanvasRenderingContext2D, a: AxolotlAnatomy, at: (v: AxolotlVec) => [number, number]) {
  ctx.beginPath();
  ctx.moveTo(...at(a.top[0]));
  for (let i = 1; i < a.top.length; i++) ctx.lineTo(...at(a.top[i]));
  for (let i = a.bottom.length - 1; i >= 0; i--) ctx.lineTo(...at(a.bottom[i]));
  ctx.closePath();
}

function polygon(ctx: CanvasRenderingContext2D, points: readonly AxolotlVec[], at: (v: AxolotlVec) => [number, number]) {
  if (!points.length) return;
  ctx.beginPath(); ctx.moveTo(...at(points[0]));
  for (let i = 1; i < points.length; i++) ctx.lineTo(...at(points[i]));
  ctx.closePath();
}

function curve(ctx: CanvasRenderingContext2D, c: AxolotlCurve, at: (v: AxolotlVec) => [number, number]) {
  ctx.beginPath(); ctx.moveTo(...at(c.start)); ctx.quadraticCurveTo(...at(c.control), ...at(c.end)); ctx.stroke();
}

function drawLimb(ctx: CanvasRenderingContext2D, limb: AxolotlLimb, at: (v: AxolotlVec) => [number, number], scale: number, color: string, phase: number) {
  const near = limb.side === 'near';
  const wiggle = Math.sin(phase + (limb.kind === 'hind' ? 1.7 : 0) + (near ? 0 : 0.9)) * 0.012;
  const joint = { x: limb.joint.x + wiggle * 0.4, y: limb.joint.y + wiggle };
  const hand = { x: limb.hand.x + wiggle, y: limb.hand.y - wiggle * 0.25 };
  ctx.save();
  ctx.globalAlpha = near ? 0.96 : 0.42;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(0.75, limb.width * scale);
  ctx.beginPath(); ctx.moveTo(...at(limb.root)); ctx.quadraticCurveTo(...at(joint), ...at(hand)); ctx.stroke();
  ctx.lineWidth = Math.max(0.45, limb.width * scale * 0.34);
  for (const toe of limb.toes) {
    const dx = hand.x - limb.hand.x, dy = hand.y - limb.hand.y;
    curve(ctx, {
      start: hand,
      control: { x: toe.control.x + dx, y: toe.control.y + dy },
      end: { x: toe.end.x + dx, y: toe.end.y + dy },
    }, at);
  }
  ctx.restore();
}

function drawGill(ctx: CanvasRenderingContext2D, gill: AxolotlGill, at: (v: AxolotlVec) => [number, number], scale: number, color: string) {
  ctx.save();
  ctx.globalAlpha = gill.side === 'near' ? 0.95 : 0.38;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(0.6, gill.width * scale);
  curve(ctx, gill.stalk, at);
  ctx.lineWidth = Math.max(0.35, gill.width * scale * 0.28);
  for (const frond of gill.fronds) curve(ctx, frond, at);
  ctx.restore();
}

function drawPatternMode(
  ctx: CanvasRenderingContext2D,
  p: AxolotlShape,
  mode: AxolotlPattern,
  seed: number,
  alphaScale: number,
  l: number,
  at: (v: AxolotlVec) => [number, number],
) {
  if (mode === 'solid' || p.patternStrength <= 0.005) return;
  const rng = random(hash(`axolotl-pattern:${p.patternSeed}:${seed}:${mode}`));
  const alpha = (0.12 + p.patternStrength * 0.72) * alphaScale;
  const scale = 0.55 + p.patternScale * 1.1;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = alphaScale < 1 ? p.accentColor : p.secondaryColor;
  ctx.strokeStyle = p.accentColor;
  ctx.lineWidth = Math.max(0.35, l * (0.002 + p.patternEdge * 0.003));

  const ellipse = (x: number, y: number, rx: number, ry: number, angle: number) => {
    const [px, py] = at({ x, y });
    ctx.beginPath(); ctx.ellipse(px, py, rx * l * scale, ry * l * scale, angle, 0, Math.PI * 2); ctx.fill();
    if (p.patternEdge > 0.58) { ctx.globalAlpha = alpha * p.patternEdge * 0.62; ctx.stroke(); ctx.globalAlpha = alpha; }
  };
  const place = (x: number, y: number, rx: number, ry: number, angle: number) => {
    ellipse(x, y, rx, ry, angle);
    if (p.patternSymmetry > 0.7 && Math.abs(y) > 0.018 && rng() < (p.patternSymmetry - 0.7) / 0.3) ellipse(x + (rng() - 0.5) * 0.015, -y, rx * 0.92, ry * 0.92, -angle);
  };

  if (mode === 'speckled' || mode === 'freckled' || mode === 'spotted') {
    const dense = mode === 'freckled', spotted = mode === 'spotted';
    const count = Math.round((dense ? 18 : spotted ? 8 : 11) + p.speckleDensity * (dense ? 52 : spotted ? 24 : 34));
    for (let i = 0; i < count; i++) {
      const x = -0.55 + rng() * 1.68, y = (rng() - 0.5) * (0.12 + p.bodyDepth * 0.16);
      const r = (dense ? 0.005 : spotted ? 0.022 : 0.009) + rng() * (dense ? 0.013 : spotted ? 0.034 : 0.022);
      place(x, y, r * (0.72 + rng() * 0.58), r, rng() * Math.PI);
    }
  } else if (mode === 'mottled' || mode === 'piebald' || mode === 'dappled' || mode === 'marbled') {
    const piebald = mode === 'piebald', dappled = mode === 'dappled', marbled = mode === 'marbled';
    const count = piebald ? 7 : marbled ? 14 : dappled ? 9 : 11;
    for (let i = 0; i < count; i++) {
      const x = -0.47 + rng() * 1.48, y = (rng() - 0.5) * (0.08 + p.bodyDepth * 0.17);
      const rx = (piebald ? 0.075 : marbled ? 0.05 : dappled ? 0.06 : 0.035) + rng() * (piebald ? 0.12 : marbled ? 0.11 : 0.075);
      const aspect = marbled ? 0.2 + rng() * 0.28 : 0.42 + rng() * 0.55;
      place(x, y, rx, rx * aspect, (rng() - 0.5) * (marbled ? 2.2 : 1.15));
    }
  } else if (mode === 'saddled') {
    const count = 4 + Math.round(p.speckleDensity * 2);
    for (let i = 0; i < count; i++) {
      const t = (i + 0.65) / (count + 0.3), x = -0.2 + t * 1.12;
      place(x, -0.035 + (rng() - 0.5) * 0.035, 0.055 + rng() * 0.035, 0.15 + p.bodyDepth * 0.07, (rng() - 0.5) * 0.3);
    }
  }
  ctx.restore();
}

function drawPattern(ctx: CanvasRenderingContext2D, p: AxolotlShape, seed: number, l: number, at: (v: AxolotlVec) => [number, number]) {
  drawPatternMode(ctx, p, p.pattern, seed, 1, l, at);
  if (p.patternSecondary && p.patternSecondary !== p.pattern) drawPatternMode(ctx, p, p.patternSecondary, seed ^ 0x51f15e, 0.55, l, at);
}

function drawIridophores(ctx: CanvasRenderingContext2D, p: AxolotlShape, seed: number, time: number, l: number, at: (v: AxolotlVec) => [number, number]) {
  if (p.iridophore <= 0.01) return;
  const rng = random(hash(`axolotl-iridophore:${seed}`));
  const count = 4 + Math.round(p.iridophore * 28);
  ctx.save();
  ctx.fillStyle = '#fff8d5';
  for (let i = 0; i < count; i++) {
    const x = -0.5 + rng() * 1.55, y = (rng() - 0.5) * (0.11 + p.bodyDepth * 0.13);
    const [px, py] = at({ x, y });
    const r = l * (0.0035 + rng() * 0.0045);
    ctx.globalAlpha = p.iridophore * (0.2 + 0.55 * Math.abs(Math.sin(time * 1.4 + i * 1.71 + seed * 0.001)));
    ctx.beginPath();
    ctx.moveTo(px, py - r * 1.7); ctx.lineTo(px + r * 0.38, py - r * 0.38); ctx.lineTo(px + r * 1.7, py);
    ctx.lineTo(px + r * 0.38, py + r * 0.38); ctx.lineTo(px, py + r * 1.7); ctx.lineTo(px - r * 0.38, py + r * 0.38);
    ctx.lineTo(px - r * 1.7, py); ctx.lineTo(px - r * 0.38, py - r * 0.38); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

/**
 * Procedural side-profile axolotl. It consumes only the species-local `AxolotlShape` contract and seeded visual noise,
 * making it callable from a future shared species dispatch without modifying koi anatomy or renderer semantics.
 */
export function drawAxolotl(
  ctx: CanvasRenderingContext2D,
  input: AxolotlShapeInput,
  seed: number,
  size: number,
  time = 0,
  motion?: AxolotlSwimMotion,
) {
  const a = axolotlAnatomyFor(input), p = a.shape;
  const safeSize = clamp(Math.abs(finite(size, 1)), 0.01, 10000);
  const l = safeSize * p.length;
  const safeTime = finite(time, 0);
  const phase = motion ? finite(motion.tailPhase, 0) : safeTime * 2.05 + (seed >>> 0) % 31;
  const effort = motion ? clamp(finite(motion.effort, 0.5)) : 0.62;
  const tailWave = Math.sin(phase) * AXOLOTL_TAIL_WAVE * (0.45 + p.tailWave * 0.55) * (0.7 + effort * 0.3);
  const limbPhase = motion ? finite(motion.limbPhase, phase * 0.45) : phase * 0.45;
  const tailStart = 0.32, tailEnd = Math.max(tailStart + 0.1, a.bounds.maxX - 0.03);
  const moved = (v: AxolotlVec): AxolotlVec => {
    if (v.x <= tailStart) return v;
    const t = clamp((v.x - tailStart) / (tailEnd - tailStart));
    return { x: v.x, y: v.y + tailWave * t * t };
  };
  const at = (v: AxolotlVec): [number, number] => { const q = moved(v); return [q.x * l, q.y * l]; };

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Far appendages establish the unmistakable salamander silhouette before the torso is laid over their roots.
  for (const g of a.gills.filter(g => g.side === 'far')) drawGill(ctx, g, at, l, p.gillColor);
  for (const limb of a.limbs.filter(limb => limb.side === 'far')) drawLimb(ctx, limb, at, l, p.secondaryColor, limbPhase);

  // The dorsal/caudal membrane is thin and translucent, continuous almost to the tail tip.
  ctx.save();
  ctx.globalAlpha = 0.48 + (1 - p.translucency) * 0.2;
  ctx.fillStyle = p.secondaryColor;
  ctx.strokeStyle = p.accentColor;
  ctx.lineWidth = Math.max(0.5, l * 0.008);
  polygon(ctx, a.dorsalFin, at); ctx.fill(); ctx.stroke();
  polygon(ctx, a.ventralFin, at); ctx.fill(); ctx.stroke();
  ctx.restore();

  bodyPath(ctx, a, at);
  const bodyGradient = ctx.createLinearGradient(0, a.bounds.minY * l, 0, a.bounds.maxY * l);
  bodyGradient.addColorStop(0, p.baseColor);
  bodyGradient.addColorStop(0.62, p.baseColor);
  bodyGradient.addColorStop(1, p.secondaryColor);
  ctx.globalAlpha = 0.88 + (1 - p.translucency) * 0.12;
  ctx.fillStyle = bodyGradient;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = p.accentColor;
  ctx.lineWidth = Math.max(0.55, l * (0.006 + p.melanin * 0.004));
  ctx.stroke();

  // Pigment and iridophores are clipped to the muscular body/tail, independent of anatomy generation.
  ctx.save();
  bodyPath(ctx, a, at); ctx.clip();
  drawPattern(ctx, p, seed, l, at);
  drawIridophores(ctx, p, seed, safeTime, l, at);
  if (p.texture > 0.05) {
    ctx.globalAlpha = 0.05 + p.texture * 0.09;
    ctx.strokeStyle = p.accentColor;
    ctx.lineWidth = Math.max(0.35, l * 0.003);
    for (let i = 0; i < 5; i++) {
      const y = (-0.055 + i * 0.027) * l;
      ctx.beginPath(); ctx.moveTo(-0.08 * l, y); ctx.quadraticCurveTo(0.48 * l, y - 0.018 * l, 1.02 * l, y + 0.008 * l); ctx.stroke();
    }
  }
  const sheen = ctx.createLinearGradient(0, -0.25 * l, 0, 0.12 * l);
  sheen.addColorStop(0, `rgba(255,255,255,${0.08 + (1 - p.melanin) * 0.1 + p.skinLuster * 0.16})`);
  sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
  sheen.addColorStop(1, 'rgba(20,15,18,0.12)');
  ctx.globalAlpha = 1; ctx.fillStyle = sheen;
  ctx.fillRect(a.bounds.minX * l, a.bounds.minY * l, (a.bounds.maxX - a.bounds.minX) * l, (a.bounds.maxY - a.bounds.minY) * l);
  ctx.restore();

  for (const limb of a.limbs.filter(limb => limb.side === 'near')) drawLimb(ctx, limb, at, l, p.baseColor, limbPhase);
  for (const g of a.gills.filter(g => g.side === 'near')) drawGill(ctx, g, at, l, p.gillColor);

  // Eye and gentle mouth curve keep the broad head readable even on dark/melanoid-like palettes.
  const [eyeX, eyeY] = at(a.eye.center), eyeR = a.eye.radius * l;
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = p.eyeColor; ctx.beginPath(); ctx.arc(eyeX, eyeY, eyeR, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0b090a'; ctx.beginPath(); ctx.arc(eyeX - eyeR * 0.08, eyeY, a.eye.pupilRadius * l, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.7; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(eyeX - eyeR * 0.28, eyeY - eyeR * 0.3, eyeR * 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.62 + p.melanin * 0.28;
  ctx.strokeStyle = p.accentColor;
  ctx.lineWidth = Math.max(0.55, l * 0.006);
  curve(ctx, a.mouth, at);
  ctx.restore();
}
