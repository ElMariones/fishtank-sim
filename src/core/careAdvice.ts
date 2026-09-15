import {
  AERATION_TIERS, applyCareSettings, applyWaterChange, careCost, careSettings, FILTER_TIERS, RATION_KEYS, RATION_LABELS, waterChangeCost,
  type CareSettings, type WaterChangePercent,
} from './care';
import { environmentLimits, GROWTH_REFERENCE_C, temperatureComfort } from './development';
import { advanceWorld, stocking, tankEnvironment, tankLoad, type StockingLevel } from './habitat';
import { TANK_PRICE } from './tankManagement';
import type { Tank, World } from './types';
import { temperatureFactor, TICKS_PER_GAME_DAY, WATER_THRESHOLDS, waterStatus, type AmmoniaLevel, type OxygenLevel } from './water';
import { MAX_TANKS, type Command } from './world';

/**
 * Care advice (FS-305): the tank's current status, warnings that name corrective actions with their costs, and
 * projections that preview an action's effect by running the same deterministic advance on a copy of the tank.
 * Nothing here changes the world; the UI applies a chosen action through an ordinary validated command.
 */

export type FedLevel = 'fed' | 'underfed' | 'starving';
/** Fed share bands: 85% or more is fully fed for development; below 50% is starving. */
export const FED_THRESHOLDS = { fed: 0.85, underfed: 0.5 } as const;
export const fedLevel = (fed: number): FedLevel => fed >= FED_THRESHOLDS.fed ? 'fed' : fed >= FED_THRESHOLDS.underfed ? 'underfed' : 'starving';
/** Uneaten food above this share of a day's need counts as leftovers fouling the water. */
export const LEFTOVER_SHARE = 0.05;
export const COMFORT_RANGE = [18, 26] as const;

export type CareStatus = {
  tankId: string; oxygen: OxygenLevel; ammonia: AmmoniaLevel; stocking: StockingLevel; densityKgM3: number;
  fed: number; fedLevel: FedLevel; temperatureC: number; targetC: number; comfort: number;
  residents: number; hatched: number; biomassKg: number; needGPerDay: number; leftovers: boolean;
  limits: string[]; settings: CareSettings;
};

const findTank = (world: World, tankId: string): Tank => {
  const tank = world.tanks.find(t => t.id === tankId);
  if (!tank) throw new Error('Tank not found.');
  return tank;
};

export function careStatus(world: World, tankId: string): CareStatus {
  const tank = findTank(world, tankId), load = tankLoad(world.fish, tankId), bands = waterStatus(tank.water), stock = stocking(load, tank.water);
  const needGPerDay = load.foodNeedGPerDay * temperatureFactor(tank.water.temperatureC);
  return {
    tankId, oxygen: bands.oxygen, ammonia: bands.ammonia, stocking: stock.level, densityKgM3: stock.densityKgM3,
    fed: tank.care.fed, fedLevel: fedLevel(tank.care.fed), temperatureC: tank.water.temperatureC, targetC: tank.care.targetC,
    comfort: temperatureComfort(tank.water.temperatureC), residents: load.fish, hatched: load.hatched, biomassKg: load.biomassKg, needGPerDay,
    leftovers: tank.water.foodG > Math.max(1, needGPerDay * LEFTOVER_SHARE), limits: environmentLimits(tankEnvironment(tank, load)), settings: careSettings(tank),
  };
}

export type CareFix =
  | { kind: 'settings'; label: string; settings: CareSettings; cost: number }
  | { kind: 'water-change'; label: string; percent: WaterChangePercent; cost: number }
  | { kind: 'command'; label: string; command: Command; cost: number }
  | { kind: 'hint'; label: string };
export type CareWarningCode = 'oxygen' | 'ammonia' | 'temperature' | 'crowding' | 'underfed' | 'leftovers';
export type CareWarning = { code: CareWarningCode; severity: 'warning' | 'critical'; title: string; detail: string; affected: number; fixes: CareFix[] };

const rationIndex = (settings: CareSettings) => RATION_KEYS.indexOf(settings.ration);
const MEASURED = RATION_KEYS.indexOf('measured');

