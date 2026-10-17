import { itemOf, pieceRadius, type TankStyle } from '../core/aquascape';
import { hash, random } from '../core/random';
import type { Decoration } from '../core/tankManagement';
import { crystalCore, drawLotus, lanternWindow, PIECE_DRAWERS, pieceRng, type PieceContext } from './decor';

/**
 * Tank scene renderer (FS-117): backdrop, substrate, decoration pieces, caustics, light rays, colour grading, bubbles
 * and glass. Everything static (backdrop, substrate, solid pieces) is painted once into a cached layer and redrawn only
 * when the size, look or layout changes; plants, light and water move every frame.
 */
export type Scene = {
  decorations: readonly Decoration[]; style: TankStyle;
  /** A piece being dragged: drawn live each frame and kept out of the cached layer, so a drag never repaints it. */
  live?: string | null;
};
/** Plants sway slowly; their layers are redrawn at this rate and reused between frames. */
const PLANT_FPS = 30;

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

type Grade = {
  multiply: string | null; rays: string; rayAlpha: number; caustics: number; glow: number; haze: string;
  /** Gallery lighting: focused spot cones from above, in this colour. */
  spots?: string;
  /** Storm lighting: brightness of a lightning flash this frame, 0–1. */
  flash?: number;
};
/** Lightings dim enough that the glass vignette deepens. */
const DARK_LIGHTINGS: readonly TankStyle['lighting'][] = ['moonlight', 'deepsea', 'gallery', 'storm'];
/** A lightning flash: each 9 s window may hold one double flicker, chosen from the window's index. */
function lightning(time: number) {
  const window = Math.floor(time / 9), at = (hash(`storm:${window}`) % 1000) / 1000;
  if (at > 0.45) return 0;
  const t = time - window * 9 - at * 9;
  if (t < 0 || t > 0.6) return 0;
  return Math.max(0, 1 - t / 0.12) + (t > 0.22 ? Math.max(0, 0.7 - (t - 0.22) / 0.2) : 0);
}
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
    case 'gallery': return { multiply: '#a7a4ac', rays: '255,248,230', rayAlpha: 0.05, caustics: 0.1, glow: 0.9, haze: 'rgba(0,0,0,.08)', spots: '255,246,222' };
    case 'deepsea': {
      const pulse = 0.5 + Math.sin(time * 0.4) * 0.5;
      return { multiply: '#3a5cc4', rays: '90,150,255', rayAlpha: 0.05 + pulse * 0.03, caustics: 0.1, glow: 1.2, haze: 'rgba(10,30,110,.16)' };
    }
    case 'neon': {
      const swing = Math.sin(time * 0.6) * 0.5 + 0.5;
      return { multiply: swing > 0.5 ? '#f3b6ff' : '#b0f4ff', rays: swing > 0.5 ? '255,90,240' : '60,240,255', rayAlpha: 0.15, caustics: 0.22, glow: 0.9, haze: `rgba(${Math.round(lerp(40, 255, swing))},${Math.round(lerp(230, 40, swing))},${Math.round(lerp(255, 230, swing))},.07)` };
    }
    case 'ember': {
      const flicker = 0.85 + Math.sin(time * 6.3) * 0.06 + Math.sin(time * 11.7 + 1) * 0.05 + Math.sin(time * 2.1) * 0.04;
      return { multiply: '#ffc995', rays: '255,140,60', rayAlpha: 0.08 * flicker, caustics: 0.08, glow: 1 * flicker, haze: `rgba(255,90,20,${(0.12 * flicker).toFixed(3)})` };
    }
    case 'storm': {
      const flash = lightning(time);
      return { multiply: '#8e98ab', rays: '200,215,240', rayAlpha: 0.04 + flash * 0.3, caustics: 0.08 + flash * 0.4, glow: 0.8, haze: 'rgba(30,40,60,.14)', flash };
    }
    case 'dawn': return { multiply: '#ffe6ee', rays: '255,214,226', rayAlpha: 0.14, caustics: 0.2, glow: 0.45, haze: 'rgba(255,180,210,.07)' };
    default: return { multiply: null, rays: '225,245,255', rayAlpha: 0.1, caustics: 0.18, glow: 0.3, haze: 'rgba(200,240,255,.03)' };
  }
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ---- Effects --------------------------------------------------------------------------------------------------------

