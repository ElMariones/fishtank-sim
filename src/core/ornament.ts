import { section, type Anatomy, type Vec } from './anatomy';
import { REACH_VISIBLE, SHIMMER_VISIBLE } from './appearance';
import { markingPosition } from './pattern';
import { clamp, hash, random } from './random';
import type { BodyMotif, FinMotif, Phenotype } from './types';

/**
 * Development v4 ornament geometry in body-length units: body motifs, scales, shimmer sparkles and tail/dorsal
 * patterns. Inherited appearance chooses kinds, colors, density, size and contrast; the birth seed only scatters the
 * texture. Tones are resolved to colors by the renderer. The classic appearance produces an empty ornament.
 */
export type Tone = 'accent' | 'dark' | 'light' | 'shade' | 'gold' | `dot${number}`;
export type OrnamentShape =
  | { type: 'circle'; x: number; y: number; r: number }
  | { type: 'ellipse'; x: number; y: number; rx: number; ry: number; angle: number }
  | { type: 'polygon'; points: Vec[] }
  | { type: 'polyline'; points: Vec[] }
  /** Half circle whose convex edge faces the tail, like an overlapping scale. */
  | { type: 'arc'; x: number; y: number; r: number };
export type OrnamentLayer = { tone: Tone; alpha: number; mode: 'fill' | 'stroke'; width: number; shapes: OrnamentShape[] };
export type Ornament = {
  body: OrnamentLayer[]; caudal: OrnamentLayer[]; dorsal: OrnamentLayer[]; sparkles: Vec[];
  /** Effects that follow the live fin outline, as opacity; 0 is off. */
  fins: Record<'edge' | 'tips' | 'flame', number>;
};

/** A drawing region: s runs along the body or fin, t across it; both 0–1. `span` is the BL length of s. */
type Surface = { name: string; place: (s: number, t: number) => Vec; span: number; count: number; size: number; bands: 's' | 't' };

const layer = (tone: Tone, alpha: number, mode: OrnamentLayer['mode'] = 'fill', width = 0): OrnamentLayer => ({ tone, alpha, mode, width, shapes: [] });
const dotTones = (p: Phenotype): Tone[] => Array.from({ length: p.appearance.dots[0] === 'rainbow' ? 6 : p.appearance.dots.length }, (_, i): Tone => `dot${i}`);
/** Dark motifs fall back to the accent color when the melanin switch or low black pigment leaves no dark layer. */
const darkTone = (p: Phenotype): Tone => (p.black >= 0.08 ? 'dark' : 'accent');

function bodySurface(a: Anatomy): Surface {
  return { name: 'body', place: (s, t) => markingPosition(a, { u: s, v: t * 2.4 - 1.2 }), span: 0.5 - a.snoutX, count: 1, size: 1, bands: 's' };
}
function caudalSurface(a: Anatomy): Surface {
  const x0 = 0.5, x1 = a.caudal.upperTip.x, y0 = a.caudal.upperOuter.y, y1 = a.caudal.lowerOuter.y;
  return { name: 'caudal', place: (s, t) => ({ x: x0 + s * (x1 - x0), y: y0 + t * (y1 - y0) }), span: Math.max(x1 - x0, 0.05), count: 0.35, size: 0.8, bands: 's' };
}
function dorsalSurface(a: Anatomy): Surface {
  const x0 = a.dorsal.start.x, x1 = a.dorsal.end.x, top = a.dorsal.control.y, base = section(a, a.dorsal.control.x).top;
  return { name: 'dorsal', place: (s, t) => ({ x: x0 + s * (x1 - x0), y: top + t * (base - top) }), span: x1 - x0, count: 0.25, size: 0.75, bands: 't' };
}

