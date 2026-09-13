import { anatomyFor, insideBody, portraitFrame, silhouettePoints, validateAnatomy } from './anatomy';
import { APPEARANCE_BASELINE, appearanceFeatures, expressAppearance } from './appearance';
import { APPEARANCE_LOCI, LOCI, MODEL_VERSIONS, MUTATION_RATE, type AppearanceLocus, type Locus } from './catalog';
import { measureDescriptors, VISUAL_DESCRIPTORS, type NormalizedVisualDescriptors, type VisualDescriptorKey } from './descriptors';
import { express, fingerprint, founderGenome, inherit } from './genetics';
import { markingMask, maskSimilarity, separation, type PatternModel } from './patternResemblance';
import { hash, random } from './random';
import type { Appearance, Genome, Phenotype } from './types';
import { createWorld } from './world';

export { measureDescriptors, VISUAL_DESCRIPTORS, type NormalizedVisualDescriptors, type VisualDescriptorKey } from './descriptors';

export const VISUAL_FIXTURE_VERSION = 1;
export const VISUAL_FIXTURE_TIMESTAMP = '2026-09-13T12:00:00.000Z';
export const VISUAL_FIXTURE_WORLD_SEED = 481516;

export type VisualFixtureSubject = {
  id: string;
  label: string;
  kind: 'founder' | 'child' | 'extreme' | 'anatomy' | 'appearance';
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

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);

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

// FS-101 to FS-105 fixtures stay on genome v1 so their pinned identities and measurements never drift.
const fixtureWorld = createWorld(VISUAL_FIXTURE_TIMESTAMP, VISUAL_FIXTURE_WORLD_SEED, 1);

export const FOUNDER_VISUAL_FIXTURES = fixtureWorld.fish.map(fish =>
  subject(fish.id, fish.name, 'founder', fish.genome, fish.birthSeed),
);

