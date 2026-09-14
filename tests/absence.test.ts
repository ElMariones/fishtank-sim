import { describe, expect, it } from 'vitest';
import { absenceObserver, quietTank } from '../src/core/absence';
import { AERATION_TIERS, FILTER_TIERS, RATION_KEYS } from '../src/core/care';
import { careScenarios, SCENARIO_DAYS, scenarioWorld, STRESS_DAYS } from '../src/core/careScenario';
import { environmentLimits } from '../src/core/development';
import { advanceWorld, type DayReport } from '../src/core/habitat';
import { random } from '../src/core/random';
import { applyOfflineCatchup, commandEnvelope, createRuntime, executeCommand } from '../src/core/runtime';
import { TICKS_PER_GAME_DAY } from '../src/core/water';
import { applyCommand, createWorld, type Command } from '../src/core/world';
import { OFFLINE_CAP_MS } from '../src/simulation/time';

const NOW = '2026-09-14T12:00:00.000Z';
const DAY = TICKS_PER_GAME_DAY;
const breedStudio: Command = { type: 'breed', motherId: 'FSH-000001', fatherId: 'FSH-000002', tankId: 'tank-2', timestamp: NOW, genomeVersion: 2 };
const stressed = () => scenarioWorld(60, { ration: 'heavy', targetC: 29 }, { filterMgNPerDay: FILTER_TIERS[0].mgNPerDay, aerationPerDay: AERATION_TIERS[0].perDay });

