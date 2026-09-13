import { anatomyFor, TAIL_WAVE, type Vec } from '../core/anatomy';
import { markingPosition, placeMarkings, type PlacedMarking } from '../core/pattern';
import { hash, random } from '../core/random';
import type { Phenotype } from '../core/types';

const placedMarkings = new WeakMap<Phenotype, { seed: number; markings: PlacedMarking[] }>();
function markingsFor(p: Phenotype, seed: number): PlacedMarking[] {
  const cached = placedMarkings.get(p);
  if (cached?.seed === seed) return cached.markings;
  const markings = placeMarkings(p, seed);
  placedMarkings.set(p, { seed, markings });
  return markings;
}

/** Renderer v3: anatomy v2 geometry with development v2 inherited markings. No inheritance, mutation, or identity decisions belong here. */
export function drawFish(ctx: CanvasRenderingContext2D, p: Phenotype, seed: number, size: number, time = 0) {
  const a = anatomyFor(p);
  const l = size * p.length, h = l * p.depth;
  const wave = Math.sin(time * (2.5 + p.activity * 3) + seed % 20) * TAIL_WAVE;
  const at = (v: Vec, dy = 0): [number, number] => [v.x * l, (v.y + dy) * l];
  const orange = `hsl(${8 + p.yellow * 38} 78% ${43 + p.metallic * 12}%)`;
  const base = `hsl(${38 + p.yellow * 8} ${10 + p.yellow * 25}% ${65 + p.white * 27}%)`;
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
  for (const ray of c.rays) { ctx.beginPath(); ctx.moveTo(...at(ray.start)); ctx.quadraticCurveTo(...at(ray.control, wave * 0.5), ...at(ray.end, wave)); ctx.stroke(); }
  ctx.restore();
  // Dorsal and pectoral fins sit behind the body with roots inside the outline.
  for (const fin of [a.dorsal, a.pectoral]) {
    ctx.beginPath(); ctx.moveTo(...at(fin.start)); ctx.quadraticCurveTo(...at(fin.control), ...at(fin.end)); ctx.closePath(); ctx.fill(); ctx.stroke();
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
    const alpha = (layer === 'dark' ? p.black : p.red) * (1 - p.translucency);
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
  ctx.fillStyle = `hsl(${p.iris} 55% 62%)`; ctx.beginPath(); ctx.arc(eyeX, eyeY, eyeRadius, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#101c1b'; ctx.beginPath(); ctx.arc(eyeX - eyeRadius * 0.12, eyeY, pupilRadius * l, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(eyeX - eyeRadius * 0.22, eyeY - eyeRadius * 0.22, eyeRadius * 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#46564c90';
  ctx.beginPath(); ctx.moveTo(...at(a.mouth.tip)); ctx.lineTo(...at(a.mouth.corner)); ctx.stroke();
  ctx.strokeStyle = '#e0dbc3aa';
  for (const barbel of a.barbels) { ctx.beginPath(); ctx.moveTo(...at(barbel.start)); ctx.quadraticCurveTo(...at(barbel.control), ...at(barbel.end)); ctx.stroke(); }
  ctx.restore();
}
