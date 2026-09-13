import { LOCI, type Locus } from './catalog';
import { express, fingerprint, inherit } from './genetics';
import { clamp, hash } from './random';
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
  kind: 'founder' | 'child' | 'extreme';
  birthSeed: number;
  genome: Genome;
  genomeFingerprint: string;
  phenotype: Phenotype;
  normalized: NormalizedVisualDescriptors;
  mutationCount: number;
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

function measure(phenotype: Phenotype): NormalizedVisualDescriptors {
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
  return { id, label, kind, birthSeed, genome, genomeFingerprint: fingerprint(genome), phenotype, normalized: measure(phenotype), mutationCount };
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

function genomeWith(overrides: Partial<Record<Locus, readonly [number, number]>>): Genome {
  const genome: Genome = { version: 1, maternal: Array(LOCI.length).fill(2), paternal: Array(LOCI.length).fill(2) };
  for (const [locus, alleles] of Object.entries(overrides) as [Locus, readonly [number, number]][]) {
    const index = LOCI.indexOf(locus);
    genome.maternal[index] = alleles[0];
    genome.paternal[index] = alleles[1];
  }
  return genome;
}

const EXTREME_CASES: readonly [string, string, number, Partial<Record<Locus, readonly [number, number]>>][] = [
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

export const VISUAL_FIXTURE_REPORT = {
  fixtureVersion: VISUAL_FIXTURE_VERSION,
  genomeVersion: 1,
  developmentVersion: 1,
  rendererVersion: 1,
  worldSeed: VISUAL_FIXTURE_WORLD_SEED,
  timestamp: VISUAL_FIXTURE_TIMESTAMP,
  descriptors: VISUAL_DESCRIPTORS,
  founders: FOUNDER_VISUAL_FIXTURES,
  cohorts: COHORT_VISUAL_FIXTURES,
  extremes: EXTREME_VISUAL_FIXTURES,
  knownFindings: [
    'Morphology and pigment parameter ranges are inherited and measurable in normalized descriptor space.',
    'Patch positions are regenerated from each birth seed, so siblings do not yet inherit recognizable marking placement.',
    'The six v1 extremes are valid parameter cases, not new tail or body topology.',
  ],
} as const;