function cohort(id: string, label: string, motherIndex: number, fatherIndex: number, seed: number): VisualCohortFixture {
  const mother = FOUNDER_VISUAL_FIXTURES[motherIndex];
  const father = FOUNDER_VISUAL_FIXTURES[fatherIndex];
  const children = Array.from({ length: 20 }, (_, index) => {
    const birthSeed = hash(`fs-101:${seed}:child:${String(index + 1).padStart(2, '0')}`);
    const inherited = inherit(mother.genome, father.genome, birthSeed, MUTATION_RATE, 1);
    return subject(`${id}-${String(index + 1).padStart(2, '0')}`, `Child ${String(index + 1).padStart(2, '0')}`, 'child', inherited.genome, birthSeed, inherited.mutations.length);
  });
  const descriptors = Object.fromEntries(VISUAL_DESCRIPTORS.map(({ key }) => {
    const values = children.map(child => child.normalized[key]);
    return [key, {
      mother: mother.normalized[key], father: father.normalized[key],
      minimum: Math.min(...values), mean: mean(values),
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

type AppearanceOverrides = Partial<Record<AppearanceLocus, readonly [number, number]>>;

/** FS-113 appearance variants: founder Kohaku's genome v1 loci plus chosen genome v2 Color and Ornament alleles. */
const APPEARANCE_CASES: readonly [string, string, number, AppearanceOverrides][] = [
  ['appearance-spots', 'Fine gold spots', 401001, { body_motif: [1, 1], dot_color: [2, 2], motif_density: [4, 4], motif_contrast: [4, 4] }],
  ['appearance-stripes', 'Tiger stripes', 401002, { body_motif: [2, 2], motif_density: [3, 3], motif_scale: [3, 3], motif_contrast: [5, 5] }],
  ['appearance-carrier', 'Faint stripes over classic patches', 401003, { body_motif: [0, 2], motif_contrast: [4, 4] }],
  ['appearance-marble', 'Cobalt marbling', 401004, { body_motif: [3, 3], accent_color: [3, 3], motif_contrast: [4, 4] }],
  ['appearance-calico', 'Calico flecks in pearl and turquoise', 401005, { body_motif: [4, 4], dot_color: [1, 3], motif_density: [4, 4] }],
  ['appearance-rosettes', 'Rosettes on a gold body', 401006, { body_motif: [5, 5], base_color: [1, 1], motif_density: [2, 3] }],
  ['appearance-mix', 'Rainbow spots mixed with stripes', 401007, { body_motif: [1, 2], dot_color: [5, 0], motif_density: [3, 3], motif_contrast: [5, 5] }],
  ['appearance-slate', 'Slate body, crimson accents, ruby eyes', 401008, { base_color: [2, 2], accent_color: [1, 1], iris_color: [2, 2] }],
  ['appearance-charcoal', 'Charcoal body, pearl accents, silver eyes, netted scales', 401009, { base_color: [3, 3], accent_color: [5, 5], iris_color: [5, 5], scale_type: [3, 3] }],
  ['appearance-blend', 'Lavender–jade blend, two-tone eyes, pearl scales, shimmer', 401010, { base_color: [4, 5], iris_color: [3, 4], scale_type: [4, 4], shimmer: [5, 4] }],
  ['appearance-mirror', 'Mirror scales with soft shimmer', 401011, { scale_type: [2, 2], shimmer: [2, 2] }],
  ['appearance-armor', 'Armored scales, sunflower accents', 401012, { scale_type: [5, 5], accent_color: [2, 2] }],
  ['appearance-banded-fins', 'Banded tail and dorsal; stripes reach the fins', 401013, { fin_motif: [2, 2], body_motif: [2, 2], motif_reach: [5, 5], motif_contrast: [4, 4] }],
  ['appearance-edged-fins', 'Colored fin edges and dark tips', 401014, { fin_motif: [3, 4], accent_color: [4, 4] }],
  ['appearance-flame-fins', 'Flame rays; ruby spots reach the fins', 401015, { fin_motif: [5, 5], body_motif: [1, 1], motif_reach: [4, 4], dot_color: [4, 4] }],
];

function appearanceGenome(base: Genome, overrides: AppearanceOverrides): Genome {
  const genome: Genome = { version: 2, maternal: [...base.maternal.slice(0, LOCI.length), ...APPEARANCE_BASELINE], paternal: [...base.paternal.slice(0, LOCI.length), ...APPEARANCE_BASELINE] };
  for (const [locus, alleles] of Object.entries(overrides) as [AppearanceLocus, readonly [number, number]][]) {
    const index = LOCI.length + APPEARANCE_LOCI.indexOf(locus);
    genome.maternal[index] = alleles[0];
    genome.paternal[index] = alleles[1];
  }
  return genome;
}

export const APPEARANCE_VISUAL_FIXTURES = APPEARANCE_CASES.map(([id, label, birthSeed, overrides]) =>
  subject(id, label, 'appearance', appearanceGenome(FOUNDER_VISUAL_FIXTURES[2].genome, overrides), birthSeed),
);

const APPEARANCE_FEATURES = ['body color', 'accent color', 'eye color', 'shimmer', 'scales', 'body pattern', 'fin pattern'];
const STRIKING_FEATURES: readonly [string, (a: Appearance) => boolean][] = [
  ['Rosettes', a => a.motifs.some(m => m.kind === 'rosettes')],
  ['Rainbow dots', a => a.dots[0] === 'rainbow' && (a.motifs.some(m => m.kind === 'spots' || m.kind === 'calico') || a.finMotifs.some(m => m.kind === 'spots'))],
  ['Jade body', a => a.base.includes('jade')],
  ['Lavender body', a => a.base.includes('lavender')],
  ['Silver eyes', a => a.iris.includes('silver')],
  ['Armored scales', a => a.scales === 'armor'],
  ['Flame fins', a => a.finMotifs.some(m => m.kind === 'flame')],
  ['Strong shimmer', a => a.shimmer >= 0.7],
];
export type AppearanceSurvey = { samples: number; anyFeature: number; features: Record<string, number>; striking: Record<string, number> };

/** Seeded genome v2 founders, the distribution sold as Newcomer stock: how often each new feature is visible. */
export function appearanceFounderSurvey(samples = 10_000, salt = 'fs-113:founders'): AppearanceSurvey {
  const features = Object.fromEntries(APPEARANCE_FEATURES.map(name => [name, 0])), striking = Object.fromEntries(STRIKING_FEATURES.map(([name]) => [name, 0]));
  let any = 0;
  for (let i = 0; i < samples; i++) {
    const appearance = expressAppearance(founderGenome(hash(`${salt}:${i}`), 2)), shown = appearanceFeatures(appearance);
    if (shown.length) any++;
    for (const feature of shown) features[feature]++;
    for (const [name, test] of STRIKING_FEATURES) if (test(appearance)) striking[name]++;
  }
  const share = (counts: Record<string, number>) => Object.fromEntries(Object.entries(counts).map(([name, count]) => [name, count / samples]));
  return { samples, anyFeature: any / samples, features: share(features), striking: share(striking) };
}

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
    ...Array.from({ length: randomSamples }, (_, i) => [`founder-sample-${i}`, express(founderGenome(hash(`fs-102:founder:${i}`), 1))] as [string, Phenotype]),
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

export type FixturePatternComparison = { model: PatternModel; siblingMean: number; crossCohortMean: number; parentChildMean: number; siblingSeparation: number };

/** Visible-marking overlap within and across the two frozen FS-101 cohorts, for independent and inherited placement. */
export function fixturePatternComparison(): FixturePatternComparison[] {
  return (['independent', 'inherited'] as const).map(model => {
    const mask = (fixture: VisualFixtureSubject) => markingMask(fixture.phenotype, fixture.birthSeed, model);
    const cohorts = COHORT_VISUAL_FIXTURES.map(fixture => ({ parents: [mask(fixture.mother), mask(fixture.father)], children: fixture.children.map(mask) }));
    const siblings = cohorts.flatMap(({ children }) => children.flatMap((child, i) => children.slice(i + 1).map(other => maskSimilarity(child, other))));
    const cross = cohorts[0].children.flatMap(child => cohorts[1].children.map(other => maskSimilarity(child, other)));
    const parentChild = cohorts.flatMap(({ parents, children }) => children.flatMap(child => parents.map(parent => maskSimilarity(child, parent))));
    return { model, siblingMean: mean(siblings), crossCohortMean: mean(cross), parentChildMean: mean(parentChild), siblingSeparation: separation(siblings, cross) };
  });
}

export const VISUAL_FIXTURE_REPORT = {
  fixtureVersion: VISUAL_FIXTURE_VERSION,
  genomeVersion: MODEL_VERSIONS.genome,
  fixtureGenomeVersion: 1,
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
  appearance: APPEARANCE_VISUAL_FIXTURES,
  knownFindings: [
    'Genome v2 appends Color and Ornament chromosomes. Genome v1 fixtures and saved fish read as the classic baseline, so these frozen fixtures render exactly as before.',
    'Morphology and pigment parameter ranges are inherited and measurable in normalized descriptor space.',
    'Anatomy v2 anchors eyes, fin roots, rays, gill and mouth to the measured outline. An eye that cannot fit a shallow head is limited, and the limit is listed.',
    'Development v2 derives marking anchors from phased pigment and pattern haplotype blocks; the birth seed only jitters them. Siblings share placement in proportion to the chromosome copies they share.',
    'The six v1 extremes and six anatomy stress cases are valid allele states, not new tail or body topology.',
  ],
} as const;
