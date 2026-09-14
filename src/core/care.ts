import { clamp } from './random';
import type { Ration, Tank, TankCare, WaterState } from './types';
import { changeWater, STEP_DAYS, stepWater, temperatureFactor, waterSteps, type WaterLedger, type WaterLoad } from './water';

/**
 * Care model v1 (FS-305). Each tank has an auto-feeder, a filter and aeration tier, and a thermostat. Feeding shares one
 * food pool per tank, like the one-compartment water model: the feeder dispenses a ration of the residents' current
 * need, fish find and eat part of the food present up to that need, and the rest decays in the water. The share of the
 * need eaten over a game day becomes that day's nutrition for development. Steps use only basic arithmetic on fixed
 * absolute boundaries, so replay and every split of an interval agree exactly. Game rules, not aquarium-care advice.
 */
export const CARE_MODEL = 1;

/** Feeder rations as multiples of the residents' current need. */
export const RATIONS: Record<Ration, number> = { off: 0, light: 0.8, measured: 1, generous: 1.2, heavy: 1.6 };
export const RATION_KEYS = ['off', 'light', 'measured', 'generous', 'heavy'] as const satisfies readonly Ration[];
export const RATION_LABELS: Record<Ration, string> = { off: 'Off', light: 'Light', measured: 'Measured', generous: 'Generous', heavy: 'Heavy' };

export const CARE_RATES = {
  /** Food each kg of fish needs per game day at 20 °C and metabolism 1, grams. */
  foodNeedGPerKgDay: 10,
  /** Share of the food present that fish find and eat in one half-hour step, never beyond their need. */
  captureShare: 0.6,
  /** Excretion without food, mg ammonia N per kg per game day; with a full meal the total stays at the FS-301 100 mg. */
  fastingAmmoniaMgNPerKgDay: 40,
  /** Ammonia N excreted per gram eaten: (100 − 40) mg N per kg-day over 10 g of food per kg-day. */
  eatenAmmoniaMgNPerG: 6,
  /** Largest temperature change per half-hour step, °C. */
  thermostatStepC: 0.1,
  /** A manual portion is this many game days of the residents' need. */
  manualPortionDays: 0.25,
  /** Credits per cubic metre of replaced water. */
  waterChangeCreditsPerM3: 1,
} as const;

/** Buying a higher tier costs the price difference; lower tiers are free and nothing is refunded. */
export const FILTER_TIERS = [
  { label: 'Compact', mgNPerDay: 30_000, price: 0 },
  { label: 'Standard', mgNPerDay: 60_000, price: 150 },
  { label: 'Strong', mgNPerDay: 120_000, price: 400 },
  { label: 'Industrial', mgNPerDay: 240_000, price: 900 },
] as const;
export const AERATION_TIERS = [
  { label: 'Gentle', perDay: 12, price: 0 },
  { label: 'Standard', perDay: 24, price: 100 },
  { label: 'Strong', perDay: 36, price: 300 },
  { label: 'Maximum', perDay: 48, price: 650 },
] as const;
export const THERMOSTAT_RANGE = [16, 30] as const;
export const WATER_CHANGE_PERCENTS = [10, 25, 50] as const;
export type WaterChangePercent = typeof WATER_CHANGE_PERCENTS[number];

export function defaultCare(water: Pick<WaterState, 'temperatureC'>): TankCare {
  return { model: 1, ration: 'measured', targetC: clamp(Math.round(water.temperatureC), THERMOSTAT_RANGE[0], THERMOSTAT_RANGE[1]), dayNeedG: 0, dayEatenG: 0, fed: 1 };
}

export type CareSettings = { ration: Ration; filterTier: number; aerationTier: number; targetC: number };

/** Highest tier at or below a stored capacity; imported custom values read as the tier beneath them. */
const tierAtOrBelow = (values: readonly number[], value: number) => Math.max(0, values.filter(v => v <= value).length - 1);

export function careSettings(tank: Pick<Tank, 'water' | 'care'>): CareSettings {
  return {
    ration: tank.care.ration, targetC: tank.care.targetC,
    filterTier: tierAtOrBelow(FILTER_TIERS.map(t => t.mgNPerDay), tank.water.filterMgNPerDay),
    aerationTier: tierAtOrBelow(AERATION_TIERS.map(t => t.perDay), tank.water.aerationPerDay),
  };
}

