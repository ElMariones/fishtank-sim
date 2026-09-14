import { GENOME_VERSION, MUTATION_RATE, type GenomeVersion } from './catalog';
import { CLUTCH_SIZES, clutchId, courtingClutchOf, idleBreeding, pairingBlockers, reservedPlaces, type ClutchSize } from './breeding';
import {
  AERATION_TIERS, applyCareSettings, applyWaterChange, CARE_RATES, careCost, defaultCare, FILTER_TIERS, RATION_KEYS, THERMOSTAT_RANGE,
  waterChangeCost, type WaterChangePercent,
} from './care';
import { express, founderGenome, inherit } from './genetics';
import { adultLife, eggLife, isEgg } from './development';
import { tankLoad } from './habitat';
import { addFood, defaultWater, temperatureFactor } from './water';
import { z } from 'zod';
import { hash } from './random';
import type { Fish, Ration, Tank, World } from './types';

export const COHORT_SIZE = 20;
export const MAX_TANKS = 8;
export const TANK_CAPACITY = 60;
/** Living fish across every tank. Sold fish become archive records and do not count. */
export const MAX_LIVING = MAX_TANKS * TANK_CAPACITY;
/**
 * Every record ever created, sold fish included. IndexedDB stores larger snapshots; quota failures remain recoverable.
 */
export const MAX_RECORDS = 10_000;
export const STOCK_PRICE = 250;
/** World v5: tanks carry water (FS-301) and care (FS-305); fish carry life (FS-302) and breeding state; clutches (FS-401/402). */
export const WORLD_VERSION = 5;
const iso = (timestamp: string) => {
  if (!Number.isFinite(Date.parse(timestamp))) throw new Error('Invalid event timestamp.');
  return timestamp;
};
const id = (n: number) => `FSH-${n.toString().padStart(6, '0')}`;
const count = (n: number) => n.toLocaleString('en');

function founder(world: World, name: string, sex: Fish['sex'], timestamp: string, version: GenomeVersion = GENOME_VERSION): Fish {
  const birthSeed = hash(`${world.seed}:founder:${world.nextId}`), genome = founderGenome(birthSeed, version);
  return { id: id(world.nextId), name, sex, genome, birthSeed,
    generation: 0, parents: null, bornAt: iso(timestamp), tankId: world.tanks[0].id, status: 'living', mutations: [], life: adultLife(genome), breeding: idleBreeding() };
}

function newTank(id: string, name: string, planted: boolean): Tank {
  const water = defaultWater();
  return { id, name, capacity: TANK_CAPACITY, planted, water, care: defaultCare(water) };
}

/** New worlds use the current genome. Research fixtures pass genome version 1 to reproduce the frozen FS-101 founders. */
export function createWorld(timestamp: string, seed = 481516, genomeVersion: GenomeVersion = GENOME_VERSION): World {
  const world: World = { version: 5, seed, nextId: 1, nextClutchId: 1, credits: 1200, fish: [], tanks: [
    newTank('tank-1', 'The Koi Garden', true),
    newTank('tank-2', 'Breeding Studio', false),
  ], clutches: [] };
  ['Haru', 'Sumi', 'Kohaku', 'Yuki', 'Akira', 'Momo'].forEach((name, i) => {
    world.fish.push(founder(world, name, i % 2 === 0 ? 'F' : 'M', timestamp, genomeVersion)); world.nextId++;
  });
  return world;
}

export function quote(fish: Fish): number {
  const p = express(fish.genome);
  return Math.round(35 + p.adultLengthCm * 0.5 + p.metallic * 25 + p.tail * 25);
}

