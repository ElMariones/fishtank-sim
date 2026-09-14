import { describe, expect, it } from 'vitest';
import { appearanceAlleles, appearanceFeatures, expressAppearance } from '../src/core/appearance';
import type { AppearanceLocus } from '../src/core/catalog';
import { LOCI, APPEARANCE_LOCI } from '../src/core/catalog';
import { bestOffer, FOUNDER_RESALE_CAP } from '../src/core/economy';
import { advanceWorld } from '../src/core/habitat';
import { advanceRuntime, commandEnvelope, createRuntime, decodeRuntime, executeCommand } from '../src/core/runtime';
import { decodeSave } from '../src/core/save';
import { initialShop, LISTING_PRICES, previewFish, SHOP_LISTING_DAYS, SHOP_REFRESH_DAYS, SHOP_SIZE } from '../src/core/shop';
import type { Listing, World } from '../src/core/types';
import { TICKS_PER_GAME_DAY } from '../src/core/water';
import { applyCommand, createWorld, STOCK_PRICE, type Command } from '../src/core/world';

const NOW = '2026-09-14T12:00:00.000Z';
const DAY = TICKS_PER_GAME_DAY;
const buy = (listing: Listing | string, tankId = 'tank-2'): Command => ({ type: 'buy-listing', listingId: typeof listing === 'string' ? listing : listing.id, tankId, timestamp: NOW });
const ids = (world: World) => world.shop.listings.map(listing => listing.id);
/** A current save written as world v6: no shop, and the older version number. */
function asV6(world: World) {
  const { shop, ...rest } = world;
  void shop;
  return { ...rest, version: 6 };
}

