import { clamp } from './random';
import type { WaterState } from './types';

/**
 * Water model v1 (FS-301): one well-mixed compartment per tank. Rates are game approximations with explicit units, not
 * aquarium-care advice. Steps use only +, −, × and ÷ and fixed boundaries aligned to absolute ticks, so any split of the
 * same interval, and any browser, produces identical saved values for replay validation.
 */
export const WATER_MODEL = 1;
/** Care time runs at one game day per 60 real seconds at 1× (GDD §4 pacing hypothesis). Motion speed never changes it. */
export const TICKS_PER_GAME_DAY = 1200;
/** Half a game hour. Aeration and decay are capped per step, so no step can overshoot. */
export const WATER_STEP_TICKS = 25;
export const STEP_DAYS = WATER_STEP_TICKS / TICKS_PER_GAME_DAY;

export const WATER_RATES = {
  /** Fish oxygen use at 20 °C for average metabolism, mg O₂ per kg of fish per game day. */
  oxygenMgPerKgDay: 6_000,
  /** Basal fish excretion, mg ammonia nitrogen per kg per game day. */
  ammoniaMgNPerKgDay: 100,
  /** Uneaten food breakdown, fraction per game day at 20 °C. */
  foodDecayPerDay: 2,
  /** Ammonia nitrogen released per gram of decayed food. */
  foodAmmoniaMgNPerG: 50,
  /** Oxygen consumed per gram of decayed food. */
  foodOxygenMgPerG: 1_000,
  /** Oxygen consumed per mg of ammonia nitrogen nitrified by the biofilter. */
  nitrificationOxygenPerN: 4.57,
  /** Ammonia concentration at which the biofilter runs at half capacity, mg N/L. */
  filterHalfSaturationMgL: 0.5,
  /** Dissolved oxygen at which nitrification runs at half speed, mg/L. */
  filterOxygenHalfMgL: 2,
} as const;

/** A pond-scale lab tank: a full tank of average adult lab fish keeps good oxygen and clean water with this equipment. */
export const WATER_DEFAULTS = { volumeL: 20_000, temperatureC: 22, filterMgNPerDay: 60_000, aerationPerDay: 24 } as const;

/** Save bounds. Aeration × step never exceeds 1, which keeps oxygen from overshooting saturation. */
export const WATER_LIMITS = {
  volumeL: [100, 200_000], temperatureC: [4, 35], oxygenMgL: [0, 30], ammoniaMgL: [0, 1_000_000], foodG: [0, 10_000_000],
  filterMgNPerDay: [0, 10_000_000], aerationPerDay: [0, 48], changeFraction: [0.01, 0.9], foodPortionG: [0, 100_000],
} as const;

/** Player-facing bands. These are game thresholds, not real water-quality guidance. */
export const WATER_THRESHOLDS = { oxygenGood: 6, oxygenLow: 4, ammoniaElevated: 0.5, ammoniaHigh: 1.5 } as const;

/** Fresh-water oxygen saturation at one atmosphere, mg/L; a cubic fit for 0–35 °C. */
export function oxygenSaturationMgL(temperatureC: number): number {
  return ((-0.000077774 * temperatureC + 0.007991) * temperatureC - 0.41022) * temperatureC + 14.652;
}

/** Biological rate multiplier: a linear stand-in for Q10 ≈ 2, bounded so extremes stay predictable. */
export const temperatureFactor = (temperatureC: number) => clamp(1 + 0.07 * (temperatureC - 20), 0.5, 2);

export function defaultWater(): WaterState {
  const { volumeL, temperatureC, filterMgNPerDay, aerationPerDay } = WATER_DEFAULTS;
  return { model: 1, volumeL, temperatureC, oxygenMgL: oxygenSaturationMgL(temperatureC), ammoniaMgL: 0, foodG: 0, filterMgNPerDay, aerationPerDay };
}

/** Residents' oxygen use and ammonia excretion at 20 °C. */
export type WaterLoad = { oxygenMgPerDay: number; ammoniaMgNPerDay: number };
export const NO_LOAD: WaterLoad = { oxygenMgPerDay: 0, ammoniaMgNPerDay: 0 };

/** Cumulative fluxes for conservation checks: oxygen and ammonia in mg, food in g. Aeration and oxygen exchange are net. */
export type WaterLedger = {
  oxygen: { aeration: number; exchange: number; respiration: number; foodDecay: number; nitrification: number; unmet: number };
  ammonia: { excretion: number; foodDecay: number; nitrification: number; exchange: number };
  food: { added: number; decayed: number; removed: number };
  steps: number;
};
export const emptyLedger = (): WaterLedger => ({
  oxygen: { aeration: 0, exchange: 0, respiration: 0, foodDecay: 0, nitrification: 0, unmet: 0 },
  ammonia: { excretion: 0, foodDecay: 0, nitrification: 0, exchange: 0 },
  food: { added: 0, decayed: 0, removed: 0 },
  steps: 0,
});

