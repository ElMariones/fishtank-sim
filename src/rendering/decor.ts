import { hash, random } from '../core/random';

/**
 * Procedural aquascape pieces (FS-117). Each draw function paints one piece with its origin at the centre of its base on
 * the substrate and y pointing down, so every shape grows upward from (0, 0). `w` is the footprint width and `h` the
 * visual height in pixels. Shapes come only from the piece and its variant, so a thumbnail matches the tank.
 */
export type PieceContext = {
  ctx: CanvasRenderingContext2D; w: number; h: number; rng: () => number; time: number; variant: number;
  /** Plants draw leaves in two passes so fish can swim among them: behind fish, then in front. */
  layer: 'back' | 'front' | 'all';
};
type Draw = (p: PieceContext) => void;

const TAU = Math.PI * 2;
export const pieceRng = (item: string, variant: number) => random(hash(`aquascape:${item}:${variant}`));
const pick = <T,>(rng: () => number, values: readonly T[]) => values[Math.floor(rng() * values.length) % values.length];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const hsl = (h: number, s: number, l: number, a = 1) => `hsla(${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%, ${a})`;
/** Front/back assignment for a leaf; stable per leaf index. */
const inLayer = (p: PieceContext, index: number, frontShare = 0.3) => p.layer === 'all' || (p.layer === 'front') === ((hash(`leaf:${index}:${p.variant}`) % 100) / 100 < frontShare);

function contactShadow({ ctx, w }: PieceContext, spread = 1) {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.6 * spread);
  g.addColorStop(0, 'rgba(0,0,0,.42)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save(); ctx.scale(1, 0.22); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, w * 0.6 * spread, 0, TAU); ctx.fill(); ctx.restore();
}

/** Closed mound outline from base left to base right. `jag` raises sharp facets; `lean` shifts the peak. */
function moundPath(rng: () => number, w: number, h: number, points: number, jag: number, lean = 0) {
  const out: [number, number][] = [];
  for (let i = 0; i <= points; i++) {
    const t = i / points, angle = Math.PI - t * Math.PI;
    const bump = 1 + (rng() - 0.5) * jag;
    const peak = Math.pow(Math.sin(t * Math.PI), 0.7 + jag * 0.4);
    out.push([Math.cos(angle) * w / 2 * bump + lean * w * peak * 0.25, -Math.max(0, peak * h * bump)]);
  }
  return out;
}
function trace(ctx: CanvasRenderingContext2D, points: [number, number][], smooth: boolean) {
  ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
  if (!smooth) for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
  else for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1], [x1, y1] = points[i];
    ctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  ctx.lineTo(points[points.length - 1][0], points[points.length - 1][1]);
  ctx.closePath();
}
/** Top-left key light over a base colour. */
function stoneFill(ctx: CanvasRenderingContext2D, w: number, h: number, hue: number, sat: number, light: number) {
  const g = ctx.createLinearGradient(-w * 0.35, -h, w * 0.3, 0);
  g.addColorStop(0, hsl(hue, sat, Math.min(92, light + 22))); g.addColorStop(0.45, hsl(hue, sat, light)); g.addColorStop(1, hsl(hue, sat, Math.max(4, light - 22)));
  return g;
}
function speckle(p: PieceContext, count: number, w: number, h: number, colors: string[], size = 1.2) {
  const { ctx, rng } = p;
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = pick(rng, colors);
    ctx.beginPath(); ctx.arc((rng() - 0.5) * w, -rng() * h, size * (0.4 + rng()), 0, TAU); ctx.fill();
  }
}
function mossTufts(p: PieceContext, points: [number, number][], share: number) {
  const { ctx, rng } = p;
  for (const [x, y] of points) {
    if (rng() > share) continue;
    ctx.fillStyle = hsl(95 + rng() * 25, 45, 26 + rng() * 14, 0.9);
    ctx.beginPath(); ctx.ellipse(x, y + 1, 3 + rng() * 5, 2 + rng() * 2.5, (rng() - 0.5) * 0.6, 0, TAU); ctx.fill();
  }
}

// ---- Rocks ----------------------------------------------------------------------------------------------------------

