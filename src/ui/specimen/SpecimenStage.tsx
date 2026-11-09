import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { HATCH_LENGTH_CM, INCUBATION_DAYS, isEgg } from '../../core/development';
import { express, metabolicPotential } from '../../core/genetics';
import { formatCm, MAX_ZOOM, MIN_ZOOM, scaleBar, zoomAt, type StageView } from '../../core/specimen';
import type { Fish, Genome, Phenotype } from '../../core/types';
import { drawEgg, drawFish } from '../../rendering/fish';
import { currentPhenotype } from '../../rendering/stage';
import { Icon, type IconName } from '../Icon';

/**
 * The studio stage (FS-134): one animal, isolated in an observation cell, drawn by the same renderer as the aquarium.
 * Everything here is presentation: pan, zoom, lenses, the ruler and the growth preview never touch the fish record.
 */
export type Lens = 'daylight' | 'night' | 'blueprint' | 'contrast';
export const LENSES: { id: Lens; label: string; icon: IconName; blurb: string }[] = [
  { id: 'daylight', label: 'Daylight', icon: 'sun', blurb: 'Full-spectrum light: colours as the keeper sees them.' },
  { id: 'night', label: 'Night', icon: 'moon', blurb: 'Low light. Pigment fades, and photophores and metallic scales catch the eye.' },
  { id: 'blueprint', label: 'Blueprint', icon: 'scale', blurb: 'Outline on a centimetre grid with overall length and depth.' },
  { id: 'contrast', label: 'Judge’s eye', icon: 'eye', blurb: 'Greyscale lightbox: how the panel reads pattern contrast without colour.' },
];

type Box = { minX: number; minY: number; maxX: number; maxY: number };
type Subject = { key: string; phenotype: Phenotype; seed: number; lengthCm: number; egg: { progress: number } | null; caption: string; activity: number };
type Slot = Subject & { cx: number; cy: number; size: number; box: Box; widthPx: number; heightPx: number };
type Layout = { slots: Slot[]; pxPerCm: number };
type Ruler = { a: { x: number; y: number }; b: { x: number; y: number } } | null;

const adults = new WeakMap<Genome | object, Phenotype>();
const adultOf = (fish: Fish) => { let p = adults.get(fish.genome); if (!p) { p = express(fish.genome); adults.set(fish.genome, p); } return p; };

/** Silhouette bounds in size units, measured once per phenotype from a rest-pose drawing. */
const boxes = new WeakMap<Phenotype, Map<number, Box>>();
function measure(p: Phenotype, seed: number): Box {
  let bySeed = boxes.get(p);
  const cached = bySeed?.get(seed);
  if (cached) return cached;
  let found: Box = { minX: -0.8, minY: -0.3, maxX: 0.8, maxY: 0.3 };
  const W = 1400, H = 1000, canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  for (const S of [100, 30, 8]) {
    if (!ctx) break;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H); ctx.translate(W / 2, H / 2);
    drawFish(ctx, p, seed, S, 0);
    const data = ctx.getImageData(0, 0, W, H).data;
    let minX = W, minY = H, maxX = -1, maxY = -1;
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (data[(y * W + x) * 4 + 3] > 10) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    if (maxX < 0) break;
    if (minX <= 2 || minY <= 2 || maxX >= W - 3 || maxY >= H - 3) continue;
    found = { minX: (minX - W / 2) / S, maxX: (maxX + 2 - W / 2) / S, minY: (minY - H / 2) / S, maxY: (maxY + 2 - H / 2) / S };
    break;
  }
  if (!bySeed) { bySeed = new Map(); boxes.set(p, bySeed); }
  bySeed.set(seed, found);
  return found;
}

function subjectOf(fish: Fish, growth: number | null, caption: string): Subject {
  const adult = adultOf(fish), potential = metabolicPotential(fish.genome);
  const activity = adult.guppy?.activity ?? adult.goldfish?.activity ?? adult.axolotl?.activity ?? adult.activity;
  if (growth === null && isEgg(fish.life)) return { key: `${fish.id}:egg`, phenotype: adult, seed: fish.birthSeed, lengthCm: 0, egg: { progress: Math.min(1, fish.life.ageDays / INCUBATION_DAYS) }, caption, activity };
  const lengthCm = growth === null ? fish.life.lengthCm : Math.max(HATCH_LENGTH_CM, growth * potential.adultLengthCm);
  const life = growth === null ? fish.life : { ...fish.life, lengthCm, ageDays: Math.max(fish.life.ageDays, INCUBATION_DAYS + 1) };
  return { key: `${fish.id}:${lengthCm.toFixed(2)}`, phenotype: growth === 1 ? adult : currentPhenotype(adult, { life }), seed: fish.birthSeed, lengthCm, egg: null, caption, activity };
}

