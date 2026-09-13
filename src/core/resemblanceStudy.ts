import { z } from 'zod';
import { measureDescriptors, type VisualDescriptorKey } from './descriptors';
import { express, founderGenome, inherit } from './genetics';
import { markingMask, maskSimilarity } from './patternResemblance';
import { hash } from './random';
import type { Genome, Phenotype } from './types';

/**
 * FS-105 resemblance study (BALANCE E-01). A trial shows two unrelated parent pairs and a small cohort bred from one of
 * them; the observer names the source pair. Modes isolate the channel: full appearance, silhouette only (pigment
 * neutralised) or pattern only (markings on one standard body). The same seeded trial set is shown to every observer.
 */
export const STUDY_VERSION = 1;
export const STUDY_RESULTS_KEY = 'fishtank-sim.study.v1';
export const STUDY_MODES = ['full', 'silhouette', 'pattern'] as const;
export type StudyMode = typeof STUDY_MODES[number];
export const MORPHOLOGY_DESCRIPTORS: VisualDescriptorKey[] = ['length', 'depth', 'head', 'snout', 'eye', 'tail', 'spread', 'fork', 'dorsal', 'pectoral'];

export type StudyFish = { id: string; sex: 'F' | 'M'; genome: Genome; phenotype: Phenotype; seed: number };
export type StudyPair = { mother: StudyFish; father: StudyFish };
export type StudyTrial = { id: string; mode: StudyMode; pairs: [StudyPair, StudyPair]; cohort: StudyFish[]; answer: 0 | 1 };

const fish = (id: string, sex: StudyFish['sex'], genome: Genome, seed: number): StudyFish => ({ id, sex, genome, phenotype: express(genome), seed });

export function studyTrials(count = 12, cohortSize = 4, salt = `fs-105:study:v${STUDY_VERSION}`): StudyTrial[] {
  return Array.from({ length: count }, (_, t) => {
    const pair = (side: number): StudyPair => {
      const motherSeed = hash(`${salt}:${t}:${side}:mother`), fatherSeed = hash(`${salt}:${t}:${side}:father`);
      return { mother: fish(`T${t + 1}-${side ? 'B' : 'A'}-mother`, 'F', founderGenome(motherSeed), motherSeed), father: fish(`T${t + 1}-${side ? 'B' : 'A'}-father`, 'M', founderGenome(fatherSeed), fatherSeed) };
    };
    const pairs: [StudyPair, StudyPair] = [pair(0), pair(1)];
    const answer = (hash(`${salt}:${t}:answer`) % 2) as 0 | 1;
    const source = pairs[answer];
    const cohort = Array.from({ length: cohortSize }, (_, c) => {
      const seed = hash(`${salt}:${t}:child:${c}`);
      return fish(`T${t + 1}-child-${c + 1}`, c % 2 ? 'M' : 'F', inherit(source.mother.genome, source.father.genome, seed).genome, seed);
    });
    return { id: `trial-${t + 1}`, mode: STUDY_MODES[t % STUDY_MODES.length], pairs, cohort, answer };
  });
}

const MORPHOLOGY_FIELDS = ['length', 'depth', 'taper', 'curve', 'head', 'snout', 'eye', 'eyePosition', 'iris', 'pupil', 'mouth', 'barbel', 'tail', 'spread', 'fork', 'dorsal', 'pectoral'] as const;
let standardPhenotype: Phenotype | undefined;
const standard = () => standardPhenotype ??= express({ version: 1, maternal: Array(48).fill(2), paternal: Array(48).fill(2) });

/** Presentation-only phenotype for a study mode. The renderer is unchanged; nothing here is saved or inherited. */
export function displayPhenotype(p: Phenotype, mode: StudyMode): Phenotype {
  if (mode === 'full') return p;
  if (mode === 'silhouette') return { ...p, red: 0, black: 0, speckle: 0, yellow: 0.5, white: 0.55, metallic: 0.15, translucency: 0, finPigment: 0, iris: 140, markings: [] };
  const s = standard();
  return { ...p, ...Object.fromEntries(MORPHOLOGY_FIELDS.map(field => [field, s[field]])) };
}

export type ChannelResult = { trials: number; correct: number; accuracy: number; interval: [number, number] };

/** Wilson 95% interval for a proportion. */
export function wilson(correct: number, trials: number, z = 1.96): [number, number] {
  if (!trials) return [0, 1];
  const p = correct / trials, z2 = z * z, denominator = 1 + z2 / trials;
  const centre = p + z2 / (2 * trials), margin = z * Math.sqrt(p * (1 - p) / trials + z2 / (4 * trials * trials));
  return [Math.max(0, (centre - margin) / denominator), Math.min(1, (centre + margin) / denominator)];
}

