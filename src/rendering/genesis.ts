import type { Anatomy, Caudal, Vec } from '../core/anatomy';
import type { GenesisTraits } from '../core/genesis';
import { hash, random } from '../core/random';

/**
 * Renderer v8 Genesis layers. They draw only what development v6 expressed (veil and butterfly fins, ghost pigment,
 * photophores and fluorescence, open-ended hue and sheen, asymmetry and genetic defects) and are skipped entirely for
 * older genomes, so every pre-Genesis fish keeps its exact draw-op stream. Nothing here decides a trait.
 */
type At = (v: Vec, dy?: number) => [number, number];

/** Spinal bend from a spine defect: a smooth hump peaking just behind mid-body and fading toward snout and tail. */
export const kinkAt = (g: GenesisTraits | undefined, x: number) => g && g.kink ? g.kink * Math.exp(-(((x - 0.05) / 0.3) ** 2)) : 0;

/** Scale a fin's points toward its root: the dense core inside a translucent veil fin. */
export const towardRoot = (root: Vec, scale: number) => (v: Vec): Vec => ({ x: root.x + (v.x - root.x) * scale, y: root.y + (v.y - root.y) * scale });
export const VEIL_ALPHA = { standard: 1, veil: 0.42, butterfly: 0.32 } as const;
export const VEIL_CORE = { standard: 1, veil: 0.62, butterfly: 0.5 } as const;

/** Long translucent streamers trailing from the tail rays: veil fins once, butterfly fins further. */
export function drawVeilStreamers(ctx: CanvasRenderingContext2D, g: GenesisTraits, lobes: readonly Caudal[], at: At, l: number, wave: number, color: string, time: number) {
  if (g.fins === 'standard') return;
  // Filaments run along the outer part of each ray and only just past its end, so they stay inside the anatomy bounds.
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  for (const lobe of lobes) {
    lobe.rays.forEach((ray, i) => {
      const end = ray.end, dx = end.x - ray.start.x, dy = end.y - ray.start.y, length = Math.hypot(dx, dy) || 1;
      const sway = Math.sin(time * 2.2 + i * 0.9) * 0.012;
      const from = { x: ray.start.x + dx * 0.45, y: ray.start.y + dy * 0.45 };
      const tip = { x: end.x + dx / length * 0.012, y: end.y + dy / length * 0.012 + sway };
      ctx.globalAlpha = g.fins === 'veil' ? 0.3 : 0.42;
      ctx.lineWidth = Math.max(0.8, l * (g.fins === 'veil' ? 0.007 : 0.01));
      ctx.beginPath(); ctx.moveTo(...at(from, wave * 0.4)); ctx.quadraticCurveTo(...at({ x: (from.x + tip.x) / 2, y: (from.y + tip.y) / 2 - sway }, wave * 0.8), ...at(tip, wave)); ctx.stroke();
    });
  }
  ctx.restore();
}

/** A soft, see-through trailing edge inside an already-clipped fin path. */
export function veilEdge(ctx: CanvasRenderingContext2D, g: GenesisTraits, x0: number, x1: number, path: Path2D) {
  if (g.fins === 'standard') return;
  const fade = ctx.createLinearGradient(x0, 0, x1, 0);
  fade.addColorStop(0.45, 'rgba(255,255,255,0)'); fade.addColorStop(1, `rgba(236,246,250,${g.fins === 'veil' ? 0.28 : 0.4})`);
  ctx.save(); ctx.globalAlpha = 1; ctx.fillStyle = fade; ctx.fill(path); ctx.restore();
}

