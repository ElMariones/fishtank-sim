import { caudalPolygon, guppyAnatomyFor, GUPPY_TAIL_WAVE, type GuppyAnatomy, type PFin, type PVec } from '../core/guppyAnatomy';
import type { GuppyColor, GuppyPhenotype } from '../core/guppyGenetics';
import { hash, random } from '../core/random';
import { drawEyeCloud, drawFray, drawSomatic, somaticPoint } from './genesis';
import { FULL_DETAIL, type Detail } from './lod';

/**
 * Guppy renderer v1. Consumes only the guppy phenotype and its anatomy. Males carry the color: iridophore patches,
 * orange and black spots, red and patterned tails (mosaic, grass, lace, leopard, tiger), tuxedo rear halves, snakeskin
 * chains, metal heads and the Y-linked programs. Every male color layer is multiplied by `color.expression`, so a female
 * shows only her small leak and a young male colors up as his stage expression rises. Females are bigger, grey and
 * clear-finned, with a gravid spot that darkens and a belly that swells while they carry a brood. It never breeds,
 * prices or changes identity.
 */
export type GuppyMotion = { tailPhase: number; finPhase: number; effort: number };

const css = (c: GuppyColor, alpha = 1, dl = 0, ds = 1) => `hsla(${c.h.toFixed(1)}, ${(Math.min(1, Math.max(0, c.s * ds)) * 100).toFixed(1)}%, ${(Math.min(1, Math.max(0, c.l + dl)) * 100).toFixed(1)}%, ${Math.min(1, Math.max(0, alpha)).toFixed(3)})`;
const ORANGE = (red: GuppyColor): GuppyColor => ({ h: Math.min(32, red.h + 16), s: 0.92, l: 0.55 });
const PALE_FIN: GuppyColor = { h: 45, s: 0.12, l: 0.82 };

type Spot = { x: number; y: number; rx: number; ry: number; angle: number };
type Texture = {
  iri: Spot[]; orange: Spot[]; black: Spot[]; tail: Path2D | null; tailStroke: Path2D | null; scales: Path2D | null; snake: Path2D | null; dorsalDots: Spot[];
};
const textures = new WeakMap<GuppyPhenotype, Texture>();
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const yAt = (points: readonly PVec[], x: number) => {
  for (let i = 1; i < points.length; i++) if (points[i].x >= x) { const a = points[i - 1], b = points[i]; return lerp(a.y, b.y, (x - a.x) / Math.max(1e-6, b.x - a.x)); }
  return points[points.length - 1].y;
};

