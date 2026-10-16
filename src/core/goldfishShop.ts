import { EYE_VARIANT_FROM, GOLDFISH_LOCUS_INDEX, GOLDFISH_RECESSIVES, GOLDFISH_VARIANT_FROM, type GoldfishLocus, type GoldfishRecessive } from './goldfishCatalog';
import { expressGoldfish, goldfishFounderGenome, type GoldfishGenome, type GoldfishVariety } from './goldfishGenetics';
import { idleBreeding } from './breeding';
import { adultLife } from './development';
import { newFishName, takenNames } from './names';
import { hash } from './random';
import { SHOP_LISTING_DAYS, SHOP_REFRESH_DAYS } from './shop';
import type { Fish, GoldfishListing, GoldfishListingCategory, GoldfishShopState, World } from './types';

/**
 * Goldfish shop v1 (world v17): a third counter on the koi delivery rhythm. Listings keep their genome, sex, name and
 * price from arrival until bought or gone, and everything derives from the world seed and the listing number in the
 * `goldfish-shop` namespace, so adding it never changes a koi or axolotl listing.
 *
 * Mixed domestic founders, fish bred to a named fancy variety, and documented carriers of one hidden recessive.
 */
export const GOLDFISH_SHOP_MODEL = 1;
export const GOLDFISH_SHOP_SIZE = 5;
export const GOLDFISH_LISTING_LABELS: Record<GoldfishListingCategory, string> = { founder: 'Domestic founder', variety: 'Fancy variety', carrier: 'Documented carrier' };
/** Every price stays above the ◈ 150 founder resale cap, so buying to resell always loses credits. */
export const GOLDFISH_FOUNDER_PRICE = 220;
export const GOLDFISH_CARRIER_PRICE = 320;
export const GOLDFISH_VARIETY_PRICES: Record<1 | 2 | 3, number> = { 1: 290, 2: 380, 3: 490 };
export const GOLDFISH_CARRIER_LOCI = Object.keys(GOLDFISH_RECESSIVES) as GoldfishRecessive[];

type Template = Partial<Record<GoldfishLocus, [number, number]>>;
/** A clean fancy base: no eye, bubble, pompon, pearl or hood program, a full dorsal, and a fish that colors up. */
const CLEAN: Template = {
  gf_eye_program: [0, 0], gf_bubble_program: [0, 0], gf_pompon: [0, 0], gf_pearlscale: [1, 1], gf_hood_a: [1, 1], gf_hood_b: [1, 1],
  gf_dorsal_loss_a: [0, 0], gf_dorsal_loss_b: [0, 0], gf_color_break: [4, 4], gf_albino: [0, 0], gf_swim_bladder: [4, 4],
};
const TWIN: Template = { gf_twin_tail: [4, 4], gf_tail_split: [3, 3] };
const NO_DORSAL: Template = { gf_dorsal_loss_a: [5, 5], gf_dorsal_loss_b: [5, 5] };
const HOOD: Template = { gf_hood_a: [5, 5], gf_hood_b: [5, 5] };
/** Breed standards the shop's breeders work to. Only the loci that make the variety are set; the rest stays a founder's. */
export const VARIETY_TEMPLATES: Partial<Record<GoldfishVariety, Template>> = {
  comet: { gf_twin_tail: [0, 0], gf_roundness: [0, 0], gf_body_depth: [1, 1], gf_body_length: [5, 5], gf_longfin: [4, 0], gf_tail_fork: [5, 5], gf_back_arch: [1, 1] },
  shubunkin: { gf_twin_tail: [0, 0], gf_roundness: [0, 0], gf_body_depth: [1, 1], gf_body_length: [4, 4], gf_transparency: [4, 0], gf_pattern_mode: [4, 4], gf_back_arch: [1, 1] },
  ryukin: { ...TWIN, gf_back_arch: [5, 5], gf_roundness: [3, 3], gf_body_depth: [5, 5], gf_longfin: [0, 0], gf_tail_fork: [3, 3] },
  veiltail: { ...TWIN, gf_longfin: [4, 4], gf_tail_fork: [0, 0], gf_roundness: [3, 3], gf_fin_rays: [4, 4] },
  oranda: { ...TWIN, ...HOOD, gf_hood_extent: [2, 2], gf_roundness: [3, 3] },
  lionhead: { ...TWIN, ...HOOD, ...NO_DORSAL, gf_hood_extent: [5, 5], gf_back_arch: [1, 1], gf_roundness: [4, 4] },
  ranchu: { ...TWIN, ...HOOD, ...NO_DORSAL, gf_hood_extent: [4, 4], gf_back_arch: [5, 5], gf_tail_carriage: [0, 0], gf_roundness: [4, 4] },
  eggfish: { ...TWIN, ...NO_DORSAL, gf_roundness: [5, 5] },
  telescope: { ...TWIN, gf_eye_program: [3, 4], gf_eye_protrusion: [4, 4], gf_tail_spread: [2, 2] },
  butterfly: { ...TWIN, gf_eye_program: [4, 4], gf_tail_spread: [5, 5], gf_eye_protrusion: [4, 4] },
  'black-moor': { ...TWIN, gf_eye_program: [3, 3], gf_tail_spread: [2, 2], gf_melanophore: [5, 5], gf_black_persistence: [5, 5], gf_break_completeness: [0, 0], gf_blue: [0, 0], gf_chocolate: [0, 0], gf_lavender: [0, 0], gf_transparency: [4, 4], gf_pattern_mode: [0, 0] },
  celestial: { ...TWIN, ...NO_DORSAL, gf_eye_program: [5, 5], gf_eye_protrusion: [4, 4] },
  'bubble-eye': { ...TWIN, ...NO_DORSAL, gf_bubble_program: [4, 5], gf_bubble_size: [5, 5] },
  pearlscale: { ...TWIN, gf_pearlscale: [5, 5], gf_roundness: [5, 5], gf_body_depth: [4, 4] },
  pompon: { ...TWIN, gf_pompon: [4, 0], gf_pompon_size: [4, 4] },
  tosakin: { ...TWIN, gf_tail_spread: [5, 5], gf_tail_carriage: [5, 5], gf_tail_split: [4, 4], gf_longfin: [4, 0], gf_roundness: [3, 3] },
};
/** Breeders offer the commoner varieties more often. */
const OFFERED: readonly [GoldfishVariety, number][] = [
  ['comet', 4], ['shubunkin', 4], ['ryukin', 5], ['oranda', 5], ['veiltail', 3], ['telescope', 4], ['black-moor', 3], ['lionhead', 3], ['ranchu', 3],
  ['eggfish', 2], ['pearlscale', 3], ['pompon', 2], ['celestial', 1], ['bubble-eye', 1], ['butterfly', 2], ['tosakin', 1],
];
const OFFER_TOTAL = OFFERED.reduce((sum, [, weight]) => sum + weight, 0);

