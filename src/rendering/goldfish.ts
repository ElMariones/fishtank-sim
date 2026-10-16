import { goldfishAnatomyFor, GOLDFISH_TAIL_WAVE, type GFin, type GLobe, type GoldfishAnatomy, type GVec } from '../core/goldfishAnatomy';
import type { GoldfishColor, GoldfishPhenotype } from '../core/goldfishGenetics';
import { hash, random } from '../core/random';
import { drawEyeCloud, drawFray } from './genesis';
import { FULL_DETAIL, type Detail } from './lod';

/**
 * Goldfish renderer v1. Consumes only the goldfish phenotype and its anatomy: translucent flowing fins, twin and
 * four-lobed tails, egg bodies, hoods, telescope, celestial and bubble eyes, pompons, metallic, nacreous and matte
 * scales, pearl domes, sarasa/redcap/panda/calico/tri-color patterns and the juvenile bronze. It never breeds, prices
 * or changes identity.
 */
export type GoldfishMotion = { tailPhase: number; finPhase: number; effort: number };

const css = (c: GoldfishColor, alpha = 1, dl = 0, ds = 1) => `hsla(${c.h.toFixed(1)}, ${(Math.min(1, Math.max(0, c.s * ds)) * 100).toFixed(1)}%, ${(Math.min(1, Math.max(0, c.l + dl)) * 100).toFixed(1)}%, ${alpha.toFixed(3)})`;
const WHITE: GoldfishColor = { h: 36, s: 0.25, l: 0.94 };
const MATTE_WHITE: GoldfishColor = { h: 8, s: 0.45, l: 0.88 };
const RED: GoldfishColor = { h: 6, s: 0.82, l: 0.47 };

type Patch = { x: number; y: number; rx: number; ry: number; angle: number; kind: 'white' | 'color' | 'dark' | 'speckle' | 'crown' };
type Texture = { scales: Path2D | null; pearls: Path2D | null; sparkles: GVec[]; patches: Patch[]; ground: GoldfishColor };
const textures = new WeakMap<GoldfishPhenotype, Texture>();

function patchesFor(p: GoldfishPhenotype, a: GoldfishAnatomy): { patches: Patch[]; ground: GoldfishColor } {
  const c = p.color, modes = p.pattern.modes, rng = random(hash(`goldfish:patches:${p.pattern.seed}`)), h = p.body.depth / 2;
  const white = p.scales.type === 'matte' ? MATTE_WHITE : WHITE, patches: Patch[] = [];
  const blob = (kind: Patch['kind'], scale = 1, region: [number, number] = [-0.42, 0.26], band: [number, number] = [-0.85, 0.85]) => {
    const r = p.pattern.scale * scale * (0.7 + 0.7 * rng());
    patches.push({ kind, x: region[0] + rng() * (region[1] - region[0]), y: h * (band[0] + rng() * (band[1] - band[0])), rx: r * (1.1 + 0.6 * rng()), ry: r * (0.7 + 0.4 * rng()), angle: (rng() - 0.5) * 0.8 });
  };
  const count = (share: number) => Math.round(2 + 9 * share);
  let ground = c.darkAmount >= 0.7 ? c.dark : c.whiteShare > 0.86 ? white : c.body;
  if ((c.bronzeShare ?? 0) > 0.5) {
    // Before the color break every goldfish is a bronze juvenile: no pattern yet, dark mottling over the back.
    ground = c.body;
    for (let i = 0; i < 6; i++) blob('dark', 0.9, [-0.4, 0.28], [-1, 0]);
    return { patches, ground };
  }
  if (modes.includes('calico') && p.scales.type !== 'metallic') {
    // Calico: the blue ground of transparent scales, red and orange patches, black speckles.
    ground = { h: 205, s: 0.12 + 0.35 * c.nacreBlue, l: 0.8 - 0.18 * c.nacreBlue };
    for (let i = 0; i < count(p.pattern.coverage * 0.75); i++) blob('color', 0.5);
    for (let i = 0; i < 16 + Math.round(36 * Math.max(0.3, c.darkAmount)); i++) blob('speckle', 0.09);
  } else if (modes.includes('redcap')) {
    ground = white;
    patches.push({ kind: 'crown', x: a.eye.socket.x + 0.07, y: -h * 0.8, rx: 0.1, ry: 0.07, angle: 0.1 });
  } else if (modes.includes('panda') && c.darkAmount > 0.3) {
    ground = white;
    for (let i = 0; i < count(p.pattern.coverage); i++) blob('dark', 1, [-0.45, 0.26], [-0.95, 0.2]);
  } else if (modes.includes('tri-color')) {
    ground = white;
    for (let i = 0; i < count(p.pattern.coverage * 0.7); i++) blob('color');
    for (let i = 0; i < count(p.pattern.coverage * 0.4); i++) blob('dark', 0.7);
  } else if (c.whiteShare > 0.08 && c.whiteShare <= 0.86 || modes.includes('sarasa')) {
    // Sarasa: whichever color covers more is the ground; the other forms patches.
    const share = Math.max(c.whiteShare, modes.includes('sarasa') ? 0.4 + 0.3 * p.pattern.coverage : 0);
    if (share >= 0.5 && c.darkAmount < 0.7) { ground = white; for (let i = 0; i < count(1 - share); i++) blob('color', 1.3); }
    else for (let i = 0; i < count(share); i++) blob('white', 1.3);
  }
  // Dark pigment left after the break (red and black), or a bronze juvenile's mottling: along the back and in blotches.
  if (c.darkAmount > 0.18 && c.darkAmount < 0.7 && !modes.includes('panda') && !modes.includes('calico')) {
    for (let i = 0; i < Math.round(2 + 6 * c.darkAmount); i++) blob('dark', 0.7, [-0.38, 0.28], [-1, -0.2]);
  }
  return { patches, ground };
}

