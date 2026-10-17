import { MODEL_VERSIONS } from './catalog';
import { clamp } from './random';
import type { Phenotype, Structure } from './types';

/**
 * Anatomy v2: pure phenotype → body-space geometry shared by the tank, portraits and future mesh renderers.
 * Units are body lengths (BL). Origin is mid-body, +x points to the tail, +y is ventral (canvas down).
 * Renderers multiply by size × phenotype.length. No Canvas, DOM, randomness or inheritance decisions belong here.
 * The v1 body Béziers are kept so silhouettes do not drift; v2 moves every anchor onto that measured outline.
 * Anatomy v3 (FS-602) adds genome v3 structure: paired and crown tails as extra lobes rotated about the caudal root,
 * reduced or absent dorsal fins, zero to six barbels, lobe balance and ray density. The standard structure builds exactly
 * the anatomy v2 geometry, so genome v1 and v2 fish never change.
 */
export const ANATOMY_VERSION = MODEL_VERSIONS.anatomy;
/** Largest caudal displacement the swimming animation may add to the tail tips, notch and outer controls (BL). */
export const TAIL_WAVE = 0.045;

const CURVE_SAMPLES = 56;
const SHOULDER_SAMPLES = 28;
const EYE_SAMPLES = 24;
const EYE_MARGIN = 0.004;
const BOUNDS_MARGIN = 0.012;

export type Vec = { x: number; y: number };
export type Curve = { start: Vec; control: Vec; end: Vec };
export type Bounds = { minX: number; maxX: number; minY: number; maxY: number };
export type Section = { top: number; bottom: number; center: number; half: number };
export type Caudal = {
  root: Vec;
  upperInner: Vec; upperOuter: Vec; upperTip: Vec;
  notch: Vec;
  lowerTip: Vec; lowerOuter: Vec; lowerInner: Vec;
  /** Ray ends lie on the trailing edge. Tail wave applies to outer controls, tips, notch and ray ends. */
  rays: Curve[];
  /** Rotation of a paired or crown lobe about `root`, in radians (negative turns upward); absent on a standard tail. */
  angle?: number;
};
export type Anatomy = {
  version: typeof ANATOMY_VERSION;
  snoutX: number;
  /** Dorsal and ventral outline, each x-monotonic from snout tip to peduncle (x = 0.5). */
  top: Vec[];
  bottom: Vec[];
  eye: { center: Vec; radius: number; pupilRadius: number };
  gill: Curve;
  mouth: { tip: Vec; corner: Vec };
  barbels: Curve[];
  /** Fin curves start and end at roots inside the body; the control shapes the free edge. Null when the dorsal fin is absent. */
  dorsal: Curve | null;
  pectoral: Curve;
  /** The first tail lobe; paired and crown tails add `extraLobes` sharing its root. */
  caudal: Caudal;
  extraLobes: Caudal[];
  /**
   * Body-plan modules (R-203, Genesis model 2 only; absent otherwise so older fish keep their exact geometry): a second
   * dorsal fin behind the first, a wen over the head (as an offset of the dorsal outline) and fluid sacs under the eye.
   */
  modules?: AnatomyModules;
  /** Conservative: includes fin controls, the eye and the full tail wave. */
  bounds: Bounds;
  /** Developmental constraints applied to keep anatomy attached, in plain language. */
  adjustments: string[];
};

