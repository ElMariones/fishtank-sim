import type { Fish } from '../core/types';
import { isEgg } from '../core/development';
import { SexMark } from './Controls';
import { FishPortrait, type PortraitView } from './FishPortrait';
import { Icon } from './Icon';
import { growthShare, lifeSummary } from './lifeText';

type Props = {
  fish: Fish; view: PortraitView; selected: boolean; inBatch: boolean; batchMode: boolean; favorite: boolean;
  rank?: number; goal?: { label: string; match: string } | null; index: number;
  onSelect: (keyboard: boolean) => void; onFavorite: () => void; onBatch: (extend: boolean) => void;
  onMenu: (event: React.MouseEvent) => void; onMenuKey: (element: HTMLElement) => void;
};

/**
 * A collection card drawn as a specimen plate. The selection check appears on hover, when checked, or while a batch
 * is being made; right-click, the Menu key or the ⋯ button open the card's actions.
 */
export function FishCard({ fish, view, selected, inBatch, batchMode, favorite, rank, goal, index, onSelect, onFavorite, onBatch, onMenu, onMenuKey }: Props) {
  const living = fish.status === 'living', egg = isEgg(fish.life), growth = living && !egg ? growthShare(fish) : 0;
  const status = living ? lifeSummary(fish) : fish.status === 'sold' ? 'Sold · archived' : 'Rehomed · archived';
  return <article className={`fish-card species-${fish.species} ${selected ? 'selected' : ''} ${inBatch ? 'batched' : ''} ${batchMode ? 'batch-mode' : ''} ${living ? '' : 'archived'}`}
    style={{ '--stagger': Math.min(index, 12) } as React.CSSProperties} onContextMenu={onMenu}>
    <button className="bare fish-card-main" id={`card-${fish.id}`} aria-pressed={batchMode && living ? inBatch : selected}
      onClick={event => { if (batchMode && living) { onBatch(event.shiftKey); return; } onSelect(event.detail === 0); }}
      onKeyDown={event => { if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) { event.preventDefault(); onMenuKey(event.currentTarget); } }}>
      <span className="card-plate">
        <FishPortrait fish={fish} view={view} />
        <span className="card-floor" aria-hidden="true" />
      </span>
      <span className="card-body">
        <span className="card-name-row"><strong className="card-name">{fish.name}</strong><SexMark sex={fish.sex} /></span>
        <span className="visually-hidden">Generation {fish.generation}{rank !== undefined ? `, rank ${rank} for the breeding goal` : ''}{egg ? ', egg' : ''}.</span>
        <small className="card-meta">{fish.species === 'axolotl' ? 'Axolotl' : 'Koi'} · {status}</small>
        {living && !egg ? <span className="bar card-growth" aria-hidden="true"><span style={{ width: `${Math.round(growth * 100)}%` }} /></span> : null}
        {goal ? <span className="goal-chip"><Icon name="sparkles" size={12} />{goal.label} <b className="mono">{goal.match}</b></span> : null}
      </span>
    </button>
    <span className="card-tags" aria-hidden="true">
      <span className="generation">G{fish.generation}</span>
      {rank !== undefined ? <span className="rank-chip mono">#{rank}</span> : null}
      {egg ? <span className="chip koi egg-chip"><Icon name="egg" size={11} />egg</span> : null}
    </span>
    <button className={`bare favorite-toggle ${favorite ? 'on' : ''}`} aria-pressed={favorite} aria-label={`Favorite ${fish.name}`} data-tip={favorite ? 'Kept as a favorite · never sold in bulk' : 'Keep as a favorite'} onClick={onFavorite}>
      <Icon name="star" size={17} filled={favorite} /></button>
    <button className="bare card-more" aria-label={`${fish.name} actions`} data-tip="Actions" onClick={event => onMenuKey(event.currentTarget)}><Icon name="more" size={16} /></button>
    {living ? <label className="batch-check" data-tip={inBatch ? 'Selected · shift-click to extend' : 'Select for a batch move or sale'}>
      <input type="checkbox" checked={inBatch} aria-label={`Select ${fish.name} for a batch move or sale${favorite ? ', a favorite kept from sales' : egg ? ', an egg not for sale' : ''}`}
        onChange={event => onBatch((event.nativeEvent as MouseEvent).shiftKey === true)} />
      <span className="check-ui" aria-hidden="true"><Icon name="check" size={13} /></span>
    </label> : null}
  </article>;
}
