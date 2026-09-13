import { anatomyFor, insideBody, portraitFrame, silhouettePoints, validateAnatomy } from './anatomy';
import { LOCI, MODEL_VERSIONS, type Locus } from './catalog';
import { express, fingerprint, founderGenome, inherit } from './genetics';
import { clamp, hash, random } from './random';
import type { Genome, Phenotype } from './types';
import { createWorld } from './world';

export const VISUAL_FIXTURE_VERSION = 1;
export const VISUAL_FIXTURE_TIMESTAMP = '2026-09-13T12:00:00.000Z';
export const VISUAL_FIXTURE_WORLD_SEED = 481516;

export const VISUAL_DESCRIPTORS = [
  { key: 'length', label: 'Body length', min: 0.7, max: 1.6 },
  { key: 'depth', label: 'Body depth', min: 0.12, max: 0.6 },
  { key: 'head', label: 'Head size', min: 0.13, max: 0.44 },
  { key: 'snout', label: 'Snout length', min: 0.015, max: 0.135 },
  { key: 'eye', label: 'Eye size', min: 0.015, max: 0.06 },
  { key: 'tail', label: 'Tail length', min: 0.091, max: 1.026 },
  { key: 'spread', label: 'Tail spread', min: 0.12, max: 0.54 },
  { key: 'fork', label: 'Tail fork', min: 0, max: 0.75 },
  { key: 'dorsal', label: 'Dorsal height', min: 0.02275, max: 0.37125 },
  { key: 'pectoral', label: 'Pectoral length', min: 0.039, max: 0.432 },
  { key: 'red', label: 'Warm pigment', min: 0, max: 1 },
  { key: 'black', label: 'Dark pigment', min: 0, max: 1 },
  { key: 'frequency', label: 'Pattern count', min: 3, max: 16 },
  { key: 'patternScale', label: 'Pattern scale', min: 0.05, max: 0.2 },
] as const;

export type VisualDescriptorKey = typeof VISUAL_DESCRIPTORS[number]['key'];
export type NormalizedVisualDescriptors = Record<VisualDescriptorKey, number>;

export type VisualFixtureSubject = {
  id: string;
  label: string;
  kind: 'founder' | 'child' | 'extreme' | 'anatomy';
  birthSeed: number;
  genome: Genome;
  genomeFingerprint: string;
  phenotype: Phenotype;
  normalized: NormalizedVisualDescriptors;
  mutationCount: number;
  anatomyAdjustments: string[];
};

export type CohortDescriptorSummary = {
  mother: number;
  father: number;
  minimum: number;
  mean: number;
  maximum: number;
};

export type VisualCohortFixture = {
  id: string;
  label: string;
  seed: number;
  mother: VisualFixtureSubject;
  father: VisualFixtureSubject;
  children: VisualFixtureSubject[];
  descriptors: Record<VisualDescriptorKey, CohortDescriptorSummary>;
};

export function measureDescriptors(phenotype: Phenotype): NormalizedVisualDescriptors {
  return Object.fromEntries(VISUAL_DESCRIPTORS.map(({ key, min, max }) => [
    key,
    clamp((phenotype[key] - min) / (max - min)),
  ])) as NormalizedVisualDescriptors;
}

function subject(
  id: string,
  label: string,
  kind: VisualFixtureSubject['kind'],
  genome: Genome,
  birthSeed: number,
  mutationCount = 0,
): VisualFixtureSubject {
  const phenotype = express(genome);
  return {
    id, label, kind, birthSeed, genome, genomeFingerprint: fingerprint(genome), phenotype, normalized: measureDescriptors(phenotype), mutationCount,
    anatomyAdjustments: anatomyFor(phenotype).adjustments,
  };
}

const fixtureWorld = createWorld(VISUAL_FIXTURE_TIMESTAMP, VISUAL_FIXTURE_WORLD_SEED);

export const FOUNDER_VISUAL_FIXTURES = fixtureWorld.fish.map(fish =>
  subject(fish.id, fish.name, 'founder', fish.genome, fish.birthSeed),
);

