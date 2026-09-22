import { competitionSchedule, createCompetitionRun, eligibility, initialCircuit, MAX_COMPETITION_HISTORY, negotiationFloor } from './competitions';
import { savedDecorationsSchema, tankStyleSchema } from './tankSchema';
import { piecePrice, styleCost, styleOf } from './aquascape';
import { TANK_PRICE, TANK_UPGRADE_PRICE, decorationsOf, validateLayout, legacyDecorations, type Decoration, type TankStyle } from './tankManagement';
import { GENOME_VERSION, MUTATION_RATE, type GenomeVersion } from './catalog';
import { CLUTCH_SIZES, clutchId, courtingClutchOf, idleBreeding, pairingBlockers, reservedPlaces, type ClutchSize } from './breeding';
import {
  AERATION_TIERS, applyCareSettings, applyWaterChange, CARE_RATES, careCost, defaultCare, FILTER_TIERS, RATION_KEYS, THERMOSTAT_RANGE,
  waterChangeCost, type WaterChangePercent,
} from './care';
import { defaultMarket, openingLedger, planSales, recordEntry, saleDetail, type PriceModel } from './economy';
import { initialShop } from './shop';
import { initialAxolotlShop } from './axolotlShop';
import { defaultRelief, RELIEF_COOLDOWN_DAYS, reliefStatus } from './recovery';
import { express, founderGenome, inherit } from './genetics';
import { axolotlFounderGenome } from './axolotlGenetics';
import { adultLife, eggLife, isEgg } from './development';
import { tankLoad } from './habitat';
import { addFood, defaultWater, temperatureFactor } from './water';
import { z } from 'zod';
import { NAMING_MODEL, newFishName, takenNames } from './names';
import { hash } from './random';
import { childOrigins, emptyTrace } from './origins';
import { bloodlineId, captureStandard, MAX_FOUNDATION, registrationProblem } from './bloodlines';
import type { Fish, Genome, Ration, Species, Tank, World } from './types';

export const COHORT_SIZE = 20;
/** Fast breeding offspring choices; the default instant cross lays COHORT_SIZE eggs. */
export const FAST_OFFSPRING_COUNTS = [1, 2, 4, 8, 12, 16, 20, 24] as const;
export const MAX_FAST_OFFSPRING = 24;
export const MAX_TANKS = 8;
export const TANK_CAPACITY = 60;
/** Living fish across every tank. Sold fish become archive records and do not count. */
export const MAX_LIVING = MAX_TANKS * TANK_CAPACITY;
/**
 * Every record ever created, sold fish included. IndexedDB stores larger snapshots; quota failures remain recoverable.
 */
export const MAX_RECORDS = 10_000;
export const STOCK_PRICE = 250;
/**
 * World v6: tanks carry water (FS-301) and care (FS-305); fish carry life (FS-302) and breeding state; clutches
 * (FS-401/402); NPC demand and the credit ledger (FS-501). World v7 adds persistent shop stock (FS-502); v8 adds placed
 * decorations (FS-503); v9 adds the koi rescue for no-money recovery (FS-504); v10 accepts genome v3 records and
 * genome v3 shop stock (FS-601); v11 adds mutation origins to every fish (FS-603); v12 adds named
 * bloodlines (FS-604); v13 adds explicit species identity and independent axolotl genetics; v14 adds the persistent
 * axolotl shop.
 */
export const WORLD_VERSION = 15;
const iso = (timestamp: string) => {
  if (!Number.isFinite(Date.parse(timestamp))) throw new Error('Invalid event timestamp.');
  return timestamp;
};
const id = (n: number) => `FSH-${n.toString().padStart(6, '0')}`;
const count = (n: number) => n.toLocaleString('en');

function founder(world: World, name: string, sex: Fish['sex'], timestamp: string, version: GenomeVersion = GENOME_VERSION): Fish {
  const birthSeed = hash(`${world.seed}:founder:${world.nextId}`), genome = founderGenome(birthSeed, version);
  return { id: id(world.nextId), name, sex, species: 'koi', genome, birthSeed,
    generation: 0, parents: null, bornAt: iso(timestamp), tankId: world.tanks[0].id, status: 'living', mutations: [], life: adultLife(genome), breeding: idleBreeding(), origins: [] };
}