/** Warnings, most severe first, each naming what to change. An empty list means nothing is limiting this tank's residents. */
export function careWarnings(world: World, tankId: string): CareWarning[] {
  const tank = findTank(world, tankId), status = careStatus(world, tankId), s = status.settings;
  const settingsFix = (label: string, patch: Partial<CareSettings>): CareFix => {
    const settings = { ...s, ...patch };
    return { kind: 'settings', label, settings, cost: careCost(tank, settings) };
  };
  const waterFix = (percent: WaterChangePercent): CareFix => ({ kind: 'water-change', label: `Change ${percent}% of the water`, percent, cost: waterChangeCost(tank.water, percent) });
  const lessFood = rationIndex(s) > MEASURED ? [settingsFix('Feed measured rations', { ration: 'measured' })] : [];
  const affected = `${status.residents} fish affected.`;
  const warnings: CareWarning[] = [];

  if (status.oxygen !== 'good') {
    const fixes: CareFix[] = [];
    if (s.aerationTier < AERATION_TIERS.length - 1) {
      const next = AERATION_TIERS[s.aerationTier + 1];
      fixes.push(settingsFix(`Upgrade aeration to ${next.label} (${next.perDay}/day)`, { aerationTier: s.aerationTier + 1 }));
    }
    fixes.push(...lessFood);
    if (s.targetC > GROWTH_REFERENCE_C) fixes.push(settingsFix(`Cool the water to ${GROWTH_REFERENCE_C} °C; warm water holds less oxygen`, { targetC: GROWTH_REFERENCE_C }));
    if (status.stocking === 'heavy' || status.stocking === 'overstocked') fixes.push({ kind: 'hint', label: 'Move some fish to another aquarium' });
    warnings.push({ code: 'oxygen', severity: status.oxygen === 'critical' ? 'critical' : 'warning', title: `Oxygen ${status.oxygen}`,
      detail: `${tank.water.oxygenMgL.toFixed(1)} mg/L; fish do best at ${WATER_THRESHOLDS.oxygenGood} mg/L or more. ${affected}`, affected: status.residents, fixes });
  }
  if (status.ammonia !== 'clean') {
    const fixes: CareFix[] = [waterFix(status.ammonia === 'high' ? 50 : 25)];
    if (s.filterTier < FILTER_TIERS.length - 1) {
      const next = FILTER_TIERS[s.filterTier + 1];
      fixes.push(settingsFix(`Upgrade the filter to ${next.label}`, { filterTier: s.filterTier + 1 }));
    }
    fixes.push(...lessFood);
    warnings.push({ code: 'ammonia', severity: status.ammonia === 'high' ? 'critical' : 'warning', title: `Ammonia ${status.ammonia}`,
      detail: `${tank.water.ammoniaMgL.toFixed(2)} mg N/L; clean water stays below ${WATER_THRESHOLDS.ammoniaElevated}. ${affected}`, affected: status.residents, fixes });
  }
  if (status.comfort < 1) {
    const fixes: CareFix[] = s.targetC >= COMFORT_RANGE[0] && s.targetC <= COMFORT_RANGE[1]
      ? [{ kind: 'hint', label: `The thermostat is bringing the water to ${s.targetC} °C` }]
      : [settingsFix(`Set the thermostat to ${GROWTH_REFERENCE_C} °C`, { targetC: GROWTH_REFERENCE_C })];
    warnings.push({ code: 'temperature', severity: status.comfort < 0.6 ? 'critical' : 'warning', title: status.temperatureC > COMFORT_RANGE[1] ? 'Water too warm' : 'Water too cold',
      detail: `${status.temperatureC.toFixed(1)} °C is outside the comfortable ${COMFORT_RANGE[0]}–${COMFORT_RANGE[1]} °C. ${affected}`, affected: status.residents, fixes });
  }
  if (status.stocking === 'heavy' || status.stocking === 'overstocked') {
    // Tanks are paid since FS-503, so a new aquarium is a reviewed purchase in Habitat & expansion, never a one-click fix.
    const fixes: CareFix[] = [{ kind: 'hint', label: 'Move, sell or rehome some fish; moving and rehoming are free' }];
    if (world.tanks.length < MAX_TANKS) fixes.push({ kind: 'hint', label: `Or buy an aquarium in Habitat & expansion (◈ ${TANK_PRICE}) to move fish into` });
    warnings.push({ code: 'crowding', severity: status.stocking === 'overstocked' ? 'critical' : 'warning', title: status.stocking === 'overstocked' ? 'Overstocked' : 'Crowded',
      detail: `${status.densityKgM3.toFixed(1)} kg of fish per m³; growth slows above 8. ${affected}`, affected: status.residents, fixes });
  }
  if (status.hatched > 0 && status.fedLevel !== 'fed') {
    const fixes: CareFix[] = rationIndex(s) < MEASURED ? [settingsFix('Feed measured rations', { ration: 'measured' })] : [];
    fixes.push({ kind: 'command', label: 'Feed a portion now', command: { type: 'feed', tankId }, cost: 0 });
    warnings.push({ code: 'underfed', severity: status.fedLevel === 'starving' ? 'critical' : 'warning', title: status.fedLevel === 'starving' ? 'Starving' : 'Underfed',
      detail: `Fish ate ${Math.round(status.fed * 100)}% of what they needed over the last game day (${RATION_LABELS[s.ration].toLowerCase()} rations). ${status.hatched} hatched fish affected.`,
      affected: status.hatched, fixes });
  }
  if (status.leftovers) {
    warnings.push({ code: 'leftovers', severity: 'warning', title: 'Uneaten food',
      detail: `About ${Math.round(tank.water.foodG).toLocaleString('en')} g of food is decaying, which uses oxygen and adds ammonia.`, affected: 0, fixes: [...lessFood, waterFix(10)] });
  }
  // No-money recovery (FS-504): when every priced fix is out of reach, name one that costs nothing.
  for (const warning of warnings) {
    if (warning.fixes.some(fix => fix.kind === 'hint' || fix.kind === 'command' || fix.cost <= world.credits)) continue;
    warning.fixes.push({ kind: 'hint', label: warning.code === 'leftovers'
      ? 'Without credits: set a lighter feeder ration for a while, which is free'
      : 'Without credits: move or rehome some fish to lower the load, which is free' });
  }
  return warnings.sort((a, b) => Number(b.severity === 'critical') - Number(a.severity === 'critical'));
}

