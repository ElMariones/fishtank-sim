/** Frozen copy of src/core/anatomy.ts anatomy v2 at fb6b593 (FS-601), kept as the FS-602 reference: standard structure must build exactly this geometry. Do not edit. */
import { MODEL_VERSIONS } from '../../src/core/catalog';
import { clamp } from '../../src/core/random';
import type { Phenotype } from '../../src/core/types';

/**
 * Anatomy v2: pure phenotype → body-space geometry shared by the tank, portraits and future mesh renderers.
 * Units are body lengths (BL). Origin is mid-body, +x points to the tail, +y is ventral (canvas down).
 * Renderers multiply by size × phenotype.length. No Canvas, DOM, randomness or inheritance decisions belong here.
 * The v1 body Béziers are kept so silhouettes do not drift; v2 moves every anchor onto that measured outline.
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
  /** Fin curves start and end at roots inside the body; the control shapes the free edge. */
  dorsal: Curve;
  pectoral: Curve;
  caudal: Caudal;
  /** Conservative: includes fin controls, the eye and the full tail wave. */
  bounds: Bounds;
  /** Developmental constraints applied to keep anatomy attached, in plain language. */
  adjustments: string[];
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

export function buildAnatomy(p: Phenotype): Anatomy {
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
  const barbelX = snoutX + Math.min(0.012, p.mouth * 0.6), bs = at(barbelX);
  const barbelRoot = { x: barbelX, y: bs.center + 0.3 * bs.half };
  const barbels = [-1, 1].map(sign => ({
    start: barbelRoot, control: { x: snoutX - 0.02, y: sign * 0.2 * d }, end: { x: snoutX - p.barbel, y: sign * 0.25 * d },
  }));

  const df = at(-0.18), dc = at(-0.08), db = at(0.3);
  const dorsal = { start: { x: -0.18, y: df.top + 0.3 * df.half }, control: { x: -0.08, y: dc.top - p.dorsal }, end: { x: 0.3, y: db.top + 0.3 * db.half } };
  const pf = at(-0.2), pc = at(-0.05), pb = at(0.1);
  const pectoral = { start: { x: -0.2, y: pf.center + 0.3 * pf.half }, control: { x: -0.05, y: pc.bottom + 0.16 * d + p.pectoral }, end: { x: 0.1, y: pb.center + 0.8 * pb.half } };

  const rootSection = at(0.42), raySection = at(0.46);
  const tailX = 0.5 + p.tail, notchX = 0.5 + p.tail * (1 - p.fork);
  const rayRoot = { x: 0.46, y: raySection.center };
  const caudal: Caudal = {
    root: { x: 0.42, y: rootSection.center },
    upperInner: { x: 0.65, y: rootSection.center - 0.4 * d }, upperOuter: { x: tailX, y: -p.spread }, upperTip: { x: tailX, y: -0.6 * p.spread },
    notch: { x: notchX, y: 0 },
    lowerTip: { x: tailX, y: 0.6 * p.spread }, lowerOuter: { x: tailX, y: p.spread }, lowerInner: { x: 0.65, y: rootSection.center + 0.4 * d },
    rays: [-3, -2, -1, 0, 1, 2, 3].map(i => {
      const end = { x: lerp(notchX, tailX, Math.abs(i) / 3), y: (i / 3) * 0.6 * p.spread };
      return { start: rayRoot, control: { x: (rayRoot.x + end.x) / 2, y: lerp(rayRoot.y, end.y, 0.35) }, end };
    }),
  };

  const still = [...top, ...bottom, dorsal.control, pectoral.control, caudal.root, caudal.upperInner, caudal.lowerInner, ...barbels.flatMap(b => [b.control, b.end]),
    { x: eyeX - radius, y: eye.center.y - radius }, { x: eyeX + radius, y: eye.center.y + radius }];
  const waving = [caudal.upperOuter, caudal.upperTip, caudal.notch, caudal.lowerTip, caudal.lowerOuter];
  const bounds = {
    minX: Math.min(...still.map(v => v.x), ...waving.map(v => v.x)) - BOUNDS_MARGIN,
    maxX: Math.max(...still.map(v => v.x), ...waving.map(v => v.x)) + BOUNDS_MARGIN,
    minY: Math.min(...still.map(v => v.y), ...waving.map(v => v.y - TAIL_WAVE)) - BOUNDS_MARGIN,
    maxY: Math.max(...still.map(v => v.y), ...waving.map(v => v.y + TAIL_WAVE)) + BOUNDS_MARGIN,
  };
  return { version: ANATOMY_VERSION, snoutX, top, bottom, eye, gill, mouth, barbels, dorsal, pectoral, caudal, bounds, adjustments };
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
  const c = a.caudal;
  for (const wave of [-TAIL_WAVE, TAIL_WAVE]) {
    const shift = (v: Vec) => ({ x: v.x, y: v.y + wave });
    points.push(...cubicPoints(c.root, c.upperInner, shift(c.upperOuter), shift(c.upperTip), 16), shift(c.notch),
      ...cubicPoints(shift(c.lowerTip), shift(c.lowerOuter), c.lowerInner, c.root, 16));
  }
  for (const curve of [a.dorsal, a.pectoral, ...a.barbels]) points.push(...quadPoints(curve.start, curve.control, curve.end, 16));
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    points.push({ x: a.eye.center.x + Math.cos(angle) * a.eye.radius, y: a.eye.center.y + Math.sin(angle) * a.eye.radius });
  }
  return points;
}