function layoutFor(subjects: Subject[], w: number, h: number): Layout {
  const count = subjects.length, areaW = w * (count > 1 ? 0.7 : 0.74), areaH = h * (count > 1 ? 0.34 : 0.6);
  const measured = subjects.map(subject => ({ subject, box: subject.egg ? { minX: -1, maxX: 1, minY: -1, maxY: 1 } : measure(subject.phenotype, subject.seed) }));
  // One centimetre scale for every subject, so a comparison shows true relative size.
  let pxPerCm = Infinity;
  for (const { subject, box } of measured) {
    if (subject.egg) continue;
    const aspect = (box.maxY - box.minY) / (box.maxX - box.minX);
    pxPerCm = Math.min(pxPerCm, areaW / subject.lengthCm, areaH / (subject.lengthCm * aspect));
  }
  if (!Number.isFinite(pxPerCm)) pxPerCm = 1;
  const slots = measured.map(({ subject, box }, i) => {
    const cy = count > 1 ? (i === 0 ? -h * 0.2 : h * 0.2) : -h * 0.02;
    if (subject.egg) { const r = Math.min(w, h) * 0.16; return { ...subject, cx: 0, cy, size: r, box, widthPx: r * 2, heightPx: r * 2 }; }
    const size = pxPerCm * subject.lengthCm / (box.maxX - box.minX);
    return { ...subject, cx: 0, cy, size, box, widthPx: (box.maxX - box.minX) * size, heightPx: (box.maxY - box.minY) * size };
  });
  return { slots, pxPerCm };
}

type Frame = { t: number; tail: number; fin: number };
type Scene = { lens: Lens; view: StageView; layout: Layout; flipped: boolean; ruler: Ruler; dpr: number; w: number; h: number };

/** Off-screen buffers for the blueprint outline, reused between frames. */
const buffers: HTMLCanvasElement[] = [];
const buffer = (i: number, w: number, h: number) => {
  let c = buffers[i];
  if (!c) { c = document.createElement('canvas'); buffers[i] = c; }
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const ctx = c.getContext('2d')!; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.filter = 'none';
  return { canvas: c, ctx };
};

const toScreen = (scene: Scene, x: number, y: number) => ({ x: scene.w / 2 + scene.view.x + x * scene.view.zoom, y: scene.h / 2 + scene.view.y + y * scene.view.zoom });