const riverStones: Draw = p => {
  const { ctx, w, h, rng } = p;
  contactShadow(p, 1.15);
  const hue = pick(rng, [30, 36, 205, 22, 48]), sat = 6 + rng() * 14;
  type Stone = { x: number; y: number; rx: number; ry: number; tilt: number; l: number; hue: number };
  const stones: Stone[] = [];
  // A bottom row of wide flat stones, then smaller ones resting in the gaps above.
  const bottom = 3 + Math.floor(rng() * 2);
  let cursor = -w * 0.62;
  for (let i = 0; i < bottom; i++) {
    const rx = w * (0.14 + rng() * 0.1), ry = h * (0.17 + rng() * 0.1);
    cursor += rx * (i ? 1.2 : 1);
    stones.push({ x: cursor, y: -ry * 0.9, rx, ry, tilt: (rng() - 0.5) * 0.3, l: 36 + rng() * 26, hue: hue + (rng() - 0.5) * 16 });
    cursor += rx * 0.75;
  }
  const shift = -(cursor - w * 0.62) / 2 - w * 0.02;
  for (const stone of stones) stone.x += shift;
  // Upper stones rest in the dip between two stones below, and a capstone may crown the pile.
  const upper = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < upper && i < bottom - 1; i++) {
    const left = stones[i + Math.floor(rng() * (bottom - 1 - i))], right = stones[stones.indexOf(left) + 1];
    const rx = w * (0.12 + rng() * 0.08), ry = h * (0.14 + rng() * 0.08), rest = Math.min(left.y - left.ry * 0.55, right.y - right.ry * 0.55);
    stones.push({ x: (left.x + right.x) / 2 + (rng() - 0.5) * rx * 0.4, y: rest - ry * 0.55, rx, ry, tilt: (rng() - 0.5) * 0.4, l: 40 + rng() * 25, hue: hue + (rng() - 0.5) * 16 });
  }
  if (rng() < 0.6) {
    const top = stones.reduce((a, b) => (b.y - b.ry < a.y - a.ry ? b : a)), rx = top.rx * 0.7, ry = top.ry * 0.75;
    stones.push({ x: top.x + (rng() - 0.5) * rx * 0.3, y: top.y - top.ry * 0.8 - ry * 0.6, rx, ry, tilt: (rng() - 0.5) * 0.3, l: 44 + rng() * 22, hue: hue + (rng() - 0.5) * 16 });
  }
  for (const s of stones) {
    const g = ctx.createRadialGradient(s.x - s.rx * 0.4, s.y - s.ry * 0.5, s.rx * 0.08, s.x, s.y, Math.max(s.rx, s.ry) * 1.15);
    g.addColorStop(0, hsl(s.hue, sat, Math.min(90, s.l + 26))); g.addColorStop(0.5, hsl(s.hue, sat, s.l)); g.addColorStop(1, hsl(s.hue, sat + 4, Math.max(6, s.l - 26)));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(s.x, s.y, s.rx, s.ry, s.tilt, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(s.x, s.y, s.rx * 0.8, s.ry * 0.75, s.tilt, Math.PI * 1.1, Math.PI * 1.55); ctx.stroke();
    if (rng() < 0.4) { ctx.strokeStyle = 'rgba(245,240,230,.35)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(s.x - s.rx * 0.7, s.y + s.ry * (rng() - 0.5) * 0.6); ctx.quadraticCurveTo(s.x, s.y - s.ry * 0.2, s.x + s.rx * 0.7, s.y + s.ry * (rng() - 0.5) * 0.6); ctx.stroke(); }
  }
  mossTufts(p, stones.map(s => [s.x, s.y - s.ry * 0.85] as [number, number]), 0.25);
};

const seiryu: Draw = p => {
  const { ctx, w, h, rng } = p;
  contactShadow(p, 1.1);
  const lean = (rng() - 0.5) * 1.6, outline = moundPath(rng, w * 1.05, h, 7 + Math.floor(rng() * 4), 0.45, lean);
  outline[Math.floor(outline.length / 2)][1] -= h * 0.12 * rng();
  trace(ctx, outline, false);
  ctx.fillStyle = stoneFill(ctx, w, h, 205, 10, 44); ctx.fill();
  ctx.save(); ctx.clip();
  // Facets: darker planes on the shadow side of each ridge.
  for (let i = 1; i < outline.length - 1; i++) {
    const [x, y] = outline[i];
    ctx.fillStyle = `rgba(10,20,30,${0.1 + rng() * 0.18})`;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w * (0.08 + rng() * 0.2), y + h * (0.3 + rng() * 0.5)); ctx.lineTo(x + w * 0.02, 0); ctx.lineTo(x - w * 0.05, y + h * 0.3); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(235,245,250,.32)'; ctx.lineCap = 'round';
  for (let v = 0; v < 2 + rng() * 3; v++) {
    let x = (rng() - 0.5) * w * 0.7, y = -rng() * h * 0.8;
    ctx.lineWidth = 0.6 + rng() * 1.2; ctx.beginPath(); ctx.moveTo(x, y);
    for (let s = 0; s < 5; s++) { x += (rng() - 0.3) * w * 0.12; y += (rng() - 0.5) * h * 0.12; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  ctx.restore();
  trace(ctx, outline, false); ctx.strokeStyle = 'rgba(210,230,240,.25)'; ctx.lineWidth = 1; ctx.stroke();
};

const lava: Draw = p => {
  const { ctx, w, h, rng } = p;
  contactShadow(p);
  const outline = moundPath(rng, w, h, 10, 0.32, (rng() - 0.5));
  trace(ctx, outline, true);
  const hue = pick(rng, [8, 14, 355]);
  ctx.fillStyle = stoneFill(ctx, w, h, hue, 38, 24); ctx.fill();
  ctx.save(); ctx.clip();
  for (let i = 0; i < 60; i++) {
    const x = (rng() - 0.5) * w, y = -rng() * h, r = 0.8 + rng() * Math.max(1.5, w * 0.035);
    ctx.fillStyle = 'rgba(8,3,3,.75)'; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.8, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = hsl(hue, 45, 42, 0.5); ctx.lineWidth = 0.7; ctx.beginPath(); ctx.arc(x, y + 0.5, r, 0.2, Math.PI - 0.2); ctx.stroke();
  }
  ctx.restore();
};

const slate: Draw = p => {
  const { ctx, w, h, rng } = p;
  contactShadow(p, 1.1);
  const plates = 3 + Math.floor(rng() * 3), hue = pick(rng, [210, 195, 30]);
  let y = 0, offset = 0;
  for (let i = 0; i < plates; i++) {
    const t = i / plates, pw = w * lerp(1.1, 0.45, t) * (0.85 + rng() * 0.3), ph = h / plates * (0.8 + rng() * 0.4);
    offset += (rng() - 0.5) * w * 0.18;
    const x0 = offset - pw / 2, tilt = (rng() - 0.5) * ph * 0.4;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + pw * 0.04, y - ph + tilt); ctx.lineTo(x0 + pw * (0.5 + rng() * 0.2), y - ph - tilt * 0.5);
    ctx.lineTo(x0 + pw * 0.96, y - ph - tilt); ctx.lineTo(x0 + pw, y); ctx.closePath();
    const g = ctx.createLinearGradient(0, y - ph, 0, y);
    g.addColorStop(0, hsl(hue, 10, 40)); g.addColorStop(0.2, hsl(hue, 10, 26)); g.addColorStop(1, hsl(hue, 12, 14));
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = hsl(hue, 12, 58, 0.55); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x0 + pw * 0.04, y - ph + tilt); ctx.lineTo(x0 + pw * 0.96, y - ph - tilt); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 0.7;
    for (let l = 1; l < 3; l++) { ctx.beginPath(); ctx.moveTo(x0 + pw * 0.05, y - ph * l / 3); ctx.lineTo(x0 + pw * 0.95, y - ph * l / 3 + (rng() - 0.5) * 2); ctx.stroke(); }
    y -= ph * 0.92;
  }
};

const boulder: Draw = p => {
  const { ctx, w, h, rng } = p;
  contactShadow(p, 1.1);
  const outline = moundPath(rng, w * 1.08, h, 12, 0.14, (rng() - 0.5) * 0.8);
  trace(ctx, outline, true);
  const hue = pick(rng, [20, 210, 350]), light = 40 + rng() * 14;
  const g = ctx.createRadialGradient(-w * 0.2, -h * 0.75, w * 0.05, 0, -h * 0.4, w * 0.75);
  g.addColorStop(0, hsl(hue, 10, light + 25)); g.addColorStop(0.5, hsl(hue, 9, light)); g.addColorStop(1, hsl(hue, 10, light - 26));
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  speckle(p, Math.round(w * 1.4), w, h, ['rgba(20,20,22,.55)', 'rgba(240,235,230,.5)', 'rgba(190,120,110,.45)'], Math.max(0.6, w / 140));
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo((rng() - 0.5) * w * 0.4, -h); ctx.bezierCurveTo(w * 0.1, -h * 0.6, -w * 0.1, -h * 0.4, (rng() - 0.3) * w * 0.3, 0); ctx.stroke();
  ctx.restore();
  mossTufts(p, outline.slice(2, -2), 0.35);
};

const cave: Draw = p => {
  const { ctx, w, h, rng } = p;
  contactShadow(p, 1.15);
  const outline = moundPath(rng, w * 1.12, h, 11, 0.24, (rng() - 0.5) * 0.6);
  trace(ctx, outline, true);
  const hue = pick(rng, [30, 200, 15]);
  ctx.fillStyle = stoneFill(ctx, w, h, hue, 12, 36); ctx.fill();
  ctx.save(); ctx.clip();
  const mouthX = (rng() - 0.5) * w * 0.3, mouthW = w * (0.22 + rng() * 0.1), mouthH = h * (0.45 + rng() * 0.15);
  const dark = ctx.createRadialGradient(mouthX, -mouthH * 0.35, 1, mouthX, -mouthH * 0.4, mouthW * 1.2);
  dark.addColorStop(0, 'rgba(0,0,0,.95)'); dark.addColorStop(0.7, 'rgba(5,8,10,.85)'); dark.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(mouthX - mouthW, 2);
  ctx.bezierCurveTo(mouthX - mouthW, -mouthH * 1.2, mouthX + mouthW, -mouthH * 1.2, mouthX + mouthW, 2); ctx.fill();
  ctx.strokeStyle = hsl(hue, 14, 60, 0.35); ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(mouthX - mouthW * 1.05, 0); ctx.bezierCurveTo(mouthX - mouthW * 1.05, -mouthH * 1.25, mouthX + mouthW * 1.05, -mouthH * 1.25, mouthX + mouthW * 1.05, 0); ctx.stroke();
  speckle(p, 30, w, h, ['rgba(0,0,0,.25)', 'rgba(255,255,255,.12)'], 1.4);
  ctx.restore();
  mossTufts(p, outline.slice(1, -1), 0.6);
};

// ---- Wood -----------------------------------------------------------------------------------------------------------

function woodStroke(ctx: CanvasRenderingContext2D, path: () => void, width: number, hue: number, light: number) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = hsl(hue, 30, light - 16); ctx.lineWidth = width; path(); ctx.stroke();
  ctx.strokeStyle = hsl(hue, 28, light); ctx.lineWidth = width * 0.62; ctx.save(); ctx.translate(-width * 0.12, -width * 0.12); path(); ctx.stroke(); ctx.restore();
  ctx.strokeStyle = hsl(hue, 22, light + 16, 0.7); ctx.lineWidth = width * 0.18; ctx.save(); ctx.translate(-width * 0.22, -width * 0.2); path(); ctx.stroke(); ctx.restore();
}

