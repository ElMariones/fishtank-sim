/**
 * Standalone axolotl anatomy contract and pure geometry builder.
 *
 * This module intentionally does not import koi phenotype/genome types. Future species dispatch can adapt an
 * axolotl phenotype into `AxolotlShape` and call the renderer without giving axolotl genetics koi semantics.
 * Coordinates use axolotl body-length units (ABL): the origin is near the shoulder, +x points toward the tail,
 * +y is ventral (canvas down). All public numeric shape fields are sanitized before geometry is constructed.
 */

export const AXOLOTL_ANATOMY_VERSION = 2 as const;
export const AXOLOTL_TAIL_WAVE = 0.085;

export type AxolotlVec = { x: number; y: number };
export type AxolotlCurve = { start: AxolotlVec; control: AxolotlVec; end: AxolotlVec };
export type AxolotlBounds = { minX: number; maxX: number; minY: number; maxY: number };
export type AxolotlPattern = 'solid' | 'speckled' | 'spotted' | 'mottled' | 'dappled' | 'marbled' | 'saddled' | 'piebald' | 'freckled';
export type AxolotlRenderColor = { h: number; s: number; l: number };

/** Structural subset of the standalone genetics phenotype; kept local so rendering does not import genetics code. */
export type AxolotlRenderPhenotype = {
  species?: 'axolotl';
  model?: number;
  adultLengthCm: number;
  morphology: {
    body: { length: number; width: number; depth: number; taper: number; flex: number; mass: number };
    head: { width: number; length: number; snoutRoundness: number; mouthWidth: number; jawDepth: number; neckWidth: number };
    limbs: { foreLength: number; hindLength: number; thickness: number; digitLength: number; digitSpread: number; frontDigits: number; rearDigits: number };
    tail: { length: number; height: number; taper: number; finHeight: number; finReach: number; wave: number };
    gills: { stalkLength: number; branchCount: number; filamentLength: number; angleDeg: number; saturation: number; oxygenEfficiency: number };
    eyes: { size: number; spacing: number; height: number; pupilRatio: number };
  };
  pigmentation: {
    melanin: number; iridophore: number; iridescence: number; translucency: number; skinLuster: number; texture: string;
    bodyColor: AxolotlRenderColor; gillColor: AxolotlRenderColor; irisColor: AxolotlRenderColor;
  };
  pattern: { modes: string[]; density: number; scale: number; contrast: number; edge: number; symmetry: number; seed: number };
};

/**
 * Generic renderer-facing phenotype. Values are deliberately species-local rather than aliases of koi loci.
 * Most morphology channels are normalized 0..1; `length` is a bounded display-length multiplier.
 */
export type AxolotlShape = {
  species: 'axolotl';
  length: number;
  bodyLength: number;
  bodyWidth: number;
  bodyDepth: number;
  bodyRoundness: number;
  bodyTaper: number;
  bodyFlex: number;
  headWidth: number;
  headLength: number;
  neckWidth: number;
  snoutRoundness: number;
  mouthWidth: number;
  jawDepth: number;
  forelimbLength: number;
  hindlimbLength: number;
  forelimbThickness: number;
  hindlimbThickness: number;
  forelimbSpread: number;
  hindlimbSpread: number;
  foreDigitLength: number;
  hindDigitLength: number;
  foreDigitCount: number;
  hindDigitCount: number;
  digitSpread: number;
  tailLength: number;
  tailDepth: number;
  tailTaper: number;
  tailFin: number;
  tailFinReach: number;
  tailWave: number;
  gillLength: number;
  gillSpread: number;
  gillThickness: number;
  gillStalkCount: number;
  gillBranchCount: number;
  gillFrondDensity: number;
  gillFilamentLength: number;
  eyeSize: number;
  eyeSpacing: number;
  eyeLift: number;
  pupilRatio: number;
  mouthCurve: number;
  baseColor: string;
  secondaryColor: string;
  accentColor: string;
  gillColor: string;
  eyeColor: string;
  pattern: AxolotlPattern;
  patternSecondary: AxolotlPattern | null;
  patternSeed: number;
  patternStrength: number;
  speckleDensity: number;
  patternScale: number;
  patternEdge: number;
  patternSymmetry: number;
  iridophore: number;
  translucency: number;
  melanin: number;
  texture: number;
  skinLuster: number;
};

