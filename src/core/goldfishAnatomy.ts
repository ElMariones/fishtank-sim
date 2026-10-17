import type { GoldfishPhenotype } from './goldfishGenetics';
import { hash, random } from './random';

/**
 * Goldfish anatomy v1: pure goldfish phenotype → body-space geometry shared by the tank, portraits and picking.
 * Units are body lengths (BL) with the koi convention: origin mid-body, +x toward the tail, +y ventral (canvas down);
 * renderers multiply by size × phenotype.length. A buoyancy tilt is applied to every point here, so a fish floating
 * head-down is picked exactly where it is drawn. No Canvas, DOM or inheritance decisions belong here.
 */
export const GOLDFISH_ANATOMY_VERSION = 1 as const;
/** Largest vertical displacement the swimming animation may add to caudal tips (BL). */
export const GOLDFISH_TAIL_WAVE = 0.05;
const SAMPLES = 40;
const SNOUT = -0.5, PEDUNCLE = 0.3;

export type GVec = { x: number; y: number };
export type GBounds = { minX: number; maxX: number; minY: number; maxY: number };
/** One caudal lobe pair (upper and lower tips around a notch). `far` lobes sit behind the body in side view. */
export type GLobe = { root: GVec; baseTop: GVec; baseBottom: GVec; upperTip: GVec; upperOuter: GVec; notch: GVec; lowerOuter: GVec; lowerTip: GVec; far: boolean; fused: boolean };
/** A fin as a closed outline from root to root. */
export type GFin = { points: GVec[]; far: boolean; rays: [GVec, GVec][] };
export type GBump = { x: number; y: number; r: number };
export type GoldfishAnatomy = {
  version: typeof GOLDFISH_ANATOMY_VERSION;
  /** Body outline: dorsal and ventral profiles from snout to peduncle (before the tilt they are x-monotonic). */
  top: GVec[]; bottom: GVec[];
  head: { gillTop: GVec; gillBottom: GVec; gillFlare: number; mouth: GVec; cheek: GVec };
  eye: { center: GVec; radius: number; socket: GVec; kind: GoldfishPhenotype['eyes']['kind']; protrusion: number };
  bubble: { center: GVec; rx: number; ry: number } | null;
  hood: GBump[];
  pompons: GBump[];
  dorsal: GFin | null;
  pectoral: GFin; pelvic: GFin; anal: GFin[];
  /** Body-plan modules (Genesis model 2, body-plan set 2): present only when expressed, so other fish keep their geometry. */
  dorsal2?: GFin; pectoral2?: GFin;
  lobes: GLobe[];
  /** Conservative bounds including fins, hood, bubble sacs and the full tail wave. */
  bounds: GBounds;
  tilt: number;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

/** Half-height of the body at t (0 snout … 1 peduncle), relative to its maximum. Round bodies are blunt and egg-shaped. */
function profile(t: number, roundness: number, pedRatio: number): number {
  const peak = 0.4 - 0.12 * roundness;
  if (t <= peak) return Math.pow(1 - Math.pow(1 - t / peak, 2), 0.62 - 0.22 * roundness);
  const u = (t - peak) / (1 - peak), smooth = u * u * (3 - 2 * u);
  // An egg taper: round bodies stay full a little longer, but every body narrows smoothly into the peduncle.
  return 1 - (1 - pedRatio) * Math.pow(u + (smooth - u) * (0.35 + 0.4 * roundness), 0.9 + 0.25 * roundness);
}

function finOutline(root0: GVec, root1: GVec, tip: GVec, belly: number, rays: number): GFin {
  const points: GVec[] = [], count = 14;
  // Leading edge root0 → tip, trailing edge tip → root1, each a quadratic with a soft belly.
  const lead = { x: lerp(root0.x, tip.x, 0.5) - belly * (tip.y - root0.y), y: lerp(root0.y, tip.y, 0.5) + belly * (tip.x - root0.x) };
  const trail = { x: lerp(tip.x, root1.x, 0.5) + belly * 0.5 * (root1.y - tip.y), y: lerp(tip.y, root1.y, 0.5) - belly * 0.5 * (root1.x - tip.x) };
  const quad = (a: GVec, c: GVec, b: GVec, t: number): GVec => ({ x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t * t * b.y });
  for (let i = 0; i <= count; i++) points.push(quad(root0, lead, tip, i / count));
  for (let i = 1; i <= count; i++) points.push(quad(tip, trail, root1, i / count));
  const rayCount = Math.max(3, Math.round(5 + rays * 5)), out: [GVec, GVec][] = [];
  for (let i = 1; i < rayCount; i++) {
    const t = i / rayCount, base = { x: lerp(root0.x, root1.x, t), y: lerp(root0.y, root1.y, t) }, edge = points[Math.round(t * (points.length - 1))];
    out.push([base, { x: lerp(base.x, edge.x, 0.94), y: lerp(base.y, edge.y, 0.94) }]);
  }
  return { points, far: false, rays: out };
}

export function buildGoldfishAnatomy(p: GoldfishPhenotype): GoldfishAnatomy {
  const b = p.body, f = p.fins, t = p.tail, h = b.depth / 2, round = b.roundness;
  const pedHalf = 0.034 + 0.03 * b.peduncle + 0.012 * (t.kind !== 'single' ? 1 : 0);
  const pedRatio = clamp(pedHalf / h, 0.12, 0.6);
  const noDorsal = f.dorsal !== 'full';
  // The ryukin hump sits behind the head; without a dorsal fin the arch becomes the ranchu's long back curve.
  const arch = (u: number) => b.arch * 0.11 * b.depth * Math.exp(-(((u - (noDorsal ? 0.45 : 0.3)) / (noDorsal ? 0.32 : 0.2)) ** 2));
  const top: GVec[] = [], bottom: GVec[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const u = i / SAMPLES, x = lerp(SNOUT, PEDUNCLE, u), half = h * profile(u, round, pedRatio);
    top.push({ x, y: -half * 0.94 - arch(u) });
    bottom.push({ x, y: half * (1.04 + 0.1 * round) });
  }
  const at = (points: GVec[], x: number) => { const u = clamp((x - SNOUT) / (PEDUNCLE - SNOUT)); const i = u * SAMPLES, j = Math.min(SAMPLES - 1, Math.floor(i)); return lerp(points[j].y, points[j + 1].y, i - j); };

  // ── Head ──
  const headEnd = SNOUT + 0.26 + 0.04 * p.head.width;
  const eyeX = SNOUT + 0.1 + 0.04 * p.head.snout, eyeR = p.eyes.size * (1 + 0.15 * (p.eyes.kind === 'normal' ? 0 : 1));
  const headTop = at(top, eyeX);
  let eyeCenter: GVec = { x: eyeX, y: headTop * 0.3 };
  const socket = { ...eyeCenter };
  if (p.eyes.kind === 'telescope' || p.eyes.kind === 'skygazer') eyeCenter = { x: eyeX - 0.012 * p.eyes.protrusion, y: eyeCenter.y - (p.eyes.kind === 'skygazer' ? 0.04 * p.eyes.protrusion : 0) };
  if (p.eyes.kind === 'celestial') eyeCenter = { x: eyeX + 0.01, y: headTop + eyeR * (0.6 - 0.9 * p.eyes.protrusion) };
  const eyeRadius = eyeR * (1 + 0.55 * p.eyes.protrusion);
  const bubble = p.eyes.bubble > 0 ? { center: { x: eyeX + 0.015, y: eyeCenter.y + eyeRadius + 0.05 * p.eyes.bubble + 0.02 }, rx: 0.045 + 0.075 * p.eyes.bubble, ry: 0.04 + 0.07 * p.eyes.bubble } : null;
  const gillX = headEnd, gillTop = { x: gillX, y: at(top, gillX) * 0.55 }, gillBottom = { x: gillX - 0.02, y: at(bottom, gillX) * 0.75 };
  const mouth = { x: SNOUT - 0.004, y: at(bottom, SNOUT + 0.02) * 0.1 + 0.01 }, cheek = { x: lerp(SNOUT, gillX, 0.6), y: at(bottom, gillX) * 0.35 };

  // ── Hood (wen): lumpy bumps over the crown, cheeks, or whole face; seeded by the unphased genotype for stable lumps ──
  const hood: GBump[] = [];
  if (p.head.hood > 0) {
    const rng = random(hash(`goldfish:hood:${p.pattern.seed}`)), size = p.head.hood;
    const reach = p.head.hoodKind === 'crown' ? 0.35 : p.head.hoodKind === 'cheeks' ? 0.7 : 1;
    const count = Math.round(10 + 18 * size * reach);
    for (let i = 0; i < count; i++) {
      // Points on a band around the head: the crown first, then down over the cheeks and gill covers as reach grows.
      const a = -Math.PI / 2 + (rng() * 2 - 1) * (0.55 + 1.6 * reach) * 0.6;
      const cx = lerp(SNOUT + 0.03, headEnd + 0.02, 0.15 + rng() * 0.75), headHalf = -at(top, cx);
      const ry = headHalf * (0.85 + 0.3 * size), x = cx + Math.cos(a) * 0.02, y = Math.sin(a) * ry * 0.95 + (a > -Math.PI / 2 + 0.6 ? 0.02 : 0);
      if (Math.abs(x - eyeCenter.x) < eyeRadius * 1.4 && Math.abs(y - eyeCenter.y) < eyeRadius * 1.4 && size < 0.85) continue;
      hood.push({ x, y, r: (0.014 + 0.028 * size) * (0.7 + 0.6 * rng()) });
    }
  }
  const pompons: GBump[] = p.head.pompon > 0 ? [0, 1].map(i => ({ x: eyeX - 0.055 + i * 0.012, y: eyeCenter.y + 0.012 + i * 0.008, r: 0.018 + 0.032 * p.head.pompon })) : [];

  // ── Fins ──
  const L = f.length, plan = p.genesis.modules, twin = Boolean(plan?.secondDorsal) && f.dorsal === 'full';
  const dorsal = f.dorsal === 'absent' ? null : (() => {
    // A second dorsal fin takes the rear of the dorsal base, so the first one shortens.
    const x0 = -0.12 + 0.04 * round, x1 = x0 + (f.dorsal === 'remnant' ? 0.06 : twin ? 0.19 : 0.3), height = f.dorsal === 'remnant' ? 0.03 : f.dorsalHeight * (0.75 + 0.35 * (L - 1)) * (0.85 + 0.15 * f.rays);
    const r0 = { x: x0, y: at(top, x0) + 0.012 }, r1 = { x: x1, y: at(top, x1) + 0.012 };
    const droop = (1 - f.rays) * 0.35 * Math.max(0, L - 1);
    return finOutline(r0, r1, { x: x0 + 0.1 + height * (0.45 + droop), y: at(top, x0) - height * (1 - 0.4 * droop) }, 0.24, f.rays);
  })();
  const dorsal2 = twin ? (() => {
    const x0 = -0.12 + 0.04 * round + 0.215, x1 = Math.min(PEDUNCLE - 0.06, x0 + 0.13), size = plan!.secondDorsal;
    const height = f.dorsalHeight * (0.75 + 0.35 * (L - 1)) * (0.85 + 0.15 * f.rays) * (0.45 + 0.35 * size);
    const r0 = { x: x0, y: at(top, x0) + 0.012 }, r1 = { x: x1, y: at(top, x1) + 0.012 };
    return finOutline(r0, r1, { x: x0 + 0.05 + height * 0.5, y: at(top, x0) - height }, 0.22, f.rays);
  })() : null;
  const pecRoot = { x: gillX + 0.03, y: at(bottom, gillX + 0.03) * 0.55 };
  const pectoral = finOutline(pecRoot, { x: pecRoot.x + 0.06, y: pecRoot.y + 0.015 }, { x: pecRoot.x + 0.1 + 0.05 * L, y: pecRoot.y + 0.06 + 0.035 * L }, 0.34, f.rays);
  // A second pectoral pair grows just behind and below the first, shorter by its module size.
  const pectoral2 = plan?.doublePectoral ? (() => {
    const x = pecRoot.x + 0.075, root = { x, y: at(bottom, x) * 0.68 }, s = 0.55 + 0.4 * plan.doublePectoral;
    return finOutline(root, { x: root.x + 0.05, y: root.y + 0.012 }, { x: root.x + (0.08 + 0.05 * L) * s, y: root.y + (0.05 + 0.035 * L) * s }, 0.32, f.rays);
  })() : null;
  const pelX = -0.05 + 0.04 * round, pelRoot = { x: pelX, y: at(bottom, pelX) - 0.01 };
  const pelvic = finOutline(pelRoot, { x: pelX + 0.07, y: at(bottom, pelX + 0.07) - 0.012 }, { x: pelX + 0.1 + 0.05 * L, y: pelRoot.y + 0.05 + 0.045 * L }, 0.32, f.rays);
  const anX = 0.14, anRoot = { x: anX, y: at(bottom, anX) - 0.008 };
  const analOne = (dx: number, far: boolean) => ({ ...finOutline({ x: anRoot.x + dx, y: anRoot.y }, { x: anRoot.x + 0.08 + dx, y: at(bottom, anX + 0.08) - 0.01 }, { x: anRoot.x + 0.11 + 0.04 * L + dx, y: anRoot.y + 0.04 + 0.04 * L }, 0.3, f.rays), far });
  const anal = f.analPaired ? [analOne(0.015, true), analOne(0, false)] : [analOne(0, false)];

  // ── Caudal (chdA): single, tri, twin or four-lobed; spread, fork, carriage and length set the lobes ──
  const root = { x: PEDUNCLE - 0.01, y: 0 };
  const length = (0.22 + 0.06 * (t.kind === 'single' ? 1 : 0.8)) * L * (t.veil ? 1.15 : 1);
  const spanY = (0.1 + 0.11 * t.spread + (t.butterfly ? 0.06 : 0)) * Math.min(1.7, L);
  const droop = t.kind === 'single' ? 0 : (1 - t.carriage) * 0.55 + (L > 1.6 ? (1 - f.rays) * 0.15 : 0);
  const notchDepth = t.veil ? 0.12 : 0.25 + 0.55 * t.fork;
  const rotate = (v: GVec, angle: number): GVec => ({ x: root.x + (v.x - root.x) * Math.cos(angle) - (v.y - root.y) * Math.sin(angle), y: root.y + (v.x - root.x) * Math.sin(angle) + (v.y - root.y) * Math.cos(angle) });
  const lobe = (scale: number, angle: number, far: boolean, fused: boolean, lift = 0): GLobe => {
    const len = length * scale, span = spanY * scale, end = root.x + len;
    // The fin base runs across the peduncle, inside the body, so the tail grows out of it without a hard edge.
    const baseTop = { x: PEDUNCLE - 0.045, y: -pedHalf * 0.85 + lift }, baseBottom = { x: PEDUNCLE - 0.045, y: pedHalf * 0.85 + lift };
    const raw: Omit<GLobe, 'far' | 'fused'> = {
      root, baseTop, baseBottom, upperTip: { x: end + (t.veil ? 0 : 0.02), y: -span + lift }, upperOuter: { x: root.x + len * 0.45, y: -span * 0.75 + lift },
      notch: { x: end - len * (fused ? 0.08 : notchDepth), y: lift * 0.5 }, lowerOuter: { x: root.x + len * 0.45, y: span * 0.75 + lift }, lowerTip: { x: end, y: span + lift },
    };
    const r = (v: GVec) => rotate(v, angle);
    return { root, baseTop: r(baseTop), baseBottom: r(baseBottom), upperTip: r(raw.upperTip), upperOuter: r(raw.upperOuter), notch: r(raw.notch), lowerOuter: r(raw.lowerOuter), lowerTip: r(raw.lowerTip), far, fused };
  };
  const lobes: GLobe[] = t.kind === 'single' ? [lobe(1, 0, false, false)]
    : t.kind === 'tri' ? [lobe(0.92, droop * 0.5 - 0.1, true, false, -0.015), lobe(1, droop * 0.5 + 0.02, false, false)]
    : t.kind === 'quad' ? [lobe(0.98, droop * 0.5 + 0.12, true, false, 0.02), lobe(0.9, droop * 0.5 - 0.1, true, false), lobe(1, droop * 0.5 + 0.04, false, false, 0.01), lobe(0.92, droop * 0.5 - 0.14, false, false)]
    : [lobe(0.94, droop * 0.5 - 0.12 - 0.1 * t.split, true, false, -0.02), lobe(1, droop * 0.5 + 0.03, false, false)];
  if (t.kind === 'tri') lobes[1] = { ...lobes[1], fused: true };

  // ── Tilt: a weak swim bladder floats the fish head-down (negative rotation lowers the snout) ──
  const tilt = -p.health.buoyancy;
  const turn = (v: GVec): GVec => tilt ? { x: v.x * Math.cos(tilt) - v.y * Math.sin(tilt), y: v.x * Math.sin(tilt) + v.y * Math.cos(tilt) } : v;
  const turnFin = (fin: GFin): GFin => ({ ...fin, points: fin.points.map(turn), rays: fin.rays.map(([a, c]) => [turn(a), turn(c)] as [GVec, GVec]) });
  const turnBump = (bump: GBump): GBump => ({ ...turn(bump), r: bump.r });
  const anatomy: Omit<GoldfishAnatomy, 'bounds'> = {
    version: GOLDFISH_ANATOMY_VERSION, top: top.map(turn), bottom: bottom.map(turn),
    head: { gillTop: turn(gillTop), gillBottom: turn(gillBottom), gillFlare: p.head.gillCurl ? 0.03 : 0, mouth: turn(mouth), cheek: turn(cheek) },
    eye: { center: turn(eyeCenter), radius: eyeRadius, socket: turn(socket), kind: p.eyes.kind, protrusion: p.eyes.protrusion },
    bubble: bubble ? { ...bubble, center: turn(bubble.center) } : null,
    hood: hood.map(turnBump), pompons: pompons.map(turnBump),
    dorsal: dorsal ? turnFin(dorsal) : null, pectoral: turnFin(pectoral), pelvic: turnFin(pelvic), anal: anal.map(turnFin),
    ...(dorsal2 ? { dorsal2: turnFin(dorsal2) } : {}), ...(pectoral2 ? { pectoral2: turnFin(pectoral2) } : {}),
    lobes: lobes.map(l => ({ ...l, root: turn(l.root), baseTop: turn(l.baseTop), baseBottom: turn(l.baseBottom), upperTip: turn(l.upperTip), upperOuter: turn(l.upperOuter), notch: turn(l.notch), lowerOuter: turn(l.lowerOuter), lowerTip: turn(l.lowerTip) })),
    tilt,
  };
  return { ...anatomy, bounds: boundsOf(anatomy) };
}

function boundsOf(a: Omit<GoldfishAnatomy, 'bounds'>): GBounds {
  const points: GVec[] = [...a.top, ...a.bottom, ...(a.dorsal?.points ?? []), ...a.pectoral.points, ...a.pelvic.points, ...a.anal.flatMap(fin => fin.points),
    ...(a.dorsal2?.points ?? []), ...(a.pectoral2?.points ?? [])];
  for (const l of a.lobes) points.push(l.upperTip, l.lowerTip, l.upperOuter, l.lowerOuter, l.notch);
  const circles = [...a.hood, ...a.pompons, { ...a.eye.center, r: a.eye.radius }];
  if (a.bubble) circles.push({ ...a.bubble.center, r: Math.max(a.bubble.rx, a.bubble.ry) });
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const v of points) { minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x); minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y); }
  for (const c of circles) { minX = Math.min(minX, c.x - c.r); maxX = Math.max(maxX, c.x + c.r); minY = Math.min(minY, c.y - c.r); maxY = Math.max(maxY, c.y + c.r); }
  const m = 0.012;
  return { minX: minX - m, maxX: maxX + m, minY: minY - m - GOLDFISH_TAIL_WAVE, maxY: maxY + m + GOLDFISH_TAIL_WAVE };
}

