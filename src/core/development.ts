import { metabolicPotential } from './genetics';
import type { Genome, LifeState, WaterState } from './types';
import { WATER_THRESHOLDS } from './water';

/**
 * Life model v1 (FS-302). Eggs hatch after a fixed incubation. Fry and juveniles grow logistically toward their genetic
 * adult length, and condition carries recent water quality, temperature, crowding and feeding (FS-305) forward, so
 * deficits and recovery both take days. Development runs once per game day on absolute day boundaries with basic
 * arithmetic, like the water model. Condition is the health measure: it only falls when a named factor limits it.
 * Disease and death are not simulated.
 */
export const LIFE_MODEL = 1;
export const INCUBATION_DAYS = 3;
export const HATCH_LENGTH_CM = 0.6;
/** Logistic growth per game day at growth potential 1 and full condition: adulthood about 22 days after hatching. */
export const GROWTH_PER_DAY = 0.27;
/** Share of the gap between condition and today's environment that closes each game day. */
export const CONDITION_RESPONSE = 0.25;
/** Stage thresholds as shares of adult length potential. */
export const FRY_UNTIL = 0.1;
export const ADULT_FROM = 0.7;
export const GAME_DAYS_PER_YEAR = 365;
/** Founders, unrelated stock and fish from older saves are young adults at their adult length potential. */
export const STOCK_AGE_DAYS = 30;
/** Nutrition when no feeding record applies (direct fixtures): fully fed. */
export const LAB_NUTRITION = 1;
/** Water at this temperature neither speeds nor slows growth. */
export const GROWTH_REFERENCE_C = 22;

export type LifeStage = 'egg' | 'fry' | 'juvenile' | 'adult' | 'elderly';
export type Potential = ReturnType<typeof metabolicPotential>;

export const eggLife = (): LifeState => ({ model: 1, ageDays: 0, lengthCm: 0, condition: 1 });
export const adultLife = (genome: Genome): LifeState => ({ model: 1, ageDays: STOCK_AGE_DAYS, lengthCm: metabolicPotential(genome).adultLengthCm, condition: 1 });
export const isEgg = (life: LifeState) => life.lengthCm === 0;
export const daysToHatch = (life: LifeState) => isEgg(life) ? Math.max(0, INCUBATION_DAYS - life.ageDays) : 0;

export function lifeStage(life: LifeState, potential: Pick<Potential, 'adultLengthCm' | 'longevityYears'>): LifeStage {
  if (isEgg(life)) return 'egg';
  if (life.ageDays >= potential.longevityYears * GAME_DAYS_PER_YEAR) return 'elderly';
  if (life.lengthCm < FRY_UNTIL * potential.adultLengthCm) return 'fry';
  return life.lengthCm < ADULT_FROM * potential.adultLengthCm ? 'juvenile' : 'adult';
}

type Curve = readonly (readonly [number, number])[];

/** Straight lines between points sorted by x; flat beyond the first and last points. */
function along(points: Curve, x: number): number {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    if (x <= points[i][0]) {
      const [x0, y0] = points[i - 1], [x1, y1] = points[i];
      return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
    }
  }
  return points[points.length - 1][1];
}

/** Environment factors 0–1 by measure. Game curves, not husbandry guidance. */
export const ENVIRONMENT_CURVES = {
  /** Dissolved oxygen, mg/L. */
  oxygen: [[0, 0.1], [WATER_THRESHOLDS.oxygenLow, 0.6], [WATER_THRESHOLDS.oxygenGood, 1]],
  /** Ammonia nitrogen, mg N/L. */
  ammonia: [[WATER_THRESHOLDS.ammoniaElevated, 1], [WATER_THRESHOLDS.ammoniaHigh, 0.6], [4, 0.1]],
  /** Stocking, kg of fish per m³. */
  crowding: [[8, 1], [12, 0.8], [24, 0.4]],
  /** Water temperature, °C: comfortable from 18 to 26 °C (FS-305). */
  temperature: [[8, 0.2], [18, 1], [26, 1], [34, 0.2]],
  /** Share of the day's food need eaten (FS-305): 85% or more counts as fully fed. */
  nutrition: [[0, 0.1], [0.5, 0.55], [0.85, 1]],
} as const satisfies Record<string, Curve>;

/** Nutrition factor for a fed share of the day's need. */
export const nutritionFactor = (fed: number) => along(ENVIRONMENT_CURVES.nutrition, fed);
export const temperatureComfort = (temperatureC: number) => along(ENVIRONMENT_CURVES.temperature, temperatureC);
/** Warmer water speeds growth and cooler water slows it, 4% per °C from 22 °C, bounded; oxygen is the cost. */
export const temperatureGrowth = (temperatureC: number) => Math.min(1.2, Math.max(0.8, 1 + 0.04 * (temperatureC - GROWTH_REFERENCE_C)));

export type Environment = { oxygen: number; ammonia: number; temperature: number; crowding: number; nutrition: number; overall: number; growth: number };

export function environmentFor(water: WaterState, densityKgM3: number, nutrition = LAB_NUTRITION): Environment {
  const oxygen = along(ENVIRONMENT_CURVES.oxygen, water.oxygenMgL), ammonia = along(ENVIRONMENT_CURVES.ammonia, water.ammoniaMgL);
  const temperature = temperatureComfort(water.temperatureC), crowding = along(ENVIRONMENT_CURVES.crowding, densityKgM3);
  return { oxygen, ammonia, temperature, crowding, nutrition, overall: Math.min(oxygen, ammonia, temperature) * crowding * nutrition, growth: temperatureGrowth(water.temperatureC) };
}

/**
 * Plain-language limits, most severe first. Every factor in `overall` is listed here, so condition can only fall while
 * this list names at least one cause (FS-307: no unexplained decay).
 */
export function environmentLimits(environment: Environment): string[] {
  const factors: [string, number][] = [['low oxygen', environment.oxygen], ['ammonia', environment.ammonia], ['temperature', environment.temperature],
    ['crowding', environment.crowding], ['underfeeding', environment.nutrition]];
  return factors.filter(([, factor]) => factor < 1).sort((a, b) => a[1] - b[1]).map(([name]) => name);
}

/** One game day. Length never decreases and never exceeds the genetic adult length; eggs hatch on schedule. */
export function developDay(life: LifeState, potential: Pick<Potential, 'adultLengthCm' | 'growth'>, environment: Environment): LifeState {
  const ageDays = life.ageDays + 1;
  const condition = life.condition + (environment.overall - life.condition) * CONDITION_RESPONSE;
  if (isEgg(life)) return { model: 1, ageDays, lengthCm: ageDays >= INCUBATION_DAYS ? HATCH_LENGTH_CM : 0, condition };
  const adult = potential.adultLengthCm, length = life.lengthCm;
  const growth = GROWTH_PER_DAY * potential.growth * environment.growth * condition * length * (1 - length / adult);
  return { model: 1, ageDays, lengthCm: Math.min(adult, length + Math.max(0, growth)), condition };
}