export const DEFAULT_AXOLOTL_SHAPE: Readonly<AxolotlShape> = Object.freeze({
  species: 'axolotl',
  length: 1,
  bodyLength: 0.5,
  bodyWidth: 0.5,
  bodyDepth: 0.5,
  bodyRoundness: 0.58,
  bodyTaper: 0.5,
  bodyFlex: 0.5,
  headWidth: 0.68,
  headLength: 0.56,
  neckWidth: 0.5,
  snoutRoundness: 0.72,
  mouthWidth: 0.5,
  jawDepth: 0.5,
  forelimbLength: 0.5,
  hindlimbLength: 0.62,
  forelimbThickness: 0.46,
  hindlimbThickness: 0.52,
  forelimbSpread: 0.48,
  hindlimbSpread: 0.54,
  foreDigitLength: 0.46,
  hindDigitLength: 0.54,
  foreDigitCount: 4,
  hindDigitCount: 5,
  digitSpread: 0.56,
  tailLength: 0.62,
  tailDepth: 0.54,
  tailTaper: 0.6,
  tailFin: 0.64,
  tailFinReach: 0.65,
  tailWave: 0.5,
  gillLength: 0.68,
  gillSpread: 0.62,
  gillThickness: 0.58,
  gillStalkCount: 3,
  gillBranchCount: 9,
  gillFrondDensity: 0.72,
  gillFilamentLength: 0.62,
  eyeSize: 0.5,
  eyeSpacing: 0.5,
  eyeLift: 0.56,
  pupilRatio: 0.58,
  mouthCurve: 0.54,
  baseColor: '#d8a99b',
  secondaryColor: '#b77f78',
  accentColor: '#7d5552',
  gillColor: '#a43f55',
  eyeColor: '#24191a',
  pattern: 'speckled',
  patternSecondary: null,
  patternSeed: 0,
  patternStrength: 0.36,
  speckleDensity: 0.42,
  patternScale: 0.45,
  patternEdge: 0.4,
  patternSymmetry: 0.5,
  iridophore: 0.18,
  translucency: 0.12,
  melanin: 0.34,
  texture: 0.38,
  skinLuster: 0.35,
});

const PATTERNS = new Set<AxolotlPattern>(['solid', 'speckled', 'spotted', 'mottled', 'dappled', 'marbled', 'saddled', 'piebald', 'freckled']);
const finite = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback;
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const unit = (value: number, fallback: number) => clamp(finite(value, fallback));
const integer = (value: number, fallback: number, min: number, max: number) => Math.round(clamp(finite(value, fallback), min, max));
const color = (value: string, fallback: string) => typeof value === 'string' && value.trim().length ? value : fallback;
const unsigned = (value: number, fallback: number) => Number.isFinite(value) ? value >>> 0 : fallback >>> 0;

