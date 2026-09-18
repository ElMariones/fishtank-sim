import { useMemo, useState } from 'react';
import { reservedPlaces } from '../core/breeding';
import { bestOffer, type TraitCache } from '../core/economy';
import { metabolicPotential } from '../core/genetics';
import { LISTING_LABELS, previewFish, SHOP_LISTING_DAYS, SHOP_REFRESH_DAYS, SHOP_SIZE } from '../core/shop';
import type { Listing, ListingCategory, Tank, World } from '../core/types';
import { MAX_LIVING, MAX_RECORDS } from '../core/world';
import { STOCK_PRICE } from '../core/world';
import { SexMark } from './Controls';
import { FishPortrait } from './FishPortrait';

type Props = {
  world: World; tank: Tank; day: number; readOnly: boolean; traitCache: TraitCache;
  onBuy: (listing: Listing, tankId: string) => void; onClose: () => void;
  onBuyAxolotl: (tankId: string) => void;
  /** Opens the FS-504 recovery options when credits cannot cover any listing. */
  onRecovery: () => void;
};
type Sort = 'price' | 'size' | 'leaving';

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** FS-502 NPC shop: fixed listings that change only on delivery days, with filters and capacity-aware purchase. */
export function ShopPanel({ world, tank, day, readOnly, traitCache, onBuy, onBuyAxolotl, onClose, onRecovery }: Props) {
  const [sex, setSex] = useState<'all' | 'F' | 'M'>('all');
  const [category, setCategory] = useState<'all' | ListingCategory>('all');
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
  const specimens = useMemo(() => world.shop.listings.map(listing => ({ listing, fish: previewFish(listing), size: metabolicPotential(listing.genome).adultLengthCm })), [world.shop.listings]);
  const nextDelivery = Math.max(1, world.shop.refreshedDay + SHOP_REFRESH_DAYS - day);
  const rows = specimens
    .filter(({ listing }) => (sex === 'all' || listing.sex === sex) && (category === 'all' || listing.category === category))
    .sort((a, b) => sort === 'price' ? a.listing.price - b.listing.price || a.listing.id.localeCompare(b.listing.id)
      : sort === 'size' ? b.size - a.size : a.listing.expiresDay - b.listing.expiresDay || a.listing.id.localeCompare(b.listing.id));
  const blocked = (listing: Listing) => readOnly ? 'This tab is read-only.'
    : world.credits < listing.price ? `Needs ◈ ${listing.price - world.credits} more.`
    : free(destination) < 1 ? `${destination.name} has no free place.`
    : occupancy.living + reserved >= MAX_LIVING ? 'The lab is at its living fish limit.'
    : world.fish.length + reserved >= MAX_RECORDS ? 'The permanent record limit is reached. Export this world before starting another.' : '';
  const axolotlBlocked = readOnly ? 'This tab is read-only.' : world.credits < STOCK_PRICE ? `Needs ◈ ${STOCK_PRICE - world.credits} more.`
    : free(destination) < 1 ? `${destination.name} has no free place.` : occupancy.living + reserved >= MAX_LIVING ? 'The lab is at its living animal limit.'
      : world.fish.length + reserved >= MAX_RECORDS ? 'The permanent record limit is reached.' : '';

  return <section className="shop-panel" aria-labelledby="shop-title">
    <div className="market-heading">
      <div><div className="eyebrow">NPC SHOP</div><h2 id="shop-title">Unrelated stock</h2></div>
      <button className="quiet panel-close" onClick={onClose}>Close</button>
    </div>
    <p className="help-copy">Choose unrelated founders, visible variants or documented carriers of a hidden variant. Stock stays the same when you reopen or reload.</p>
    <div className="shop-listing axolotl-stock">
      <div className="shop-species-mark" aria-hidden="true">AX</div>
      <div><strong>Independent axolotl founder</strong><small>Ambystoma mexicanum · separate 66-locus genome · unrelated adult stock</small><small>Body, head, limbs, digits, tail, external gills, pigment morph, colors, patterns, life history and behavior are generated from the axolotl genome. It can share aquariums with koi, but breeds only with axolotls.</small></div>
      <div className="shop-buy"><span>◈ {STOCK_PRICE}</span><button className="primary" disabled={Boolean(axolotlBlocked)} onClick={() => onBuyAxolotl(destination.id)}>Buy axolotl</button>{axolotlBlocked ? <small>{axolotlBlocked}</small> : null}</div>
    </div>
    <p className="help-copy">Empty places refill every {SHOP_REFRESH_DAYS} game days. Listings leave after {SHOP_LISTING_DAYS} game days. Buying to resell always loses credits.</p>
    <div className="shop-filters">
      <div className="sex-filter" role="group" aria-label="Show listings by sex">
        {(['all', 'F', 'M'] as const).map(value => <button key={value} aria-pressed={sex === value} onClick={() => setSex(value)}>{value === 'all' ? 'All' : <><SexMark sex={value} decorative />{value === 'F' ? 'Females' : 'Males'}</>}</button>)}
      </div>
      <label className="inline-select">Kind<select aria-label="Stock kind" value={category} onChange={event => setCategory(event.target.value as 'all' | ListingCategory)}>
        <option value="all">All kinds</option>{(Object.keys(LISTING_LABELS) as ListingCategory[]).map(key => <option key={key} value={key}>{LISTING_LABELS[key]}</option>)}
      </select></label>
      <label className="inline-select">Sort<select aria-label="Stock sort" value={sort} onChange={event => setSort(event.target.value as Sort)}>
        <option value="price">Price, lowest first</option><option value="size">Adult length, largest first</option><option value="leaving">Leaving soonest</option>
      </select></label>
      <label className="inline-select shop-destination">Deliver to<select aria-label="Delivery aquarium" value={destination.id} onChange={event => setDestinationId(event.target.value)}>
        {world.tanks.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name} · {plural(Math.max(0, free(candidate)), 'free place')}</option>)}
      </select></label>
    </div>
    <p className="help-copy" role="status">{world.shop.listings.length} of {SHOP_SIZE} places listed · next delivery in {plural(nextDelivery, 'game day')} · you have ◈ {world.credits.toLocaleString('en')}.</p>
    {world.shop.listings.length && world.shop.listings.every(listing => listing.price > world.credits)
      ? <p className="help-copy">No listing is affordable today. <button className="link-button" onClick={onRecovery}>See what still costs nothing</button></p> : null}
    {rows.length ? <ul className="shop-listings">{rows.map(({ listing, fish, size }) => {
      const resale = bestOffer(world, fish, traitCache)?.amount ?? 0;
      const reason = blocked(listing), left = listing.expiresDay - day;
      return <li className="shop-listing" key={listing.id}>
        <FishPortrait fish={fish} view="adult" />
        <div>
          <strong>{listing.name}</strong> <SexMark sex={listing.sex} withLabel />
          <small>{LISTING_LABELS[listing.category]} · {listing.id} · adult length potential {size.toFixed(0)} cm</small>
          <small>{listing.note}.</small>
          <small>Leaves the shop {left <= 1 ? 'at the end of this game day' : `in ${plural(left, 'game day')}`} · resells today for at most ◈ {resale}</small>
        </div>
        <div className="shop-buy">
          <span>◈ {listing.price}</span>
          <button className="primary" aria-label={`Buy ${listing.name} (${listing.id}) for ${listing.price} credits, deliver to ${destination.name}`} disabled={Boolean(reason)} onClick={() => onBuy(listing, destination.id)}>Buy for {destination.name}</button>
          {reason ? <small>{reason}</small> : null}
        </div>
      </li>;
    })}</ul> : <p className="empty-copy">{world.shop.listings.length ? 'No listing matches these filters.' : `Sold out until the next delivery in ${plural(nextDelivery, 'game day')}.`}</p>}
  </section>;
}