describe('FS-307 integrated care, absence and recovery', () => {
  it('observes every game-day boundary without changing the world', () => {
    const world = applyCommand(scenarioWorld(20, { ration: 'generous' }), breedStudio), reports: DayReport[] = [];
    const observed = advanceWorld(world, 7, 7 + 5 * DAY + 100, report => reports.push(report));
    expect(observed).toEqual(advanceWorld(world, 7, 7 + 5 * DAY + 100));
    expect(reports.map(report => report.tick)).toEqual([1, 2, 3, 4, 5].map(day => day * DAY));
    expect(reports.every(report => report.environments.size === world.tanks.length)).toBe(true);
    // The last report is the world at the day-5 boundary; the remaining 100 ticks integrate water after it.
    expect(reports.at(-1)!.after).toEqual(advanceWorld(world, 7, 5 * DAY));
  });

  it('never lets condition fall without a named cause across random care, equipment, temperature and stocking', () => {
    const rng = random(307);
    let checked = 0, declines = 0;
    for (let trial = 0; trial < 12; trial++) {
      const world = scenarioWorld(10 + Math.floor(rng() * 51), { ration: RATION_KEYS[Math.floor(rng() * RATION_KEYS.length)], targetC: 16 + Math.floor(rng() * 15) },
        { filterMgNPerDay: FILTER_TIERS[Math.floor(rng() * 4)].mgNPerDay, aerationPerDay: AERATION_TIERS[Math.floor(rng() * 4)].perDay });
      advanceWorld(world, 0, 20 * DAY, report => {
        const before = new Map(report.before.fish.map(f => [f.id, f.life.condition]));
        for (const member of report.after.fish) {
          if (member.status !== 'living') continue;
          checked++;
          if (member.life.condition >= before.get(member.id)!) continue;
          declines++;
          expect(environmentLimits(report.environments.get(member.tankId)!)).not.toEqual([]);
        }
      });
    }
    expect(declines).toBeGreaterThan(100);
    expect(checked).toBeGreaterThan(declines);
  });

  it('demonstrates a healthy tank and a stressed tank that recovers by following its warnings', () => {
    const { healthy, stressed: stress } = careScenarios();
    expect(healthy.days).toHaveLength(SCENARIO_DAYS);
    expect(healthy.actions).toEqual([]);
    expect(healthy.days.every(day => !day.warnings.length && !day.limits.length)).toBe(true);
    expect(Math.min(...healthy.days.map(day => day.meanCondition))).toBe(1);
    expect(healthy.declines).toBe(0);

    const worst = stress.days[STRESS_DAYS - 1];
    expect(worst.warnings).toEqual(expect.arrayContaining(['oxygen', 'ammonia', 'temperature', 'leftovers']));
    expect(worst.meanCondition).toBeLessThan(0.5);
    // A legible decline: warnings appear while fish are still mostly well, and oxygen is low rather than gone.
    expect(stress.days[0].warnings.length).toBeGreaterThan(0);
    expect(stress.days[0].meanCondition).toBeGreaterThan(0.9);
    expect(Math.min(...stress.days.map(day => day.oxygenMgL))).toBeGreaterThan(3);
    expect(stress.days.findIndex(day => day.meanCondition < 0.75)).toBeGreaterThan(1);
    // Following the warnings turns condition upward straight away.
    const lowestDay = stress.days.reduce((low, day) => day.meanCondition < low.meanCondition ? day : low).day;
    expect(lowestDay).toBeLessThanOrEqual(stress.actions[0].day);
    expect(stress.declines).toBeGreaterThan(0);
    expect(stress.unexplainedDeclines).toBe(0);
    expect(stress.actions[0].day).toBe(STRESS_DAYS + 1);
    expect(stress.actions[0].fixes.length).toBeGreaterThan(2);
    expect(stress.actions.every(action => action.cost >= 0)).toBe(true);
    expect(stress.clearedOnDay).not.toBeNull();
    const last = stress.days.at(-1)!;
    expect(last.warnings).toEqual([]);
    expect(last.meanCondition).toBeGreaterThan(0.95);
    expect(last.meanCondition).toBeGreaterThan(worst.meanCondition);
    expect(careScenarios()).toEqual({ healthy, stressed: stress });
  });

  it('summarizes a protected absence per tank, and the observed catch-up equals the plain one', () => {
    let runtime = createRuntime(stressed(), 'absence-world');
    runtime = executeCommand(runtime, commandEnvelope(runtime, breedStudio, 20));
    const observer = absenceObserver(runtime.world), elapsed = 40 * 60_000;
    const observed = applyOfflineCatchup(runtime, 0, elapsed, observer.onDay);
    expect(observed).toEqual(applyOfflineCatchup(runtime, 0, elapsed));
    const summary = observer.summarize(observed.runtime.world), [garden, studio] = summary.tanks;
    expect(summary.gameDays).toBe(40);
    expect(summary.unexplainedDeclines).toBe(0);
    expect(garden).toMatchObject({ residents: 60, eggsHatched: 0, declined: 60 });
    expect(garden.limitDays.map(limit => limit.cause)).toEqual(expect.arrayContaining(['low oxygen', 'ammonia', 'temperature']));
    expect(garden.conditionAfter!).toBeLessThan(garden.conditionBefore!);
    expect(garden.warnings.map(warning => warning.code)).toEqual(expect.arrayContaining(['oxygen', 'ammonia']));
    expect(studio).toMatchObject({ residents: 20, eggsHatched: 20, declined: 0, limitDays: [], warnings: [], unexplainedDeclines: 0 });
    expect(studio.becameJuvenile + studio.becameAdult).toBeGreaterThan(0);
    expect(studio.lengthGainedCm).toBeGreaterThan(0);
    expect(quietTank(studio)).toBe(false);

    const calm = createRuntime(createWorld(NOW), 'calm-world'), capped = absenceObserver(calm.world);
    const catchUp = applyOfflineCatchup(calm, 0, OFFLINE_CAP_MS + 60 * 60_000, capped.onDay), calmSummary = capped.summarize(catchUp.runtime.world);
    expect(catchUp.window.remainingTicks).toBeGreaterThan(0);
    expect(calmSummary.gameDays).toBe(480);
    expect(calmSummary.tanks.every(quietTank)).toBe(true);
  });
});
