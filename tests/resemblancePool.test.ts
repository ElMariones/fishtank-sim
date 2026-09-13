import { describe, expect, it } from 'vitest';
import records from '../research/FS-111-OBSERVER-RESULTS.json';
import { poolObserverRecords, type ObserverRecord } from '../src/core/resemblancePool';
import { STUDY_MODES } from '../src/core/resemblanceStudy';

describe('FS-111 human observer pool', () => {
  it('validates five real records and recomputes pooled scores against chance', () => {
    const pool = poolObserverRecords(records.records as ObserverRecord[]);
    expect(pool).toMatchObject({ observers: 5, answers: 60 });
    expect(pool.scores.full).toMatchObject({ trials: 20, correct: 19, accuracy: 0.95 });
    expect(pool.scores.silhouette).toMatchObject({ trials: 20, correct: 20, accuracy: 1 });
    expect(pool.scores.pattern).toMatchObject({ trials: 20, correct: 15, accuracy: 0.75 });
    expect(pool.scores.overall).toMatchObject({ trials: 60, correct: 54, accuracy: 0.9 });
    for (const mode of STUDY_MODES) expect(pool.scores[mode].interval[0]).toBeGreaterThan(0.5);
  });

  it('reports per-trial agreement, exposing the markings trial every observer missed', () => {
    const { trials } = poolObserverRecords(records.records as ObserverRecord[]);
    expect(trials).toHaveLength(12);
    expect(trials.every(trial => trial.observers === 5)).toBe(true);
    expect(trials.find(trial => trial.trialId === 'trial-9')).toMatchObject({ mode: 'pattern', correct: 0 });
    expect(trials.find(trial => trial.trialId === 'trial-7')).toMatchObject({ mode: 'full', correct: 4 });
    expect(trials.filter(trial => trial.correct === 5)).toHaveLength(10);
  });

  it('rejects duplicate observers and incomplete or repeated trials', () => {
    const record = records.records[0] as ObserverRecord;
    expect(() => poolObserverRecords([record, record])).toThrow('unique');
    expect(() => poolObserverRecords([{ ...record, result: { ...record.result, answers: record.result.answers.slice(1) } }])).toThrow('complete');
    expect(() => poolObserverRecords([{ ...record, result: { ...record.result, answers: record.result.answers.map((answer, i) => i ? answer : record.result.answers[1]) } }])).toThrow('complete');
  });
});