const driftwood: Draw = p => {
  const { ctx, w, h, rng } = p;
  contactShadow(p, 1.2);
  const hue = pick(rng, [32, 28, 38]), light = 52 + rng() * 14, base = w * 0.2;
  const tip = [(rng() > 0.5 ? 1 : -1) * w * (0.5 + rng() * 0.3), -h * (0.95 + rng() * 0.15)] as const;
  const trunk = () => { ctx.beginPath(); ctx.moveTo(-tip[0] * 0.6, -base * 0.3); ctx.bezierCurveTo(-tip[0] * 0.1, -h * 0.1, tip[0] * 0.2, -h * 0.7, tip[0], tip[1]); };
  woodStroke(ctx, trunk, base, hue, light);
  for (let b = 0; b < 3; b++) {
    const t = 0.35 + rng() * 0.45, sx = lerp(-tip[0] * 0.3, tip[0], t), sy = lerp(-h * 0.1, tip[1], t);
    const ex = sx + (rng() - 0.5) * w * 0.9, ey = sy - h * (0.2 + rng() * 0.35);
    woodStroke(ctx, () => { ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo((sx + ex) / 2 + (rng() - 0.5) * 10, (sy + ey) / 2, ex, ey); }, base * (0.35 + rng() * 0.2), hue, light);
  }
  woodStroke(ctx, () => { ctx.beginPath(); ctx.moveTo(-tip[0] * 0.6, -base * 0.3); ctx.quadraticCurveTo(-tip[0] * 0.9, -2, -tip[0] * 1.05, 0); }, base * 0.6, hue, light);
};

const spiderwood: Draw = p => {
  const { ctx, w, h, rng } = p;
  contactShadow(p, 1.1);
  const hue = pick(rng, [26, 20, 30]), light = 40 + rng() * 10;
  const branch = (x: number, y: number, angle: number, length: number, width: number, depth: number) => {
    const ex = x + Math.cos(angle) * length, ey = y + Math.sin(angle) * length, bend = (rng() - 0.5) * length * 0.5;
    const path = () => { ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo((x + ex) / 2 + bend, (y + ey) / 2, ex, ey); };
    if (width > 3) woodStroke(ctx, path, width, hue, light);
    else { ctx.strokeStyle = hsl(hue, 30, light - 4); ctx.lineWidth = Math.max(0.7, width); ctx.lineCap = 'round'; path(); ctx.stroke(); }
    if (depth <= 0) return;
    const forks = 2 + Math.floor(rng() * 2);
    for (let f = 0; f < forks; f++) branch(ex, ey, angle + (rng() - 0.5) * 1.3, length * (0.55 + rng() * 0.25), width * 0.6, depth - 1);
  };
  const trunkWidth = Math.max(4, w * 0.1);
  for (let r = 0; r < 3; r++) branch(0, 0, Math.PI + 0.2 + r * 0.35 + rng() * 0.2, w * 0.3, trunkWidth * 0.5, 0);
  for (let s = 0; s < 2 + Math.floor(rng() * 2); s++) branch((rng() - 0.5) * w * 0.2, 0, -Math.PI / 2 + (rng() - 0.5) * 1.1, h * (0.42 + rng() * 0.12), trunkWidth, 3);
};

const log: Draw = p => {
  const { ctx, w, h, rng } = p;
  contactShadow(p, 1.25);
  const length = w * 1.25, radius = Math.min(h * 0.5, w * 0.34), hue = pick(rng, [24, 30, 18]), tilt = (rng() - 0.5) * 0.12;
  ctx.save(); ctx.translate(0, -radius); ctx.rotate(tilt);
  const g = ctx.createLinearGradient(0, -radius, 0, radius);
  g.addColorStop(0, hsl(hue, 34, 40)); g.addColorStop(0.35, hsl(hue, 36, 28)); g.addColorStop(1, hsl(hue, 34, 12));
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-length / 2, -radius); ctx.lineTo(length / 2, -radius);
  ctx.ellipse(length / 2, 0, radius * 0.35, radius, 0, -Math.PI / 2, Math.PI / 2); ctx.lineTo(-length / 2, radius);
  ctx.ellipse(-length / 2, 0, radius * 0.35, radius, 0, Math.PI / 2, Math.PI * 1.5); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    const y = (rng() - 0.5) * radius * 1.7, x = (rng() - 0.5) * length * 0.8;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + length * 0.1, y + 2, x + length * 0.2, y - 2, x + length * 0.3, y + (rng() - 0.5) * 3); ctx.stroke();
  }
  ctx.fillStyle = hsl(hue, 30, 55); ctx.beginPath(); ctx.ellipse(length / 2, 0, radius * 0.35, radius, 0, 0, TAU); ctx.fill();
  const hollow = ctx.createRadialGradient(length / 2, 0, 1, length / 2, 0, radius * 0.8);
  hollow.addColorStop(0, '#000'); hollow.addColorStop(0.8, 'rgba(10,6,4,.95)'); hollow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hollow; ctx.beginPath(); ctx.ellipse(length / 2, 0, radius * 0.26, radius * 0.78, 0, 0, TAU); ctx.fill();
  ctx.restore();
  mossTufts(p, Array.from({ length: 8 }, (_, i) => [(i / 7 - 0.5) * length * 0.9, -radius * 2 + 2] as [number, number]), 0.5);
};