function motifLayers(kind: BodyMotif, p: Phenotype, alpha: number, seed: number, surface: Surface, source: string): OrnamentLayer[] {
  const { density, motifScale } = p.appearance, rng = random(hash(`ornament-v1:${seed}:${surface.name}:${source}:${kind}`));
  const count = (base: number, extra: number) => Math.max(1, Math.round((base + density * extra) * surface.count));
  const size = (base: number, extra: number) => (base + motifScale * extra) * surface.size;
  switch (kind) {
    case 'spots': {
      const layers = dotTones(p).map(tone => layer(tone, alpha));
      for (let i = 0, total = count(18, 70); i < total; i++) {
        layers[i % layers.length].shapes.push({ type: 'circle', ...surface.place(rng(), 0.1 + rng() * 0.8), r: size(0.009, 0.014) * (0.7 + rng() * 0.6) });
      }
      return layers;
    }
    case 'stripes': {
      if (surface.name !== 'body') return bandLayers(p, alpha, seed, surface, `${source}:stripes`);
      const stripes = layer(darkTone(p), alpha), total = count(4, 9), width = size(0.018, 0.04) / surface.span;
      for (let i = 0; i < total; i++) {
        const centre = (i + 0.5) / total + (rng() - 0.5) * 0.3 / total, slant = (rng() - 0.5) * 0.12, reach = 0.55 + rng() * 0.45, phase = rng() * Math.PI * 2;
        const left: Vec[] = [], right: Vec[] = [];
        for (let step = 0; step <= 8; step++) {
          // Tiger stripes start at the dorsal edge, taper towards the belly and wander slightly.
          const t = reach * step / 8, half = width * (1 - 0.55 * step / 8) / 2, s = centre + slant * (t - 0.5) + Math.sin(t * 6 + phase) * 0.01;
          left.push(surface.place(s - half, t)); right.push(surface.place(s + half, t));
        }
        stripes.shapes.push({ type: 'polygon', points: [...left, ...right.reverse()] });
      }
      return [stripes];
    }
    case 'marble': {
      const veins = layer('accent', alpha * 0.9, 'stroke', size(0.008, 0.014)), total = count(4, 5);
      for (let i = 0; i < total; i++) {
        const base = (i + 0.2 + rng() * 0.6) / total, frequency = 5 + rng() * 7, phase = rng() * Math.PI * 2, points: Vec[] = [];
        for (let step = 0; step <= 32; step++) {
          const s = step / 32;
          points.push(surface.place(s, clamp(base + 0.12 * Math.sin(s * frequency + phase) + 0.035 * Math.sin(s * 19 + phase * 2))));
        }
        veins.shapes.push({ type: 'polyline', points });
      }
      return [veins];
    }
    case 'calico': {
      const layers = (['accent', p.black >= 0.08 ? 'dark' : 'light', ...dotTones(p)] as Tone[]).map(tone => layer(tone, alpha));
      for (let i = 0, total = count(10, 26); i < total; i++) {
        const rx = size(0.016, 0.03) * (0.6 + rng() * 0.8);
        const point = surface.place(rng(), 0.08 + rng() * 0.84), ry = rx * (0.45 + rng() * 0.55), phase = rng() * Math.PI;
        // Uneven flecks rather than identical ellipses; every inherited dot color participates.
        const points = Array.from({ length: 16 }, (_, j) => {
          const angle = j / 16 * Math.PI * 2, edge = 0.8 + 0.16 * Math.sin(angle * 3 + phase) + rng() * 0.08;
          return { x: point.x + Math.cos(angle) * rx * edge, y: point.y + Math.sin(angle) * ry * edge };
        });
        layers[i % layers.length].shapes.push({ type: 'polygon', points });
      }
      return layers;
    }
    case 'rosettes': {
      const radius = size(0.02, 0.024), rings = layer(darkTone(p), alpha, 'stroke', radius * 0.38), centres = layer('accent', alpha * 0.7);
      for (let i = 0, total = count(5, 14); i < total; i++) {
        const point = surface.place(0.04 + rng() * 0.92, 0.2 + rng() * 0.6), r = radius * (0.75 + rng() * 0.5);
        centres.shapes.push({ type: 'circle', ...point, r: r * 0.5 });
        // Broken, lobed rings read as rosettes, rather than perfectly circular targets.
        const phase = rng() * Math.PI * 2;
        for (let arc = 0; arc < 3; arc++) rings.shapes.push({ type: 'polyline', points: Array.from({ length: 10 }, (_, j) => {
          const angle = phase + arc * Math.PI * 2 / 3 + j / 9 * 1.65, radius = r * (0.86 + 0.14 * Math.sin(angle * 5 + phase));
          return { x: point.x + Math.cos(angle) * radius, y: point.y + Math.sin(angle) * radius * 0.8 };
        }) });
      }
      return [centres, rings];
    }
  }
}

/** Bands cross the fin rays: vertical on the tail, horizontal on the dorsal fin. */
function bandLayers(p: Phenotype, alpha: number, seed: number, surface: Surface, source: string): OrnamentLayer[] {
  const rng = random(hash(`ornament-v1:${seed}:${surface.name}:${source}:bands`));
  const bands = layer(darkTone(p), alpha), total = 2 + Math.round(p.appearance.density * 2);
  for (let i = 0; i < total; i++) {
    const centre = (i + 0.7) / (total + 0.5) + (rng() - 0.5) * 0.04, half = 0.035 + p.appearance.motifScale * 0.03;
    bands.shapes.push({
      type: 'polygon',
      points: surface.bands === 's'
        ? [surface.place(centre - half, -0.1), surface.place(centre + half, -0.1), surface.place(centre + half, 1.1), surface.place(centre - half, 1.1)]
        : [surface.place(-0.1, centre - half), surface.place(1.1, centre - half), surface.place(1.1, centre + half), surface.place(-0.1, centre + half)],
    });
  }
  return [bands];
}