export type AnatomyModules = {
  dorsal2: Curve | null;
  /** Wen cap: points on the dorsal outline and the cap height above each, in BL. */
  wen: { base: Vec[]; heights: number[] } | null;
  bubble: { center: Vec; rx: number; ry: number } | null;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function cubicPoints(p0: Vec, p1: Vec, p2: Vec, p3: Vec, count: number): Vec[] {
  return Array.from({ length: count + 1 }, (_, i) => {
    const t = i / count, u = 1 - t;
    const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
  });
}

function quadPoints(p0: Vec, p1: Vec, p2: Vec, count: number): Vec[] {
  return Array.from({ length: count + 1 }, (_, i) => {
    const t = i / count, u = 1 - t;
    return { x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y };
  });
}

/** Linear lookup on an x-monotonic polyline; clamps outside its range. */
export function profileY(points: readonly Vec[], x: number): number {
  if (x <= points[0].x) return points[0].y;
  const last = points[points.length - 1];
  if (x >= last.x) return last.y;
  let low = 0, high = points.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (points[middle].x <= x) low = middle; else high = middle;
  }
  const a = points[low], b = points[high];
  return b.x - a.x < 1e-12 ? a.y : lerp(a.y, b.y, (x - a.x) / (b.x - a.x));
}

function sectionOf(top: readonly Vec[], bottom: readonly Vec[], x: number): Section {
  const upper = profileY(top, x), lower = profileY(bottom, x);
  return { top: upper, bottom: lower, center: (upper + lower) / 2, half: (lower - upper) / 2 };
}

export const section = (anatomy: Anatomy, x: number) => sectionOf(anatomy.top, anatomy.bottom, x);

/** Strictly inside the body silhouette (fins excluded). */
export function insideBody(anatomy: Anatomy, point: Vec, tolerance = 1e-9): boolean {
  if (!(point.x > anatomy.snoutX && point.x < 0.5)) return false;
  const s = section(anatomy, point.x);
  return point.y > s.top + tolerance && point.y < s.bottom - tolerance;
}

/** Vertical interval where an eye centre may sit so the whole orbit, plus a margin, stays inside the head. */
function eyeCenterRange(top: readonly Vec[], bottom: readonly Vec[], x: number, radius: number): [number, number] | null {
  let low = -Infinity, high = Infinity;
  for (let i = 0; i < EYE_SAMPLES; i++) {
    const angle = (i / EYE_SAMPLES) * Math.PI * 2;
    const px = x + Math.cos(angle) * radius, dy = Math.sin(angle) * radius;
    if (px <= top[0].x + EYE_MARGIN || px >= 0.5) return null;
    const s = sectionOf(top, bottom, px);
    low = Math.max(low, s.top + EYE_MARGIN - dy);
    high = Math.min(high, s.bottom - EYE_MARGIN - dy);
  }
  return low <= high ? [low, high] : null;
}

function largestFittingEye(top: readonly Vec[], bottom: readonly Vec[], x: number, wanted: number): number {
  if (eyeCenterRange(top, bottom, x, wanted)) return wanted;
  let low = 0, high = wanted;
  for (let i = 0; i < 22; i++) {
    const middle = (low + high) / 2;
    if (eyeCenterRange(top, bottom, x, middle)) low = middle; else high = middle;
  }
  return low;
}

const rotate = (v: Vec, pivot: Vec, angle: number): Vec => {
  const cos = Math.cos(angle), sin = Math.sin(angle), dx = v.x - pivot.x, dy = v.y - pivot.y;
  return { x: pivot.x + dx * cos - dy * sin, y: pivot.y + dx * sin + dy * cos };
};

/** Every lobe of the tail, first lobe first. */
export const tailLobes = (a: Pick<Anatomy, 'caudal' | 'extraLobes'>): Caudal[] => [a.caudal, ...a.extraLobes];

/** Box around every tail lobe's outer controls and tips, without the wave; for a standard tail it is the anatomy v2 fin box. */
export function tailBox(a: Pick<Anatomy, 'caudal' | 'extraLobes'>): { x0: number; x1: number; y0: number; y1: number } {
  if (!a.extraLobes.length && a.caudal.upperOuter.x === a.caudal.lowerOuter.x && a.caudal.upperOuter.y === -a.caudal.lowerOuter.y)
    return { x0: 0.5, x1: a.caudal.upperTip.x, y0: a.caudal.upperOuter.y, y1: a.caudal.lowerOuter.y };
  const points = tailLobes(a).flatMap(lobe => [lobe.upperOuter, lobe.upperTip, lobe.lowerTip, lobe.lowerOuter]);
  return { x0: 0.5, x1: Math.max(...points.map(v => v.x)), y0: Math.min(...points.map(v => v.y)), y1: Math.max(...points.map(v => v.y)) };
}