const roots: Draw = p => {
  const { ctx, w, h, rng } = p;
  contactShadow(p, 1.25);
  const hue = pick(rng, [22, 16, 28]), light = 30 + rng() * 8, top = -h * (0.9 + rng() * 0.15), crown = (rng() - 0.5) * w * 0.2;
  const count = 5 + Math.floor(rng() * 3);
  for (let i = 0; i < count; i++) {
    const foot = (i / (count - 1) - 0.5) * w * 1.35 + (rng() - 0.5) * 6, width = Math.max(3, w * (0.05 + rng() * 0.05));
    woodStroke(ctx, () => { ctx.beginPath(); ctx.moveTo(crown + (rng() - 0.5) * w * 0.1, top * (0.9 + rng() * 0.1)); ctx.bezierCurveTo(crown + foot * 0.2, top * 0.3, foot, top * 0.6, foot, 0); }, width, hue, light);
  }
  // A gnarled knot where the roots meet, with two short broken stubs.
  const knot = ctx.createRadialGradient(crown - 3, top - 3, 1, crown, top, Math.max(6, w * 0.12));
  knot.addColorStop(0, hsl(hue, 30, light + 10)); knot.addColorStop(1, hsl(hue, 32, light - 12));
  ctx.fillStyle = knot; ctx.beginPath(); ctx.ellipse(crown, top, Math.max(6, w * 0.13), Math.max(5, w * 0.09), (rng() - 0.5) * 0.4, 0, TAU); ctx.fill();
  for (const side of [-1, 1]) woodStroke(ctx, () => { ctx.beginPath(); ctx.moveTo(crown, top); ctx.quadraticCurveTo(crown + side * w * 0.1, top - h * 0.08, crown + side * w * (0.12 + rng() * 0.1), top - h * (0.1 + rng() * 0.08)); }, Math.max(3, w * 0.05), hue, light);
};

// ---- Ornaments ------------------------------------------------------------------------------------------------------

const pagoda: Draw = p => {
  const { ctx, w, h, rng } = p;
  contactShadow(p, 1.1);
  const tiers = 3 + (p.variant % 3 === 2 ? 1 : 0), stone = pick(rng, [[80, 6, 52], [40, 10, 58], [200, 6, 46]] as const);
  const face = (l: number) => hsl(stone[0], stone[1], stone[2] + l);
  const tierH = h * 0.82 / (tiers + 0.6);
  ctx.fillStyle = face(-12); ctx.fillRect(-w * 0.48, -tierH * 0.35, w * 0.96, tierH * 0.35);
  let y = -tierH * 0.35;
  for (let i = 0; i < tiers; i++) {
    const bw = w * lerp(0.5, 0.26, i / tiers), roofW = bw * 2, bodyH = tierH * 0.62;
    const body = ctx.createLinearGradient(-bw, 0, bw, 0); body.addColorStop(0, face(10)); body.addColorStop(1, face(-18));
    ctx.fillStyle = body; ctx.fillRect(-bw / 2 * 1.4, y - bodyH, bw * 1.4, bodyH);
    ctx.fillStyle = 'rgba(10,10,10,.55)'; ctx.fillRect(-bw * 0.18, y - bodyH * 0.8, bw * 0.36, bodyH * 0.6);
    y -= bodyH;
    const roofH = tierH * 0.5;
    ctx.beginPath(); ctx.moveTo(-roofW / 2, y + 1); ctx.quadraticCurveTo(-roofW * 0.35, y - roofH * 0.25, -roofW * 0.54, y - roofH * 0.55);
    ctx.quadraticCurveTo(-roofW * 0.22, y - roofH * 0.35, 0, y - roofH); ctx.quadraticCurveTo(roofW * 0.22, y - roofH * 0.35, roofW * 0.54, y - roofH * 0.55);
    ctx.quadraticCurveTo(roofW * 0.35, y - roofH * 0.25, roofW / 2, y + 1); ctx.closePath();
    const roof = ctx.createLinearGradient(0, y - roofH, 0, y); roof.addColorStop(0, face(16)); roof.addColorStop(1, face(-20));
    ctx.fillStyle = roof; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = face(-26); ctx.fillRect(-roofW * 0.46, y - 1, roofW * 0.92, Math.max(2, roofH * 0.14));
    mossTufts(p, [[-roofW * 0.3, y - roofH * 0.3], [roofW * 0.25, y - roofH * 0.35]], 0.4);
    y -= roofH * 0.55;
  }
  ctx.strokeStyle = face(-6); ctx.lineWidth = Math.max(2, w * 0.03); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(0, y - tierH * 0.5); ctx.stroke();
  for (let r = 0; r < 3; r++) { ctx.fillStyle = face(4); ctx.beginPath(); ctx.arc(0, y - tierH * (0.15 + r * 0.14), Math.max(1.5, w * 0.03), 0, TAU); ctx.fill(); }
};

export const lanternWindow = (w: number, h: number) => ({ x: 0, y: -h * 0.66, rx: w * 0.2, ry: h * 0.1 });
const lantern: Draw = p => {
  const { ctx, w, h, rng } = p;
  contactShadow(p, 1.1);
  const hue = pick(rng, [70, 40, 200]), face = (l: number) => hsl(hue, 7, 50 + l);
  const trap = (y: number, topW: number, botW: number, height: number, light: number) => {
    const g = ctx.createLinearGradient(-botW / 2, 0, botW / 2, 0); g.addColorStop(0, face(light + 12)); g.addColorStop(1, face(light - 22));
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-botW / 2, y); ctx.lineTo(-topW / 2, y - height); ctx.lineTo(topW / 2, y - height); ctx.lineTo(botW / 2, y); ctx.closePath(); ctx.fill();
  };
  trap(0, w * 0.7, w * 0.9, h * 0.1, -8);
  trap(-h * 0.1, w * 0.26, w * 0.34, h * 0.36, 0);
  trap(-h * 0.46, w * 1.0, w * 0.6, h * 0.1, 4);
  trap(-h * 0.56, w * 0.56, w * 0.56, h * 0.2, -4);
  const win = lanternWindow(w, h);
  ctx.fillStyle = '#ffcf7a'; ctx.fillRect(-win.rx, win.y - win.ry, win.rx * 2, win.ry * 2);
  ctx.fillStyle = face(-10); ctx.fillRect(-w * 0.03, win.y - win.ry, w * 0.06, win.ry * 2);
  const roofY = -h * 0.76;
  ctx.beginPath(); ctx.moveTo(-w * 0.72, roofY + h * 0.02); ctx.quadraticCurveTo(-w * 0.4, roofY - h * 0.04, -w * 0.12, roofY - h * 0.16); ctx.lineTo(w * 0.12, roofY - h * 0.16);
  ctx.quadraticCurveTo(w * 0.4, roofY - h * 0.04, w * 0.72, roofY + h * 0.02); ctx.closePath();
  const roof = ctx.createLinearGradient(0, roofY - h * 0.16, 0, roofY); roof.addColorStop(0, face(18)); roof.addColorStop(1, face(-22)); ctx.fillStyle = roof; ctx.fill();
  ctx.fillStyle = face(8); ctx.beginPath(); ctx.arc(0, roofY - h * 0.2, w * 0.1, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-w * 0.05, roofY - h * 0.26); ctx.quadraticCurveTo(0, -h * 1.02, w * 0.05, roofY - h * 0.26); ctx.fill();
  mossTufts(p, [[-w * 0.4, roofY], [w * 0.35, roofY + 1], [-w * 0.3, -h * 0.46]], 0.5);
};