/** A particle's resting place and drift, from its index alone, so every frame shows the same particles moving on. */
const seeded = (effect: string, i: number, salt: number) => (hash(`${effect}:${i}:${salt}`) % 10000) / 10000;
/** Effects layered over the fish and under the grade, so the tank's light colours them like everything else. */
function paintEffect(ctx: CanvasRenderingContext2D, W: number, H: number, effect: TankStyle['effect'], time: number) {
  if (!effect) return;
  const top = WATERLINE * H, floor = SUBSTRATE_TOP * H;
  if (effect === 'motes') {
    for (let i = 0; i < 70; i++) {
      const x = ((seeded(effect, i, 1) + time * (0.004 + seeded(effect, i, 2) * 0.01)) % 1) * W, y = top + ((seeded(effect, i, 3) + Math.sin(time * 0.3 + i) * 0.02) % 1) * (floor - top);
      ctx.fillStyle = `rgba(235,245,235,${(0.12 + seeded(effect, i, 4) * 0.25).toFixed(3)})`; ctx.fillRect(x, y, 1 + seeded(effect, i, 5) * 1.4, 1 + seeded(effect, i, 5) * 1.4);
    }
  } else if (effect === 'plankton') {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 46; i++) {
      const x = ((seeded(effect, i, 1) + time * 0.006 * (seeded(effect, i, 2) - 0.5)) % 1 + 1) % 1 * W, y = top + seeded(effect, i, 3) * (floor - top) + Math.sin(time * 0.5 + i * 1.3) * 8;
      const pulse = Math.max(0, Math.sin(time * (0.8 + seeded(effect, i, 4)) + i * 2.1)), r = 1.5 + seeded(effect, i, 5) * 2.5;
      if (pulse < 0.05) continue;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4); g.addColorStop(0, `rgba(140,255,240,${(0.7 * pulse).toFixed(3)})`); g.addColorStop(1, 'rgba(40,120,255,0)');
      ctx.fillStyle = g; ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
    }
    ctx.restore();
  } else if (effect === 'curtain') {
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 90; i++) {
      const lane = seeded(effect, i, 1), speed = 0.18 + seeded(effect, i, 2) * 0.12, phase = (time * speed + seeded(effect, i, 3)) % 1;
      const x = (0.06 + lane * 0.88) * W + Math.sin(time * 2 + i) * (1 + phase * 3), y = floor - phase * (floor - top), r = 0.8 + seeded(effect, i, 4) * 1.8 + phase;
      ctx.strokeStyle = `rgba(225,250,255,${(0.32 * (1 - phase * 0.6)).toFixed(3)})`; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    }
  } else if (effect === 'mist') {
    for (let band = 0; band < 3; band++) {
      const y = top + H * (0.02 + band * 0.045), drift = (time * (6 + band * 3)) % (W * 0.6);
      for (let k = -1; k < 4; k++) {
        const cx = k * W * 0.6 + drift - W * 0.1, g = ctx.createRadialGradient(cx, y, 0, cx, y, W * 0.35);
        g.addColorStop(0, `rgba(235,248,250,${0.13 - band * 0.03})`); g.addColorStop(1, 'rgba(235,248,250,0)');
        ctx.fillStyle = g; ctx.save(); ctx.translate(cx, y); ctx.scale(1, 0.18); ctx.translate(-cx, -y); ctx.fillRect(cx - W * 0.35, y - W * 0.35, W * 0.7, W * 0.7); ctx.restore();
      }
    }
  } else if (effect === 'petals') {
    for (let i = 0; i < 26; i++) {
      const speed = 0.025 + seeded(effect, i, 2) * 0.03, phase = (time * speed + seeded(effect, i, 3)) % 1;
      const x = ((seeded(effect, i, 1) + Math.sin(time * 0.4 + i) * 0.03 + phase * 0.08) % 1) * W, y = top + phase * (floor - top);
      const spin = time * (0.6 + seeded(effect, i, 4)) + i, size = 3 + seeded(effect, i, 5) * 3;
      ctx.save(); ctx.translate(x, y); ctx.rotate(spin); ctx.scale(1, 0.45 + Math.abs(Math.sin(spin * 1.3)) * 0.55);
      ctx.fillStyle = `rgba(255,${190 + Math.round(seeded(effect, i, 6) * 40)},${215 + Math.round(seeded(effect, i, 7) * 25)},0.85)`;
      ctx.beginPath(); ctx.moveTo(0, -size); ctx.bezierCurveTo(size, -size * 0.6, size * 0.7, size * 0.6, 0, size * 0.8); ctx.bezierCurveTo(-size * 0.7, size * 0.6, -size, -size * 0.6, 0, -size); ctx.fill();
      ctx.restore();
    }
  } else if (effect === 'sparkle') {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 40; i++) {
      const life = (time * (0.5 + seeded(effect, i, 2) * 0.6) + seeded(effect, i, 3)) % 1, glint = Math.sin(life * Math.PI) ** 3;
      if (glint < 0.05) continue;
      const cycle = Math.floor(time * (0.5 + seeded(effect, i, 2) * 0.6) + seeded(effect, i, 3));
      const x = seeded(effect, i, cycle) * W, y = top + seeded(effect, i, cycle + 7) * (floor - top) * 0.6, r = 2 + glint * 4;
      ctx.strokeStyle = `rgba(255,250,215,${(0.8 * glint).toFixed(3)})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
      ctx.fillStyle = `rgba(255,255,240,${(0.9 * glint).toFixed(3)})`; ctx.beginPath(); ctx.arc(x, y, 1.1, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  } else if (effect === 'current') {
    ctx.lineCap = 'round';
    for (let i = 0; i < 22; i++) {
      const y = top + (0.08 + seeded(effect, i, 1) * 0.84) * (floor - top), speed = 0.05 + seeded(effect, i, 2) * 0.06, length = W * (0.08 + seeded(effect, i, 3) * 0.14);
      const head = ((time * speed + seeded(effect, i, 4)) % 1.3 - 0.15) * W, g = ctx.createLinearGradient(head - length, 0, head, 0);
      g.addColorStop(0, 'rgba(210,245,250,0)'); g.addColorStop(1, `rgba(210,245,250,${(0.1 + seeded(effect, i, 5) * 0.12).toFixed(3)})`);
      ctx.strokeStyle = g; ctx.lineWidth = 1 + seeded(effect, i, 6) * 1.5; ctx.beginPath(); ctx.moveTo(head - length, y);
      ctx.quadraticCurveTo(head - length / 2, y + Math.sin(time + i) * 6, head, y); ctx.stroke();
    }
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

/** Grain tiles: CSS size of one tile and the resolution it is rendered at. */
const TILE_W = 480, TILE_H = 48, TILE_SCALE = 2;
const grainTiles = new Map<TankStyle['substrate'], HTMLCanvasElement>();
/**
 * One seamless strip of substrate grains per substrate type, drawn once per session. Painting a tank then tiles it
 * instead of placing thousands of grains, so a new tank's layer costs a few milliseconds.
 */
function grainTile(substrate: TankStyle['substrate']) {
  const cached = grainTiles.get(substrate);
  if (cached) return cached;
  const grain = GRAINS[substrate], rng = random(hash(`substrate:${substrate}`));
  const canvas = document.createElement('canvas'); canvas.width = TILE_W * TILE_SCALE; canvas.height = TILE_H * TILE_SCALE;
  const ctx = canvas.getContext('2d')!; ctx.scale(TILE_SCALE, TILE_SCALE);
  const count = Math.round(TILE_W * TILE_H / 10 * grain.count);
  for (let i = 0; i < count; i++) {
    const x = rng() * TILE_W, depth = Math.pow(rng(), 1.4), y = -3 + depth * (TILE_H + 3), size = grain.size[0] + rng() * (grain.size[1] - grain.size[0]);
    const color = grain.colors[Math.floor(rng() * grain.colors.length)], tilt = rng() * Math.PI, squash = 0.65 + rng() * 0.3;
    // Grains crossing the tile edge are drawn on both sides, so the strip repeats without a seam.
    for (const offset of x < size * 2 ? [0, TILE_W] : x > TILE_W - size * 2 ? [0, -TILE_W] : [0]) {
      const gx = x + offset;
      ctx.globalAlpha = 1 - depth * 0.55; ctx.fillStyle = color;
      ctx.beginPath();
      if (grain.round) ctx.ellipse(gx, y, size, size * squash, tilt, 0, Math.PI * 2);
      else { ctx.moveTo(gx + Math.cos(tilt) * size, y + Math.sin(tilt) * size * 0.7); ctx.lineTo(gx + Math.cos(tilt + 2.1) * size, y + Math.sin(tilt + 2.1) * size * 0.7); ctx.lineTo(gx + Math.cos(tilt + 4.2) * size * 0.8, y + Math.sin(tilt + 4.2) * size * 0.6); }
      ctx.fill();
      if (size > 2.5 && depth < 0.6) { ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.ellipse(gx - size * 0.3, y - size * 0.35, size * 0.35, size * 0.18, 0, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  grainTiles.set(substrate, canvas);
  return canvas;
}

function paintSubstrate(ctx: CanvasRenderingContext2D, W: number, H: number, style: TankStyle) {
  const grain = GRAINS[style.substrate], rng = random(hash(`substrate-detail:${style.substrate}`));
  const top = SUBSTRATE_TOP * H, band = H - top + 3;
  substratePath(ctx, W, H);
  const g = ctx.createLinearGradient(0, top - 4, 0, H); g.addColorStop(0, grain.base[0]); g.addColorStop(1, grain.base[1]);
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); substratePath(ctx, W, H); ctx.clip();
  const pattern = ctx.createPattern(grainTile(style.substrate), 'repeat-x');
  if (pattern) {
    const scale = band / TILE_H;
    pattern.setTransform(new DOMMatrix().translateSelf(0, top - 3).scaleSelf(scale / TILE_SCALE, scale / TILE_SCALE));
    ctx.fillStyle = pattern; ctx.fillRect(0, top - 6, W, band + 6);
  }
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

/**
 * Painted backdrop/substrate and solid layers shared by every renderer, keyed by what they show. Switching back to a
 * tank, or to one warmed in advance, reuses its layers. Least recently used layers are dropped past a pixel budget.
 */
const LAYER_PIXEL_BUDGET = 14_000_000;
const layerCache = new Map<string, HTMLCanvasElement>();
function cachedLayer(key: string, W: number, H: number, dpr: number, paint: (ctx: CanvasRenderingContext2D) => void) {
  const hit = layerCache.get(key);
  if (hit) { layerCache.delete(key); layerCache.set(key, hit); return hit; }
  const canvas = paintLayer(undefined, W, H, dpr, paint);
  layerCache.set(key, canvas);
  let pixels = 0;
  for (const layer of layerCache.values()) pixels += layer.width * layer.height;
  for (const [oldest, layer] of layerCache) {
    if (pixels <= LAYER_PIXEL_BUDGET || oldest === key) break;
    pixels -= layer.width * layer.height; layerCache.delete(oldest);
  }
  return canvas;
}
const baseKey = (scene: Scene, size: string) => `base:${size}:${scene.style.substrate}:${scene.style.backdrop}`;
const staticSolids = (scene: Scene) => scene.decorations.filter(piece => isStatic(piece) && piece.id !== scene.live).sort(depthOrder);

/** Paint into a reusable offscreen canvas at the target's pixel density. */
function paintLayer(existing: HTMLCanvasElement | undefined, W: number, H: number, dpr: number, paint: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = existing ?? document.createElement('canvas'), width = Math.max(1, Math.round(W * dpr)), height = Math.max(1, Math.round(H * dpr));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, width, height); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  paint(ctx);
  return canvas;
}

const isStatic = (piece: Decoration) => !PIECE_DRAWERS[itemOf(piece).id].animated;
const depthOrder = (a: Decoration, b: Decoration) => (a.kind === b.kind ? 0 : a.kind === 'rock' ? -1 : 1) || pieceRadius(b) - pieceRadius(a) || a.x - b.x;

export class AquascapeRenderer {
  private plantLayers: Record<'back' | 'front', { canvas: HTMLCanvasElement; key: string; decorations: readonly Decoration[] } | null> = { back: null, front: null };
  private glass: { canvas: HTMLCanvasElement; key: string } | null = null;
  private patterns: CanvasPattern[] = [];
  private patternContext: CanvasRenderingContext2D | null = null;

  /** Backdrop, substrate, solid pieces and caustics: everything behind the fish except moving plants. */
  paintBack(ctx: CanvasRenderingContext2D, W: number, H: number, scene: Scene, time: number) {
    const dpr = ctx.getTransform().a || 1;
    for (const layer of this.staticLayers(scene, W, H, dpr)) ctx.drawImage(layer, 0, 0, W, H);
    const live = scene.live ? scene.decorations.find(piece => piece.id === scene.live && isStatic(piece)) : undefined;
    if (live) drawPiece(ctx, live, pieceBox(live, W, H), 0, 'all', H);
    const grade = gradeFor(scene.style.lighting, time);
    if (this.patternContext !== ctx) { this.patterns = [ctx.createPattern(caustics(), 'repeat')!, ctx.createPattern(caustics(), 'repeat')!]; this.patternContext = ctx; }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const floor = (SUBSTRATE_TOP - 0.012) * H;
    for (const [index, [scale, speed, alpha]] of ([[1.6, 7, 1], [2.3, -5, 0.7]] as const).entries()) {
      const pattern = this.patterns[index];
      pattern.setTransform(new DOMMatrix().translateSelf(time * speed, time * speed * 0.4).scaleSelf(scale, scale * 0.6));
      ctx.fillStyle = pattern;
      // Faint in open water, stronger on the substrate; a rectangle is far cheaper than clipping to the sand's outline.
      ctx.globalAlpha = grade.caustics * alpha * 0.14; ctx.fillRect(0, 0, W, floor);
      ctx.globalAlpha = grade.caustics * alpha; ctx.fillRect(0, floor, W, H - floor);
    }
    ctx.restore();
  }

  /** The cached backdrop/substrate and solid layers for a scene, painting whichever is missing. */
  private staticLayers(scene: Scene, W: number, H: number, dpr: number) {
    const size = `${W}x${H}@${dpr}`, solids = staticSolids(scene);
    const layers = [cachedLayer(baseKey(scene, size), W, H, dpr, layer => { paintBackdrop(layer, W, H, scene.style); paintSubstrate(layer, W, H, scene.style); })];
    if (solids.length) layers.push(cachedLayer(`solids:${size}:${JSON.stringify(solids)}`, W, H, dpr, layer => { for (const piece of solids) drawPiece(layer, piece, pieceBox(piece, W, H), 0, 'all', H); }));
    return layers;
  }

  /** Paint a scene's static layers ahead of time, so opening that tank later draws them straight from the cache. */
  warm(scene: Scene, W: number, H: number, dpr: number) {
    if (W >= 1 && H >= 1) this.staticLayers(scene, W, H, dpr);
  }

  /** Moving plants: `back` before fish, `front` leaves after them, so fish can hide among the stems. */
  paintPlants(ctx: CanvasRenderingContext2D, W: number, H: number, scene: Scene, time: number, layer: 'back' | 'front') {
    const plants = scene.decorations.filter(piece => !isStatic(piece));
    if (!plants.length) return;
    const dpr = ctx.getTransform().a || 1, step = Math.floor(time * PLANT_FPS), key = `${W}x${H}@${dpr}:${step}`, cached = this.plantLayers[layer];
    if (cached?.key !== key || cached.decorations !== scene.decorations) {
      const frameTime = step / PLANT_FPS;
      this.plantLayers[layer] = { canvas: paintLayer(cached?.canvas, W, H, dpr, target => { for (const piece of plants) drawPiece(target, piece, pieceBox(piece, W, H), frameTime, layer, H); }), key, decorations: scene.decorations };
    }
    ctx.drawImage(this.plantLayers[layer]!.canvas, 0, 0, W, H);
  }

  /**
   * Bubbles, light rays, grading, glowing lanterns, the waterline and glass, over the fish. A multiply grade only works on
   * an opaque target: on a transparent overlay above the GPU fish layer it would fill the whole glass. With `over`, the
   * graded part stops before the multiply, everything after it goes to `over`, and the multiply colour is returned for the
   * caller to apply as a CSS multiply blend between the two layers, in the same order as the single-canvas path.
   */
  paintFront(ctx: CanvasRenderingContext2D, W: number, H: number, scene: Scene, time: number, over?: CanvasRenderingContext2D): string | null {
    const grade = gradeFor(scene.style.lighting, time);
    paintEffect(ctx, W, H, scene.style.effect, time);
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
    if (grade.multiply && !over) { ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = grade.multiply; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    if (over) ctx = over;
    ctx.fillStyle = grade.haze; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    if (grade.spots) {
      // Three show spots that drift slightly, each a soft cone with a pool of light on the substrate.
      for (let s = 0; s < 3; s++) {
        const x = W * (0.2 + s * 0.3) + Math.sin(time * 0.15 + s * 2) * W * 0.03, spread = W * 0.11, floor = SUBSTRATE_TOP * H;
        const cone = ctx.createLinearGradient(0, 0, 0, floor); cone.addColorStop(0, `rgba(${grade.spots},.22)`); cone.addColorStop(1, `rgba(${grade.spots},.05)`);
        ctx.fillStyle = cone; ctx.beginPath(); ctx.moveTo(x - spread * 0.2, 0); ctx.lineTo(x + spread * 0.2, 0); ctx.lineTo(x + spread, floor); ctx.lineTo(x - spread, floor); ctx.fill();
        const pool = ctx.createRadialGradient(x, floor, 0, x, floor, spread * 1.2); pool.addColorStop(0, `rgba(${grade.spots},.3)`); pool.addColorStop(1, `rgba(${grade.spots},0)`);
        ctx.save(); ctx.translate(x, floor); ctx.scale(1, 0.25); ctx.translate(-x, -floor); ctx.fillStyle = pool; ctx.fillRect(x - spread * 1.2, floor - spread * 1.2, spread * 2.4, spread * 2.4); ctx.restore();
      }
    }
    if (grade.flash) { ctx.fillStyle = `rgba(220,230,255,${(grade.flash * 0.35).toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
    for (const piece of scene.decorations) {
      if (piece.item !== 'rock-crystal') continue;
      // Quartz holds the light: a slow pulse, strongest in dim tanks.
      const box = pieceBox(piece, W, H), core = crystalCore(box.w, box.h), x = box.cx, y = box.base + core.y, pulse = 0.75 + Math.sin(time * 1.3 + piece.x * 20) * 0.25;
      const g = ctx.createRadialGradient(x, y, 0, x, y, core.r); g.addColorStop(0, `rgba(210,170,255,${(0.32 * grade.glow * pulse).toFixed(3)})`); g.addColorStop(1, 'rgba(160,120,255,0)');
      ctx.fillStyle = g; ctx.fillRect(x - core.r, y - core.r, core.r * 2, core.r * 2);
    }
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
    const dark = DARK_LIGHTINGS.includes(scene.style.lighting), dpr = ctx.getTransform().a || 1, key = `${W}x${H}@${dpr}:${dark}`;
    if (this.glass?.key !== key) {
      const canvas = this.glass?.canvas ?? document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(W * dpr)); canvas.height = Math.max(1, Math.round(H * dpr));
      const glass = canvas.getContext('2d')!; glass.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sheen = glass.createLinearGradient(0, 0, W * 0.5, H);
      sheen.addColorStop(0, 'rgba(255,255,255,.06)'); sheen.addColorStop(0.35, 'rgba(255,255,255,0)'); sheen.addColorStop(0.62, 'rgba(255,255,255,0)'); sheen.addColorStop(0.66, 'rgba(255,255,255,.035)'); sheen.addColorStop(0.72, 'rgba(255,255,255,0)');
      glass.fillStyle = sheen; glass.fillRect(0, 0, W, H);
      const vignette = glass.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.max(W, H) * 0.75);
      vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, dark ? 'rgba(0,4,16,.6)' : 'rgba(0,6,10,.42)');
      glass.fillStyle = vignette; glass.fillRect(0, 0, W, H);
      this.glass = { canvas, key };
    }
    ctx.drawImage(this.glass.canvas, 0, 0, W, H);
    return over ? grade.multiply : null;
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
  if (entry.id === 'wood-spider' || entry.id === 'wood-roots' || entry.id === 'wood-bonsai' || entry.id === 'orn-torii') { w = W * 0.42; h = H * 0.62; }
  if (entry.id === 'orn-bridge' || entry.id === 'orn-wreck' || entry.id === 'rock-arch') { w = W * 0.56; h = H * 0.5; }
  if (entry.id === 'rock-crystal') { w = W * 0.4; h = H * 0.6; }
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
