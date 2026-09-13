import { describe, expect, it } from 'vitest';
import { LOCI } from '../src/core/catalog';
import {
  computationalObserver, decodeStudyResults, displayPhenotype, scoreAnswers, STUDY_MODES, studyTrials, wilson,
} from '../src/core/resemblanceStudy';

describe('FS-105 resemblance study kit', () => {
  it('builds a fixed, balanced trial set whose cohorts descend from the answer pair', () => {
    const trials = studyTrials();
    expect(trials).toHaveLength(12);
    expect(studyTrials()).toEqual(trials);
    expect(STUDY_MODES.map(mode => trials.filter(trial => trial.mode === mode).length)).toEqual([4, 4, 4]);
    expect(new Set(trials.map(trial => trial.answer))).toEqual(new Set([0, 1]));
    for (const trial of trials) {
      const { mother, father } = trial.pairs[trial.answer];
      for (const child of trial.cohort) {
        LOCI.forEach((_, i) => {
          // Lab mutation may shift a transmitted allele by one step.
          expect(Math.min(...[mother.genome.maternal[i], mother.genome.paternal[i]].map(a => Math.abs(a - child.genome.maternal[i])))).toBeLessThanOrEqual(1);
          expect(Math.min(...[father.genome.maternal[i], father.genome.paternal[i]].map(a => Math.abs(a - child.genome.paternal[i])))).toBeLessThanOrEqual(1);
        });
      }
    }
  });

  it('hides only the intended channel in each display mode', () => {
    const [first, second] = studyTrials();
    const p = first.cohort[0].phenotype;
    expect(displayPhenotype(p, 'full')).toBe(p);
    const silhouette = displayPhenotype(p, 'silhouette');
    expect([silhouette.length, silhouette.depth, silhouette.tail, silhouette.eye, silhouette.spread]).toEqual([p.length, p.depth, p.tail, p.eye, p.spread]);
    expect([silhouette.red, silhouette.black, silhouette.speckle, silhouette.markings.length]).toEqual([0, 0, 0, 0]);
    const pattern = displayPhenotype(p, 'pattern'), other = displayPhenotype(second.cohort[0].phenotype, 'pattern');
    expect([pattern.length, pattern.depth, pattern.tail, pattern.eye]).toEqual([other.length, other.depth, other.tail, other.eye]);
    expect(pattern.markings).toEqual(p.markings);
    expect([pattern.red, pattern.black, pattern.frequency]).toEqual([p.red, p.black, p.frequency]);
  });

  it('lets a computational observer identify source pairs well above chance', () => {
    const observer = computationalObserver(studyTrials(150, 4, 'fs-105:test-observer'));
    expect(observer.silhouette.accuracy).toBeGreaterThan(0.9);
    expect(observer.pattern.accuracy).toBeGreaterThan(0.75);
    expect(observer.combined.interval[0]).toBeGreaterThan(0.5);
  });

  it('scores answers per mode with Wilson intervals and validates stored results', () => {
    const trials = studyTrials();
    const perfect = trials.map(trial => ({ trialId: trial.id, choice: trial.answer, ms: 1000 }));
    const scores = scoreAnswers(trials, perfect);
    expect(scores.overall).toMatchObject({ trials: 12, correct: 12, accuracy: 1 });
    expect(STUDY_MODES.map(mode => scores[mode].trials)).toEqual([4, 4, 4]);
    const [low, high] = wilson(6, 12);
    expect(low).toBeGreaterThan(0.2);
    expect(high).toBeLessThan(0.8);
    expect(low + high).toBeCloseTo(1, 9);
    const set = 'study-v1-12x4', stored = { version: 1, trialSet: set, answers: perfect.slice(0, 3) };
    expect(decodeStudyResults(JSON.stringify(stored), set)).toEqual(stored);
    expect(decodeStudyResults(JSON.stringify(stored), 'another-set').answers).toEqual([]);
    expect(decodeStudyResults('{bad', set).answers).toEqual([]);
    expect(decodeStudyResults(JSON.stringify({ ...stored, answers: [{ trialId: 'trial-1', choice: 2, ms: 5 }] }), set).answers).toEqual([]);
  });
});
