import { savedDecorationsSchema } from './tankSchema';
import { decorationsOf, validateLayout } from './tankManagement';
import { z } from 'zod';
import { BLOCKER_CODES, CLUTCH_SIZES, CLUTCH_STAGES, idleBreeding, reservedPlaces } from './breeding';
import { defaultCare, RATION_KEYS, THERMOSTAT_RANGE } from './care';
import { ALL_LOCI, APPEARANCE_LOCI, GENOME_LOCI, LOCI } from './catalog';
import { genomeProblem } from './registry';
import { adultLife } from './development';
import { BUYER_BY_ID, defaultMarket, LEDGER_LIMIT, LEDGER_REASONS, ledgerBalance, openingLedger } from './economy';
import { metabolicPotential } from './genetics';
import { NAMING_MODEL } from './names';
import { CARRIER_LOCI, initialShop, LISTING_GENOME, LISTING_PRICES, SHOP_SIZE } from './shop';
import { defaultRelief, RELIEF_COOLDOWN_DAYS } from './recovery';
import type { Fish, Tank, World } from './types';
import { defaultWater, WATER_LIMITS } from './water';
import { MAX_LIVING, MAX_RECORDS, MAX_TANKS } from './world';

const alleles = (count: number) => z.array(z.number().int().min(0).max(5)).length(count);
const fishIdSchema = z.string().regex(/^FSH-\d{6}$/);
/** Genome v1 records stay valid unchanged; genome v2 records carry the appended Color and Ornament loci. */
const genome = z.discriminatedUnion('version', [
  z.object({ version: z.literal(1), maternal: alleles(LOCI.length), paternal: alleles(LOCI.length) }),
  z.object({ version: z.literal(2), maternal: alleles(ALL_LOCI.length), paternal: alleles(ALL_LOCI.length) }),
  // Genome v3 (FS-601) appends the Structure chromosome; the registry also rejects alleles a structure locus does not support.
  z.object({ version: z.literal(3), maternal: alleles(GENOME_LOCI.length), paternal: alleles(GENOME_LOCI.length) }),
]).superRefine((value, context) => { const problem = genomeProblem(value); if (problem) context.addIssue({ code: 'custom', message: problem }); });
const bounded = ([minimum, maximum]: readonly [number, number]) => z.number().min(minimum).max(maximum);
/** Water model v1 state, carried by every world v2+ tank. */
const water = z.object({
  model: z.literal(1), volumeL: bounded(WATER_LIMITS.volumeL), temperatureC: bounded(WATER_LIMITS.temperatureC),
  oxygenMgL: bounded(WATER_LIMITS.oxygenMgL), ammoniaMgL: bounded(WATER_LIMITS.ammoniaMgL), foodG: bounded(WATER_LIMITS.foodG),
  filterMgNPerDay: bounded(WATER_LIMITS.filterMgNPerDay), aerationPerDay: bounded(WATER_LIMITS.aerationPerDay),
}).strict();
/** Care model v1 state, carried by every world v4+ tank. */
const care = z.object({
  model: z.literal(1), ration: z.enum(RATION_KEYS), targetC: z.number().int().min(THERMOSTAT_RANGE[0]).max(THERMOSTAT_RANGE[1]),
  dayNeedG: z.number().min(0).max(1e12), dayEatenG: z.number().min(0).max(1e12), fed: z.number().min(0).max(1),
}).strict();
/** Life model v1 state, carried by every world v3+ fish. */
const life = z.object({
  model: z.literal(1), ageDays: z.number().int().min(0).max(10_000_000), lengthCm: z.number().min(0).max(200), condition: z.number().min(0).max(1),
}).strict();
/** Breeding model v1 state, carried by every world v5 fish. */
const breeding = z.object({ model: z.literal(1), cooldownDays: z.number().int().min(0).max(365) }).strict();
/** Clutch records, world v5 (FS-402). */
const clutch = z.object({
  id: z.string().regex(/^CL-\d{6}$/), motherId: fishIdSchema, fatherId: fishIdSchema, tankId: z.string().max(50), nurseryId: z.string().max(50),
  size: z.union([z.literal(CLUTCH_SIZES[0]), z.literal(CLUTCH_SIZES[1]), z.literal(CLUTCH_SIZES[2]), z.literal(CLUTCH_SIZES[3]), z.literal(CLUTCH_SIZES[4])]),
  genomeVersion: z.union([z.literal(1), z.literal(2), z.literal(3)]), pairedAt: z.string().datetime(), stage: z.enum(CLUTCH_STAGES),
  days: z.number().int().min(0).max(10_000_000), progress: z.number().min(0).max(1), blockers: z.array(z.enum(BLOCKER_CODES)).max(BLOCKER_CODES.length),
  spawnedDay: z.number().int().min(0).max(10_000_000).nullable(), firstFishId: fishIdSchema.nullable(),
}).strict();
/** NPC demand and the credit ledger, world v6 (FS-501). */
const demand = (id: keyof typeof BUYER_BY_ID) => z.number().min(0).max(BUYER_BY_ID[id].capacity);
const market = z.object({
  model: z.literal(1),
  demand: z.object({ petShop: demand('petShop'), longFin: demand('longFin'), pondKeeper: demand('pondKeeper'), miniature: demand('miniature'), colorCollector: demand('colorCollector') }).strict(),
}).strict();
const credits = z.number().int().min(-1e12).max(1e12);
const ledger = z.object({
  model: z.literal(1), opening: z.number().int().min(0).max(1e9), next: z.number().int().positive(),
  totals: z.object({ sale: credits, stock: credits, equipment: credits, waterChange: credits, rehome: credits }).strict(),
  entries: z.array(z.object({
    seq: z.number().int().positive(), reason: z.enum(LEDGER_REASONS), amount: z.number().int().min(-1e9).max(1e9),
    fish: z.number().int().min(0).max(MAX_LIVING), detail: z.string().max(120),
  }).strict()).max(LEDGER_LIMIT),
}).strict();
/** Persistent shop stock, world v7 (FS-502). */
const listing = z.object({
  id: z.string().regex(/^LS-\d{6,16}$/), category: z.enum(['founder', 'variant', 'carrier']), name: z.string().min(1).max(32), sex: z.enum(['F', 'M']),
  genome, birthSeed: z.number().int().min(0).max(4294967295), price: z.number().int().positive().max(1e6), expiresDay: z.number().int().min(0).max(1e12),
  note: z.string().max(120), carries: z.object({ locus: z.enum(APPEARANCE_LOCI), allele: z.number().int().min(1).max(5) }).strict().nullable(),
}).strict();
const shop = z.object({
  model: z.union([z.literal(1), z.literal(2)]), nextListing: z.number().int().positive(), refreshedDay: z.number().int().min(0).max(1e12), listings: z.array(listing).max(SHOP_SIZE),
}).strict();
const tank = { id: z.string().max(50), name: z.string().min(1).max(32), capacity: z.number().int().min(1).max(60), planted: z.boolean() };
const header = { seed: z.number().int().min(0).max(4294967295), nextId: z.number().int().positive(), credits: z.number().int().nonnegative().max(1e9) };
const fishRecord = {
  id: fishIdSchema, name: z.string().min(1).max(32), sex: z.enum(['F', 'M']),
  genome,
  birthSeed: z.number().int().min(0).max(4294967295), generation: z.number().int().min(0).max(MAX_RECORDS),
  parents: z.tuple([z.string(), z.string()]).nullable(), bornAt: z.string().datetime(),
  tankId: z.string(), status: z.enum(['living', 'sold']),
  mutations: z.array(z.object({ locus: z.number().int().min(0).max(GENOME_LOCI.length - 1), copy: z.enum(['maternal', 'paternal']), from: z.number().int().min(0).max(5), to: z.number().int().min(0).max(5) })).max(GENOME_LOCI.length * 2),
};
const recordsOnly = z.array(z.object(fishRecord)).max(MAX_RECORDS);
const withLife = z.array(z.object({ ...fishRecord, life })).max(MAX_RECORDS);
const tanksWithWater = z.array(z.object({ ...tank, water })).min(1).max(MAX_TANKS);
const tanksWithCare = z.array(z.object({ ...tank, water, care })).min(1).max(MAX_TANKS);
/** The koi rescue, world v9 (FS-504). */
const relief = z.object({ model: z.literal(1), claims: z.number().int().min(0).max(1_000_000), cooldownDays: z.number().int().min(0).max(RELIEF_COOLDOWN_DAYS) }).strict();
const worldV8 = {
  version: z.literal(8), ...header, nextClutchId: z.number().int().positive(),
  tanks: z.array(z.object({ ...tank, water, care, decorations: savedDecorationsSchema })).min(1).max(MAX_TANKS),
  fish: z.array(z.object({ ...fishRecord, status: z.enum(['living', 'sold', 'rehomed']), life, breeding })).max(MAX_RECORDS), clutches: z.array(clutch).max(MAX_RECORDS),
  market, ledger, shop, naming: z.union([z.literal(1), z.literal(2), z.literal(3)]),
};
const schema = z.discriminatedUnion('version', [
  // World v10 has the v9 shape; it may hold genome v3 records and shop model 2 (FS-601).
  z.object({ ...worldV8, version: z.literal(10), relief }),
  // World v9 keeps the v8 key order and appends `relief`, so migrated worlds serialize like decoded current ones.
  z.object({ ...worldV8, version: z.literal(9), relief }),
  z.object(worldV8),
  z.object({ version: z.literal(1), ...header, tanks: z.array(z.object(tank)).min(1).max(MAX_TANKS), fish: recordsOnly }),
  z.object({ version: z.literal(2), ...header, tanks: tanksWithWater, fish: recordsOnly }),
  z.object({ version: z.literal(3), ...header, tanks: tanksWithWater, fish: withLife }),
  z.object({ version: z.literal(4), ...header, tanks: tanksWithCare, fish: withLife }),
  z.object({
    version: z.literal(5), ...header, nextClutchId: z.number().int().positive(), tanks: tanksWithCare,
    fish: z.array(z.object({ ...fishRecord, life, breeding })).max(MAX_RECORDS), clutches: z.array(clutch).max(MAX_RECORDS),
  }),
  z.object({
    version: z.literal(6), ...header, nextClutchId: z.number().int().positive(), tanks: tanksWithCare,
    fish: z.array(z.object({ ...fishRecord, status: z.enum(['living', 'sold', 'rehomed']), life, breeding })).max(MAX_RECORDS), clutches: z.array(clutch).max(MAX_RECORDS),
    market, ledger,
  }),
  z.object({
    version: z.literal(7), ...header, nextClutchId: z.number().int().positive(), tanks: tanksWithCare,
    fish: z.array(z.object({ ...fishRecord, status: z.enum(['living', 'sold', 'rehomed']), life, breeding })).max(MAX_RECORDS), clutches: z.array(clutch).max(MAX_RECORDS),
    // The naming model is stored from ADR-055; a world v7 saved before it was named under model 1.
    market, ledger, shop, naming: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
  }),
]);