const castle: Draw = p => {
  const { ctx, w, h, rng } = p;
  contactShadow(p, 1.2);
  const hue = pick(rng, [35, 25, 200]), face = (l: number) => hsl(hue, 14, 54 + l);
  const towers = [
    { x: -w * 0.34, tw: w * 0.3, th: h * (0.72 + rng() * 0.12), broken: rng() > 0.5 },
    { x: w * 0.02, tw: w * 0.36, th: h, broken: false },
    { x: w * 0.38, tw: w * 0.26, th: h * (0.55 + rng() * 0.15), broken: rng() > 0.4 },
  ];
  ctx.fillStyle = face(-14); ctx.fillRect(-w * 0.55, -h * 0.34, w * 1.1, h * 0.34);
  for (const t of towers.sort((a, b) => a.th - b.th)) {
    const g = ctx.createLinearGradient(t.x - t.tw / 2, 0, t.x + t.tw / 2, 0); g.addColorStop(0, face(12)); g.addColorStop(0.6, face(-6)); g.addColorStop(1, face(-24));
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(t.x - t.tw / 2, 0); ctx.lineTo(t.x - t.tw / 2, -t.th);
    const merlons = 4, mw = t.tw / (merlons * 2 - 1);
    for (let m = 0; m < merlons * 2 - 1; m++) {
      const x = t.x - t.tw / 2 + m * mw, up = m % 2 === 0 ? -t.th - mw * 0.9 : -t.th;
      const drop = t.broken && m > merlons ? mw * (m - merlons) * 1.2 : 0;
      ctx.lineTo(x, up + drop); ctx.lineTo(x + mw, up + drop);
    }
    ctx.lineTo(t.x + t.tw / 2, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = 0.8;
    for (let row = 1; row < 8; row++) {
      const y = -t.th * row / 8; ctx.beginPath(); ctx.moveTo(t.x - t.tw / 2, y); ctx.lineTo(t.x + t.tw / 2, y); ctx.stroke();
      for (let c = 0; c < 3; c++) { const x = t.x - t.tw / 2 + t.tw * (c + (row % 2) * 0.5) / 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + t.th / 8); ctx.stroke(); }
    }
    ctx.fillStyle = 'rgba(8,10,12,.85)';
    const winW = t.tw * 0.18, winH = t.th * 0.12;
    ctx.beginPath(); ctx.moveTo(t.x - winW / 2, -t.th * 0.62); ctx.lineTo(t.x - winW / 2, -t.th * 0.62 - winH); ctx.arc(t.x, -t.th * 0.62 - winH, winW / 2, Math.PI, 0); ctx.lineTo(t.x + winW / 2, -t.th * 0.62); ctx.fill();
  }
  ctx.fillStyle = 'rgba(5,6,8,.9)';
  const doorW = w * 0.16, doorH = h * 0.22;
  ctx.beginPath(); ctx.moveTo(-doorW / 2 + w * 0.02, 0); ctx.lineTo(-doorW / 2 + w * 0.02, -doorH); ctx.arc(w * 0.02, -doorH, doorW / 2, Math.PI, 0); ctx.lineTo(doorW / 2 + w * 0.02, 0); ctx.fill();
  mossTufts(p, Array.from({ length: 10 }, () => [(rng() - 0.5) * w, -rng() * h * 0.5] as [number, number]), 0.5);
};

const amphora: Draw = p => {
  const { ctx, w, h, rng } = p;
  contactShadow(p, 1.3);
  const hue = pick(rng, [18, 24, 12]), lying = p.variant % 2 === 0, len = lying ? w * 1.5 : h, girth = lying ? Math.min(h * 0.55, w * 0.55) : w * 0.62;
  ctx.save();
  if (lying) { ctx.translate(0, -girth * 0.5); ctx.rotate(-Math.PI / 2 + 0.15 * (rng() - 0.3)); ctx.translate(0, len * 0.5); }
  const g = ctx.createLinearGradient(-girth / 2, 0, girth / 2, 0);
  g.addColorStop(0, hsl(hue, 55, 58)); g.addColorStop(0.45, hsl(hue, 58, 44)); g.addColorStop(1, hsl(hue, 60, 22));
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-girth * 0.08, 0);
  ctx.bezierCurveTo(-girth * 0.65, -len * 0.2, -girth * 0.6, -len * 0.6, -girth * 0.15, -len * 0.8); ctx.lineTo(-girth * 0.13, -len * 0.95);
  ctx.lineTo(girth * 0.13, -len * 0.95); ctx.lineTo(girth * 0.15, -len * 0.8); ctx.bezierCurveTo(girth * 0.6, -len * 0.6, girth * 0.65, -len * 0.2, girth * 0.08, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = hsl(hue, 50, 30); ctx.lineWidth = Math.max(2, girth * 0.07); ctx.lineCap = 'round';
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(side * girth * 0.14, -len * 0.88); ctx.quadraticCurveTo(side * girth * 0.5, -len * 0.9, side * girth * 0.38, -len * 0.68); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(20,10,5,.45)'; ctx.lineWidth = 1.2;
  for (const band of [0.4, 0.46, 0.62]) { ctx.beginPath(); ctx.ellipse(0, -len * band, girth * 0.46, girth * 0.06, 0, 0, Math.PI); ctx.stroke(); }
  ctx.fillStyle = '#120804'; ctx.beginPath(); ctx.ellipse(0, -len * 0.95, girth * 0.13, girth * 0.05, 0, 0, TAU); ctx.fill();
  ctx.restore();
  mossTufts(p, [[-w * 0.3, -girth * 0.9], [w * 0.2, -girth * 1]], 0.6);
};

