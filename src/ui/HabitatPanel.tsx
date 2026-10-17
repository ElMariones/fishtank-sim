import { useState } from 'react';
import { DECOR_CATEGORIES, itemOf, styleOf, styleOption } from '../core/aquascape';
import { MAX_DECORATIONS, TANK_PRICE, TANK_UPGRADE_PRICE, decorationsOf } from '../core/tankManagement';
import { reservedPlaces } from '../core/breeding';
import type { Tank, World } from '../core/types';
import { DISPLAY_CAPACITY, DISPLAY_PRICE, isDisplay, MAX_DISPLAYS, MAX_TANKS, type Command } from '../core/world';
import { Icon } from './Icon';
import { Dialog } from './kit/Overlay';

const SINGULAR = { plants: 'plant', rocks: 'rock', wood: 'wood piece', ornaments: 'ornament' } as const;

type Props = { world: World; tank: Tank; readOnly?: boolean; expanded?: boolean; onAquascape: () => void; onRun: (command: Command, message: string) => boolean };
export function HabitatPanel({ world, tank, readOnly, expanded, onAquascape, onRun }: Props) {
  const [review, setReview] = useState<'purchase' | 'upgrade' | 'display' | null>(null);
  const working = world.tanks.filter(t => !isDisplay(t)).length, displays = world.tanks.filter(isDisplay).length, display = isDisplay(tank);
  const current = decorationsOf(tank), style = styleOf(tank);
  const tally = DECOR_CATEGORIES.map(category => ({ ...category, count: current.filter(piece => itemOf(piece).category === category.id).length })).filter(entry => entry.count);
  const price = review === 'purchase' ? TANK_PRICE : review === 'display' ? DISPLAY_PRICE : TANK_UPGRADE_PRICE;
  return <section className="habitat-panel" id="habitat-controls" aria-labelledby="habitat-title" data-expanded={expanded || undefined}>
    <header className="panel-header">
      <span className="panel-icon" aria-hidden="true"><Icon name="leaf" size={20} /></span>
      <div><span className="eyebrow">Habitat</span><h2 id="habitat-title">Habitat & expansion</h2>
        <p className="mono">{tank.capacity} places · {tank.water.volumeL.toLocaleString()} L · {current.length} decorations · {reservedPlaces(world, tank.id)} reserved for courtship</p></div>
    </header>
    <div className="habitat-aquascape">
      <div>
        <div className="eyebrow">Aquascape</div>
        <h3>Make {tank.name} your own</h3>
        <p>Drag rocks, wood, plants and ornaments straight into the live aquarium, then choose its substrate, backdrop and lighting, or start from a theme. Plants offer shy fish shelter; solid pieces redirect swimming. The look never changes water quality or growth.</p>
        <div className="habitat-tags">
          <span className="count-tag">{current.length} / {MAX_DECORATIONS} pieces</span>
          {tally.map(entry => <span className="count-tag" key={entry.id}>{entry.count} {entry.count === 1 ? SINGULAR[entry.id] : entry.label.toLowerCase()}</span>)}
          <span className="count-tag">{styleOption('substrate', style.substrate).name}</span>
          <span className="count-tag">{styleOption('backdrop', style.backdrop).name}</span>
          <span className="count-tag">{styleOption('lighting', style.lighting).name}</span>
          {style.effect ? <span className="count-tag">{styleOption('effect', style.effect).name}</span> : null}
        </div>
      </div>
      <button className="primary" disabled={readOnly} onClick={onAquascape}><Icon name="brush" size={16} />Open aquascape editor</button>
    </div>
    <div className="habitat-offers">
      <article className="habitat-offer">
        <span className="panel-icon" aria-hidden="true"><Icon name="tank" size={20} /></span>
        <div><h3>New aquarium</h3><p>An empty tank with 20 places, 10,000 L and standard equipment. {working} of {MAX_TANKS} slots in use.</p></div>
        <button className="brass" disabled={readOnly || working >= MAX_TANKS || world.credits < TANK_PRICE} onClick={() => setReview('purchase')}><Icon name="plus" size={15} />Buy · ◈ {TANK_PRICE}</button>
      </article>
      <article className="habitat-offer">
        <span className="panel-icon" aria-hidden="true"><Icon name="layers" size={20} /></span>
        <div><h3>Expand {tank.name}</h3><p>{display ? `Display aquariums keep their ${DISPLAY_CAPACITY} places.` : `Adds up to 20 places and 10,000 L of clean water, up to 60 places. Now ${tank.capacity} places.`}</p></div>
        <button className="brass" disabled={readOnly || display || tank.capacity >= 60 || world.credits < TANK_UPGRADE_PRICE} onClick={() => setReview('upgrade')}><Icon name="arrowRight" size={15} />Expand · ◈ {TANK_UPGRADE_PRICE}</button>
      </article>
      <article className="habitat-offer display-offer" id="display-offer" tabIndex={-1}>
        <span className="panel-icon" aria-hidden="true"><Icon name="crown" size={20} /></span>
        <div><h3>Expositorium display aquarium</h3><p>A showcase for your best fish, kept apart from the working tanks: {DISPLAY_CAPACITY} places, fish drawn larger, a show spotlight and plaques. Fish there still swim, court and breed. {displays} of {MAX_DISPLAYS} displays open.</p></div>
        <button className="brass" disabled={readOnly || displays >= MAX_DISPLAYS || world.credits < DISPLAY_PRICE} onClick={() => setReview('display')}><Icon name="plus" size={15} />Open · ◈ {DISPLAY_PRICE}</button>
      </article>
    </div>
    <p className="help-copy">Equipment, rations and water changes are managed in Care.</p>
    {world.credits < TANK_PRICE ? <p>Not enough credits for a new aquarium. Sell surplus fish to NPC buyers, or rehome hatched fish for free to release places. The credits button in the header lists everything that still costs nothing.</p> : null}
    {working >= MAX_TANKS ? <p>All eight aquarium slots are in use.</p> : null}
    {!display && tank.capacity >= 60 ? <p>{tank.name} already has the maximum 60 places. Open a smaller aquarium to expand it, or review a new aquarium.</p> : null}
    <Dialog open={!!review} onClose={() => setReview(null)} tone="brass" icon={review === 'purchase' ? 'tank' : review === 'display' ? 'crown' : 'layers'}
      title={review === 'purchase' ? 'Buy a new aquarium?' : review === 'display' ? 'Open a display aquarium?' : `Expand ${tank.name}?`}
      description={review === 'purchase' ? 'A new empty aquarium with 20 places, 10,000 L, Standard filter and aeration.' : review === 'display' ? `A ${DISPLAY_CAPACITY}-place showcase with 4,000 L, Standard equipment, black sand, a blackout backdrop and gallery spotlights. Move fish in to show them off.` : `From ${tank.capacity} to ${Math.min(60, tank.capacity + 20)} places, with 10,000 L of clean water added. Existing fish and reservations stay in place.`}
      actions={<><button className="quiet" onClick={() => setReview(null)}>Cancel</button><button className="confirm" disabled={readOnly || world.credits < price} onClick={() => {
        const command: Command = review === 'purchase' ? { type: 'purchase-tank' } : review === 'display' ? { type: 'purchase-display' } : { type: 'upgrade-tank', tankId: tank.id };
        if (onRun(command, `${review === 'purchase' ? 'Aquarium purchase' : review === 'display' ? 'Display aquarium' : 'Aquarium expansion'} recorded in the ledger · ◈ ${price}.`)) setReview(null);
      }}><Icon name="coins" size={16} />Confirm · ◈ {price}</button></>}>
      <div className="dialog-total"><span>Balance after</span><strong>◈ {(world.credits - price).toLocaleString()}</strong></div>
    </Dialog>
  </section>;
}