/** Sanitize untrusted/adapted phenotype data into the finite range the anatomy model supports. */
export function sanitizeAxolotlShape(input: Partial<AxolotlShape>): AxolotlShape {
  const d = DEFAULT_AXOLOTL_SHAPE;
  return {
    species: 'axolotl',
    length: clamp(finite(input.length ?? d.length, d.length), 0.55, 1.55),
    bodyLength: unit(input.bodyLength ?? d.bodyLength, d.bodyLength),
    bodyWidth: unit(input.bodyWidth ?? d.bodyWidth, d.bodyWidth),
    bodyDepth: unit(input.bodyDepth ?? d.bodyDepth, d.bodyDepth),
    bodyRoundness: unit(input.bodyRoundness ?? d.bodyRoundness, d.bodyRoundness),
    bodyTaper: unit(input.bodyTaper ?? d.bodyTaper, d.bodyTaper),
    bodyFlex: unit(input.bodyFlex ?? d.bodyFlex, d.bodyFlex),
    headWidth: unit(input.headWidth ?? d.headWidth, d.headWidth),
    headLength: unit(input.headLength ?? d.headLength, d.headLength),
    neckWidth: unit(input.neckWidth ?? d.neckWidth, d.neckWidth),
    snoutRoundness: unit(input.snoutRoundness ?? d.snoutRoundness, d.snoutRoundness),
    mouthWidth: unit(input.mouthWidth ?? d.mouthWidth, d.mouthWidth),
    jawDepth: unit(input.jawDepth ?? d.jawDepth, d.jawDepth),
    forelimbLength: unit(input.forelimbLength ?? d.forelimbLength, d.forelimbLength),
    hindlimbLength: unit(input.hindlimbLength ?? d.hindlimbLength, d.hindlimbLength),
    forelimbThickness: unit(input.forelimbThickness ?? d.forelimbThickness, d.forelimbThickness),
    hindlimbThickness: unit(input.hindlimbThickness ?? d.hindlimbThickness, d.hindlimbThickness),
    forelimbSpread: unit(input.forelimbSpread ?? d.forelimbSpread, d.forelimbSpread),
    hindlimbSpread: unit(input.hindlimbSpread ?? d.hindlimbSpread, d.hindlimbSpread),
    foreDigitLength: unit(input.foreDigitLength ?? d.foreDigitLength, d.foreDigitLength),
    hindDigitLength: unit(input.hindDigitLength ?? d.hindDigitLength, d.hindDigitLength),
    foreDigitCount: integer(input.foreDigitCount ?? d.foreDigitCount, d.foreDigitCount, 2, 7),
    hindDigitCount: integer(input.hindDigitCount ?? d.hindDigitCount, d.hindDigitCount, 2, 7),
    digitSpread: unit(input.digitSpread ?? d.digitSpread, d.digitSpread),
    tailLength: unit(input.tailLength ?? d.tailLength, d.tailLength),
    tailDepth: unit(input.tailDepth ?? d.tailDepth, d.tailDepth),
    tailTaper: unit(input.tailTaper ?? d.tailTaper, d.tailTaper),
    tailFin: unit(input.tailFin ?? d.tailFin, d.tailFin),
    tailFinReach: unit(input.tailFinReach ?? d.tailFinReach, d.tailFinReach),
    tailWave: unit(input.tailWave ?? d.tailWave, d.tailWave),
    gillLength: unit(input.gillLength ?? d.gillLength, d.gillLength),
    gillSpread: unit(input.gillSpread ?? d.gillSpread, d.gillSpread),
    gillThickness: unit(input.gillThickness ?? d.gillThickness, d.gillThickness),
    gillStalkCount: integer(input.gillStalkCount ?? d.gillStalkCount, d.gillStalkCount, 2, 5),
    gillBranchCount: integer(input.gillBranchCount ?? d.gillBranchCount, d.gillBranchCount, 4, 15),
    gillFrondDensity: unit(input.gillFrondDensity ?? d.gillFrondDensity, d.gillFrondDensity),
    gillFilamentLength: unit(input.gillFilamentLength ?? d.gillFilamentLength, d.gillFilamentLength),
    eyeSize: unit(input.eyeSize ?? d.eyeSize, d.eyeSize),
    eyeSpacing: unit(input.eyeSpacing ?? d.eyeSpacing, d.eyeSpacing),
    eyeLift: unit(input.eyeLift ?? d.eyeLift, d.eyeLift),
    pupilRatio: unit(input.pupilRatio ?? d.pupilRatio, d.pupilRatio),
    mouthCurve: unit(input.mouthCurve ?? d.mouthCurve, d.mouthCurve),
    baseColor: color(input.baseColor ?? d.baseColor, d.baseColor),
    secondaryColor: color(input.secondaryColor ?? d.secondaryColor, d.secondaryColor),
    accentColor: color(input.accentColor ?? d.accentColor, d.accentColor),
    gillColor: color(input.gillColor ?? d.gillColor, d.gillColor),
    eyeColor: color(input.eyeColor ?? d.eyeColor, d.eyeColor),
    pattern: PATTERNS.has(input.pattern as AxolotlPattern) ? input.pattern as AxolotlPattern : d.pattern,
    patternSecondary: input.patternSecondary && PATTERNS.has(input.patternSecondary) ? input.patternSecondary : null,
    patternSeed: unsigned(input.patternSeed ?? d.patternSeed, d.patternSeed),
    patternStrength: unit(input.patternStrength ?? d.patternStrength, d.patternStrength),
    speckleDensity: unit(input.speckleDensity ?? d.speckleDensity, d.speckleDensity),
    patternScale: unit(input.patternScale ?? d.patternScale, d.patternScale),
    patternEdge: unit(input.patternEdge ?? d.patternEdge, d.patternEdge),
    patternSymmetry: unit(input.patternSymmetry ?? d.patternSymmetry, d.patternSymmetry),
    iridophore: unit(input.iridophore ?? d.iridophore, d.iridophore),
    translucency: unit(input.translucency ?? d.translucency, d.translucency),
    melanin: unit(input.melanin ?? d.melanin, d.melanin),
    texture: unit(input.texture ?? d.texture, d.texture),
    skinLuster: unit(input.skinLuster ?? d.skinLuster, d.skinLuster),
  };
}

const norm = (value: number, min: number, max: number) => clamp((finite(value, (min + max) / 2) - min) / (max - min));
const hslCss = (c: AxolotlRenderColor, lightnessShift = 0, saturationScale = 1) => {
  const h = ((finite(c.h, 30) % 360) + 360) % 360;
  const s = clamp(finite(c.s, 0.3) * saturationScale) * 100;
  const l = clamp(finite(c.l, 0.5) + lightnessShift) * 100;
  return `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%)`;
};

const textureStrength = (name: string) => {
  const order = ['silken smooth', 'satin', 'fine pebbled', 'velvet', 'granular', 'ridged'];
  const index = order.indexOf(name);
  return index < 0 ? 0.35 : index / (order.length - 1);
};

const geneticPattern = (name: string | undefined): AxolotlPattern => {
  if (!name || name === 'plain') return 'solid';
  return PATTERNS.has(name as AxolotlPattern) ? name as AxolotlPattern : 'mottled';
};

