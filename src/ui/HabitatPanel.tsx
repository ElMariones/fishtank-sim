import { useState } from 'react';
import { DECOR_CATEGORIES, itemOf, styleOf, styleOption } from '../core/aquascape';
import { MAX_DECORATIONS, TANK_PRICE, TANK_UPGRADE_PRICE, decorationsOf } from '../core/tankManagement';
import { reservedPlaces } from '../core/breeding';
import type { Tank, World } from '../core/types';
import { MAX_TANKS, type Command } from '../core/world';
import { Icon } from './Icon';

const SINGULAR = { plants: 'plant', rocks: 'rock', wood: 'wood piece', ornaments: 'ornament' } as const;

type Props = { world: World; tank: Tank; readOnly?: boolean; expanded?: boolean; onAquascape: () => void; onRun: (command: Command, message: string) => boolean };
export function HabitatPanel({ world, tank, readOnly, expanded, onAquascape, onRun }: Props) {
  const [review, setReview] = useState<'purchase' | 'upgrade' | null>(null);
  const current = decorationsOf(tank), style = styleOf(tank);
  const tally = DECOR_CATEGORIES.map(category => ({ ...category, count: current.filter(piece => itemOf(piece).category === category.id).length })).filter(entry => entry.count);
  return <details className="habitat-panel" id="habitat-controls" open={expanded}>
    <summary>Habitat & expansion <span>{tank.capacity} places · {tank.water.volumeL.toLocaleString()} L · {current.length} decorations</span></summary>
    <div className="habitat-aquascape">
      <div>
        <div className="eyebrow">AQUASCAPE</div>
        <h3>Make {tank.name} your own</h3>
        <p>Drag rocks, wood, plants and ornaments straight into the live aquarium, then choose its substrate, backdrop and lighting, or start from a theme. Plants offer shy fish shelter; solid pieces redirect swimming. The look never changes water quality or growth.</p>
        <div className="habitat-tags">
          <span className="count-tag">{current.length} / {MAX_DECORATIONS} pieces</span>
          {tally.map(entry => <span className="count-tag" key={entry.id}>{entry.count} {entry.count === 1 ? SINGULAR[entry.id] : entry.label.toLowerCase()}</span>)}
          <span className="count-tag">{styleOption('substrate', style.substrate).name}</span>
          <span className="count-tag">{styleOption('backdrop', style.backdrop).name}</span>
          <span className="count-tag">{styleOption('lighting', style.lighting).name}</span>
        </div>
      </div>
      <button className="primary" disabled={readOnly} onClick={onAquascape}><Icon name="brush" size={16} />Open aquascape editor</button>
    </div>
    <h3>Aquariums</h3>
    <p>Two starter aquariums are included. New aquariums cost ◈ {TANK_PRICE} for 20 places and 10,000 L. Each expansion adds up to 20 places and 10,000 L for ◈ {TANK_UPGRADE_PRICE}, up to 60 places. Equipment is managed in Care controls.</p>
    <p>{reservedPlaces(world, tank.id)} places reserved for courtship.</p>
    <div className="habitat-actions">
      <button disabled={readOnly || world.tanks.length >= MAX_TANKS || world.credits < TANK_PRICE} onClick={() => setReview('purchase')}>Review new aquarium · ◈ {TANK_PRICE}</button>
      <button disabled={readOnly || tank.capacity >= 60 || world.credits < TANK_UPGRADE_PRICE} onClick={() => setReview('upgrade')}>Review expansion · ◈ {TANK_UPGRADE_PRICE}</button>
    </div>
    {world.credits < TANK_PRICE ? <p>Not enough credits for a new aquarium. Sell surplus fish to NPC buyers, or rehome hatched fish for free to release places. The credits button in the header lists everything that still costs nothing.</p> : null}
    {world.tanks.length >= MAX_TANKS ? <p>All eight aquarium slots are in use.</p> : null}
    {tank.capacity >= 60 ? <p>{tank.name} already has the maximum 60 places. Open a smaller aquarium to expand it, or review a new aquarium.</p> : null}
    {review ? <div className="batch-review" role="region" aria-label="Aquarium purchase review">
      <p>{review === 'purchase' ? 'Buy a new empty aquarium with 20 places, 10,000 L, Standard filter and aeration?' : `Expand ${tank.name} from ${tank.capacity} to ${Math.min(60, tank.capacity + 20)} places and add 10,000 L of clean water? Existing fish and reservations stay in place.`}</p>
      <p>Cost: ◈ {review === 'purchase' ? TANK_PRICE : TANK_UPGRADE_PRICE}. Balance after: ◈ {world.credits - (review === 'purchase' ? TANK_PRICE : TANK_UPGRADE_PRICE)}.</p>
      <button disabled={readOnly || world.credits < (review === 'purchase' ? TANK_PRICE : TANK_UPGRADE_PRICE)} onClick={() => {
        if (onRun(review === 'purchase' ? { type: 'purchase-tank' } : { type: 'upgrade-tank', tankId: tank.id }, 'Aquarium purchase recorded in the ledger.')) setReview(null);
      }}>Confirm {review === 'purchase' ? 'aquarium purchase' : 'expansion'}</button>
      <button onClick={() => setReview(null)}>Cancel</button>
    </div> : null}
  </details>;
}
