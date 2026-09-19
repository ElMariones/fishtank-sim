import { fastBreedingBlockers, reservedPlaces } from '../core/breeding';
import { INCUBATION_DAYS } from '../core/development';
import type { World } from '../core/types';
import { FAST_OFFSPRING_COUNTS, MAX_LIVING, MAX_RECORDS } from '../core/world';

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

type Props = {
  world: World; motherId: string; fatherId: string; tankId: string; count: number; readOnly: boolean; expectedF: string;
  onTank: (tankId: string) => void; onCount: (count: number) => void; onBreed: () => void;
};

/** Fast breeding: an instant cross between the selected parents, wherever they live, laying eggs in any chosen tank. */
export function FastBreeding({ world, motherId, fatherId, tankId, count, readOnly, expectedF, onTank, onCount, onBreed }: Props) {
  const tankName = (id: string) => world.tanks.find(t => t.id === id)?.name ?? id;
  const free = (id: string) => {
    const tank = world.tanks.find(t => t.id === id);
    return tank ? Math.max(0, tank.capacity - world.fish.filter(f => f.status === 'living' && f.tankId === id).length - reservedPlaces(world, id)) : 0;
  };
  const blockers = fastBreedingBlockers(world, { motherId, fatherId, tankId, count }, { maxLiving: MAX_LIVING, maxRecords: MAX_RECORDS });
  const mother = world.fish.find(f => f.id === motherId), father = world.fish.find(f => f.id === fatherId);
  const ready = !blockers.length && mother && father;

  return <div className="normal-breeding fast-breeding">
    <div className="pairing-options">
      <label>Offspring spawn in<select id="fast-destination" value={tankId} onChange={event => onTank(event.target.value)}>
        {world.tanks.map(tank => <option key={tank.id} value={tank.id}>{tank.name} · {plural(free(tank.id), 'free place')}</option>)}
      </select></label>
      <label>Offspring<select value={count} onChange={event => onCount(Number(event.target.value))}>
        {FAST_OFFSPRING_COUNTS.map(option => <option key={option} value={option} disabled={option > free(tankId)}>{plural(option, 'egg')}</option>)}
      </select></label>
    </div>
    {blockers.length
      ? <ul className="blocker-list" aria-label="Why fast breeding cannot run yet">{blockers.map((blocker, i) => <li key={`${blocker.code}-${i}`}>{blocker.message}<small>{blocker.fix}</small></li>)}</ul>
      : ready ? <p className="pairing-ready">Ready: {mother.name} ({tankName(mother.tankId)}) × {father.name} ({tankName(father.tankId)}) {mother.tankId === father.tankId ? 'share a tank' : 'can breed across tanks'}. {plural(count, 'egg')} appear in {tankName(tankId)} at once and hatch after {INCUBATION_DAYS} game days.</p> : null}
    <div className="breed-action"><button className="primary" disabled={readOnly || !ready} onClick={onBreed}>Breed now · {plural(count, 'egg')} in {tankName(tankId)} <span>↗</span></button><small>Expected pedigree F: {expectedF}</small></div>
    <p className="lab-note">Fast breeding is a shortcut: no courtship, maturity, condition, rest-day or shared-tank checks, and parents stay where they are. The parents only need to be a hatched female and male of the same species. Switch it off to use normal courtship.</p>
  </div>;
}