function textureFor(p: GoldfishPhenotype, a: GoldfishAnatomy): Texture {
  const cached = textures.get(p);
  if (cached) return cached;
  const { patches, ground } = patchesFor(p, a);
  const s = 0.022 + 0.03 * p.scales.size, h = p.body.depth / 2 * 1.15, rng = random(hash(`goldfish:scales:${p.pattern.seed}`));
  let scales: Path2D | null = null, pearls: Path2D | null = null;
  const sparkles: GVec[] = [];
  if (typeof Path2D !== 'undefined') {
    scales = new Path2D(); if (p.scales.pearl > 0.05) pearls = new Path2D();
    let row = 0;
    for (let y = -h; y <= h; y += s * 0.8, row++) {
      for (let x = -0.36 + (row % 2) * s * 0.5; x <= 0.3; x += s * 0.9) {
        scales.moveTo(x, y - s * 0.5); scales.arc(x, y, s * 0.5, -Math.PI / 2, Math.PI / 2);
        if (pearls) { pearls.moveTo(x + s * 0.32, y); pearls.arc(x, y, s * 0.32 * (0.6 + 0.4 * p.scales.pearl), 0, Math.PI * 2); }
        if (p.scales.sparkle > 0 && rng() < 0.04 + 0.2 * p.scales.sparkle) sparkles.push({ x, y });
      }
    }
  }
  const texture = { scales, pearls, sparkles, patches, ground };
  textures.set(p, texture);
  return texture;
}

function lobePath(l: GLobe, at: (v: GVec, dy?: number) => [number, number], wave: number, lag: number): Path2D {
  const path = new Path2D();
  path.moveTo(...at(l.baseTop));
  path.quadraticCurveTo(...at(l.upperOuter, lag), ...at(l.upperTip, wave));
  if (l.fused) path.quadraticCurveTo(...at({ x: l.notch.x + (l.upperTip.x - l.notch.x) * 0.6, y: l.notch.y }, wave), ...at(l.lowerTip, wave));
  else { path.lineTo(...at(l.notch, wave * 0.8)); path.lineTo(...at(l.lowerTip, wave)); }
  path.quadraticCurveTo(...at(l.lowerOuter, lag), ...at(l.baseBottom));
  path.closePath();
  return path;
}

function finPath(fin: GFin, at: (v: GVec, dy?: number) => [number, number], sway = 0): Path2D {
  const path = new Path2D(), n = fin.points.length;
  fin.points.forEach((v, i) => { const t = Math.sin(Math.PI * i / (n - 1)); const [x, y] = at(v, sway * t); if (i) path.lineTo(x, y); else path.moveTo(x, y); });
  path.closePath();
  return path;
}

