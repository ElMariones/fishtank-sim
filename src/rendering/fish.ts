import { anatomyFor, TAIL_WAVE, type Anatomy, type Vec } from '../core/anatomy';
import { SHIMMER_VISIBLE } from '../core/appearance';
import { buildOrnament, isEmptyOrnament, type OrnamentLayer, type OrnamentShape, type Tone } from '../core/ornament';
import { markingPosition, placeMarkings, type PlacedMarking } from '../core/pattern';
import { clamp, hash, random } from '../core/random';
import type { AccentColor, BaseColor, DotColor, IrisColor, Phenotype } from '../core/types';

const placedMarkings = new WeakMap<Phenotype, { seed: number; markings: PlacedMarking[] }>();
function markingsFor(p: Phenotype, seed: number): PlacedMarking[] {
  const cached = placedMarkings.get(p);
  if (cached?.seed === seed) return cached.markings;
  const markings = placeMarkings(p, seed);
  placedMarkings.set(p, { seed, markings });
  return markings;
}

type Hsl = readonly [number, number, number];
const BASE: Record<Exclude<BaseColor, 'classic'>, Hsl> = { gold: [43, 62, 60], slate: [205, 26, 58], charcoal: [200, 10, 26], lavender: [268, 32, 72], jade: [160, 36, 48] };
const ACCENT: Record<Exclude<AccentColor, 'classic'>, Hsl> = { crimson: [352, 76, 42], sunflower: [46, 90, 54], cobalt: [218, 70, 48], violet: [280, 52, 52], pearl: [42, 30, 90] };
const DOTS: Record<Exclude<DotColor, 'rainbow'>, Hsl> = { ink: [190, 22, 12], pearl: [45, 40, 94], gold: [45, 88, 58], turquoise: [178, 68, 46], ruby: [350, 76, 50] };
const RAINBOW: Hsl[] = [[0, 80, 56], [30, 92, 55], [54, 90, 54], [140, 62, 46], [205, 80, 58], [275, 62, 64]];
const IRIS: Record<Exclude<IrisColor, 'natural'>, Hsl> = { amber: [40, 88, 52], ruby: [352, 74, 48], sapphire: [214, 78, 58], emerald: [148, 62, 42], silver: [200, 12, 84] };
const css = ([h, s, l]: Hsl) => `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%)`;