const channel = (outcomes: boolean[]): ChannelResult => {
  const correct = outcomes.filter(Boolean).length;
  return { trials: outcomes.length, correct, accuracy: outcomes.length ? correct / outcomes.length : 0, interval: wilson(correct, outcomes.length) };
};

const morphologyVector = (p: Phenotype) => { const d = measureDescriptors(p); return MORPHOLOGY_DESCRIPTORS.map(key => d[key]); };

/**
 * Computational observer, not a person: silhouette compares the cohort's mean morphology with each midparent; pattern
 * compares visible marking masks with each parent; combined adds both margins after scaling each by its median size.
 */
export function computationalObserver(trials: StudyTrial[]): Record<'silhouette' | 'pattern' | 'combined', ChannelResult> {
  const margins = trials.map(trial => {
    const cohortMean = morphologyVector(trial.cohort[0].phenotype).map((_, i) => trial.cohort.reduce((sum, child) => sum + morphologyVector(child.phenotype)[i], 0) / trial.cohort.length);
    const silhouette = trial.pairs.map(pair => {
      const mother = morphologyVector(pair.mother.phenotype), father = morphologyVector(pair.father.phenotype);
      return -Math.hypot(...cohortMean.map((value, i) => value - (mother[i] + father[i]) / 2));
    });
    const childMasks = trial.cohort.map(child => markingMask(child.phenotype, child.seed));
    const pattern = trial.pairs.map(pair => {
      const parents = [markingMask(pair.mother.phenotype, pair.mother.seed), markingMask(pair.father.phenotype, pair.father.seed)];
      return childMasks.reduce((sum, mask) => sum + parents.reduce((inner, parent) => inner + maskSimilarity(mask, parent), 0) / 2, 0) / childMasks.length;
    });
    const toward = (scores: number[]) => (trial.answer === 0 ? 1 : -1) * (scores[0] - scores[1]);
    return { silhouette: toward(silhouette), pattern: toward(pattern) };
  });
  const median = (values: number[]) => { const sorted = values.map(Math.abs).sort((a, b) => a - b); return sorted[Math.floor(sorted.length / 2)] || 1; };
  const silhouetteScale = median(margins.map(m => m.silhouette)), patternScale = median(margins.map(m => m.pattern));
  return {
    silhouette: channel(margins.map(m => m.silhouette > 0)),
    pattern: channel(margins.map(m => m.pattern > 0)),
    combined: channel(margins.map(m => m.silhouette / silhouetteScale + m.pattern / patternScale > 0)),
  };
}

const answerSchema = z.object({ trialId: z.string().regex(/^trial-\d{1,3}$/), choice: z.union([z.literal(0), z.literal(1)]), ms: z.number().int().nonnegative().max(3_600_000), cue: z.string().max(200).optional() });
const resultsSchema = z.object({ version: z.literal(STUDY_VERSION), trialSet: z.string().max(80), answers: z.array(answerSchema).max(200) });
export type StudyAnswer = z.infer<typeof answerSchema>;
export type StudyResults = z.infer<typeof resultsSchema>;

export function decodeStudyResults(raw: string | null, trialSet: string): StudyResults {
  const empty: StudyResults = { version: STUDY_VERSION, trialSet, answers: [] };
  if (!raw) return empty;
  try {
    const parsed = resultsSchema.parse(JSON.parse(raw));
    return parsed.trialSet === trialSet ? parsed : empty;
  } catch {
    return empty;
  }
}

/** Accuracy per mode and overall against the trial answers; unanswered trials are not counted. */
export function scoreAnswers(trials: StudyTrial[], answers: StudyAnswer[]): Record<StudyMode | 'overall', ChannelResult> {
  const byId = new Map(trials.map(trial => [trial.id, trial]));
  const outcomes = answers.flatMap(answer => { const trial = byId.get(answer.trialId); return trial ? [{ mode: trial.mode, correct: trial.answer === answer.choice }] : []; });
  return {
    full: channel(outcomes.filter(o => o.mode === 'full').map(o => o.correct)),
    silhouette: channel(outcomes.filter(o => o.mode === 'silhouette').map(o => o.correct)),
    pattern: channel(outcomes.filter(o => o.mode === 'pattern').map(o => o.correct)),
    overall: channel(outcomes.map(o => o.correct)),
  };
}