/** Adapt the standalone genetics phenotype into the renderer contract without importing its module. */
export function axolotlShapeFromPhenotype(p: AxolotlRenderPhenotype): AxolotlShape {
  const m = p.morphology, pigment = p.pigmentation, modes = p.pattern.modes.map(geneticPattern).filter(mode => mode !== 'solid');
  const primary = modes[0] ?? 'solid', secondary = modes[1] ?? null;
  return sanitizeAxolotlShape({
    species: 'axolotl',
    length: clamp(finite(p.adultLengthCm, 25) / 25, 0.55, 1.55),
    bodyLength: norm(m.body.length, 0.78, 1.16),
    bodyWidth: norm(m.body.width, 0.18, 0.36),
    bodyDepth: norm(m.body.depth, 0.11, 0.27),
    bodyRoundness: norm(m.body.mass, 0.72, 1.3),
    bodyTaper: norm(m.body.taper, 0.16, 0.66),
    bodyFlex: norm(m.body.flex, -0.12, 0.12),
    headWidth: norm(m.head.width, 0.22, 0.4),
    headLength: norm(m.head.length, 0.13, 0.26),
    neckWidth: norm(m.head.neckWidth, 0.13, 0.29),
    snoutRoundness: norm(m.head.snoutRoundness, 0.18, 0.94),
    mouthWidth: norm(m.head.mouthWidth, 0.08, 0.24),
    jawDepth: norm(m.head.jawDepth, 0.035, 0.11),
    forelimbLength: norm(m.limbs.foreLength, 0.1, 0.25),
    hindlimbLength: norm(m.limbs.hindLength, 0.11, 0.28),
    forelimbThickness: norm(m.limbs.thickness, 0.022, 0.067),
    hindlimbThickness: norm(m.limbs.thickness, 0.022, 0.067),
    forelimbSpread: norm(m.limbs.digitSpread, 0.32, 0.98),
    hindlimbSpread: norm(m.limbs.digitSpread, 0.32, 0.98),
    foreDigitLength: norm(m.limbs.digitLength, 0.026, 0.086),
    hindDigitLength: norm(m.limbs.digitLength, 0.026, 0.086),
    foreDigitCount: m.limbs.frontDigits,
    hindDigitCount: m.limbs.rearDigits,
    digitSpread: norm(m.limbs.digitSpread, 0.32, 0.98),
    tailLength: norm(m.tail.length, 0.42, 0.84),
    tailDepth: norm(m.tail.height, 0.15, 0.37),
    tailTaper: norm(m.tail.taper, 0.22, 0.8),
    tailFin: norm(m.tail.finHeight, 0.05, 0.24),
    tailFinReach: norm(m.tail.finReach, 0.42, 0.95),
    tailWave: norm(m.tail.wave, -0.16, 0.16),
    gillLength: norm(m.gills.stalkLength, 0.07, 0.25),
    gillSpread: norm(m.gills.angleDeg, 18, 73),
    gillThickness: clamp(0.3 + norm(m.gills.branchCount, 4, 15) * 0.5),
    gillStalkCount: 3,
    gillBranchCount: m.gills.branchCount,
    gillFrondDensity: norm(m.gills.branchCount, 4, 15),
    gillFilamentLength: norm(m.gills.filamentLength, 0.025, 0.13),
    eyeSize: norm(m.eyes.size, 0.018, 0.058),
    eyeSpacing: norm(m.eyes.spacing, 0.13, 0.28),
    eyeLift: norm(m.eyes.height, 0.3, 0.68),
    pupilRatio: m.eyes.pupilRatio,
    mouthCurve: clamp((norm(m.head.mouthWidth, 0.08, 0.24) + norm(m.head.jawDepth, 0.035, 0.11)) / 2),
    baseColor: hslCss(pigment.bodyColor),
    secondaryColor: hslCss(pigment.bodyColor, -0.12, 0.9),
    accentColor: hslCss(pigment.bodyColor, -0.27, 0.72 + pigment.melanin * 0.28),
    gillColor: hslCss(pigment.gillColor),
    eyeColor: hslCss(pigment.irisColor),
    pattern: primary,
    patternSecondary: secondary,
    patternSeed: p.pattern.seed,
    patternStrength: p.pattern.contrast,
    speckleDensity: p.pattern.density,
    patternScale: norm(p.pattern.scale, 0.025, 0.195),
    patternEdge: p.pattern.edge,
    patternSymmetry: p.pattern.symmetry,
    iridophore: Math.max(pigment.iridophore, pigment.iridescence),
    translucency: pigment.translucency,
    melanin: pigment.melanin,
    texture: textureStrength(pigment.texture),
    skinLuster: pigment.skinLuster,
  });
}

export type AxolotlShapeInput = Partial<AxolotlShape> | AxolotlRenderPhenotype;

function shapeFrom(input: AxolotlShapeInput): AxolotlShape {
  return 'morphology' in input && 'pigmentation' in input && 'pattern' in input
    ? axolotlShapeFromPhenotype(input)
    : sanitizeAxolotlShape(input);
}

export type AxolotlLimb = {
  kind: 'fore' | 'hind';
  side: 'near' | 'far';
  root: AxolotlVec;
  joint: AxolotlVec;
  hand: AxolotlVec;
  toes: AxolotlCurve[];
  width: number;
};

export type AxolotlGill = {
  side: 'near' | 'far';
  index: number;
  stalk: AxolotlCurve;
  fronds: AxolotlCurve[];
  width: number;
};