const chest: Draw = p => {
  const { ctx, w, h, rng } = p;
  contactShadow(p, 1.2);
  const cw = w * 1.15, ch = h * 0.5, lidH = h * 0.22, open = 0.14 + rng() * 0.16, hue = pick(rng, [24, 18, 30]);
  const wood = ctx.createLinearGradient(0, -ch, 0, 0); wood.addColorStop(0, hsl(hue, 45, 34)); wood.addColorStop(1, hsl(hue, 48, 16));
  ctx.fillStyle = wood; ctx.fillRect(-cw / 2, -ch, cw, ch);
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1;
  for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-cw / 2, -ch * i / 3); ctx.lineTo(cw / 2, -ch * i / 3); ctx.stroke(); }
  // Treasure glints in the gap.
  for (let c = 0; c < 9; c++) { ctx.fillStyle = hsl(46, 90, 50 + rng() * 25); ctx.beginPath(); ctx.ellipse((rng() - 0.5) * cw * 0.8, -ch - rng() * 3, 2 + rng() * 2.5, 1.5, 0, 0, TAU); ctx.fill(); }
  ctx.save(); ctx.translate(-cw / 2, -ch); ctx.rotate(-open);
  const lid = ctx.createLinearGradient(0, -lidH, 0, 0); lid.addColorStop(0, hsl(hue, 42, 40)); lid.addColorStop(1, hsl(hue, 45, 22));
  ctx.fillStyle = lid; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -lidH * 0.45); ctx.bezierCurveTo(0, -lidH * 1.2, cw, -lidH * 1.2, cw, -lidH * 0.45); ctx.lineTo(cw, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.strokeStyle = '#d7a93b'; ctx.lineWidth = Math.max(1.5, cw * 0.05);
  for (const x of [0.18, 0.82]) { ctx.beginPath(); ctx.moveTo(cw * x, 0); ctx.lineTo(cw * x, -lidH * 0.95); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = '#c9982d'; ctx.lineWidth = Math.max(1.5, cw * 0.05);
  for (const x of [-0.32, 0.32]) { ctx.beginPath(); ctx.moveTo(cw * x, 0); ctx.lineTo(cw * x, -ch); ctx.stroke(); }
  ctx.fillStyle = '#e8c35a'; ctx.fillRect(-cw * 0.06, -ch * 0.75, cw * 0.12, ch * 0.28);
};

const clam: Draw = p => {
  const { ctx, w, h, rng } = p;
  contactShadow(p, 1.2);
  const sw = w * 1.3, sh = h * 0.5, hue = pick(rng, [30, 350, 200, 45]), open = 0.35 + rng() * 0.25;
  const shell = (flipY: number, light: number) => {
    ctx.beginPath(); ctx.moveTo(-sw / 2, 0);
    for (let i = 0; i <= 10; i++) { const a = Math.PI - i / 10 * Math.PI; ctx.lineTo(Math.cos(a) * sw / 2, flipY * (Math.sin(a) * sh + (i % 2 ? sh * 0.1 : 0))); }
    ctx.closePath();
    const g = ctx.createLinearGradient(0, flipY * sh, 0, 0); g.addColorStop(0, hsl(hue, 25, light + 20)); g.addColorStop(1, hsl(hue, 30, light - 10));
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = hsl(hue, 20, light - 25, 0.6); ctx.lineWidth = 1;
    for (let r = 1; r < 10; r++) { const a = Math.PI - r / 10 * Math.PI; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * sw / 2 * 0.95, flipY * Math.sin(a) * sh * 0.95); ctx.stroke(); }
  };
  ctx.save(); ctx.translate(0, -2); shell(-0.45, 58);
  ctx.fillStyle = hsl(hue + 330, 40, 70); ctx.beginPath(); ctx.ellipse(0, -sh * 0.12, sw * 0.4, sh * 0.2, 0, 0, TAU); ctx.fill();
  const pearl = ctx.createRadialGradient(-sw * 0.03, -sh * 0.32, 1, 0, -sh * 0.26, sw * 0.1);
  pearl.addColorStop(0, '#fff'); pearl.addColorStop(0.6, '#e9e3f2'); pearl.addColorStop(1, '#9d93aa');
  ctx.fillStyle = pearl; ctx.beginPath(); ctx.arc(0, -sh * 0.26, Math.max(2.5, sw * 0.09), 0, TAU); ctx.fill();
  ctx.translate(-sw / 2, -sh * 0.1); ctx.rotate(-open); ctx.translate(sw / 2, 0); shell(-1, 64);
  ctx.restore();
};

const bubbler: Draw = p => {
  const { ctx, w, h } = p;
  contactShadow(p, 1.4);
  const g = ctx.createLinearGradient(0, -h, 0, 0); g.addColorStop(0, '#9aa5a8'); g.addColorStop(1, '#3d4749');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -Math.min(h, w) * 0.2, w * 0.5, Math.min(h, w) * 0.2, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.2)';
  for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.arc((i / 7 - 0.5) * w * 0.7, -Math.min(h, w) * 0.34 + (i % 2) * 2, 1, 0, TAU); ctx.fill(); }
};

// ---- Plants ---------------------------------------------------------------------------------------------------------

/** A tapering leaf ribbon along a swaying curve. */
function ribbon(ctx: CanvasRenderingContext2D, x: number, length: number, width: number, lean: number, curl: number, sway: number, fill: string | CanvasGradient, rib?: string) {
  const steps = 9, left: [number, number][] = [], right: [number, number][] = [], spine: [number, number][] = [];
  let px = x, py = 0, angle = -Math.PI / 2 + lean;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, half = width * (t < 0.15 ? 0.5 + t * 3 : 1 - Math.pow((t - 0.15) / 0.85, 1.6)) / 2;
    const nx = Math.cos(angle + Math.PI / 2), ny = Math.sin(angle + Math.PI / 2);
    spine.push([px, py]); left.push([px + nx * half, py + ny * half]); right.push([px - nx * half, py - ny * half]);
    angle += curl / steps + sway * t * 0.08;
    px += Math.cos(angle) * length / steps; py += Math.sin(angle) * length / steps;
  }
  ctx.beginPath(); ctx.moveTo(left[0][0], left[0][1]);
  for (const [lx, ly] of left) ctx.lineTo(lx, ly);
  for (const [rx, ry] of right.reverse()) ctx.lineTo(rx, ry);
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  if (rib) { ctx.strokeStyle = rib; ctx.lineWidth = Math.max(0.5, width * 0.08); ctx.beginPath(); ctx.moveTo(spine[0][0], spine[0][1]); for (const [sx, sy] of spine) ctx.lineTo(sx, sy); ctx.stroke(); }
  return spine[spine.length - 1];
}
const swayAt = (time: number, index: number, speed = 0.8) => Math.sin(time * speed + index * 0.9) + Math.sin(time * speed * 0.53 + index * 2.1) * 0.5;

const vallisneria: Draw = p => {
  const { ctx, w, h, rng, time } = p;
  const leaves = 12 + Math.floor(rng() * 8), hue = pick(rng, [100, 110, 88]);
  for (let i = 0; i < leaves; i++) {
    const x = (rng() - 0.5) * w * 0.9, length = h * (0.55 + rng() * 0.5), width = Math.max(3, w * (0.05 + rng() * 0.04));
    const light = 26 + rng() * 22, lean = (rng() - 0.5) * 0.5, sway = swayAt(time, i);
    if (!inLayer(p, i)) continue;
    const g = ctx.createLinearGradient(x, 0, x, -length); g.addColorStop(0, hsl(hue, 45, light - 10)); g.addColorStop(1, hsl(hue - 20, 55, light + 16));
    ribbon(ctx, x, length, width, lean, (rng() - 0.5) * 0.6 + sway * 0.25, sway, g, hsl(hue, 40, light + 22, 0.35));
  }
};