describe('FS-502 shop stock', () => {
  it('lists fixed founders, visible variants and documented carriers, each priced above any resale', () => {
    const world = createWorld(NOW);
    expect(ids(world)).toEqual(['LS-000001', 'LS-000002', 'LS-000003', 'LS-000004', 'LS-000005', 'LS-000006']);
    expect(world.shop).toEqual(initialShop(world.seed));
    expect(createWorld('2027-01-01T00:00:00.000Z').shop).toEqual(world.shop);
    expect(LISTING_PRICES.founder).toBe(STOCK_PRICE);

    const seen = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      for (const listing of initialShop(seed).listings) {
        seen.add(listing.category);
        expect(listing.price).toBe(LISTING_PRICES[listing.category]);
        expect(listing.expiresDay).toBe(SHOP_LISTING_DAYS);
        expect(bestOffer(world, previewFish(listing))?.amount ?? 0).toBeLessThanOrEqual(FOUNDER_RESALE_CAP);
        expect(listing.price).toBeGreaterThan(FOUNDER_RESALE_CAP);
        const shown = expressAppearance(listing.genome);
        if (listing.category === 'variant') expect(appearanceFeatures(shown).length).toBeGreaterThan(0);
        if (listing.category === 'carrier') {
          const { locus, allele } = listing.carries!, pair = appearanceAlleles(listing.genome, locus as AppearanceLocus);
          expect([...pair].sort()).toEqual([0, allele]);
          // Removing the carried copy changes nothing visible: the variant is hidden.
          const offset = LOCI.length + APPEARANCE_LOCI.indexOf(locus as AppearanceLocus), plain = { ...listing.genome, maternal: [...listing.genome.maternal] };
          plain.maternal[offset] = 0;
          expect(expressAppearance(plain)).toEqual(shown);
          expect(listing.note).toContain('Carries one hidden');
        } else expect(listing.carries).toBeNull();
      }
    }
    expect([...seen].sort()).toEqual(['carrier', 'founder', 'variant']);
  });

  it('keeps stock fixed between deliveries, refills empty places on delivery days and replays exactly', () => {
    const world = createWorld(NOW), start = world.shop.listings;
    const twoDays = advanceWorld(world, 0, 2 * DAY + 600);
    expect(twoDays.shop.listings).toEqual(start);
    expect(decodeSave(JSON.stringify(twoDays)).shop).toEqual(twoDays.shop);

    const bought = applyCommand(advanceWorld(world, 0, DAY), buy(start[0]));
    expect(ids(bought)).toEqual(ids(world).slice(1));
    expect(ids(advanceWorld(bought, DAY, 2 * DAY))).toEqual(ids(world).slice(1));
    const delivered = advanceWorld(bought, DAY, SHOP_REFRESH_DAYS * DAY);
    expect(ids(delivered)).toEqual([...ids(world).slice(1), 'LS-000007']);
    expect(delivered.shop.listings.at(-1)!.expiresDay).toBe(SHOP_REFRESH_DAYS + SHOP_LISTING_DAYS);

    const later = advanceWorld(delivered, SHOP_REFRESH_DAYS * DAY, SHOP_LISTING_DAYS * DAY);
    expect(ids(later)).toEqual(['LS-000007', 'LS-000008', 'LS-000009', 'LS-000010', 'LS-000011', 'LS-000012']);
    expect(later.shop.listings).toHaveLength(SHOP_SIZE);
    let stepped = bought;
    for (let day = 1; day < SHOP_LISTING_DAYS; day++) stepped = advanceWorld(stepped, day * DAY, (day + 1) * DAY);
    expect(stepped.shop).toEqual(later.shop);

    let runtime = createRuntime(world, 'fs502-shop');
    runtime = advanceRuntime(runtime, DAY + 300);
    runtime = executeCommand(runtime, commandEnvelope(runtime, buy(start[2], 'tank-1')));
    runtime = advanceRuntime(runtime, 7 * DAY);
    expect(decodeRuntime(JSON.stringify(runtime)).world).toEqual(runtime.world);
  });

  it('buys a listing atomically, respecting stock, credits, capacity and reservations', () => {
    const world = createWorld(NOW), listing = world.shop.listings[0];
    const bought = applyCommand(world, buy(listing));
    const fish = bought.fish.at(-1)!;
    expect(fish).toMatchObject({ id: 'FSH-000007', name: listing.name, sex: listing.sex, genome: listing.genome, birthSeed: listing.birthSeed, generation: 0, parents: null, tankId: 'tank-2', status: 'living' });
    expect([bought.credits, bought.nextId, bought.ledger.entries.at(-1)]).toEqual([world.credits - listing.price, world.nextId + 1, expect.objectContaining({ reason: 'stock', amount: -listing.price, fish: 1 })]);
    expect(ids(bought)).not.toContain(listing.id);

    const refused = (candidate: World, command: Command, message: string) => {
      const before = JSON.stringify(candidate);
      expect(() => applyCommand(candidate, command)).toThrow(message);
      expect(JSON.stringify(candidate)).toBe(before);
    };
    refused(bought, buy(listing), 'no longer in the shop');
    refused(world, buy('LS-999999'), 'no longer in the shop');
    refused({ ...world, credits: 10 }, buy(listing), `costs ◈ ${listing.price} and you have ◈ 10`);
    refused(world, buy(listing, 'tank-9'), 'Tank not found');
    const cross = (tankId: string): Command => ({ type: 'breed', motherId: 'FSH-000001', fatherId: 'FSH-000002', tankId, timestamp: NOW, genomeVersion: 2 });
    const full = applyCommand(applyCommand(applyCommand(world, cross('tank-2')), cross('tank-2')), cross('tank-2'));
    refused(full, buy(listing), 'free places');
    const reserved = applyCommand(applyCommand(applyCommand(world, cross('tank-2')), cross('tank-2')),
      { type: 'pair', motherId: 'FSH-000003', fatherId: 'FSH-000004', nurseryId: 'tank-2', size: 20, timestamp: NOW, genomeVersion: 2 });
    refused(reserved, buy(listing), 'reserved for a courting clutch');
  });

  it('migrates world v6 saves with a first delivery and rebases older runtimes', () => {
    const world = applyCommand(createWorld(NOW), buy(createWorld(NOW).shop.listings[1]));
    const migrated = decodeSave(JSON.stringify(asV6(world)));
    expect(migrated.shop).toEqual(initialShop(world.seed));
    expect(Object.keys(migrated)).toEqual(Object.keys(decodeSave(JSON.stringify(world))));

    let runtime = createRuntime(createWorld(NOW), 'fs502-legacy');
    runtime = executeCommand(runtime, commandEnvelope(runtime, { type: 'buy', tankId: 'tank-2', timestamp: NOW, genomeVersion: 2 }));
    runtime = executeCommand(runtime, commandEnvelope(runtime, { type: 'sell', fishId: 'FSH-000003', priceModel: 1 }));
    runtime = advanceRuntime(runtime, runtime.tick + 40 * DAY);
    const stored = JSON.parse(JSON.stringify(runtime));
    stored.world = asV6(stored.world);
    stored.checkpoint.world = asV6(stored.checkpoint.world);
    const decoded = decodeRuntime(JSON.stringify(stored));
    expect([decoded.world.credits, decoded.events.length, decoded.world.shop.listings.length]).toEqual([runtime.world.credits, 0, SHOP_SIZE]);
    expect(decoded.world.shop.refreshedDay).toBe(40);
    expect(decoded.world.shop.listings.every(listing => listing.expiresDay === 49)).toBe(true);
    expect(advanceRuntime(decoded, 41 * DAY).world.shop.listings).toEqual(decoded.world.shop.listings);
    expect(decodeRuntime(JSON.stringify(decoded))).toEqual(decoded);

    const raw = JSON.parse(JSON.stringify(world));
    expect(() => decodeSave(JSON.stringify({ ...raw, shop: { ...raw.shop, listings: [raw.shop.listings[0], raw.shop.listings[0]] } }))).toThrow('Invalid shop listing');
    expect(() => decodeSave(JSON.stringify({ ...raw, shop: { ...raw.shop, nextListing: 2 } }))).toThrow('Invalid shop listing');
    expect(() => decodeSave(JSON.stringify({ ...raw, shop: { ...raw.shop, listings: [...raw.shop.listings, ...raw.shop.listings] } }))).toThrow();
  });

  it('rejects inconsistent prices, expiry and carrier records without changing the raw save', () => {
    const world = createWorld(NOW);
    const invalid = (edit: (entry: Listing) => void) => {
      const candidate = structuredClone(world);
      edit(candidate.shop.listings[0]);
      const raw = JSON.stringify(candidate);
      expect(() => decodeSave(raw)).toThrow();
      expect(JSON.stringify(candidate)).toBe(raw);
    };
    invalid(entry => { entry.price = 1; });
    invalid(entry => { entry.expiresDay = 0; });
    invalid(entry => { entry.id = 'LS-000000'; });
    invalid(entry => { entry.category = 'carrier'; entry.price = LISTING_PRICES.carrier; entry.carries = null; });
    invalid(entry => { entry.category = 'carrier'; entry.price = LISTING_PRICES.carrier; entry.carries = { locus: 'base_color', allele: 5 }; entry.genome.maternal[48] = 0; entry.genome.paternal[48] = 0; });
  });
});