export const goldfishListingId = (n: number) => `GF-${n.toString().padStart(6, '0')}`;

export function withGoldfishAlleles(genome: GoldfishGenome, template: Template): GoldfishGenome {
  const next: GoldfishGenome = { ...genome, maternal: [...genome.maternal], paternal: [...genome.paternal] };
  for (const [locus, [m, p]] of Object.entries(template) as [GoldfishLocus, [number, number]][]) {
    const index = GOLDFISH_LOCUS_INDEX[locus];
    next.maternal[index] = m; next.paternal[index] = p;
  }
  return next;
}

/** The price a listing of this category and genome must carry. Save validation checks it, so a price cannot be edited. */
export function goldfishListingPrice(category: GoldfishListingCategory, genome: GoldfishGenome): number {
  if (category === 'founder') return GOLDFISH_FOUNDER_PRICE;
  if (category === 'carrier') return GOLDFISH_CARRIER_PRICE;
  const rarity = expressGoldfish(genome).variety.rarity;
  if (!rarity) throw new Error('A variety listing must show an uncommon variety.');
  return GOLDFISH_VARIETY_PRICES[rarity];
}

const variantFrom = (locus: GoldfishRecessive) => locus === 'gf_eye_program' ? EYE_VARIANT_FROM : GOLDFISH_VARIANT_FROM;

