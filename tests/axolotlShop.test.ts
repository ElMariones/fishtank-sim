import { describe, expect, it } from 'vitest';
import { AXOLOTL_EXPRESSION_NOTES, AXOLOTL_LOCI, AXOLOTL_LOCUS_INDEX, AXOLOTL_LOCUS_NOTES, AXOLOTL_LOCUS_REGISTRY } from '../src/core/axolotlCatalog';
import { AXOLOTL_MORPH_RARITY, axolotlFounderGenome, describeAxolotlPhenotype, expressAxolotl, type AxolotlGenome } from '../src/core/axolotlGenetics';
import {
  AXOLOTL_CARRIER_PRICE, AXOLOTL_FOUNDER_PRICE, AXOLOTL_SHOP_SIZE, axolotlListingProblem, initialAxolotlShop, makeAxolotlListing, previewAxolotl,
} from '../src/core/axolotlShop';
import { GENOME_LOCI } from '../src/core/catalog';
import { AXOLOTL_MINIATURE_CM, BUYERS, bestOffer, FOUNDER_RESALE_CAP, offersFor, planSales } from '../src/core/economy';
import { KOI_EXPRESSION_NOTES, KOI_LOCUS_NOTES } from '../src/core/locusNotes';
import { LOCUS_REGISTRY } from '../src/core/registry';
import { advanceRuntime, commandEnvelope, createRuntime, decodeRuntime, executeCommand } from '../src/core/runtime';
import { decodeSave } from '../src/core/save';
import { SHOP_LISTING_DAYS, SHOP_REFRESH_DAYS } from '../src/core/shop';
import type { AxolotlListing, Fish, World } from '../src/core/types';
import { TICKS_PER_GAME_DAY } from '../src/core/water';
import { applyCommand, createWorld, WORLD_VERSION, type Command } from '../src/core/world';

const NOW = '2026-09-19T12:00:00.000Z';
const DAY = TICKS_PER_GAME_DAY;
const buy = (listing: AxolotlListing | string, tankId = 'tank-2'): Command =>
  ({ type: 'buy-axolotl-listing', listingId: typeof listing === 'string' ? listing : listing.id, tankId, timestamp: NOW });
const severeCopies = (genome: AxolotlGenome, locus: keyof typeof AXOLOTL_LOCUS_INDEX) =>
  [genome.maternal[AXOLOTL_LOCUS_INDEX[locus]], genome.paternal[AXOLOTL_LOCUS_INDEX[locus]]].filter(allele => allele >= 4).length;