export type AxolotlAnatomy = {
  version: typeof AXOLOTL_ANATOMY_VERSION;
  shape: AxolotlShape;
  /** Dorsal and ventral body outlines from broad snout through the muscular tail tip. */
  top: AxolotlVec[];
  bottom: AxolotlVec[];
  /** Membrane outlines are separate so translucent fins can be layered behind the body. */
  dorsalFin: AxolotlVec[];
  ventralFin: AxolotlVec[];
  limbs: AxolotlLimb[];
  gills: AxolotlGill[];
  eye: { center: AxolotlVec; radius: number; pupilRadius: number };
  mouth: AxolotlCurve;
  bounds: AxolotlBounds;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const point = (a: AxolotlVec, b: AxolotlVec, t: number): AxolotlVec => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });

function quad(a: AxolotlVec, c: AxolotlVec, b: AxolotlVec, count = 12): AxolotlVec[] {
  return Array.from({ length: count + 1 }, (_, i) => {
    const t = i / count, u = 1 - t;
    return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
  });
}

function cubic(a: AxolotlVec, c1: AxolotlVec, c2: AxolotlVec, b: AxolotlVec, count = 14): AxolotlVec[] {
  return Array.from({ length: count + 1 }, (_, i) => {
    const t = i / count, u = 1 - t;
    return {
      x: u ** 3 * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t ** 3 * b.x,
      y: u ** 3 * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t ** 3 * b.y,
    };
  });
}

function toesAt(hand: AxolotlVec, direction: number, count: number, scale: number, spread: number): AxolotlCurve[] {
  const half = (count - 1) / 2;
  return Array.from({ length: count }, (_, i) => {
    const offset = (i - half) / Math.max(half, 1);
    const angle = direction + offset * (0.32 + spread * 0.34);
    const length = scale * (1 - Math.abs(offset) * 0.16);
    const end = { x: hand.x + Math.cos(angle) * length, y: hand.y + Math.sin(angle) * length };
    const control = { x: lerp(hand.x, end.x, 0.55) + Math.sin(angle) * length * 0.08, y: lerp(hand.y, end.y, 0.55) - Math.cos(angle) * length * 0.08 };
    return { start: hand, control, end };
  });
}

function limb(kind: 'fore' | 'hind', side: 'near' | 'far', root: AxolotlVec, p: AxolotlShape): AxolotlLimb {
  const near = side === 'near', hind = kind === 'hind';
  const lengthChannel = hind ? p.hindlimbLength : p.forelimbLength;
  const thicknessChannel = hind ? p.hindlimbThickness : p.forelimbThickness;
  const spreadChannel = hind ? p.hindlimbSpread : p.forelimbSpread;
  const digitLengthChannel = hind ? p.hindDigitLength : p.foreDigitLength;
  const digitCount = hind ? p.hindDigitCount : p.foreDigitCount;
  const length = 0.10 + lengthChannel * 0.14 + (hind ? 0.025 : 0);
  const splay = (0.055 + spreadChannel * 0.075) * (near ? 1 : 0.85);
  const direction = hind ? 0.82 : 1.95;
  const joint = {
    x: root.x + (hind ? 0.55 : 0.35) * length + (near ? 0 : 0.065),
    y: root.y + splay + (near ? 0.03 : -0.015),
  };
  const hand = {
    x: joint.x + Math.cos(direction + (hind ? 0.2 : 0.4)) * length * 0.8,
    y: joint.y + length * 0.40,
  };
  const digit = 0.032 + digitLengthChannel * 0.06;
  return {
    kind, side, root, joint, hand,
    toes: toesAt(hand, hind ? 0.5 : 2.05, digitCount, digit, p.digitSpread),
    width: 0.018 + thicknessChannel * 0.030 + (near ? 0.006 : 0),
  };
}

function gill(side: 'near' | 'far', index: number, count: number, anchor: AxolotlVec, p: AxolotlShape): AxolotlGill {
  const far = side === 'far';
  const u = count <= 1 ? 0.5 : index / (count - 1);
  const halfFan = 0.55 + p.gillSpread * 0.45;
  const angle = -1.05 + (u - 0.5) * 2 * halfFan + (far ? -0.20 : 0.04);
  const length = (0.16 + p.gillLength * 0.24) * (far ? 0.90 : 1) * (1 - u * 0.12);
  const start = { x: anchor.x + (far ? 0.018 : 0), y: anchor.y + (u - 0.5) * 0.052 + (far ? 0.025 : 0) };
  const end = { x: start.x + Math.cos(angle) * length, y: start.y + Math.sin(angle) * length };
  const control = { x: lerp(start.x, end.x, 0.55) - Math.sin(angle) * 0.045, y: lerp(start.y, end.y, 0.55) + Math.cos(angle) * 0.045 };
  const stalk = { start, control, end };
  const frondCount = p.gillBranchCount;
  const frondScale = 0.027 + p.gillFilamentLength * 0.045;
  const fronds: AxolotlCurve[] = [];
  for (let i = 1; i <= frondCount; i++) {
    const t = 0.16 + i / (frondCount + 1) * 0.78;
    const center = { x: (1-t)**2*start.x + 2*(1-t)*t*control.x + t*t*end.x, y: (1-t)**2*start.y + 2*(1-t)*t*control.y + t*t*end.y };
    const tangent = Math.atan2((1-t)*(control.y-start.y)+t*(end.y-control.y), (1-t)*(control.x-start.x)+t*(end.x-control.x));
    const taper = Math.sin(t * Math.PI) * 0.75 + 0.22;
    for (const sign of [-1, 1]) {
      const a = tangent + sign * 1.04;
      const fl = frondScale * taper * (far ? 0.85 : 1);
      const tip = { x: center.x + Math.cos(a) * fl, y: center.y + Math.sin(a) * fl };
      const bend = point(center, tip, 0.58);
      bend.x -= Math.cos(tangent) * fl * 0.28; bend.y -= Math.sin(tangent) * fl * 0.28;
      fronds.push({ start: center, control: bend, end: tip });
    }
  }
  return { side, index, stalk, fronds, width: 0.010 + p.gillThickness * 0.017 };
}

