import { hash, random } from '../core/random';
import type { Phenotype } from '../core/types';
import {
  APPEARANCE_VISUAL_FIXTURES,
  COHORT_VISUAL_FIXTURES,
  EXTREME_VISUAL_FIXTURES,
  FOUNDER_VISUAL_FIXTURES,
  STRUCTURE_VISUAL_FIXTURES,
} from '../core/visualFixtures';
import { detailFor } from '../rendering/lod';

/**
 * The scene the FS-701 renderer spike measures (Canvas and PixiJS alike).
 *
 * It is generated from a seed and stepped by a fixed timestep, so every backend draws the same fish in the same places
 * with the same tail phases. Nothing here touches the world, the worker or a save: the spike measures drawing, and a
 * backend that steered its own fish would be measuring something else.
 */

/** Every fixture the lab can produce, so the spike is not measuring one easy silhouette. */
const SUBJECTS = [
  ...FOUNDER_VISUAL_FIXTURES,
  ...COHORT_VISUAL_FIXTURES.flatMap(cohort => [cohort.mother, cohort.father, ...cohort.children]),
  ...EXTREME_VISUAL_FIXTURES,
  ...APPEARANCE_VISUAL_FIXTURES,
  ...STRUCTURE_VISUAL_FIXTURES,
];

export type BenchFish = {
  id: string;
  phenotype: Phenotype;
  seed: number;
  /** Normalized tank position, as the live renderer uses. */
  x: number; y: number;
  vx: number; vy: number;
  /** Share of adult length, the same 0.25–1 range `visualGrowth` produces. */
  growth: number;
  tailPhase: number;
  finPhase: number;
  effort: number;
};

export type Scenario = {
  id: string;
  label: string;
  /** What this case is meant to represent, printed with the results so a number is never quoted without its case. */
  intent: string;
  count: number;
  /** Growth range the cohort is drawn from: small fry sit in the sprite tier, adults in the full tier. */
  growth: [number, number];
  width: number;
  height: number;
};

export const SCENARIOS: Scenario[] = [
  { id: 'tank-12', label: 'Tank, 12 adults', intent: 'A normal aquarium as it is played today: every fish above the full-detail threshold.', count: 12, growth: [0.8, 1], width: 1280, height: 720 },
  { id: 'crowded-60', label: 'Crowded, 60 mixed', intent: 'A full nursery after a clutch hatches: adults and fry together, so the scene spans both tiers.', count: 60, growth: [0.25, 1], width: 1280, height: 720 },
  { id: 'fry-200', label: 'Fry swarm, 200', intent: 'The FS-702 soak shape: far more small fish than the current design allows, to find where Canvas gives out.', count: 200, growth: [0.25, 0.45], width: 1280, height: 720 },
];

/** Build a scenario's fish deterministically from its id, so every backend and every run measures the same scene. */
export function buildScene(scenario: Scenario): BenchFish[] {
  const rng = random(hash(`fs-701:${scenario.id}`));
  const [low, high] = scenario.growth;
  return Array.from({ length: scenario.count }, (_, i) => {
    const subject = SUBJECTS[Math.floor(rng() * SUBJECTS.length) % SUBJECTS.length];
    const speed = 0.02 + rng() * 0.04;
    return {
      id: `bench-${i}`,
      phenotype: subject.phenotype,
      seed: subject.birthSeed,
      x: 0.1 + rng() * 0.8,
      y: 0.15 + rng() * 0.7,
      vx: (rng() < 0.5 ? -1 : 1) * speed,
      vy: (rng() - 0.5) * speed * 0.4,
      growth: low + rng() * (high - low),
      tailPhase: rng() * Math.PI * 2,
      finPhase: rng() * Math.PI * 2,
      effort: 0.25 + rng() * 0.7,
    };
  });
}

/** One fixed simulation step, so frame N is the same scene for every backend regardless of how fast it drew frame N−1. */
export const STEP_SECONDS = 1 / 60;

export function stepScene(fish: BenchFish[]) {
  for (const f of fish) {
    f.x += f.vx * STEP_SECONDS;
    f.y += f.vy * STEP_SECONDS;
    if (f.x < 0.06 || f.x > 0.94) { f.vx = -f.vx; f.x = Math.min(0.94, Math.max(0.06, f.x)); }
    if (f.y < 0.12 || f.y > 0.88) { f.vy = -f.vy; f.y = Math.min(0.88, Math.max(0.12, f.y)); }
    f.tailPhase = (f.tailPhase + STEP_SECONDS * (3 + 5 * f.effort)) % (Math.PI * 4);
    f.finPhase = (f.finPhase + STEP_SECONDS * 2.5) % (Math.PI * 4);
  }
}

/** The same sizing the live tank uses (`fishPose`), so the measured body lengths are the ones players actually see. */
export function sizeOfFish(f: BenchFish, width: number): number {
  return Math.min(width / 10, 79) * (0.8 + f.phenotype.adultLengthCm / 200) * f.growth;
}

export const bodyLengthOf = (f: BenchFish, width: number) => sizeOfFish(f, width) * f.phenotype.length;

/** How a scenario's fish fall across the tiers at a given size and pixel ratio; reported beside every timing. */
export function tierMix(fish: BenchFish[], width: number, dpr: number): Record<string, number> {
  const mix: Record<string, number> = { full: 0, sprite: 0 };
  for (const f of fish) mix[detailFor(bodyLengthOf(f, width) * dpr).tier]++;
  return mix;
}
