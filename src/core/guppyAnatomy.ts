import type { GuppyPhenotype, GuppyTailShape } from './guppyGenetics';

/**
 * Guppy anatomy v1: pure guppy phenotype → body-space geometry shared by the tank, portraits and picking.
 * Units are body lengths (BL) with the koi convention: origin mid-body, +x toward the tail, +y ventral (canvas down);
 * renderers multiply by size × phenotype.body.length. A male's caudal fin is a fan radiating from the peduncle whose
 * outline the tail-shape genes set (round … delta); swords are spikes on the fan's upper or lower edge. Females always
 * carry a short rounded fan. No Canvas, DOM or inheritance decisions belong here.
 */
export const GUPPY_ANATOMY_VERSION = 1 as const;
/** Largest vertical displacement the swimming animation may add to the far edge of the tail (BL). */
export const GUPPY_TAIL_WAVE = 0.06;
const SAMPLES = 36, FAN = 33;
const SNOUT = -0.5, PEDUNCLE = 0.3;

export type PVec = { x: number; y: number };
export type PBounds = { minX: number; maxX: number; minY: number; maxY: number };
export type PFin = { points: PVec[]; rays: [PVec, PVec][] };
/** The caudal fan: `edge` runs from the upper to the lower tip; `reach` is each edge point's distance share (0 root … 1 tip). */
export type PCaudal = { root: PVec; baseTop: PVec; baseBottom: PVec; edge: PVec[]; reach: number[]; length: number; shape: GuppyTailShape; female: boolean };
export type GuppyAnatomy = {
  version: typeof GUPPY_ANATOMY_VERSION;
  top: PVec[]; bottom: PVec[];
  head: { gillTop: PVec; gillBottom: PVec; mouth: PVec };
  eye: { center: PVec; radius: number };
  dorsal: PFin; dorsal2?: PFin;
  pectoral: PFin; pelvic: PFin;
  /** Males: the gonopodium (a rod-like modified anal fin). Females: a small anal fin and the gravid spot above it. */
  anal: PFin; gonopodium: PFin | null; gravidSpot: { center: PVec; rx: number; ry: number } | null;
  caudal: PCaudal;
  bounds: PBounds;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

/** Half-height at t (0 snout … 1 peduncle) relative to the maximum: a pointed head, full shoulders and a long taper. */
function profile(t: number, pedRatio: number, belly: number): number {
  const peak = 0.36 + 0.06 * belly;
  if (t <= peak) return Math.pow(Math.sin((t / peak) * Math.PI / 2), 0.78);
  const u = (t - peak) / (1 - peak), smooth = u * u * (3 - 2 * u);
  return 1 - (1 - pedRatio) * Math.pow(smooth, 0.92);
}

function finOutline(root0: PVec, root1: PVec, tip: PVec, belly: number, rayCount: number): PFin {
  const points: PVec[] = [], count = 12;
  const lead = { x: lerp(root0.x, tip.x, 0.5) - belly * (tip.y - root0.y), y: lerp(root0.y, tip.y, 0.5) + belly * (tip.x - root0.x) };
  const trail = { x: lerp(tip.x, root1.x, 0.5) + belly * 0.5 * (root1.y - tip.y), y: lerp(tip.y, root1.y, 0.5) - belly * 0.5 * (root1.x - tip.x) };
  const quad = (a: PVec, c: PVec, b: PVec, t: number): PVec => ({ x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t * t * b.y });
  for (let i = 0; i <= count; i++) points.push(quad(root0, lead, tip, i / count));
  for (let i = 1; i <= count; i++) points.push(quad(tip, trail, root1, i / count));
  const rays: [PVec, PVec][] = [];
  for (let i = 1; i < rayCount; i++) {
    const t = i / rayCount, base = { x: lerp(root0.x, root1.x, t), y: lerp(root0.y, root1.y, t) }, edge = points[Math.round(t * (points.length - 1))];
    rays.push([base, { x: lerp(base.x, edge.x, 0.93), y: lerp(base.y, edge.y, 0.93) }]);
  }
  return { points, rays };
}

/** Radius of the fan at s (−1 upper edge … 1 lower edge) as a share of the tail length, by shape. */
function fanRadius(shape: GuppyTailShape, s: number, p: GuppyPhenotype['tail']): number {
  const a = Math.abs(s);
  const sword = (side: number, reach: number) => reach * Math.exp(-(((s - side) / 0.16) ** 2));
  switch (shape) {
    case 'round': return 0.82 + 0.18 * Math.cos(s * Math.PI / 2);
    case 'spade': return 1 - 0.42 * a ** 1.4;
    case 'spear': return 1 - 0.62 * a;
    case 'pin': return 0.5 + 0.75 * Math.exp(-((s / 0.12) ** 2));
    case 'lyre': return 0.62 + 0.62 * a ** 5;
    case 'top-sword': return 0.55 + 0.1 * Math.cos(s * Math.PI / 2) + sword(-1, 0.95 + 0.4 * p.top);
    case 'bottom-sword': return 0.55 + 0.1 * Math.cos(s * Math.PI / 2) + sword(1, 0.95 + 0.4 * p.bottom);
    case 'double-sword': return 0.5 + 0.1 * Math.cos(s * Math.PI / 2) + sword(-1, 0.9 + 0.4 * p.top) + sword(1, 0.9 + 0.4 * p.bottom);
    case 'fantail': return 0.9 + 0.1 * Math.cos(s * Math.PI / 2);
    case 'veil': return 0.86 + 0.14 * Math.cos(s * Math.PI / 2) + 0.12 * Math.max(0, s);
    // A delta's trailing edge is straight: the radius grows toward the corners.
    case 'delta': return 1;
  }
}

export function buildGuppyAnatomy(p: GuppyPhenotype): GuppyAnatomy {
  const male = p.sex === 'M', b = p.body, h = b.depth / 2, gravid = clamp(p.gravid ?? 0);
  const pedHalf = 0.03 + 0.025 * b.peduncle, pedRatio = clamp(pedHalf / h, 0.12, 0.5);
  const top: PVec[] = [], bottom: PVec[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const u = i / SAMPLES, x = lerp(SNOUT, PEDUNCLE, u), half = h * profile(u, pedRatio, male ? 0 : 1);
    // A brooding female swells behind the pectorals; the back stays straight.
    const swell = gravid * 0.07 * Math.exp(-(((u - 0.48) / 0.2) ** 2));
    top.push({ x, y: -half * (0.86 + 0.1 * b.profile) });
    bottom.push({ x, y: half * (male ? 0.98 : 1.1) + swell });
  }
  const at = (points: PVec[], x: number) => { const u = clamp((x - SNOUT) / (PEDUNCLE - SNOUT)); const i = u * SAMPLES, j = Math.min(SAMPLES - 1, Math.floor(i)); return lerp(points[j].y, points[j + 1].y, i - j); };

  // ── Head: big eye high on the head, upturned mouth (a surface feeder) ──
  const eyeX = SNOUT + 0.12, eyeRadius = 0.05 + 0.012 * (male ? 1 : 0);
  const eye = { center: { x: eyeX, y: at(top, eyeX) * 0.28 }, radius: eyeRadius };
  const gillX = SNOUT + 0.22, gillTop = { x: gillX, y: at(top, gillX) * 0.55 }, gillBottom = { x: gillX - 0.025, y: at(bottom, gillX) * 0.7 };
  const mouth = { x: SNOUT + 0.005, y: at(top, SNOUT + 0.02) * 0.45 };

  // ── Dorsal: a male's flag sweeps back and can reach past the peduncle; swallows stretch it into a streamer ──
  const f = p.fins, dx0 = -0.02, dx1 = male ? 0.13 : 0.09;
  const dorsalReach = male ? 0.06 + 0.3 * f.dorsal * (0.6 + 0.4 * f.dorsalShape) : 0.05 + 0.06 * f.dorsal;
  const dorsalHeight = male ? 0.06 + 0.1 * f.dorsal : 0.05 + 0.03 * f.dorsal;
  const dorsal = finOutline({ x: dx0, y: at(top, dx0) + 0.008 }, { x: dx1, y: at(top, dx1) + 0.006 },
    { x: dx1 + dorsalReach, y: at(top, dx1) - dorsalHeight }, male ? 0.16 : 0.26, 5 + Math.round(4 * f.dorsalShape));
  const second = p.genesis.modules?.secondDorsal ?? 0;
  const dorsal2 = second ? (() => {
    const x0 = Math.min(PEDUNCLE - 0.12, dx1 + 0.06), x1 = Math.min(PEDUNCLE - 0.04, x0 + 0.08), height = (0.03 + 0.04 * second) * (male ? 1.2 : 1);
    return finOutline({ x: x0, y: at(top, x0) + 0.006 }, { x: x1, y: at(top, x1) + 0.005 }, { x: x1 + 0.03 + 0.04 * second, y: at(top, x1) - height }, 0.22, 4);
  })() : undefined;

  // ── Pectoral: small and clear, except the dumbo's oversized ear fin ──
  const pecRoot = { x: gillX + 0.03, y: at(bottom, gillX + 0.03) * 0.35 };
  const ear = f.dumbo, pecLen = 0.08 + 0.17 * ear;
  const pectoral = finOutline(pecRoot, { x: pecRoot.x + 0.03 + 0.03 * ear, y: pecRoot.y + 0.02 + 0.03 * ear },
    { x: pecRoot.x + pecLen * 0.9, y: pecRoot.y + pecLen * (0.55 + 0.3 * ear) }, 0.3 + 0.15 * ear, 5 + Math.round(4 * ear));

  // ── Pelvic: swallows and ribbons trail long streamers ──
  const pelX = -0.1, pelRoot = { x: pelX, y: at(bottom, pelX) - 0.008 }, pelLen = 0.05 + 0.2 * f.pelvic;
  const pelvic = finOutline(pelRoot, { x: pelX + 0.035, y: at(bottom, pelX + 0.035) - 0.006 }, { x: pelX + 0.035 + pelLen * 0.85, y: pelRoot.y + pelLen * 0.6 }, 0.18, 3);

  // ── Anal fin / gonopodium; the gravid spot of a mature female ──
  const anX = 0.06;
  const anal = finOutline({ x: anX, y: at(bottom, anX) - 0.006 }, { x: anX + 0.07, y: at(bottom, anX + 0.07) - 0.005 },
    { x: anX + 0.1, y: at(bottom, anX) + (male ? 0.025 : 0.05) }, 0.25, 4);
  const gonopodium = male ? (() => {
    // A ribbon male's gonopodium is elongated, which is why he cannot sire.
    const len = b.gonopodium + (f.ribbon ? 0.08 + 0.04 * f.ribbon : 0), x0 = anX - 0.035, root = { x: x0, y: at(bottom, x0) - 0.004 };
    return finOutline(root, { x: x0 + 0.02, y: at(bottom, x0 + 0.02) - 0.004 }, { x: x0 + 0.02 + len * 0.95, y: root.y + len * 0.3 }, 0.04, 2);
  })() : null;
  const gravidSpot = male ? null : { center: { x: anX - 0.035, y: at(bottom, anX - 0.035) * 0.55 }, rx: 0.028 + 0.025 * gravid, ry: 0.02 + 0.016 * gravid };

  // ── Caudal fan ──
  const t = p.tail, shape: GuppyTailShape = male ? t.shape : 'round';
  const length = male ? 0.22 + 0.5 * t.length + (shape === 'veil' ? 0.08 : 0) : 0.2 + 0.04 * b.length;
  const half = male
    ? (shape === 'delta' ? 0.55 + 0.55 * t.spread : shape === 'pin' || shape === 'spear' ? 0.28 + 0.2 * t.spread : 0.38 + 0.55 * t.spread)
    : 0.42;
  const droop = male && shape === 'veil' ? 0.12 + 0.12 * t.length : 0;
  const root = { x: PEDUNCLE - 0.035, y: 0 };
  const edge: PVec[] = [], reach: number[] = [];
  let far = 0;
  for (let i = 0; i < FAN; i++) {
    const s = -1 + 2 * i / (FAN - 1), angle = s * half + droop;
    let r = fanRadius(shape, s, t);
    if (shape === 'delta') r = 1 / Math.max(0.35, Math.cos(s * half)) * Math.cos(half * 0.15);
    const v = { x: root.x + length * r * Math.cos(angle), y: root.y + length * r * Math.sin(angle) };
    edge.push(v); far = Math.max(far, length * r);
  }
  for (const v of edge) reach.push(Math.hypot(v.x - root.x, v.y - root.y) / Math.max(1e-6, far));
  const caudal: PCaudal = { root, baseTop: { x: PEDUNCLE - 0.06, y: -pedHalf * 0.9 }, baseBottom: { x: PEDUNCLE - 0.06, y: pedHalf * 0.9 }, edge, reach, length: far, shape, female: !male };

  const anatomy: Omit<GuppyAnatomy, 'bounds'> = {
    version: GUPPY_ANATOMY_VERSION, top, bottom, head: { gillTop, gillBottom, mouth }, eye,
    dorsal, ...(dorsal2 ? { dorsal2 } : {}), pectoral, pelvic, anal, gonopodium, gravidSpot, caudal,
  };
  return { ...anatomy, bounds: boundsOf(anatomy) };
}

function boundsOf(a: Omit<GuppyAnatomy, 'bounds'>): PBounds {
  const points: PVec[] = [...a.top, ...a.bottom, ...a.dorsal.points, ...(a.dorsal2?.points ?? []), ...a.pectoral.points, ...a.pelvic.points,
    ...a.anal.points, ...(a.gonopodium?.points ?? []), ...a.caudal.edge, a.caudal.baseTop, a.caudal.baseBottom];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const v of points) { minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x); minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y); }
  const e = a.eye;
  minY = Math.min(minY, e.center.y - e.radius);
  const m = 0.012;
  return { minX: minX - m, maxX: maxX + m, minY: minY - m - GUPPY_TAIL_WAVE, maxY: maxY + m + GUPPY_TAIL_WAVE };
}