export type CareChange = { settings?: CareSettings; waterChangePercent?: WaterChangePercent };
export type CareProjection = {
  days: number; oxygenMgL: number; ammoniaMgL: number; foodG: number; temperatureC: number; fed: number;
  oxygen: OxygenLevel; ammonia: AmmoniaLevel; fedLevel: FedLevel; meanCondition: number | null;
};

/**
 * Runs the ordinary world advance on a copy holding only this tank and its residents, after applying the change. The
 * projection matches applying the same change and letting the same time pass, as long as nothing else happens meanwhile.
 */
export function projectTank(world: World, tankId: string, fromTick: number, days: number, change: CareChange = {}): CareProjection {
  const tank = findTank(world, tankId);
  let adjusted = change.settings ? applyCareSettings(tank, change.settings) : tank;
  if (change.waterChangePercent) adjusted = { ...adjusted, water: applyWaterChange(adjusted.water, change.waterChangePercent) };
  const residents = world.fish.filter(f => f.status === 'living' && f.tankId === tankId);
  // No clutches: a preview must never court, spawn or reserve anything.
  const later = advanceWorld({ ...world, tanks: [adjusted], fish: residents, clutches: [] }, fromTick, fromTick + days * TICKS_PER_GAME_DAY);
  const { water, care } = later.tanks[0], bands = waterStatus(water);
  return {
    days, oxygenMgL: water.oxygenMgL, ammoniaMgL: water.ammoniaMgL, foodG: water.foodG, temperatureC: water.temperatureC, fed: care.fed,
    oxygen: bands.oxygen, ammonia: bands.ammonia, fedLevel: fedLevel(care.fed),
    meanCondition: later.fish.length ? later.fish.reduce((sum, f) => sum + f.life.condition, 0) / later.fish.length : null,
  };
}

export const sameSettings = (a: CareSettings, b: CareSettings) =>
  a.ration === b.ration && a.filterTier === b.filterTier && a.aerationTier === b.aerationTier && a.targetC === b.targetC;
