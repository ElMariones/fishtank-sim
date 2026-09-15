import { useMemo, useState } from 'react';
import { reservedPlaces } from '../core/breeding';
import type { TraitCache } from '../core/economy';
import { recoveryOverview, RELIEF_COOLDOWN_DAYS, RELIEF_THRESHOLD, reliefDestination } from '../core/recovery';
import type { World } from '../core/types';

type Props = { world: World; readOnly: boolean; traitCache: TraitCache; onClaim: (tankId: string) => void };

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** FS-504 no-money recovery: what still costs nothing, what surplus could earn today, and the koi rescue. */
export function RecoveryOptions({ world, readOnly, traitCache, onClaim }: Props) {
  const overview = useMemo(() => recoveryOverview(world, traitCache), [world, traitCache]);
  const { relief, living } = overview, arriving = Math.max(1, relief.sexes.length);
  const [chosen, setChosen] = useState('');
  const residents = (tankId: string) => world.fish.filter(f => f.status === 'living' && f.tankId === tankId).length;
  const free = (tankId: string) => Math.max(0, (world.tanks.find(t => t.id === tankId)?.capacity ?? 0) - residents(tankId) - reservedPlaces(world, tankId));
  const destination = world.tanks.find(t => t.id === chosen) ?? world.tanks.find(t => t.id === reliefDestination(world, arriving)) ?? world.tanks[0];
  const roomy = free(destination.id) >= arriving;
  const offered = relief.sexes.length === 2 ? 'a rescued pair' : `a rescued ${relief.sexes[0] === 'F' ? 'female' : 'male'}`;

  return <section className="recovery-options" aria-labelledby="recovery-title">
    <h3 id="recovery-title" tabIndex={-1}>If credits run low</h3>
    <p className="help-copy">You have {plural(living.F, 'living female')} and {plural(living.M, 'living male')}. Breeding, food, moving fish, rehoming and lower care settings never cost credits, so a lineage with both sexes can always continue.</p>
    <ul className="recovery-list">
      <li><strong>Sell surplus</strong><span>{overview.saleable
        ? `${overview.saleable} of your ${overview.releasable} hatched fish that are not courting ${overview.saleable === 1 ? 'has' : 'have'} a buyer today; selling all of them in record order would bring ◈ ${overview.saleTotal.toLocaleString('en')}. Buyers want more each game day.`
        : overview.releasable ? 'No buyer wants your hatched fish today. Demand recovers each game day.' : 'No hatched fish can be sold right now.'}</span></li>
      <li><strong>Rehome for free</strong><span>Rehoming releases places and eases crowding without credits, and rehomed fish keep their family records.</span></li>
      <li><strong>Care without credits</strong><span>Rations, the thermostat and lower equipment tiers cost nothing to change. When a care warning’s priced fixes are out of reach, it names a free one.</span></li>
      <li><strong>Koi rescue</strong><span>If no living female or no living male is left and you have less than ◈ {RELIEF_THRESHOLD} for each missing sex, the rescue gives one unrelated adult of each at no cost, at most once every {RELIEF_COOLDOWN_DAYS} game days.{world.relief.claims ? ` Rescues so far: ${world.relief.claims}.` : ''}</span><span className="recovery-status">{relief.reason}</span></li>
    </ul>
    {relief.eligible ? <div className="recovery-claim">
      <label className="inline-select">Rescued fish go to<select value={destination.id} onChange={event => setChosen(event.target.value)}>
        {world.tanks.map(tank => <option key={tank.id} value={tank.id}>{tank.name} · {plural(free(tank.id), 'free place')}</option>)}
      </select></label>
      <button className="primary" disabled={readOnly || !roomy} onClick={() => onClaim(destination.id)}>Accept {offered} · no cost</button>
      {roomy ? null : <small>{destination.name} needs {plural(arriving, 'free place')}. Rehome fish there or choose another aquarium.</small>}
    </div> : null}
  </section>;
}
