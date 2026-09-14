import { z } from 'zod';
import { defaultCare, RATION_KEYS, THERMOSTAT_RANGE } from './care';
import { ALL_LOCI, LOCI } from './catalog';
import { adultLife } from './development';
import { metabolicPotential } from './genetics';
import type { World } from './types';
import { defaultWater, WATER_LIMITS } from './water';
import { MAX_RECORDS, MAX_TANKS } from './world';

const alleles = (count: number) => z.array(z.number().int().min(0).max(5)).length(count);
/** Genome v1 records stay valid unchanged; genome v2 records carry the appended Color and Ornament loci. */
const genome = z.discriminatedUnion('version', [
  z.object({ version: z.literal(1), maternal: alleles(LOCI.length), paternal: alleles(LOCI.length) }),
  z.object({ version: z.literal(2), maternal: alleles(ALL_LOCI.length), paternal: alleles(ALL_LOCI.length) }),
]);
const bounded = ([minimum, maximum]: readonly [number, number]) => z.number().min(minimum).max(maximum);
/** Water model v1 state, carried by every world v2+ tank. */
const water = z.object({
  model: z.literal(1), volumeL: bounded(WATER_LIMITS.volumeL), temperatureC: bounded(WATER_LIMITS.temperatureC),
  oxygenMgL: bounded(WATER_LIMITS.oxygenMgL), ammoniaMgL: bounded(WATER_LIMITS.ammoniaMgL), foodG: bounded(WATER_LIMITS.foodG),
  filterMgNPerDay: bounded(WATER_LIMITS.filterMgNPerDay), aerationPerDay: bounded(WATER_LIMITS.aerationPerDay),
}).strict();
/** Care model v1 state, carried by every world v4 tank. */
const care = z.object({
  model: z.literal(1), ration: z.enum(RATION_KEYS), targetC: z.number().int().min(THERMOSTAT_RANGE[0]).max(THERMOSTAT_RANGE[1]),
  dayNeedG: z.number().min(0).max(1e12), dayEatenG: z.number().min(0).max(1e12), fed: z.number().min(0).max(1),
}).strict();
/** Life model v1 state, carried by every world v3+ fish. */
const life = z.object({
  model: z.literal(1), ageDays: z.number().int().min(0).max(10_000_000), lengthCm: z.number().min(0).max(200), condition: z.number().min(0).max(1),
}).strict();
const tank = { id: z.string().max(50), name: z.string().min(1).max(32), capacity: z.number().int().min(1).max(60), planted: z.boolean() };
const header = { seed: z.number().int().min(0).max(4294967295), nextId: z.number().int().positive(), credits: z.number().int().nonnegative().max(1e9) };
const fishRecord = {
  id: z.string().regex(/^FSH-\d{6}$/), name: z.string().min(1).max(32), sex: z.enum(['F', 'M']),
  genome,
  birthSeed: z.number().int().min(0).max(4294967295), generation: z.number().int().min(0).max(MAX_RECORDS),
  parents: z.tuple([z.string(), z.string()]).nullable(), bornAt: z.string().datetime(),
  tankId: z.string(), status: z.enum(['living', 'sold']),
  mutations: z.array(z.object({ locus: z.number().int().min(0).max(ALL_LOCI.length - 1), copy: z.enum(['maternal', 'paternal']), from: z.number().int().min(0).max(5), to: z.number().int().min(0).max(5) })).max(ALL_LOCI.length * 2),
};
const recordsOnly = z.array(z.object(fishRecord)).max(MAX_RECORDS);
const withLife = z.array(z.object({ ...fishRecord, life })).max(MAX_RECORDS);
const tanksWithWater = z.array(z.object({ ...tank, water })).min(1).max(MAX_TANKS);
const schema = z.discriminatedUnion('version', [
  z.object({ version: z.literal(1), ...header, tanks: z.array(z.object(tank)).min(1).max(MAX_TANKS), fish: recordsOnly }),
  z.object({ version: z.literal(2), ...header, tanks: tanksWithWater, fish: recordsOnly }),
  z.object({ version: z.literal(3), ...header, tanks: tanksWithWater, fish: withLife }),
  z.object({ version: z.literal(4), ...header, tanks: z.array(z.object({ ...tank, water, care })).min(1).max(MAX_TANKS), fish: withLife }),
]);

/**
 * World v1 predates water (FS-301): its tanks start with default, clean, oxygen-saturated water. Worlds v1–v2 predate
 * life state (FS-302): their fish become young adults at their adult length potential, as the lab always drew them.
 * Worlds v1–v3 predate care (FS-305): their tanks feed measured rations with a thermostat at the water's temperature.
 */
export function decodeSave(raw: string): World {
  if (raw.length > 12_000_000) throw new Error('Save is too large for this lab.');
  const parsed = schema.parse(JSON.parse(raw));
  let world: World;
  if (parsed.version === 4) world = parsed;
  else {
    const watered = parsed.version === 1 ? parsed.tanks.map(entry => ({ ...entry, water: defaultWater() })) : parsed.tanks;
    const fish = parsed.version === 3 ? parsed.fish : parsed.fish.map(member => ({ ...member, life: adultLife(member.genome) }));
    world = { ...parsed, version: 4, tanks: watered.map(entry => ({ ...entry, care: defaultCare(entry.water) })), fish };
  }
  const ids = new Map(world.fish.map(f => [f.id, f]));
  const tanks = new Set(world.tanks.map(t => t.id));
  if (ids.size !== world.fish.length || tanks.size !== world.tanks.length) throw new Error('Duplicate records in save.');
  for (const member of world.fish) {
    if (!tanks.has(member.tankId) || Number(member.id.slice(4)) >= world.nextId) throw new Error('Invalid record reference.');
    if (member.mutations.some(mutation => mutation.locus >= member.genome.maternal.length)) throw new Error('Mutation record is outside the genome.');
    if (member.life.lengthCm > metabolicPotential(member.genome).adultLengthCm) throw new Error('A fish is longer than its genetic potential.');
    if (member.parents) {
      const [m, p] = member.parents.map(parent => ids.get(parent));
      if (!m || !p || m.id === p.id || m.sex !== 'F' || p.sex !== 'M' || Math.max(m.generation, p.generation) + 1 !== member.generation) throw new Error('Invalid pedigree.');
    } else if (member.generation !== 0) throw new Error('Founder generation must be zero.');
  }
  for (const entry of world.tanks) {
    if (world.fish.filter(f => f.status === 'living' && f.tankId === entry.id).length > entry.capacity) throw new Error('Tank exceeds capacity.');
    if (entry.care.dayEatenG > entry.care.dayNeedG) throw new Error('A tank ate more food than its residents needed.');
  }
  return world;
}

export const SAVE_KEY = 'fishtank-sim.lab.v1';
