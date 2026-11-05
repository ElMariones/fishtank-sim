import { GUPPY_LOCUS_INDEX, GUPPY_RECESSIVES, GUPPY_VARIANT_FROM, type GuppyLocus, type GuppyRecessive } from './guppyCatalog';
import { expressGuppy, guppyFounderGenome, guppySex, type GuppyGenome, type GuppySex, type GuppyStrain } from './guppyGenetics';
import { idleBreeding } from './breeding';
import { adultLife } from './development';
import { newFishName, takenNames } from './names';
import { hash } from './random';
import { SHOP_LISTING_DAYS, SHOP_REFRESH_DAYS } from './shop';
import type { Fish, GuppyListing, GuppyListingCategory, GuppyShopState, World } from './types';

/**
 * Guppy shop v1 (world v20): a fourth counter on the koi delivery rhythm. Listings keep their genome, sex, name and price
 * from arrival until bought or gone. Everything derives from the world seed and the listing number in the `guppy-shop`
 * namespace, so adding it never changes a koi, axolotl or goldfish listing.
 *
 * Mixed domestic founders of either sex, males bred to a named strain, and documented carriers of one hidden recessive.
 * A listing's sex always agrees with its genome: a male carries his Y on the paternal homolog.
 */
export const GUPPY_SHOP_MODEL = 1;
export const GUPPY_SHOP_SIZE = 5;
export const GUPPY_LISTING_LABELS: Record<GuppyListingCategory, string> = { founder: 'Domestic founder', strain: 'Strain male', carrier: 'Documented carrier' };
/** Every price stays above the ◈ 150 founder resale cap, so buying to resell always loses credits. */
export const GUPPY_FOUNDER_PRICE = 170;
export const GUPPY_CARRIER_PRICE = 250;
export const GUPPY_STRAIN_PRICES: Record<1 | 2 | 3, number> = { 1: 220, 2: 300, 3: 400 };
export const GUPPY_CARRIER_LOCI = Object.keys(GUPPY_RECESSIVES) as GuppyRecessive[];

type Template = Partial<Record<GuppyLocus, [number, number]>>;
/**
 * A clean show male: no fancy fins, no body-mark program, a plain tail, wild base and no Y color program. The paternal
 * copy of a sex-chromosome locus is the one on his Y.
 */
const CLEAN: Template = {
  gp_dumbo: [0, 0], gp_ribbon: [0, 0], gp_swallow: [0, 0], gp_blond: [0, 0], gp_golden: [0, 0], gp_albino: [0, 0], gp_blue: [0, 0],
  gp_half_black: [0, 0], gp_snakeskin: [0, 0], gp_metal_head: [0, 0], gp_asian_blau: [0, 0], gp_tail_pattern: [0, 0], gp_y_program: [0, 1],
  gp_canalization: [4, 4],
};
const BIG_TAIL: Template = { gp_tail_length: [5, 4], gp_tail_spread: [5, 5], gp_top_sword: [1, 1], gp_bottom_sword: [1, 1], gp_tail_rays: [4, 4] };
/** Breed standards the shop's breeders work to. Only the loci that make the strain are set; the rest stays a founder's. */
export const STRAIN_TEMPLATES: Partial<Record<GuppyStrain, Template>> = {
  'full-red': { ...BIG_TAIL, gp_red_spread: [5, 5], gp_xanthophore: [5, 5], gp_diet_response: [5, 5], gp_red_tail: [5, 5], gp_melanophore: [1, 1] },
  'full-black': { ...BIG_TAIL, gp_melanophore: [5, 5], gp_black_edging: [5, 5], gp_xanthophore: [0, 0] },
  moscow: { ...BIG_TAIL, gp_y_program: [0, 3], gp_melanophore: [4, 4], gp_sheen: [5, 4] },
  tuxedo: { ...BIG_TAIL, gp_half_black: [4, 0], gp_red_spread: [4, 4] },
  snakeskin: { gp_snakeskin: [0, 4], gp_pattern_coverage: [5, 4], gp_pattern_symmetry: [4, 4], gp_tail_length: [3, 3], gp_tail_spread: [4, 3] },
  'king-cobra': { gp_snakeskin: [0, 5], gp_black_edging: [5, 5], gp_pattern_coverage: [5, 5], gp_tail_length: [3, 3], gp_tail_spread: [4, 3] },
  mosaic: { ...BIG_TAIL, gp_tail_pattern: [1, 1], gp_pattern_coverage: [5, 4], gp_pattern_edge: [4, 4] },
  grass: { ...BIG_TAIL, gp_tail_pattern: [2, 2], gp_pattern_scale: [0, 0], gp_pattern_coverage: [4, 4] },
  lace: { ...BIG_TAIL, gp_tail_pattern: [3, 3], gp_pattern_symmetry: [5, 4] },
  leopard: { ...BIG_TAIL, gp_tail_pattern: [4, 4], gp_black_edging: [4, 4] },
  tiger: { ...BIG_TAIL, gp_tail_pattern: [5, 5], gp_pattern_symmetry: [5, 5] },
  'metal-head': { ...BIG_TAIL, gp_metal_head: [4, 0], gp_sheen: [5, 5] },
  'japan-blue': { ...BIG_TAIL, gp_asian_blau: [4, 4], gp_red_spread: [0, 0], gp_red_tail: [0, 0], gp_sheen: [5, 5] },
  pingu: { gp_y_program: [0, 5], gp_red_spread: [4, 4], gp_sheen: [4, 4] },
  maculatus: { gp_y_program: [0, 2], gp_melanophore: [4, 4], gp_dorsal_length: [4, 4] },
  endler: { gp_adult_size: [0, 0], gp_body_length: [0, 0], gp_orange_spots: [5, 5], gp_tail_length: [0, 0], gp_tail_spread: [1, 1], gp_sheen: [4, 4] },
};
/** Breeders offer the commoner strains more often. */
const OFFERED: readonly [GuppyStrain, number][] = [
  ['mosaic', 5], ['grass', 4], ['tuxedo', 5], ['snakeskin', 4], ['full-red', 3], ['moscow', 3], ['leopard', 3], ['lace', 2], ['tiger', 2],
  ['metal-head', 2], ['japan-blue', 1], ['king-cobra', 1], ['full-black', 1], ['pingu', 2], ['maculatus', 2], ['endler', 3],
];
const OFFER_TOTAL = OFFERED.reduce((sum, [, weight]) => sum + weight, 0);