/**
 * One caudal lobe with the anatomy v2 shape. `upper` and `lower` scale the two halves' length and spread (lobe balance);
 * `pairs` rays run to each half. With both scales 1 and three ray pairs it is exactly the anatomy v2 tail.
 */
function caudalLobe(rootY: number, rayY: number, d: number, tail: number, spread: number, fork: number, upper: number, lower: number, pairs: number): Caudal {
  const upperX = 0.5 + tail * upper, lowerX = 0.5 + tail * lower, notchX = 0.5 + tail * Math.min(upper, lower) * (1 - fork);
  const rayRoot = { x: 0.46, y: rayY };
  return {
    root: { x: 0.42, y: rootY },
    upperInner: { x: 0.65, y: rootY - 0.4 * d }, upperOuter: { x: upperX, y: -spread * upper }, upperTip: { x: upperX, y: -0.6 * spread * upper },
    notch: { x: notchX, y: 0 },
    lowerTip: { x: lowerX, y: 0.6 * spread * lower }, lowerOuter: { x: lowerX, y: spread * lower }, lowerInner: { x: 0.65, y: rootY + 0.4 * d },
    rays: Array.from({ length: 2 * pairs + 1 }, (_, k) => k - pairs).map(i => {
      const end = { x: lerp(notchX, i < 0 ? upperX : lowerX, Math.abs(i) / pairs), y: (i / pairs) * 0.6 * spread * (i < 0 ? upper : lower) };
      return { start: rayRoot, control: { x: (rayRoot.x + end.x) / 2, y: lerp(rayRoot.y, end.y, 0.35) }, end };
    }),
  };
}

/** A lobe turned about its root. Ray roots stay inside the peduncle; the rest of each ray turns with the lobe. */
function turnLobe(lobe: Caudal, angle: number): Caudal {
  const turn = (v: Vec) => rotate(v, lobe.root, angle);
  return {
    root: lobe.root, upperInner: turn(lobe.upperInner), upperOuter: turn(lobe.upperOuter), upperTip: turn(lobe.upperTip), notch: turn(lobe.notch),
    lowerTip: turn(lobe.lowerTip), lowerOuter: turn(lobe.lowerOuter), lowerInner: turn(lobe.lowerInner),
    rays: lobe.rays.map(ray => ({ start: ray.start, control: turn(ray.control), end: turn(ray.end) })), angle,
  };
}

/** Structure v1 tail lobes: standard, a paired fan (two lobes) or a crown (four lobes), rooted at the same peduncle point. */
function tailFor(p: Phenotype, s: Structure, rootY: number, rayY: number, d: number): Caudal[] {
  const upper = s.lobeBalance, lower = 2 - s.lobeBalance, pairs = Math.max(1, Math.round(3 * s.rays));
  if (s.tail === 'standard') return [caudalLobe(rootY, rayY, d, p.tail, p.spread, p.fork, upper, lower, pairs)];
  const lobePairs = Math.max(1, Math.round(2 * s.rays));
  if (s.tail === 'paired') {
    const angle = 0.18 + 0.3 * s.spread, lobe = (scale: number) => caudalLobe(rootY, rayY, d, p.tail, p.spread * 0.62, p.fork, scale, scale, lobePairs);
    return [turnLobe(lobe(upper), -angle), turnLobe(lobe(lower), angle)];
  }
  const inner = 0.12 + 0.15 * s.spread, outer = 0.42 + 0.35 * s.spread;
  const lobe = (scale: number) => caudalLobe(rootY, rayY, d, p.tail * 0.92, p.spread * 0.42, p.fork, scale, scale, lobePairs);
  return [turnLobe(lobe(upper), -outer), turnLobe(lobe(upper), -inner), turnLobe(lobe(lower), inner), turnLobe(lobe(lower), outer)];
}