function backdrop(ctx: CanvasRenderingContext2D, scene: Scene, frame: Frame) {
  const { w, h, lens } = scene;
  if (lens === 'blueprint') {
    ctx.fillStyle = '#0a2442'; ctx.fillRect(0, 0, w, h);
    const ppc = scene.layout.pxPerCm * scene.view.zoom, grid = scaleBar(1 / ppc, 18, 46), step = grid.px;
    const o = toScreen(scene, 0, 0);
    for (const [major, alpha] of [[false, 0.07], [true, 0.16]] as const) {
      const s = major ? step * 5 : step;
      ctx.strokeStyle = `rgba(150, 210, 255, ${alpha})`; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = ((o.x % s) + s) % s; x < w; x += s) { ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, h); }
      for (let y = ((o.y % s) + s) % s; y < h; y += s) { ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(w, Math.round(y) + 0.5); }
      ctx.stroke();
    }
    return;
  }
  if (lens === 'contrast') {
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#9aa0a2'); g.addColorStop(1, '#6b7173');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const v = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.1, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(255,255,255,0.18)'); v.addColorStop(1, 'rgba(0,0,0,0.25)'); ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
    return;
  }
  const night = lens === 'night';
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, night ? '#04101e' : '#14526a'); g.addColorStop(0.55, night ? '#030a14' : '#0b3346'); g.addColorStop(1, night ? '#010409' : '#05161f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // Light from above, and slow caustic bands drifting across the cell.
  const light = ctx.createRadialGradient(w * 0.5, -h * 0.25, 10, w * 0.5, -h * 0.1, h * 1.05);
  light.addColorStop(0, night ? 'rgba(120,150,255,0.16)' : 'rgba(190,255,240,0.32)'); light.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = light; ctx.fillRect(0, 0, w, h);
  if (!night) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const x = ((i * 0.19 + frame.t * 0.012 * (1 + i * 0.13)) % 1.3 - 0.15) * w;
      const band = ctx.createLinearGradient(x - 60, 0, x + 60, 0);
      band.addColorStop(0, 'rgba(160,255,235,0)'); band.addColorStop(0.5, 'rgba(160,255,235,0.035)'); band.addColorStop(1, 'rgba(160,255,235,0)');
      ctx.fillStyle = band; ctx.beginPath(); ctx.moveTo(x - 40, 0); ctx.lineTo(x + 60, 0); ctx.lineTo(x + 160, h); ctx.lineTo(x - 10, h); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  // Marine snow: a deterministic drift of motes in screen space.
  ctx.fillStyle = night ? 'rgba(170,200,255,0.5)' : 'rgba(220,255,248,0.35)';
  for (let i = 0; i < 46; i++) {
    const sx = (Math.sin(i * 12.9898) * 43758.5453) % 1, sy = (Math.sin(i * 78.233) * 12345.678) % 1;
    const x = (Math.abs(sx) * w + Math.sin(frame.t * 0.3 + i) * 8) % w, y = ((Math.abs(sy) * h - frame.t * (6 + (i % 5) * 3)) % h + h) % h;
    const r = 0.6 + (i % 3) * 0.45;
    ctx.globalAlpha = 0.25 + (i % 4) * 0.12; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
  vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, night ? 'rgba(0,0,0,0.6)' : 'rgba(0,8,14,0.5)');
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, w, h);
}