export type Command =
  | { type: 'rename'; fishId: string; name: string }
  | { type: 'move'; fishId: string; tankId: string }
  | { type: 'breed'; motherId: string; fatherId: string; tankId: string; timestamp: string; genomeVersion?: GenomeVersion }
  | { type: 'sell'; fishId: string }
  | { type: 'sell-batch'; fishIds: string[] }
  | { type: 'buy'; tankId: string; timestamp: string; genomeVersion?: GenomeVersion }
  | { type: 'add-tank' }
  | { type: 'decorate'; tankId: string }
  | { type: 'feed'; tankId: string }
  | { type: 'set-care'; tankId: string; ration: Ration; filterTier: number; aerationTier: number; targetC: number }
  | { type: 'change-water'; tankId: string; percent: WaterChangePercent }
  | { type: 'pair'; motherId: string; fatherId: string; nurseryId: string; size: ClutchSize; timestamp: string; genomeVersion: GenomeVersion }
  | { type: 'cancel-clutch'; clutchId: string };

const fishIdSchema = z.string().regex(/^FSH-\d{6}$/);
const tankIdSchema = z.string().max(50);
/**
 * Commands recorded before FS-113 carry no genomeVersion. They must replay exactly as the genome v1 reducer produced
 * them, or stored snapshots would stop agreeing with their journals; the app sends the current version explicitly.
 */
const genomeVersionSchema = z.union([z.literal(1), z.literal(2)]).optional();
export const commandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('rename'), fishId: fishIdSchema, name: z.string().trim().min(1).max(32) }).strict(),
  z.object({ type: z.literal('move'), fishId: fishIdSchema, tankId: tankIdSchema }).strict(),
  z.object({ type: z.literal('breed'), motherId: fishIdSchema, fatherId: fishIdSchema, tankId: tankIdSchema, timestamp: z.string().datetime(), genomeVersion: genomeVersionSchema }).strict(),
  z.object({ type: z.literal('sell'), fishId: fishIdSchema }).strict(),
  z.object({ type: z.literal('sell-batch'), fishIds: z.array(fishIdSchema).min(1).max(MAX_LIVING) }).strict(),
  z.object({ type: z.literal('buy'), tankId: tankIdSchema, timestamp: z.string().datetime(), genomeVersion: genomeVersionSchema }).strict(),
  z.object({ type: z.literal('add-tank') }).strict(),
  z.object({ type: z.literal('decorate'), tankId: tankIdSchema }).strict(),
  z.object({ type: z.literal('feed'), tankId: tankIdSchema }).strict(),
  z.object({
    type: z.literal('set-care'), tankId: tankIdSchema, ration: z.enum(RATION_KEYS),
    filterTier: z.number().int().min(0).max(FILTER_TIERS.length - 1), aerationTier: z.number().int().min(0).max(AERATION_TIERS.length - 1),
    targetC: z.number().int().min(THERMOSTAT_RANGE[0]).max(THERMOSTAT_RANGE[1]),
  }).strict(),
  z.object({ type: z.literal('change-water'), tankId: tankIdSchema, percent: z.union([z.literal(10), z.literal(25), z.literal(50)]) }).strict(),
  z.object({
    type: z.literal('pair'), motherId: fishIdSchema, fatherId: fishIdSchema, nurseryId: tankIdSchema,
    size: z.union([z.literal(CLUTCH_SIZES[0]), z.literal(CLUTCH_SIZES[1]), z.literal(CLUTCH_SIZES[2]), z.literal(CLUTCH_SIZES[3]), z.literal(CLUTCH_SIZES[4])]),
    timestamp: z.string().datetime(), genomeVersion: z.union([z.literal(1), z.literal(2)]),
  }).strict(),
  z.object({ type: z.literal('cancel-clutch'), clutchId: z.string().regex(/^CL-\d{6}$/) }).strict(),
]);