export function buildAnatomy(p: Phenotype): Anatomy {
  const structure = p.structure;
  const d = p.depth, snoutX = -(0.5 + p.snout), tip = { x: snoutX, y: 0 };
  const shoulder = { x: 0.15, y: -0.36 * d };
  const belly = { x: -0.42, y: 0.24 * d };
  const pedTop = { x: 0.5, y: -d * p.taper * 0.4 }, pedBottom = { x: 0.5, y: d * p.taper * 0.4 };
  const top = [
    ...cubicPoints(tip, { x: snoutX, y: -d * p.head }, { x: -(0.5 - p.head), y: -d * (0.72 + p.curve) }, shoulder, CURVE_SAMPLES),
    ...quadPoints(shoulder, { x: 0.3, y: -0.22 * d }, pedTop, SHOULDER_SAMPLES).slice(1),
  ];
  const bottom = [
    ...quadPoints(belly, { x: snoutX, y: d * p.mouth }, tip, SHOULDER_SAMPLES).reverse(),
    ...cubicPoints(pedBottom, { x: 0.1, y: 0.32 * d }, { x: -0.12, y: 0.7 * d }, belly, CURVE_SAMPLES).reverse().slice(1),
  ];
  const at = (x: number) => sectionOf(top, bottom, x);
  const adjustments: string[] = [];

  // Eye: keep the v1 longitudinal placement when it fits; otherwise move back slightly, then limit radius.
  const preferredX = -(0.45 - p.head * 0.14);
  let eyeX = preferredX, radius = 0;
  for (let step = 0; step <= 4; step++) {
    const candidateX = preferredX + step * 0.01;
    const fitted = largestFittingEye(top, bottom, candidateX, p.eye);
    if (fitted > radius + 1e-6) { eyeX = candidateX; radius = fitted; }
    if (fitted >= p.eye) break;
  }
  if (eyeX !== preferredX) adjustments.push(`Eye moved ${(eyeX - preferredX).toFixed(2)} BL toward the gill to fit the head.`);
  if (radius < p.eye) adjustments.push(`Eye radius limited by head depth: ${p.eye.toFixed(3)} → ${radius.toFixed(3)} BL.`);
  const [dorsalLimit, ventralLimit] = eyeCenterRange(top, bottom, eyeX, radius) ?? [at(eyeX).center, at(eyeX).center];
  const middle = (dorsalLimit + ventralLimit) / 2;
  const lift = 0.3 + 0.7 * clamp((p.eyePosition - 0.1) / 0.45);
  const eye = { center: { x: eyeX, y: middle + (dorsalLimit - middle) * lift }, radius, pupilRadius: radius * p.pupil };

  const gillX = Math.min(0.2, Math.max(-(0.5 - p.head), eyeX + radius + 0.01));
  const gs = at(gillX), gc = at(gillX + 0.13), ge = at(gillX + 0.02);
  const gill = {
    start: { x: gillX, y: gs.center - 0.5 * gs.half },
    control: { x: gillX + 0.13, y: gc.center + 0.25 * gc.half },
    end: { x: gillX + 0.02, y: ge.center + 0.85 * ge.half },
  };

  const mouthX = snoutX + p.mouth, ms = at(mouthX);
  const mouth = { tip, corner: { x: mouthX, y: ms.center + 0.45 * ms.half } };
  // Barbel pairs: the anatomy v2 pair first, then further pairs rooted a little behind it along the jaw (FS-602).
  const BARBEL_PAIRS = [
    { root: Math.min(0.012, p.mouth * 0.6), depth: 0.3, control: { x: -0.02, y: 0.2 }, reach: 1, drop: 0.25, back: 0 },
    { root: Math.min(0.03, p.mouth * 0.9 + 0.006), depth: 0.35, control: { x: -0.005, y: 0.24 }, reach: 0.7, drop: 0.3, back: 0.01 },
    { root: Math.min(0.05, p.mouth * 1.2 + 0.012), depth: 0.4, control: { x: 0.01, y: 0.28 }, reach: 0.45, drop: 0.34, back: 0.02 },
  ];
  const barbels = BARBEL_PAIRS.slice(0, structure.barbels / 2).flatMap(pair => {
    const x = snoutX + pair.root, bs = at(x), start = { x, y: bs.center + pair.depth * bs.half };
    return [-1, 1].map(sign => ({
      start, control: { x: snoutX + pair.control.x, y: sign * pair.control.y * d }, end: { x: snoutX - p.barbel * pair.reach + pair.back, y: sign * pair.drop * d },
    }));
  });

  // A second dorsal fin (module) takes the rear of the dorsal base, so a full first dorsal ends earlier.
  const plan = p.genesis?.modules, twin = Boolean(plan?.secondDorsal);
  const dorsalEnd = structure.dorsal === 'reduced' ? 0.1 : twin ? 0.06 : 0.3;
  const df = at(-0.18), dc = at(-0.08), db = at(dorsalEnd);
  const dorsal = structure.dorsal === 'absent' ? null : {
    start: { x: -0.18, y: df.top + 0.3 * df.half },
    control: { x: -0.08, y: dc.top - p.dorsal * (structure.dorsal === 'reduced' ? 0.35 : 1) },
    end: { x: dorsalEnd, y: db.top + 0.3 * db.half },
  };
  let modules: AnatomyModules | undefined;
  if (plan && (plan.secondDorsal || plan.wen || plan.bubble)) {
    const s2 = at(0.12), c2 = at(0.24), e2 = at(0.4);
    const dorsal2 = plan.secondDorsal ? {
      start: { x: 0.12, y: s2.top + 0.3 * s2.half }, control: { x: 0.24, y: c2.top - Math.max(0.04, p.dorsal) * (0.55 + 0.45 * plan.secondDorsal) }, end: { x: 0.4, y: e2.top + 0.3 * e2.half },
    } : null;
    let wen: AnatomyModules['wen'] = null;
    if (plan.wen) {
      const from = snoutX + 0.04, to = Math.min(-0.1, eyeX + 0.06 + 0.08 * plan.wen), height = (0.016 + 0.034 * plan.wen) * Math.max(0.6, d / 0.3);
      const base = Array.from({ length: 13 }, (_, i) => { const x = lerp(from, to, i / 12); return { x, y: at(x).top }; });
      wen = { base, heights: base.map((_, i) => height * Math.sin(Math.PI * (0.08 + 0.84 * i / 12)) ** 0.7) };
    }
    const bubble = plan.bubble ? (() => {
      const rx = radius * (1.1 + 1.3 * plan.bubble), ry = radius * (0.9 + 1.1 * plan.bubble);
      return { center: { x: eyeX + radius * 0.2, y: eye.center.y + radius * 0.7 + ry * 0.75 }, rx, ry };
    })() : null;
    modules = { dorsal2, wen, bubble };
  }
  const pf = at(-0.2), pc = at(-0.05), pb = at(0.1);
  const pectoral = { start: { x: -0.2, y: pf.center + 0.3 * pf.half }, control: { x: -0.05, y: pc.bottom + 0.16 * d + p.pectoral }, end: { x: 0.1, y: pb.center + 0.8 * pb.half } };

  const lobes = tailFor(p, structure, at(0.42).center, at(0.46).center, d), [caudal, ...extraLobes] = lobes;

  const moduleExtent = modules ? [
    ...(modules.dorsal2 ? [modules.dorsal2.control] : []),
    ...(modules.wen ? modules.wen.base.map((v, i) => ({ x: v.x, y: v.y - modules!.wen!.heights[i] * 1.25 })) : []),
    ...(modules.bubble ? [{ x: modules.bubble.center.x - modules.bubble.rx, y: modules.bubble.center.y - modules.bubble.ry }, { x: modules.bubble.center.x + modules.bubble.rx, y: modules.bubble.center.y + modules.bubble.ry }] : []),
  ] : [];
  const still = [...top, ...bottom, ...moduleExtent, ...(dorsal ? [dorsal.control] : []), pectoral.control, ...lobes.flatMap(lobe => [lobe.root, lobe.upperInner, lobe.lowerInner]),
    ...barbels.flatMap(b => [b.control, b.end]), { x: eyeX - radius, y: eye.center.y - radius }, { x: eyeX + radius, y: eye.center.y + radius }];
  const waving = lobes.flatMap(lobe => [lobe.upperOuter, lobe.upperTip, lobe.notch, lobe.lowerTip, lobe.lowerOuter]);
  const bounds = {
    minX: Math.min(...still.map(v => v.x), ...waving.map(v => v.x)) - BOUNDS_MARGIN,
    maxX: Math.max(...still.map(v => v.x), ...waving.map(v => v.x)) + BOUNDS_MARGIN,
    minY: Math.min(...still.map(v => v.y), ...waving.map(v => v.y - TAIL_WAVE)) - BOUNDS_MARGIN,
    maxY: Math.max(...still.map(v => v.y), ...waving.map(v => v.y + TAIL_WAVE)) + BOUNDS_MARGIN,
  };
  return { version: ANATOMY_VERSION, snoutX, top, bottom, eye, gill, mouth, barbels, dorsal, pectoral, caudal, extraLobes, ...(modules ? { modules } : {}), bounds, adjustments };
}

