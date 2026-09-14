import { courtshipBlockers } from './breeding';
import { careWarnings, type CareWarning } from './careAdvice';
import { environmentLimits, lifeStage, type LifeStage } from './development';
import { metabolicPotential } from './genetics';
import type { DayReport } from './habitat';
import type { World } from './types';

/**
 * Absence summary (FS-307). An observer watches every game day of the ordinary advance and reports, per tank, what
 * changed while the player was away: hatching, stage changes, growth, condition, the causes that limited condition and
 * on how many days, and the warnings waiting on return. It also counts any condition decline with no named cause, which
 * the environment model makes impossible; the count is the check, and it should always be zero.
 */

/** A fish's condition only counts as declined when it falls by more than this over the whole absence. */
export const DECLINE_TOLERANCE = 0.005;

export type TankAbsence = {
  tankId: string; name: string; residents: number;
  /** Eggs laid into this tank by clutches during the absence (FS-402). */
  eggsLaid: number;
  eggsHatched: number; becameJuvenile: number; becameAdult: number; lengthGainedCm: number;
  conditionBefore: number | null; conditionAfter: number | null;
  /** Fish whose condition ended the absence lower than it started. */
  declined: number;
  /** Causes that limited condition, with the number of game days each applied, most frequent first. */
  limitDays: { cause: string; days: number }[];
  /** Fish-days whose condition fell with no named cause. */
  unexplainedDeclines: number;
  warnings: Pick<CareWarning, 'code' | 'severity' | 'title'>[];
  /** Courtships in this tank on return, with the reasons any of them is paused. */
  courtships: string[];
};
export type AbsenceSummary = { gameDays: number; tanks: TankAbsence[]; unexplainedDeclines: number };

const GROWN: readonly LifeStage[] = ['adult', 'elderly'];

export function absenceObserver(start: World) {
  const limitDays = new Map<string, Map<string, number>>(), unexplained = new Map<string, number>();
  let gameDays = 0;

  const onDay = (report: DayReport) => {
    gameDays++;
    for (const [tankId, environment] of report.environments) {
      const counts = limitDays.get(tankId) ?? new Map<string, number>();
      for (const cause of environmentLimits(environment)) counts.set(cause, (counts.get(cause) ?? 0) + 1);
      limitDays.set(tankId, counts);
    }
    const before = new Map(report.before.fish.filter(f => f.status === 'living').map(f => [f.id, f.life.condition]));
    for (const member of report.after.fish) {
      const previous = before.get(member.id);
      if (member.status !== 'living' || previous === undefined || member.life.condition >= previous) continue;
      const environment = report.environments.get(member.tankId);
      if (!environment || !environmentLimits(environment).length) unexplained.set(member.tankId, (unexplained.get(member.tankId) ?? 0) + 1);
    }
  };

  const summarize = (end: World): AbsenceSummary => {
    const started = new Map(start.fish.map(f => [f.id, f]));
    const tanks = end.tanks.map((tank): TankAbsence => {
      const residents = end.fish.filter(f => f.status === 'living' && f.tankId === tank.id);
      let eggsLaid = 0, eggsHatched = 0, becameJuvenile = 0, becameAdult = 0, lengthGainedCm = 0, declined = 0, beforeSum = 0, afterSum = 0, compared = 0;
      for (const member of residents) {
        const was = started.get(member.id);
        if (!was) { eggsLaid++; continue; }
        const potential = metabolicPotential(member.genome), from = lifeStage(was.life, potential), to = lifeStage(member.life, potential);
        if (from === 'egg' && to !== 'egg') eggsHatched++;
        if (to === 'juvenile' && from !== 'juvenile') becameJuvenile++;
        if (GROWN.includes(to) && !GROWN.includes(from)) becameAdult++;
        lengthGainedCm += member.life.lengthCm - was.life.lengthCm;
        if (member.life.condition < was.life.condition - DECLINE_TOLERANCE) declined++;
        beforeSum += was.life.condition; afterSum += member.life.condition; compared++;
      }
      const nameOf = (id: string) => end.fish.find(f => f.id === id)?.name ?? id;
      const courtships = end.clutches.filter(entry => entry.stage === 'courting' && end.fish.find(f => f.id === entry.motherId)?.tankId === tank.id).map(entry => {
        const reasons = courtshipBlockers(end, entry).map(blocker => blocker.message), pairName = `${nameOf(entry.motherId)} × ${nameOf(entry.fatherId)}`;
        return reasons.length ? `${pairName}: courtship paused. ${reasons.join(' ')}` : `${pairName}: courting, ${Math.round(entry.progress * 100)}% complete.`;
      });
      return {
        tankId: tank.id, name: tank.name, residents: residents.length, eggsLaid, eggsHatched, becameJuvenile, becameAdult, lengthGainedCm, courtships,
        conditionBefore: compared ? beforeSum / compared : null, conditionAfter: compared ? afterSum / compared : null, declined,
        limitDays: [...(limitDays.get(tank.id) ?? new Map<string, number>())].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([cause, days]) => ({ cause, days })),
        unexplainedDeclines: unexplained.get(tank.id) ?? 0,
        warnings: careWarnings(end, tank.id).map(({ code, severity, title }) => ({ code, severity, title })),
      };
    });
    return { gameDays, tanks, unexplainedDeclines: tanks.reduce((sum, tank) => sum + tank.unexplainedDeclines, 0) };
  };

  return { onDay, summarize };
}

/** A tank with nothing to report: no hatching, stage change, decline, limiting cause or waiting warning. */
export const quietTank = (tank: TankAbsence) =>
  !tank.eggsLaid && !tank.eggsHatched && !tank.becameJuvenile && !tank.becameAdult && !tank.declined && !tank.limitDays.length && !tank.warnings.length && !tank.courtships.length;
