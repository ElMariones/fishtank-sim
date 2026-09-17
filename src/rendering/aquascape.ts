import { itemOf, pieceRadius, type TankStyle } from '../core/aquascape';
import { hash, random } from '../core/random';
import type { Decoration } from '../core/tankManagement';
import { drawLotus, lanternWindow, PIECE_DRAWERS, pieceRng, type PieceContext } from './decor';

/**
 * Tank scene renderer (FS-117): backdrop, substrate, decoration pieces, caustics, light rays, colour grading, bubbles
 * and glass. Everything static (backdrop, substrate, solid pieces) is painted once into a cached layer and redrawn only
 * when the size, look or layout changes; plants, light and water move every frame.
 */
export type Scene = { decorations: readonly Decoration[]; style: TankStyle };

/** Waterline and substrate, as a share of tank height. Fish centres stay within 0.12–0.88 (behavior.ts). */
export const WATERLINE = 0.045;
export const SUBSTRATE_TOP = 0.9;
/** Solid pieces are drawn this much larger than their collision footprint. */
const SOLID_VISUAL = 1.45;
export const groundAt = (xNorm: number) => SUBSTRATE_TOP + Math.sin(xNorm * 5.3 + 0.7) * 0.007 + Math.sin(xNorm * 13.1) * 0.003;

export type PieceBox = { cx: number; base: number; w: number; h: number; left: number; top: number; right: number; bottom: number; mirrored: boolean; surface: boolean };
/** Pixel box of a piece as drawn: shared by the renderer and the drag editor, so a grab always lands on what is visible. */
export function pieceBox(piece: Decoration, width: number, height: number): PieceBox {
  const entry = itemOf(piece), drawer = PIECE_DRAWERS[entry.id], r = pieceRadius(piece), cx = piece.x * width;
  const mirrored = piece.rotation > 90 && piece.rotation < 270;
  if (entry.mount === 'surface') {
    const w = r * 2 * width * 0.8, h = drawer.height * r * height, base = WATERLINE * height + 3;
    return { cx, base, w, h, left: cx - w * 0.85, right: cx + w * 0.85, top: base - 6, bottom: base + h * 0.9, mirrored, surface: true };
  }
  const base = groundAt(piece.x) * height;
  if (entry.kind === 'cover') {
    const w = r * 2 * width * 0.8, h = drawer.height * r * height * (entry.id === 'plant-hairgrass' || entry.id === 'plant-moss' ? 1 : Math.min(1.25, width / height / 1.6));
    return { cx, base, w, h, left: cx - w * 0.6, right: cx + w * 0.6, top: base - h, bottom: base + 4, mirrored, surface: false };
  }
  // Solids fill their footprint from its top down to the substrate.
  // Drawn larger than the footprint: fish pass in front of a piece's outer parts, as they would in a real tank.
  const w = r * 2 * width * SOLID_VISUAL, h = Math.max(r * height, base - (piece.y - r) * height) * SOLID_VISUAL;
  return { cx, base, w, h, left: cx - w * 0.6, right: cx + w * 0.6, top: base - h, bottom: base + 4, mirrored, surface: false };
}

export function drawPiece(ctx: CanvasRenderingContext2D, piece: Decoration, box: PieceBox, time: number, layer: PieceContext['layer'], heightPx: number) {
  const entry = itemOf(piece), variant = piece.variant ?? 0;
  const draw = entry.id === 'plant-lotus' ? drawLotus(box.base - WATERLINE * heightPx - 4) : PIECE_DRAWERS[entry.id].draw;
  ctx.save(); ctx.translate(box.cx, box.base); if (box.mirrored) ctx.scale(-1, 1);
  draw({ ctx, w: box.w, h: box.h, rng: pieceRng(entry.id, variant), time, variant, layer });
  ctx.restore();
}

// ---- Looks ----------------------------------------------------------------------------------------------------------

