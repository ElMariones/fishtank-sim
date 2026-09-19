import { AXOLOTL_LOCUS_INDEX } from './axolotlCatalog';
import { AXOLOTL_MORPH_LABELS, AXOLOTL_MORPH_RARITY, axolotlFounderGenome, expressAxolotl, type AxolotlGenome, type AxolotlPigmentMorph } from './axolotlGenetics';
import { idleBreeding } from './breeding';
import { adultLife } from './development';
import { newFishName, takenNames } from './names';
import { hash } from './random';
import { SHOP_LISTING_DAYS, SHOP_REFRESH_DAYS } from './shop';
import type { AxolotlListing, AxolotlListingCategory, AxolotlShopState, AxolotlSwitch, Fish, World } from './types';

/**
 * Axolotl shop v1 (world v14). A separate, smaller counter beside the koi shop with the same rules: listed specimens keep
 * their genome, sex, name and price from arrival until bought or gone, new stock arrives only at game-day boundaries on
 * the koi delivery rhythm, and everything derives from the world seed and the listing number. Its own seed namespace
 * means adding it never changes a koi listing.
 */
export const AXOLOTL_SHOP_MODEL = 1;
export const AXOLOTL_SHOP_SIZE = 4;
export const AXOLOTL_SWITCHES = ['axo_leucistic_switch', 'axo_albinism_switch', 'axo_melanoid_switch'] as const satisfies readonly AxolotlSwitch[];
const SWITCH_MORPH: Record<AxolotlSwitch, AxolotlPigmentMorph> = {
  axo_leucistic_switch: 'leucistic-like', axo_albinism_switch: 'albino-like', axo_melanoid_switch: 'melanoid-like',
};
export const AXOLOTL_LISTING_LABELS: Record<AxolotlListingCategory, string> = { founder: 'Unrelated founder', morph: 'Pigment morph', carrier: 'Documented carrier' };
/**
 * Founders cost the stock price; a morph costs more the rarer it is; a carrier sits between. Every price stays above the
 * ◈ 150 founder resale limit, so buying to resell always loses credits.
 */
export const AXOLOTL_FOUNDER_PRICE = 250;
export const AXOLOTL_CARRIER_PRICE = 340;
export const AXOLOTL_MORPH_PRICES: Record<1 | 2 | 3, number> = { 1: 300, 2: 360, 3: 440 };
/** Seeds tried when looking for a color morph that founder stock shows by chance. */
const MORPH_ATTEMPTS = 120;

export const axolotlListingId = (n: number) => `AX-${n.toString().padStart(6, '0')}`;

/** The price a listing of this category and genome must carry. Save validation checks it, so a price cannot be edited. */
export function axolotlListingPrice(category: AxolotlListingCategory, genome: AxolotlGenome): number {
  if (category === 'founder') return AXOLOTL_FOUNDER_PRICE;
  if (category === 'carrier') return AXOLOTL_CARRIER_PRICE;
  const rarity = AXOLOTL_MORPH_RARITY[expressAxolotl(genome).pigmentation.morph];
  if (!rarity) throw new Error('A morph listing must show a morph.');
  return AXOLOTL_MORPH_PRICES[rarity];
}

const withAlleles = (genome: AxolotlGenome, locus: AxolotlSwitch, maternal: number, paternal: number): AxolotlGenome => {
  const index = AXOLOTL_LOCUS_INDEX[locus], next = { ...genome, maternal: [...genome.maternal], paternal: [...genome.paternal] };
  next.maternal[index] = maternal; next.paternal[index] = paternal;
  return next;
};