/** Two variants blend along the shorter hue arc, so heterozygous colors read as a mix of both parents' colors. */
function mix(colors: readonly Hsl[]): Hsl {
  const [a, b] = colors;
  if (!b) return a;
  let delta = b[0] - a[0];
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return [(a[0] + delta / 2 + 360) % 360, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
}

type Palette = { base: string; accent: string; dots: string[]; iris: string[] };
const palettes = new WeakMap<Phenotype, Palette>();
/** Classic entries keep the renderer v3 formulas exactly, so genome v1 fish look unchanged. */
function paletteFor(p: Phenotype): Palette {
  const cached = palettes.get(p);
  if (cached) return cached;
  const a = p.appearance;
  const [baseHue, baseSaturation, baseLightness] = a.base[0] === 'classic' ? [0, 0, 0] : mix(a.base.map(name => BASE[name as Exclude<BaseColor, 'classic'>]));
  const palette: Palette = {
    base: a.base[0] === 'classic' ? `hsl(${38 + p.yellow * 8} ${10 + p.yellow * 25}% ${65 + p.white * 27}%)`
      : css([baseHue, baseSaturation, clamp(baseLightness + (p.white - 0.5) * 12, 8, 92)]),
    accent: a.accent[0] === 'classic' ? `hsl(${8 + p.yellow * 38} 78% ${43 + p.metallic * 12}%)`
      : css(mix(a.accent.map(name => ACCENT[name as Exclude<AccentColor, 'classic'>]))),
    dots: a.dots[0] === 'rainbow' ? RAINBOW.map(css) : a.dots.map(name => css(DOTS[name as Exclude<DotColor, 'rainbow'>])),
    iris: a.iris[0] === 'natural' ? [`hsl(${p.iris} 55% 62%)`] : a.iris.map(name => css(IRIS[name as Exclude<IrisColor, 'natural'>])),
  };
  palettes.set(p, palette);
  return palette;
}

function toneColor(palette: Palette, tone: Tone): string {
  switch (tone) {
    case 'accent': return palette.accent;
    case 'dark': return '#182526';
    case 'light': return '#f6f2e6';
    case 'shade': return '#0f2226';
    case 'gold': return 'hsl(44 80% 58%)';
    default: return palette.dots[Number(tone.slice(3)) % palette.dots.length];
  }
}

type PreparedLayer = { color: string; alpha: number; mode: OrnamentLayer['mode']; width: number; path: Path2D };
type PreparedOrnament = { body: PreparedLayer[]; caudal: PreparedLayer[]; dorsal: PreparedLayer[]; sparkles: Path2D[]; shimmer: number; fins: Record<'edge' | 'tips' | 'flame', number> };
const ornaments = new WeakMap<Phenotype, { seed: number; ornament: PreparedOrnament | null }>();

function pathOf(shapes: readonly OrnamentShape[]): Path2D {
  const path = new Path2D();
  for (const shape of shapes) {
    if (shape.type === 'circle') { path.moveTo(shape.x + shape.r, shape.y); path.arc(shape.x, shape.y, shape.r, 0, Math.PI * 2); }
    else if (shape.type === 'ellipse') { path.moveTo(shape.x + shape.rx * Math.cos(shape.angle), shape.y + shape.rx * Math.sin(shape.angle)); path.ellipse(shape.x, shape.y, shape.rx, shape.ry, shape.angle, 0, Math.PI * 2); }
    else if (shape.type === 'arc') { path.moveTo(shape.x, shape.y - shape.r); path.arc(shape.x, shape.y, shape.r, -Math.PI / 2, Math.PI / 2); }
    else {
      shape.points.forEach((point, i) => i ? path.lineTo(point.x, point.y) : path.moveTo(point.x, point.y));
      if (shape.type === 'polygon') path.closePath();
    }
  }
  return path;
}

/** Four-point sparkles in two groups that twinkle out of phase. */
function sparklePaths(points: readonly Vec[]): Path2D[] {
  const groups = [new Path2D(), new Path2D()];
  points.forEach((point, i) => {
    const path = groups[i % 2], s = 0.011 + (i % 3) * 0.003, k = s * 0.28;
    path.moveTo(point.x, point.y - s); path.lineTo(point.x + k, point.y - k); path.lineTo(point.x + s, point.y); path.lineTo(point.x + k, point.y + k);
    path.lineTo(point.x, point.y + s); path.lineTo(point.x - k, point.y + k); path.lineTo(point.x - s, point.y); path.lineTo(point.x - k, point.y - k); path.closePath();
  });
  return groups;
}

/** Ornament paths are built once per phenotype and seed in body-length units, then scaled at draw time. */
function ornamentFor(p: Phenotype, seed: number, anatomy: Anatomy): PreparedOrnament | null {
  const cached = ornaments.get(p);
  if (cached?.seed === seed) return cached.ornament;
  const built = buildOrnament(p, seed, anatomy), palette = paletteFor(p);
  const prepare = (layers: readonly OrnamentLayer[]) => layers.filter(item => item.shapes.length)
    .map(item => ({ color: toneColor(palette, item.tone), alpha: item.alpha, mode: item.mode, width: item.width, path: pathOf(item.shapes) }));
  const ornament = isEmptyOrnament(built) ? null
    : { body: prepare(built.body), caudal: prepare(built.caudal), dorsal: prepare(built.dorsal), sparkles: sparklePaths(built.sparkles), shimmer: p.appearance.shimmer, fins: built.fins };
  ornaments.set(p, { seed, ornament });
  return ornament;
}

function paint(ctx: CanvasRenderingContext2D, layers: readonly PreparedLayer[]) {
  for (const item of layers) {
    ctx.globalAlpha = item.alpha;
    if (item.mode === 'fill') { ctx.fillStyle = item.color; ctx.fill(item.path); }
    else { ctx.strokeStyle = item.color; ctx.lineWidth = item.width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(item.path); }
  }
}

/** Renderer v4: anatomy v2 geometry, development v2 markings and development v3 color and ornament. No inheritance, mutation, or identity decisions belong here. */
export function drawFish(ctx: CanvasRenderingContext2D, p: Phenotype, seed: number, size: number, time = 0) {
  const a = anatomyFor(p);
  const l = size * p.length, h = l * p.depth;
  const wave = Math.sin(time * (2.5 + p.activity * 3) + seed % 20) * TAIL_WAVE;
  const at = (v: Vec, dy = 0): [number, number] => [v.x * l, (v.y + dy) * l];
  const palette = paletteFor(p), ornament = ornamentFor(p, seed, a);
  const orange = palette.accent, base = palette.base;
  ctx.save();
  ctx.lineWidth = 0.7;
  ctx.strokeStyle = '#d7e5dd60';
  ctx.fillStyle = p.finPigment > 0.55 ? orange : '#c5ded8aa';
  // Caudal fin rooted inside the peduncle; rays are clipped to the fin.
  const c = a.caudal;
  const caudal = new Path2D();
  caudal.moveTo(...at(c.root));
  caudal.bezierCurveTo(...at(c.upperInner), ...at(c.upperOuter, wave), ...at(c.upperTip, wave));
  caudal.lineTo(...at(c.notch, wave));
  caudal.lineTo(...at(c.lowerTip, wave));
  caudal.bezierCurveTo(...at(c.lowerOuter, wave), ...at(c.lowerInner), ...at(c.root));
  ctx.fill(caudal); ctx.stroke(caudal);
  ctx.save(); ctx.clip(caudal);
  if (ornament) {
    ctx.save();
    ctx.save(); ctx.scale(l, l);
    // Tail texture leans with the tail beat; the live outline clips it.
    const lean = wave / Math.max(c.upperTip.x - c.root.x, 1e-6);
    ctx.transform(1, lean, 0, 1, 0, -lean * c.root.x);
    paint(ctx, ornament.caudal);
    ctx.restore();
    const { edge, tips, flame } = ornament.fins;
    if (tips) {
      const gradient = ctx.createLinearGradient(c.root.x * l, 0, c.upperTip.x * l, 0);
      gradient.addColorStop(0.45, '#18252600'); gradient.addColorStop(1, '#182526f2');
      ctx.globalAlpha = tips; ctx.fillStyle = gradient; ctx.fill(caudal);
    }
    if (flame) {
      ctx.globalAlpha = flame; ctx.strokeStyle = orange; ctx.lineWidth = Math.max(1, l * 0.02); ctx.lineCap = 'round';
      for (const ray of c.rays) { ctx.beginPath(); ctx.moveTo(...at(ray.start)); ctx.quadraticCurveTo(...at(ray.control, wave * 0.5), ...at(ray.end, wave)); ctx.stroke(); }
    }
    if (edge) { ctx.globalAlpha = edge; ctx.strokeStyle = orange; ctx.lineWidth = Math.max(1.5, l * 0.07); ctx.stroke(caudal); }
    ctx.restore();
  }
  for (const ray of c.rays) { ctx.beginPath(); ctx.moveTo(...at(ray.start)); ctx.quadraticCurveTo(...at(ray.control, wave * 0.5), ...at(ray.end, wave)); ctx.stroke(); }
  ctx.restore();
  // Dorsal and pectoral fins sit behind the body with roots inside the outline.
  for (const fin of [a.dorsal, a.pectoral]) {
    const path = new Path2D();
    path.moveTo(...at(fin.start)); path.quadraticCurveTo(...at(fin.control), ...at(fin.end)); path.closePath();
    ctx.fill(path); ctx.stroke(path);
    if (!ornament || fin !== a.dorsal) continue;
    ctx.save(); ctx.clip(path);
    ctx.save(); ctx.scale(l, l); paint(ctx, ornament.dorsal); ctx.restore();
    const { edge, tips, flame } = ornament.fins;
    const [baseX, baseY] = at(fin.start), [, controlY] = at(fin.control), apexY = (baseY + controlY) / 2;
    if (tips) {
      const gradient = ctx.createLinearGradient(0, baseY, 0, apexY);
      gradient.addColorStop(0.35, '#18252600'); gradient.addColorStop(1, '#182526f2');
      ctx.globalAlpha = tips; ctx.fillStyle = gradient; ctx.fill(path);
    }
    if (flame) {
      ctx.globalAlpha = flame; ctx.strokeStyle = orange; ctx.lineWidth = Math.max(1, l * 0.02); ctx.lineCap = 'round';
      const [endX] = at(fin.end);
      for (const t of [0.2, 0.4, 0.6, 0.8]) {
        const x = baseX + (endX - baseX) * t, q = (1 - t) * (1 - t), r = 2 * (1 - t) * t, u = t * t;
        const [cx, cy] = at(fin.control), [sx, sy] = at(fin.start), [ex, ey] = at(fin.end);
        ctx.beginPath(); ctx.moveTo(x, baseY); ctx.lineTo(q * sx + r * cx + u * ex, q * sy + r * cy + u * ey); ctx.stroke();
      }
    }
    if (edge) { ctx.globalAlpha = edge; ctx.strokeStyle = orange; ctx.lineWidth = Math.max(1.5, l * 0.06); ctx.stroke(path); }
    ctx.restore();
  }
  const body = new Path2D();
  body.moveTo(...at(a.top[0]));
  for (const point of a.top) body.lineTo(...at(point));
  for (let i = a.bottom.length - 1; i >= 0; i--) body.lineTo(...at(a.bottom[i]));
  body.closePath();
  ctx.fillStyle = base; ctx.fill(body);
  ctx.save(); ctx.clip(body);
  // Inherited markings live in body coordinates, so they stay attached to any silhouette. Dark layer sits over warm.
  const markings = markingsFor(p, seed);
  for (const layer of ['warm', 'dark'] as const) {
    const color = layer === 'dark' ? '#182526' : orange;
    const alpha = (layer === 'dark' ? p.black : p.red) * (1 - p.translucency) * p.appearance.patches;
    if (alpha < 0.005) continue;
    ctx.globalAlpha = alpha;
    for (const marking of markings) {
      if (marking.layer !== layer) continue;
      const [x, y] = at(markingPosition(a, marking)), radius = marking.radius * l;
      ctx.fillStyle = color;
      if (p.edge > 0.55) {
        const glow = ctx.createRadialGradient(x, y, radius * 0.4, x, y, radius);
        glow.addColorStop(0, color); glow.addColorStop(1, 'transparent'); ctx.fillStyle = glow;
      }
      ctx.beginPath(); ctx.ellipse(x, y, radius, radius * marking.aspect, marking.angle, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (ornament) {
    ctx.save(); ctx.scale(l, l);
    paint(ctx, ornament.body);
    if (ornament.shimmer >= SHIMMER_VISIBLE) {
      ctx.fillStyle = '#fffdf2';
      ornament.sparkles.forEach((path, i) => { ctx.globalAlpha = Math.min(1, ornament.shimmer) * (0.3 + 0.7 * Math.abs(Math.sin(time * 1.6 + i * 1.9 + seed % 7))); ctx.fill(path); });
    }
    ctx.restore();
  }
  const speckle = random(hash(`speckle:${seed}`));
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#263935';
  for (let i = 0; i < p.speckle * 55; i++) { ctx.beginPath(); ctx.arc((speckle() - 0.5) * l, (speckle() - 0.5) * h, l * 0.008, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
  const shine = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  shine.addColorStop(0, `rgba(255,255,255,${0.22 + p.metallic * 0.4})`); shine.addColorStop(0.42, '#ffffff00'); shine.addColorStop(1, '#092a344f');
  ctx.fillStyle = shine; ctx.fillRect(-l, -h, l * 2, h * 2);
  // Gill cover is drawn inside the silhouette so it can never stray outside the body.
  ctx.strokeStyle = '#46564c90';
  ctx.beginPath(); ctx.moveTo(...at(a.gill.start)); ctx.quadraticCurveTo(...at(a.gill.control), ...at(a.gill.end)); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = '#e3f2e24a'; ctx.stroke(body);
  const { center, radius, pupilRadius } = a.eye;
  const [eyeX, eyeY] = at(center), eyeRadius = radius * l;
  ctx.fillStyle = palette.iris[0]; ctx.beginPath(); ctx.arc(eyeX, eyeY, eyeRadius, 0, Math.PI * 2); ctx.fill();
  if (palette.iris[1]) { ctx.fillStyle = palette.iris[1]; ctx.beginPath(); ctx.arc(eyeX, eyeY, eyeRadius * 0.62, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#101c1b'; ctx.beginPath(); ctx.arc(eyeX - eyeRadius * 0.12, eyeY, pupilRadius * l, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(eyeX - eyeRadius * 0.22, eyeY - eyeRadius * 0.22, eyeRadius * 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#46564c90';
  ctx.beginPath(); ctx.moveTo(...at(a.mouth.tip)); ctx.lineTo(...at(a.mouth.corner)); ctx.stroke();
  ctx.strokeStyle = '#e0dbc3aa';
  for (const barbel of a.barbels) { ctx.beginPath(); ctx.moveTo(...at(barbel.start)); ctx.quadraticCurveTo(...at(barbel.control), ...at(barbel.end)); ctx.stroke(); }
  ctx.restore();
}
