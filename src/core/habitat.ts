import { metabolicPotential } from './genetics';
import type { Fish, WaterState, World } from './types';
import { integrateWater, NO_LOAD, WATER_RATES, waterSteps, type WaterLoad } from './water';

/**
 * Habitat load (FS-301): living residents drive each tank's water model. Lab fish count at their adult genetic potential
 * until FS-302 adds growth, and the water does not yet affect fish.
 */

/** Game length–weight rule with koi-like proportions: grams = 0.0148 × cm³. */
export const massKg = (lengthCm: number) => 0.0000148 * lengthCm * lengthCm * lengthCm;

export type TankLoad = WaterLoad & { fish: number; biomassKg: number };
const emptyLoad = (): TankLoad => ({ fish: 0, biomassKg: 0, ...NO_LOAD });

/** One pass over every record: respiration and excretion per tank at 20 °C, summed in record order. */
export function tankLoads(fish: readonly Fish[]): Map<string, TankLoad> {
  const loads = new Map<string, TankLoad>();
  for (const member of fish) {
    if (member.status !== 'living') continue;
    const potential = metabolicPotential(member.genome), mass = massKg(potential.adultLengthCm);
    const load = loads.get(member.tankId) ?? emptyLoad();
    load.fish++;
    load.biomassKg += mass;
    load.oxygenMgPerDay += WATER_RATES.oxygenMgPerKgDay * mass * potential.metabolism * potential.oxygenDemand;
    load.ammoniaMgNPerDay += WATER_RATES.ammoniaMgNPerKgDay * mass * potential.metabolism;
    loads.set(member.tankId, load);
  }
  return loads;
}

export const tankLoad = (fish: readonly Fish[], tankId: string): TankLoad => tankLoads(fish).get(tankId) ?? emptyLoad();

/** Every tank advances through the same fixed water steps whether it is visible, in the background or offline. */
export function advanceWorld(world: World, fromTick: number, toTick: number): World {
  if (waterSteps(fromTick, toTick) === 0) return world;
  const loads = tankLoads(world.fish);
  return { ...world, tanks: world.tanks.map(tank => ({ ...tank, water: integrateWater(tank.water, loads.get(tank.id) ?? NO_LOAD, fromTick, toTick) })) };
}

export type StockingLevel = 'light' | 'moderate' | 'heavy' | 'overstocked';
/** Game stocking bands, kg of fish per cubic metre of water. */
export const STOCKING_KG_PER_M3 = { moderate: 4, heavy: 8, overstocked: 12 } as const;

export function stocking(load: TankLoad, water: WaterState): { densityKgM3: number; level: StockingLevel } {
  const densityKgM3 = load.biomassKg / (water.volumeL / 1000), bands = STOCKING_KG_PER_M3;
  const level = densityKgM3 >= bands.overstocked ? 'overstocked' : densityKgM3 >= bands.heavy ? 'heavy' : densityKgM3 >= bands.moderate ? 'moderate' : 'light';
  return { densityKgM3, level };
}