/** Eroded, ragged fin margins from a fin defect (or faint scars once regenerated). */
export function drawFray(ctx: CanvasRenderingContext2D, g: GenesisTraits, points: readonly Vec[], at: At, l: number, seed: number) {
  if (g.finFray <= 0.01 || points.length < 2) return;
  const rng = random(hash(`genesis-fray:${seed}`));
  ctx.save();
  ctx.strokeStyle = 'rgba(64,46,38,0.7)'; ctx.lineWidth = Math.max(0.8, l * 0.008); ctx.globalAlpha = Math.min(1, 0.45 + g.finFray * 0.55);
  ctx.beginPath();
  points.forEach((point, i) => {
    const bite = (rng() - 0.3) * 0.03 * g.finFray;
    const [x, y] = at({ x: point.x - Math.abs(bite), y: point.y + bite });
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  });
  ctx.stroke();
  // Torn bites along the margin, interpolated between the edge points.
  ctx.fillStyle = 'rgba(8,30,38,0.78)';
  for (let i = 0; i < Math.round(5 + 9 * g.finFray); i++) {
    const k = rng() * (points.length - 1), a = points[Math.floor(k)], b = points[Math.min(points.length - 1, Math.floor(k) + 1)], t = k - Math.floor(k);
    const [x, y] = at({ x: a.x + (b.x - a.x) * t - 0.012 - rng() * 0.02, y: a.y + (b.y - a.y) * t });
    ctx.beginPath(); ctx.ellipse(x, y, l * (0.012 + rng() * 0.02) * g.finFray + 0.6, l * (0.008 + rng() * 0.012) * g.finFray + 0.5, rng() * 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/** Body-clipped Genesis pigment: the ghost veil over a silenced cascade, washed-out load blotches and sheen. */
export function drawGenesisSkin(ctx: CanvasRenderingContext2D, g: GenesisTraits, a: Anatomy, at: At, l: number, h: number, seed: number) {
  if (g.ghost > 0) {
    const ghost = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    ghost.addColorStop(0, `rgba(232,244,248,${0.45 * g.ghost})`); ghost.addColorStop(1, `rgba(196,222,232,${0.3 * g.ghost})`);
    ctx.save(); ctx.globalAlpha = 1; ctx.fillStyle = ghost; ctx.fillRect(-l, -h, l * 2, h * 2); ctx.restore();
  }
  if (g.depigment > 0) {
    const rng = random(hash(`genesis-depigment:${seed}`));
    ctx.save(); ctx.fillStyle = '#f1ece0';
    for (let i = 0; i < 6; i++) {
      const u = 0.15 + rng() * 0.7, x = a.snoutX + (0.5 - a.snoutX) * u, [px, py] = at({ x, y: (rng() - 0.5) * 0.12 });
      ctx.globalAlpha = 0.25 + 0.35 * g.depigment * rng();
      ctx.beginPath(); ctx.ellipse(px, py, l * (0.03 + rng() * 0.05), l * (0.015 + rng() * 0.03), rng() * 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  if (g.sheen > 0.3) {
    const sheen = ctx.createLinearGradient(-l / 2, -h / 2, l / 2, h / 2);
    sheen.addColorStop(0, 'rgba(120,220,255,0)'); sheen.addColorStop(0.45, `rgba(170,140,255,${0.12 * g.sheen})`); sheen.addColorStop(0.6, `rgba(120,255,220,${0.12 * g.sheen})`); sheen.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save(); ctx.globalAlpha = 1; ctx.fillStyle = sheen; ctx.fillRect(-l, -h, l * 2, h * 2); ctx.restore();
  }
}

/** Photophores along the flank. Their light is added, so they read in any lighting, and they breathe slowly. */
export function drawPhotophores(ctx: CanvasRenderingContext2D, g: GenesisTraits, a: Anatomy, at: At, l: number, seed: number, time: number) {
  if (g.glow <= 0.01) return;
  const count = 6 + Math.round(g.glow * 8), color = `hsl(${g.glowHue.toFixed(0)} 95% 65%)`;
  const pulse = 0.7 + 0.3 * Math.sin(time * 1.3 + seed % 11);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < count; i++) {
    const u = 0.14 + 0.76 * i / (count - 1), x = a.snoutX + (0.5 - a.snoutX) * u;
    const top = a.top.find(point => point.x >= x) ?? a.top[a.top.length - 1], bottom = a.bottom.find(point => point.x >= x) ?? a.bottom[a.bottom.length - 1];
    const [px, py] = at({ x, y: top.y + (bottom.y - top.y) * 0.64 });
    const r = l * (0.012 + 0.012 * g.glow);
    const halo = ctx.createRadialGradient(px, py, 0, px, py, r * 3);
    halo.addColorStop(0, color); halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = g.glow * pulse * 0.55; ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(px, py, r * 3, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = Math.min(1, 0.4 + g.glow * 0.6) * pulse; ctx.fillStyle = '#f4fff8'; ctx.beginPath(); ctx.arc(px, py, r * 0.45, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/** A milky film over an eye clouded by load. */
export function drawEyeCloud(ctx: CanvasRenderingContext2D, g: GenesisTraits, x: number, y: number, r: number) {
  if (g.eyeCloud <= 0) return;
  ctx.save();
  const film = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, 0, x, y, r);
  film.addColorStop(0, `rgba(238,240,236,${0.75 * g.eyeCloud})`); film.addColorStop(1, `rgba(214,222,220,${0.4 * g.eyeCloud})`);
  ctx.globalAlpha = 1; ctx.fillStyle = film; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** Rotate an `hsl(h s% l%)` color string's hue by `degrees`; other color strings pass through. */
export function shiftHue(color: string, degrees: number): string {
  if (!degrees) return color;
  const match = /^hsl\(([-\d.]+)\s/.exec(color);
  if (!match) return color;
  const hue = ((Number(match[1]) + degrees) % 360 + 360) % 360;
  return color.replace(match[0], `hsl(${hue.toFixed(1)} `);
}
