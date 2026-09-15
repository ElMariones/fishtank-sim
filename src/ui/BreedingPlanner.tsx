import { useMemo, useState } from 'react';
import { carrierCopies, GOAL_BY_KEY, GOAL_DESCRIPTORS, targetCopyOdds, traitValue, type GoalTrait } from '../core/breedingGoals';
import { goalValue, sortCollection, type BreedingGoal } from '../core/collection';
import { isEgg } from '../core/development';
import type { Fish, Tank } from '../core/types';
import { FishPortrait } from './FishPortrait';
import { OffspringPrediction } from './OffspringPrediction';

const groups = [...new Set(GOAL_DESCRIPTORS.map(d => d.group))];
const percent = (n: number) => `${Math.round(n * 100)}%`;
type Props = { fish: Fish[]; tanks: Tank[]; goal: BreedingGoal | null; onGoal: (goal: BreedingGoal | null) => void;
  motherId: string; fatherId: string; onMother: (id: string) => void; onFather: (id: string) => void };

export function BreedingPlanner({ fish, tanks, goal, onGoal, motherId, fatherId, onMother, onFather }: Props) {
  const [scope, setScope] = useState('all');
  const [query, setQuery] = useState('');
  const traits: GoalTrait[] = goal ? [goal, ...(goal.secondary ?? [])] : [];
  const candidates = useMemo(() => sortCollection(fish.filter(f => f.status === 'living' && !isEgg(f.life)
    && (scope === 'all' || f.tankId === scope) && `${f.name} ${f.id}`.toLowerCase().includes(query.toLowerCase())), goal ? 'goal' : 'name', goal), [fish, scope, query, goal]);
  const mother = candidates.find(f => f.sex === 'F'), father = candidates.find(f => f.sex === 'M');
  const selectedMother = fish.find(f => f.id === motherId), selectedFather = fish.find(f => f.id === fatherId);
  const setTraits = (next: GoalTrait[]) => onGoal(next.length ? { ...next[0], secondary: next.slice(1) } : null);
  const update = (index: number, value: Partial<GoalTrait>) => setTraits(traits.map((trait, i) => i === index ? { ...trait, ...value } : trait));
  const match = (f: Fish) => goal ? percent(goal.direction === 'higher' ? goalValue(f, goal) : 1 - goalValue(f, goal)) : '';
  const home = (f: Fish) => tanks.find(t => t.id === f.tankId)?.name ?? 'Unknown tank';
  return <div className="breeding-planner">
    <div className="planner-heading"><strong>Build your breeding goal</strong><span>Up to four equally weighted traits</span></div>
    {traits.map((trait, index) => <div className="planner-trait" key={index}>
      <label>Goal {index + 1}<select aria-label={`Goal ${index + 1}`} value={trait.descriptor} onChange={e => update(index, { descriptor: e.target.value })}>
        {groups.map(group => <optgroup key={group} label={group}>{GOAL_DESCRIPTORS.filter(d => d.group === group).map(d => <option key={d.key} value={d.key} disabled={traits.some((t, i) => i !== index && t.descriptor === d.key)}>{d.label}</option>)}</optgroup>)}
      </select></label>
      <label>Preference<select aria-label={`Preference ${index + 1}`} value={trait.direction} onChange={e => update(index, { direction: e.target.value as GoalTrait['direction'] })}>
        <option value="higher">{GOAL_BY_KEY.get(trait.descriptor)?.locus ? 'Express' : 'Higher ↑'}</option><option value="lower">{GOAL_BY_KEY.get(trait.descriptor)?.locus ? 'Avoid' : 'Lower ↓'}</option>
      </select></label>
      <button className="quiet" aria-label={`Remove goal ${index + 1}`} onClick={() => setTraits(traits.filter((_, i) => i !== index))}>Remove</button>
    </div>)}
    <div className="planner-tools"><button id="planner-add-goal" disabled={traits.length >= 4} onClick={() => setTraits([...traits, { descriptor: GOAL_DESCRIPTORS.find(d => !traits.some(t => t.descriptor === d.key))!.key, direction: 'higher' }])}>＋ Add goal</button>
      {goal ? <button className="quiet" onClick={() => onGoal(null)}>Clear goals</button> : <span>Start with a shape, a Genome 2 appearance, or a behavior trait.</span>}</div>
    <div className="planner-scope"><label>Find parents in<select aria-label="Find parents in" value={scope} onChange={e => setScope(e.target.value)}><option value="all">All tanks</option>{tanks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <label>Search candidates<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Name or fish ID" /></label></div>
    <div className="planner-heading"><strong>{candidates.length} eligible candidates</strong><button disabled={!goal || !mother || !father} onClick={() => { onMother(mother!.id); onFather(father!.id); }}>Use both goal leaders</button></div>
    <div className="planner-parents">{(['F', 'M'] as const).map(sex => {
      const selectedId = sex === 'F' ? motherId : fatherId, choose = sex === 'F' ? onMother : onFather;
      const selected = fish.find(f => f.id === selectedId), available = candidates.filter(f => f.sex === sex), leader = available[0];
      return <div className="planner-parent" key={sex}><label>{sex === 'F' ? '♀ Mother' : '♂ Father'}<select id={sex === 'F' ? 'planner-mother' : 'planner-father'} value={selectedId} onChange={e => choose(e.target.value)}>
        <option value="">Select {sex === 'F' ? 'female' : 'male'}</option>
        {selected && !available.some(f => f.id === selectedId) ? <option value={selectedId}>{selected.name} · outside candidate filter</option> : null}
        {available.map(f => <option key={f.id} value={f.id}>{f.name} · {home(f)}{goal ? ` · ${match(f)} match` : ''}</option>)}
      </select></label>
      {selected ? <div className="planner-preview"><FishPortrait fish={selected} /><div><strong>{selected.name}</strong><small>{home(selected)} · G{selected.generation}</small>
        {goal ? <><b>{match(selected)} adult trait match</b>{traits.map(t => <small key={t.descriptor}>{GOAL_BY_KEY.get(t.descriptor)?.label}: {percent(traitValue(selected, t))}{carrierCopies(selected, t.descriptor) !== null ? ` · ${carrierCopies(selected, t.descriptor)}/2 target copies` : ''}</small>)}</> : null}</div></div> : null}
      {goal && leader ? <button className="quiet" onClick={() => choose(leader.id)}>Choose {leader.name} · {match(leader)} match</button> : <p className="help-copy">{available.length ? 'Choose a goal to rank these candidates.' : 'No eligible fish of this sex in this filter.'}</p>}
      </div>;
    })}</div>
    {selectedMother && selectedFather && traits.some(t => GOAL_BY_KEY.get(t.descriptor)?.locus) ? <div className="planner-odds"><strong>What this pair can pass on</strong>{traits.map(t => {
      const odds = targetCopyOdds(selectedMother, selectedFather, t.descriptor);
      return odds ? <p key={t.descriptor}>{GOAL_BY_KEY.get(t.descriptor)?.label}: <b>{percent(odds.atLeastOne)}</b> at least one copy · <b>{percent(odds.both)}</b> two copies</p> : null;
    })}<small>Exact single-locus copy odds before mutation. Dominance, blends and other genes determine the visible result; these are not combined-trait probabilities.</small></div> : null}
    {selectedMother && selectedFather ? <OffspringPrediction mother={selectedMother.genome} father={selectedFather.genome} goals={traits.map(t => t.descriptor)} /> : null}
    <p className="help-copy">Match ranks expressed adult traits, not offspring odds. Target copies reveal hidden carriers; a blend can match both colors. Combined goals average their scores. Leaders are ranked individually; review the pair’s pedigree F below. Filtering keeps your selected parents.</p>
  </div>;
}