/** `taken` holds names already in use; the listing's generated name is added to it. */
export function makeAxolotlListing(seed: number, n: number, day: number, taken = new Set<string>()): AxolotlListing {
  const key = `${seed}:axolotl-shop:${n}`, roll = hash(`${key}:category`) % 100;
  let category: AxolotlListingCategory = roll < 45 ? 'founder' : roll < 80 ? 'morph' : 'carrier';
  let birthSeed = hash(`${key}:0`), genome = axolotlFounderGenome(birthSeed), carries: AxolotlListing['carries'] = null;
  const severe = () => 4 + hash(`${key}:severity`) % 2;
  if (category === 'morph') {
    // Half of morph listings are a recessive morph bred to show; the rest are color morphs found in founder stock.
    const target = hash(`${key}:morph`) % 6;
    if (target < 3) {
      const locus = AXOLOTL_SWITCHES[target];
      genome = withAlleles(genome, locus, severe(), severe());
      // Albino-like overrides the other pathways; clear it so the listed morph is the one shown.
      if (locus !== 'axo_albinism_switch') genome = withAlleles(genome, 'axo_albinism_switch', 0, 0);
      if (locus === 'axo_melanoid_switch') genome = withAlleles(genome, 'axo_leucistic_switch', 0, 0);
    } else {
      let found = false;
      for (let attempt = 0; attempt < MORPH_ATTEMPTS && !found; attempt++) {
        birthSeed = hash(`${key}:${attempt}`);
        genome = axolotlFounderGenome(birthSeed);
        found = AXOLOTL_MORPH_RARITY[expressAxolotl(genome).pigmentation.morph] > 0;
      }
      if (!found) category = 'founder';
    }
  } else if (category === 'carrier') {
    const locus = AXOLOTL_SWITCHES[hash(`${key}:locus`) % AXOLOTL_SWITCHES.length];
    genome = withAlleles(genome, locus, severe(), 0);
    carries = { locus, allele: genome.maternal[AXOLOTL_LOCUS_INDEX[locus]] };
  }
  const morph = expressAxolotl(genome).pigmentation.morph;
  const note = category === 'carrier' && carries
    ? `${AXOLOTL_MORPH_LABELS[morph]} look · carries one hidden ${SWITCH_MORPH[carries.locus]} copy`
    : category === 'morph' ? `Shows the ${AXOLOTL_MORPH_LABELS[morph].toLowerCase()} morph`
      : morph === 'wild' ? 'Unrelated wild-type founder' : `Unrelated founder with a ${AXOLOTL_MORPH_LABELS[morph].toLowerCase()} look`;
  const sex: Fish['sex'] = hash(`${key}:sex`) % 2 === 0 ? 'F' : 'M';
  return {
    id: axolotlListingId(n), category, name: newFishName(key, { sex, genome }, taken), sex, genome, birthSeed,
    price: axolotlListingPrice(category, genome), expiresDay: day + SHOP_LISTING_DAYS, note, carries,
  };
}

export function initialAxolotlShop(seed: number, day = 0): AxolotlShopState {
  const taken = new Set<string>();
  return {
    model: AXOLOTL_SHOP_MODEL, nextListing: AXOLOTL_SHOP_SIZE + 1, refreshedDay: day,
    listings: Array.from({ length: AXOLOTL_SHOP_SIZE }, (_, i) => makeAxolotlListing(seed, i + 1, day, taken)),
  };
}

/** One game-day boundary: expired axolotls leave, and on delivery days new ones refill the empty places. */
export function refreshAxolotlShop(world: World, day: number): World {
  const shop = world.axolotlShop, kept = shop.listings.filter(listing => listing.expiresDay > day), due = day - shop.refreshedDay >= SHOP_REFRESH_DAYS;
  if (!due && kept.length === shop.listings.length) return world;
  const listings = [...kept];
  let nextListing = shop.nextListing;
  if (due && listings.length < AXOLOTL_SHOP_SIZE) {
    const taken = takenNames(world);
    while (listings.length < AXOLOTL_SHOP_SIZE) listings.push(makeAxolotlListing(world.seed, nextListing++, day, taken));
  }
  return { ...world, axolotlShop: { ...shop, nextListing, refreshedDay: due ? day : shop.refreshedDay, listings } };
}

/** Why a stored listing is inconsistent, or null. Prices, notes of hidden copies and categories must match the genome. */
export function axolotlListingProblem(listing: AxolotlListing): string | null {
  const morph = expressAxolotl(listing.genome).pigmentation.morph;
  if (listing.category === 'morph' && !AXOLOTL_MORPH_RARITY[morph]) return 'An axolotl morph listing shows no morph.';
  if (listing.price !== axolotlListingPrice(listing.category, listing.genome)) return 'An axolotl listing price does not match its stock.';
  if (listing.category === 'carrier') {
    if (!listing.carries) return 'An axolotl carrier listing names no hidden copy.';
    const index = AXOLOTL_LOCUS_INDEX[listing.carries.locus], pair = [listing.genome.maternal[index], listing.genome.paternal[index]];
    if (!pair.includes(listing.carries.allele) || pair.filter(allele => allele >= 4).length !== 1) return 'An axolotl carrier does not match its genome.';
  } else if (listing.carries !== null) return 'Only carrier listings may document a hidden copy.';
  return null;
}

/** The animal a listing would become, for portraits and resale offers. Its ID is the listing ID. */
export function previewAxolotl(listing: AxolotlListing): Fish {
  return {
    id: listing.id, name: listing.name, sex: listing.sex, species: 'axolotl', genome: listing.genome, birthSeed: listing.birthSeed, generation: 0, parents: null,
    bornAt: '2026-01-01T00:00:00.000Z', tankId: '', status: 'living', mutations: [], life: adultLife(listing.genome), breeding: idleBreeding(), origins: [],
  };
}
