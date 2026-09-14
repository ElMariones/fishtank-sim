import { AERATION_TIERS, careSettings, FILTER_TIERS, type CareSettings } from './care';
import { careWarnings, sameSettings, type CareWarningCode } from './careAdvice';
import { adultLife, environmentLimits } from './development';
import { founderGenome } from './genetics';
import { advanceWorld, type DayReport } from './habitat';
import type { Fish, TankCare, WaterState, World } from './types';
import { TICKS_PER_GAME_DAY } from './water';
import { applyCommand, createWorld } from './world';

/**
 * Care scenarios (FS-307): two seeded tanks run through the ordinary world advance. The healthy tank keeps default care.
 * The stressed tank starts overfed, under-equipped and warm; from day 15 a simulated keeper applies the fixes named by
 * the care warnings, then reviews every five days while any warning remains. Nothing reads or writes a player's world.
 */
export const SCENARIO_DAYS = 40;
export const STRESS_DAYS = 15;
export const REVIEW_EVERY_DAYS = 5;
const TIMESTAMP = '2026-09-14T00:00:00.000Z';
const TANK = 'tank-1';

export type ScenarioDay = {
  day: number; oxygenMgL: number; ammoniaMgL: number; fed: number; temperatureC: number;
  meanCondition: number; limits: string[]; warnings: CareWarningCode[];
};
export type ScenarioAction = { day: number; fixes: string[]; cost: number };
export type CareScenario = {
  id: 'healthy' | 'stressed'; label: string; description: string; fish: number; biomassKg: number;
  days: ScenarioDay[]; actions: ScenarioAction[];
  /** Fish-days whose condition fell, and how many of those had no named cause. */
  declines: number; unexplainedDeclines: number;
  /** First review day after which no warning remained, or null. */
  clearedOnDay: number | null;
};

/** The first tank holding `count` founder-distribution adults with the given care and water; the second tank stays empty. */
export function scenarioWorld(count: number, care: Partial<TankCare> = {}, water: Partial<WaterState> = {}): World {
  const base = createWorld(TIMESTAMP);
  const fish = Array.from({ length: count }, (_, i): Fish => {
    const genome = founderGenome(9000 + i);
    return { ...base.fish[0], id: `FSH-${String(i + 1).padStart(6, '0')}`, name: `Fish ${i + 1}`, sex: i % 2 ? 'M' : 'F', genome, tankId: TANK, life: adultLife(genome) };
  });
  const [first, second] = base.tanks;
  return { ...base, nextId: count + 1, fish, tanks: [{ ...first, water: { ...first.water, ...water }, care: { ...first.care, ...care } }, second] };
}

/**
 * Applies every settings fix and the water change named by the tank's current warnings, through ordinary commands.
 * Settings suggested by different warnings are merged field by field.
 */
export function applyCareFixes(world: World, tankId: string): { world: World; fixes: string[]; cost: number } {
  const tank = world.tanks.find(t => t.id === tankId);
  if (!tank) throw new Error('Tank not found.');
  const fixes = careWarnings(world, tankId).flatMap(warning => warning.fixes), current = careSettings(tank), target: CareSettings = { ...current }, labels = new Set<string>();
  for (const fix of fixes) {
    if (fix.kind !== 'settings') continue;
    // Warnings can suggest the same change (cooling appears under oxygen and temperature); list each change once.
    const changes = (['ration', 'filterTier', 'aerationTier', 'targetC'] as const).filter(key => fix.settings[key] !== current[key] && target[key] === current[key]);
    if (!changes.length) continue;
    labels.add(fix.label);
    for (const key of changes) (target as Record<typeof key, unknown>)[key] = fix.settings[key];
  }
  let next = world;
  if (!sameSettings(target, current)) next = applyCommand(next, { type: 'set-care', tankId, ...target });
  const change = fixes.find(fix => fix.kind === 'water-change');
  if (change?.kind === 'water-change') { next = applyCommand(next, { type: 'change-water', tankId, percent: change.percent }); labels.add(change.label); }
  return { world: next, fixes: [...labels], cost: world.credits - next.credits };
}

function run(id: CareScenario['id'], label: string, description: string, start: World): CareScenario {
  let world = start, tick = 0, declines = 0, unexplainedDeclines = 0, clearedOnDay: number | null = null, lastLimits: string[] = [];
  const days: ScenarioDay[] = [], actions: ScenarioAction[] = [];
  const onDay = (report: DayReport) => {
    const environment = report.environments.get(TANK)!;
    lastLimits = environmentLimits(environment);
    const before = new Map(report.before.fish.map(f => [f.id, f.life.condition]));
    for (const member of report.after.fish) {
      if (member.tankId !== TANK || member.life.condition >= (before.get(member.id) ?? member.life.condition)) continue;
      declines++;
      if (!lastLimits.length) unexplainedDeclines++;
    }
  };
  for (let day = 1; day <= SCENARIO_DAYS; day++) {
    if (day > STRESS_DAYS && (day - STRESS_DAYS - 1) % REVIEW_EVERY_DAYS === 0 && careWarnings(world, TANK).length) {
      const applied = applyCareFixes(world, TANK);
      world = applied.world;
      actions.push({ day, fixes: applied.fixes, cost: applied.cost });
    }
    world = advanceWorld(world, tick, tick + TICKS_PER_GAME_DAY, onDay);
    tick += TICKS_PER_GAME_DAY;
    const tank = world.tanks[0], residents = world.fish.filter(f => f.tankId === TANK && f.status === 'living');
    const warnings = careWarnings(world, TANK).map(warning => warning.code);
    if (clearedOnDay === null && actions.length && !warnings.length) clearedOnDay = day;
    days.push({
      day, oxygenMgL: tank.water.oxygenMgL, ammoniaMgL: tank.water.ammoniaMgL, fed: tank.care.fed, temperatureC: tank.water.temperatureC,
      meanCondition: residents.reduce((sum, f) => sum + f.life.condition, 0) / Math.max(1, residents.length), limits: lastLimits, warnings,
    });
  }
  const residents = start.fish.filter(f => f.tankId === TANK);
  return {
    id, label, description, fish: residents.length, biomassKg: residents.reduce((sum, f) => sum + 0.0000148 * f.life.lengthCm ** 3, 0),
    days, actions, declines, unexplainedDeclines, clearedOnDay,
  };
}

export function careScenarios(): { healthy: CareScenario; stressed: CareScenario } {
  return {
    healthy: run('healthy', 'Healthy tank', '30 adults, measured rations, standard filter and aeration, 22 °C.', scenarioWorld(30)),
    // Tuned so problems build over days rather than crashing at once, and condition turns upward after the first review.
    stressed: run('stressed', 'Stressed tank, then recovery', `45 adults, generous rations, ${FILTER_TIERS[0].label.toLowerCase()} filter, ${AERATION_TIERS[1].label.toLowerCase()} aeration and a 28 °C thermostat for ${STRESS_DAYS} days; then the warnings' fixes, reviewed every ${REVIEW_EVERY_DAYS} days.`,
      scenarioWorld(45, { ration: 'generous', targetC: 28 }, { filterMgNPerDay: FILTER_TIERS[0].mgNPerDay, aerationPerDay: AERATION_TIERS[1].perDay })),
  };
}