const SCALE_RADIUS = { fine: 0.017, mirror: 0.05, net: 0.028, pearl: 0.024, armor: 0.042 } as const;

function scaleLayers(p: Phenotype, a: Anatomy): OrnamentLayer[] {
  const type = p.appearance.scales;
  if (type === 'smooth') return [];
  const r = SCALE_RADIUS[type], start = a.eye.center.x + a.eye.radius + 0.06;
  if (type === 'mirror') {
    // A few large mirror scales along the dorsal ridge and lateral line, as on mirror-scaled carp.
    const fills = layer('light', 0.24), edges = layer('shade', 0.3, 'stroke', r * 0.12);
    for (let x = start; x < 0.47; x += r * 1.8) {
      const s = section(a, x);
      for (const y of [s.top + s.half * 0.45, s.center + s.half * 0.1]) {
        fills.shapes.push({ type: 'ellipse', x, y, rx: r * 0.9, ry: r * 0.75, angle: 0 });
        edges.shapes.push({ type: 'arc', x, y, r: r * 0.9 });
      }
    }
    return [fills, edges];
  }
  const centres: Vec[] = [];
  for (let x = start, column = 0; x < 0.49; x += r * 1.5, column++) {
    const s = section(a, x);
    for (let y = s.top + (column % 2 ? r * 0.7 : 0); y < s.bottom; y += r * 1.4) centres.push({ x, y });
  }
  const arcs = (tone: Tone, alpha: number, width: number) => ({ ...layer(tone, alpha, 'stroke', width), shapes: centres.map((c): OrnamentShape => ({ type: 'arc', ...c, r })) });
  switch (type) {
    case 'fine': return [arcs('shade', 0.2, r * 0.18)];
    case 'net': return [arcs('dark', 0.42, r * 0.28)];
    case 'armor': return [
      { ...layer('shade', 0.2), shapes: centres.map((c): OrnamentShape => ({ type: 'polygon', points: [
        { x: c.x - r * 0.6, y: c.y }, { x: c.x, y: c.y - r * 0.6 }, { x: c.x + r * 0.8, y: c.y }, { x: c.x, y: c.y + r * 0.6 },
      ] })) }, arcs('gold', 0.5, r * 0.15),
    ];
    case 'pearl': return [arcs('shade', 0.16, r * 0.12), { ...layer('light', 0.5), shapes: centres.map((c): OrnamentShape => ({ type: 'ellipse', x: c.x - r * 0.15, y: c.y - r * 0.12, rx: r * 0.34, ry: r * 0.24, angle: -0.4 })) }];
  }
}

function sparkles(p: Phenotype, a: Anatomy, seed: number): Vec[] {
  if (p.appearance.shimmer < SHIMMER_VISIBLE) return [];
  const rng = random(hash(`ornament-v1:${seed}:sparkle`));
  return Array.from({ length: Math.round(8 + p.appearance.shimmer * 40) }, () => markingPosition(a, { u: 0.12 + rng() * 0.82, v: rng() * 1.6 - 0.8 }));
}

export function buildOrnament(p: Phenotype, seed: number, anatomy: Anatomy): Ornament {
  const a = p.appearance;
  const fin = (surface: Surface) => [
    ...(a.reach >= REACH_VISIBLE ? a.motifs.flatMap(motif => motifLayers(motif.kind, p, a.contrast * motif.strength * a.reach, seed, surface, 'reach')) : []),
    ...a.finMotifs.flatMap(motif => motif.kind === 'spots' ? motifLayers('spots', p, a.contrast * motif.strength, seed, surface, 'fin')
      : motif.kind === 'bands' ? bandLayers(p, a.contrast * motif.strength, seed, surface, 'fin') : []),
  ];
  const effect = (kind: FinMotif) => { const motif = a.finMotifs.find(m => m.kind === kind); return motif ? a.contrast * motif.strength : 0; };
  return {
    body: [...a.motifs.flatMap(motif => motifLayers(motif.kind, p, a.contrast * motif.strength, seed, bodySurface(anatomy), 'motif')), ...scaleLayers(p, anatomy)],
    caudal: fin(caudalSurface(anatomy)),
    dorsal: fin(dorsalSurface(anatomy)),
    sparkles: sparkles(p, anatomy, seed),
    fins: { edge: effect('edge'), tips: effect('tips'), flame: effect('flame') },
  };
}

export const isEmptyOrnament = (o: Ornament) =>
  !o.body.length && !o.caudal.length && !o.dorsal.length && !o.sparkles.length && !o.fins.edge && !o.fins.tips && !o.fins.flame;