/** Draws one subject in scene space (the caller has applied DPR; this applies view, bob and facing). */
function paintSubject(ctx: CanvasRenderingContext2D, scene: Scene, slot: Slot, frame: Frame, shadow: boolean) {
  const { view, w, h } = scene;
  ctx.save();
  ctx.translate(w / 2 + view.x, h / 2 + view.y); ctx.scale(view.zoom, view.zoom);
  const bob = Math.sin(frame.t * 1.25 + slot.seed % 7) * Math.min(6, slot.heightPx * 0.025);
  if (shadow && !slot.egg) {
    const sy = slot.cy + slot.heightPx / 2 + Math.max(18, slot.heightPx * 0.35), rx = slot.widthPx * 0.38;
    const g = ctx.createRadialGradient(slot.cx, sy, 1, slot.cx, sy, rx);
    g.addColorStop(0, scene.lens === 'contrast' ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.32)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.save(); ctx.translate(slot.cx, sy); ctx.scale(1, 0.16); ctx.translate(-slot.cx, -sy); ctx.beginPath(); ctx.arc(slot.cx, sy, rx, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  ctx.translate(slot.cx, slot.cy + bob);
  if (slot.egg) { drawEgg(ctx, slot.size, slot.seed, slot.egg.progress, frame.t); ctx.restore(); return; }
  if (scene.flipped) ctx.scale(-1, 1);
  ctx.translate(-slot.size * (slot.box.minX + slot.box.maxX) / 2, -slot.size * (slot.box.minY + slot.box.maxY) / 2);
  const pace = 1 + slot.activity;
  drawFish(ctx, slot.phenotype, slot.seed, slot.size, frame.t, { tailPhase: frame.tail * pace, finPhase: frame.fin * pace, effort: 0.32 });
  ctx.restore();
}

function dimension(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, text: string, vertical: boolean) {
  ctx.strokeStyle = 'rgba(190,232,255,0.85)'; ctx.fillStyle = 'rgba(214,240,255,0.95)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  const t = 6;
  if (vertical) { ctx.moveTo(x1 - t, y1); ctx.lineTo(x1 + t, y1); ctx.moveTo(x2 - t, y2); ctx.lineTo(x2 + t, y2); }
  else { ctx.moveTo(x1, y1 - t); ctx.lineTo(x1, y1 + t); ctx.moveTo(x2, y2 - t); ctx.lineTo(x2, y2 + t); }
  ctx.stroke();
  ctx.font = '600 12px "JetBrains Mono", Consolas, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, width = ctx.measureText(text).width + 12;
  ctx.save(); ctx.translate(mx, my); if (vertical) ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#0a2442'; ctx.fillRect(-width / 2, -9, width, 18); ctx.fillStyle = 'rgba(214,240,255,0.95)'; ctx.fillText(text, 0, 1);
  ctx.restore();
}

/** Paints the full stage into `ctx` (CSS-pixel scene size `w`×`h`, device scale `dpr`). Also used for the photo. */
function paintScene(ctx: CanvasRenderingContext2D, scene: Scene, frame: Frame) {
  const { dpr, w, h, lens, layout } = scene;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.filter = 'none';
  backdrop(ctx, scene, frame);
  for (const slot of layout.slots) {
    if (lens === 'blueprint' && !slot.egg) {
      const W = Math.round(w * dpr), H = Math.round(h * dpr), off = buffer(0, W, H), sil = buffer(1, W, H), edge = buffer(2, W, H);
      off.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); paintSubject(off.ctx, scene, slot, frame, false);
      sil.ctx.drawImage(off.canvas, 0, 0); sil.ctx.globalCompositeOperation = 'source-in'; sil.ctx.fillStyle = '#fff'; sil.ctx.fillRect(0, 0, W, H);
      const r = 1.4 * dpr;
      for (let i = 0; i < 8; i++) edge.ctx.drawImage(sil.canvas, Math.cos(i * Math.PI / 4) * r, Math.sin(i * Math.PI / 4) * r);
      edge.ctx.globalCompositeOperation = 'destination-out'; edge.ctx.drawImage(sil.canvas, 0, 0);
      edge.ctx.globalCompositeOperation = 'source-in'; edge.ctx.fillStyle = '#a8e6ff'; edge.ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 0.1; ctx.drawImage(sil.canvas, 0, 0);
      ctx.globalAlpha = 0.28; ctx.filter = 'grayscale(1) brightness(1.5)'; ctx.drawImage(off.canvas, 0, 0); ctx.filter = 'none';
      ctx.globalAlpha = 1; ctx.drawImage(edge.canvas, 0, 0);
      ctx.restore();
      // Overall length and depth, measured on the silhouette.
      const z = scene.view.zoom, c = toScreen(scene, slot.cx, slot.cy), hw = slot.widthPx * z / 2, hh = slot.heightPx * z / 2;
      dimension(ctx, c.x - hw, c.y + hh + 22, c.x + hw, c.y + hh + 22, `${formatCm(slot.lengthCm)} overall`, false);
      dimension(ctx, c.x + hw + 22, c.y - hh, c.x + hw + 22, c.y + hh, formatCm(slot.lengthCm * slot.heightPx / slot.widthPx), true);
      continue;
    }
    if (lens === 'night' || lens === 'contrast') {
      // The renderer sets its own canvas state, so lens filters apply when compositing a finished drawing, never inside it.
      const W = Math.round(w * dpr), H = Math.round(h * dpr), off = buffer(0, W, H);
      off.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); paintSubject(off.ctx, scene, slot, frame, lens === 'contrast');
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (lens === 'night') {
        ctx.filter = 'brightness(0.4) saturate(0.75)'; ctx.drawImage(off.canvas, 0, 0);
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.16; ctx.filter = `blur(${Math.round(10 * dpr)}px) brightness(0.7)`; ctx.drawImage(off.canvas, 0, 0);
      } else { ctx.filter = 'grayscale(1) contrast(1.35)'; ctx.drawImage(off.canvas, 0, 0); }
      ctx.restore();
      continue;
    }
    paintSubject(ctx, scene, slot, frame, true);
  }
  // A subject drawn only a few pixels long (a fry beside an adult at true scale) gets a locator ring.
  for (const slot of layout.slots) {
    if (slot.egg || slot.widthPx * scene.view.zoom >= 18) continue;
    const c = toScreen(scene, slot.cx, slot.cy);
    ctx.save(); ctx.strokeStyle = lens === 'contrast' ? 'rgba(10,20,24,0.8)' : 'rgba(182,255,240,0.85)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.arc(c.x, c.y, 16, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  if (layout.slots.length > 1) {
    ctx.font = '600 12px "Instrument Sans", "Segoe UI", sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (const slot of layout.slots) {
      const c = toScreen(scene, slot.cx, slot.cy), x = c.x - slot.widthPx * scene.view.zoom / 2, y = c.y - slot.heightPx * scene.view.zoom / 2 - 16;
      const text = `${slot.caption} · ${slot.egg ? 'egg' : formatCm(slot.lengthCm)}`, tw = ctx.measureText(text).width;
      ctx.fillStyle = 'rgba(4,16,24,0.72)'; ctx.beginPath(); ctx.roundRect(x - 8, y - 11, tw + 16, 22, 11); ctx.fill();
      ctx.fillStyle = '#dff7f2'; ctx.fillText(text, x, y + 0.5);
    }
  }
  const ruler = scene.ruler;
  if (ruler) {
    const a = toScreen(scene, ruler.a.x, ruler.a.y), b = toScreen(scene, ruler.b.x, ruler.b.y);
    const cm = Math.hypot(ruler.b.x - ruler.a.x, ruler.b.y - ruler.a.y) / layout.pxPerCm;
    ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = '#f4d58d'; ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#f4d58d'; for (const p of [a, b]) { ctx.beginPath(); ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2); ctx.fill(); }
    const text = formatCm(cm); ctx.font = '700 13px "JetBrains Mono", Consolas, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(text).width + 16, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - 18;
    ctx.fillStyle = 'rgba(42,28,4,0.92)'; ctx.beginPath(); ctx.roundRect(mx - tw / 2, my - 12, tw, 24, 12); ctx.fill();
    ctx.fillStyle = '#ffe7b5'; ctx.fillText(text, mx, my + 0.5); ctx.restore();
  }
}

