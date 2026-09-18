import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AXOLOTL_SHAPE,
  axolotlContainsPoint,
  axolotlPortraitFrame,
  axolotlShapeFromPhenotype,
  axolotlSilhouettePoints,
  buildAxolotlAnatomy,
  sanitizeAxolotlShape,
  validateAxolotlAnatomy,
  type AxolotlRenderPhenotype,
  type AxolotlShape,
  type AxolotlShapeInput,
  type AxolotlVec,
} from '../src/core/axolotlAnatomy';
import { hash, random } from '../src/core/random';
import { drawAxolotl } from '../src/rendering/axolotl';

const distance = (a: AxolotlVec, b: AxolotlVec) => Math.hypot(a.x - b.x, a.y - b.y);
const nearest = (points: readonly AxolotlVec[], x: number) => points.reduce((best, p) => Math.abs(p.x - x) < Math.abs(best.x - x) ? p : best);

type RecordEntry = { op: string; args: unknown[] };

class RecordingGradient {
  constructor(private readonly records: RecordEntry[]) {}
  addColorStop(offset: number, color: string) { this.records.push({ op: 'gradient-stop', args: [offset, color] }); }
}

class RecordingContext {
  records: RecordEntry[] = [];
  globalAlpha = 1;
  fillStyle: string | CanvasGradient = '#000';
  strokeStyle: string | CanvasGradient = '#000';
  lineWidth = 1;
  lineCap: CanvasLineCap = 'butt';
  lineJoin: CanvasLineJoin = 'miter';
  private add(op: string, ...args: unknown[]) { this.records.push({ op, args }); }
  save() { this.add('save'); }
  restore() { this.add('restore'); }
  beginPath() { this.add('beginPath'); }
  closePath() { this.add('closePath'); }
  moveTo(x: number, y: number) { this.add('moveTo', x, y); }
  lineTo(x: number, y: number) { this.add('lineTo', x, y); }
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number) { this.add('quadraticCurveTo', cpx, cpy, x, y); }
  arc(x: number, y: number, r: number, start: number, end: number) { this.add('arc', x, y, r, start, end); }
  ellipse(x: number, y: number, rx: number, ry: number, rotation: number, start: number, end: number) { this.add('ellipse', x, y, rx, ry, rotation, start, end); }
  fill() { this.add('fill', String(this.fillStyle), this.globalAlpha); }
  stroke() { this.add('stroke', String(this.strokeStyle), this.lineWidth, this.globalAlpha); }
  clip() { this.add('clip'); }
  fillRect(x: number, y: number, width: number, height: number) { this.add('fillRect', x, y, width, height); }
  createLinearGradient(x0: number, y0: number, x1: number, y1: number) {
    this.add('createLinearGradient', x0, y0, x1, y1);
    return new RecordingGradient(this.records) as unknown as CanvasGradient;
  }
}

const drawRecords = (shape: AxolotlShapeInput, seed: number, time = 2.75) => {
  const fake = new RecordingContext();
  drawAxolotl(fake as unknown as CanvasRenderingContext2D, shape, seed, 120, time);
  return fake.records;
};

