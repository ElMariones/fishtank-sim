import { advanceClutches } from './breeding';
import { recoverDemand } from './economy';
import { advanceRelief } from './recovery';
import { refreshShop } from './shop';
import { refreshAxolotlShop } from './axolotlShop';
import { CARE_RATES, closeCareDay, integrateTank, type CareLoad } from './care';
import { developDay, environmentFor, nutritionFactor, type Environment } from './development';
import { metabolicPotential } from './genetics';
import type { Fish, Tank, WaterState, World } from './types';
import { TICKS_PER_GAME_DAY, WATER_RATES, waterSteps } from './water';

/**
 * Habitat (FS-301, FS-302, FS-305): living residents load each tank's water and food need at their current size. Every
 * half-hour step feeds the tank and advances its water; every game day closes the feeding day and each resident develops
 * under its tank's water, temperature, crowding and nutrition at that boundary. Poor care lowers condition; fish never die.
 */

/** Game length–weight rule with koi-like proportions: grams = 0.0148 × cm³. Eggs weigh nothing in this model. */
export const massKg = (lengthCm: number) => 0.0000148 * lengthCm * lengthCm * lengthCm;

export type TankLoad = CareLoad & { fish: number; hatched: number; biomassKg: number };
const emptyLoad = (): TankLoad => ({ fish: 0, hatched: 0, biomassKg: 0, oxygenMgPerDay: 0, ammoniaMgNPerDay: 0, foodNeedGPerDay: 0 });

/** One pass over every record: living residents' count, current biomass, respiration, fasting excretion and food need per tank at 20 °C. */
export function tankLoads(fish: readonly Fish[]): Map<string, TankLoad> {
  const loads = new Map<string, TankLoad>();
  for (const member of fish) {
    if (member.status !== 'living') continue;
    const potential = metabolicPotential(member.genome), mass = massKg(member.life.lengthCm);
    const load = loads.get(member.tankId) ?? emptyLoad();
    load.fish++;
    if (mass > 0) load.hatched++;
    load.biomassKg += mass;
    load.oxygenMgPerDay += WATER_RATES.oxygenMgPerKgDay * mass * potential.metabolism * potential.oxygenDemand;
    load.ammoniaMgNPerDay += CARE_RATES.fastingAmmoniaMgNPerKgDay * mass * potential.metabolism;
    load.foodNeedGPerDay += CARE_RATES.foodNeedGPerKgDay * mass * potential.metabolism;
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

/** The environment a tank's residents develop under: water, temperature, crowding and the last closed feeding day. */
export function tankEnvironment(tank: Tank, load: TankLoad): Environment {
  return environmentFor(tank.water, stocking(load, tank.water).densityKgM3, nutritionFactor(tank.care.fed));
}

function integrateTanks(world: World, fromTick: number, toTick: number): World {
  if (waterSteps(fromTick, toTick) === 0) return world;
  const loads = tankLoads(world.fish);
  return { ...world, tanks: world.tanks.map(tank => integrateTank(tank, loads.get(tank.id) ?? emptyLoad(), fromTick, toTick)) };
}

/** One game day for every living fish, under its tank's environment at the day boundary, after closing the feeding day. */
function developResidents(world: World): { world: World; environments: Map<string, Environment> } {
  const tanks = world.tanks.map(tank => ({ ...tank, care: closeCareDay(tank.care) }));
  const loads = tankLoads(world.fish);
  const environments = new Map(tanks.map(tank => [tank.id, tankEnvironment(tank, loads.get(tank.id) ?? emptyLoad())]));
  return {
    environments,
    world: {
      ...world,
      tanks,
      fish: world.fish.map(member => {
        const environment = member.status === 'living' ? environments.get(member.tankId) : undefined;
        return environment ? { ...member, life: developDay(member.life, metabolicPotential(member.genome), environment) } : member;
      }),
    },
  };
}

/** One game-day boundary as it happened: the world before and after development and the environment each tank applied. */
export type DayReport = { tick: number; before: World; after: World; environments: ReadonlyMap<string, Environment> };

/**
 * Tanks advance in fixed steps and development at every absolute game-day boundary, in that order. Any split of the
 * interval (visible, background, offline or replayed) therefore produces the same world. `onDay` only observes.
 */
export function advanceWorld(world: World, fromTick: number, toTick: number, onDay?: (report: DayReport) => void): World {
  if (!Number.isSafeInteger(fromTick) || !Number.isSafeInteger(toTick) || toTick < fromTick) throw new Error('World time cannot move backwards.');
  let current = world;
  for (let cursor = fromTick; cursor < toTick;) {
    const boundary = (Math.floor(cursor / TICKS_PER_GAME_DAY) + 1) * TICKS_PER_GAME_DAY, end = Math.min(toTick, boundary);
    current = integrateTanks(current, cursor, end);
    if (end === boundary) {
      // Development first, then breeding (FS-402): eggs laid at this boundary start developing at the next one. NPC
      // demand recovers (FS-501), the shop delivers (FS-502) and the koi rescue's wait counts down (FS-504) last.
      const developed = developResidents(current), day = boundary / TICKS_PER_GAME_DAY, bred = advanceRelief(refreshAxolotlShop(refreshShop(recoverDemand(advanceClutches(developed.world)), day), day));
      const dated = { ...bred, circuit: { ...bred.circuit, day } };
      onDay?.({ tick: boundary, before: current, after: dated, environments: developed.environments });
      current = dated;
    }
    cursor = end;
  }
  return current;
}