export type StageProps = {
  fish: Fish; compare: Fish | null; compareCaption: string; photo: { title: string; line: string };
  /** Announces stage changes (lens, zoom) to the studio's live region. */
  onAnnounce?: (text: string) => void;
};

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const SpecimenStage = memo(function SpecimenStage({ fish, compare, compareCaption, photo, onAnnounce }: StageProps) {
  const wrap = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 800, h: 520 });
  const [lens, setLens] = useState<Lens>('daylight');
  const [view, setView] = useState<StageView>({ zoom: 1, x: 0, y: 0 });
  const [swimming, setSwimming] = useState(() => !reduced());
  const [flipped, setFlipped] = useState(false);
  const [tool, setTool] = useState<'pan' | 'measure'>('pan');
  const [ruler, setRuler] = useState<Ruler>(null);
  const [growth, setGrowth] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const potential = useMemo(() => metabolicPotential(fish.genome), [fish.genome]);
  const today = isEgg(fish.life) ? 0 : fish.life.lengthCm / potential.adultLengthCm;

  // A new subject starts framed, at today's appearance.
  useEffect(() => { setView({ zoom: 1, x: 0, y: 0 }); setRuler(null); setGrowth(null); }, [fish.id]);

  const subjects = useMemo(() => {
    const list = [subjectOf(fish, growth, fish.name)];
    if (compare && !(growth === null && isEgg(fish.life))) list.push(subjectOf(compare, null, compareCaption));
    return list;
  }, [fish, growth, compare, compareCaption]);
  const layout = useMemo(() => layoutFor(subjects, size.w, size.h), [subjects, size.w, size.h]);

  const scene = useRef<Scene>({ lens, view, layout, flipped, ruler, dpr: 1, w: size.w, h: size.h });
  scene.current = { ...scene.current, lens, view, layout, flipped, ruler, w: size.w, h: size.h };
  const swimRef = useRef(swimming); swimRef.current = swimming;

  useEffect(() => {
    const element = wrap.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => { const { width, height } = entry.contentRect; if (width > 10 && height > 10) setSize({ w: Math.round(width), h: Math.round(height) }); });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // One animation loop for the lifetime of the stage. Frozen time keeps the pose but still repaints view changes.
  useEffect(() => {
    let raf = 0, last = performance.now();
    const frame: Frame = { t: 0, tail: 0, fin: 0 };
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (swimRef.current) { frame.t += dt; frame.tail += dt * 4.2; frame.fin += dt * 2.6; }
      const c = canvas.current, ctx = c?.getContext('2d');
      if (c && ctx) {
        const s = scene.current, dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.round(s.w * dpr), H = Math.round(s.h * dpr);
        if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
        paintScene(ctx, { ...s, dpr }, frame);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ---- Pointer interaction: pan, pinch, wheel, ruler ----
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ kind: 'pan' | 'pinch' | 'ruler'; view: StageView; x: number; y: number; dist: number } | null>(null);
  const local = (event: { clientX: number; clientY: number }) => { const rect = wrap.current!.getBoundingClientRect(); return { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 }; };
  const toScene = (p: { x: number; y: number }, v = scene.current.view) => ({ x: (p.x - v.x) / v.zoom, y: (p.y - v.y) / v.zoom });

  useEffect(() => {
    const element = wrap.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const p = local(event), factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0016));
      setView(v => zoomAt(v, factor, p.x, p.y));
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, []);

  function down(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    if ((event.target as HTMLElement).closest('button, input, select, label')) return;
    // Capture keeps a drag alive outside the stage; some synthetic or pen pointers cannot be captured, which is harmless.
    try { wrap.current?.setPointerCapture(event.pointerId); } catch { /* Not capturable. */ }
    const p = local(event); pointers.current.set(event.pointerId, p);
    const v = scene.current.view;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { kind: 'pinch', view: v, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, dist: Math.hypot(a.x - b.x, a.y - b.y) || 1 };
    } else if (tool === 'measure' && !event.shiftKey) {
      const s = toScene(p); setRuler({ a: s, b: s }); gesture.current = { kind: 'ruler', view: v, x: p.x, y: p.y, dist: 0 };
    } else gesture.current = { kind: 'pan', view: v, x: p.x, y: p.y, dist: 0 };
    setDragging(true);
  }
  function move(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    const p = local(event); pointers.current.set(event.pointerId, p);
    const g = gesture.current;
    if (!g) return;
    if (g.kind === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()], mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const zoomed = zoomAt(g.view, dist / g.dist, g.x, g.y);
      setView({ ...zoomed, x: zoomed.x + mid.x - g.x, y: zoomed.y + mid.y - g.y });
    } else if (g.kind === 'pan') setView({ ...g.view, x: g.view.x + p.x - g.x, y: g.view.y + p.y - g.y });
    else if (g.kind === 'ruler') setRuler(r => r ? { a: r.a, b: toScene(p) } : r);
  }
  function up(event: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (gesture.current?.kind === 'ruler') setRuler(r => r && Math.hypot(r.b.x - r.a.x, r.b.y - r.a.y) * scene.current.view.zoom < 4 ? null : r);
    if (!pointers.current.size) { gesture.current = null; setDragging(false); }
    else if (gesture.current?.kind === 'pinch') { const [rest] = [...pointers.current.values()]; gesture.current = { kind: 'pan', view: scene.current.view, x: rest.x, y: rest.y, dist: 0 }; }
  }

  const zoomBy = (factor: number) => setView(v => zoomAt(v, factor, 0, 0));
  const reset = () => { setView({ zoom: 1, x: 0, y: 0 }); onAnnounce?.('View reset to fit the specimen.'); };
  const chooseLens = (next: Lens) => { setLens(next); onAnnounce?.(`${LENSES.find(l => l.id === next)!.label} lens.`); };

  function key(event: ReactKeyboardEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('input, select, textarea')) return;
    const k = event.key, step = event.shiftKey ? 120 : 40;
    const act = (fn: () => void) => { event.preventDefault(); event.stopPropagation(); fn(); };
    if (k === '+' || k === '=') act(() => zoomBy(1.25));
    else if (k === '-' || k === '_') act(() => zoomBy(0.8));
    else if (k === '0' || k === 'r' || k === 'R') act(reset);
    else if (k === 'ArrowLeft') act(() => setView(v => ({ ...v, x: v.x + step })));
    else if (k === 'ArrowRight') act(() => setView(v => ({ ...v, x: v.x - step })));
    else if (k === 'ArrowUp') act(() => setView(v => ({ ...v, y: v.y + step })));
    else if (k === 'ArrowDown') act(() => setView(v => ({ ...v, y: v.y - step })));
    else if (k === 'f' || k === 'F') act(() => setFlipped(v => !v));
    else if (k === ' ') act(() => setSwimming(v => !v));
    else if (k === 'm' || k === 'M') act(() => setTool(t => t === 'measure' ? 'pan' : 'measure'));
    else if (k === 'l' || k === 'L') act(() => chooseLens(LENSES[(LENSES.findIndex(l => l.id === lens) + 1) % LENSES.length].id));
    else if (k === 'Escape' && ruler) act(() => setRuler(null));
  }

  function takePhoto() {
    const k = Math.max(1, 1600 / size.w), W = Math.round(size.w * k), H = Math.round(size.h * k), plate = Math.round(140 * k / 1.6);
    const out = document.createElement('canvas'); out.width = W; out.height = H + plate;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    const s = scene.current;
    paintScene(ctx, { ...s, dpr: 1, w: W, h: H, layout: layoutFor(subjects, W, H), view: { zoom: s.view.zoom, x: s.view.x * k, y: s.view.y * k }, ruler: s.ruler ? { a: { x: s.ruler.a.x * k, y: s.ruler.a.y * k }, b: { x: s.ruler.b.x * k, y: s.ruler.b.y * k } } : null }, { t: performance.now() / 1000, tail: performance.now() / 240, fin: performance.now() / 380 });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const g = ctx.createLinearGradient(0, H, 0, H + plate); g.addColorStop(0, '#0c1f2a'); g.addColorStop(1, '#050e14');
    ctx.fillStyle = g; ctx.fillRect(0, H, W, plate);
    ctx.fillStyle = '#5ef0d2'; ctx.fillRect(0, H, W, 3);
    const pad = Math.round(plate * 0.32);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.fillStyle = '#ecf7f5';
    ctx.font = `600 ${Math.round(plate * 0.34)}px Fraunces, Georgia, serif`; ctx.fillText(photo.title, pad, H + plate * 0.5);
    ctx.fillStyle = '#b6cecc'; ctx.font = `500 ${Math.round(plate * 0.15)}px "Instrument Sans", "Segoe UI", sans-serif`; ctx.fillText(photo.line, pad, H + plate * 0.78);
    ctx.textAlign = 'right'; ctx.fillStyle = '#e9c376'; ctx.font = `700 ${Math.round(plate * 0.12)}px "JetBrains Mono", Consolas, monospace`;
    ctx.fillText('FISHTANK · SPECIMEN STUDIO', W - pad, H + plate * 0.5);
    ctx.fillStyle = '#88a5a5'; ctx.fillText(`${LENSES.find(l => l.id === lens)!.label} lens · ${Math.round(view.zoom * 100)}%`, W - pad, H + plate * 0.78);
    out.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = `${photo.title.replace(/[^\w-]+/g, '-').toLowerCase()}-${fish.id.toLowerCase()}.png`; a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      onAnnounce?.('Photo saved to your downloads.');
    }, 'image/png');
  }

  const bar = !layout.slots[0].egg ? scaleBar(1 / (layout.pxPerCm * view.zoom)) : null;
  const egg = layout.slots[0].egg !== null;
  const lensInfo = LENSES.find(l => l.id === lens)!;
  const growthValue = growth ?? today;
  const label = `${fish.name} in the specimen studio, ${lensInfo.label} lens, ${Math.round(view.zoom * 100)}% zoom${compare ? `, beside ${compareCaption}` : ''}.`;

  return <div className={`studio-stage lens-${lens} tool-${tool} ${dragging ? 'dragging' : ''}`} ref={wrap} tabIndex={0} role="group" aria-roledescription="specimen stage"
    aria-label="Specimen stage. Drag to pan, scroll or pinch to zoom, double-click to zoom in. Keys: plus and minus zoom, 0 resets, arrows pan, F flips, Space freezes, M measures, L changes the lens."
    onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key}
    onDoubleClick={event => { if ((event.target as HTMLElement).closest('button, input, label')) return; const p = local(event); setView(v => zoomAt(v, event.shiftKey ? 0.5 : 2, p.x, p.y)); }}>
    <canvas ref={canvas} className="studio-canvas" role="img" aria-label={label} style={{ width: size.w, height: size.h }} />

    <div className="studio-hud top-left">
      <div className="studio-growth" role="group" aria-label="Life stage preview">
        <span className="studio-hud-title"><Icon name="clock" size={13} />Life stage</span>
        <span className="studio-growth-track"><input type="range" min={0.06} max={1} step={0.01} value={Math.max(0.06, growthValue)} aria-label="Preview growth, as a share of adult length"
          aria-valuetext={growth === null ? 'Today' : `${Math.round(growthValue * 100)}% of adult length`} onChange={event => setGrowth(Number(event.target.value))} />
          <span className="studio-growth-today" style={{ '--p': (Math.max(0.06, today) - 0.06) / 0.94 } as CSSProperties} aria-hidden="true" /></span>
        <span className="studio-growth-actions">
          <button className="btn-sm quiet" aria-pressed={growth !== null && growth <= 0.07} onClick={() => setGrowth(0.06)}>Hatchling</button>
          <button className="btn-sm quiet" aria-pressed={growth === null} onClick={() => setGrowth(null)}>Today</button>
          <button className="btn-sm quiet" aria-pressed={growth === 1} onClick={() => setGrowth(1)}>Adult</button>
        </span>
        <small>{growth === null ? (egg ? `Egg · hatches in ${Math.max(0, INCUBATION_DAYS - fish.life.ageDays)} day${INCUBATION_DAYS - fish.life.ageDays === 1 ? '' : 's'}` : `Today · ${formatCm(fish.life.lengthCm)}`) : `Preview · ${formatCm(Math.max(HATCH_LENGTH_CM, growthValue * potential.adultLengthCm))} of ${formatCm(potential.adultLengthCm)}`}</small>
      </div>
    </div>

    <div className="studio-hud top-right">
      <div className="segmented studio-lenses" role="group" aria-label="Lens">
        {LENSES.map(l => <button key={l.id} aria-pressed={lens === l.id} onClick={() => chooseLens(l.id)} aria-label={`${l.label} lens`}><Icon name={l.icon} size={14} /><span>{l.label}</span></button>)}
      </div>
      <span className="studio-lens-note">{lensInfo.blurb}</span>
    </div>

    {bar ? <div className="studio-hud bottom-left studio-scale" aria-label={`Scale bar: ${formatCm(bar.cm)}`}>
      <span className="studio-scale-bar" style={{ width: bar.px }} /><span>{formatCm(bar.cm)}</span>
    </div> : null}

    <div className="studio-toolbar" role="toolbar" aria-label="Stage tools">
      <div className="segmented" role="group" aria-label="Pointer tool">
        <button aria-pressed={tool === 'pan'} onClick={() => setTool('pan')} data-tip="Pan · drag the stage"><Icon name="move" size={14} /><span>Pan</span></button>
        <button aria-pressed={tool === 'measure'} onClick={() => setTool('measure')} data-tip="Ruler · drag to measure in cm (M)"><Icon name="scale" size={14} /><span>Ruler</span></button>
      </div>
      {ruler ? <button className="btn-sm quiet" onClick={() => setRuler(null)} data-tip="Clear the ruler (Esc)"><Icon name="close" size={13} />Clear</button> : null}
      <span className="studio-tool-sep" aria-hidden="true" />
      <button className="icon-button btn-sm quiet" aria-pressed={!swimming} onClick={() => setSwimming(v => !v)} aria-label={swimming ? 'Freeze pose' : 'Resume swimming'} data-tip={swimming ? 'Freeze pose (Space)' : 'Swim (Space)'}><Icon name={swimming ? 'pause' : 'play'} size={15} /></button>
      <button className="icon-button btn-sm quiet" aria-pressed={flipped} onClick={() => setFlipped(v => !v)} aria-label="Flip facing" data-tip="Flip facing (F)"><Icon name="flip" size={15} /></button>
      <span className="studio-tool-sep" aria-hidden="true" />
      <div className="studio-zoom" role="group" aria-label="Zoom">
        <button className="icon-button btn-sm quiet" onClick={() => zoomBy(0.8)} disabled={view.zoom <= MIN_ZOOM + 1e-6} aria-label="Zoom out" data-tip="Zoom out (−)"><Icon name="minus" size={15} /></button>
        <button className="btn-sm quiet studio-zoom-value mono" onClick={reset} data-tip="Fit (0)" aria-label={`Zoom ${Math.round(view.zoom * 100)}%. Reset to fit`}>{Math.round(view.zoom * 100)}%</button>
        <button className="icon-button btn-sm quiet" onClick={() => zoomBy(1.25)} disabled={view.zoom >= MAX_ZOOM - 1e-6} aria-label="Zoom in" data-tip="Zoom in (+)"><Icon name="plus" size={15} /></button>
      </div>
      <span className="studio-tool-sep" aria-hidden="true" />
      <button className="btn-sm brass-outline studio-photo" onClick={takePhoto} data-tip="Save this view as a PNG specimen plate"><Icon name="download" size={14} /><span>Photo</span></button>
    </div>
  </div>;
});