function cohort(id: string, label: string, motherIndex: number, fatherIndex: number, seed: number): VisualCohortFixture {
  const mother = FOUNDER_VISUAL_FIXTURES[motherIndex];
  const father = FOUNDER_VISUAL_FIXTURES[fatherIndex];
  const children = Array.from({ length: 20 }, (_, index) => {
    const birthSeed = hash(`fs-101:${seed}:child:${String(index + 1).padStart(2, '0')}`);
    const inherited = inherit(mother.genome, father.genome, birthSeed);
    return subject(`${id}-${String(index + 1).padStart(2, '0')}`, `Child ${String(index + 1).padStart(2, '0')}`, 'child', inherited.genome, birthSeed, inherited.mutations.length);
  });
  const descriptors = Object.fromEntries(VISUAL_DESCRIPTORS.map(({ key }) => {
    const values = children.map(child => child.normalized[key]);
    return [key, {
      mother: mother.normalized[key], father: father.normalized[key],
      minimum: Math.min(...values), mean: values.reduce((sum, value) => sum + value, 0) / values.length,
      maximum: Math.max(...values),
    }];
  })) as Record<VisualDescriptorKey, CohortDescriptorSummary>;
  return { id, label, seed, mother, father, children, descriptors };
}

export const COHORT_VISUAL_FIXTURES = [
  cohort('cross-a', 'Haru × Sumi', 0, 1, 101001),
  cohort('cross-b', 'Kohaku × Yuki', 2, 3, 101002),
];

type Overrides = Partial<Record<Locus, readonly [number, number]>>;

function genomeWith(overrides: Overrides, base = 2): Genome {
  const genome: Genome = { version: 1, maternal: Array(LOCI.length).fill(base), paternal: Array(LOCI.length).fill(base) };
  for (const [locus, alleles] of Object.entries(overrides) as [Locus, readonly [number, number]][]) {
    const index = LOCI.indexOf(locus);
    genome.maternal[index] = alleles[0];
    genome.paternal[index] = alleles[1];
  }
  return genome;
}

const EXTREME_CASES: readonly [string, string, number, Overrides][] = [
  ['extreme-needle', 'Elongated needle body', 201001, { body_length: [5, 5], body_depth: [0, 0], body_taper: [0, 0] }],
  ['extreme-disk', 'Deep disk body', 201002, { body_length: [0, 0], body_depth: [5, 5], body_taper: [5, 5] }],
  ['extreme-dome', 'Domed head · small eyes', 201003, { head_length: [5, 5], head_gain: [5, 5], eye_size: [0, 0] }],
  ['extreme-fan', 'Broad fan tail', 201004, { tail_length: [5, 5], tail_spread: [5, 5], tail_fork: [0, 0], fin_gain: [5, 5] }],
  ['extreme-face', 'Long snout · large eyes', 201005, { body_length: [0, 0], snout_length: [5, 5], eye_size: [5, 5], head_length: [2, 2] }],
  ['extreme-fork', 'Long deeply forked tail', 201006, { tail_length: [5, 5], tail_spread: [3, 3], tail_fork: [5, 5], fin_gain: [5, 5], head_length: [0, 0] }],
];

export const EXTREME_VISUAL_FIXTURES = EXTREME_CASES.map(([id, label, birthSeed, overrides]) =>
  subject(id, label, 'extreme', genomeWith(overrides), birthSeed),
);

/** FS-102 attachment stress cases: valid v1 allele states chosen to push eyes, fin roots, rays and framing. */
const ANATOMY_STRESS_CASES: readonly [string, string, number, Overrides, number?][] = [
  ['anatomy-shallow-bigeye', 'Shallow body · large high eyes', 301001, { body_depth: [0, 0], eye_size: [5, 5], eye_position: [5, 5] }],
  ['anatomy-all-minimum', 'Every locus A0/A0', 301002, {}, 0],
  ['anatomy-all-maximum', 'Every locus A5/A5', 301003, {}, 5],
  ['anatomy-sway-dome', 'Sway back · domed head · long snout', 301004, { spine_curve: [0, 0], head_length: [5, 5], head_gain: [5, 5], snout_length: [5, 5], eye_size: [5, 5] }],
  ['anatomy-pinched-fan', 'Pinched peduncle · deep body · fan tail', 301005, { body_taper: [0, 0], body_depth: [5, 5], tail_length: [5, 5], tail_spread: [5, 5], tail_fork: [0, 0], fin_gain: [5, 5] }],
  ['anatomy-stub-fork', 'Stub forked tail · wide mouth · long barbels', 301006, { body_depth: [0, 0], tail_length: [0, 0], tail_fork: [5, 5], fin_gain: [0, 0], mouth_size: [5, 5], barbel_length: [5, 5] }],
];

