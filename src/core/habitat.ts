import { developDay, environmentFor } from './development';
import { metabolicPotential } from './genetics';
import type { Fish, WaterState, World } from './types';
import { integrateWater, NO_LOAD, TICKS_PER_GAME_DAY, WATER_RATES, waterSteps, type WaterLoad } from './water';

/**
 * Habitat (FS-301, FS-302): living residents load each tank's water at their current size, and every game day each
 * resident develops under its tank's water and crowding at that day boundary. Water slows growth but does not yet harm fish.
 */

/** Game length–weight rule with koi-like proportions: grams = 0.0148 × cm³. Eggs weigh nothing in this model. */
export const massKg = (lengthCm: number) => 0.0000148 * lengthCm * lengthCm * lengthCm;

export type TankLoad = WaterLoad & { fish: number; biomassKg: number };
const emptyLoad = (): TankLoad => ({ fish: 0, biomassKg: 0, ...NO_LOAD });

/** One pass over every record: living residents' count, current biomass, respiration and excretion per tank at 20 °C. */
export function tankLoads(fish: readonly Fish[]): Map<string, TankLoad> {
  const loads = new Map<string, TankLoad>();
  for (const member of fish) {
    if (member.status !== 'living') continue;
    const potential = metabolicPotential(member.genome), mass = massKg(member.life.lengthCm);
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

export type StockingLevel = 'light' | 'moderate' | 'heavy' | 'overstocked';
/** Game stocking bands, kg of fish per cubic metre of water. */
export const STOCKING_KG_PER_M3 = { moderate: 4, heavy: 8, overstocked: 12 } as const;

export function stocking(load: TankLoad, water: WaterState): { densityKgM3: number; level: StockingLevel } {
  const densityKgM3 = load.biomassKg / (water.volumeL / 1000), bands = STOCKING_KG_PER_M3;
  const level = densityKgM3 >= bands.overstocked ? 'overstocked' : densityKgM3 >= bands.heavy ? 'heavy' : densityKgM3 >= bands.moderate ? 'moderate' : 'light';
  return { densityKgM3, level };
}

function integrateTanks(world: World, fromTick: number, toTick: number): World {
  if (waterSteps(fromTick, toTick) === 0) return world;
  const loads = tankLoads(world.fish);
  return { ...world, tanks: world.tanks.map(tank => ({ ...tank, water: integrateWater(tank.water, loads.get(tank.id) ?? NO_LOAD, fromTick, toTick) })) };
}

/** One game day for every living fish, under its tank's water and crowding at the day boundary. */
function developResidents(world: World): World {
  const loads = tankLoads(world.fish);
  const environments = new Map(world.tanks.map(tank => [tank.id, environmentFor(tank.water, stocking(loads.get(tank.id) ?? emptyLoad(), tank.water).densityKgM3)]));
  return {
    ...world,
    fish: world.fish.map(member => {
      const environment = member.status === 'living' ? environments.get(member.tankId) : undefined;
      return environment ? { ...member, life: developDay(member.life, metabolicPotential(member.genome), environment) } : member;
    }),
  };
}

/**
 * Water advances in fixed steps and development at every absolute game-day boundary, in that order. Any split of the
 * interval (visible, background, offline or replayed) therefore produces the same world.
 */
export function advanceWorld(world: World, fromTick: number, toTick: number): World {
  if (!Number.isSafeInteger(fromTick) || !Number.isSafeInteger(toTick) || toTick < fromTick) throw new Error('World time cannot move backwards.');
  let current = world;
  for (let cursor = fromTick; cursor < toTick;) {
    const boundary = (Math.floor(cursor / TICKS_PER_GAME_DAY) + 1) * TICKS_PER_GAME_DAY, end = Math.min(toTick, boundary);
    current = integrateTanks(current, cursor, end);
    if (end === boundary) current = developResidents(current);
    cursor = end;
  }
  return current;
}