const sword: Draw = p => {
  const { ctx, w, h, rng, time } = p;
  const leaves = 9 + Math.floor(rng() * 6), hue = pick(rng, [105, 95, 120]);
  for (let i = 0; i < leaves; i++) {
    const spread = (i / (leaves - 1) - 0.5) * 2.2 + (rng() - 0.5) * 0.3, stem = h * (0.25 + rng() * 0.2), sway = swayAt(time, i, 0.6) * 0.05;
    if (!inLayer(p, i)) continue;
    const angle = -Math.PI / 2 + spread * 0.55 + sway, sx = Math.cos(angle) * stem, sy = Math.sin(angle) * stem;
    ctx.strokeStyle = hsl(hue, 35, 30); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(sx * 0.3, sy * 0.7, sx, sy); ctx.stroke();
    const bladeL = h * (0.35 + rng() * 0.25), bladeW = w * (0.12 + rng() * 0.06), light = 28 + rng() * 18;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(angle + Math.PI / 2 + spread * 0.12);
    const g = ctx.createLinearGradient(-bladeW, 0, bladeW, 0); g.addColorStop(0, hsl(hue, 50, light + 12)); g.addColorStop(1, hsl(hue, 48, light - 8));
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-bladeW, -bladeL * 0.3, -bladeW * 0.6, -bladeL * 0.8, 0, -bladeL); ctx.bezierCurveTo(bladeW * 0.6, -bladeL * 0.8, bladeW, -bladeL * 0.3, 0, 0); ctx.fill();
    ctx.strokeStyle = hsl(hue, 30, light + 25, 0.5); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -bladeL * 0.95); ctx.stroke();
    ctx.restore();
  }
};

const fern: Draw = p => {
  const { ctx, w, h, rng, time } = p;
  const fronds = 6 + Math.floor(rng() * 5), hue = pick(rng, [120, 110, 135]);
  for (let i = 0; i < fronds; i++) {
    const x = (rng() - 0.5) * w * 0.5, length = h * (0.5 + rng() * 0.45), width = w * (0.14 + rng() * 0.06), sway = swayAt(time, i, 0.5);
    if (!inLayer(p, i)) continue;
    const light = 18 + rng() * 12, lean = (i / fronds - 0.5) * 1.6 + (rng() - 0.5) * 0.3;
    const g = ctx.createLinearGradient(0, 0, 0, -length); g.addColorStop(0, hsl(hue, 40, light - 4)); g.addColorStop(1, hsl(hue - 10, 45, light + 10));
    const tip = ribbon(ctx, x, length, width, lean, (rng() - 0.5) * 0.8 + sway * 0.15, sway * 0.6, g, hsl(hue, 30, light + 25, 0.5));
    ctx.fillStyle = 'rgba(70,40,15,.55)';
    for (let d = 0; d < 4; d++) { ctx.beginPath(); ctx.arc(lerp(x, tip[0], 0.5 + d * 0.1) + (rng() - 0.5) * 3, lerp(0, tip[1], 0.5 + d * 0.1), 0.9, 0, TAU); ctx.fill(); }
  }
};

const ludwigia: Draw = p => {
  const { ctx, w, h, rng, time } = p;
  const stems = 5 + Math.floor(rng() * 4), redHue = pick(rng, [355, 10, 340]);
  for (let s = 0; s < stems; s++) {
    if (!inLayer(p, s, 0.35)) continue;
    const x = (rng() - 0.5) * w * 0.8, length = h * (0.6 + rng() * 0.45), nodes = 7 + Math.floor(rng() * 4), sway = swayAt(time, s, 0.5);
    ctx.strokeStyle = hsl(20, 30, 30); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x, 0);
    const pts: [number, number][] = [];
    for (let n = 1; n <= nodes; n++) { const t = n / nodes, px = x + sway * t * t * w * 0.15 + Math.sin(t * 3 + s) * 3, py = -length * t; pts.push([px, py]); ctx.lineTo(px, py); }
    ctx.stroke();
    pts.forEach(([px, py], n) => {
      const t = (n + 1) / nodes, size = w * (0.09 - t * 0.04) + 2, hue = (lerp(110, redHue > 180 ? redHue - 360 : redHue, Math.pow(t, 1.3)) + 360) % 360, light = lerp(30, 42, t);
      for (const side of [-1, 1]) {
        ctx.fillStyle = hsl(hue, lerp(45, 65, t), light);
        ctx.beginPath(); ctx.ellipse(px + side * size * 0.8, py + size * 0.1, size, size * 0.42, side * -0.5 + sway * 0.05, 0, TAU); ctx.fill();
      }
    });
  }
};

const cabomba: Draw = p => {
  const { ctx, w, h, rng, time } = p;
  const stems = 5 + Math.floor(rng() * 3), hue = pick(rng, [95, 85, 110]);
  for (let s = 0; s < stems; s++) {
    if (!inLayer(p, s, 0.35)) continue;
    const x = (rng() - 0.5) * w * 0.8, length = h * (0.65 + rng() * 0.4), nodes = 8, sway = swayAt(time, s, 0.55);
    for (let n = 1; n <= nodes; n++) {
      const t = n / nodes, px = x + sway * t * t * w * 0.18, py = -length * t, radius = w * (0.13 - t * 0.05) + 3;
      ctx.strokeStyle = hsl(hue, 55, 34 + t * 18, 0.9); ctx.lineWidth = 0.9;
      for (let f = 0; f < 10; f++) {
        const a = Math.PI + f / 9 * Math.PI + sway * 0.05;
        ctx.beginPath(); ctx.moveTo(px, py);
        ctx.quadraticCurveTo(px + Math.cos(a) * radius * 0.5, py + Math.sin(a) * radius * 0.25 - 2, px + Math.cos(a) * radius, py + Math.sin(a) * radius * 0.5 - 3); ctx.stroke();
      }
    }
    ctx.strokeStyle = hsl(hue, 35, 28); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, 0);
    for (let n = 1; n <= nodes; n++) { const t = n / nodes; ctx.lineTo(x + sway * t * t * w * 0.18, -length * t); }
    ctx.stroke();
  }
};

const hairgrass: Draw = p => {
  const { ctx, w, h, rng, time } = p;
  const blades = Math.round(50 + w * 0.9), hue = pick(rng, [95, 105, 85]);
  ctx.lineCap = 'round';
  for (let i = 0; i < blades; i++) {
    const x = (rng() - 0.5) * w * 1.3, length = h * (0.25 + rng() * 0.75) * (1 - Math.abs(x) / w * 0.6), light = 30 + rng() * 26;
    if (!inLayer(p, i, 0.45)) continue;
    const sway = Math.sin(time * 1.1 + x * 0.05) * length * 0.18;
    ctx.strokeStyle = hsl(hue, 55, light); ctx.lineWidth = 0.9 + rng() * 0.6;
    ctx.beginPath(); ctx.moveTo(x, 1); ctx.quadraticCurveTo(x + sway * 0.3, -length * 0.5, x + sway + (rng() - 0.5) * 4, -length); ctx.stroke();
  }
};

const moss: Draw = p => {
  const { ctx, w, h, rng } = p;
  if (p.layer === 'front') return;
  const balls = 3 + Math.floor(rng() * 3);
  for (let b = 0; b < balls; b++) {
    const r = Math.min(h, w * 0.5) * (0.28 + rng() * 0.22), x = (rng() - 0.5) * (w - r), y = -r * 0.92;
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, hsl(105, 50, 44)); g.addColorStop(0.7, hsl(115, 55, 24)); g.addColorStop(1, hsl(120, 60, 12));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = hsl(100, 45, 38, 0.7);
    for (let f = 0; f < 36; f++) { const a = rng() * TAU, d = r * (0.9 + rng() * 0.15); ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 0.8, 0, TAU); ctx.fill(); }
  }
};