/** `taken` holds names already in use; the listing's generated name is added to it. */
export function makeGoldfishListing(seed: number, n: number, day: number, taken = new Set<string>()): GoldfishListing {
  const key = `${seed}:goldfish-shop:${n}`, roll = hash(`${key}:category`) % 100;
  let category: GoldfishListingCategory = roll < 35 ? 'founder' : roll < 78 ? 'variety' : 'carrier';
  const birthSeed = hash(`${key}:0`);
  let genome = goldfishFounderGenome(birthSeed), carries: GoldfishListing['carries'] = null;
  if (category === 'variety') {
    let draw = hash(`${key}:variety`) % OFFER_TOTAL, target: GoldfishVariety = OFFERED[0][0];
    for (const [variety, weight] of OFFERED) { if (draw < weight) { target = variety; break; } draw -= weight; }
    genome = withGoldfishAlleles(genome, { ...CLEAN, ...VARIETY_TEMPLATES[target] });
    // A template sets the loci that make the variety; a few founder backgrounds still land on a common variety.
    if (!expressGoldfish(genome).variety.rarity) category = 'founder';
  } else if (category === 'carrier') {
    const locus = GOLDFISH_CARRIER_LOCI[hash(`${key}:locus`) % GOLDFISH_CARRIER_LOCI.length];
    const allele = locus === 'gf_eye_program' ? [3, 4, 5][hash(`${key}:allele`) % 3] : 4 + hash(`${key}:allele`) % 2;
    genome = withGoldfishAlleles(genome, { [locus]: [allele, 0] });
    carries = { locus, allele };
  }
  const p = expressGoldfish(genome);
  const note = category === 'carrier' && carries ? `${p.variety.name} look · carries one hidden ${GOLDFISH_RECESSIVES[carries.locus]} copy`
    : category === 'variety' ? `Bred to the ${p.variety.label.toLowerCase()} standard · ${p.variety.color.toLowerCase()}`
      : `Unrelated domestic founder · ${p.variety.name.toLowerCase()}`;
  const sex: Fish['sex'] = hash(`${key}:sex`) % 2 === 0 ? 'F' : 'M';
  return {
    id: goldfishListingId(n), category, name: newFishName(key, { sex, genome }, taken), sex, genome, birthSeed,
    price: goldfishListingPrice(category, genome), expiresDay: day + SHOP_LISTING_DAYS, note, carries,
  };
}

export function initialGoldfishShop(seed: number, day = 0): GoldfishShopState {
  const taken = new Set<string>();
  return { model: GOLDFISH_SHOP_MODEL, nextListing: GOLDFISH_SHOP_SIZE + 1, refreshedDay: day,
    listings: Array.from({ length: GOLDFISH_SHOP_SIZE }, (_, i) => makeGoldfishListing(seed, i + 1, day, taken)) };
}

/** A show-bred goldfish for NPC exhibitors: a founder bred to a variety chosen by the seed. */
export function goldfishShowGenome(seed: number): GoldfishGenome {
  let draw = hash(`${seed}:show-variety`) % OFFER_TOTAL, target: GoldfishVariety = OFFERED[0][0];
  for (const [variety, weight] of OFFERED) { if (draw < weight) { target = variety; break; } draw -= weight; }
  return withGoldfishAlleles(goldfishFounderGenome(seed), { ...CLEAN, ...VARIETY_TEMPLATES[target] });
}

/** One game-day boundary: expired goldfish leave, and on delivery days new ones refill the empty places. */
export function refreshGoldfishShop(world: World, day: number): World {
  const shop = world.goldfishShop;
  if (!shop) return world;
  const kept = shop.listings.filter(listing => listing.expiresDay > day), due = day - shop.refreshedDay >= SHOP_REFRESH_DAYS;
  if (!due && kept.length === shop.listings.length) return world;
  const listings = [...kept];
  let nextListing = shop.nextListing;
  if (due && listings.length < GOLDFISH_SHOP_SIZE) {
    const taken = takenNames(world);
    while (listings.length < GOLDFISH_SHOP_SIZE) listings.push(makeGoldfishListing(world.seed, nextListing++, day, taken));
  }
  return { ...world, goldfishShop: { ...shop, nextListing, refreshedDay: due ? day : shop.refreshedDay, listings } };
}

/** Why a stored listing is inconsistent, or null. Prices, documented copies and categories must match the genome. */
export function goldfishListingProblem(listing: GoldfishListing): string | null {
  const rarity = expressGoldfish(listing.genome).variety.rarity;
  if (listing.category === 'variety' && !rarity) return 'A goldfish variety listing shows no uncommon variety.';
  if (listing.price !== goldfishListingPrice(listing.category, listing.genome)) return 'A goldfish listing price does not match its stock.';
  if (listing.category === 'carrier') {
    if (!listing.carries) return 'A goldfish carrier listing names no hidden copy.';
    const index = GOLDFISH_LOCUS_INDEX[listing.carries.locus], pair = [listing.genome.maternal[index], listing.genome.paternal[index]], from = variantFrom(listing.carries.locus);
    if (!pair.includes(listing.carries.allele) || listing.carries.allele < from || pair.filter(allele => allele >= from).length !== 1) return 'A goldfish carrier does not match its genome.';
  } else if (listing.carries !== null) return 'Only carrier listings may document a hidden copy.';
  return null;
}

/** The animal a listing would become, for portraits and resale offers. Its ID is the listing ID. */
export function previewGoldfish(listing: GoldfishListing): Fish {
  return {
    id: listing.id, name: listing.name, sex: listing.sex, species: 'goldfish', genome: listing.genome, birthSeed: listing.birthSeed, generation: 0, parents: null,
    bornAt: '2026-01-01T00:00:00.000Z', tankId: '', status: 'living', mutations: [], life: adultLife(listing.genome), breeding: idleBreeding(), origins: [],
  };
}