/** Returns human-readable attachment problems; an empty list means the anatomy is renderable and connected. */
export function validateAnatomy(a: Anatomy): string[] {
  const problems = new Set<string>();
  const points = [...a.top, ...a.bottom, a.eye.center, a.gill.start, a.gill.control, a.gill.end, a.mouth.corner, a.dorsal.start, a.dorsal.control, a.dorsal.end,
    a.pectoral.start, a.pectoral.control, a.pectoral.end, ...a.barbels.flatMap(b => [b.start, b.control, b.end]),
    ...Object.values(a.caudal).filter((v): v is Vec => !Array.isArray(v)), ...a.caudal.rays.flatMap(r => [r.start, r.control, r.end])];
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
  const roots: [string, Vec][] = [['Dorsal fin front root', a.dorsal.start], ['Dorsal fin rear root', a.dorsal.end], ['Pectoral fin front root', a.pectoral.start],
    ['Pectoral fin rear root', a.pectoral.end], ['Caudal fin root', a.caudal.root], ['Caudal ray root', a.caudal.rays[0].start], ['Gill line start', a.gill.start],
    ['Gill line end', a.gill.end], ['Mouth corner', a.mouth.corner], ['Barbel root', a.barbels[0].start]];
  for (const [name, root] of roots) if (!insideBody(a, root)) problems.add(`${name} is outside the body.`);
  const c = a.caudal;
  if (!(c.upperTip.x >= 0.5 && c.notch.x >= 0.5 && c.notch.x <= c.upperTip.x + 1e-12)) problems.add('Caudal fin does not extend behind the peduncle.');
  for (const ray of c.rays) {
    if (ray.end.x < c.notch.x - 1e-12 || ray.end.x > c.upperTip.x + 1e-12) problems.add('Caudal ray ends off the trailing edge.');
    if (ray.control.x < ray.start.x || ray.control.x > ray.end.x) problems.add('Caudal ray bends outside its fin.');
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
  const tailX = a.caudal.upperTip.x;
  if (x > 0.5 && x <= tailX + tolerance) {
    const reach = clamp((x - a.caudal.root.x) / Math.max(tailX - a.caudal.root.x, 1e-6));
    return Math.abs(y - a.caudal.root.y) <= Math.abs(a.caudal.upperOuter.y) * reach + TAIL_WAVE + tolerance;
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