describe('axolotl shop stock (world v14)', () => {
  it('lists fixed founders, morphs and documented carriers whose price and note match the genome', () => {
    const world = createWorld(NOW);
    expect(world.version).toBe(WORLD_VERSION);
    expect(world.axolotlShop).toEqual(initialAxolotlShop(world.seed));
    expect(world.axolotlShop.listings.map(listing => listing.id)).toEqual(['AX-000001', 'AX-000002', 'AX-000003', 'AX-000004']);

    const seen = new Map<string, number>();
    for (let n = 1; n <= 240; n++) {
      const listing = makeAxolotlListing(17, n, 5);
      seen.set(listing.category, (seen.get(listing.category) ?? 0) + 1);
      expect(axolotlListingProblem(listing)).toBeNull();
      expect(listing.expiresDay).toBe(5 + SHOP_LISTING_DAYS);
      expect(listing).toEqual(makeAxolotlListing(17, n, 5));
      const morph = expressAxolotl(listing.genome).pigmentation.morph;
      if (listing.category === 'founder') expect(listing.price).toBe(AXOLOTL_FOUNDER_PRICE);
      if (listing.category === 'morph') expect(AXOLOTL_MORPH_RARITY[morph]).toBeGreaterThan(0);
      if (listing.category === 'carrier') {
        expect(listing.price).toBe(AXOLOTL_CARRIER_PRICE);
        expect(severeCopies(listing.genome, listing.carries!.locus)).toBe(1);
      }
      // Buying to resell always loses credits.
      expect(listing.price).toBeGreaterThan(FOUNDER_RESALE_CAP);
      expect(bestOffer(world, previewAxolotl(listing))?.amount ?? 0).toBeLessThanOrEqual(FOUNDER_RESALE_CAP);
    }
    expect([...seen.keys()].sort()).toEqual(['carrier', 'founder', 'morph']);
  });

  it('never changes koi shop stock', () => {
    const world = createWorld(NOW);
    const { axolotlShop: _stock, ...rest } = world;
    void _stock;
    expect(rest.shop).toEqual(createWorld(NOW).shop);
    expect(world.shop.listings.map(listing => listing.id)).toEqual(['LS-000001', 'LS-000002', 'LS-000003', 'LS-000004', 'LS-000005', 'LS-000006']);
  });

  it('buys a listed axolotl atomically into the chosen tank with its listed genome, sex and name', () => {
    const world = createWorld(NOW), listing = world.axolotlShop.listings[0];
    const next = applyCommand(world, buy(listing));
    const fish = next.fish.at(-1)!;
    expect(fish).toMatchObject({ species: 'axolotl', name: listing.name, sex: listing.sex, genome: listing.genome, birthSeed: listing.birthSeed, tankId: 'tank-2', generation: 0, parents: null });
    expect(next.credits).toBe(world.credits - listing.price);
    expect(next.axolotlShop.listings.map(entry => entry.id)).not.toContain(listing.id);
    expect(next.ledger.entries.at(-1)).toMatchObject({ reason: 'stock', amount: -listing.price, fish: 1 });
    expect(decodeSave(JSON.stringify(next))).toEqual(next);

    expect(() => applyCommand(next, buy(listing))).toThrow('no longer in the shop');
    const poor = { ...world, credits: listing.price - 1, ledger: { ...world.ledger } };
    expect(() => applyCommand(poor, buy(listing))).toThrow(/costs/);
    expect(poor.axolotlShop.listings).toHaveLength(AXOLOTL_SHOP_SIZE);
  });

  it('refreshes on the koi delivery rhythm and replays identically', () => {
    let runtime = createRuntime(createWorld(NOW), 'axolotl-shop');
    runtime = executeCommand(runtime, commandEnvelope(runtime, buy(runtime.world.axolotlShop.listings[1]), 40));
    expect(runtime.world.axolotlShop.listings).toHaveLength(AXOLOTL_SHOP_SIZE - 1);
    runtime = advanceRuntime(runtime, (SHOP_REFRESH_DAYS - 1) * DAY + 5);
    expect(runtime.world.axolotlShop.listings).toHaveLength(AXOLOTL_SHOP_SIZE - 1);
    runtime = advanceRuntime(runtime, SHOP_REFRESH_DAYS * DAY + 5);
    expect(runtime.world.axolotlShop.listings).toHaveLength(AXOLOTL_SHOP_SIZE);
    expect(runtime.world.axolotlShop.listings.at(-1)!.id).toBe('AX-000005');
    runtime = advanceRuntime(runtime, (SHOP_LISTING_DAYS + SHOP_REFRESH_DAYS) * DAY + 5);
    expect(runtime.world.axolotlShop.listings.every(listing => listing.expiresDay > SHOP_LISTING_DAYS)).toBe(true);
    expect(decodeRuntime(JSON.stringify(runtime))).toEqual(runtime);
  });

  it('rejects edited prices, carriers and categories', () => {
    const world = createWorld(NOW);
    const withListing = (edit: (listing: AxolotlListing) => void) => {
      const copy = structuredClone(world);
      edit(copy.axolotlShop.listings[0]);
      return JSON.stringify(copy);
    };
    expect(() => decodeSave(withListing(listing => { listing.price = 1; }))).toThrow();
    expect(() => decodeSave(withListing(listing => { listing.category = 'carrier'; listing.carries = null; }))).toThrow();
    expect(() => decodeSave(withListing(listing => { listing.id = 'AX-000099'; }))).toThrow('Invalid axolotl shop listing');
  });

  it('migrates v13 worlds and runtimes, rebuilding stock from their own replay', () => {
    const asV13 = (world: World) => { const { axolotlShop, ...rest } = world; void axolotlShop; return { ...rest, version: 13 }; };
    const world = createWorld(NOW);
    expect(decodeSave(JSON.stringify(asV13(world)))).toEqual(world);

    let runtime = createRuntime(createWorld(NOW), 'axolotl-v13');
    runtime = executeCommand(runtime, commandEnvelope(runtime, { type: 'buy', species: 'axolotl', tankId: 'tank-1', timestamp: NOW }, 50));
    runtime = advanceRuntime(runtime, 7 * DAY + 3);
    const stored = JSON.parse(JSON.stringify(runtime));
    stored.world = asV13(stored.world);
    stored.checkpoint.world = asV13(stored.checkpoint.world);
    const decoded = decodeRuntime(JSON.stringify(stored));
    expect(decoded.world).toEqual(runtime.world);
    expect(decoded.events).toEqual([]);
    expect(decodeRuntime(JSON.stringify(decoded))).toEqual(decoded);
  });
});