describe('standalone axolotl anatomy', () => {
  it('builds a recognizable broad-headed salamander with four limbs, toes, feathery gills and a long finned tail', () => {
    const a = buildAxolotlAnatomy(DEFAULT_AXOLOTL_SHAPE);
    expect(validateAxolotlAnatomy(a)).toEqual([]);
    expect(a.shape.species).toBe('axolotl');
    expect(a.limbs).toHaveLength(4);
    expect(a.limbs.filter(l => l.kind === 'fore')).toHaveLength(2);
    expect(a.limbs.filter(l => l.kind === 'hind')).toHaveLength(2);
    expect(a.limbs.filter(l => l.kind === 'fore').every(l => l.toes.length === 4)).toBe(true);
    expect(a.limbs.filter(l => l.kind === 'hind').every(l => l.toes.length === 5)).toBe(true);
    expect(a.gills).toHaveLength(6);
    expect(a.gills.every(g => g.fronds.length >= 8)).toBe(true);

    const headDepth = nearest(a.bottom, -0.38).y - nearest(a.top, -0.38).y;
    const torsoDepth = nearest(a.bottom, 0.18).y - nearest(a.top, 0.18).y;
    expect(headDepth).toBeGreaterThan(torsoDepth * 1.25);
    expect(a.top.at(-1)!.x - a.top[0].x).toBeGreaterThan(1.7);
    expect(a.dorsalFin.at(-1)).toEqual(a.top.at(-1));
    expect(a.ventralFin.at(-1)).toEqual(a.bottom.at(-1));
    expect(axolotlContainsPoint(a, { x: -0.3, y: 0 })).toBe(true);
    expect(axolotlContainsPoint(a, a.gills.find(g => g.side === 'near')!.stalk.end, 0.02)).toBe(true);
    expect(axolotlContainsPoint(a, { x: 3, y: 3 })).toBe(false);
  });

  it('keeps major morphology channels visibly independent rather than collapsing limbs, digits, tail, gills, head and eyes', () => {
    const small = buildAxolotlAnatomy({
      ...DEFAULT_AXOLOTL_SHAPE,
      bodyLength: 0, bodyWidth: 0, bodyDepth: 0, bodyRoundness: 0, bodyTaper: 0, bodyFlex: 0,
      headWidth: 0, headLength: 0, neckWidth: 0, snoutRoundness: 0, mouthWidth: 0, jawDepth: 0,
      forelimbLength: 0, hindlimbLength: 0, forelimbThickness: 0, hindlimbThickness: 0,
      forelimbSpread: 0, hindlimbSpread: 0, foreDigitLength: 0, hindDigitLength: 0,
      foreDigitCount: 2, hindDigitCount: 3,
      tailLength: 0, tailDepth: 0, tailTaper: 0, tailFin: 0, tailFinReach: 0, tailWave: 0,
      gillLength: 0, gillSpread: 0, gillThickness: 0, gillStalkCount: 2, gillBranchCount: 4, gillFrondDensity: 0, gillFilamentLength: 0,
      eyeSize: 0, eyeSpacing: 0, eyeLift: 0, pupilRatio: 0,
    });
    const large = buildAxolotlAnatomy({
      ...DEFAULT_AXOLOTL_SHAPE,
      bodyLength: 1, bodyWidth: 1, bodyDepth: 1, bodyRoundness: 1, bodyTaper: 1, bodyFlex: 1,
      headWidth: 1, headLength: 1, neckWidth: 1, snoutRoundness: 1, mouthWidth: 1, jawDepth: 1,
      forelimbLength: 1, hindlimbLength: 1, forelimbThickness: 1, hindlimbThickness: 1,
      forelimbSpread: 1, hindlimbSpread: 1, foreDigitLength: 1, hindDigitLength: 1,
      foreDigitCount: 7, hindDigitCount: 6,
      tailLength: 1, tailDepth: 1, tailTaper: 1, tailFin: 1, tailFinReach: 1, tailWave: 1,
      gillLength: 1, gillSpread: 1, gillThickness: 1, gillStalkCount: 5, gillBranchCount: 15, gillFrondDensity: 1, gillFilamentLength: 1,
      eyeSize: 1, eyeSpacing: 1, eyeLift: 1, pupilRatio: 1,
    });

    const foreSmall = small.limbs.find(l => l.kind === 'fore' && l.side === 'near')!;
    const foreLarge = large.limbs.find(l => l.kind === 'fore' && l.side === 'near')!;
    const hindSmall = small.limbs.find(l => l.kind === 'hind' && l.side === 'near')!;
    const hindLarge = large.limbs.find(l => l.kind === 'hind' && l.side === 'near')!;
    expect(distance(foreLarge.root, foreLarge.hand)).toBeGreaterThan(distance(foreSmall.root, foreSmall.hand) * 1.3);
    expect(distance(hindLarge.root, hindLarge.hand)).toBeGreaterThan(distance(hindSmall.root, hindSmall.hand) * 1.25);
    expect(foreLarge.width).toBeGreaterThan(foreSmall.width);
    expect(hindLarge.width).toBeGreaterThan(hindSmall.width);
    expect(foreSmall.toes).toHaveLength(2);
    expect(foreLarge.toes).toHaveLength(7);
    expect(hindSmall.toes).toHaveLength(3);
    expect(hindLarge.toes).toHaveLength(6);
    expect(large.top.at(-1)!.x).toBeGreaterThan(small.top.at(-1)!.x + 0.4);
    expect(Math.min(...large.dorsalFin.map(v => v.y))).toBeLessThan(Math.min(...small.dorsalFin.map(v => v.y)) - 0.08);
    expect(large.dorsalFin[0].x).toBeLessThan(small.dorsalFin[0].x - 0.15);
    expect(large.gills).toHaveLength(10);
    expect(small.gills).toHaveLength(4);
    expect(distance(large.gills[0].stalk.start, large.gills[0].stalk.end)).toBeGreaterThan(distance(small.gills[0].stalk.start, small.gills[0].stalk.end));
    expect(large.gills[0].fronds.length).toBeGreaterThan(small.gills[0].fronds.length);
    expect(large.eye.radius).toBeGreaterThan(small.eye.radius);
    expect(large.eye.pupilRadius / large.eye.radius).toBeGreaterThan(small.eye.pupilRadius / small.eye.radius);
    expect(nearest(large.bottom, -0.38).y - nearest(large.top, -0.38).y).toBeGreaterThan(nearest(small.bottom, -0.38).y - nearest(small.top, -0.38).y);
    const shortBody = buildAxolotlAnatomy({ ...DEFAULT_AXOLOTL_SHAPE, bodyLength: 0, tailLength: 0.5 });
    const longBody = buildAxolotlAnatomy({ ...DEFAULT_AXOLOTL_SHAPE, bodyLength: 1, tailLength: 0.5 });
    expect(longBody.top.at(-1)!.x).toBeGreaterThan(shortBody.top.at(-1)!.x + 0.14);
    const narrowBody = buildAxolotlAnatomy({ ...DEFAULT_AXOLOTL_SHAPE, bodyWidth: 0, bodyDepth: 0.5 });
    const wideBody = buildAxolotlAnatomy({ ...DEFAULT_AXOLOTL_SHAPE, bodyWidth: 1, bodyDepth: 0.5 });
    expect(nearest(wideBody.bottom, 0.15).y - nearest(wideBody.top, 0.15).y).toBeGreaterThan(nearest(narrowBody.bottom, 0.15).y - nearest(narrowBody.top, 0.15).y);
  });

  it('sanitizes malformed inputs and keeps thousands of seeded morphology extremes finite and bounded', () => {
    const malformed = sanitizeAxolotlShape({
      ...DEFAULT_AXOLOTL_SHAPE,
      length: Number.POSITIVE_INFINITY,
      headWidth: Number.NaN,
      tailLength: -900,
      foreDigitCount: 100,
      hindDigitCount: -10,
      gillStalkCount: Number.NaN,
    });
    expect(malformed.length).toBe(DEFAULT_AXOLOTL_SHAPE.length);
    expect(malformed.headWidth).toBe(DEFAULT_AXOLOTL_SHAPE.headWidth);
    expect(malformed.tailLength).toBe(0);
    expect(malformed.foreDigitCount).toBe(7);
    expect(malformed.hindDigitCount).toBe(2);
    expect(malformed.gillStalkCount).toBe(DEFAULT_AXOLOTL_SHAPE.gillStalkCount);

    const rng = random(hash('axolotl-anatomy-extremes'));
    const failures: string[][] = [];
    for (let i = 0; i < 1200; i++) {
      const bit = () => rng() < 0.5 ? 0 : 1;
      const p: AxolotlShape = {
        ...DEFAULT_AXOLOTL_SHAPE,
        length: rng() < 0.5 ? 0.55 : 1.55,
        bodyLength: bit(), bodyWidth: bit(), bodyDepth: bit(), bodyRoundness: bit(), bodyTaper: bit(), bodyFlex: bit(),
        headWidth: bit(), headLength: bit(), neckWidth: bit(), snoutRoundness: bit(), mouthWidth: bit(), jawDepth: bit(),
        forelimbLength: bit(), hindlimbLength: bit(), forelimbThickness: bit(), hindlimbThickness: bit(),
        forelimbSpread: bit(), hindlimbSpread: bit(), foreDigitLength: bit(), hindDigitLength: bit(),
        foreDigitCount: 2 + Math.floor(rng() * 6), hindDigitCount: 2 + Math.floor(rng() * 6), digitSpread: bit(),
        tailLength: bit(), tailDepth: bit(), tailTaper: bit(), tailFin: bit(), tailFinReach: bit(), tailWave: bit(),
        gillLength: bit(), gillSpread: bit(), gillThickness: bit(), gillStalkCount: 2 + Math.floor(rng() * 4),
        gillBranchCount: 4 + Math.floor(rng() * 12), gillFrondDensity: bit(), gillFilamentLength: bit(),
        eyeSize: bit(), eyeSpacing: bit(), eyeLift: bit(), pupilRatio: bit(), mouthCurve: bit(),
      };
      const a = buildAxolotlAnatomy(p);
      const problems = validateAxolotlAnatomy(a);
      if (problems.length) failures.push(problems);
      expect(axolotlSilhouettePoints(a).every(v => Number.isFinite(v.x) && Number.isFinite(v.y))).toBe(true);
      const frame = axolotlPortraitFrame(p, 320, 180);
      expect([frame.originX, frame.originY, frame.pixelsPerABL, frame.size].every(Number.isFinite)).toBe(true);
      expect(frame.pixelsPerABL).toBeGreaterThan(0);
    }
    expect(failures).toEqual([]);
  });

  it('adapts the standalone genetics phenotype contract without importing or reusing koi phenotype semantics', () => {
    const phenotype: AxolotlRenderPhenotype = {
      species: 'axolotl', model: 1, adultLengthCm: 31,
      morphology: {
        body: { length: 1.14, width: 0.34, depth: 0.25, taper: 0.6, flex: 0.1, mass: 1.24 },
        head: { width: 0.38, length: 0.24, snoutRoundness: 0.88, mouthWidth: 0.22, jawDepth: 0.1, neckWidth: 0.27 },
        limbs: { foreLength: 0.23, hindLength: 0.27, thickness: 0.062, digitLength: 0.08, digitSpread: 0.92, frontDigits: 5, rearDigits: 6 },
        tail: { length: 0.81, height: 0.34, taper: 0.74, finHeight: 0.22, finReach: 0.91, wave: 0.13 },
        gills: { stalkLength: 0.23, branchCount: 14, filamentLength: 0.12, angleDeg: 69, saturation: 0.9, oxygenEfficiency: 1.2 },
        eyes: { size: 0.054, spacing: 0.26, height: 0.64, pupilRatio: 0.74 },
      },
      pigmentation: {
        melanin: 0.18, iridophore: 0.82, iridescence: 0.9, translucency: 0.32, skinLuster: 0.84, texture: 'fine pebbled',
        bodyColor: { h: 286, s: 0.42, l: 0.74 }, gillColor: { h: 350, s: 0.88, l: 0.62 }, irisColor: { h: 210, s: 0.64, l: 0.52 },
      },
      pattern: { modes: ['dappled', 'marbled'], density: 0.82, scale: 0.17, contrast: 0.9, edge: 0.8, symmetry: 0.76, seed: 0xabc123 },
    };
    const shape = axolotlShapeFromPhenotype(phenotype);
    expect(shape.species).toBe('axolotl');
    expect(shape.foreDigitCount).toBe(5);
    expect(shape.hindDigitCount).toBe(6);
    expect(shape.gillBranchCount).toBe(14);
    expect(shape.pattern).toBe('dappled');
    expect(shape.patternSecondary).toBe('marbled');
    expect(shape.patternSeed).toBe(0xabc123);
    expect(shape.baseColor).toMatch(/^hsl\(/);
    expect(shape.pupilRatio).toBeCloseTo(0.74, 6);
    const a = buildAxolotlAnatomy(phenotype);
    expect(validateAxolotlAnatomy(a)).toEqual([]);
    expect(a.gills[0].fronds).toHaveLength(28);
    expect(drawRecords(phenotype, 712).length).toBeGreaterThan(300);
  });
});

describe('standalone axolotl Canvas renderer', () => {
  it('emits deterministic seeded drawing commands and seed-dependent pigment placement', () => {
    const shape: AxolotlShape = {
      ...DEFAULT_AXOLOTL_SHAPE,
      pattern: 'mottled',
      patternStrength: 0.9,
      speckleDensity: 0.8,
      iridophore: 0.75,
      foreDigitCount: 6,
      hindDigitCount: 7,
      gillStalkCount: 4,
      gillFrondDensity: 1,
    };
    const first = drawRecords(shape, 40817);
    const repeat = drawRecords(shape, 40817);
    const sibling = drawRecords(shape, 40818);
    expect(repeat).toEqual(first);
    expect(sibling).not.toEqual(first);
    expect(first.filter(r => r.op === 'quadraticCurveTo').length).toBeGreaterThan(100);
    expect(first.filter(r => r.op === 'ellipse').length).toBeGreaterThan(5);
    expect(first.some(r => r.op === 'clip')).toBe(true);
  });

  it('never sends non-finite geometry to Canvas even with corrupt shape values and non-finite draw parameters', () => {
    const records = drawRecords({
      ...DEFAULT_AXOLOTL_SHAPE,
      headWidth: Number.NaN,
      bodyDepth: Number.POSITIVE_INFINITY,
      forelimbLength: Number.NEGATIVE_INFINITY,
      tailLength: Number.NaN,
      gillLength: Number.POSITIVE_INFINITY,
      eyeSize: Number.NaN,
      pattern: 'freckled',
      iridophore: 1,
    }, 99, Number.NaN);
    const numeric = records.flatMap(r => r.args).filter((v): v is number => typeof v === 'number');
    expect(numeric.length).toBeGreaterThan(200);
    expect(numeric.every(Number.isFinite)).toBe(true);
  });
});
