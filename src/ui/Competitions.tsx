import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { courtingClutchOf, reservedPlaces } from '../core/breeding';
import { calendarLabel, competitionSchedule, eligibility, type CompetitionEvent, type CompetitionParticipant, type CompetitionRun } from '../core/competitions';
import { express } from '../core/genetics';
import type { Species, World } from '../core/types';
import { MAX_LIVING, MAX_RECORDS, type Command } from '../core/world';
import { FishPortrait } from './FishPortrait';
import './competitions.css';

type Props = { world: World; onCommand: (command: Command) => boolean; readOnly: boolean };
const TIERS = ['amateur', 'entry', 'regional', 'national', 'pro', 'global'] as const;
const title = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
const money = (amount: number) => `${amount.toLocaleString('en')} cr`;
const speciesName = (species: Species) => species === 'koi' ? 'Koi' : 'Axolotl';
const ordinal = (rank: number) => rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`;
const judgeNames = ['Dr. Iris Vale', 'Ren Okada', 'Amara Rivers'];
const judgeFields = ['Presentation', 'Pattern', 'Condition'];
const judgeNotes = ['Tracing silhouette, balance and expression…', 'Studying pigment, markings and ornament…', 'Reviewing growth and developmental condition…'];
const themeStyle = (event: CompetitionEvent) => ({ '--show-hue': `${[170, 203, 265, 26, 145, 325][event.theme % 6]}` }) as CSSProperties;

function AwardMark({ rank, small = false }: { rank: number; small?: boolean }) {
  return <span className={`circuit-medal rank-${Math.min(rank, 4)} ${small ? 'small' : ''}`} aria-label={rank <= 3 ? `${ordinal(rank)} place medal` : `${ordinal(rank)} place`}>
    <svg viewBox="0 0 48 54" aria-hidden="true"><path d="m13 30-3 21 14-7 14 7-3-21" fill="currentColor" opacity=".45" /><circle cx="24" cy="22" r="17" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="24" cy="22" r="13" fill="currentColor" opacity=".13" /><path d="m24 10 3.4 7 7.6 1.1-5.5 5.4 1.3 7.5-6.8-3.6-6.8 3.6 1.3-7.5-5.5-5.4 7.6-1.1Z" fill="currentColor" /></svg>
    <b>{ordinal(rank)}</b>
  </span>;
}

export function Competitions({ world, onCommand, readOnly }: Props) {
  const [chosen, setChosen] = useState<CompetitionEvent | null>(null);
  const [species, setSpecies] = useState<'all' | Species>('all');
  const [tier, setTier] = useState('all');
  const day = world.circuit.day;
  const schedule = useMemo(() => competitionSchedule(world.seed, day), [world.seed, day]);
  const completed = new Set(world.circuit.history.map(run => run.event.id));
  if (world.circuit.active) return <CompetitionStage key={world.circuit.active.event.id} {...{ world, onCommand, readOnly }} run={world.circuit.active} />;
  if (chosen) return <CompetitionEntry key={chosen.id} {...{ world, readOnly }} event={chosen} onBack={() => setChosen(null)} onCommand={command => { const ok = onCommand(command); if (ok) setChosen(null); return ok; }} />;
  const events = schedule.filter(event => (species === 'all' || event.species === species) && (tier === 'all' || event.tier === tier));
  return <section className="circuit" aria-label="Competitions">
    <header className="circuit-heading"><div><span className="circuit-kicker">THE AQUATIC CIRCUIT</span><h1>A season to shine.</h1><p>Find your stage. Meet extraordinary animals. Build a legacy.</p></div><span className="circuit-date">{calendarLabel(day)}</span></header>
    <div className="circuit-intro"><span className="circuit-star" aria-hidden="true">✦</span><div><b>From your first ribbon to the world stage</b><p>Enter one or two animals. Every show has its own field, judging and prizes. Entry fees are per animal.</p></div><span className="circuit-local">Local NPC circuit</span></div>
    <div className="circuit-toolbar"><div className="circuit-segments" aria-label="Competition species">{(['all', 'koi', 'axolotl'] as const).map(value => <button key={value} aria-pressed={species === value} onClick={() => setSpecies(value)}>{value === 'all' ? 'All animals' : value === 'koi' ? 'Koi' : 'Axolotls'}</button>)}</div><label>Level<select value={tier} onChange={e => setTier(e.target.value)}><option value="all">All levels</option>{TIERS.map(value => <option key={value} value={value}>{title(value)}</option>)}</select></label><span>{events.length} shows this season</span></div>
    <div className="circuit-event-grid">{events.map(event => {
      const done = completed.has(event.id), open = day >= event.opensDay && day < event.closesDay;
      return <article className={`circuit-event tier-${event.tier}`} style={themeStyle(event)} key={event.id}>
        <div className="circuit-event-top"><span className="circuit-badge">{title(event.tier)}</span><span>{speciesName(event.species)} · Year {event.year}</span></div>
        <div className="circuit-event-emblem" aria-hidden="true">✧</div><h2>{event.name}</h2><p className="circuit-location">{event.city} <span>· {event.venue}</span></p>
        <div className="circuit-event-prizes"><span><small>ENTRY / ANIMAL</small><b>{money(event.fee)}</b></span><span><small>FIRST PRIZE</small><b>{money(event.prizes[0])}</b></span></div>
        <p className="circuit-window">{done ? 'Your results are in the trophy room' : open ? `${event.closesDay - day} days left to enter` : `Opens ${calendarLabel(event.opensDay)}`}<span>{calendarLabel(event.opensDay)} — {calendarLabel(event.closesDay - 1)}</span></p>
        <button className={open && !done ? 'circuit-primary' : ''} disabled={!open || done || readOnly} onClick={() => setChosen(event)}>{done ? 'Completed' : open ? 'Choose your entrants →' : 'Coming this season'}</button>
      </article>;
    })}</div>
    {!events.length && <p className="circuit-empty">No shows match these filters. Try another species or level.</p>}
    <p className="circuit-footnote">Shows refresh with the simulation calendar and return with new fields each year. The circuit uses synthetic judging of visible traits and condition; it is not an official breed standard.</p>
  </section>;
}

function CompetitionEntry({ world, event, onCommand, readOnly, onBack }: Props & { event: CompetitionEvent; onBack: () => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [tank, setTank] = useState('all');
  const [sex, setSex] = useState('all');
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [page, setPage] = useState(0);
  const animals = useMemo(() => world.fish.filter(fish => fish.status === 'living' && fish.species === event.species).map(fish => ({ fish, problem: eligibility(fish, event) ?? (courtingClutchOf(world, fish.id) ? 'Finish this animal’s courtship before entering.' : null) })), [world, event]);
  const filtered = animals.filter(({ fish, problem }) => (!eligibleOnly || !problem) && (tank === 'all' || fish.tankId === tank) && (sex === 'all' || fish.sex === sex) && `${fish.name} ${fish.id}`.toLowerCase().includes(query.toLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / 24)), safePage = Math.min(page, pages - 1);
  const fee = event.fee * selected.length;
  const open = world.circuit.day >= event.opensDay && world.circuit.day < event.closesDay;
  const problem = !open ? 'This show is no longer open. Return to the circuit for the current schedule.' : !selected.length ? 'Choose one or two eligible animals.' : fee > world.credits ? `You need ${money(fee - world.credits)} more to enter.` : selected.some(id => !animals.some(a => a.fish.id === id && !a.problem)) ? 'An entrant is no longer eligible. Update your selection.' : null;
  return <section className="circuit" aria-label="Choose competition entrants">
    <button className="circuit-back" onClick={onBack}>← All competitions</button><header className="circuit-heading"><div><span className="circuit-kicker">{event.city} · {title(event.tier)} · {speciesName(event.species)}</span><h1>{event.name}</h1><p>Your collection, your contenders. Select up to two.</p></div></header>
    <div className="circuit-entry-layout"><div><div className="circuit-filters"><label>Search collection<input type="search" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} placeholder="Animal name or ID" /></label><label>Aquarium<select value={tank} onChange={e => { setTank(e.target.value); setPage(0); }}><option value="all">All aquariums</option>{world.tanks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>Sex<select value={sex} onChange={e => { setSex(e.target.value); setPage(0); }}><option value="all">All</option><option value="F">Female</option><option value="M">Male</option></select></label></div>
      <label className="circuit-checkbox"><input type="checkbox" checked={eligibleOnly} onChange={e => { setEligibleOnly(e.target.checked); setPage(0); }} /> Show eligible animals only <span>{filtered.length} animals</span></label>
      <div className="circuit-entrant-grid">{filtered.slice(safePage * 24, safePage * 24 + 24).map(({ fish, problem: blocker }) => {
        const picked = selected.includes(fish.id);
        return <button key={fish.id} className={`circuit-entrant ${picked ? 'selected' : ''}`} aria-pressed={picked} disabled={!!blocker || (!picked && selected.length >= 2)} onClick={() => setSelected(ids => picked ? ids.filter(id => id !== fish.id) : [...ids, fish.id])}>
          <span className="circuit-selection-check" aria-hidden="true">{picked ? '✓' : '+'}</span><FishPortrait fish={fish} view="current" /><strong>{fish.name}</strong><span>{fish.sex === 'F' ? 'Female' : 'Male'} · {fish.life.lengthCm.toFixed(1)} cm · Gen {fish.generation}</span><small className={blocker ? 'circuit-warning' : ''}>{blocker ?? `${Math.round(fish.life.condition * 100)}% condition · Eligible`}</small>
        </button>;
      })}</div>{!filtered.length && <p className="circuit-empty">No animals match. {animals.length ? 'Clear a filter to see your collection.' : `Add ${speciesName(event.species).toLowerCase()} to your collection to enter this show.`}</p>}
      {pages > 1 && <div className="circuit-pagination"><button disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>Previous</button><span>{safePage + 1} / {pages}</span><button disabled={safePage + 1 === pages} onClick={() => setPage(safePage + 1)}>Next</button></div>}
    </div><aside className="circuit-entry-summary"><span className="circuit-kicker">YOUR ENTRY</span><h2>A place in the spotlight</h2><div className="circuit-chosen">{selected.length ? selected.map(id => { const fish = world.fish.find(f => f.id === id)!; return <div key={id}><FishPortrait fish={fish} view="current" /><span>{fish.name}</span><button aria-label={`Remove ${fish.name}`} onClick={() => setSelected(ids => ids.filter(value => value !== id))}>×</button></div>; }) : <p>Your selected animals will appear here.</p>}</div><dl><div><dt>Entrants</dt><dd>{selected.length} / 2</dd></div><div><dt>Fee per animal</dt><dd>{money(event.fee)}</dd></div><div><dt>Total entry fee</dt><dd>{money(fee)}</dd></div><div><dt>Your balance</dt><dd>{money(world.credits)}</dd></div></dl><button className="circuit-primary" disabled={readOnly || !!problem} onClick={() => onCommand({ type: 'enter-competition', eventId: event.id, fishIds: selected })}>Pay & enter the show</button><p role="status">{problem ?? 'Entry is final. Your animals stay in their home aquariums; the show records their appearance and condition today.'}</p><div className="circuit-prize-list">{event.prizes.map((prize, index) => <span key={index}><AwardMark rank={index + 1} small /> {money(prize)}</span>)}</div></aside></div>
  </section>;
}

function CompetitionStage({ world, run, onCommand, readOnly }: Props & { run: CompetitionRun }) {
  const [inspected, setInspected] = useState(run.participants.find(p => p.isPlayer)?.fish.id ?? run.participants[0]?.fish.id);
  const [ceremony, setCeremony] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    if (ceremony === null) return;
    const timer = window.setTimeout(() => setCeremony(value => value === null || value >= 2 ? null : value + 1), 1900);
    return () => window.clearTimeout(timer);
  }, [ceremony]);
  const results = run.phase === 'results' && ceremony === null;
  const sorted = [...run.participants].sort((a, b) => a.rank - b.rank);
  const participant = run.participants.find(p => p.fish.id === inspected) ?? run.participants[0];
  const begin = () => {
    if (onCommand({ type: 'judge-competition' }) && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) setCeremony(0);
  };
  return <section className={`circuit circuit-show ${results ? 'show-results' : ''} ${ceremony !== null ? 'show-judging' : ''}`} style={themeStyle(run.event)} aria-label="Competition show">
    <header className="circuit-show-heading"><div className="circuit-show-meta"><span>{title(run.event.tier)} · {speciesName(run.event.species)} exhibition</span><span>{run.event.city} · Year {run.event.year}</span></div><div className="circuit-show-ornament" aria-hidden="true">✧ ── ✦ ── ✧</div><h1>{run.event.name}</h1><p>{run.event.venue} <span>·</span> {run.event.city}</p><div className="circuit-show-status">{results ? 'THE RESULTS ARE IN' : ceremony !== null ? 'JUDGING IN PROGRESS' : 'WELCOME TO THE EXHIBITION'}</div></header>
    <div className="circuit-show-controls"><p>{results ? 'A moment for the winners. A chapter in every animal’s story.' : ceremony !== null ? judgeNotes[ceremony] : 'Explore the exhibition tanks. When you’re ready, invite the judges.'}</p>{results ? <button onClick={() => onCommand({ type: 'close-competition' })} disabled={readOnly}>Finish show & return to circuit →</button> : ceremony !== null ? <button onClick={() => setCeremony(null)}>Skip to results</button> : <button className="circuit-primary" onClick={begin} disabled={readOnly}>✦ Invite the judges</button>}</div>
    {results && <div className="circuit-podium" aria-label="Top three winners">{[sorted[1], sorted[0], sorted[2]].filter(Boolean).map(p => <button className={`circuit-winner rank-${p.rank}`} key={p.fish.id} onClick={() => setInspected(p.fish.id)} aria-label={`Inspect ${ordinal(p.rank)} place ${p.fish.name}`}><AwardMark rank={p.rank} /><FishPortrait fish={p.fish} view="current" /><h2>{p.fish.name}</h2><span>{p.isPlayer ? 'Your animal' : p.owner}</span><strong>{p.total.toFixed(1)} <small>points</small></strong><span className="circuit-prize">{money(run.event.prizes[p.rank - 1])}</span></button>)}</div>}
    <div className="circuit-stage-layout"><div>
      <div className="circuit-section-title"><h2>{results ? 'The exhibition' : 'Meet the contenders'}</h2><span>{run.participants.length} animals · {run.participants.filter(p => p.isPlayer).length} of yours</span></div>
      <div className="circuit-exhibits">{[...run.participants].sort((a, b) => a.fish.id.localeCompare(b.fish.id)).map((p, index) => <button key={p.fish.id} className={`circuit-tank ${inspected === p.fish.id ? 'selected' : ''} ${p.isPlayer ? 'is-player' : ''}`} aria-pressed={inspected === p.fish.id} onClick={() => setInspected(p.fish.id)} style={{ '--tank-delay': `${index * .13}s` } as CSSProperties}>
        <div className="circuit-tank-top"><span>{String(index + 1).padStart(2, '0')}</span>{p.isPlayer && <b>YOUR ENTRY</b>}{results && <span>#{p.rank}</span>}</div><div className="circuit-tank-glass"><FishPortrait fish={p.fish} view="current" /><span className="circuit-tank-floor" /></div><strong>{p.fish.name}</strong><small>{p.isPlayer ? 'Your collection' : p.owner}</small>{results && <span className="circuit-tank-score">{p.total.toFixed(1)} pts</span>}
      </button>)}</div>
      <div className="circuit-judges" aria-label="Judging panel">{judgeNames.map((name, index) => <div className={`circuit-judge ${ceremony === index ? 'active' : ''} ${results || ceremony !== null && ceremony > index ? 'finished' : ''}`} key={name}><span className="circuit-judge-avatar" aria-hidden="true">{name.replace('Dr. ', '').split(' ').map(s => s[0]).join('')}</span><div><b>{name}</b><span>{judgeFields[index]}</span></div><span className="circuit-judge-state">{ceremony === index ? 'Evaluating…' : results || ceremony !== null && ceremony > index ? '✓' : 'Ready'}</span></div>)}</div>
      {ceremony !== null && <div className="circuit-judging-progress" role="status" aria-live="polite"><span style={{ width: `${(ceremony + 1) / 3 * 100}%` }} /><p>{judgeNames[ceremony]} · {judgeNotes[ceremony]}</p></div>}
    </div>{participant && <aside className="circuit-inspection" key={participant.fish.id}><ParticipantDetails {...{ participant, results }} />{results && !participant.isPlayer && <Negotiation {...{ world, onCommand, readOnly, participant }} />}</aside>}</div>
    {results && <>
      <div className="circuit-reviews">{sorted.filter(p => p.rank <= 3 || p.isPlayer).map(p => <article key={p.fish.id}><div><AwardMark rank={p.rank} small /><span><b>{p.fish.name}</b><small>{p.isPlayer ? 'Your entrant' : p.owner} · {p.total.toFixed(1)} points</small></span></div><blockquote>“{p.comment}”</blockquote></article>)}</div>
      <section className="circuit-rankings"><div className="circuit-section-title"><h2>The full scorecard</h2><button aria-expanded={showAll} onClick={() => setShowAll(value => !value)}>{showAll ? 'Hide scorecard' : `View all ${sorted.length} results`}</button></div>{showAll && <div className="circuit-table-scroll"><table><thead><tr><th>Place</th><th>Animal / exhibitor</th><th>Presentation</th><th>Pattern</th><th>Condition</th><th>Total</th></tr></thead><tbody>{sorted.map(p => <tr className={p.isPlayer ? 'is-player' : ''} key={p.fish.id}><td>{ordinal(p.rank)}</td><td><button onClick={() => setInspected(p.fish.id)}>{p.fish.name}</button><small>{p.isPlayer ? 'Your animal' : p.owner}</small></td><td>{p.scores.presentation.toFixed(1)}</td><td>{p.scores.pattern.toFixed(1)}</td><td>{p.scores.condition.toFixed(1)}</td><td><b>{p.total.toFixed(1)}</b></td></tr>)}</tbody></table></div>}<p>Each category is scored out of 100. The final score is their equal-weight average. Higher tiers have more selectively chosen opponents. Ties are resolved consistently by animal ID.</p></section>
    </>}
    <p className="circuit-footnote">Your show is saved. You can leave this page and return at any time. Results and awards remain in animal histories after the show closes.</p>
  </section>;
}

function ParticipantDetails({ participant: p, results }: { participant: CompetitionParticipant; results: boolean }) {
  const phenotype = useMemo(() => express(p.fish.genome), [p.fish.genome]);
  return <><span className="circuit-kicker">EXHIBITION PORTRAIT</span><FishPortrait fish={p.fish} large view="current" /><h2>{p.fish.name}</h2><p>{p.isPlayer ? 'Your collection' : p.owner} · {speciesName(p.fish.species)}</p><dl><div><dt>Sex / generation</dt><dd>{p.fish.sex === 'F' ? 'Female' : 'Male'} / {p.fish.generation}</dd></div><div><dt>Length</dt><dd>{p.fish.life.lengthCm.toFixed(1)} cm</dd></div><div><dt>Condition at entry</dt><dd>{Math.round(p.fish.life.condition * 100)}%</dd></div><div><dt>Age at entry</dt><dd>{p.fish.life.ageDays} days</dd></div><div><dt>Expression</dt><dd>{phenotype.species === 'axolotl' ? `${phenotype.axolotl?.pigmentation.texture ?? 'Natural'} skin` : `${phenotype.appearance.base.join(' / ')} · ${phenotype.structure.tail} tail`}</dd></div></dl>{results && <div className="circuit-detail-score"><AwardMark rank={p.rank} small /><span><b>{p.total.toFixed(1)} points</b><small>Presentation {p.scores.presentation.toFixed(1)} · Pattern {p.scores.pattern.toFixed(1)} · Condition {p.scores.condition.toFixed(1)}</small></span></div>}</>;
}

function Negotiation({ world, participant, onCommand, readOnly }: Props & { participant: CompetitionParticipant }) {
  const [amount, setAmount] = useState(String(Math.round(participant.askingPrice * .8)));
  const [tankId, setTankId] = useState(world.tanks[0]?.id ?? '');
  const [dismissed, setDismissed] = useState(false);
  const [feedback, setFeedback] = useState('');
  const { negotiation } = participant;
  const tank = world.tanks.find(t => t.id === tankId);
  const residents = world.fish.filter(f => f.status === 'living');
  const free = tank ? tank.capacity - residents.filter(f => f.tankId === tankId).length - reservedPlaces(world, tankId) : 0;
  const price = Number(amount);
  const capacityProblem = !tank ? 'Choose a destination aquarium.' : free < 1 ? 'The destination aquarium has no unreserved space.' : residents.length + reservedPlaces(world) >= MAX_LIVING ? 'Your collection has reached the living animal limit.' : world.fish.length >= MAX_RECORDS ? 'Your world has reached the record limit.' : null;
  const problem = capacityProblem ?? (!Number.isSafeInteger(price) || price <= 0 ? 'Enter a positive whole-credit offer.' : price > world.credits ? 'This offer exceeds your balance.' : null);
  const offer = (value: number) => {
    const ok = onCommand({ type: 'competition-offer', participantId: participant.fish.id, amount: value, tankId, timestamp: new Date().toISOString() });
    setFeedback(ok ? 'The owner has considered your offer.' : 'Offer could not be completed. Check your balance and destination.');
  };
  if (negotiation.status === 'purchased') return <div className="circuit-negotiation circuit-acquired"><h3>Welcome to your collection</h3><p>Purchase complete. Their identity, genome and show record travel with them.</p></div>;
  if (negotiation.status === 'declined') return <div className="circuit-negotiation"><h3>Negotiation closed</h3><p>{participant.owner} has declined further offers for this animal.</p></div>;
  return <div className="circuit-negotiation"><span className="circuit-kicker">MEET THE OWNER</span><h3>A new chapter?</h3><p>{participant.owner} is asking <strong>{money(participant.askingPrice)}</strong>.</p>{dismissed ? <button onClick={() => setDismissed(false)}>Reopen conversation</button> : <>
    {negotiation.counter !== null && <div className="circuit-counter"><b>“I could agree to {money(negotiation.counter)}.”</b><span>{participant.owner} · Counteroffer</span></div>}
    <label>Destination aquarium<select value={tankId} onChange={e => setTankId(e.target.value)}>{world.tanks.map(t => <option key={t.id} value={t.id}>{t.name} · {t.capacity - residents.filter(f => f.tankId === t.id).length - reservedPlaces(world, t.id)} free</option>)}</select></label><label>Your offer (credits)<input type="number" min="1" step="1" value={amount} onChange={e => setAmount(e.target.value)} /></label><div className="circuit-offer-actions"><button className="circuit-primary" disabled={readOnly || !!problem} onClick={() => offer(price)}>Make offer</button>{negotiation.counter !== null && <button disabled={readOnly || !!capacityProblem || negotiation.counter > world.credits} onClick={() => offer(negotiation.counter!)}>Accept {money(negotiation.counter)}</button>}<button className="quiet" onClick={() => setDismissed(true)}>Walk away</button></div><p className="circuit-offer-feedback" role="status">{problem ?? feedback ?? ''}</p><small>{negotiation.attempts} offers made · {money(world.credits)} available. An accepted offer buys the animal immediately.</small>
  </>}</div>;
}

function finishedRuns(world: World): CompetitionRun[] {
  return world.circuit.active?.phase === 'results' ? [...world.circuit.history, world.circuit.active] : world.circuit.history;
}

export function AnimalHonors({ world, fishId }: { world: World; fishId: string }) {
  const records = finishedRuns(world).flatMap(run => run.participants.filter(p => p.fish.id === fishId).map(participant => ({ run, participant })));
  if (!records.length) return <div className="circuit-animal-honors"><h3>Competition history</h3><p>No competition appearances yet.</p></div>;
  return <div className="circuit-animal-honors"><h3>Competition history <span>{records.length}</span></h3>{records.map(({ run, participant: p }) => <details key={run.event.id}><summary><AwardMark rank={p.rank} small /><span>{run.event.name}<small>{run.event.city} · Year {run.event.year} · {p.total.toFixed(1)} pts</small></span></summary><p>{p.comment}</p><small>Presentation {p.scores.presentation.toFixed(1)} · Pattern {p.scores.pattern.toFixed(1)} · Condition {p.scores.condition.toFixed(1)}</small></details>)}</div>;
}

export function TrophyRoom({ world, onInspect }: { world: World; onInspect: (fishId: string) => void }) {
  const [archive, setArchive] = useState(false);
  const [query, setQuery] = useState('');
  const [species, setSpecies] = useState('all');
  const [page, setPage] = useState(0);
  const runs = finishedRuns(world);
  const byFish = new Map<string, { run: CompetitionRun; participant: CompetitionParticipant }[]>();
  for (const run of runs) for (const participant of run.participants) { const items = byFish.get(participant.fish.id) ?? []; items.push({ run, participant }); byFish.set(participant.fish.id, items); }
  const owned = world.fish.filter(fish => (archive || fish.status === 'living') && (species === 'all' || fish.species === species) && fish.name.toLowerCase().includes(query.toLowerCase()));
  const decorated = owned.filter(fish => byFish.has(fish.id)).sort((a, b) => Math.min(...byFish.get(a.id)!.map(r => r.participant.rank)) - Math.min(...byFish.get(b.id)!.map(r => r.participant.rank)));
  const allAwards = world.fish.filter(fish => archive || fish.status === 'living').flatMap(fish => byFish.get(fish.id) ?? []);
  const pages = Math.max(1, Math.ceil(decorated.length / 18)), safePage = Math.min(page, pages - 1);
  return <section className="circuit circuit-trophy-room" aria-label="Trophy room"><header className="circuit-heading"><div><span className="circuit-kicker">THE COLLECTION’S LEGACY</span><h1>Small lives. Lasting legends.</h1><p>Every appearance remembered. Every ribbon earned.</p></div><span className="circuit-trophy-symbol" aria-hidden="true">✦</span></header><div className="circuit-trophy-stats">{[1, 2, 3].map(rank => <div key={rank}><AwardMark rank={rank} /><span><strong>{allAwards.filter(a => a.participant.rank === rank).length}</strong><small>{rank === 1 ? 'Gold medals' : rank === 2 ? 'Silver medals' : 'Bronze medals'}</small></span></div>)}<div><span><strong>{allAwards.length}</strong><small>Show appearances</small></span></div></div><div className="circuit-toolbar"><label>Find an animal<input type="search" value={query} placeholder="Search by name" onChange={e => { setQuery(e.target.value); setPage(0); }} /></label><label>Species<select value={species} onChange={e => { setSpecies(e.target.value); setPage(0); }}><option value="all">All animals</option><option value="koi">Koi</option><option value="axolotl">Axolotls</option></select></label><label className="circuit-checkbox"><input type="checkbox" checked={archive} onChange={e => { setArchive(e.target.checked); setPage(0); }} /> Include sold & rehomed animals</label></div>
    {!decorated.length && <div className="circuit-empty"><span aria-hidden="true">✧</span><h2>Your first ribbon is waiting.</h2><p>{query ? 'No competition records match your search.' : 'Enter a show from Competitions. Every finish joins this collection, with or without a medal.'}</p></div>}
    <div className="circuit-trophy-grid">{decorated.slice(safePage * 18, safePage * 18 + 18).map(fish => { const entries = byFish.get(fish.id)!; const best = Math.min(...entries.map(e => e.participant.rank)); return <article className="circuit-trophy-card" key={fish.id}><div className="circuit-trophy-portrait"><FishPortrait fish={fish} view="current" /><AwardMark rank={best} /></div><button className="circuit-name-link" onClick={() => onInspect(fish.id)}>{fish.name} ↗</button><p>{speciesName(fish.species)} · {fish.status === 'living' ? 'In your collection' : title(fish.status)} · {entries.length} appearances</p><AnimalHonors world={world} fishId={fish.id} /></article>; })}</div>{pages > 1 && <div className="circuit-pagination"><button disabled={!safePage} onClick={() => setPage(safePage - 1)}>Previous</button><span>{safePage + 1} / {pages}</span><button disabled={safePage + 1 === pages} onClick={() => setPage(safePage + 1)}>Next</button></div>}
  </section>;
}