function textureFor(p: GuppyPhenotype, a: GuppyAnatomy): Texture {
  const cached = textures.get(p);
  if (cached) return cached;
  const c = p.color, rng = random(hash(`guppy:texture:${p.pattern.seed}`));
  const flank = (x0: number, x1: number, y0: number, y1: number): PVec => {
    const x = lerp(x0, x1, rng()), top = yAt(a.top, x), bottom = yAt(a.bottom, x);
    return { x, y: lerp(top, bottom, lerp(y0, y1, rng())) };
  };
  const spot = (v: PVec, r: number): Spot => ({ ...v, rx: r * (0.8 + 0.5 * rng()), ry: r * (0.6 + 0.4 * rng()), angle: (rng() - 0.5) * 0.9 });
  const iri = Array.from({ length: 3 + Math.round(4 * c.iriAmount) }, () => spot(flank(-0.3, 0.2, 0.15, 0.7), 0.035 + 0.03 * rng()));
  const orange = Array.from({ length: c.orangeSpots }, () => spot(flank(-0.22, 0.22, 0.2, 0.75), 0.022 + 0.6 * c.spotSize));
  const black = Array.from({ length: c.blackSpots }, () => spot(flank(-0.18, 0.24, 0.25, 0.7), 0.012 + 0.45 * c.spotSize));
  const dorsalDots: Spot[] = [];
  if (p.pattern.dorsal > 0.35) {
    for (const [root, tip] of a.dorsal.rays) for (let k = 0; k < 2; k++) {
      const t = 0.3 + 0.6 * rng();
      dorsalDots.push(spot({ x: lerp(root.x, tip.x, t), y: lerp(root.y, tip.y, t) }, 0.006 + 0.008 * p.pattern.dorsal));
    }
  }
  let tail: Path2D | null = null, tailStroke: Path2D | null = null, scales: Path2D | null = null, snake: Path2D | null = null;
  if (typeof Path2D !== 'undefined') {
    // Tail patterns live in fan coordinates (radius share ρ, edge index), so they follow the fan's shape.
    const fan = a.caudal, n = fan.edge.length;
    const inFan = (rho: number, s: number): PVec => {
      const f = Math.min(n - 1.001, Math.max(0, (s + 1) / 2 * (n - 1))), i = Math.floor(f), e0 = fan.edge[i], e1 = fan.edge[i + 1], t = f - i;
      const e = { x: lerp(e0.x, e1.x, t), y: lerp(e0.y, e1.y, t) };
      return { x: fan.root.x + (e.x - fan.root.x) * rho, y: fan.root.y + (e.y - fan.root.y) * rho };
    };
    const cover = p.pattern.coverage, scale = p.pattern.scale * (fan.length / 0.5);
    tail = new Path2D(); tailStroke = new Path2D();
    const dot = (v: PVec, r: number) => { tail!.moveTo(v.x + r, v.y); tail!.arc(v.x, v.y, r, 0, Math.PI * 2); };
    for (const kind of p.pattern.tail) {
      if (kind === 'mosaic') {
        // Irregular blotches thickest at the fin base, breaking into a network toward the edge.
        for (let i = 0; i < Math.round(18 + 34 * cover); i++) { const rho = 0.15 + 0.75 * rng() ** 1.3; dot(inFan(rho, rng() * 2 - 1), scale * (0.55 - 0.3 * rho) * (0.6 + 0.6 * rng())); }
      } else if (kind === 'grass') {
        for (let i = 0; i < Math.round(60 + 120 * cover); i++) dot(inFan(0.18 + 0.8 * rng(), rng() * 2 - 1), scale * (0.08 + 0.08 * rng()));
      } else if (kind === 'leopard') {
        for (let i = 0; i < Math.round(10 + 16 * cover); i++) dot(inFan(0.2 + 0.75 * rng(), rng() * 2 - 1), scale * (0.22 + 0.14 * rng()));
      } else if (kind === 'lace') {
        // A fine reticulated net of small rings.
        const rows = 6 + Math.round(5 * cover), cols = 9 + Math.round(6 * cover);
        for (let r = 1; r <= rows; r++) for (let k = 0; k <= cols; k++) {
          const v = inFan(0.12 + 0.86 * r / rows, -1 + 2 * (k + (r % 2) * 0.5) / (cols + 0.5)), rad = scale * 0.16;
          tailStroke.moveTo(v.x + rad, v.y); tailStroke.arc(v.x, v.y, rad, 0, Math.PI * 2);
        }
      } else if (kind === 'tiger') {
        // Bars across the rays, concentric with the fin base.
        const bars = 4 + Math.round(4 * cover);
        for (let r = 1; r <= bars; r++) {
          const rho = 0.15 + 0.82 * r / (bars + 0.5);
          for (let k = 0; k <= 20; k++) { const v = inFan(rho + 0.03 * Math.sin(k * 1.7 + r), -1 + k / 10); if (k) tailStroke.lineTo(v.x, v.y); else tailStroke.moveTo(v.x, v.y); }
        }
      }
    }
    // Scale reticulation over the body (all guppies), and the snakeskin chain where present.
    scales = new Path2D(); const size = 0.032, h = p.body.depth / 2 * 1.2;
    let row = 0;
    for (let y = -h; y <= h; y += size * 0.78, row++) for (let x = -0.32 + (row % 2) * size * 0.5; x <= 0.27; x += size * 0.9) { scales.moveTo(x, y - size * 0.5); scales.arc(x, y, size * 0.5, -Math.PI / 2, Math.PI / 2); }
    if (c.snakeskin > 0) {
      snake = new Path2D(); const link = 0.028 + 0.02 * p.pattern.scale * 6;
      for (let y = -h; y <= h; y += link * 0.9) for (let x = -0.3; x <= 0.26; x += link * 1.25) {
        const jx = (rng() - 0.5) * link * 0.3, jy = (rng() - 0.5) * link * 0.3;
        snake.moveTo(x + jx + link * 0.55, y + jy); snake.ellipse(x + jx, y + jy, link * 0.55, link * 0.38, (rng() - 0.5) * 0.6, 0, Math.PI * 2);
      }
    }
  }
  const texture = { iri, orange, black, tail, tailStroke, scales, snake, dorsalDots };
  textures.set(p, texture);
  return texture;
}