function allAnatomyPoints(a: Omit<AxolotlAnatomy, 'bounds'>): AxolotlVec[] {
  return [
    ...a.top, ...a.bottom, ...a.dorsalFin, ...a.ventralFin,
    ...a.limbs.flatMap(l => [l.root, l.joint, l.hand, ...l.toes.flatMap(t => [t.start, t.control, t.end])]),
    ...a.gills.flatMap(g => [g.stalk.start, g.stalk.control, g.stalk.end, ...g.fronds.flatMap(f => [f.start, f.control, f.end])]),
    { x: a.eye.center.x - a.eye.radius, y: a.eye.center.y }, { x: a.eye.center.x + a.eye.radius, y: a.eye.center.y },
    { x: a.eye.center.x, y: a.eye.center.y - a.eye.radius }, { x: a.eye.center.x, y: a.eye.center.y + a.eye.radius },
    a.mouth.start, a.mouth.control, a.mouth.end,
  ];
}

/** Pure, deterministic side-profile anatomy for one sanitized axolotl phenotype. */
export function buildAxolotlAnatomy(input: AxolotlShapeInput): AxolotlAnatomy {
  const p = shapeFrom(input);
  const snoutX = -0.48 - p.headLength * 0.18;
  const headHalf = 0.17 + p.headWidth * 0.095;
  const torsoHalf = 0.095 + p.bodyDepth * 0.072 + p.bodyWidth * 0.028;
  const round = 0.7 + p.bodyRoundness * 0.3;
  const neckHalf = torsoHalf * (0.78 + p.neckWidth * 0.34);
  const neckX = -0.17;
  const tailBaseX = 0.4 + p.bodyLength * 0.16;
  const tailTipX = tailBaseX + 0.72 + p.tailLength * 0.48;
  const tailHalf = 0.085 + p.tailDepth * 0.095;
  const pedHalf = tailHalf * (0.96 - p.bodyTaper * 0.22);
  const flexY = (p.bodyFlex - 0.5) * 0.07;
  const tip = { x: tailTipX, y: flexY };

  const topHead = cubic(
    { x: snoutX, y: 0 },
    { x: snoutX, y: -headHalf * (0.64 + 0.08 * p.snoutRoundness) },
    { x: -0.39, y: -headHalf * (0.96 + 0.04 * p.snoutRoundness) },
    { x: neckX, y: -neckHalf },
  );
  const topTorso = cubic(
    { x: neckX, y: -neckHalf },
    { x: 0.05, y: -torsoHalf * round },
    { x: 0.34, y: -torsoHalf * (0.92 + p.bodyRoundness * 0.08) },
    { x: tailBaseX, y: -pedHalf + flexY * 0.18 },
  ).slice(1);
  const taper = 0.4 + p.tailTaper * 0.6;
  const topTail = cubic(
    { x: tailBaseX, y: -pedHalf + flexY * 0.18 },
    { x: lerp(tailBaseX, tailTipX, 0.28), y: -tailHalf * (0.72 + 0.2 * taper) + flexY * 0.38 },
    { x: tailTipX - 0.26, y: -(0.025 + p.tailDepth * 0.035) * taper + flexY * 0.78 },
    tip,
    18,
  ).slice(1);
  const top = [...topHead, ...topTorso, ...topTail];

  const bottomHead = cubic(
    { x: snoutX, y: 0 },
    { x: snoutX, y: headHalf * 0.62 },
    { x: -0.38, y: headHalf * (0.88 + p.jawDepth * 0.09) },
    { x: neckX, y: neckHalf },
  );
  const bottomTorso = cubic(
    { x: neckX, y: neckHalf },
    { x: 0.06, y: torsoHalf * (1.06 + p.bodyRoundness * 0.07) },
    { x: 0.34, y: torsoHalf * 0.9 },
    { x: tailBaseX, y: pedHalf * 0.92 + flexY * 0.18 },
  ).slice(1);
  const bottomTail = cubic(
    { x: tailBaseX, y: pedHalf * 0.92 + flexY * 0.18 },
    { x: lerp(tailBaseX, tailTipX, 0.32), y: tailHalf * (0.58 + 0.18 * taper) + flexY * 0.4 },
    { x: tailTipX - 0.24, y: (0.018 + p.tailDepth * 0.026) * taper + flexY * 0.8 },
    tip,
    18,
  ).slice(1);
  const bottom = [...bottomHead, ...bottomTorso, ...bottomTail];

  const fin = 0.04 + p.tailFin * 0.115;
  const finStart = 0.22 - p.tailFinReach * 0.2;
  const crest = { x: tailBaseX + 0.25, y: -tailHalf - fin + flexY * 0.24 };
  const dorsalFin = [
    ...cubic({ x: finStart, y: -torsoHalf * 0.9 },
      { x: finStart + 0.17, y: -torsoHalf * 0.9 },
      { x: tailBaseX, y: crest.y }, crest),
    ...cubic(crest, { x: tailTipX - 0.35, y: crest.y },
      { x: tailTipX - 0.035, y: -0.065 }, tip).slice(1),
  ];
  const ventralFin = cubic(
    { x: tailBaseX + 0.02, y: pedHalf * 0.82 + flexY * 0.2 },
    { x: tailBaseX + 0.29, y: tailHalf + fin * 0.85 + flexY * 0.45 },
    { x: tailTipX - 0.18, y: 0.07 + fin * 0.5 + flexY * 0.86 }, tip, 24);

  const limbs = [
    limb('fore', 'far', { x: -0.2, y: torsoHalf * 0.12 }, p),
    limb('hind', 'far', { x: 0.31, y: torsoHalf * 0.18 }, p),
    limb('fore', 'near', { x: -0.13, y: torsoHalf * 0.53 }, p),
    limb('hind', 'near', { x: 0.36, y: torsoHalf * 0.52 }, p),
  ];

  const gillAnchor = { x: -0.205, y: -torsoHalf * 0.45 };
  const gills: AxolotlGill[] = (['far', 'near'] as const).flatMap(side =>
    Array.from({ length: p.gillStalkCount }, (_, index) => gill(side, index, p.gillStalkCount, gillAnchor, p)));

  const eyeRadius = 0.017 + p.eyeSize * 0.022;
  const eye = {
    center: { x: snoutX + 0.155 + p.headLength * 0.025 + p.eyeSpacing * 0.025, y: -headHalf * (0.2 + p.eyeLift * 0.34) },
    radius: eyeRadius,
    pupilRadius: eyeRadius * clamp(p.pupilRatio, 0.22, 0.86),
  };
  const mouthY = headHalf * (0.12 + p.jawDepth * 0.08 + p.mouthCurve * 0.035);
  const mouthReach = 0.17 + p.mouthWidth * 0.09;
  const mouth = {
    start: { x: snoutX + 0.035, y: mouthY * 0.52 },
    control: { x: snoutX + mouthReach * 0.55, y: mouthY + (p.mouthCurve - 0.5) * 0.026 },
    end: { x: snoutX + mouthReach, y: mouthY * 0.72 },
  };

  const withoutBounds = { version: AXOLOTL_ANATOMY_VERSION, shape: p, top, bottom, dorsalFin, ventralFin, limbs, gills, eye, mouth } as const;
  const points = allAnatomyPoints(withoutBounds);
  const limbPad = Math.max(...limbs.map(l => l.width)) * 0.7;
  const gillPad = Math.max(...gills.map(g => g.width)) * 0.7;
  // Includes limb stepping, gill ventilation and the small breathing displacement.
  const pad = 0.075 + Math.max(limbPad, gillPad);
  const tailPoints = [...topTail, ...bottomTail, ...dorsalFin, ...ventralFin];
  const tailMinX = tailBaseX - 0.02;
  const tailWavePoints = tailPoints.filter(v => v.x >= tailMinX);
  const bounds: AxolotlBounds = {
    minX: Math.min(...points.map(v => v.x)) - pad,
    maxX: Math.max(...points.map(v => v.x)) + pad,
    minY: Math.min(...points.map(v => v.y), ...tailWavePoints.map(v => v.y - AXOLOTL_TAIL_WAVE)) - pad,
    maxY: Math.max(...points.map(v => v.y), ...tailWavePoints.map(v => v.y + AXOLOTL_TAIL_WAVE)) + pad,
  };
  return { ...withoutBounds, bounds };
}

