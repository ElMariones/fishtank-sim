import { decodeStudyResults, scoreAnswers, studyTrials, type ChannelResult, type StudyMode, type StudyResults } from './resemblanceStudy';

export const HUMAN_TRIAL_SET = 'study-v1-12x4';
export type ObserverRecord = { observerId: string; receivedAt: string; result: StudyResults };
/** Per-trial agreement. Every observer sees the same frozen trials, so a consistent miss is a trial finding, not noise. */
export type TrialConsensus = { trialId: string; mode: StudyMode; correct: number; observers: number };
export type HumanPool = {
  observers: number;
  answers: number;
  scores: Record<StudyMode | 'overall', ChannelResult>;
  trials: TrialConsensus[];
};

/** Strictly validate complete, anonymous records and recompute every score from the frozen trial answers. */
export function poolObserverRecords(records: readonly ObserverRecord[]): HumanPool {
  const trials = studyTrials();
  const trialIds = new Set(trials.map(trial => trial.id));
  const observerIds = new Set<string>();
  const answers = records.flatMap(record => {
    if (!record.observerId || observerIds.has(record.observerId)) throw new Error('Observer IDs must be unique.');
    observerIds.add(record.observerId);
    if (!Number.isFinite(Date.parse(record.receivedAt))) throw new Error('Observer record needs a valid received date.');
    const parsed = decodeStudyResults(JSON.stringify(record.result), HUMAN_TRIAL_SET);
    const ids = new Set(parsed.answers.map(answer => answer.trialId));
    if (parsed.answers.length !== trials.length || ids.size !== trials.length || [...ids].some(id => !trialIds.has(id)))
      throw new Error('Each observer must complete the frozen 12-trial set exactly once.');
    return parsed.answers;
  });
  const consensus = trials.map(trial => {
    const matching = answers.filter(answer => answer.trialId === trial.id);
    return { trialId: trial.id, mode: trial.mode, correct: matching.filter(answer => answer.choice === trial.answer).length, observers: matching.length };
  });
  return { observers: records.length, answers: answers.length, scores: scoreAnswers(trials, answers), trials: consensus };
}