export const ANATOMY_STRESS_FIXTURES = ANATOMY_STRESS_CASES.map(([id, label, birthSeed, overrides, base]) =>
  subject(id, label, 'anatomy', genomeWith(overrides, base), birthSeed),
);

export const LEGACY_ANATOMY_DEFECTS = [
  { key: 'eye-overhang', label: 'Eye extends past the head outline' },
  { key: 'dorsal-root-gap', label: 'Dorsal fin root outside the body outline' },
  { key: 'pectoral-root-gap', label: 'Pectoral fin root outside the body outline' },
  { key: 'gill-stroke-outside', label: 'Gill line endpoint outside the body' },
  { key: 'mouth-stroke-outside', label: 'Mouth line endpoint outside the snout' },
  { key: 'caudal-ray-outside', label: 'Tail ray leaves the fin' },
  { key: 'portrait-clipped', label: 'Portrait framing clips the silhouette' },
] as const;
export type LegacyAnatomyDefect = typeof LEGACY_ANATOMY_DEFECTS[number]['key'];

/** Applies renderer v1 anchor and framing formulas to the unchanged v1 outline, measuring what FS-102 corrects. */
export function legacyAnatomyDefects(p: Phenotype): LegacyAnatomyDefect[] {
  const a = anatomyFor(p), d = p.depth, defects: LegacyAnatomyDefect[] = [];
  const outside = (x: number, y: number) => !insideBody(a, { x, y });
  const eyeX = -(0.45 - p.head * 0.14), eyeY = -d * p.eyePosition * 0.6;
  if (Array.from({ length: 32 }, (_, i) => (i / 32) * Math.PI * 2).some(t => outside(eyeX + Math.cos(t) * p.eye, eyeY + Math.sin(t) * p.eye))) defects.push('eye-overhang');
  if (outside(-0.18, -0.42 * d) || outside(0.3, -0.22 * d)) defects.push('dorsal-root-gap');
  if (outside(-0.2, 0.12 * d) || outside(0.1, 0.4 * d)) defects.push('pectoral-root-gap');
  if (outside(-(0.5 - p.head), -0.2 * d) || outside(-(0.48 - p.head), 0.36 * d)) defects.push('gill-stroke-outside');
  if (outside(-(0.5 + p.snout) + p.mouth, 0.04 * d)) defects.push('mouth-stroke-outside');
  // v1 centre ray ended beyond a deep fork; its fixed 0.72 BL control overshot short tails.
  if (p.fork > 0.5 || 0.5 + p.tail < 0.72) defects.push('caudal-ray-outside');
  const points = silhouettePoints(a);
  const clipped = ([[260, 140], [600, 330]] as const).some(([w, h]) => {
    const scale = Math.min(w * 0.8 / (p.length * (1.2 + p.tail + p.barbel)), h * 0.72 / (p.length * (p.depth + p.dorsal + p.pectoral))) * p.length;
    return points.some(v => { const x = w * 0.39 + v.x * scale, y = h * 0.51 + v.y * scale; return x < 0 || x > w || y < 0 || y > h; });
  });
  if (clipped) defects.push('portrait-clipped');
  return defects;
}

export type AnatomySweepReport = {
  anatomyVersion: number;
  samples: number;
  randomSamplesPerSource: number;
  legacy: Record<LegacyAnatomyDefect, number>;
  legacyAffected: number;
  invalid: { id: string; problems: string[] }[];
  portraitClipped: number;
  eyeRadiusLimited: number;
  eyeMoved: number;
};