const cache = new WeakMap<GuppyPhenotype, GuppyAnatomy>();
export function guppyAnatomyFor(p: GuppyPhenotype): GuppyAnatomy {
  let a = cache.get(p);
  if (!a) { a = buildGuppyAnatomy(p); cache.set(p, a); }
  return a;
}

function inPolygon(points: readonly PVec[], p: PVec): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
export const caudalPolygon = (c: PCaudal): PVec[] => [c.baseTop, ...c.edge, c.baseBottom];

/** True when a body-space point lies on the fish, or within `tolerance` BL of its eye. */
export function guppyContainsPoint(a: GuppyAnatomy, p: PVec, tolerance = 0.025): boolean {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
  const t = clamp(tolerance, 0, 0.12);
  if (p.x < a.bounds.minX - t || p.x > a.bounds.maxX + t || p.y < a.bounds.minY - t || p.y > a.bounds.maxY + t) return false;
  // Guppies are slender: widen the body test by the tolerance so small fish stay easy to click.
  const body = [...a.top.map(v => ({ x: v.x, y: v.y - t })), ...[...a.bottom].reverse().map(v => ({ x: v.x, y: v.y + t }))];
  if (inPolygon(body, p)) return true;
  for (const fin of [a.dorsal, a.dorsal2, a.pectoral, a.pelvic, a.anal, a.gonopodium]) if (fin && inPolygon(fin.points, p)) return true;
  if (inPolygon(caudalPolygon(a.caudal), p)) return true;
  return Math.hypot(p.x - a.eye.center.x, p.y - a.eye.center.y) <= a.eye.radius + t;
}

export type GuppyPortraitFrame = { originX: number; originY: number; size: number };
/** Frame a guppy in a portrait: `size` is passed to the renderer, which multiplies by the body length. */
export function guppyPortraitFrame(p: GuppyPhenotype, width: number, height: number, margin = 0.06): GuppyPortraitFrame {
  const b = guppyAnatomyFor(p).bounds;
  const scale = Math.min(width * (1 - 2 * margin) / (b.maxX - b.minX), height * (1 - 2 * margin) / (b.maxY - b.minY));
  return { originX: width / 2 - (b.minX + b.maxX) / 2 * scale, originY: height / 2 - (b.minY + b.maxY) / 2 * scale, size: scale / p.body.length };
}
