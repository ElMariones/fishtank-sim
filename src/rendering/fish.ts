import { random } from '../core/random';
import type { Phenotype } from '../core/types';

/** Procedural phenotype renderer. No inheritance, mutation, or identity decisions belong here. */
export function drawFish(ctx: CanvasRenderingContext2D, p: Phenotype, seed: number, size: number, time = 0) {
  const l = size * p.length, h = l * p.depth;
  const tailWave = Math.sin(time * (2.5 + p.activity * 3) + seed % 20) * l * 0.045;
  const orange = `hsl(${8 + p.yellow * 38} 78% ${43 + p.metallic * 12}%)`;
  const base = `hsl(${38 + p.yellow * 8} ${10 + p.yellow * 25}% ${65 + p.white * 27}%)`;
  ctx.save();
  ctx.lineWidth = 0.7;
  ctx.strokeStyle = '#d7e5dd60';
  ctx.fillStyle = p.finPigment > 0.55 ? orange : '#c5ded8aa';
  // Caudal fin and its rays.
  ctx.beginPath();
  ctx.moveTo(l * 0.42, 0);
  ctx.bezierCurveTo(l * 0.65, -h * 0.4, l * (0.5 + p.tail), -l * p.spread + tailWave, l * (0.5 + p.tail), -l * p.spread * 0.6 + tailWave);
  ctx.lineTo(l * (0.5 + p.tail * (1 - p.fork)), tailWave);
  ctx.lineTo(l * (0.5 + p.tail), l * p.spread * 0.6 + tailWave);
  ctx.bezierCurveTo(l * (0.5 + p.tail), l * p.spread + tailWave, l * 0.65, h * 0.4, l * 0.42, 0);
  ctx.fill(); ctx.stroke();
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath(); ctx.moveTo(l * 0.46, 0); ctx.quadraticCurveTo(l * 0.72, i * h * 0.04, l * (0.5 + p.tail * (0.5 + Math.abs(i) / 6)), i * l * p.spread * 0.2 + tailWave); ctx.stroke();
  }
  // Dorsal and pectoral fins.
  ctx.beginPath(); ctx.moveTo(-l * 0.18, -h * 0.42); ctx.quadraticCurveTo(-l * 0.08, -h * 0.45 - l * p.dorsal, l * 0.3, -h * 0.22); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-l * 0.2, h * 0.12); ctx.quadraticCurveTo(-l * 0.05, h * 0.6 + l * p.pectoral, l * 0.1, h * 0.4); ctx.closePath(); ctx.fill(); ctx.stroke();
  const body = new Path2D();
  body.moveTo(-l * (0.5 + p.snout), 0);
  body.bezierCurveTo(-l * (0.5 + p.snout), -h * p.head, -l * (0.5 - p.head), -h * (0.72 + p.curve), l * 0.15, -h * 0.36);
  body.quadraticCurveTo(l * 0.3, -h * 0.22, l * 0.5, -h * p.taper * 0.4);
  body.lineTo(l * 0.5, h * p.taper * 0.4);
  body.bezierCurveTo(l * 0.1, h * 0.32, -l * 0.12, h * 0.7, -l * 0.42, h * 0.24);
  body.quadraticCurveTo(-l * (0.5 + p.snout), h * p.mouth, -l * (0.5 + p.snout), 0);
  ctx.fillStyle = base; ctx.fill(body);
  ctx.save(); ctx.clip(body); ctx.globalAlpha = 1 - p.translucency;
  const rng = random(seed);
  for (let i = 0; i < p.frequency; i++) {
    const x = (rng() - 0.5) * l * 1.2, y = (rng() - 0.5) * h * (1 - p.symmetry * 0.5);
    const radius = l * p.patternScale * (0.5 + rng());
    const black = i % 3 === 0;
    ctx.fillStyle = black ? '#182526' : orange;
    ctx.globalAlpha = (black ? p.black : p.red) * (1 - p.translucency);
    if (p.edge > 0.55) {
      const glow = ctx.createRadialGradient(x, y, radius * 0.4, x, y, radius);
      glow.addColorStop(0, black ? '#182526' : orange); glow.addColorStop(1, 'transparent'); ctx.fillStyle = glow;
    }
    ctx.beginPath(); ctx.ellipse(x, y, radius, radius * (0.5 + p.warp), rng() * 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#263935';
  for (let i = 0; i < p.speckle * 55; i++) { ctx.beginPath(); ctx.arc((rng() - 0.5) * l, (rng() - 0.5) * h, l * 0.008, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
  const shine = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  shine.addColorStop(0, `rgba(255,255,255,${0.22 + p.metallic * 0.4})`); shine.addColorStop(0.42, '#ffffff00'); shine.addColorStop(1, '#092a344f');
  ctx.fillStyle = shine; ctx.fillRect(-l, -h, l * 2, h * 2); ctx.restore();
  ctx.strokeStyle = '#e3f2e24a'; ctx.stroke(body);
  const eyeX = -l * (0.45 - p.head * 0.14), eyeY = -h * p.eyePosition * 0.6;
  ctx.fillStyle = `hsl(${p.iris} 55% 62%)`; ctx.beginPath(); ctx.arc(eyeX, eyeY, l * p.eye, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#101c1b'; ctx.beginPath(); ctx.arc(eyeX - l * p.eye * 0.12, eyeY, l * p.eye * p.pupil, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(eyeX - l * p.eye * 0.22, eyeY - l * p.eye * 0.22, l * p.eye * 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#46564c90';
  ctx.beginPath(); ctx.moveTo(-l * (0.5 - p.head), -h * 0.2); ctx.quadraticCurveTo(-l * (0.37 - p.head), h * 0.12, -l * (0.48 - p.head), h * 0.36); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-l * (0.5 + p.snout), 0); ctx.lineTo(-l * (0.5 + p.snout - p.mouth), h * 0.04); ctx.stroke();
  ctx.strokeStyle = '#e0dbc3aa';
  for (const sign of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-l * (0.49 + p.snout), h * 0.04); ctx.quadraticCurveTo(-l * (0.52 + p.snout), h * 0.2 * sign, -l * (0.5 + p.snout + p.barbel), h * 0.25 * sign); ctx.stroke(); }
  ctx.restore();
}