const cache = new WeakMap<Phenotype, Anatomy>();
/** Memoized by phenotype object identity; phenotypes are treated as immutable. */
export function anatomyFor(p: Phenotype): Anatomy {
  let anatomy = cache.get(p);
  if (!anatomy) { anatomy = buildAnatomy(p); cache.set(p, anatomy); }
  return anatomy;
}

/** Dense samples of every drawn curve, with the tail at both wave extremes. Used for tight extents and clipping checks. */
export function silhouettePoints(a: Anatomy): Vec[] {
  const points: Vec[] = [...a.top, ...a.bottom];
  for (const c of tailLobes(a)) for (const wave of [-TAIL_WAVE, TAIL_WAVE]) {
    const shift = (v: Vec) => ({ x: v.x, y: v.y + wave });
    points.push(...cubicPoints(c.root, c.upperInner, shift(c.upperOuter), shift(c.upperTip), 16), shift(c.notch),
      ...cubicPoints(shift(c.lowerTip), shift(c.lowerOuter), c.lowerInner, c.root, 16));
  }
  for (const curve of [...(a.dorsal ? [a.dorsal] : []), ...(a.modules?.dorsal2 ? [a.modules.dorsal2] : []), a.pectoral, ...a.barbels]) points.push(...quadPoints(curve.start, curve.control, curve.end, 16));
  const wen = a.modules?.wen, bubble = a.modules?.bubble;
  if (wen) points.push(...wen.base.map((v, i) => ({ x: v.x, y: v.y - wen.heights[i] })));
  if (bubble) for (let i = 0; i < 16; i++) points.push({ x: bubble.center.x + Math.cos(i / 8 * Math.PI) * bubble.rx, y: bubble.center.y + Math.sin(i / 8 * Math.PI) * bubble.ry });
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    points.push({ x: a.eye.center.x + Math.cos(angle) * a.eye.radius, y: a.eye.center.y + Math.sin(angle) * a.eye.radius });
  }
  return points;
}