/** Credits for moving from the tank's installed equipment to the requested tiers. */
export function careCost(tank: Pick<Tank, 'water' | 'care'>, next: CareSettings): number {
  const current = careSettings(tank);
  const upgrade = (prices: readonly number[], installed: number, wanted: number, exact: boolean) =>
    wanted === installed && exact ? 0 : Math.max(0, prices[wanted] - (exact ? prices[installed] : 0));
  const filterExact = FILTER_TIERS[current.filterTier].mgNPerDay === tank.water.filterMgNPerDay;
  const aerationExact = AERATION_TIERS[current.aerationTier].perDay === tank.water.aerationPerDay;
  return upgrade(FILTER_TIERS.map(t => t.price), current.filterTier, next.filterTier, filterExact)
    + upgrade(AERATION_TIERS.map(t => t.price), current.aerationTier, next.aerationTier, aerationExact);
}

export function applyCareSettings<T extends Pick<Tank, 'water' | 'care'>>(tank: T, next: CareSettings): T {
  return {
    ...tank,
    water: { ...tank.water, filterMgNPerDay: FILTER_TIERS[next.filterTier].mgNPerDay, aerationPerDay: AERATION_TIERS[next.aerationTier].perDay },
    care: { ...tank.care, ration: next.ration, targetC: next.targetC },
  };
}

export const waterChangeCost = (water: Pick<WaterState, 'volumeL'>, percent: number) =>
  Math.max(1, Math.round(water.volumeL / 1000 * percent / 100 * CARE_RATES.waterChangeCreditsPerM3));

export const applyWaterChange = (water: WaterState, percent: number) => changeWater(water, percent / 100);

/** Residents' load for one tank step: water load at 20 °C plus their daily food need at 20 °C. */
export type CareLoad = WaterLoad & { foodNeedGPerDay: number };
export type CareTank = { water: WaterState; care: TankCare };

/**
 * One half-hour step, in order: the feeder dispenses, fish eat up to their need, the water step runs with the eaten
 * food's excretion, then the thermostat moves the temperature. The ledger records food added and eaten.
 */
export function stepTank(tank: CareTank, load: CareLoad, ledger?: WaterLedger): CareTank {
  const { water, care } = tank, rate = temperatureFactor(water.temperatureC);
  const need = load.foodNeedGPerDay * rate * STEP_DAYS, dispensed = need * RATIONS[care.ration];
  const available = water.foodG + dispensed, eaten = Math.min(need, available * CARE_RATES.captureShare);
  if (ledger) { ledger.food.added += dispensed; ledger.food.eaten += eaten; }
  const stepped = stepWater({ ...water, foodG: available - eaten },
    { oxygenMgPerDay: load.oxygenMgPerDay, ammoniaMgNPerDay: load.ammoniaMgNPerDay, stepAmmoniaMgN: eaten * CARE_RATES.eatenAmmoniaMgNPerG }, ledger);
  const drift = clamp(care.targetC - stepped.temperatureC, -CARE_RATES.thermostatStepC, CARE_RATES.thermostatStepC);
  return {
    water: drift === 0 ? stepped : { ...stepped, temperatureC: stepped.temperatureC + drift },
    care: { ...care, dayNeedG: care.dayNeedG + need, dayEatenG: care.dayEatenG + eaten },
  };
}

export function integrateTank<T extends CareTank>(tank: T, load: CareLoad, fromTick: number, toTick: number, ledger?: WaterLedger): T {
  if (!Number.isSafeInteger(fromTick) || !Number.isSafeInteger(toTick) || toTick < fromTick) throw new Error('Care time cannot move backwards.');
  let current: CareTank = { water: tank.water, care: tank.care };
  for (let step = waterSteps(fromTick, toTick); step > 0; step--) current = stepTank(current, load, ledger);
  return { ...tank, water: current.water, care: current.care };
}

/** At a game-day boundary: record the share of need eaten, then start a new feeding day. A tank with no need counts as fed. */
export function closeCareDay(care: TankCare): TankCare {
  return { ...care, fed: care.dayNeedG > 0 ? Math.min(1, care.dayEatenG / care.dayNeedG) : 1, dayNeedG: 0, dayEatenG: 0 };
}