/** Fixtures plus seeded founder-distribution and all-A0/A5 genomes, checked under v1 rules and anatomy v2. */
export function anatomySweep(randomSamples = 400): AnatomySweepReport {
  const binary = (seed: number): Genome => {
    const rng = random(seed), draw = () => LOCI.map(() => (rng() < 0.5 ? 0 : 5));
    return { version: 1, maternal: draw(), paternal: draw() };
  };
  const subjects: [string, Phenotype][] = [
    ...[...FOUNDER_VISUAL_FIXTURES, ...COHORT_VISUAL_FIXTURES.flatMap(c => c.children), ...EXTREME_VISUAL_FIXTURES, ...ANATOMY_STRESS_FIXTURES].map(f => [f.id, f.phenotype] as [string, Phenotype]),
    ...Array.from({ length: randomSamples }, (_, i) => [`founder-sample-${i}`, express(founderGenome(hash(`fs-102:founder:${i}`)))] as [string, Phenotype]),
    ...Array.from({ length: randomSamples }, (_, i) => [`binary-extreme-${i}`, express(binary(hash(`fs-102:binary:${i}`)))] as [string, Phenotype]),
  ];
  const legacy = Object.fromEntries(LEGACY_ANATOMY_DEFECTS.map(({ key }) => [key, 0])) as Record<LegacyAnatomyDefect, number>;
  const invalid: AnatomySweepReport['invalid'] = [];
  let legacyAffected = 0, portraitClipped = 0, eyeRadiusLimited = 0, eyeMoved = 0;
  for (const [id, p] of subjects) {
    const defects = legacyAnatomyDefects(p);
    defects.forEach(defect => legacy[defect]++);
    if (defects.length) legacyAffected++;
    const a = anatomyFor(p), problems = validateAnatomy(a);
    if (problems.length) invalid.push({ id, problems });
    const points = silhouettePoints(a);
    if (([[260, 140], [600, 330]] as const).some(([w, h]) => {
      const frame = portraitFrame(p, w, h);
      return points.some(v => { const x = frame.originX + v.x * frame.pixelsPerBodyLength, y = frame.originY + v.y * frame.pixelsPerBodyLength; return x < 0 || x > w || y < 0 || y > h; });
    })) portraitClipped++;
    if (a.adjustments.some(text => text.startsWith('Eye radius'))) eyeRadiusLimited++;
    if (a.adjustments.some(text => text.startsWith('Eye moved'))) eyeMoved++;
  }
  return { anatomyVersion: MODEL_VERSIONS.anatomy, samples: subjects.length, randomSamplesPerSource: randomSamples, legacy, legacyAffected, invalid, portraitClipped, eyeRadiusLimited, eyeMoved };
}

export const VISUAL_FIXTURE_REPORT = {
  fixtureVersion: VISUAL_FIXTURE_VERSION,
  genomeVersion: MODEL_VERSIONS.genome,
  developmentVersion: MODEL_VERSIONS.development,
  anatomyVersion: MODEL_VERSIONS.anatomy,
  rendererVersion: MODEL_VERSIONS.renderer,
  worldSeed: VISUAL_FIXTURE_WORLD_SEED,
  timestamp: VISUAL_FIXTURE_TIMESTAMP,
  descriptors: VISUAL_DESCRIPTORS,
  founders: FOUNDER_VISUAL_FIXTURES,
  cohorts: COHORT_VISUAL_FIXTURES,
  extremes: EXTREME_VISUAL_FIXTURES,
  anatomyStress: ANATOMY_STRESS_FIXTURES,
  knownFindings: [
    'Morphology and pigment parameter ranges are inherited and measurable in normalized descriptor space.',
    'Anatomy v2 anchors eyes, fin roots, rays, gill and mouth to the measured outline. An eye that cannot fit a shallow head is limited, and the limit is listed.',
    'Patch positions are regenerated from each birth seed, so siblings do not yet inherit recognizable marking placement.',
    'The six v1 extremes and six anatomy stress cases are valid allele states, not new tail or body topology.',
  ],
} as const;