/** Returns human-readable attachment problems; an empty list means the anatomy is renderable and connected. */
export function validateAnatomy(a: Anatomy): string[] {
  const problems = new Set<string>();
  const lobes = tailLobes(a);
  const points = [...a.top, ...a.bottom, a.eye.center, a.gill.start, a.gill.control, a.gill.end, a.mouth.corner, ...(a.dorsal ? [a.dorsal.start, a.dorsal.control, a.dorsal.end] : []),
    a.pectoral.start, a.pectoral.control, a.pectoral.end, ...a.barbels.flatMap(b => [b.start, b.control, b.end]),
    ...lobes.flatMap(lobe => Object.values(lobe).filter((v): v is Vec => typeof v === 'object' && !Array.isArray(v))), ...lobes.flatMap(lobe => lobe.rays.flatMap(r => [r.start, r.control, r.end]))];
  if (!points.every(v => Number.isFinite(v.x) && Number.isFinite(v.y)) || ![a.eye.radius, a.eye.pupilRadius, ...Object.values(a.bounds)].every(Number.isFinite)) {
    return ['Non-finite geometry.'];
  }
  for (const line of [a.top, a.bottom]) {
    for (let i = 1; i < line.length; i++) if (!(line[i].x > line[i - 1].x)) problems.add('Outline is not x-monotonic.');
  }
  if (a.top[0].x !== a.snoutX || a.bottom[0].x !== a.snoutX || a.top.at(-1)!.x !== 0.5 || a.bottom.at(-1)!.x !== 0.5) problems.add('Outline endpoints are not joined.');
  for (let i = 1; i < 200; i++) {
    if (!(section(a, lerp(a.snoutX, 0.5, i / 200)).half > 0)) { problems.add('Body has non-positive thickness.'); break; }
  }
  if (!(a.eye.radius > 0) || a.eye.pupilRadius > a.eye.radius) problems.add('Eye proportions are invalid.');
  for (let i = 0; i < 64; i++) {
    const angle = (i / 64) * Math.PI * 2;
    if (!insideBody(a, { x: a.eye.center.x + Math.cos(angle) * a.eye.radius, y: a.eye.center.y + Math.sin(angle) * a.eye.radius })) { problems.add('Eye extends outside the head.'); break; }
  }
  const roots: [string, Vec][] = [['Pectoral fin front root', a.pectoral.start], ['Pectoral fin rear root', a.pectoral.end], ['Gill line start', a.gill.start],
    ['Gill line end', a.gill.end], ['Mouth corner', a.mouth.corner],
    ...(a.dorsal ? [['Dorsal fin front root', a.dorsal.start], ['Dorsal fin rear root', a.dorsal.end]] as [string, Vec][] : []),
    ...lobes.flatMap(lobe => [['Caudal fin root', lobe.root], ['Caudal ray root', lobe.rays[0].start]] as [string, Vec][]),
    ...a.barbels.map(barbel => ['Barbel root', barbel.start] as [string, Vec])];
  for (const [name, root] of roots) if (!insideBody(a, root)) problems.add(`${name} is outside the body.`);
  if (![0, 2, 4, 6].includes(a.barbels.length)) problems.add('Barbels must come in pairs of up to three.');
  if (![1, 2, 4].includes(lobes.length)) problems.add('Tail lobe count is unsupported.');
  for (const lobe of lobes) {
    // Checked in the lobe's own frame, turned back about its root.
    const local = (v: Vec) => rotate(v, lobe.root, -(lobe.angle ?? 0));
    const upperTip = local(lobe.upperTip), lowerTip = local(lobe.lowerTip), notch = local(lobe.notch), far = Math.max(upperTip.x, lowerTip.x);
    if (!(Math.min(upperTip.x, lowerTip.x) >= 0.5 && notch.x >= 0.5 && notch.x <= Math.min(upperTip.x, lowerTip.x) + 1e-9)) problems.add('Caudal fin does not extend behind the peduncle.');
    if (!(upperTip.y < notch.y + 1e-9 && lowerTip.y > notch.y - 1e-9)) problems.add('Caudal lobe is folded.');
    for (const ray of lobe.rays) {
      const end = local(ray.end), control = local(ray.control), start = local(ray.start);
      if (end.x < notch.x - 1e-9 || end.x > far + 1e-9) problems.add('Caudal ray ends off the trailing edge.');
      if (control.x < start.x - 1e-9 || control.x > end.x + 1e-9) problems.add('Caudal ray bends outside its fin.');
    }
  }
  const b = a.bounds;
  if (!(b.maxX > b.minX && b.maxY > b.minY)) problems.add('Bounds are empty.');
  if ([...points, ...silhouettePoints(a)].some(v => v.x < b.minX || v.x > b.maxX || v.y < b.minY || v.y > b.maxY)) problems.add('Bounds do not contain the anatomy.');
  return [...problems];
}