const cache = new WeakMap<object, AxolotlAnatomy>();
/** Memoized by phenotype object identity for renderer hot paths. */
export function axolotlAnatomyFor(input: AxolotlShapeInput): AxolotlAnatomy {
  if (typeof input !== 'object' || input === null) return buildAxolotlAnatomy(input);
  const cached = cache.get(input);
  if (cached) return cached;
  const built = buildAxolotlAnatomy(input);
  cache.set(input, built);
  return built;
}

/** Dense enough for framing/picking checks; includes curves, toes and feathery gills. */
export function axolotlSilhouettePoints(a: AxolotlAnatomy): AxolotlVec[] {
  return [
    ...a.top, ...a.bottom, ...a.dorsalFin, ...a.ventralFin,
    ...a.limbs.flatMap(l => [l.root, l.joint, l.hand, ...l.toes.flatMap(t => quad(t.start, t.control, t.end, 5))]),
    ...a.gills.flatMap(g => [...quad(g.stalk.start, g.stalk.control, g.stalk.end, 8), ...g.fronds.flatMap(f => quad(f.start, f.control, f.end, 3))]),
  ];
}

/** Empty means all geometry is finite, connected enough to draw, and inside the model's hard safety envelope. */
export function validateAxolotlAnatomy(a: AxolotlAnatomy): string[] {
  const problems = new Set<string>();
  const points = axolotlSilhouettePoints(a);
  if (!points.every(v => Number.isFinite(v.x) && Number.isFinite(v.y)) || !Object.values(a.bounds).every(Number.isFinite)) {
    return ['Non-finite axolotl geometry.'];
  }
  for (const line of [a.top, a.bottom]) {
    for (let i = 1; i < line.length; i++) if (line[i].x + 1e-9 < line[i - 1].x) problems.add('Body outline reverses along x.');
  }
  if (a.limbs.length !== 4 || a.limbs.filter(l => l.kind === 'fore').length !== 2 || a.limbs.filter(l => l.kind === 'hind').length !== 2) problems.add('Axolotl must have four limbs.');
  if (a.limbs.some(l => l.toes.length !== (l.kind === 'fore' ? a.shape.foreDigitCount : a.shape.hindDigitCount))) problems.add('Digit count is invalid.');
  if (a.gills.length !== a.shape.gillStalkCount * 2 || a.gills.some(g => g.fronds.length < 8)) problems.add('External gill fan is incomplete.');
  if (!(a.eye.radius > 0 && a.eye.pupilRadius > 0 && a.eye.pupilRadius < a.eye.radius)) problems.add('Eye geometry is invalid.');
  if (!(a.bounds.minX < a.bounds.maxX && a.bounds.minY < a.bounds.maxY)) problems.add('Bounds are inverted.');
  if (a.bounds.minX < -1.25 || a.bounds.maxX > 1.95 || a.bounds.minY < -1.05 || a.bounds.maxY > 1.05) problems.add('Geometry exceeds the hard safety envelope.');
  return [...problems];
}