function finPath(fin: PFin, at: (v: PVec, dy?: number) => [number, number], sway = 0): Path2D {
  const path = new Path2D(), n = fin.points.length;
  fin.points.forEach((v, i) => { const t = Math.sin(Math.PI * i / (n - 1)); const [x, y] = at(v, sway * t); if (i) path.lineTo(x, y); else path.moveTo(x, y); });
  path.closePath();
  return path;
}

/** Draw a guppy facing left in body space at the origin. `size` multiplies the phenotype's body length. */
export function drawGuppy(ctx: CanvasRenderingContext2D, p: GuppyPhenotype, seed: number, size: number, time = 0, motion?: GuppyMotion, detail: Detail = FULL_DETAIL) {
  const a = guppyAnatomyFor(p), l = size * p.body.length, c = p.color, g = p.genesis, male = p.sex === 'M';
  if (!(l > 0)) return;
  const E = Math.max(0, Math.min(1, c.expression));
  const phase = motion ? motion.tailPhase : time * (3 + p.activity * 3) + (seed % 20);
  const amp = GUPPY_TAIL_WAVE * (motion ? Math.min(1, 0.45 + 0.55 * motion.effort) : 0.75);
  const wave = Math.sin(phase) * amp;
  const finPhase = motion ? motion.finPhase : time * 3 + (seed % 7);
  const at = (v: PVec, dy = 0): [number, number] => [v.x * l, (v.y + dy) * l];
  const texture = textureFor(p, a);
  const pigment = 1 - 0.85 * g.depigment;
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  // Male fin color: red where carotenoids reach, blue-green where iridophores lead, near-black on melanic lines.
  const melanic = c.programs.includes('moscow') || (c.melanin > 0.82 && c.edging > 0.6);
  const finColor: GuppyColor = melanic ? c.dark : c.redAmount >= 0.3 || c.iriAmount < 0.45 ? c.red : c.iri;

  // ── Dorsal fin(s), behind the body ──
  const drawDorsal = (fin: PFin, sway: number) => {
    const path = finPath(fin, at, sway);
    ctx.fillStyle = css(PALE_FIN, male ? 0.32 : 0.4); ctx.fill(path);
    if (male || E > 0.05) {
      const dorsalTint = c.programs.includes('maculatus') ? c.dark : c.iriAmount > c.redAmount ? c.iri : finColor;
      ctx.fillStyle = css(dorsalTint, E * (0.35 + 0.45 * Math.max(c.iriAmount, c.redAmount)) * pigment); ctx.fill(path);
      if (texture.dorsalDots.length && E > 0.1) {
        ctx.save(); ctx.clip(path); ctx.fillStyle = css(c.dark, 0.75 * E * pigment);
        ctx.beginPath(); for (const d of texture.dorsalDots) { const [x, y] = at(d, sway * 0.5); ctx.moveTo(x + d.rx * l, y); ctx.ellipse(x, y, d.rx * l, d.ry * l, d.angle, 0, Math.PI * 2); } ctx.fill(); ctx.restore();
      }
      if (c.programs.includes('armatus') || c.edging > 0.55) { ctx.strokeStyle = css(c.dark, 0.6 * E * c.edging * pigment); ctx.lineWidth = Math.max(0.6, l * 0.006); ctx.stroke(path); }
    }
    if (detail.finRays) {
      ctx.save(); ctx.clip(path); ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'; ctx.lineWidth = Math.max(0.35, l * 0.0025); ctx.beginPath();
      for (const [r0, r1] of fin.rays) { ctx.moveTo(...at(r0)); ctx.lineTo(...at(r1, sway)); } ctx.stroke(); ctx.restore();
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)'; ctx.lineWidth = Math.max(0.4, l * 0.003); ctx.stroke(path);
    if (g.finFray > 0) drawFray(ctx, g, fin.points, (v: PVec) => at(v), l, seed);
  };
  drawDorsal(a.dorsal, Math.sin(finPhase * 0.6) * 0.01);
  if (a.dorsal2) drawDorsal(a.dorsal2, Math.sin(finPhase * 0.6 - 0.7) * 0.008);

  // ── Caudal fan: one shear per frame bends the whole fan (outline, pattern and rays) with the stroke ──
  const fan = a.caudal, rx = fan.root.x * l, shear = wave / Math.max(0.05, fan.length);
  ctx.save();
  ctx.translate(rx, 0); ctx.transform(1, shear, 0, 1, 0, 0); ctx.translate(-rx, 0);
  const tail = new Path2D(), poly = caudalPolygon(fan);
  poly.forEach((v, i) => { const [x, y] = at(v); if (i) tail.lineTo(x, y); else tail.moveTo(x, y); });
  tail.closePath();
  ctx.fillStyle = css(PALE_FIN, male ? 0.3 : 0.42); ctx.fill(tail);
  ctx.save(); ctx.clip(tail);
  if (E > 0.01) {
    // Base fin color, the iridescent shimmer of blue lines, and the melanic overlay of Moscow and full-black fish.
    const base = male ? 0.5 + 0.45 * Math.max(c.redAmount, c.iriAmount * 0.8) : 0.9;
    const fill = ctx.createLinearGradient(fan.root.x * l, 0, (fan.root.x + fan.length) * l, 0);
    fill.addColorStop(0, css(finColor, E * base * pigment, -0.06)); fill.addColorStop(1, css(finColor, E * base * 0.85 * pigment, 0.04));
    ctx.fillStyle = fill; ctx.fill(tail);
    if (c.asianBlau && E > 0.2) { ctx.fillStyle = css(c.iri, 0.35 * E * c.iriAmount * pigment, 0.05); ctx.fill(tail); }
    if (c.magenta > 0.2) { ctx.fillStyle = `hsla(318, 70%, 55%, ${(0.3 * c.magenta * E * pigment).toFixed(3)})`; ctx.fill(tail); }
    if (texture.tail || texture.tailStroke) {
      ctx.save(); ctx.scale(l, l);
      ctx.fillStyle = css(c.dark, Math.min(1, (0.55 + 0.4 * p.pattern.edge) * E * pigment));
      if (texture.tail) ctx.fill(texture.tail);
      ctx.strokeStyle = css(c.dark, Math.min(1, (0.5 + 0.4 * p.pattern.edge) * E * pigment)); ctx.lineWidth = 0.004 + 0.006 * p.pattern.scale * 6;
      if (texture.tailStroke) ctx.stroke(texture.tailStroke);
      ctx.restore();
    }
  }
  if (detail.finRays) {
    ctx.strokeStyle = `rgba(255, 255, 255, ${(0.08 + 0.1 * p.tail.rays).toFixed(3)})`; ctx.lineWidth = Math.max(0.35, l * 0.0025); ctx.beginPath();
    const rays = 9 + Math.round(8 * p.tail.rays);
    for (let i = 0; i <= rays; i++) { const v = fan.edge[Math.round(i / rays * (fan.edge.length - 1))]; ctx.moveTo(...at(fan.root)); ctx.lineTo(...at(v)); }
    ctx.stroke();
  }
  ctx.restore();
  // Border: a black margin (edging) and/or a pale or iridescent rim (tail border), tracing the trailing edge only.
  const rim = new Path2D(); fan.edge.forEach((v, i) => { const [x, y] = at(v); if (i) rim.lineTo(x, y); else rim.moveTo(x, y); });
  if (E > 0.05 && c.edging > 0.3) { ctx.strokeStyle = css(c.dark, E * c.edging * 0.85 * pigment); ctx.lineWidth = Math.max(0.6, l * (0.006 + 0.012 * c.edging)); ctx.stroke(rim); }
  if (E > 0.05 && c.tailBorder > 0.45) { ctx.strokeStyle = css(c.iri, E * (c.tailBorder - 0.3) * pigment, 0.15); ctx.lineWidth = Math.max(0.5, l * 0.006); ctx.stroke(rim); }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'; ctx.lineWidth = Math.max(0.4, l * 0.0025); ctx.stroke(tail);
  ctx.restore();
  if (g.finFray > 0) drawFray(ctx, g, fan.edge.filter((_, i) => i % 3 === 0), (v: PVec) => { const [x, y] = at(v); return [x, y + shear * (x - rx)]; }, l, seed);

  // ── Body ──
  const body = new Path2D();
  body.moveTo(...at(a.top[0]));
  for (let i = 1; i < a.top.length; i++) body.lineTo(...at(a.top[i]));
  for (let i = a.bottom.length - 1; i >= 0; i--) body.lineTo(...at(a.bottom[i]));
  body.closePath();
  const h = p.body.depth / 2 * l;
  const shade = ctx.createLinearGradient(0, -h * 1.1, 0, h * 1.2);
  shade.addColorStop(0, css(c.body, 1, -0.16, 1.1)); shade.addColorStop(0.45, css(c.body, 1, 0.02)); shade.addColorStop(0.8, css(c.belly, 1)); shade.addColorStop(1, css(c.belly, 1, 0.05, 0.6));
  ctx.fillStyle = shade; ctx.fill(body);
  ctx.save(); ctx.clip(body);
  const ellipses = (spots: readonly Spot[], fill: string, grow = 1) => {
    ctx.fillStyle = fill; ctx.beginPath();
    for (const s of spots) { const [x, y] = at(s); ctx.moveTo(x + s.rx * l * grow, y); ctx.ellipse(x, y, s.rx * l * grow, s.ry * l * grow, s.angle, 0, Math.PI * 2); }
    ctx.fill();
  };
  if (E > 0.01) {
    // Metal head and Asian blau: iridophores flood the head or the whole fish.
    if (c.asianBlau) { ctx.fillStyle = css(c.iri, 0.4 * E * c.iriAmount * pigment); ctx.fill(body); }
    if (c.metalHead) {
      const head = ctx.createLinearGradient(-0.5 * l, 0, -0.12 * l, 0);
      head.addColorStop(0, css(c.iri, 0.85 * E * pigment, 0.12)); head.addColorStop(1, css(c.iri, 0));
      ctx.fillStyle = head; ctx.fill(body);
    }
    // Moscow and full-black: the whole fish darkens, with a blue-green sheen over the front.
    if (melanic) { ctx.fillStyle = css(c.dark, 0.8 * E * pigment); ctx.fill(body); }
    // Pingu: a red rear body.
    if (c.programs.includes('pingu')) {
      const rear = ctx.createLinearGradient(-0.1 * l, 0, 0.25 * l, 0);
      rear.addColorStop(0, css(c.red, 0)); rear.addColorStop(0.5, css(c.red, 0.75 * E * pigment)); rear.addColorStop(1, css(c.red, 0.85 * E * pigment));
      ctx.fillStyle = rear; ctx.fill(body);
    }
    if (detail.markingGlow) {
      for (const s of texture.iri) {
        const [x, y] = at(s), r = s.rx * l * (0.8 + 0.5 * c.iriAmount);
        const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
        glow.addColorStop(0, css(c.iri, 0.85 * E * c.iriAmount * pigment, 0.12)); glow.addColorStop(1, css(c.iri, 0));
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
    } else ellipses(texture.iri, css(c.iri, 0.55 * E * c.iriAmount * pigment, 0.08));
    if (texture.orange.length) ellipses(texture.orange, css(ORANGE(c.red), 0.92 * E * pigment));
    if (texture.black.length) ellipses(texture.black, css(c.dark, 0.9 * E * pigment));
    // Maculatus: the Y-linked black spot under the dorsal fin.
    if (c.programs.includes('maculatus')) { const v = { x: 0.02, y: yAt(a.top, 0.02) * 0.45 }; ellipses([{ ...v, rx: 0.035, ry: 0.028, angle: 0 }], css(c.dark, 0.85 * E * pigment)); }
    if (texture.snake && c.snakeskin > 0) {
      ctx.save(); ctx.scale(l, l); ctx.strokeStyle = css(c.dark, 0.7 * c.snakeskin * E * pigment); ctx.lineWidth = 0.008; ctx.stroke(texture.snake); ctx.restore();
    }
  }
  // Tuxedo (half-black): the rear half darkens in both sexes, more strongly in males.
  if (c.halfBlack > 0) {
    const rear = ctx.createLinearGradient(-0.12 * l, 0, 0.02 * l, 0);
    const alpha = c.halfBlack * (0.55 + 0.4 * Math.max(E, male ? 0 : 0.4)) * pigment;
    rear.addColorStop(0, css(c.dark, 0)); rear.addColorStop(1, css(c.dark, alpha));
    ctx.fillStyle = rear; ctx.fill(body);
  }
  // Scale net: guppies read reticulated in a good light.
  if (texture.scales && detail.finRays) {
    ctx.save(); ctx.scale(l, l); ctx.strokeStyle = css(c.dark, 0.1 + 0.08 * c.melanin); ctx.lineWidth = Math.max(0.3, l * 0.0025) / l; ctx.stroke(texture.scales); ctx.restore();
  }
  // Gravid spot: dark above the anal fin, darker and wider as a brood grows.
  if (a.gravidSpot) {
    const gs = a.gravidSpot, [gx, gy] = at(gs.center), gravid = p.gravid ?? 0;
    const spot = ctx.createRadialGradient(gx, gy, 0, gx, gy, gs.rx * l);
    spot.addColorStop(0, css(c.dark, (0.35 + 0.5 * gravid) * pigment)); spot.addColorStop(1, css(c.dark, 0));
    ctx.fillStyle = spot; ctx.beginPath(); ctx.ellipse(gx, gy, gs.rx * l, gs.ry * l, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (g.somatic) {
    const point = somaticPoint(a.top, a.bottom, a.top[0].x + 0.1, 0.4, g.somatic.u, g.somatic.v);
    drawSomatic(ctx, g.somatic, point.x * l, point.y * l, l, css(c.body, 1));
  }
  // Silver belly sheen and a light lateral highlight.
  const sheen = ctx.createLinearGradient(0, -h, 0, h);
  sheen.addColorStop(0.2, 'rgba(255,255,255,0)'); sheen.addColorStop(0.42, `rgba(240, 250, 255, ${(0.12 + 0.18 * g.sheen).toFixed(3)})`); sheen.addColorStop(0.6, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen; ctx.fillRect(-0.5 * l, -h * 1.4, 0.85 * l, h * 2.8);
  if (g.depigment > 0) { ctx.fillStyle = `rgba(238, 234, 226, ${(0.35 * g.depigment).toFixed(3)})`; ctx.fill(body); }
  ctx.restore();
  ctx.strokeStyle = css(c.body, 0.55, -0.28); ctx.lineWidth = Math.max(0.5, l * 0.004);
  ctx.beginPath(); ctx.moveTo(...at(a.top[a.top.length - 1])); for (let i = a.top.length - 2; i >= 0; i--) ctx.lineTo(...at(a.top[i])); for (const v of a.bottom) ctx.lineTo(...at(v)); ctx.stroke();
  // Gill cover.
  ctx.strokeStyle = css(c.body, 0.45, -0.22); ctx.lineWidth = Math.max(0.5, l * 0.004);
  const gt = a.head.gillTop, gb = a.head.gillBottom;
  ctx.beginPath(); ctx.moveTo(...at(gt)); ctx.quadraticCurveTo(...at({ x: (gt.x + gb.x) / 2 + 0.03, y: (gt.y + gb.y) / 2 }), ...at(gb)); ctx.stroke();

  // ── Eye: large, with a ringed iris; albinos have red eyes ──
  const [ex, ey] = at(a.eye.center), er = a.eye.radius * l;
  ctx.fillStyle = css(c.iris, 1, 0.05); ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = css(c.iris, 0.85, -0.2); ctx.lineWidth = Math.max(0.5, er * 0.14); ctx.stroke();
  ctx.fillStyle = c.base === 'albino' ? 'rgba(150, 18, 38, 0.95)' : '#090c0f'; ctx.beginPath(); ctx.arc(ex - er * 0.06, ey, er * 0.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(ex - er * 0.32, ey - er * 0.32, Math.max(0.6, er * 0.18), 0, Math.PI * 2); ctx.fill();
  if (g.eyeCloud > 0) drawEyeCloud(ctx, g, ex, ey, er);

  // ── Near fins ──
  const clearFin = (fin: PFin, sway: number, tint: GuppyColor | null, tintAlpha: number) => {
    const path = finPath(fin, at, sway);
    ctx.fillStyle = css(PALE_FIN, 0.35); ctx.fill(path);
    if (tint && tintAlpha > 0.02) { ctx.fillStyle = css(tint, tintAlpha); ctx.fill(path); }
    if (detail.finRays) {
      ctx.save(); ctx.clip(path); ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'; ctx.lineWidth = Math.max(0.35, l * 0.0022); ctx.beginPath();
      for (const [r0, r1] of fin.rays) { ctx.moveTo(...at(r0)); ctx.lineTo(...at(r1, sway)); } ctx.stroke(); ctx.restore();
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'; ctx.lineWidth = Math.max(0.35, l * 0.0025); ctx.stroke(path);
  };
  clearFin(a.anal, Math.sin(finPhase + 1) * 0.004, male ? finColor : null, 0.3 * E * pigment);
  if (a.gonopodium) clearFin(a.gonopodium, Math.sin(finPhase * 0.5) * 0.004, c.body, 0.6);
  clearFin(a.pelvic, Math.sin(finPhase + 0.5) * 0.008, male ? finColor : null, (0.25 + 0.5 * c.finRed) * E * pigment);
  // Dumbo ears carry the tail color; ordinary pectorals stay clear and beat fast.
  const beat = Math.sin(finPhase * 1.6) * (0.012 + 0.012 * p.fins.dumbo) * (motion ? 0.4 + 0.6 * motion.effort : 0.6);
  clearFin(a.pectoral, beat, p.fins.dumbo ? finColor : null, p.fins.dumbo ? (0.25 + 0.5 * E) * pigment : 0);
  // Upturned mouth.
  ctx.strokeStyle = css(c.body, 0.8, -0.32); ctx.lineWidth = Math.max(0.5, l * 0.004);
  const [mx, my] = at(a.head.mouth); ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + 0.03 * l, my - 0.006 * l); ctx.stroke();
  ctx.restore();
}