/** Lotus leaves grow from the base; `surfaceY` is how far above the base the waterline sits. */
const lotus = (surfaceY: number): Draw => p => {
  const { ctx, w, h, rng, time } = p;
  const hue = pick(rng, [352, 8, 345, 18, 358, 12]), leaves = 5 + Math.floor(rng() * 3);
  for (let i = 0; i < leaves; i++) {
    if (!inLayer(p, i)) continue;
    const angle = -Math.PI / 2 + (i / (leaves - 1) - 0.5) * 2 + swayAt(time, i, 0.5) * 0.05, stem = h * (0.3 + rng() * 0.35);
    const sx = Math.cos(angle) * stem, sy = Math.sin(angle) * stem, size = w * (0.16 + rng() * 0.08);
    ctx.strokeStyle = hsl(hue, 30, 26); ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(sx * 0.2, sy * 0.6, sx, sy); ctx.stroke();
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(angle + Math.PI / 2);
    const g = ctx.createRadialGradient(0, -size * 0.6, 1, 0, -size * 0.5, size * 1.1);
    g.addColorStop(0, hsl(hue, 58, 44)); g.addColorStop(1, hsl(hue, 62, 20));
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-size * 0.9, -size * 0.1, -size * 0.75, -size * 1.1, 0, -size * 1.6); ctx.bezierCurveTo(size * 0.75, -size * 1.1, size * 0.9, -size * 0.1, 0, 0); ctx.fill();
    ctx.strokeStyle = hsl(hue, 40, 60, 0.35); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(0, -size * 0.1); ctx.lineTo(0, -size * 1.45); ctx.stroke();
    ctx.fillStyle = 'rgba(40,5,10,.45)';
    for (let d = 0; d < 7; d++) { ctx.beginPath(); ctx.arc((rng() - 0.5) * size, -size * (0.3 + rng() * 0.7), 0.8 + rng() * 1.6, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  if (p.layer === 'front') return;
  const pads = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < pads; i++) {
    const px = (rng() - 0.5) * w * 1.6 + Math.sin(time * 0.3 + i) * 3, size = w * (0.28 + rng() * 0.12);
    ctx.strokeStyle = hsl(90, 30, 30, 0.8); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -h * 0.2); ctx.bezierCurveTo(px * 0.2, -surfaceY * 0.5, px, -surfaceY * 0.7, px, -surfaceY); ctx.stroke();
    ctx.fillStyle = hsl(110, 45, 30); ctx.beginPath(); ctx.ellipse(px, -surfaceY, size, size * 0.12, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = hsl(100, 40, 45, 0.5); ctx.beginPath(); ctx.ellipse(px, -surfaceY - size * 0.05, size * 0.9, size * 0.05, 0, 0, TAU); ctx.fill();
    if (i === 0 && p.variant % 2 === 1) {
      ctx.fillStyle = '#f8d4e4';
      for (let petal = 0; petal < 5; petal++) { ctx.beginPath(); ctx.ellipse(px + (petal - 2) * size * 0.1, -surfaceY - size * 0.18, size * 0.07, size * 0.2, (petal - 2) * 0.35, 0, TAU); ctx.fill(); }
    }
  }
};

/** Floating plants hang from the waterline: origin is at the surface and roots trail downward. */
const frogbit: Draw = p => {
  const { ctx, w, h, rng, time } = p;
  const leaves = 7 + Math.floor(rng() * 6);
  for (let i = 0; i < leaves; i++) {
    const x = (rng() - 0.5) * w * 1.6 + Math.sin(time * 0.25 + i) * 2, size = w * (0.09 + rng() * 0.06), roots = h * (0.4 + rng() * 0.7);
    if (p.layer !== 'front') {
      ctx.strokeStyle = 'rgba(210,225,200,.35)'; ctx.lineWidth = 0.7;
      for (let r = 0; r < 4; r++) {
        const rx = x + (rng() - 0.5) * size, sway = Math.sin(time * 0.7 + i + r) * 5;
        ctx.beginPath(); ctx.moveTo(rx, 2); ctx.bezierCurveTo(rx + sway * 0.3, roots * 0.3, rx - sway, roots * 0.6, rx + sway, roots * (0.6 + rng() * 0.4)); ctx.stroke();
      }
    }
    if (p.layer === 'back') continue;
    const g = ctx.createLinearGradient(0, -size * 0.2, 0, size * 0.2); g.addColorStop(0, hsl(95, 55, 46)); g.addColorStop(1, hsl(110, 50, 22));
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, 0, size, size * 0.34, (rng() - 0.5) * 0.1, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(20,50,15,.6)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.ellipse(x, 0, size, size * 0.34, 0, 0.1, Math.PI - 0.1); ctx.stroke();
    ctx.fillStyle = 'rgba(200,255,200,.25)'; ctx.beginPath(); ctx.ellipse(x - size * 0.2, -size * 0.06, size * 0.5, size * 0.05, 0, 0, TAU); ctx.fill();
  }
};

type Drawer = { draw: Draw; /** Visual height as a multiple of footprint radius × tank height. */ height: number; animated: boolean };
export const PIECE_DRAWERS: Record<string, Drawer> = {
  'plant-vallisneria': { draw: vallisneria, height: 5.4, animated: true },
  'plant-sword': { draw: sword, height: 4, animated: true },
  'plant-fern': { draw: fern, height: 3.4, animated: true },
  'plant-ludwigia': { draw: ludwigia, height: 4.8, animated: true },
  'plant-cabomba': { draw: cabomba, height: 5, animated: true },
  'plant-hairgrass': { draw: hairgrass, height: 1.35, animated: true },
  'plant-moss': { draw: moss, height: 2, animated: false },
  'plant-lotus': { draw: lotus(0), height: 3, animated: true },
  'plant-frogbit': { draw: frogbit, height: 2.4, animated: true },
  'rock-river': { draw: riverStones, height: 0, animated: false },
  'rock-seiryu': { draw: seiryu, height: 0, animated: false },
  'rock-lava': { draw: lava, height: 0, animated: false },
  'rock-slate': { draw: slate, height: 0, animated: false },
  'rock-boulder': { draw: boulder, height: 0, animated: false },
  'rock-cave': { draw: cave, height: 0, animated: false },
  'wood-drift': { draw: driftwood, height: 0, animated: false },
  'wood-spider': { draw: spiderwood, height: 0, animated: false },
  'wood-log': { draw: log, height: 0, animated: false },
  'wood-roots': { draw: roots, height: 0, animated: false },
  'orn-pagoda': { draw: pagoda, height: 0, animated: false },
  'orn-lantern': { draw: lantern, height: 0, animated: false },
  'orn-castle': { draw: castle, height: 0, animated: false },
  'orn-amphora': { draw: amphora, height: 0, animated: false },
  'orn-chest': { draw: chest, height: 0, animated: false },
  'orn-clam': { draw: clam, height: 0, animated: false },
  'orn-bubbler': { draw: bubbler, height: 0, animated: false },
};
/** Lotus pads need to know where the waterline is, which depends on the tank's size. */
export const drawLotus = (surfaceAbove: number) => lotus(surfaceAbove);
