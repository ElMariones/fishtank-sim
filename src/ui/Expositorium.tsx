import { useMemo } from 'react';
import { isEgg } from '../core/development';
import { rarityOf } from '../core/rarity';
import type { Fish } from '../core/types';
import { DISPLAY_CAPACITY } from '../core/world';
import { Icon } from './Icon';

const SPECIES = { koi: 'Koi', axolotl: 'Axolotl', goldfish: 'Goldfish' } as const;

/**
 * Expositorium overlay for a display aquarium: one plaque per resident, a spotlight toggle and a visual treat. Plaques
 * select the fish; the treat only drops visual pellets and never changes nutrition, so it is free and always honest.
 */
export function ShowcasePlaques({ fish, selectedId, spotlight, onSelect, onSpotlight, onTreat }: {
  fish: Fish[]; selectedId: string; spotlight: boolean; onSelect: (id: string) => void; onSpotlight: () => void; onTreat: () => void;
}) {
  const plaques = useMemo(() => fish.map(member => ({ member, rarity: isEgg(member.life) ? null : rarityOf(member.species, member.genome) })), [fish]);
  return <div className="showcase" role="group" aria-label="Expositorium showcase">
    <div className="showcase-tools">
      <span className="showcase-title"><Icon name="crown" size={14} />Expositorium · {fish.length}/{DISPLAY_CAPACITY} on show</span>
      <button className="btn-sm" aria-pressed={spotlight} onClick={onSpotlight} data-tip="Follow the selected fish with a show spotlight"><Icon name="sun" size={14} />Spotlight {spotlight ? 'on' : 'off'}</button>
      <button className="btn-sm" onClick={onTreat} data-tip="Drop a few visual pellets to draw the fish forward. Free; it does not feed them."><Icon name="food" size={14} />Offer a treat</button>
    </div>
    <ol className="showcase-plaques">
      {plaques.map(({ member, rarity }) => <li key={member.id}>
        <button className={`plaque ${member.id === selectedId ? 'active' : ''}`} aria-pressed={member.id === selectedId} onClick={() => onSelect(member.id)}>
          <strong>{member.name}</strong>
          <small>{SPECIES[member.species]} · {member.sex === 'F' ? '♀' : '♂'} · G{member.generation}</small>
          {rarity ? <span className={`plaque-tier tier-${rarity.tier.replace(' ', '-')}`}>{rarity.tier[0].toUpperCase()}{rarity.tier.slice(1)}{rarity.standouts ? ` · ${rarity.standouts} rare trait${rarity.standouts === 1 ? '' : 's'}` : ''}</span> : <span className="plaque-tier">Incubating</span>}
        </button>
      </li>)}
      {Array.from({ length: Math.max(0, DISPLAY_CAPACITY - fish.length) }, (_, i) => <li key={`empty-${i}`}><span className="plaque empty">Empty plinth<small>Move a fish here to show it</small></span></li>)}
    </ol>
  </div>;
}