type Grade = { multiply: string | null; rays: string; rayAlpha: number; caustics: number; glow: number; haze: string };
function gradeFor(lighting: TankStyle['lighting'], time: number): Grade {
  switch (lighting) {
    case 'tropical': return { multiply: null, rays: '255,248,215', rayAlpha: 0.16, caustics: 0.3, glow: 0.25, haze: 'rgba(255,245,200,.05)' };
    case 'sunset': return { multiply: '#ffe0bd', rays: '255,176,102', rayAlpha: 0.13, caustics: 0.14, glow: 0.7, haze: 'rgba(255,120,40,.11)' };
    case 'moonlight': return { multiply: '#5d74b8', rays: '160,190,255', rayAlpha: 0.07, caustics: 0.07, glow: 1.1, haze: 'rgba(40,60,140,.12)' };
    case 'grow': return { multiply: '#ffe3f6', rays: '255,205,240', rayAlpha: 0.11, caustics: 0.18, glow: 0.3, haze: 'rgba(255,160,230,.05)' };
    case 'aurora': {
      const hue = (time * 9) % 360;
      return { multiply: `hsl(${hue.toFixed(0)}, 70%, 80%)`, rays: hslRgb((hue + 40) % 360), rayAlpha: 0.13, caustics: 0.16, glow: 0.8, haze: `hsla(${hue.toFixed(0)}, 80%, 60%, .06)` };
    }
    default: return { multiply: null, rays: '225,245,255', rayAlpha: 0.1, caustics: 0.18, glow: 0.3, haze: 'rgba(200,240,255,.03)' };
  }
}
function hslRgb(hue: number) {
  const f = (n: number) => { const k = (n + hue / 30) % 12; return Math.round(255 * (0.75 - 0.25 * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
  return `${f(0)},${f(8)},${f(4)}`;
}

const BACKDROP_COLORS: Record<TankStyle['backdrop'], [string, string, string]> = {
  deep: ['#1f5a63', '#10363f', '#071a21'], clear: ['#5fb9c4', '#2b7d8c', '#123f4b'], black: ['#141b1f', '#0a0f12', '#040607'],
  forest: ['#3f6d57', '#1c3a2e', '#0b1a14'], mountains: ['#6d93a2', '#2f5566', '#122734'], blackwater: ['#8a6431', '#4a3212', '#1b1005'],
};

function paintBackdrop(ctx: CanvasRenderingContext2D, W: number, H: number, style: TankStyle) {
  const [top, mid, bottom] = BACKDROP_COLORS[style.backdrop], rng = random(hash(`backdrop:${style.backdrop}`));
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(0.55, mid); g.addColorStop(1, bottom);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.45, -H * 0.2, 0, W * 0.45, -H * 0.2, H * 1.1);
  glow.addColorStop(0, 'rgba(255,255,255,.14)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  const haze = (y: number, alpha: number) => { const fog = ctx.createLinearGradient(0, y - H * 0.25, 0, y + H * 0.05); fog.addColorStop(0, `${mid}00`); fog.addColorStop(1, hexAlpha(mid, alpha)); ctx.fillStyle = fog; ctx.fillRect(0, y - H * 0.25, W, H * 0.3); };
  if (style.backdrop === 'mountains') {
    [0.42, 0.55, 0.68].forEach((level, layer) => {
      ctx.fillStyle = hexAlpha(layer === 2 ? bottom : mid, 0.35 + layer * 0.2);
      ctx.beginPath(); ctx.moveTo(0, H);
      let y = H * level;
      for (let x = 0; x <= W + 40; x += W / 14) { y = H * level - rng() * H * (0.16 - layer * 0.03); ctx.lineTo(x, y); ctx.lineTo(x + W / 28, y + H * 0.04 * rng()); }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill(); haze(H * (level + 0.08), 0.5);
    });
  } else if (style.backdrop === 'forest') {
    // Submerged trunks fading into green haze: far layers are softer and paler.
    for (let layer = 0; layer < 3; layer++) {
      ctx.save(); ctx.filter = `blur(${(2 - layer) * 1.5}px)`;
      ctx.fillStyle = hexAlpha(layer === 2 ? bottom : mid, 0.28 + layer * 0.2);
      for (let t = 0; t < 6 - layer; t++) {
        const x = rng() * W, width = W * (0.008 + layer * 0.01) * (0.6 + rng()), lean = (rng() - 0.5) * W * 0.06;
        ctx.beginPath(); ctx.moveTo(x - width, H); ctx.quadraticCurveTo(x + lean - width * 0.6, H * 0.5, x + lean * 2 - width * 0.35, -10);
        ctx.lineTo(x + lean * 2 + width * 0.35, -10); ctx.quadraticCurveTo(x + lean + width * 0.6, H * 0.5, x + width, H); ctx.fill();
      }
      ctx.restore();
      haze(H * (0.62 + layer * 0.12), 0.55);
    }
  } else if (style.backdrop === 'blackwater') {
    ctx.strokeStyle = 'rgba(25,14,4,.55)'; ctx.lineCap = 'round';
    for (let b = 0; b < 5; b++) {
      const x = rng() * W; ctx.lineWidth = 4 + rng() * 6;
      ctx.beginPath(); ctx.moveTo(x, -5); ctx.bezierCurveTo(x + (rng() - 0.5) * 80, H * 0.2, x + (rng() - 0.5) * 120, H * 0.35, x + (rng() - 0.5) * 160, H * (0.3 + rng() * 0.2)); ctx.stroke();
    }
    for (let l = 0; l < 26; l++) {
      ctx.fillStyle = `rgba(${40 + rng() * 40},${22 + rng() * 20},6,${0.25 + rng() * 0.3})`;
      ctx.beginPath(); ctx.ellipse(rng() * W, rng() * H * 0.85, 3 + rng() * 5, 1.5 + rng() * 2, rng() * Math.PI, 0, Math.PI * 2); ctx.fill();
    }
  } else if (style.backdrop === 'deep' || style.backdrop === 'clear') {
    ctx.strokeStyle = hexAlpha(bottom, style.backdrop === 'clear' ? 0.18 : 0.35); ctx.lineCap = 'round';
    for (let s = 0; s < 40; s++) {
      const x = rng() * W, length = H * (0.15 + rng() * 0.3); ctx.lineWidth = 2 + rng() * 4;
      ctx.beginPath(); ctx.moveTo(x, H * 0.92); ctx.quadraticCurveTo(x + (rng() - 0.5) * 30, H * 0.92 - length * 0.5, x + (rng() - 0.5) * 40, H * 0.92 - length); ctx.stroke();
    }
    haze(H * 0.95, 0.6);
  }
  // Far substrate bank, lost in the haze.
  ctx.fillStyle = hexAlpha(bottom, 0.65); ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += W / 20) ctx.lineTo(x, H * (0.84 + Math.sin(x / W * 7 + 1) * 0.015 + Math.sin(x / W * 17) * 0.006));
  ctx.lineTo(W, H); ctx.fill();
}
function hexAlpha(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

type Grain = { colors: string[]; size: [number, number]; count: number; round: boolean; base: [string, string] };
const GRAINS: Record<TankStyle['substrate'], Grain> = {
  sand: { colors: ['#e8d6ad', '#c4ab7e', '#a88e62', '#f4e8c8'], size: [0.6, 1.4], count: 5, base: ['#d3bd8f', '#6d5a3c'], round: true },
  gravel: { colors: ['#b3a591', '#6e675f', '#d8c7a9', '#8a7a68', '#4d4a47', '#c9b28a'], size: [1.8, 3.6], count: 1.1, base: ['#8d8173', '#3b3632'], round: false },
  pebbles: { colors: ['#9b968b', '#c0b49c', '#6c706b', '#857b6b', '#b8b2a6'], size: [3.5, 7], count: 0.28, base: ['#7b776d', '#34322d'], round: true },
  black: { colors: ['#2e3236', '#1a1c1f', '#3d4247', '#555b61'], size: [0.7, 1.6], count: 4, base: ['#2c3034', '#0b0c0d'], round: true },
  soil: { colors: ['#4b3527', '#2d1f16', '#5f4634', '#3a2a1f'], size: [1.2, 2.4], count: 2, base: ['#3e2d22', '#150e09'], round: true },
  coral: { colors: ['#f7efe6', '#ead7cb', '#f2c9c1', '#ffffff', '#dccbb8'], size: [1, 2.6], count: 2.2, base: ['#ecdfd1', '#8f7d6d'], round: false },
};

function substratePath(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 6) ctx.lineTo(x, groundAt(x / W) * H);
  ctx.lineTo(W, groundAt(1) * H); ctx.lineTo(W, H); ctx.closePath();
}

function paintSubstrate(ctx: CanvasRenderingContext2D, W: number, H: number, style: TankStyle) {
  const grain = GRAINS[style.substrate], rng = random(hash(`substrate:${style.substrate}`));
  const top = SUBSTRATE_TOP * H;
  substratePath(ctx, W, H);
  const g = ctx.createLinearGradient(0, top - 4, 0, H); g.addColorStop(0, grain.base[0]); g.addColorStop(1, grain.base[1]);
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); substratePath(ctx, W, H); ctx.clip();
  const count = Math.round(W * (H - top) / 10 * grain.count);
  for (let i = 0; i < count; i++) {
    const x = rng() * W, depth = Math.pow(rng(), 1.4), y = top - 3 + depth * (H - top + 3), size = grain.size[0] + rng() * (grain.size[1] - grain.size[0]);
    const shade = 1 - depth * 0.55;
    ctx.globalAlpha = shade; ctx.fillStyle = grain.colors[Math.floor(rng() * grain.colors.length)];
    ctx.beginPath();
    if (grain.round) ctx.ellipse(x, y, size, size * (0.65 + rng() * 0.3), rng() * Math.PI, 0, Math.PI * 2);
    else { const a = rng() * Math.PI; ctx.moveTo(x + Math.cos(a) * size, y + Math.sin(a) * size * 0.7); ctx.lineTo(x + Math.cos(a + 2.1) * size, y + Math.sin(a + 2.1) * size * 0.7); ctx.lineTo(x + Math.cos(a + 4.2) * size * 0.8, y + Math.sin(a + 4.2) * size * 0.6); }
    ctx.fill();
    if (size > 2.5 && depth < 0.6) { ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.ellipse(x - size * 0.3, y - size * 0.35, size * 0.35, size * 0.18, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  if (style.substrate === 'sand' || style.substrate === 'coral') {
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1;
    for (let r = 0; r < 14; r++) { const y = top + 6 + rng() * (H - top) * 0.7, x = rng() * W; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 30, y - 3, x + 60 + rng() * 40, y); ctx.stroke(); }
  }
  if (style.substrate === 'black') {
    for (let s = 0; s < W / 3; s++) { ctx.fillStyle = `rgba(255,255,255,${0.2 + rng() * 0.5})`; ctx.fillRect(rng() * W, top + rng() * (H - top), 0.8, 0.8); }
  }
  // The substrate falls into shadow toward the front glass.
  const front = ctx.createLinearGradient(0, top, 0, H); front.addColorStop(0, 'rgba(0,0,0,0)'); front.addColorStop(0.55, 'rgba(0,0,0,.1)'); front.addColorStop(1, 'rgba(0,0,0,.5)');
  ctx.fillStyle = front; ctx.fillRect(0, top - 10, W, H - top + 10);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let x = 0; x <= W; x += 6) (x ? ctx.lineTo(x, groundAt(x / W) * H) : ctx.moveTo(x, groundAt(0) * H));
  ctx.stroke();
}

let causticTile: HTMLCanvasElement | null = null;
/** A tileable web of bright caustic lines from two interfering wave fields. */
function caustics() {
  if (causticTile) return causticTile;
  const size = 256, canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!, image = ctx.createImageData(size, size), f = Math.PI * 2 / size;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const a = Math.sin(3 * f * x + 1.7 * Math.sin(2 * f * y)) + Math.sin(4 * f * y + 1.5 * Math.sin(3 * f * x));
    const b = Math.sin(5 * f * (x + y) + 1.2 * Math.sin(f * (x - y) * 2));
    const v = Math.max(0, 1 - Math.abs(a) * 2.2) ** 2 * 0.8 + Math.max(0, 1 - Math.abs(b) * 3) ** 3 * 0.5;
    const i = (y * size + x) * 4; image.data[i] = image.data[i + 1] = image.data[i + 2] = 255; image.data[i + 3] = Math.min(255, v * 255);
  }
  ctx.putImageData(image, 0, 0);
  causticTile = canvas;
  return canvas;
}

// ---- Renderer -------------------------------------------------------------------------------------------------------

const isStatic = (piece: Decoration) => !PIECE_DRAWERS[itemOf(piece).id].animated;
const depthOrder = (a: Decoration, b: Decoration) => (a.kind === b.kind ? 0 : a.kind === 'rock' ? -1 : 1) || pieceRadius(b) - pieceRadius(a) || a.x - b.x;

export class AquascapeRenderer {
  private layer: { canvas: HTMLCanvasElement; W: number; H: number; dpr: number; scene: Scene } | null = null;
  private glass: { canvas: HTMLCanvasElement; key: string } | null = null;
  private patterns: CanvasPattern[] = [];
  private patternContext: CanvasRenderingContext2D | null = null;

  /** Backdrop, substrate, solid pieces and caustics: everything behind the fish except moving plants. */
  paintBack(ctx: CanvasRenderingContext2D, W: number, H: number, scene: Scene, time: number) {
    const dpr = ctx.getTransform().a || 1;
    const cached = this.layer;
    if (!cached || cached.W !== W || cached.H !== H || cached.dpr !== dpr || cached.scene.decorations !== scene.decorations || cached.scene.style !== scene.style) {
      const canvas = cached?.canvas ?? document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(W * dpr)); canvas.height = Math.max(1, Math.round(H * dpr));
      const layer = canvas.getContext('2d')!; layer.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintBackdrop(layer, W, H, scene.style);
      paintSubstrate(layer, W, H, scene.style);
      for (const piece of [...scene.decorations].sort(depthOrder)) if (isStatic(piece)) drawPiece(layer, piece, pieceBox(piece, W, H), 0, 'all', H);
      this.layer = { canvas, W, H, dpr, scene };
    }
    ctx.drawImage(this.layer!.canvas, 0, 0, W, H);
    const grade = gradeFor(scene.style.lighting, time);
    if (this.patternContext !== ctx) { this.patterns = [ctx.createPattern(caustics(), 'repeat')!, ctx.createPattern(caustics(), 'repeat')!]; this.patternContext = ctx; }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const [index, [scale, speed, alpha]] of ([[1.6, 7, 1], [2.3, -5, 0.7]] as const).entries()) {
      const pattern = this.patterns[index];
      pattern.setTransform(new DOMMatrix().translateSelf(time * speed, time * speed * 0.4).scaleSelf(scale, scale * 0.6));
      ctx.fillStyle = pattern;
      ctx.globalAlpha = grade.caustics * alpha * 0.14; ctx.fillRect(0, 0, W, H);
      ctx.save(); substratePath(ctx, W, H); ctx.clip(); ctx.globalAlpha = grade.caustics * alpha; ctx.fillRect(0, SUBSTRATE_TOP * H - 8, W, H); ctx.restore();
    }
    ctx.restore();
  }

  /** Moving plants: `back` before fish, `front` leaves after them, so fish can hide among the stems. */
  paintPlants(ctx: CanvasRenderingContext2D, W: number, H: number, scene: Scene, time: number, layer: 'back' | 'front') {
    for (const piece of scene.decorations) if (!isStatic(piece)) drawPiece(ctx, piece, pieceBox(piece, W, H), time, layer, H);
  }

  /** Bubbles, light rays, grading, glowing lanterns, the waterline and glass, over the fish. */
  paintFront(ctx: CanvasRenderingContext2D, W: number, H: number, scene: Scene, time: number) {
    const grade = gradeFor(scene.style.lighting, time);
    for (const piece of scene.decorations) {
      const id = piece.item;
      if (id !== 'orn-bubbler' && id !== 'orn-chest') continue;
      const box = pieceBox(piece, W, H), column = id === 'orn-bubbler' ? 16 : 5, source = box.base - box.h * (id === 'orn-bubbler' ? 0.6 : 0.8);
      for (let i = 0; i < column; i++) {
        const cycle = id === 'orn-bubbler' ? 3.2 : 7, seed = hash(`${piece.id}:${i}`) % 1000 / 1000, phase = ((time / cycle + seed) % 1);
        if (id === 'orn-chest' && phase > 0.45) continue;
        const progress = id === 'orn-chest' ? phase / 0.45 : phase, y = source - progress * (source - WATERLINE * H);
        const x = box.cx + Math.sin(time * 3 + i * 1.7) * (2 + progress * 6) + (seed - 0.5) * box.w * 0.3, r = 1 + seed * 2.2 + progress * 1.5;
        ctx.strokeStyle = `rgba(220,250,255,${0.55 - progress * 0.3})`; ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.3, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      const x = W * (i / 6) + Math.sin(time * 0.12 + i * 1.9) * W * 0.04, spread = W * (0.05 + (hash(`ray:${i}`) % 100) / 1400);
      const alpha = grade.rayAlpha * (0.5 + 0.5 * Math.sin(time * 0.35 + i * 2.3) ** 2);
      const g = ctx.createLinearGradient(0, 0, 0, H * 0.95); g.addColorStop(0, `rgba(${grade.rays},${alpha})`); g.addColorStop(1, `rgba(${grade.rays},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - spread * 0.3, 0); ctx.lineTo(x + spread * 0.3, 0); ctx.lineTo(x + spread * 1.4 - W * 0.12, H); ctx.lineTo(x - spread * 1.4 - W * 0.12, H); ctx.fill();
    }
    ctx.restore();
    if (grade.multiply) { ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = grade.multiply; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    ctx.fillStyle = grade.haze; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const piece of scene.decorations) {
      if (piece.item !== 'orn-lantern') continue;
      const box = pieceBox(piece, W, H), win = lanternWindow(box.w, box.h), x = box.cx, y = box.base + win.y, flicker = 0.9 + Math.sin(time * 7 + piece.x * 40) * 0.05 + Math.sin(time * 13) * 0.03;
      const radius = box.w * 1.6, g = ctx.createRadialGradient(x, y, 0, x, y, radius);
      g.addColorStop(0, `rgba(255,190,90,${0.55 * grade.glow * flicker})`); g.addColorStop(0.25, `rgba(255,150,60,${0.22 * grade.glow * flicker})`); g.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = g; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      ctx.fillStyle = `rgba(255,220,150,${0.8 * Math.min(1, grade.glow)})`; ctx.fillRect(x - win.rx, y - win.ry, win.rx * 2, win.ry * 2);
    }
    ctx.restore();
    // Waterline: the underside of the surface reflects the tank and ripples.
    const surface = WATERLINE * H, under = ctx.createLinearGradient(0, 0, 0, surface + 14);
    under.addColorStop(0, 'rgba(210,245,255,.16)'); under.addColorStop(0.7, 'rgba(210,245,255,.05)'); under.addColorStop(1, 'rgba(210,245,255,0)');
    ctx.fillStyle = under; ctx.fillRect(0, 0, W, surface + 14);
    ctx.strokeStyle = 'rgba(230,252,255,.45)'; ctx.lineWidth = 1.4; ctx.beginPath();
    for (let x = 0; x <= W; x += 8) { const y = surface + Math.sin(x * 0.03 + time * 1.4) * 1.6 + Math.sin(x * 0.011 - time * 0.8) * 1.4; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
    // Glass: a soft diagonal sheen and vignette, painted once per size and lighting.
    const dpr = ctx.getTransform().a || 1, key = `${W}x${H}@${dpr}:${scene.style.lighting === 'moonlight'}`;
    if (this.glass?.key !== key) {
      const canvas = this.glass?.canvas ?? document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(W * dpr)); canvas.height = Math.max(1, Math.round(H * dpr));
      const glass = canvas.getContext('2d')!; glass.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sheen = glass.createLinearGradient(0, 0, W * 0.5, H);
      sheen.addColorStop(0, 'rgba(255,255,255,.06)'); sheen.addColorStop(0.35, 'rgba(255,255,255,0)'); sheen.addColorStop(0.62, 'rgba(255,255,255,0)'); sheen.addColorStop(0.66, 'rgba(255,255,255,.035)'); sheen.addColorStop(0.72, 'rgba(255,255,255,0)');
      glass.fillStyle = sheen; glass.fillRect(0, 0, W, H);
      const vignette = glass.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.max(W, H) * 0.75);
      vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, scene.style.lighting === 'moonlight' ? 'rgba(0,4,16,.6)' : 'rgba(0,6,10,.42)');
      glass.fillStyle = vignette; glass.fillRect(0, 0, W, H);
      this.glass = { canvas, key };
    }
    ctx.drawImage(this.glass.canvas, 0, 0, W, H);
  }
}

/** A catalog thumbnail: one piece (or a look) framed on a small backdrop. */
export function paintThumbnail(canvas: HTMLCanvasElement, piece: Decoration, time = 0) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2), W = canvas.clientWidth || 96, H = canvas.clientHeight || 72;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const ctx = canvas.getContext('2d')!; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const entry = itemOf(piece), surface = entry.mount === 'surface';
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#1d4f58'); bg.addColorStop(1, '#0a232b');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const ground = H * 0.86;
  if (!surface) { ctx.fillStyle = '#6d5a3c'; ctx.fillRect(0, ground, W, H - ground); ctx.fillStyle = 'rgba(211,189,143,.55)'; ctx.fillRect(0, ground, W, 2); }
  const drawer = PIECE_DRAWERS[entry.id];
  // Fit the piece: solids use a notional height; plants use their own proportions.
  let w = W * 0.52, h = entry.kind === 'rock' ? w * 0.85 : Math.min(H * 0.78, w * drawer.height / 2.4);
  if (entry.id === 'plant-hairgrass') h = H * 0.3;
  if (entry.id === 'plant-moss') { w = W * 0.5; h = H * 0.3; }
  if (entry.id === 'orn-bubbler') { w = W * 0.3; h = H * 0.12; }
  if (entry.id === 'wood-spider' || entry.id === 'wood-roots') { w = W * 0.42; h = H * 0.62; }
  const variant = piece.variant ?? 0;
  const draw = entry.id === 'plant-lotus' ? drawLotus(ground - 6) : drawer.draw;
  ctx.save(); ctx.translate(W / 2, surface ? H * 0.14 : ground); if (piece.rotation > 90 && piece.rotation < 270) ctx.scale(-1, 1);
  draw({ ctx, w, h, rng: pieceRng(entry.id, variant), time, variant, layer: 'all' });
  ctx.restore();
  if (entry.id === 'orn-bubbler') {
    ctx.strokeStyle = 'rgba(220,250,255,.6)'; ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) { const y = ground - h * 0.3 - i * H * 0.075, r = 1.5 + i * 0.3; ctx.beginPath(); ctx.arc(W / 2 + Math.sin(i * 1.7) * 4, y, r, 0, Math.PI * 2); ctx.stroke(); }
  }
}