const cache = new WeakMap<GoldfishPhenotype, GoldfishAnatomy>();
export function goldfishAnatomyFor(p: GoldfishPhenotype): GoldfishAnatomy {
  let a = cache.get(p);
  if (!a) { a = buildGoldfishAnatomy(p); cache.set(p, a); }
  return a;
}

function inPolygon(points: readonly GVec[], p: GVec): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
const lobePolygon = (l: GLobe) => [l.baseTop, l.upperOuter, l.upperTip, l.notch, l.lowerTip, l.lowerOuter, l.baseBottom];

/** True when a body-space point lies on the fish or within `tolerance` BL of its bounds-tested parts. */
export function goldfishContainsPoint(a: GoldfishAnatomy, p: GVec, tolerance = 0.025): boolean {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
  const t = clamp(tolerance, 0, 0.12);
  if (p.x < a.bounds.minX - t || p.x > a.bounds.maxX + t || p.y < a.bounds.minY - t || p.y > a.bounds.maxY + t) return false;
  if (inPolygon([...a.top, ...[...a.bottom].reverse()], p)) return true;
  for (const fin of [a.dorsal, a.pectoral, a.pelvic, ...a.anal, a.dorsal2, a.pectoral2]) if (fin && inPolygon(fin.points, p)) return true;
  if (a.lobes.some(l => inPolygon(lobePolygon(l), p))) return true;
  const near = (c: GBump) => Math.hypot(p.x - c.x, p.y - c.y) <= c.r + t;
  if ([...a.hood, ...a.pompons, { ...a.eye.center, r: a.eye.radius }].some(near)) return true;
  return !!a.bubble && near({ ...a.bubble.center, r: Math.max(a.bubble.rx, a.bubble.ry) });
}

export type GoldfishPortraitFrame = { originX: number; originY: number; size: number };
/** Frame a goldfish in a portrait: `size` is passed to the renderer, which multiplies by the body length. */
export function goldfishPortraitFrame(p: GoldfishPhenotype, width: number, height: number, margin = 0.06): GoldfishPortraitFrame {
  const b = goldfishAnatomyFor(p).bounds;
  const scale = Math.min(width * (1 - 2 * margin) / (b.maxX - b.minX), height * (1 - 2 * margin) / (b.maxY - b.minY));
  return { originX: width / 2 - (b.minX + b.maxX) / 2 * scale, originY: height / 2 - (b.minY + b.maxY) / 2 * scale, size: scale / p.body.length };
}