/** Picking in BL coordinates: body silhouette or caudal fin, inflated by a tolerance. */
export function containsPoint(a: Anatomy, x: number, y: number, tolerance = 0): boolean {
  if (x >= a.snoutX - tolerance && x <= 0.5 + tolerance) {
    const s = section(a, clamp(x, a.snoutX, 0.5));
    if (y >= s.top - tolerance && y <= s.bottom + tolerance) return true;
  }
  if (!a.extraLobes.length && a.caudal.angle === undefined) {
    const box = tailBox(a), tailX = box.x1;
    if (x > 0.5 && x <= tailX + tolerance) {
      const reach = clamp((x - a.caudal.root.x) / Math.max(tailX - a.caudal.root.x, 1e-6));
      return Math.abs(y - a.caudal.root.y) <= Math.max(-box.y0, box.y1) * reach + TAIL_WAVE + tolerance;
    }
    return false;
  }
  // Paired and crown lobes: the same widening cone, checked in each lobe's own frame (FS-602).
  for (const lobe of tailLobes(a)) {
    const turn = (v: Vec) => rotate(v, lobe.root, -(lobe.angle ?? 0)), point = turn({ x, y });
    const upperTip = turn(lobe.upperTip), lowerTip = turn(lobe.lowerTip), tipX = Math.max(upperTip.x, lowerTip.x);
    const half = Math.max(Math.abs(turn(lobe.upperOuter).y - lobe.root.y), Math.abs(turn(lobe.lowerOuter).y - lobe.root.y));
    if (point.x > lobe.root.x && point.x <= tipX + tolerance) {
      const reach = clamp((point.x - lobe.root.x) / Math.max(tipX - lobe.root.x, 1e-6));
      if (Math.abs(point.y - lobe.root.y) <= half * reach + TAIL_WAVE + tolerance) return true;
    }
  }
  return false;
}