function pointInPolygon(vertices: readonly AxolotlVec[], p: AxolotlVec): boolean {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const a = vertices[i], b = vertices[j];
    const crosses = (a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function segmentDistance(p: AxolotlVec, a: AxolotlVec, b: AxolotlVec): number {
  const dx = b.x - a.x, dy = b.y - a.y, denom = dx * dx + dy * dy;
  const t = denom > 1e-12 ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / denom) : 0;
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

/** Body-space hit test for future shared picking. Includes body, fin membrane, limbs and the external gill fan. */
export function axolotlContainsPoint(a: AxolotlAnatomy, p: AxolotlVec, tolerance = 0.025): boolean {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
  const t = clamp(finite(tolerance, 0.025), 0, 0.12);
  if (p.x < a.bounds.minX - t || p.x > a.bounds.maxX + t || p.y < a.bounds.minY - t || p.y > a.bounds.maxY + t) return false;
  const body = [...a.top, ...[...a.bottom].reverse()];
  if (pointInPolygon(body, p) || pointInPolygon(a.dorsalFin, p) || pointInPolygon(a.ventralFin, p)) return true;
  for (const limb of a.limbs) {
    if (segmentDistance(p, limb.root, limb.joint) <= limb.width / 2 + t || segmentDistance(p, limb.joint, limb.hand) <= limb.width / 2 + t) return true;
    if (limb.toes.some(toe => segmentDistance(p, toe.start, toe.end) <= limb.width * 0.2 + t)) return true;
  }
  for (const gill of a.gills) {
    if (segmentDistance(p, gill.stalk.start, gill.stalk.end) <= gill.width / 2 + t) return true;
    if (gill.fronds.some(frond => segmentDistance(p, frond.start, frond.end) <= gill.width * 0.2 + t)) return true;
  }
  return false;
}

export type AxolotlPortraitFrame = { originX: number; originY: number; pixelsPerABL: number; size: number };

/** Frame any valid axolotl anatomy with a conservative margin, useful for portraits before shared dispatch exists. */
export function axolotlPortraitFrame(input: AxolotlShapeInput, width: number, height: number, margin = 0.08): AxolotlPortraitFrame {
  const a = axolotlAnatomyFor(input);
  const safeW = Math.max(1, finite(width, 1)), safeH = Math.max(1, finite(height, 1));
  const m = clamp(finite(margin, 0.08), 0, 0.3);
  const spanX = Math.max(1e-6, a.bounds.maxX - a.bounds.minX), spanY = Math.max(1e-6, a.bounds.maxY - a.bounds.minY);
  const pixelsPerABL = Math.min(safeW * (1 - 2 * m) / spanX, safeH * (1 - 2 * m) / spanY);
  return {
    originX: safeW / 2 - (a.bounds.minX + a.bounds.maxX) / 2 * pixelsPerABL,
    originY: safeH / 2 - (a.bounds.minY + a.bounds.maxY) / 2 * pixelsPerABL,
    pixelsPerABL,
    size: pixelsPerABL / a.shape.length,
  };
}