/**
 * Draw a goldfish facing left in body space at the origin. `size` multiplies the phenotype's body length, as for koi.
 */
export function drawGoldfish(ctx: CanvasRenderingContext2D, p: GoldfishPhenotype, seed: number, size: number, time = 0, motion?: GoldfishMotion, detail: Detail = FULL_DETAIL) {
  const a = goldfishAnatomyFor(p), l = size * p.body.length, c = p.color, g = p.genesis;
  if (!(l > 0)) return;
  const phase = motion ? motion.tailPhase : time * (1.6 + p.activity * 2.2) + (seed % 20);
  const amp = GOLDFISH_TAIL_WAVE * (motion ? Math.min(1, 0.5 + 0.5 * motion.effort) : 0.8);
  // Long fins trail: tips lag the stroke, so the tail ripples rather than flaps.
  const wave = Math.sin(phase) * amp, lag = Math.sin(phase - 0.9 - 0.5 * (p.fins.length - 1)) * amp * 0.55;
  const finPhase = motion ? motion.finPhase : time * 2.2 + (seed % 7);
  const at = (v: GVec, dy = 0): [number, number] => [v.x * l, (v.y + dy) * l];
  const texture = textureFor(p, a);
  const finAlpha = 0.62 + 0.25 * p.fins.rays - (p.fins.long ? 0.1 : 0);
  // Fins carry the body pigment: pale on white fish unless tinted, dark on black fish.
  const finBase = c.darkAmount >= 0.7 ? c.dark : texture.ground === WHITE || texture.ground === MATTE_WHITE ? (c.finTint > 0.55 ? c.fin : { ...WHITE, l: 0.86 }) : c.fin;
  const finFill = (far: boolean) => css(finBase, far ? finAlpha * 0.6 : finAlpha, far ? -0.1 : 0.03, far ? 0.85 : 1.05);
  const edgeStroke = css(finBase, 0.6, 0.16, 0.7);
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  // Far side: twin-tail back lobes and a paired anal fin.
  const drawLobe = (lobe: GLobe) => {
    const path = lobePath(lobe, at, wave * (lobe.far ? 0.85 : 1), lag);
    ctx.fillStyle = finFill(lobe.far); ctx.fill(path);
    if (p.color.finTint > 0.55) {
      // Tsubaki-style tinted fin margins.
      ctx.save(); ctx.clip(path); ctx.strokeStyle = css(c.fin, 0.55, -0.05, 1.1); ctx.lineWidth = Math.max(1, l * 0.025); ctx.stroke(path); ctx.restore();
    }
    if (detail.finRays) {
      ctx.save(); ctx.clip(path); ctx.strokeStyle = css(finBase, lobe.far ? 0.16 : 0.26, 0.2, 0.5); ctx.lineWidth = Math.max(0.4, l * 0.0035);
      const rays = 7 + Math.round(5 * p.fins.rays), tips = [lobe.upperTip, lobe.notch, lobe.lowerTip];
      ctx.beginPath();
      for (let i = 0; i <= rays; i++) {
        const t = i / rays, end = t < 0.5 ? { x: tips[0].x + (tips[1].x - tips[0].x) * t * 2, y: tips[0].y + (tips[1].y - tips[0].y) * t * 2 } : { x: tips[1].x + (tips[2].x - tips[1].x) * (t - 0.5) * 2, y: tips[1].y + (tips[2].y - tips[1].y) * (t - 0.5) * 2 };
        ctx.moveTo(...at(lobe.root)); ctx.quadraticCurveTo(...at({ x: (lobe.root.x + end.x) / 2, y: (lobe.root.y + end.y) / 2 + 0.01 }, lag * 0.5), ...at(end, wave));
      }
      ctx.stroke(); ctx.restore();
    }
    ctx.strokeStyle = edgeStroke; ctx.lineWidth = Math.max(0.5, l * 0.004); ctx.stroke(path);
  };
  const drawFin = (fin: GFin, sway = 0, far = fin.far) => {
    const path = finPath(fin, at, sway);
    ctx.fillStyle = finFill(far); ctx.fill(path);
    if (detail.finRays) {
      ctx.save(); ctx.clip(path); ctx.strokeStyle = css(finBase, 0.24, 0.2, 0.5); ctx.lineWidth = Math.max(0.4, l * 0.003); ctx.beginPath();
      for (const [r0, r1] of fin.rays) { ctx.moveTo(...at(r0)); ctx.lineTo(...at(r1, sway)); }
      ctx.stroke(); ctx.restore();
    }
    ctx.strokeStyle = edgeStroke; ctx.lineWidth = Math.max(0.5, l * 0.004); ctx.stroke(path);
    if (g.finFray > 0 && !far) drawFray(ctx, g, fin.points, (v: GVec) => at(v), l, seed);
  };
  for (const lobe of a.lobes) if (lobe.far) drawLobe(lobe);
  for (const fin of a.anal) if (fin.far) drawFin(fin);
  if (a.dorsal) drawFin(a.dorsal, Math.sin(finPhase * 0.5) * 0.008);
  for (const lobe of a.lobes) if (!lobe.far) drawLobe(lobe);
  if (g.finFray > 0) for (const lobe of a.lobes) if (!lobe.far) drawFray(ctx, g, [lobe.upperTip, lobe.notch, lobe.lowerTip], (v: GVec) => at(v, wave), l, seed);

  // ── Body ──
  const body = new Path2D();
  body.moveTo(...at(a.top[0]));
  for (let i = 1; i < a.top.length; i++) body.lineTo(...at(a.top[i]));
  for (let i = a.bottom.length - 1; i >= 0; i--) body.lineTo(...at(a.bottom[i]));
  body.closePath();
  const ground = texture.ground, h = p.body.depth / 2 * l;
  const shade = ctx.createLinearGradient(0, -h * 1.1, 0, h * 1.1);
  shade.addColorStop(0, css(ground, 1, -0.12, 1.05)); shade.addColorStop(0.45, css(ground, 1, 0.02)); shade.addColorStop(1, css(ground, 1, 0.14, 0.7));
  ctx.fillStyle = shade; ctx.fill(body);
  ctx.save(); ctx.clip(body);
  // Patches, in untilted body coordinates.
  ctx.save(); ctx.rotate(a.tilt);
  for (const patch of texture.patches) {
    const color = patch.kind === 'white' ? (p.scales.type === 'matte' ? MATTE_WHITE : WHITE) : patch.kind === 'dark' || patch.kind === 'speckle' ? c.dark : patch.kind === 'crown' ? RED : c.body;
    const alpha = patch.kind === 'dark' && c.darkAmount < 0.7 && !p.pattern.modes.includes('panda') ? 0.25 + 0.75 * c.darkAmount : patch.kind === 'speckle' ? 0.9 : 0.95;
    ctx.save(); ctx.translate(patch.x * l, patch.y * l); ctx.rotate(patch.angle); ctx.scale(1, patch.ry / patch.rx);
    if (detail.markingGlow && p.pattern.edge < 0.55 && patch.kind !== 'speckle') {
      const soft = ctx.createRadialGradient(0, 0, patch.rx * l * (0.35 + 0.5 * p.pattern.edge), 0, 0, patch.rx * l);
      soft.addColorStop(0, css(color, alpha)); soft.addColorStop(1, css(color, 0));
      ctx.fillStyle = soft;
    } else ctx.fillStyle = css(color, alpha);
    ctx.beginPath(); ctx.arc(0, 0, patch.rx * l, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  // Scales: metallic arcs catch light, reticulated outlines darken, pearl domes and nacreous sparkles shine.
  if (texture.scales) {
    ctx.save(); ctx.scale(l, l);
    const lw = Math.max(0.35, l * 0.003) / l;
    if (p.scales.type !== 'matte') { ctx.strokeStyle = `rgba(255, 246, 220, ${(0.06 + 0.14 * p.scales.reflectivity).toFixed(3)})`; ctx.lineWidth = lw; ctx.stroke(texture.scales); }
    if (p.scales.reticulation > 0.62) { ctx.strokeStyle = `rgba(60, 30, 16, ${(0.16 * (p.scales.reticulation - 0.62) / 0.38 + 0.04).toFixed(3)})`; ctx.lineWidth = lw * 1.2; ctx.stroke(texture.scales); }
    if (texture.pearls) {
      ctx.fillStyle = `rgba(255, 250, 238, ${(0.2 + 0.45 * p.scales.pearl).toFixed(3)})`; ctx.fill(texture.pearls);
      ctx.strokeStyle = 'rgba(120, 70, 40, 0.18)'; ctx.lineWidth = lw; ctx.stroke(texture.pearls);
    }
    if (texture.sparkles.length) {
      const twinkle = detail.sparkle ? 0.55 + 0.45 * Math.sin(time * 2.5 + seed) : 0.75;
      ctx.fillStyle = `rgba(235, 248, 255, ${(0.35 * twinkle + 0.25 * p.scales.sparkle).toFixed(3)})`;
      const r = 0.012 + 0.008 * p.scales.size;
      ctx.beginPath(); for (const v of texture.sparkles) { ctx.moveTo(v.x + r, v.y); ctx.arc(v.x, v.y, r, 0, Math.PI * 2); } ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
  // Metallic sheen along the flank; matte fish stay flat.
  if (p.scales.reflectivity > 0.2) {
    const sheen = ctx.createLinearGradient(0, -h, 0, h);
    sheen.addColorStop(0.15, 'rgba(255,255,255,0)'); sheen.addColorStop(0.35, `rgba(255, 252, 235, ${(0.28 * p.scales.reflectivity).toFixed(3)})`); sheen.addColorStop(0.55, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen; ctx.fillRect(a.bounds.minX * l, -h * 1.4, (a.bounds.maxX - a.bounds.minX) * l, h * 2.8);
  }
  if (g.depigment > 0) { ctx.fillStyle = `rgba(240, 236, 228, ${(0.35 * g.depigment).toFixed(3)})`; ctx.fill(body); }
  ctx.restore();
  ctx.strokeStyle = css(ground, 0.5, -0.25); ctx.lineWidth = Math.max(0.6, l * 0.004);
  ctx.beginPath(); ctx.moveTo(...at(a.top[a.top.length - 1])); for (let i = a.top.length - 2; i >= 0; i--) ctx.lineTo(...at(a.top[i])); for (const v of a.bottom) ctx.lineTo(...at(v)); ctx.stroke();

  // Gill cover: curled gills flare outward with a pale edge.
  ctx.strokeStyle = css(ground, 0.55, -0.2); ctx.lineWidth = Math.max(0.6, l * 0.005);
  const gt = a.head.gillTop, gb = a.head.gillBottom, flare = a.head.gillFlare;
  ctx.beginPath(); ctx.moveTo(...at(gt)); ctx.quadraticCurveTo(...at({ x: (gt.x + gb.x) / 2 + 0.035 + flare, y: (gt.y + gb.y) / 2 }), ...at(gb)); ctx.stroke();
  if (flare) { ctx.strokeStyle = 'rgba(255, 196, 196, 0.75)'; ctx.beginPath(); ctx.moveTo(...at({ x: gt.x + 0.01, y: gt.y + 0.02 })); ctx.quadraticCurveTo(...at({ x: (gt.x + gb.x) / 2 + 0.05 + flare, y: (gt.y + gb.y) / 2 }), ...at({ x: gb.x + 0.01, y: gb.y - 0.02 })); ctx.stroke(); }

  // ── Hood ──
  if (a.hood.length) {
    const crown = p.pattern.modes.includes('redcap') || p.head.crownTint > 0.65 ? RED : ground === WHITE || ground === MATTE_WHITE ? { ...c.body, l: Math.min(0.9, c.body.l + 0.2) } : ground;
    const hood = new Path2D();
    for (const bump of a.hood) { const [x, y] = at(bump); hood.moveTo(x + bump.r * l, y); hood.arc(x, y, bump.r * l, 0, Math.PI * 2); }
    ctx.fillStyle = css(crown, 0.97, 0.02); ctx.fill(hood);
    ctx.fillStyle = css(crown, 0.5, 0.18, 0.7);
    ctx.beginPath(); for (const bump of a.hood) { const [x, y] = at(bump); ctx.moveTo(x - bump.r * l * 0.2, y - bump.r * l * 0.3); ctx.arc(x - bump.r * l * 0.35, y - bump.r * l * 0.35, bump.r * l * 0.35, 0, Math.PI * 2); } ctx.fill();
    ctx.strokeStyle = css(crown, 0.35, -0.2); ctx.lineWidth = Math.max(0.4, l * 0.002); ctx.stroke(hood);
  }

  // ── Eye ──
  const eye = a.eye, [ex, ey] = at(eye.center), er = eye.radius * l;
  if (eye.kind === 'telescope' || eye.kind === 'skygazer') {
    // The protruding globe sits on a short cone; seen from the side it reads as a ringed, oversized eye.
    const [sx, sy] = at(eye.socket);
    ctx.fillStyle = css(ground, 1, -0.08); ctx.beginPath(); ctx.ellipse((sx + ex) / 2, (sy + ey) / 2, er * 1.12, er * 1.08, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = css(ground, 0.6, -0.25); ctx.lineWidth = Math.max(0.5, l * 0.004); ctx.stroke();
  }
  const iris = c.albino ? { h: 352, s: 0.7, l: 0.55 } : p.eyes.iris;
  ctx.fillStyle = css(iris, 1, 0.04); ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = css(iris, 0.8, -0.18); ctx.lineWidth = Math.max(0.5, er * 0.12); ctx.stroke();
  const pupilY = eye.kind === 'celestial' ? ey - er * 0.35 : eye.kind === 'skygazer' ? ey - er * 0.2 : ey;
  ctx.fillStyle = c.albino ? 'rgba(160, 20, 40, 0.95)' : '#0b0f12'; ctx.beginPath(); ctx.arc(ex - er * 0.08, pupilY, er * (0.58 + 0.1 * eye.protrusion), 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(ex - er * 0.35, pupilY - er * 0.35, Math.max(0.6, er * 0.18), 0, Math.PI * 2); ctx.fill();
  if (g.eyeCloud > 0) drawEyeCloud(ctx, g, ex, ey, er);

  // ── Bubble sacs ──
  if (a.bubble) {
    const [bx, by] = at(a.bubble.center), rx = a.bubble.rx * l, ry = a.bubble.ry * l;
    const sac = ctx.createRadialGradient(bx - rx * 0.3, by - ry * 0.35, rx * 0.1, bx, by, Math.max(rx, ry));
    sac.addColorStop(0, 'rgba(255, 255, 255, 0.55)'); sac.addColorStop(0.5, css(ground, 0.35, 0.18, 0.6)); sac.addColorStop(1, css(ground, 0.55, 0.05, 0.8));
    ctx.fillStyle = sac; ctx.beginPath(); ctx.ellipse(bx, by, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)'; ctx.lineWidth = Math.max(0.5, l * 0.003); ctx.stroke();
  }

  // ── Pompons ──
  if (a.pompons.length) {
    // Pompons are fleshy narial tufts, usually brighter than the body: red on pale fish, a lighter tint on red ones.
    const pale = texture.ground === WHITE || texture.ground === MATTE_WHITE;
    const rng = random(hash(`goldfish:pompon:${seed}`)), tuft = p.pattern.modes.includes('redcap') || pale ? RED : { ...c.body, l: Math.min(0.78, c.body.l + 0.12) };
    for (const pom of a.pompons) {
      const [px, py] = at(pom), r = pom.r * l;
      ctx.fillStyle = css(tuft, 0.9, -0.04); ctx.beginPath();
      for (let i = 0; i < 9; i++) { const ang = i / 9 * Math.PI * 2 + rng() * 0.4, d = r * (0.45 + 0.25 * rng()); ctx.moveTo(px + Math.cos(ang) * d + r * 0.45, py + Math.sin(ang) * d); ctx.arc(px + Math.cos(ang) * d, py + Math.sin(ang) * d, r * 0.45, 0, Math.PI * 2); }
      ctx.fill();
      ctx.strokeStyle = css(tuft, 0.5, -0.22); ctx.lineWidth = Math.max(0.4, l * 0.0025); ctx.stroke();
    }
  }

  // ── Near fins ──
  for (const fin of a.anal) if (!fin.far) drawFin(fin, Math.sin(finPhase + 1) * 0.006);
  drawFin(a.pelvic, Math.sin(finPhase + 0.5) * 0.008);
  drawFin(a.pectoral, Math.sin(finPhase) * 0.02 * (motion ? 0.4 + 0.6 * motion.effort : 0.6));
  // Mouth.
  ctx.strokeStyle = css(ground, 0.75, -0.3); ctx.lineWidth = Math.max(0.6, l * 0.004);
  const [mx, my] = at(a.head.mouth); ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + 0.025 * l * (0.6 + p.head.mouth), my + 0.006 * l); ctx.stroke();
  ctx.restore();
}