export const guppyListingId = (n: number) => `GP-${n.toString().padStart(6, '0')}`;

export function withGuppyAlleles(genome: GuppyGenome, template: Template): GuppyGenome {
  const next: GuppyGenome = { ...genome, maternal: [...genome.maternal], paternal: [...genome.paternal] };
  for (const [locus, [m, p]] of Object.entries(template) as [GuppyLocus, [number, number]][]) {
    const index = GUPPY_LOCUS_INDEX[locus];
    next.maternal[index] = m; next.paternal[index] = p;
  }
  return next;
}

/** The price a listing of this category and genome must carry. Save validation checks it, so a price cannot be edited. */
export function guppyListingPrice(category: GuppyListingCategory, genome: GuppyGenome): number {
  if (category === 'founder') return GUPPY_FOUNDER_PRICE;
  if (category === 'carrier') return GUPPY_CARRIER_PRICE;
  const rarity = expressGuppy(genome).strain.rarity;
  if (!rarity) throw new Error('A strain listing must show an uncommon strain.');
  return GUPPY_STRAIN_PRICES[rarity];
}

const pickStrain = (key: string): GuppyStrain => {
  let draw = hash(`${key}:strain`) % OFFER_TOTAL;
  for (const [strain, weight] of OFFERED) { if (draw < weight) return strain; draw -= weight; }
  return OFFERED[0][0];
};

/** `taken` holds names already in use; the listing's generated name is added to it. */
export function makeGuppyListing(seed: number, n: number, day: number, taken = new Set<string>()): GuppyListing {
  const key = `${seed}:guppy-shop:${n}`, roll = hash(`${key}:category`) % 100;
  let category: GuppyListingCategory = roll < 40 ? 'founder' : roll < 78 ? 'strain' : 'carrier';
  const birthSeed = hash(`${key}:0`);
  // Strain stock is male: the strain shows only on males. Founders and carriers come in either sex.
  let sex: GuppySex = category === 'strain' ? 'M' : hash(`${key}:sex`) % 2 === 0 ? 'F' : 'M';
  let genome = guppyFounderGenome(birthSeed, sex), carries: GuppyListing['carries'] = null;
  if (category === 'strain') {
    const target = pickStrain(key);
    genome = withGuppyAlleles(genome, { ...CLEAN, ...STRAIN_TEMPLATES[target] });
    // A template sets the loci that make the strain; a few founder backgrounds still land on a common one.
    if (!expressGuppy(genome).strain.rarity) category = 'founder';
  } else if (category === 'carrier') {
    const locus = GUPPY_CARRIER_LOCI[hash(`${key}:locus`) % GUPPY_CARRIER_LOCI.length];
    const allele = GUPPY_VARIANT_FROM + hash(`${key}:allele`) % 2;
    genome = withGuppyAlleles(genome, { [locus]: [allele, 0] });
    carries = { locus, allele };
  }
  sex = guppySex(genome);
  const p = expressGuppy(genome);
  const note = category === 'carrier' && carries ? `${p.strain.name} · carries one hidden ${GUPPY_RECESSIVES[carries.locus]} copy`
    : category === 'strain' ? `Bred to the ${p.strain.label} standard · ${p.strain.tailLabel.toLowerCase()}`
      : `Unrelated domestic founder · ${p.strain.name.toLowerCase()}`;
  return {
    id: guppyListingId(n), category, name: newFishName(key, { sex, genome }, taken), sex, genome, birthSeed,
    price: guppyListingPrice(category, genome), expiresDay: day + SHOP_LISTING_DAYS, note, carries,
  };
}