/** Validate before mutation; rejected commands leave the original world untouched. */
export function applyCommand(world: World, command: Command): World {
  command = commandSchema.parse(command);
  const next = structuredClone(world);
  const getFish = (fishId: string) => {
    const fish = next.fish.find(f => f.id === fishId && f.status === 'living');
    if (!fish) throw new Error('This fish is archived or unavailable.');
    return fish;
  };
  // Courting clutches reserve nursery places, so every arrival counts them (FS-402).
  const space = (tankId: string, required: number) => {
    const tank = next.tanks.find(t => t.id === tankId);
    if (!tank) throw new Error('Tank not found.');
    const residents = next.fish.filter(f => f.tankId === tankId && f.status === 'living').length, reserved = reservedPlaces(next, tankId);
    if (residents + reserved + required > tank.capacity) throw new Error(reserved
      ? `This tank needs ${required} free places, and ${reserved} are reserved for a courting clutch. Move fish, choose another tank or add a lab tank.`
      : `This tank needs ${required} free places. Move fish or add a lab tank.`);
    return tank;
  };
  const room = (arriving: number) => {
    const living = next.fish.filter(f => f.status === 'living').length, reserved = reservedPlaces(next);
    if (living + reserved + arriving > MAX_LIVING) throw new Error(`The lab holds at most ${count(MAX_LIVING)} living fish and you have ${count(living)}${reserved ? ` plus ${count(reserved)} reserved eggs` : ''}. Sell fish to make room; sold fish stay in the family archive.`);
    if (next.fish.length + reserved + arriving > MAX_RECORDS) throw new Error(`This save holds ${count(next.fish.length)} fish records, and this lab supports ${count(MAX_RECORDS)}. Export your save before starting another experiment.`);
  };
  const notCourting = (fish: Fish) => {
    if (courtingClutchOf(next, fish.id)) throw new Error(`${fish.name} is courting. Cancel the courtship before selling.`);
  };
  const afford = (cost: number, what: string) => {
    if (next.credits < cost) throw new Error(`${what} costs ◈ ${count(cost)} and you have ◈ ${count(next.credits)}.`);
    next.credits -= cost;
  };
  switch (command.type) {
    case 'rename': {
      const name = command.name.trim();
      if (!name || name.length > 32) throw new Error('Use a name between 1 and 32 characters.');
      getFish(command.fishId).name = name;
      break;
    }
    case 'move': {
      const fish = getFish(command.fishId);
      space(command.tankId, fish.tankId === command.tankId ? 0 : 1);
      fish.tankId = command.tankId;
      break;
    }
    case 'breed': {
      // The instant lab cross: a research shortcut with no courtship, maturity, condition or rest checks.
      const mother = getFish(command.motherId), father = getFish(command.fatherId);
      if (mother.id === father.id || mother.sex !== 'F' || father.sex !== 'M') throw new Error('Choose a female and a male.');
      if (isEgg(mother.life) || isEgg(father.life)) throw new Error('Eggs cannot breed. Wait until they hatch.');
      room(COHORT_SIZE);
      space(command.tankId, COHORT_SIZE);
      // A pre-FS-113 command could only name genome v1 parents, which then produced genome v1 children.
      const version = command.genomeVersion ?? (mother.genome.version === 1 && father.genome.version === 1 ? 1 : 2);
      for (let i = 0; i < COHORT_SIZE; i++) {
        const birthSeed = hash(`${world.seed}:birth:${next.nextId}:${mother.id}:${father.id}`);
        const result = inherit(mother.genome, father.genome, birthSeed, MUTATION_RATE, version);
        next.fish.push({ id: id(next.nextId), name: `Fry ${next.nextId}`, sex: hash(`sex:${birthSeed}`) % 2 === 0 ? 'F' : 'M',
          ...result, birthSeed, generation: Math.max(mother.generation, father.generation) + 1,
          parents: [mother.id, father.id], bornAt: iso(command.timestamp), tankId: command.tankId, status: 'living', life: eggLife(), breeding: idleBreeding() });
        next.nextId++;
      }
      break;
    }
    case 'sell': {
      const fish = getFish(command.fishId);
      if (isEgg(fish.life)) throw new Error('Eggs cannot be sold.');
      notCourting(fish);
      next.credits += quote(fish); fish.status = 'sold';
      break;
    }
    case 'sell-batch': {
      if (!command.fishIds.length) throw new Error('Select at least one fish to sell.');
      if (new Set(command.fishIds).size !== command.fishIds.length) throw new Error('Each fish can only be sold once.');
      const batch = command.fishIds.map(getFish); // Every member is validated before any sale is applied.
      if (batch.some(member => isEgg(member.life))) throw new Error('Eggs cannot be sold.');
      batch.forEach(notCourting);
      for (const fish of batch) { next.credits += quote(fish); fish.status = 'sold'; }
      break;
    }
    case 'buy': {
      space(command.tankId, 1);
      if (next.credits < STOCK_PRICE) throw new Error('You need 250 lab credits for unrelated stock.');
      room(1);
      const fish = founder(next, `Newcomer ${next.nextId}`, next.nextId % 2 === 0 ? 'F' : 'M', command.timestamp, command.genomeVersion ?? 1);
      fish.tankId = command.tankId;
      next.fish.push(fish); next.nextId++; next.credits -= STOCK_PRICE;
      break;
    }
    case 'add-tank':
      if (next.tanks.length >= MAX_TANKS) throw new Error('This lab supports up to eight tanks.');
      next.tanks.push(newTank(`tank-${next.tanks.length + 1}`, `Lineage Tank ${next.tanks.length + 1}`, true));
      break;
    case 'decorate': {
      const tank = space(command.tankId, 0); tank.planted = !tank.planted; break;
    }
    case 'feed': {
      // A manual portion joins the tank's food pool; fish eat what they need and the rest decays (FS-305).
      const tank = space(command.tankId, 0);
      const portion = tankLoad(next.fish, tank.id).foodNeedGPerDay * temperatureFactor(tank.water.temperatureC) * CARE_RATES.manualPortionDays;
      if (!(portion > 0)) throw new Error('No hatched fish in this tank need food yet.');
      tank.water = addFood(tank.water, portion);
      break;
    }
    case 'set-care': {
      const tank = space(command.tankId, 0);
      const wanted = { ration: command.ration, filterTier: command.filterTier, aerationTier: command.aerationTier, targetC: command.targetC };
      const updated = applyCareSettings(tank, wanted);
      if (JSON.stringify(updated) === JSON.stringify(tank)) throw new Error('These care settings are already in use.');
      afford(careCost(tank, wanted), 'This equipment');
      tank.water = updated.water; tank.care = updated.care;
      break;
    }
    case 'change-water': {
      const tank = space(command.tankId, 0);
      afford(waterChangeCost(tank.water, command.percent), `A ${command.percent}% water change`);
      tank.water = applyWaterChange(tank.water, command.percent);
      break;
    }
    case 'pair': {
      // Normal breeding (FS-401/402): every hard rule is checked, then nursery places are reserved until spawning.
      const blockers = pairingBlockers(next, { motherId: command.motherId, fatherId: command.fatherId, nurseryId: command.nurseryId, size: command.size },
        { maxLiving: MAX_LIVING, maxRecords: MAX_RECORDS });
      if (blockers.length) throw new Error(blockers.map(blocker => blocker.message).join(' '));
      const mother = getFish(command.motherId), father = getFish(command.fatherId);
      if (command.genomeVersion === 1 && (mother.genome.version !== 1 || father.genome.version !== 1)) throw new Error('Genome v2 parents cannot produce a genome v1 clutch.');
      next.clutches.push({
        id: clutchId(next.nextClutchId), motherId: mother.id, fatherId: father.id, tankId: mother.tankId, nurseryId: command.nurseryId,
        size: command.size, genomeVersion: command.genomeVersion, pairedAt: iso(command.timestamp), stage: 'courting', days: 0, progress: 0,
        blockers: [], spawnedDay: null, firstFishId: null,
      });
      next.nextClutchId++;
      break;
    }
    case 'cancel-clutch': {
      const clutch = next.clutches.find(entry => entry.id === command.clutchId);
      if (!clutch) throw new Error('Clutch not found.');
      if (clutch.stage !== 'courting') throw new Error('Only a courtship can be cancelled; once laid, its eggs are tracked fish.');
      clutch.stage = 'cancelled'; clutch.blockers = [];
      break;
    }
  }
  if (next.credits > 1e9) throw new Error('The lab credit limit would be exceeded.');
  return next;
}
