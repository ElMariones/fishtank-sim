import { hash, random } from '../core/random';
import { FULL_DETAIL, type Detail } from './lod';
import {
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
import { axolotlPose, type AxolotlMotion } from '../core/axolotlPose';

/** Optional live locomotion. Portraits can omit it and use deterministic idle motion from `time`. */
export type AxolotlSwimMotion = AxolotlMotion;

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

function drawLimb(ctx: CanvasRenderingContext2D, limb: AxolotlLimb, at: (v: AxolotlVec) => [number, number], scale: number, p: AxolotlShape) {
  const near = limb.side === 'near';
  const { joint, hand } = limb;
  ctx.save();
  ctx.globalAlpha = near ? 1 : 0.72;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const normal = (a: AxolotlVec, b: AxolotlVec, width: number) => {
    const length = Math.max(0.001, Math.hypot(b.x-a.x,b.y-a.y));
    return {x: -(b.y-a.y)/length*width, y:(b.x-a.x)/length*width};
  };
  const upper = normal(limb.root, joint, limb.width * 0.6), lower = normal(joint, hand, limb.width * 0.36);
  const offset = (v: AxolotlVec,n: AxolotlVec,s=1) => ({x:v.x+n.x*s,y:v.y+n.y*s});
  ctx.beginPath();ctx.moveTo(...at(offset(limb.root,upper)));
  ctx.quadraticCurveTo(...at(offset(joint,upper)),...at(offset(joint,lower)));
  ctx.lineTo(...at(offset(hand,lower,0.4)));
  ctx.quadraticCurveTo(...at(hand),...at(offset(hand,lower,-0.4)));
  ctx.lineTo(...at(offset(joint,lower,-1)));
  ctx.quadraticCurveTo(...at(offset(joint,upper,-1)),...at(offset(limb.root,upper,-1)));ctx.closePath();
  const flesh=ctx.createLinearGradient(...at(limb.root),...at(hand));
  flesh.addColorStop(0,near?p.baseColor:p.secondaryColor);flesh.addColorStop(0.65,p.secondaryColor);flesh.addColorStop(1,p.baseColor);
  ctx.fillStyle=flesh;ctx.fill();ctx.strokeStyle=p.accentColor;ctx.lineWidth=Math.max(0.3,scale*0.002);ctx.stroke();
  ctx.strokeStyle = 'rgba(255,239,216,0.22)'; ctx.lineWidth = Math.max(0.35,scale*0.004);
  ctx.beginPath();ctx.moveTo(...at(limb.root));ctx.lineTo(...at(joint));ctx.lineTo(...at(hand));ctx.stroke();
  ctx.strokeStyle = near ? p.baseColor : p.secondaryColor;
  ctx.lineWidth = Math.max(0.45, limb.width * scale * 0.34);
  for (const toe of limb.toes) {
    curve(ctx, toe, at);
  }
  ctx.restore();
}

function drawGill(ctx: CanvasRenderingContext2D, gill: AxolotlGill, at: (v: AxolotlVec) => [number, number], scale: number, p: AxolotlShape) {
  ctx.save();
  ctx.globalAlpha = gill.side === 'near' ? 0.88 : 0.46;
  ctx.strokeStyle = p.gillColor;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(0.6, gill.width * scale);
  curve(ctx, gill.stalk, at);
  ctx.lineWidth = Math.max(0.45, gill.width * scale * 0.36);
  for (let index = 0; index < gill.fronds.length; index++) {
    // At tank thumbnail scale adjacent filaments occupy the same pixel.
    if (scale < 65 && Math.floor(index / 2) % 2) continue;
    const frond = gill.fronds[index];
    curve(ctx, frond, at);
    // Finer pinnules make each filament feathered instead of a comb of straight spikes.
    if (scale > 90) for (let j = 1; j <= 2 + Math.round(p.gillFrondDensity * 2); j++) {
      const u = j / 6;
      const x = frond.start.x + (frond.end.x - frond.start.x) * u;
      const y = frond.start.y + (frond.end.y - frond.start.y) * u;
      ctx.beginPath(); ctx.moveTo(...at({ x, y }));
      ctx.lineTo(...at({ x: x + (frond.end.x-frond.start.x)*0.24 + 0.005, y: y + (frond.end.y-frond.start.y)*0.24 - 0.009 })); ctx.stroke();
    }
  }
  ctx.strokeStyle = 'rgba(255,211,204,0.38)'; ctx.lineWidth = Math.max(0.35, scale * gill.width * 0.24);
  curve(ctx, gill.stalk, at);
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
  let marking = 0;
  const ellipse = (x: number, y: number, rx: number, ry: number, angle: number) => {
    // Outline detail has its own stream: LOD never shifts the following markings.
    const outline = random(hash(`axolotl-outline:${p.patternSeed}:${seed}:${mode}:${marking++}`));
    const [px, py] = at({ x, y });
    ctx.beginPath();
    if (rx < 0.016 || l < 65) ctx.ellipse(px, py, rx * l * scale, ry * l * scale, angle, 0, Math.PI * 2);
    else {
      const points = Array.from({length: 9}, (_, i) => {
        const theta = i / 9 * Math.PI * 2, radius = 0.9 + (outline() - 0.5) * (0.2 + p.patternEdge * 0.7);
        const dx = Math.cos(theta) * rx * l * scale * radius, dy = Math.sin(theta) * ry * l * scale * radius;
        return {x: px + dx * Math.cos(angle) - dy * Math.sin(angle), y: py + dx * Math.sin(angle) + dy * Math.cos(angle)};
      });
      const last = points.at(-1)!; ctx.moveTo((last.x+points[0].x)/2, (last.y+points[0].y)/2);
      points.forEach((v, i) => { const next = points[(i+1)%points.length]; ctx.quadraticCurveTo(v.x,v.y,(v.x+next.x)/2,(v.y+next.y)/2); }); ctx.closePath();
    }
    ctx.fill();
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
    ctx.globalAlpha = p.iridophore * (0.12 + 0.25 * Math.abs(Math.sin(time * 0.6 + i * 1.71 + seed * 0.001)));
    ctx.beginPath();
    ctx.ellipse(px, py, r * 1.25, r * 0.55, -0.3, 0, Math.PI * 2); ctx.fill();
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
  detail: Detail = FULL_DETAIL,
) {
  const a = axolotlAnatomyFor(input), p = a.shape;
  const safeSize = clamp(Math.abs(finite(size, 1)), 0.01, 10000);
  const l = safeSize * p.length;
  const safeTime = finite(time, 0);
  const pose = axolotlPose(a, safeTime, seed, motion);
  const at = (v: AxolotlVec): [number, number] => { const q = pose.point(v); return [q.x * l, q.y * l]; };

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Far appendages establish the unmistakable salamander silhouette before the torso is laid over their roots.
  for (const g of a.gills.filter(g => g.side === 'far')) drawGill(ctx, pose.gill(g), at, l, p);
  for (const limb of a.limbs.filter(limb => limb.side === 'far')) drawLimb(ctx, pose.limb(limb), at, l, p);

  // The dorsal/caudal membrane is thin and translucent, continuous almost to the tail tip.
  ctx.save();
  ctx.globalAlpha = 0.34 + (1 - p.translucency) * 0.2;
  const membrane = ctx.createLinearGradient(0, -0.3*l, 0, 0.22*l);
  membrane.addColorStop(0, p.baseColor); membrane.addColorStop(0.5, p.secondaryColor); membrane.addColorStop(1, p.baseColor);
  ctx.fillStyle = membrane;
  ctx.strokeStyle = p.accentColor;
  ctx.lineWidth = Math.max(0.35, l * 0.003);
  polygon(ctx, a.dorsalFin, at); ctx.fill(); ctx.stroke();
  polygon(ctx, a.ventralFin, at); ctx.fill(); ctx.stroke();
  ctx.globalAlpha = 0.13 + p.skinLuster * 0.12;
  ctx.strokeStyle = '#e7ead8'; ctx.lineWidth = Math.max(0.35,l*0.002);
  ctx.beginPath(); ctx.moveTo(...at(a.dorsalFin[0]));
  for (const v of a.dorsalFin.slice(1)) ctx.lineTo(...at(v));
  ctx.stroke();
  ctx.restore();

  bodyPath(ctx, a, at);
  const bodyGradient = ctx.createLinearGradient(0, -0.18 * l, 0, 0.19 * l);
  bodyGradient.addColorStop(0, p.secondaryColor);
  bodyGradient.addColorStop(0.27, p.baseColor);
  bodyGradient.addColorStop(0.62, p.baseColor);
  bodyGradient.addColorStop(1, p.secondaryColor);
  ctx.globalAlpha = 0.88 + (1 - p.translucency) * 0.12;
  ctx.fillStyle = bodyGradient;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = p.accentColor;
  ctx.lineWidth = Math.max(0.35, l * 0.003);
  ctx.stroke();

  // Pigment and iridophores are clipped to the muscular body/tail, independent of anatomy generation.
  ctx.save();
  bodyPath(ctx, a, at); ctx.clip();
  drawPattern(ctx, p, seed, l, at);
  // Stable, fine pigment granules, not scales. Density and luster remain inherited.
  if (detail.speckle && l > 65) {
    const rng = random(hash(`axolotl-skin:${seed}:${p.patternSeed}`));
    const count = Math.round((55 + p.texture * 140 + p.melanin * 65) * Math.min(1, l / 180));
    for (let i = 0; i < count; i++) {
      const x = -0.58 + rng() * 1.9, y = (rng() - 0.5) * 0.42;
      ctx.fillStyle = i % 5 === 0 ? '#fff5da' : p.accentColor;
      ctx.globalAlpha = (0.045 + p.texture * 0.12) * (0.45 + rng() * 0.55);
      const pos = at({ x, y });
      ctx.beginPath(); ctx.ellipse(pos[0], pos[1], l * (0.0015 + rng()*0.003), l*0.0018, 0, 0, Math.PI*2); ctx.fill();
    }
  }
  if (detail.sparkle) drawIridophores(ctx, p, seed, safeTime, l, at);
  if (detail.finRays && p.texture > 0.05) {
    ctx.globalAlpha = 0.05 + p.texture * 0.09;
    ctx.strokeStyle = p.accentColor;
    ctx.lineWidth = Math.max(0.35, l * 0.003);
    for (let i = 0; i < 11; i++) {
      const x = -0.055 + i * 0.047;
      curve(ctx, { start: {x, y: -0.075}, control: {x: x-0.025, y: 0.03}, end: {x: x+0.008, y: 0.12} }, at);
    }
  }
  const sheen = ctx.createLinearGradient(0, -0.18 * l, 0, 0.19 * l);
  sheen.addColorStop(0, 'rgba(10,19,24,0.13)');
  sheen.addColorStop(0.27, `rgba(255,246,231,${0.09 + p.skinLuster * 0.16})`);
  sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.82, 'rgba(20,15,18,0.18)');
  sheen.addColorStop(1, 'rgba(255,235,216,0.18)');
  ctx.globalAlpha = 1; ctx.fillStyle = sheen;
  ctx.fillRect(a.bounds.minX * l, a.bounds.minY * l, (a.bounds.maxX - a.bounds.minX) * l, (a.bounds.maxY - a.bounds.minY) * l);
  ctx.restore();

  for (const limb of a.limbs.filter(limb => limb.side === 'near')) drawLimb(ctx, pose.limb(limb), at, l, p);
  for (const g of a.gills.filter(g => g.side === 'near')) drawGill(ctx, pose.gill(g), at, l, p);

  // Eye and gentle mouth curve keep the broad head readable even on dark/melanoid-like palettes.
  const [eyeX, eyeY] = at(a.eye.center), eyeR = a.eye.radius * l;
  ctx.globalAlpha = 0.25; ctx.fillStyle = p.accentColor;
  ctx.beginPath(); ctx.ellipse(eyeX, eyeY + eyeR * 0.25, eyeR * 1.5, eyeR * 1.25, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = p.eyeColor; ctx.beginPath(); ctx.arc(eyeX, eyeY, eyeR, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0b090a'; ctx.beginPath(); ctx.arc(eyeX - eyeR * 0.08, eyeY, a.eye.pupilRadius * l, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.7; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(eyeX - eyeR * 0.28, eyeY - eyeR * 0.3, eyeR * 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.62 + p.melanin * 0.28;
  ctx.strokeStyle = p.accentColor;
  ctx.lineWidth = Math.max(0.55, l * 0.006);
  curve(ctx, a.mouth, at);
  ctx.globalAlpha = 0.11; ctx.strokeStyle = '#fff6e9';
  curve(ctx, { start: {x:a.mouth.start.x, y:a.mouth.start.y+0.019}, control:{x:a.mouth.control.x,y:a.mouth.control.y+0.025}, end:{x:a.mouth.end.x,y:a.mouth.end.y+0.018} }, at);
  const nose = at({ x: a.mouth.start.x + 0.026, y: -0.025 });
  ctx.globalAlpha = 0.48; ctx.fillStyle = p.accentColor;
  ctx.beginPath(); ctx.ellipse(nose[0], nose[1], l*0.007, l*0.004, -0.3, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}
