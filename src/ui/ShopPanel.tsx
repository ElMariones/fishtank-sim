import { useMemo, useState } from 'react';
import { expressAxolotl } from '../core/axolotlGenetics';
import { AXOLOTL_LISTING_LABELS, AXOLOTL_SHOP_SIZE, previewAxolotl } from '../core/axolotlShop';
import { reservedPlaces } from '../core/breeding';
import { bestOffer, type TraitCache } from '../core/economy';
import { metabolicPotential } from '../core/genetics';
import { LISTING_LABELS, previewFish, SHOP_LISTING_DAYS, SHOP_REFRESH_DAYS, SHOP_SIZE } from '../core/shop';
import type { AxolotlListing, Fish, Listing, Species, Tank, World } from '../core/types';
import { MAX_LIVING, MAX_RECORDS } from '../core/world';
import { SexMark } from './Controls';
import { FishPortrait } from './FishPortrait';

type Props = {
  world: World; tank: Tank; day: number; readOnly: boolean; traitCache: TraitCache;
  onBuy: (listing: Listing, tankId: string) => void; onClose: () => void;
  onBuyAxolotl: (listing: AxolotlListing, tankId: string) => void;
  /** Opens the FS-504 recovery options when credits cannot cover any listing. */
  onRecovery: () => void;
};
type Sort = 'price' | 'size' | 'leaving';
/** One row, whichever counter it comes from: the listing, the animal it would become and what the row shows about it. */
type Specimen = {
  species: Species; listing: Listing | AxolotlListing; fish: Fish; size: number; kind: string; category: string; details: string[];
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
const title = (value: string) => value.replace(/^./, c => c.toUpperCase());

function axolotlDetails(listing: AxolotlListing): string[] {
  const p = expressAxolotl(listing.genome), m = p.morphology;
  const pattern = p.pattern.modes[0] === 'plain' ? 'plain skin' : `${p.pattern.modes.join(' + ')} pattern`;
  return [
    `${m.gills.branchCount} gill branches · ${pattern} · ${p.pigmentation.texture} skin`,
    `Activity ${Math.round(p.activity * 100)} · boldness ${Math.round(p.bold * 100)} · sociability ${Math.round(p.social * 100)}`,
  ];
}

/**
 * FS-502 NPC shop with a koi counter and, from world v14, an axolotl counter. Both hold fixed listings that change only
 * on delivery days, share the filters and deliver with the same capacity checks.
 */
export function ShopPanel({ world, tank, day, readOnly, traitCache, onBuy, onBuyAxolotl, onClose, onRecovery }: Props) {
  const [species, setSpecies] = useState<Species>('koi');
  const [sex, setSex] = useState<'all' | 'F' | 'M'>('all');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState<Sort>('price');
  const [destinationId, setDestinationId] = useState(tank.id);
  const destination = world.tanks.find(t => t.id === destinationId) ?? tank;
  // One scan of the permanent archive, rather than one per destination and listing.
  const occupancy = useMemo(() => {
    const byTank = new Map<string, number>();
    let living = 0;
    for (const fish of world.fish) if (fish.status === 'living') {
      living++; byTank.set(fish.tankId, (byTank.get(fish.tankId) ?? 0) + 1);
    }
    return { byTank, living };
  }, [world.fish]);
  const free = (candidate: Tank) => candidate.capacity - (occupancy.byTank.get(candidate.id) ?? 0) - reservedPlaces(world, candidate.id);
  const reserved = reservedPlaces(world);
  const koi = useMemo<Specimen[]>(() => world.shop.listings.map(listing => ({
    species: 'koi', listing, fish: previewFish(listing), size: metabolicPotential(listing.genome).adultLengthCm,
    kind: LISTING_LABELS[listing.category], category: listing.category, details: [],
  })), [world.shop.listings]);
  const axolotls = useMemo<Specimen[]>(() => world.axolotlShop.listings.map(listing => ({
    species: 'axolotl', listing, fish: previewAxolotl(listing), size: expressAxolotl(listing.genome).adultLengthCm,
    kind: AXOLOTL_LISTING_LABELS[listing.category], category: listing.category, details: axolotlDetails(listing),
  })), [world.axolotlShop.listings]);
  const counter = species === 'koi'
    ? { specimens: koi, size: SHOP_SIZE, refreshed: world.shop.refreshedDay, labels: LISTING_LABELS as Record<string, string> }
    : { specimens: axolotls, size: AXOLOTL_SHOP_SIZE, refreshed: world.axolotlShop.refreshedDay, labels: AXOLOTL_LISTING_LABELS as Record<string, string> };
  const nextDelivery = Math.max(1, counter.refreshed + SHOP_REFRESH_DAYS - day);
  const rows = counter.specimens
    .filter(row => (sex === 'all' || row.listing.sex === sex) && (category === 'all' || row.category === category))
    .sort((a, b) => sort === 'price' ? a.listing.price - b.listing.price || a.listing.id.localeCompare(b.listing.id)
      : sort === 'size' ? b.size - a.size : a.listing.expiresDay - b.listing.expiresDay || a.listing.id.localeCompare(b.listing.id));
  const blocked = (listing: Listing | AxolotlListing) => readOnly ? 'This tab is read-only.'
    : world.credits < listing.price ? `Needs ◈ ${listing.price - world.credits} more.`
    : free(destination) < 1 ? `${destination.name} has no free place.`
    : occupancy.living + reserved >= MAX_LIVING ? 'The lab is at its living animal limit.'
    : world.fish.length + reserved >= MAX_RECORDS ? 'The permanent record limit is reached. Export this world before starting another.' : '';
  const allListings = [...world.shop.listings, ...world.axolotlShop.listings];
  const chooseSpecies = (next: Species) => { setSpecies(next); setCategory('all'); };
  const noun = species === 'koi' ? 'koi' : 'axolotl';

  return <section className="shop-panel" aria-labelledby="shop-title">
    <div className="market-heading">
      <div><div className="eyebrow">NPC SHOP</div><h2 id="shop-title">Unrelated stock</h2></div>
      <button className="quiet panel-close" onClick={onClose}>Close</button>
    </div>
    <div className="sex-filter species-filter shop-species" role="group" aria-label="Shop counter">
      {(['koi', 'axolotl'] as const).map(value => <button key={value} aria-pressed={species === value} onClick={() => chooseSpecies(value)}>
        {value === 'koi' ? 'Koi' : 'Axolotls'}<span className="filter-count">{value === 'koi' ? world.shop.listings.length : world.axolotlShop.listings.length}</span>
      </button>)}
    </div>
    <p className="help-copy">{species === 'koi'
      ? 'Choose unrelated founders, visible variants or documented carriers of a hidden variant. Stock stays the same when you reopen or reload.'
      : 'Axolotls carry their own 66-locus genome: wild-type founders, visible pigment morphs, and documented carriers of a hidden leucistic-like, albino-like or melanoid-like copy. They share aquariums with koi but breed only with axolotls.'}</p>
    <p className="help-copy">Empty places refill every {SHOP_REFRESH_DAYS} game days. Listings leave after {SHOP_LISTING_DAYS} game days. Buying to resell always loses credits.</p>
    <div className="shop-filters">
      <div className="sex-filter" role="group" aria-label="Show listings by sex">
        {(['all', 'F', 'M'] as const).map(value => <button key={value} aria-pressed={sex === value} onClick={() => setSex(value)}>{value === 'all' ? 'All' : <><SexMark sex={value} decorative />{value === 'F' ? 'Females' : 'Males'}</>}</button>)}
      </div>
      <label className="inline-select">Kind<select aria-label="Stock kind" value={category} onChange={event => setCategory(event.target.value)}>
        <option value="all">All kinds</option>{Object.entries(counter.labels).map(([key, text]) => <option key={key} value={key}>{text}</option>)}
      </select></label>
      <label className="inline-select">Sort<select aria-label="Stock sort" value={sort} onChange={event => setSort(event.target.value as Sort)}>
        <option value="price">Price, lowest first</option><option value="size">Adult length, largest first</option><option value="leaving">Leaving soonest</option>
      </select></label>
      <label className="inline-select shop-destination">Deliver to<select aria-label="Delivery aquarium" value={destination.id} onChange={event => setDestinationId(event.target.value)}>
        {world.tanks.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name} · {plural(Math.max(0, free(candidate)), 'free place')}</option>)}
      </select></label>
    </div>
    <p className="help-copy" role="status">{counter.specimens.length} of {counter.size} {noun} places listed · next delivery in {plural(nextDelivery, 'game day')} · you have ◈ {world.credits.toLocaleString('en')}.</p>
    {allListings.length && allListings.every(listing => listing.price > world.credits)
      ? <p className="help-copy">No listing is affordable today. <button className="link-button" onClick={onRecovery}>See what still costs nothing</button></p> : null}
    {rows.length ? <ul className="shop-listings">{rows.map(({ listing, fish, size, kind, details }) => {
      const resale = bestOffer(world, fish, traitCache)?.amount ?? 0;
      const reason = blocked(listing), left = listing.expiresDay - day;
      const purchase = () => species === 'koi' ? onBuy(listing as Listing, destination.id) : onBuyAxolotl(listing as AxolotlListing, destination.id);
      return <li className={`shop-listing ${species === 'axolotl' ? 'axolotl-listing' : ''}`} key={listing.id}>
        <FishPortrait fish={fish} view="adult" />
        <div>
          <strong>{listing.name}</strong> <SexMark sex={listing.sex} withLabel />
          <small>{kind} · {listing.id} · adult length potential {size.toFixed(0)} cm</small>
          <small>{title(listing.note)}.</small>
          {details.map(line => <small key={line}>{line}</small>)}
          <small>Leaves the shop {left <= 1 ? 'at the end of this game day' : `in ${plural(left, 'game day')}`} · resells today for at most ◈ {resale}</small>
        </div>
        <div className="shop-buy">
          <span>◈ {listing.price}</span>
          <button className="primary" aria-label={`Buy ${listing.name} (${listing.id}) for ${listing.price} credits, deliver to ${destination.name}`} disabled={Boolean(reason)} onClick={purchase}>Buy for {destination.name}</button>
          {reason ? <small>{reason}</small> : null}
        </div>
      </li>;
    })}</ul> : <p className="empty-copy">{counter.specimens.length ? 'No listing matches these filters.' : `Sold out until the next delivery in ${plural(nextDelivery, 'game day')}.`}</p>}
  </section>;
}