/** One fixed step. Every flux is limited by what is present, so no quantity goes negative. */
export function stepWater(state: WaterState, load: WaterLoad, ledger?: WaterLedger): WaterState {
  const litres = state.volumeL, rate = temperatureFactor(state.temperatureC), saturated = oxygenSaturationMgL(state.temperatureC);
  // Uneaten food breaks down, releasing ammonia and consuming oxygen.
  const decayed = state.foodG * Math.min(1, WATER_RATES.foodDecayPerDay * rate * STEP_DAYS);
  const excreted = load.ammoniaMgNPerDay * rate * STEP_DAYS, fromFood = decayed * WATER_RATES.foodAmmoniaMgNPerG;
  let ammonia = state.ammoniaMgL * litres + excreted + fromFood;
  // The biofilter saturates at high ammonia and slows when oxygen is low.
  const concentration = ammonia / litres, oxygenLimit = state.oxygenMgL / (state.oxygenMgL + WATER_RATES.filterOxygenHalfMgL);
  const nitrified = Math.min(ammonia, state.filterMgNPerDay * rate * STEP_DAYS * oxygenLimit * concentration / (concentration + WATER_RATES.filterHalfSaturationMgL));
  ammonia -= nitrified;
  // Aeration moves oxygen toward saturation; respiration, decay and nitrification draw on what is available.
  const aeration = Math.min(1, state.aerationPerDay * STEP_DAYS) * (saturated - state.oxygenMgL) * litres;
  const respiration = load.oxygenMgPerDay * rate * STEP_DAYS, decay = decayed * WATER_RATES.foodOxygenMgPerG, nitrification = nitrified * WATER_RATES.nitrificationOxygenPerN;
  const demand = respiration + decay + nitrification, available = state.oxygenMgL * litres + aeration;
  const supplied = Math.min(demand, available), share = demand > 0 ? supplied / demand : 0;
  if (ledger) {
    ledger.oxygen.aeration += aeration;
    ledger.oxygen.respiration += respiration * share;
    ledger.oxygen.foodDecay += decay * share;
    ledger.oxygen.nitrification += nitrification * share;
    ledger.oxygen.unmet += demand - supplied;
    ledger.ammonia.excretion += excreted;
    ledger.ammonia.foodDecay += fromFood;
    ledger.ammonia.nitrification += nitrified;
    ledger.food.decayed += decayed;
    ledger.steps++;
  }
  return { ...state, oxygenMgL: (available - supplied) / litres, ammoniaMgL: ammonia / litres, foodG: state.foodG - decayed };
}

/** Fixed steps whose boundaries fall in (fromTick, toTick]. */
export const waterSteps = (fromTick: number, toTick: number) => Math.floor(toTick / WATER_STEP_TICKS) - Math.floor(fromTick / WATER_STEP_TICKS);

export function integrateWater(state: WaterState, load: WaterLoad, fromTick: number, toTick: number, ledger?: WaterLedger): WaterState {
  if (!Number.isSafeInteger(fromTick) || !Number.isSafeInteger(toTick) || toTick < fromTick) throw new Error('Water time cannot move backwards.');
  let current = state;
  for (let step = waterSteps(fromTick, toTick); step > 0; step--) current = stepWater(current, load, ledger);
  return current;
}

/** Replace a fraction of the water with clean, oxygen-saturated water at the tank temperature; uneaten food is siphoned in proportion. */
export function changeWater(state: WaterState, fraction: number, ledger?: WaterLedger): WaterState {
  const [minimum, maximum] = WATER_LIMITS.changeFraction;
  if (!(fraction >= minimum && fraction <= maximum)) throw new Error('Change between 1% and 90% of the water.');
  const litres = state.volumeL, saturated = oxygenSaturationMgL(state.temperatureC);
  const removedOxygen = state.oxygenMgL * litres * fraction, addedOxygen = saturated * litres * fraction;
  const removedAmmonia = state.ammoniaMgL * litres * fraction, removedFood = state.foodG * fraction;
  if (ledger) {
    ledger.oxygen.exchange += addedOxygen - removedOxygen;
    ledger.ammonia.exchange += removedAmmonia;
    ledger.food.removed += removedFood;
  }
  return {
    ...state, oxygenMgL: (state.oxygenMgL * litres - removedOxygen + addedOxygen) / litres,
    ammoniaMgL: (state.ammoniaMgL * litres - removedAmmonia) / litres, foodG: state.foodG - removedFood,
  };
}

export function addFood(state: WaterState, grams: number, ledger?: WaterLedger): WaterState {
  if (!(Number.isFinite(grams) && grams > 0 && grams <= WATER_LIMITS.foodPortionG[1])) throw new Error('Add a food portion between 0 and 100 kg.');
  if (ledger) ledger.food.added += grams;
  return { ...state, foodG: state.foodG + grams };
}

export type OxygenLevel = 'good' | 'low' | 'critical';
export type AmmoniaLevel = 'clean' | 'elevated' | 'high';

export function waterStatus(state: WaterState): { oxygen: OxygenLevel; ammonia: AmmoniaLevel } {
  const t = WATER_THRESHOLDS;
  return {
    oxygen: state.oxygenMgL >= t.oxygenGood ? 'good' : state.oxygenMgL >= t.oxygenLow ? 'low' : 'critical',
    ammonia: state.ammoniaMgL < t.ammoniaElevated ? 'clean' : state.ammoniaMgL < t.ammoniaHigh ? 'elevated' : 'high',
  };
}
