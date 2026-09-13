import { express, founderGenome, inherit } from './genetics';
import { z } from 'zod';
import { hash } from './random';
import type { Fish, World } from './types';

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
const iso = (timestamp: string) => {
  if (!Number.isFinite(Date.parse(timestamp))) throw new Error('Invalid event timestamp.');
  return timestamp;
};
const id = (n: number) => `FSH-${n.toString().padStart(6, '0')}`;
const count = (n: number) => n.toLocaleString('en');

function founder(world: World, name: string, sex: Fish['sex'], timestamp: string): Fish {
  const birthSeed = hash(`${world.seed}:founder:${world.nextId}`);
  return { id: id(world.nextId), name, sex, genome: founderGenome(birthSeed), birthSeed,
    generation: 0, parents: null, bornAt: iso(timestamp), tankId: world.tanks[0].id, status: 'living', mutations: [] };
}

export function createWorld(timestamp: string, seed = 481516): World {
  const world: World = { version: 1, seed, nextId: 1, credits: 1200, fish: [], tanks: [
    { id: 'tank-1', name: 'The Koi Garden', capacity: TANK_CAPACITY, planted: true },
    { id: 'tank-2', name: 'Breeding Studio', capacity: TANK_CAPACITY, planted: false },
  ] };
  ['Haru', 'Sumi', 'Kohaku', 'Yuki', 'Akira', 'Momo'].forEach((name, i) => {
    world.fish.push(founder(world, name, i % 2 === 0 ? 'F' : 'M', timestamp)); world.nextId++;
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
  | { type: 'breed'; motherId: string; fatherId: string; tankId: string; timestamp: string }
  | { type: 'sell'; fishId: string }
  | { type: 'sell-batch'; fishIds: string[] }
  | { type: 'buy'; tankId: string; timestamp: string }
  | { type: 'add-tank' }
  | { type: 'decorate'; tankId: string };

const fishIdSchema = z.string().regex(/^FSH-\d{6}$/);
export const commandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('rename'), fishId: fishIdSchema, name: z.string().trim().min(1).max(32) }).strict(),
  z.object({ type: z.literal('move'), fishId: fishIdSchema, tankId: z.string().max(50) }).strict(),
  z.object({ type: z.literal('breed'), motherId: fishIdSchema, fatherId: fishIdSchema, tankId: z.string().max(50), timestamp: z.string().datetime() }).strict(),
  z.object({ type: z.literal('sell'), fishId: fishIdSchema }).strict(),
  z.object({ type: z.literal('sell-batch'), fishIds: z.array(fishIdSchema).min(1).max(MAX_LIVING) }).strict(),
  z.object({ type: z.literal('buy'), tankId: z.string().max(50), timestamp: z.string().datetime() }).strict(),
  z.object({ type: z.literal('add-tank') }).strict(),
  z.object({ type: z.literal('decorate'), tankId: z.string().max(50) }).strict(),
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
  const space = (tankId: string, required: number) => {
    const tank = next.tanks.find(t => t.id === tankId);
    if (!tank) throw new Error('Tank not found.');
    if (next.fish.filter(f => f.tankId === tankId && f.status === 'living').length + required > tank.capacity) throw new Error(`This tank needs ${required} free places. Move fish or add a lab tank.`);
    return tank;
  };
  const room = (arriving: number) => {
    const living = next.fish.filter(f => f.status === 'living').length;
    if (living + arriving > MAX_LIVING) throw new Error(`The lab holds at most ${count(MAX_LIVING)} living fish and you have ${count(living)}. Sell fish to make room; sold fish stay in the family archive.`);
    if (next.fish.length + arriving > MAX_RECORDS) throw new Error(`This save holds ${count(next.fish.length)} fish records, and this lab supports ${count(MAX_RECORDS)}. Export your save before starting another experiment.`);
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
      const mother = getFish(command.motherId), father = getFish(command.fatherId);
      if (mother.id === father.id || mother.sex !== 'F' || father.sex !== 'M') throw new Error('Choose a female and a male.');
      room(COHORT_SIZE);
      space(command.tankId, COHORT_SIZE);
      for (let i = 0; i < COHORT_SIZE; i++) {
        const birthSeed = hash(`${world.seed}:birth:${next.nextId}:${mother.id}:${father.id}`);
        const result = inherit(mother.genome, father.genome, birthSeed);
        next.fish.push({ id: id(next.nextId), name: `Fry ${next.nextId}`, sex: hash(`sex:${birthSeed}`) % 2 === 0 ? 'F' : 'M',
          ...result, birthSeed, generation: Math.max(mother.generation, father.generation) + 1,
          parents: [mother.id, father.id], bornAt: iso(command.timestamp), tankId: command.tankId, status: 'living' });
        next.nextId++;
      }
      break;
    }
    case 'sell': {
      const fish = getFish(command.fishId);
      next.credits += quote(fish); fish.status = 'sold';
      break;
    }
    case 'sell-batch': {
      if (!command.fishIds.length) throw new Error('Select at least one fish to sell.');
      if (new Set(command.fishIds).size !== command.fishIds.length) throw new Error('Each fish can only be sold once.');
      const batch = command.fishIds.map(getFish); // Every member is validated before any sale is applied.
      for (const fish of batch) { next.credits += quote(fish); fish.status = 'sold'; }
      break;
    }
    case 'buy': {
      space(command.tankId, 1);
      if (next.credits < STOCK_PRICE) throw new Error('You need 250 lab credits for unrelated stock.');
      room(1);
      const fish = founder(next, `Newcomer ${next.nextId}`, next.nextId % 2 === 0 ? 'F' : 'M', command.timestamp);
      fish.tankId = command.tankId;
      next.fish.push(fish); next.nextId++; next.credits -= STOCK_PRICE;
      break;
    }
    case 'add-tank':
      if (next.tanks.length >= MAX_TANKS) throw new Error('This lab supports up to eight tanks.');
      next.tanks.push({ id: `tank-${next.tanks.length + 1}`, name: `Lineage Tank ${next.tanks.length + 1}`, capacity: TANK_CAPACITY, planted: true });
      break;
    case 'decorate': {
      const tank = space(command.tankId, 0); tank.planted = !tank.planted; break;
    }
  }
  if (next.credits > 1e9) throw new Error('The lab credit limit would be exceeded.');
  return next;
}