describe('price model 2 judges axolotls within their species', () => {
  const axolotlFish = (world: World, genome: AxolotlGenome, id = 'FSH-000007'): Fish => ({
    ...world.fish[0], id, species: 'axolotl', genome, parents: [world.fish[0].id, world.fish[1].id], generation: 1, mutations: [], origins: [],
    life: { ...world.fish[0].life, lengthCm: 10 },
  });

  it('keeps pond keepers away and only lets small axolotls interest the miniature keeper', () => {
    const world = createWorld(NOW);
    let small = 0, large = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const genome = axolotlFounderGenome(seed), fish = axolotlFish(world, genome), length = expressAxolotl(genome).adultLengthCm;
      const buyers = new Set(offersFor(world, fish).map(offer => offer.buyer));
      expect(buyers.has('pondKeeper')).toBe(false);
      expect(buyers.has('miniature')).toBe(length <= AXOLOTL_MINIATURE_CM);
      if (length <= AXOLOTL_MINIATURE_CM) small++; else large++;
      // Model 1 still prices every axolotl as a sub-40 cm miniature, so recorded sales replay as they were.
      expect(offersFor(world, fish, undefined, world.market.demand, 1).some(offer => offer.buyer === 'miniature')).toBe(true);
    }
    expect(small).toBeGreaterThan(0);
    expect(large).toBeGreaterThan(small);
  });

  it('sell commands keep the price model they were recorded with', () => {
    let world = createWorld(NOW);
    const genome = axolotlFounderGenome(3);
    world = { ...world, nextId: 8, fish: [...world.fish, axolotlFish(world, genome)] };
    const model1 = planSales(world, ['FSH-000007'], undefined, 1).total, model2 = planSales(world, ['FSH-000007']).total;
    expect(applyCommand(world, { type: 'sell', fishId: 'FSH-000007', priceModel: 1 }).credits).toBe(world.credits + model1);
    expect(applyCommand(world, { type: 'sell', fishId: 'FSH-000007', priceModel: 2 }).credits).toBe(world.credits + model2);
    expect(BUYERS.map(buyer => buyer.id)).toContain('pondKeeper');
  });
});

describe('genome view locus notes', () => {
  it('describe every koi and axolotl locus and inheritance mode', () => {
    for (const entry of LOCUS_REGISTRY) {
      expect(KOI_LOCUS_NOTES[entry.id].length).toBeGreaterThan(10);
      expect(KOI_EXPRESSION_NOTES[entry.expression]).toBeTruthy();
    }
    expect(Object.keys(KOI_LOCUS_NOTES)).toHaveLength(GENOME_LOCI.length);
    for (const entry of AXOLOTL_LOCUS_REGISTRY) {
      expect(AXOLOTL_LOCUS_NOTES[entry.id].length).toBeGreaterThan(10);
      expect(AXOLOTL_EXPRESSION_NOTES[entry.expression]).toBeTruthy();
    }
    expect(Object.keys(AXOLOTL_LOCUS_NOTES)).toHaveLength(AXOLOTL_LOCI.length);
  });

  it('marks unsimulated axolotl traits and reports hidden carriers', () => {
    const genome = axolotlFounderGenome(21), index = AXOLOTL_LOCUS_INDEX.axo_albinism_switch;
    const carrier: AxolotlGenome = { ...genome, maternal: [...genome.maternal], paternal: [...genome.paternal] };
    carrier.maternal[index] = 5; carrier.paternal[index] = 0;
    const rows = describeAxolotlPhenotype(carrier);
    expect(rows.find(row => row.trait === 'Hidden copies')?.value).toContain('albino-like');
    expect(rows.filter(row => row.note).map(row => row.trait).sort()).toEqual(['Feeding drive', 'Maturity', 'Regeneration potential']);
  });
});