/**
 * World v1 predates water (FS-301): its tanks start with default, clean, oxygen-saturated water. Worlds v1–v2 predate
 * life state (FS-302): their fish become young adults at their adult length potential, as the lab always drew them.
 * Worlds v1–v3 predate care (FS-305): their tanks feed measured rations with a thermostat at the water's temperature.
 * Worlds v1–v4 predate normal breeding (FS-401/402): their fish are rested and no clutch is courting.
 * Worlds v1–v5 predate the economy (FS-501): every buyer's demand is full and the ledger opens at the saved balance.
 * Worlds v1–v6 predate the shop (FS-502): they open with a first delivery of listings.
 * Worlds v1–v6 predate generated names (ADR-055): they use the current naming model, since the runtime validates their
 * journals by records without names.
 * Worlds v1–v8 predate the koi rescue (FS-504): they start with no claims and nothing to wait for.
 * Worlds v1–v9 predate genome v3 (FS-601): v7–v9 shops keep model 1 until the runtime rebases them; v6 and older open
 * with a current shop.
 */
export function decodeSave(raw: string): World {
  if (raw.length > 12_000_000) throw new Error('Save is too large for this lab.');
  const parsed = schema.parse(JSON.parse(raw));
  let world: World;
  if (parsed.version === 10) world = parsed;
  // A world v9 kept shop model 1 and genome v2 stock; the runtime moves it to model 2 when it rebases (FS-601).
  else if (parsed.version === 9) world = { ...parsed, version: 10 };
  // Keys follow the v9 schema order: every migration appends `relief` last, after the fields its version lacked.
  else if (parsed.version === 8) world = { ...parsed, version: 10, relief: defaultRelief() };
  else if (parsed.version === 7) world = { ...parsed, version: 10, relief: defaultRelief() };
  // v6 appended market and ledger to the v5 order, and v7 appends the shop and naming.
  else if (parsed.version === 6) world = { ...parsed, version: 10, shop: initialShop(parsed.seed), naming: NAMING_MODEL, relief: defaultRelief() };
  else if (parsed.version === 5) world = { ...parsed, version: 10, market: defaultMarket(), ledger: openingLedger(parsed.credits), shop: initialShop(parsed.seed), naming: NAMING_MODEL, relief: defaultRelief() };
  else {
    const watered: Omit<Tank, 'care'>[] = parsed.version === 1 ? parsed.tanks.map(entry => ({ ...entry, water: defaultWater() })) : parsed.tanks;
    const cared: Tank[] = parsed.version === 4 ? parsed.tanks : watered.map(entry => ({ ...entry, care: defaultCare(entry.water) }));
    const lived: Omit<Fish, 'breeding'>[] = parsed.version === 3 || parsed.version === 4 ? parsed.fish : parsed.fish.map(member => ({ ...member, life: adultLife(member.genome) }));
    // Keys follow the v5 schema order: replay validation compares serialized worlds, so a migrated world must
    // serialize exactly like a decoded current one or every older save would fail to load.
    world = { version: 10, seed: parsed.seed, nextId: parsed.nextId, credits: parsed.credits, nextClutchId: 1, tanks: cared,
      fish: lived.map(member => ({ ...member, breeding: idleBreeding() })), clutches: [], market: defaultMarket(), ledger: openingLedger(parsed.credits),
      shop: initialShop(parsed.seed), naming: NAMING_MODEL, relief: defaultRelief() };
  }
  world.tanks = world.tanks.map(tank => ({ ...tank, decorations: decorationsOf(tank) }));
  for (const tank of world.tanks) {
    validateLayout(decorationsOf(tank));
    if (parsed.version >= 8 && tank.planted !== decorationsOf(tank).some(item => item.kind === 'cover')) throw new Error('Plant cover does not match the saved layout.');
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
  const clutchIds = new Set<string>(), courtingNurseries = new Set<string>(), courtingParents = new Set<string>();
  for (const entry of world.clutches) {
    const mother = ids.get(entry.motherId), father = ids.get(entry.fatherId);
    if (clutchIds.has(entry.id) || Number(entry.id.slice(3)) >= world.nextClutchId || !mother || !father || mother.sex !== 'F' || father.sex !== 'M'
      || !tanks.has(entry.tankId) || !tanks.has(entry.nurseryId)) throw new Error('Invalid clutch record.');
    clutchIds.add(entry.id);
    if (entry.stage === 'courting' || entry.stage === 'cancelled') {
      if (entry.firstFishId !== null || entry.spawnedDay !== null) throw new Error('A clutch without eggs lists egg records.');
      if (entry.stage === 'courting') {
        if (courtingNurseries.has(entry.nurseryId) || courtingParents.has(entry.motherId) || courtingParents.has(entry.fatherId)) throw new Error('Overlapping courtships in save.');
        courtingNurseries.add(entry.nurseryId); courtingParents.add(entry.motherId); courtingParents.add(entry.fatherId);
      }
    } else {
      if (entry.firstFishId === null || entry.spawnedDay === null || entry.progress !== 1) throw new Error('A laid clutch is missing its eggs.');
      const first = Number(entry.firstFishId.slice(4));
      for (let n = first; n < first + entry.size; n++) {
        const egg = ids.get(`FSH-${String(n).padStart(6, '0')}`);
        if (!egg || egg.parents?.[0] !== entry.motherId || egg.parents?.[1] !== entry.fatherId) throw new Error('Clutch eggs do not match their record.');
      }
    }
  }
  for (const entry of world.tanks) {
    if (world.fish.filter(f => f.status === 'living' && f.tankId === entry.id).length + reservedPlaces(world, entry.id) > entry.capacity) throw new Error('Tank exceeds capacity.');
    if (entry.care.dayEatenG > entry.care.dayNeedG) throw new Error('A tank ate more food than its residents needed.');
  }
  if (ledgerBalance(world.ledger) !== world.credits) throw new Error('Credits do not agree with the ledger.');
  if (world.relief.cooldownDays > 0 && world.relief.claims === 0) throw new Error('The koi rescue is waiting without any claim.');
  world.ledger.entries.forEach((entry, i) => {
    if (entry.seq >= world.ledger.next || (i > 0 && entry.seq <= world.ledger.entries[i - 1].seq)) throw new Error('Ledger entries are out of order.');
  });
  const listingIds = new Set<string>();
  for (const entry of world.shop.listings) {
    const sequence = Number(entry.id.slice(3));
    // A shop moved to model 2 keeps its earlier genome v2 listings until they sell or expire.
    if (entry.genome.version < 2 || entry.genome.version > LISTING_GENOME[world.shop.model]) throw new Error('Shop listing genome does not match the shop model.');
    if (listingIds.has(entry.id) || !Number.isSafeInteger(sequence) || sequence < 1 || sequence >= world.shop.nextListing
      || entry.expiresDay <= world.shop.refreshedDay || entry.price !== LISTING_PRICES[entry.category]) throw new Error('Invalid shop listing.');
    if (entry.category === 'carrier') {
      const carrier = entry.carries;
      if (!carrier || !CARRIER_LOCI.some(locus => locus === carrier.locus) || entry.genome.version < 2) throw new Error('Invalid shop carrier.');
      const offset = LOCI.length + APPEARANCE_LOCI.indexOf(carrier.locus);
      const pair = [entry.genome.maternal[offset], entry.genome.paternal[offset]];
      if (!pair.includes(0) || !pair.includes(carrier.allele)) throw new Error('Shop carrier does not match its genome.');
    } else if (entry.carries !== null) throw new Error('Only carrier listings may document a hidden copy.');
    listingIds.add(entry.id);
  }
  return world;
}

export const SAVE_KEY = 'fishtank-sim.lab.v1';
