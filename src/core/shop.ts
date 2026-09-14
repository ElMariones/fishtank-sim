import { appearanceAlleleLabel, appearanceFeatures, expressAppearance } from './appearance';
import { idleBreeding } from './breeding';
import { APPEARANCE_LOCI, GENOME_VERSION, LOCI, type AppearanceLocus } from './catalog';
import { adultLife } from './development';
import { founderGenome } from './genetics';
import { hash } from './random';
import type { Fish, Listing, ListingCategory, ShopState, World } from './types';

/**
 * NPC shop v1 (FS-502). Listings are specimens with stable IDs whose genome, sex and price are fixed when they arrive,
 * so opening the shop or reloading never rerolls stock. New listings arrive only at game-day boundaries, at most every
 * SHOP_REFRESH_DAYS, to refill SHOP_SIZE places, and each leaves after SHOP_LISTING_DAYS unless bought. Everything
 * derives from the world seed and the listing number, so replay and every split of time agree.
 */
export const SHOP_MODEL = 1;
export const SHOP_SIZE = 6;
export const SHOP_REFRESH_DAYS = 3;
export const SHOP_LISTING_DAYS = 9;
/** The founder price equals the legacy stock price; every price is above the ◈ 150 founder resale limit. */
export const LISTING_PRICES: Record<ListingCategory, number> = { founder: 250, variant: 320, carrier: 360 };
export const LISTING_LABELS: Record<ListingCategory, string> = { founder: 'Unrelated founder', variant: 'Visible variant', carrier: 'Documented carrier' };
/** Classic-dominant or recessive loci, where a single variant copy stays hidden. */
export const CARRIER_LOCI = ['base_color', 'accent_color', 'iris_color', 'scale_type'] as const satisfies readonly AppearanceLocus[];
const CARRIER_TRAITS: Record<typeof CARRIER_LOCI[number], string> = { base_color: 'body color', accent_color: 'accent color', iris_color: 'eye color', scale_type: 'scale' };
const NAMES = ['Aki', 'Ren', 'Mizu', 'Sora', 'Hoshi', 'Kiku', 'Nami', 'Tora', 'Yume', 'Kaze', 'Hana', 'Riku', 'Tama', 'Umi', 'Kin', 'Suzu'];
/** A founder shows a new feature about one time in four, so this many seeds practically always finds one. */
const VARIANT_ATTEMPTS = 200;

export const listingId = (n: number) => `LS-${n.toString().padStart(6, '0')}`;

export function makeListing(seed: number, n: number, day: number): Listing {
  const key = `${seed}:shop:${n}`, roll = hash(`${key}:category`) % 100;
  let category: ListingCategory = roll < 50 ? 'founder' : roll < 83 ? 'variant' : 'carrier';
  let birthSeed = hash(`${key}:0`), genome = founderGenome(birthSeed, GENOME_VERSION), note = 'Unrelated founder stock';
  let carries: Listing['carries'] = null;
  if (category === 'variant') {
    let features: string[] = [];
    for (let attempt = 0; attempt < VARIANT_ATTEMPTS && !features.length; attempt++) {
      birthSeed = hash(`${key}:${attempt}`);
      genome = founderGenome(birthSeed, GENOME_VERSION);
      features = appearanceFeatures(expressAppearance(genome));
    }
    if (features.length) note = `Shows ${features.join(', ')}`;
    else category = 'founder';
  } else if (category === 'carrier') {
    const locus = CARRIER_LOCI[hash(`${key}:locus`) % CARRIER_LOCI.length], allele = 1 + hash(`${key}:allele`) % 5;
    const offset = LOCI.length + APPEARANCE_LOCI.indexOf(locus);
    genome = { ...genome, maternal: [...genome.maternal], paternal: [...genome.paternal] };
    genome.maternal[offset] = allele;
    genome.paternal[offset] = 0;
    carries = { locus, allele };
    note = `Carries one hidden ${appearanceAlleleLabel(locus, allele)} ${CARRIER_TRAITS[locus]} copy`;
  }
  return {
    id: listingId(n), category, name: NAMES[hash(`${key}:name`) % NAMES.length], sex: hash(`${key}:sex`) % 2 === 0 ? 'F' : 'M',
    genome, birthSeed, price: LISTING_PRICES[category], expiresDay: day + SHOP_LISTING_DAYS, note, carries,
  };
}

export const initialShop = (seed: number, day = 0): ShopState => ({
  model: 1, nextListing: SHOP_SIZE + 1, refreshedDay: day, listings: Array.from({ length: SHOP_SIZE }, (_, i) => makeListing(seed, i + 1, day)),
});

/** One game-day boundary: expired listings leave, and on delivery days new listings refill the empty places. */
export function refreshShop(world: World, day: number): World {
  const { shop } = world, kept = shop.listings.filter(listing => listing.expiresDay > day), due = day - shop.refreshedDay >= SHOP_REFRESH_DAYS;
  if (!due && kept.length === shop.listings.length) return world;
  const listings = [...kept];
  let nextListing = shop.nextListing;
  if (due) while (listings.length < SHOP_SIZE) listings.push(makeListing(world.seed, nextListing++, day));
  return { ...world, shop: { ...shop, nextListing, refreshedDay: due ? day : shop.refreshedDay, listings } };
}

/** The fish a listing would become, for portraits and resale offers. Its ID is the listing ID. */
export function previewFish(listing: Listing): Fish {
  return {
    id: listing.id, name: listing.name, sex: listing.sex, genome: listing.genome, birthSeed: listing.birthSeed, generation: 0, parents: null,
    bornAt: '2026-01-01T00:00:00.000Z', tankId: '', status: 'living', mutations: [], life: adultLife(listing.genome), breeding: idleBreeding(),
  };
}