/** Physical footprint: bounds scaled by the phenotype's normalized body length, for shared-scale comparisons. */
export type Extent = { width: number; height: number };
export function absoluteExtent(p: Phenotype): Extent {
  const b = anatomyFor(p).bounds;
  return { width: (b.maxX - b.minX) * p.length, height: (b.maxY - b.minY) * p.length };
}
export function sharedExtent(phenotypes: readonly Phenotype[]): Extent {
  return phenotypes.map(absoluteExtent).reduce((max, e) => ({ width: Math.max(max.width, e.width), height: Math.max(max.height, e.height) }), { width: 0, height: 0 });
}

export type PortraitFrame = { size: number; originX: number; originY: number; pixelsPerBodyLength: number; sharedScaleReduced: boolean };
/**
 * Frames a phenotype inside a canvas without clipping. Without `shared`, each fish fills the frame.
 * With `shared`, every fish in a group uses one pixel scale so body length differences stay visible.
 */
export function portraitFrame(p: Phenotype, width: number, height: number, shared?: Extent, padding = 0.05): PortraitFrame {
  const b = anatomyFor(p).bounds;
  const innerW = width * (1 - 2 * padding), innerH = height * (1 - 2 * padding);
  const fit = Math.min(innerW / (b.maxX - b.minX), innerH / (b.maxY - b.minY));
  const sharedScale = shared ? Math.min(innerW / shared.width, innerH / shared.height) * p.length : fit;
  const scale = Math.min(fit, sharedScale);
  return {
    size: scale / p.length, pixelsPerBodyLength: scale, sharedScaleReduced: sharedScale > fit * (1 + 1e-9),
    originX: width / 2 - scale * (b.minX + b.maxX) / 2, originY: height / 2 - scale * (b.minY + b.maxY) / 2,
  };
}