/** Axolotl founder stream is namespaced independently so adding the species never perturbs historical koi seeds. */
function axolotlFounder(world: World, name: string, sex: Fish['sex'], timestamp: string): Fish {
  const birthSeed = hash(`${world.seed}:axolotl-founder:${world.nextId}`), genome = axolotlFounderGenome(birthSeed);
  return { id: id(world.nextId), name, sex, species: 'axolotl', genome, birthSeed,
    generation: 0, parents: null, bornAt: iso(timestamp), tankId: world.tanks[0].id, status: 'living', mutations: [], life: adultLife(genome), breeding: idleBreeding(), origins: [] };
}

function newTank(id: string, name: string, planted: boolean): Tank {
  const water = defaultWater();
  return { id, name, capacity: TANK_CAPACITY, planted, water, care: defaultCare(water), decorations: planted ? legacyDecorations() : [] };
}

/** New worlds use the current genome. Research fixtures pass genome version 1 to reproduce the frozen FS-101 founders. */
export function createWorld(timestamp: string, seed = 481516, genomeVersion: GenomeVersion = GENOME_VERSION): World {
  const world: World = { version: 15, seed, nextId: 1, nextClutchId: 1, credits: 1200, fish: [], tanks: [
    newTank('tank-1', 'The Koi Garden', true),
    newTank('tank-2', 'Breeding Studio', false),
  ], clutches: [], market: defaultMarket(), ledger: openingLedger(1200), shop: initialShop(seed), naming: NAMING_MODEL, relief: defaultRelief(), bloodlines: [], nextBloodlineId: 1,
    axolotlShop: initialAxolotlShop(seed), circuit: initialCircuit() };
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
  | { type: 'enter-competition'; eventId: string; fishIds: string[] }
  | { type: 'judge-competition' }
  | { type: 'close-competition' }
  | { type: 'competition-offer'; participantId: string; amount: number; tankId: string; timestamp: string }
  | { type: 'rename'; fishId: string; name: string }
  | { type: 'move'; fishId: string; tankId: string }
  | { type: 'breed'; motherId: string; fatherId: string; tankId: string; timestamp: string; genomeVersion?: GenomeVersion; count?: number }
  | { type: 'sell'; fishId: string; priceModel?: PriceModel }
  | { type: 'sell-batch'; fishIds: string[]; priceModel?: PriceModel }
  | { type: 'rehome-batch'; fishIds: string[] }
  | { type: 'buy'; tankId: string; timestamp: string; genomeVersion?: GenomeVersion; species?: Species }
  | { type: 'buy-listing'; listingId: string; tankId: string; timestamp: string }
  | { type: 'buy-axolotl-listing'; listingId: string; tankId: string; timestamp: string }
  | { type: 'add-tank' }
  | { type: 'purchase-tank' }
  | { type: 'upgrade-tank'; tankId: string }
  | { type: 'place-decorations'; tankId: string; decorations: Decoration[] }
  | { type: 'decorate'; tankId: string }
  | { type: 'style-tank'; tankId: string; style: TankStyle }
  | { type: 'feed'; tankId: string }
  | { type: 'set-care'; tankId: string; ration: Ration; filterTier: number; aerationTier: number; targetC: number }
  | { type: 'change-water'; tankId: string; percent: WaterChangePercent }
  | { type: 'pair'; motherId: string; fatherId: string; nurseryId: string; size: ClutchSize; timestamp: string; genomeVersion: GenomeVersion }
  | { type: 'cancel-clutch'; clutchId: string }
  | { type: 'move-batch'; fishIds: string[]; tankId: string }
  | { type: 'claim-relief'; tankId: string; timestamp: string; genomeVersion: GenomeVersion }
  | { type: 'register-bloodline'; name: string; foundationIds: string[]; timestamp: string }
  | { type: 'rename-bloodline'; bloodlineId: string; name: string };

const fishIdSchema = z.string().regex(/^FSH-\d{6}$/);
/** Price model 1 sales predate species-aware axolotl offers; both stay valid so every recorded sale replays. */
const priceModelSchema = z.union([z.literal(1), z.literal(2)]).optional();
const tankIdSchema = z.string().max(50);
/**
 * Commands recorded before FS-113 carry no genomeVersion. They must replay exactly as the genome v1 reducer produced
 * them, or stored snapshots would stop agreeing with their journals; the app sends the current version explicitly.
 */
const genomeVersionSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]).optional();
export const commandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('enter-competition'), eventId: z.string().max(100), fishIds: z.array(fishIdSchema).min(1).max(2) }).strict(),
  z.object({ type: z.literal('judge-competition') }).strict(),
  z.object({ type: z.literal('close-competition') }).strict(),
  z.object({ type: z.literal('competition-offer'), participantId: fishIdSchema, amount: z.number().int().min(1).max(1e9), tankId: tankIdSchema, timestamp: z.string().datetime() }).strict(),
  z.object({ type: z.literal('rename'), fishId: fishIdSchema, name: z.string().trim().min(1).max(32) }).strict(),
  z.object({ type: z.literal('move'), fishId: fishIdSchema, tankId: tankIdSchema }).strict(),
  z.object({ type: z.literal('breed'), motherId: fishIdSchema, fatherId: fishIdSchema, tankId: tankIdSchema, timestamp: z.string().datetime(), genomeVersion: genomeVersionSchema, count: z.number().int().min(1).max(MAX_FAST_OFFSPRING).optional() }).strict(),
  z.object({ type: z.literal('sell'), fishId: fishIdSchema, priceModel: priceModelSchema }).strict(),
  z.object({ type: z.literal('sell-batch'), fishIds: z.array(fishIdSchema).min(1).max(MAX_LIVING), priceModel: priceModelSchema }).strict(),
  z.object({ type: z.literal('rehome-batch'), fishIds: z.array(fishIdSchema).min(1).max(MAX_LIVING) }).strict(),
  z.object({ type: z.literal('buy'), tankId: tankIdSchema, timestamp: z.string().datetime(), genomeVersion: genomeVersionSchema, species: z.enum(['koi', 'axolotl']).optional() }).strict(),
  z.object({ type: z.literal('buy-listing'), listingId: z.string().regex(/^LS-\d{6,16}$/), tankId: tankIdSchema, timestamp: z.string().datetime() }).strict(),
  z.object({ type: z.literal('buy-axolotl-listing'), listingId: z.string().regex(/^AX-\d{6,16}$/), tankId: tankIdSchema, timestamp: z.string().datetime() }).strict(),
  z.object({ type: z.literal('add-tank') }).strict(),
  z.object({ type: z.literal('purchase-tank') }).strict(),
  z.object({ type: z.literal('upgrade-tank'), tankId: tankIdSchema }).strict(),
  z.object({ type: z.literal('place-decorations'), tankId: tankIdSchema, decorations: savedDecorationsSchema }).strict(),
  z.object({ type: z.literal('decorate'), tankId: tankIdSchema }).strict(),
  z.object({ type: z.literal('style-tank'), tankId: tankIdSchema, style: tankStyleSchema }).strict(),
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
    timestamp: z.string().datetime(), genomeVersion: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  }).strict(),
  z.object({ type: z.literal('cancel-clutch'), clutchId: z.string().regex(/^CL-\d{6}$/) }).strict(),
  z.object({ type: z.literal('move-batch'), fishIds: z.array(fishIdSchema).min(1).max(MAX_LIVING), tankId: tankIdSchema }).strict(),
  z.object({ type: z.literal('claim-relief'), tankId: tankIdSchema, timestamp: z.string().datetime(), genomeVersion: z.union([z.literal(1), z.literal(2), z.literal(3)]) }).strict(),
  z.object({ type: z.literal('register-bloodline'), name: z.string().max(64), foundationIds: z.array(fishIdSchema).min(1).max(MAX_FOUNDATION), timestamp: z.string().datetime() }).strict(),
  z.object({ type: z.literal('rename-bloodline'), bloodlineId: z.string().regex(/^BL-\d{6}$/), name: z.string().max(64) }).strict(),
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
      ? `This tank needs ${required} free places, and ${reserved} are reserved for a courting clutch. Move fish, choose another tank or buy an aquarium.`
      : `This tank needs ${required} free places. Move fish or buy an aquarium.`);
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
  const names = (fish: Fish[]) => fish.length <= 3 ? fish.map(f => f.name).join(', ') : `${fish.slice(0, 3).map(f => f.name).join(', ')} and ${fish.length - 3} more`;
  // A sale with a price model goes to the best NPC offers and uses up their demand (FS-501). Journal entries recorded
  // before the economy carry no price model and keep the lab quote, so older saves replay to the credits they stored.
  const sell = (batch: Fish[], priceModel: PriceModel | undefined) => {
    if (priceModel === undefined) {
      const total = batch.reduce((sum, fish) => sum + quote(fish), 0);
      for (const fish of batch) fish.status = 'sold';
      next.credits += total;
      next.ledger = recordEntry(next.ledger, 'sale', total, batch.length, `${names(batch)} at the lab quote`);
      return;
    }
    const plan = planSales(next, batch.map(fish => fish.id), undefined, priceModel);
    if (plan.unsold.length) {
      const unsold = batch.filter(fish => plan.unsold.includes(fish.id));
      throw new Error(`No NPC buyer wants ${names(unsold)} right now. Wait for demand to recover, or rehome ${unsold.length === 1 ? 'it' : 'them'} instead.`);
    }
    for (const fish of batch) fish.status = 'sold';
    next.credits += plan.total;
    next.market = { ...next.market, demand: plan.demand };
    next.ledger = recordEntry(next.ledger, 'sale', plan.total, batch.length, saleDetail(plan));
  };
  switch (command.type) {
    case 'enter-competition': {
      if (next.circuit.active) throw new Error('Finish and close the current competition first.');
      if (next.circuit.history.length >= MAX_COMPETITION_HISTORY) throw new Error('This world has reached its 240-show archive limit. Export it before starting a new world.');
      const event = competitionSchedule(next.seed, next.circuit.day).find(candidate => candidate.id === command.eventId);
      if (!event) throw new Error('This competition has closed. Choose a current event.');
      if (next.circuit.history.some(run => run.event.id === event.id)) throw new Error('You already entered this edition.');
      if (new Set(command.fishIds).size !== command.fishIds.length) throw new Error('Choose each animal only once.');
      const entrants = command.fishIds.map(getFish);
      for (const fish of entrants) {
        const problem = eligibility(fish, event);
        if (problem) throw new Error(`${fish.name}: ${problem}`);
        if (courtingClutchOf(next, fish.id)) throw new Error(`${fish.name} is courting. Finish the courtship before entering.`);
      }
      const cost = event.fee * entrants.length;
      afford(cost, 'Competition entry');
      next.circuit.active = createCompetitionRun(next, event, entrants);
      next.ledger = recordEntry(next.ledger, 'competitionEntry', -cost, entrants.length, event.name);
      break;
    }
    case 'judge-competition': {
      const run = next.circuit.active;
      if (!run || run.phase !== 'exhibition') throw new Error('There is no exhibition awaiting judging.');
      const winners = run.participants.filter(p => p.isPlayer && p.rank <= 3);
      const prize = winners.reduce((sum, p) => sum + run.event.prizes[p.rank - 1], 0);
      run.phase = 'results'; next.credits += prize;
      next.ledger = recordEntry(next.ledger, 'competitionPrize', prize, winners.length, run.event.name);
      break;
    }
    case 'close-competition': {
      const run = next.circuit.active;
      if (!run || run.phase !== 'results') throw new Error('Judge the exhibition before closing it.');
      next.circuit.history.push(run); next.circuit.active = null;
      break;
    }
    case 'competition-offer': {
      const run = next.circuit.active;
      if (!run || run.phase !== 'results') throw new Error('Offers open after the results.');
      const participant = run.participants.find(p => p.fish.id === command.participantId && !p.isPlayer);
      if (!participant || participant.negotiation.status !== 'open') throw new Error('This animal is no longer available for negotiation.');
      if (next.fish.some(f => f.id === participant.fish.id)) throw new Error('This animal already belongs to your collection.');
      if (command.amount > next.credits) throw new Error('You cannot offer more credits than you have.');
      space(command.tankId, 1); room(1);
      const floor = negotiationFloor(run.event, participant), n = participant.negotiation;
      n.attempts++;
      if (command.amount >= floor) {
        afford(command.amount, 'This offer');
        next.fish.push({ ...structuredClone(participant.fish), tankId: command.tankId });
        n.status = 'purchased'; n.counter = null;
        next.ledger = recordEntry(next.ledger, 'competitionPurchase', -command.amount, 1, `${participant.fish.name} from ${participant.owner}`);
      } else {
        n.counter = Math.max(floor, Math.ceil(participant.askingPrice - (participant.askingPrice - floor) * n.attempts / 3));
        if (n.attempts >= 3) n.status = 'declined';
      }
      break;
    }
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
      // The instant cross behind fast breeding: a shortcut with no courtship, maturity, condition, rest or shared-tank
      // checks. Offspring go to any tank with room. Commands recorded before the count option always laid 20 eggs.
      const offspring = command.count ?? COHORT_SIZE;
      if (!Number.isInteger(offspring) || offspring < 1 || offspring > MAX_FAST_OFFSPRING) throw new Error(`Choose between 1 and ${MAX_FAST_OFFSPRING} offspring.`);
      const mother = getFish(command.motherId), father = getFish(command.fatherId);
      if (mother.id === father.id || mother.sex !== 'F' || father.sex !== 'M') throw new Error('Choose a female and a male.');
      if (isEgg(mother.life) || isEgg(father.life)) throw new Error('Eggs cannot breed. Wait until they hatch.');
      if (mother.species !== father.species) throw new Error('Koi and axolotls cannot breed with each other. Choose two members of the same species.');
      room(offspring);
      space(command.tankId, offspring);
      // A pre-FS-113 command could only name genome v1 parents, which then produced genome v1 children.
      // A command without a version keeps what its parents allow; genome v3 parents never existed before FS-601.
      const version = mother.species === 'koi'
        ? command.genomeVersion ?? (((mother.genome as Genome).version === 1 && (father.genome as Genome).version === 1) ? 1 : Math.max(2, (mother.genome as Genome).version, (father.genome as Genome).version) as GenomeVersion)
        : GENOME_VERSION;
      const taken = takenNames(next);
      for (let i = 0; i < offspring; i++) {
        const birthSeed = hash(`${world.seed}:birth:${next.nextId}:${mother.id}:${father.id}`);
        const trace = emptyTrace(), result = inherit(mother.genome, father.genome, birthSeed, MUTATION_RATE, version, trace);
        const sex: Fish['sex'] = hash(`sex:${birthSeed}`) % 2 === 0 ? 'F' : 'M';
        const name = newFishName(`${next.seed}:fish:${next.nextId}`, { sex, genome: result.genome }, taken);
        next.fish.push({ id: id(next.nextId), name, sex, species: mother.species,
          ...result, birthSeed, generation: Math.max(mother.generation, father.generation) + 1,
          parents: [mother.id, father.id], bornAt: iso(command.timestamp), tankId: command.tankId, status: 'living', life: eggLife(), breeding: idleBreeding(),
          origins: childOrigins(id(next.nextId), mother, father, trace, result.mutations) });
        next.nextId++;
      }
      break;
    }
    case 'sell': {
      const fish = getFish(command.fishId);
      if (isEgg(fish.life)) throw new Error('Eggs cannot be sold.');
      notCourting(fish);
      sell([fish], command.priceModel);
      break;
    }
    case 'sell-batch': {
      if (!command.fishIds.length) throw new Error('Select at least one fish to sell.');
      if (new Set(command.fishIds).size !== command.fishIds.length) throw new Error('Each fish can only be sold once.');
      const batch = command.fishIds.map(getFish); // Every member is validated before any sale is applied.
      if (batch.some(member => isEgg(member.life))) throw new Error('Eggs cannot be sold.');
      batch.forEach(notCourting);
      sell(batch, command.priceModel);
      break;
    }
    case 'buy': {
      space(command.tankId, 1);
      if (next.credits < STOCK_PRICE) throw new Error('You need 250 lab credits for unrelated stock.');
      room(1);
      const species = command.species ?? 'koi';
      const fish = species === 'axolotl'
        ? axolotlFounder(next, '', next.nextId % 2 === 0 ? 'F' : 'M', command.timestamp)
        : founder(next, '', next.nextId % 2 === 0 ? 'F' : 'M', command.timestamp, command.genomeVersion ?? 1);
      fish.name = newFishName(`${next.seed}:fish:${next.nextId}`, fish, takenNames(next));
      fish.tankId = command.tankId;
      next.fish.push(fish); next.nextId++; next.credits -= STOCK_PRICE;
      next.ledger = recordEntry(next.ledger, 'stock', -STOCK_PRICE, 1, fish.name);
      break;
    }
    case 'buy-listing': {
      // A shop specimen (FS-502): the listed genome, sex and name become a founder in the chosen tank.
      const listing = next.shop.listings.find(entry => entry.id === command.listingId);
      if (!listing) throw new Error('That listing is no longer in the shop.');
      space(command.tankId, 1);
      room(1);
      afford(listing.price, `${listing.name} (${listing.id})`);
      next.fish.push({
        id: id(next.nextId), name: listing.name, sex: listing.sex, species: 'koi', genome: listing.genome, birthSeed: listing.birthSeed, generation: 0, parents: null,
        bornAt: iso(command.timestamp), tankId: command.tankId, status: 'living', mutations: [], life: adultLife(listing.genome), breeding: idleBreeding(), origins: [],
      });
      next.nextId++;
      next.shop = { ...next.shop, listings: next.shop.listings.filter(entry => entry.id !== listing.id) };
      next.ledger = recordEntry(next.ledger, 'stock', -listing.price, 1, `${listing.name} from ${listing.id}`);
      break;
    }
    case 'buy-axolotl-listing': {
      // An axolotl shop specimen (world v14): the listed genome, sex and name become an axolotl founder in the chosen tank.
      const listing = next.axolotlShop.listings.find(entry => entry.id === command.listingId);
      if (!listing) throw new Error('That axolotl is no longer in the shop.');
      space(command.tankId, 1);
      room(1);
      afford(listing.price, `${listing.name} (${listing.id})`);
      next.fish.push({
        id: id(next.nextId), name: listing.name, sex: listing.sex, species: 'axolotl', genome: listing.genome, birthSeed: listing.birthSeed, generation: 0, parents: null,
        bornAt: iso(command.timestamp), tankId: command.tankId, status: 'living', mutations: [], life: adultLife(listing.genome), breeding: idleBreeding(), origins: [],
      });
      next.nextId++;
      next.axolotlShop = { ...next.axolotlShop, listings: next.axolotlShop.listings.filter(entry => entry.id !== listing.id) };
      next.ledger = recordEntry(next.ledger, 'stock', -listing.price, 1, `${listing.name} from ${listing.id}`);
      break;
    }
    case 'purchase-tank': {
      if (next.tanks.length >= MAX_TANKS) throw new Error('This lab supports up to eight tanks.');
      afford(TANK_PRICE, 'New aquarium');
      let n = 1; while (next.tanks.some(t => t.id === `tank-${n}`)) n++;
      const tank = newTank(`tank-${n}`, `Lineage Tank ${n}`, false);
      tank.capacity = 20; tank.water.volumeL = 10000;
      next.tanks.push(tank);
      next.ledger = recordEntry(next.ledger, 'equipment', -TANK_PRICE, 0, `Aquarium: ${tank.name}`);
      break;
    }
    case 'upgrade-tank': {
      const tank = space(command.tankId, 0);
      if (tank.capacity >= 60) throw new Error('This aquarium already has the maximum 60 places.');
      if (tank.water.volumeL > 190000) throw new Error('This imported aquarium is too large to expand.');
      afford(TANK_UPGRADE_PRICE, 'Aquarium expansion');
      const volume = tank.water.volumeL;
      tank.capacity = Math.min(60, tank.capacity + 20);
      tank.water.volumeL += 10000;
      tank.water.ammoniaMgL *= volume / tank.water.volumeL;
      next.ledger = recordEntry(next.ledger, 'equipment', -TANK_UPGRADE_PRICE, 0, `Expansion: ${tank.name}`);
      break;
    }
    case 'place-decorations': {
      const tank = space(command.tankId, 0), previous = decorationsOf(tank);
      validateLayout(command.decorations);
      // A piece is new unless the same ID held the same catalog piece, so swapping what an ID shows is charged (FS-117).
      const added = command.decorations.filter(item => !previous.some(old => old.id === item.id && old.item === item.item));
      // FS-503 pieces without a catalog item keep their flat price, so older journals replay with the same charges.
      const cost = added.reduce((sum, item) => sum + piecePrice(item), 0);
      afford(cost, 'Decorations');
      tank.decorations = command.decorations;
      tank.planted = command.decorations.some(item => item.kind === 'cover');
      if (cost) next.ledger = recordEntry(next.ledger, 'equipment', -cost, 0, `Decorations: ${tank.name}`);
      break;
    }
    case 'style-tank': {
      // FS-117: a cosmetic look. Each facet changed to a paid option is charged; water and behavior are unaffected.
      const tank = space(command.tankId, 0), cost = styleCost(styleOf(tank), command.style);
      afford(cost, 'The new look');
      tank.style = { substrate: command.style.substrate, backdrop: command.style.backdrop, lighting: command.style.lighting };
      if (cost) next.ledger = recordEntry(next.ledger, 'equipment', -cost, 0, `Aquascape look: ${tank.name}`);
      break;
    }
    // Historical free commands remain for replay and frozen research scenarios; live UI uses paid commands.
    case 'add-tank':
      if (next.tanks.length >= MAX_TANKS) throw new Error('This lab supports up to eight tanks.');
      next.tanks.push(newTank(`tank-${next.tanks.length + 1}`, `Lineage Tank ${next.tanks.length + 1}`, true));
      break;
    case 'decorate': {
      const tank = space(command.tankId, 0); tank.planted = !tank.planted; tank.decorations = tank.planted ? legacyDecorations() : []; break;
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
      const cost = careCost(tank, wanted);
      afford(cost, 'This equipment');
      if (cost) next.ledger = recordEntry(next.ledger, 'equipment', -cost, 0, tank.name);
      tank.water = updated.water; tank.care = updated.care;
      break;
    }
    case 'change-water': {
      const tank = space(command.tankId, 0);
      const cost = waterChangeCost(tank.water, command.percent);
      afford(cost, `A ${command.percent}% water change`);
      next.ledger = recordEntry(next.ledger, 'waterChange', -cost, 0, `${command.percent}% in ${tank.name}`);
      tank.water = applyWaterChange(tank.water, command.percent);
      break;
    }
    case 'pair': {
      // Normal breeding (FS-401/402): every hard rule is checked, then nursery places are reserved until spawning.
      const blockers = pairingBlockers(next, { motherId: command.motherId, fatherId: command.fatherId, nurseryId: command.nurseryId, size: command.size },
        { maxLiving: MAX_LIVING, maxRecords: MAX_RECORDS });
      if (blockers.length) throw new Error(blockers.map(blocker => blocker.message).join(' '));
      const mother = getFish(command.motherId), father = getFish(command.fatherId);
      if (mother.species === 'koi' && command.genomeVersion < Math.max((mother.genome as Genome).version, (father.genome as Genome).version))
        throw new Error(`Genome v${Math.max((mother.genome as Genome).version, (father.genome as Genome).version)} parents cannot produce a genome v${command.genomeVersion} clutch.`);
      next.clutches.push({
        id: clutchId(next.nextClutchId), motherId: mother.id, fatherId: father.id, tankId: mother.tankId, nurseryId: command.nurseryId,
        species: mother.species, size: command.size, genomeVersion: mother.species === 'koi' ? command.genomeVersion : GENOME_VERSION, pairedAt: iso(command.timestamp), stage: 'courting', days: 0, progress: 0,
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
    case 'move-batch': {
      // Batch rehoming (FS-406): every member and the destination's free places, reservations included, are checked before any fish moves.
      if (new Set(command.fishIds).size !== command.fishIds.length) throw new Error('Each fish can only be moved once.');
      const batch = command.fishIds.map(getFish), arriving = batch.filter(member => member.tankId !== command.tankId).length;
      const tank = space(command.tankId, arriving);
      if (!arriving) throw new Error(`These fish already live in ${tank.name}.`);
      for (const fish of batch) fish.tankId = command.tankId;
      break;
    }
    case 'rehome-batch': {
      // Economy-neutral rehoming (FS-501): fish leave the aquarium for new homes. No credits change and records remain.
      if (new Set(command.fishIds).size !== command.fishIds.length) throw new Error('Each fish can only be rehomed once.');
      const batch = command.fishIds.map(getFish);
      if (batch.some(member => isEgg(member.life))) throw new Error('Eggs cannot be rehomed. Wait until they hatch.');
      for (const fish of batch) if (courtingClutchOf(next, fish.id)) throw new Error(`${fish.name} is courting. Cancel the courtship before rehoming.`);
      for (const fish of batch) fish.status = 'rehomed';
      next.ledger = recordEntry(next.ledger, 'rehome', 0, batch.length, `${names(batch)} rehomed`);
      break;
    }
    case 'claim-relief': {
      // No-money recovery (FS-504): the koi rescue gives one unrelated adult of each missing sex at no cost, then waits.
      const status = reliefStatus(next);
      if (!status.eligible) throw new Error(status.reason);
      room(status.sexes.length);
      space(command.tankId, status.sexes.length);
      const taken = takenNames(next), rescued: Fish[] = [];
      for (const sex of status.sexes) {
        const birthSeed = hash(`${next.seed}:relief:${next.nextId}`), genome = founderGenome(birthSeed, command.genomeVersion);
        const fish: Fish = {
          id: id(next.nextId), name: newFishName(`${next.seed}:fish:${next.nextId}`, { sex, genome }, taken), sex, species: 'koi', genome, birthSeed, generation: 0, parents: null,
          bornAt: iso(command.timestamp), tankId: command.tankId, status: 'living', mutations: [], life: adultLife(genome), breeding: idleBreeding(), origins: [],
        };
        rescued.push(fish); next.fish.push(fish); next.nextId++;
      }
      next.relief = { model: 1, claims: next.relief.claims + 1, cooldownDays: RELIEF_COOLDOWN_DAYS };
      next.ledger = recordEntry(next.ledger, 'stock', 0, rescued.length, `Koi rescue: ${names(rescued)} at no cost`);
      break;
    }
    case 'register-bloodline': {
      // Named bloodlines (FS-604): the standard is taken from the foundation now and never changes afterwards.
      const problem = registrationProblem(next, command.name, command.foundationIds);
      if (problem) throw new Error(problem);
      const foundation = command.foundationIds.map(fishId => next.fish.find(f => f.id === fishId)!);
      next.bloodlines.push({ id: bloodlineId(next.nextBloodlineId), name: command.name.trim(), registeredAt: iso(command.timestamp), foundationIds: [...command.foundationIds], standard: captureStandard(foundation) });
      next.nextBloodlineId++;
      break;
    }
    case 'rename-bloodline': {
      const line = next.bloodlines.find(entry => entry.id === command.bloodlineId);
      if (!line) throw new Error('Bloodline not found.');
      const name = command.name.trim();
      if (!name || name.length > 32) throw new Error('Name the bloodline with 1 to 32 characters.');
      if (next.bloodlines.some(entry => entry.id !== line.id && entry.name.toLocaleLowerCase('en') === name.toLocaleLowerCase('en'))) throw new Error(`A bloodline named ${name} is already registered.`);
      line.name = name;
      break;
    }
  }
  if (next.credits > 1e9) throw new Error('The lab credit limit would be exceeded.');
  return next;
}