export function initialGuppyShop(seed: number, day = 0): GuppyShopState {
  const taken = new Set<string>();
  return { model: GUPPY_SHOP_MODEL, nextListing: GUPPY_SHOP_SIZE + 1, refreshedDay: day,
    listings: Array.from({ length: GUPPY_SHOP_SIZE }, (_, i) => makeGuppyListing(seed, i + 1, day, taken)) };
}

/** A show-bred guppy for NPC exhibitors: a male bred to a strain chosen by the seed, or a founder female. */
export function guppyShowGenome(seed: number, sex: GuppySex): GuppyGenome {
  const founder = guppyFounderGenome(seed, sex);
  return sex === 'F' ? founder : withGuppyAlleles(founder, { ...CLEAN, ...STRAIN_TEMPLATES[pickStrain(`${seed}:show`)] });
}

/** One game-day boundary: expired guppies leave, and on delivery days new ones refill the empty places. */
export function refreshGuppyShop(world: World, day: number): World {
  const shop = world.guppyShop;
  if (!shop) return world;
  const kept = shop.listings.filter(listing => listing.expiresDay > day), due = day - shop.refreshedDay >= SHOP_REFRESH_DAYS;
  if (!due && kept.length === shop.listings.length) return world;
  const listings = [...kept];
  let nextListing = shop.nextListing;
  if (due && listings.length < GUPPY_SHOP_SIZE) {
    const taken = takenNames(world);
    while (listings.length < GUPPY_SHOP_SIZE) listings.push(makeGuppyListing(world.seed, nextListing++, day, taken));
  }
  return { ...world, guppyShop: { ...shop, nextListing, refreshedDay: due ? day : shop.refreshedDay, listings } };
}

/** Why a stored listing is inconsistent, or null. Prices, sex, documented copies and categories must match the genome. */
export function guppyListingProblem(listing: GuppyListing): string | null {
  const p = expressGuppy(listing.genome);
  if (listing.sex !== guppySex(listing.genome)) return 'A guppy listing sex does not match its genome.';
  if (listing.category === 'strain' && !p.strain.rarity) return 'A guppy strain listing shows no uncommon strain.';
  if (listing.price !== guppyListingPrice(listing.category, listing.genome)) return 'A guppy listing price does not match its stock.';
  if (listing.category === 'carrier') {
    if (!listing.carries) return 'A guppy carrier listing names no hidden copy.';
    const index = GUPPY_LOCUS_INDEX[listing.carries.locus], pair = [listing.genome.maternal[index], listing.genome.paternal[index]];
    if (!pair.includes(listing.carries.allele) || listing.carries.allele < GUPPY_VARIANT_FROM || pair.filter(allele => allele >= GUPPY_VARIANT_FROM).length !== 1) return 'A guppy carrier does not match its genome.';
  } else if (listing.carries !== null) return 'Only carrier listings may document a hidden copy.';
  return null;
}

/** The animal a listing would become, for portraits and resale offers. Its ID is the listing ID. */
export function previewGuppy(listing: GuppyListing): Fish {
  return {
    id: listing.id, name: listing.name, sex: listing.sex, species: 'guppy', genome: listing.genome, birthSeed: listing.birthSeed, generation: 0, parents: null,
    bornAt: '2026-01-01T00:00:00.000Z', tankId: '', status: 'living', mutations: [], life: adultLife(listing.genome), breeding: idleBreeding(), origins: [],
  };
}
