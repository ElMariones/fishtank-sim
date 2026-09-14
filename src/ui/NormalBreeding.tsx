import { CLUTCH_SIZES, clutchMembers, courtshipBlockers, courtshipRate, pairingBlockers, reservedPlaces, type ClutchSize } from '../core/breeding';
import { INCUBATION_DAYS, isEgg } from '../core/development';
import type { Clutch, World } from '../core/types';
import { MAX_LIVING, MAX_RECORDS } from '../core/world';

const STAGE_TEXT: Record<Clutch['stage'], string> = { courting: 'Courting', incubating: 'Eggs incubating', hatched: 'Hatched', cancelled: 'Cancelled' };
const pct = (value: number) => `${Math.round(value * 100)}%`;
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

type Props = {
  world: World; motherId: string; fatherId: string; nurseryId: string; size: ClutchSize; readOnly: boolean;
  onNursery: (tankId: string) => void; onSize: (size: ClutchSize) => void; onPair: () => void;
  onCancel: (clutch: Clutch) => void; onShowClutch: (clutch: Clutch) => void;
};

/** FS-401/402 normal breeding: nursery and clutch size, every blocker with its fix, and the clutches under way. */
export function NormalBreeding({ world, motherId, fatherId, nurseryId, size, readOnly, onNursery, onSize, onPair, onCancel, onShowClutch }: Props) {
  const name = (id: string) => world.fish.find(f => f.id === id)?.name ?? id;
  const tankName = (id: string) => world.tanks.find(t => t.id === id)?.name ?? id;
  const blockers = pairingBlockers(world, { motherId, fatherId, nurseryId, size }, { maxLiving: MAX_LIVING, maxRecords: MAX_RECORDS });
  const mother = world.fish.find(f => f.id === motherId), father = world.fish.find(f => f.id === fatherId);
  const ready = !blockers.length && mother && father;
  const pauses = ready ? courtshipBlockers(world, { motherId, fatherId }) : [];
  const active = world.clutches.filter(clutch => clutch.stage === 'courting' || clutch.stage === 'incubating');
  const finished = world.clutches.filter(clutch => clutch.stage === 'hatched' || clutch.stage === 'cancelled').slice(-3).reverse();

  return <div className="normal-breeding">
    <div className="pairing-options">
      <label>Nursery for the eggs<select value={nurseryId} onChange={event => onNursery(event.target.value)}>
        {world.tanks.map(tank => {
          const free = tank.capacity - world.fish.filter(f => f.status === 'living' && f.tankId === tank.id).length - reservedPlaces(world, tank.id);
          return <option key={tank.id} value={tank.id}>{tank.name} · {plural(Math.max(0, free), 'free place')}</option>;
        })}
      </select></label>
      <label>Tracked eggs<select value={size} onChange={event => onSize(Number(event.target.value) as ClutchSize)}>
        {CLUTCH_SIZES.map(option => <option key={option} value={option}>{option} eggs</option>)}
      </select></label>
    </div>
    {blockers.length
      ? <ul className="blocker-list" aria-label="Why this pair cannot court yet">{blockers.map((blocker, i) => <li key={`${blocker.code}-${i}`}>{blocker.message}<small>{blocker.fix}</small></li>)}</ul>
      : ready ? <p className="pairing-ready">Ready: {mother.name} and {father.name} can court in {tankName(mother.tankId)}. Courtship takes about {plural(Math.ceil(1 / courtshipRate(mother, father)), 'game day')} while nothing pauses it. Starting reserves {size} places in {tankName(nurseryId)} now; the eggs hatch {INCUBATION_DAYS} game days after they are laid.</p> : null}
    {pauses.length ? <ul className="blocker-list soft" aria-label="Courtship would pause right now">{pauses.map((blocker, i) => <li key={`${blocker.code}-${i}`}>Courtship would pause now: {blocker.message}<small>{blocker.fix}</small></li>)}</ul> : null}
    <div className="breed-action"><button className="primary" disabled={readOnly || !ready} onClick={onPair}>Start courtship · reserve {size} places</button></div>
    {active.length || finished.length ? <section aria-labelledby="clutches-title">
      <h3 id="clutches-title" className="clutch-heading">Clutches</h3>
      <ul className="clutch-list">{[...active, ...finished].map(clutch => {
        const paused = clutch.stage === 'courting' ? courtshipBlockers(world, clutch) : [];
        const incubating = clutch.stage === 'incubating' ? clutchMembers(world, clutch).filter(member => member.status === 'living' && isEgg(member.life)).length : 0;
        return <li key={clutch.id}>
          <div>
            <strong>{name(clutch.motherId)} × {name(clutch.fatherId)}</strong> <span>{STAGE_TEXT[clutch.stage]} · {clutch.id} · nursery {tankName(clutch.nurseryId)}</span>
            {clutch.stage === 'courting' ? <>
              <progress max={1} value={clutch.progress} aria-label={`Courtship progress ${pct(clutch.progress)}`} />
              <small>{pct(clutch.progress)} after {plural(clutch.days, 'game day')} · {clutch.size} places reserved</small>
              {paused.length ? <small className="clutch-paused">Paused: {paused.map(blocker => `${blocker.message} ${blocker.fix}`).join(' ')}</small> : null}
            </> : null}
            {clutch.stage === 'incubating' ? <small>{incubating} of {clutch.size} eggs still incubating · laid after {plural(clutch.spawnedDay ?? 0, 'game day')} of courtship</small> : null}
            {clutch.stage === 'hatched' ? <small>{clutch.size} eggs hatched · laid after {plural(clutch.spawnedDay ?? 0, 'game day')} of courtship</small> : null}
          </div>
          <div className="clutch-actions">
            {clutch.stage === 'courting' ? <button className="quiet" disabled={readOnly} onClick={() => onCancel(clutch)}>Cancel courtship</button> : null}
            {clutch.firstFishId ? <button className="quiet" onClick={() => onShowClutch(clutch)}>Show clutch</button> : null}
          </div>
        </li>;
      })}</ul>
    </section> : null}
  </div>;
}
