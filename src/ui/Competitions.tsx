import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { courtingClutchOf, reservedPlaces } from '../core/breeding';
import { circuitCareer, entrantReputation, finishedRuns, LICENCE_REPUTATION, licenceLevel, milestones, projectEntry, recommendations, reputationOf, rivals, tierUnlocked, titleOf, type Projection } from '../core/circuitCareer';
import { calendarLabel, COMPETITION_TIERS, competitionSchedule, competitionScores, eligibility, type CompetitionEvent, type CompetitionParticipant, type CompetitionRun, type CompetitionTier } from '../core/competitions';
import { AWARDS, BRIEFS, exhibitLabel, INCIDENTS, scoreField, showFormat, TACTIC_IDS, TACTICS, weightedTotal, type IncidentId, type Scores, type TacticId } from '../core/tournament';
import type { Fish, Species, World } from '../core/types';
import { MAX_LIVING, MAX_RECORDS, type Command } from '../core/world';
import { FishPortrait } from './FishPortrait';
import { Icon, type IconName } from './Icon';
import './competitions.css';
import './tournament.css';

type Props = { world: World; onCommand: (command: Command) => boolean; readOnly: boolean };
const title = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
const money = (amount: number) => `◈ ${amount.toLocaleString('en')}`;
const SPECIES: Species[] = ['koi', 'goldfish', 'guppy', 'axolotl'];
const speciesName = (species: Species, plural = false) => ({ koi: 'Koi', goldfish: 'Goldfish', guppy: plural ? 'Guppies' : 'Guppy', axolotl: plural ? 'Axolotls' : 'Axolotl' })[species];
const ordinal = (rank: number) => rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`;
const themeStyle = (event: CompetitionEvent) => ({ '--show-hue': `${[170, 203, 265, 26, 145, 325][event.theme % 6]}` }) as CSSProperties;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const CRITERIA = ['presentation', 'pattern', 'condition'] as const;
const CRITERION_LABEL: Record<keyof Scores, string> = { presentation: 'Presentation', pattern: 'Pattern', condition: 'Condition' };
const BRIEF_ICON: Record<string, IconName> = { classic: 'scale', form: 'fish', colour: 'brush', keepers: 'heart' };
const INCIDENT_ICON: Record<IncidentId, IconName> = { calm: 'leaf', heatwave: 'thermo', flicker: 'sun', crowd: 'bell', 'guest-judge': 'eye', delay: 'clock' };
const TACTIC_ICON: Record<TacticId, IconName> = { acclimate: 'drop', lighting: 'sun', spotlight: 'sparkles' };
const BAND: Record<Projection['band'], string> = { podium: 'Podium contender', contender: 'In contention', outsider: 'Long shot' };
const signed = (n: number) => n > 0 ? `+${n.toFixed(1)}` : n < 0 ? `−${Math.abs(n).toFixed(1)}` : '±0';
const baseOf = (p: CompetitionParticipant): Scores => ({ presentation: p.scores.presentation - (p.adjust?.presentation ?? 0), pattern: p.scores.pattern - (p.adjust?.pattern ?? 0), condition: p.scores.condition - (p.adjust?.condition ?? 0) });

function Lock() { return <svg className="circuit-lock" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11V8a5 5 0 0 1 10 0v3M5.5 11h13v9.5h-13z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>; }
function Chip({ icon, children, tone }: { icon?: IconName; children: ReactNode; tone?: 'brass' | 'lume' | 'rose' | 'quiet' }) {
  return <span className={`circuit-chip ${tone ?? ''}`}>{icon && <Icon name={icon} size={13} />}{children}</span>;
}
function AwardMark({ rank, small = false }: { rank: number; small?: boolean }) {
  return <span className={`circuit-medal rank-${Math.min(rank, 4)} ${small ? 'small' : ''}`} aria-label={rank <= 3 ? `${ordinal(rank)} place medal` : `${ordinal(rank)} place`}>
    <svg viewBox="0 0 48 54" aria-hidden="true"><path d="m13 30-3 21 14-7 14 7-3-21" fill="currentColor" opacity=".45" /><circle cx="24" cy="22" r="17" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="24" cy="22" r="13" fill="currentColor" opacity=".13" /><path d="m24 10 3.4 7 7.6 1.1-5.5 5.4 1.3 7.5-6.8-3.6-6.8 3.6 1.3-7.5-5.5-5.4 7.6-1.1Z" fill="currentColor" /></svg>
    <b>{ordinal(rank)}</b>
  </span>;
}
function Steps({ step }: { step: 1 | 2 | 3 | 4 }) {
  return <ol className="circuit-steps" aria-label="Show progress">{['Choose entrants', 'Prepare', 'Show day', 'Results'].map((label, index) => <li key={label} className={index + 1 < step ? 'done' : index + 1 === step ? 'current' : ''} aria-current={index + 1 === step ? 'step' : undefined}><span>{index + 1 < step ? <Icon name="check" size={12} /> : index + 1}</span>{label}</li>)}</ol>;
}
function ScoreBars({ scores, brief, compact = false }: { scores: Scores; brief: keyof typeof BRIEFS; compact?: boolean }) {
  const focus = BRIEFS[brief].focus;
  return <div className={`circuit-bars ${compact ? 'compact' : ''}`}>{CRITERIA.map((key, i) => <div key={key} className={focus === key ? 'focus' : ''}>
    <span>{compact ? CRITERION_LABEL[key].slice(0, 4) : CRITERION_LABEL[key]}<small>×{Math.round(BRIEFS[brief].weights[i] * 100)}%</small></span>
    <i><b style={{ width: `${scores[key]}%` }} /></i><em>{scores[key].toFixed(1)}</em>
  </div>)}</div>;
}

// ───────────────────────────── Circuit board ─────────────────────────────
export function Competitions({ world, onCommand, readOnly }: Props) {
  const [chosen, setChosen] = useState<{ event: CompetitionEvent; fishIds: string[] } | null>(null);
  const [species, setSpecies] = useState<'all' | Species>('all');
  const [tier, setTier] = useState<'all' | CompetitionTier>('all');
  const day = world.circuit.day;
  const schedule = useMemo(() => competitionSchedule(world.seed, day), [world.seed, day]);
  const career = useMemo(() => circuitCareer(world), [world]);
  const recs = useMemo(() => recommendations(world, schedule), [world, schedule]);
  if (world.circuit.active) return <CompetitionStage key={world.circuit.active.event.id} {...{ world, onCommand, readOnly }} run={world.circuit.active} />;
  if (chosen) return <CompetitionEntry key={chosen.event.id} {...{ world, readOnly }} event={chosen.event} initial={chosen.fishIds} onBack={() => setChosen(null)} onCommand={command => { const ok = onCommand(command); if (ok) setChosen(null); return ok; }} />;
  const completed = new Set(world.circuit.history.map(run => run.event.id));
  const recByEvent = new Map(recs.map(r => [r.event.id, r]));
  const events = schedule.filter(event => (species === 'all' || event.species === species) && (tier === 'all' || event.tier === tier))
    .sort((a, b) => Number(tierUnlocked(world, b.tier)) - Number(tierUnlocked(world, a.tier)) || COMPETITION_TIERS.indexOf(a.tier) - COMPETITION_TIERS.indexOf(b.tier) || SPECIES.indexOf(a.species) - SPECIES.indexOf(b.species));
  const windowEnd = schedule[0].closesDay;
  return <section className="circuit" aria-label="Competitions">
    <header className="circuit-heading"><div><span className="circuit-kicker">THE AQUATIC CIRCUIT · YEAR {career.season.year}</span><h1>Make your name on the circuit.</h1><p>Read each show's brief, pick the animal it rewards, prepare for show day and climb from amateur halls to the Global stage.</p></div>
      <div className="circuit-window-card"><Icon name="calendar" size={16} /><span><b>{calendarLabel(day)}</b><small>{windowEnd - day} {windowEnd - day === 1 ? 'day' : 'days'} left in this entry window</small></span></div></header>
    <CareerStrip career={career} />
    {recs.length > 0 && <section className="circuit-recs" aria-label="Recommended for you"><div className="circuit-section-title"><h2><Icon name="sparkles" size={16} /> Recommended for your collection</h2><span>Estimates from typical fields · show day decides</span></div>
      <div className="circuit-rec-grid">{recs.slice(0, 3).map(rec => { const fmt = showFormat(world.seed, rec.event); return <article key={rec.event.id} className={`circuit-rec band-${rec.projection.band}`} style={themeStyle(rec.event)}>
        <div className="circuit-rec-portrait"><FishPortrait fish={rec.fish} view="current" /></div>
        <div className="circuit-rec-body"><span className="circuit-kicker">{title(rec.event.tier)} · {speciesName(rec.event.species)}</span><h3>{rec.event.name}</h3>
          <p><b>{rec.fish.name}</b> · {exhibitLabel(rec.fish)}</p>
          <div className="circuit-chip-row"><Chip icon={BRIEF_ICON[fmt.brief]} tone="brass">{BRIEFS[fmt.brief].name}</Chip><Chip tone={rec.projection.band === 'podium' ? 'lume' : 'quiet'}>{BAND[rec.projection.band]} · est. {ordinal(rec.projection.low)}–{ordinal(rec.projection.high)}</Chip></div>
          <button className="circuit-primary" disabled={readOnly} onClick={() => setChosen({ event: rec.event, fishIds: [rec.fish.id] })}>Enter {rec.fish.name} <Icon name="chevron" size={14} /></button></div>
      </article>; })}</div></section>}
    <div className="circuit-toolbar">
      <div className="circuit-tiers" role="tablist" aria-label="Competition level">{(['all', ...COMPETITION_TIERS] as const).map(value => { const locked = value !== 'all' && !tierUnlocked(world, value); return <button key={value} role="tab" aria-selected={tier === value} onClick={() => setTier(value)} className={locked ? 'locked' : ''} title={locked ? `${title(value)} licence: ${LICENCE_REPUTATION[COMPETITION_TIERS.indexOf(value)]} reputation` : undefined}>{locked && <Lock />}{value === 'all' ? 'All levels' : title(value)}</button>; })}</div>
      <div className="circuit-segments" aria-label="Competition species">{(['all', ...SPECIES] as const).map(value => <button key={value} aria-pressed={species === value} onClick={() => setSpecies(value)}>{value === 'all' ? 'All animals' : speciesName(value, true)}</button>)}</div>
    </div>
    <div className="circuit-event-grid">{events.map(event => <EventCard key={event.id} world={world} event={event} done={completed.has(event.id)} rec={recByEvent.get(event.id)} readOnly={readOnly} onEnter={() => setChosen({ event, fishIds: [] })} />)}</div>
    {!events.length && <p className="circuit-empty">No shows match these filters. Try another species or level.</p>}
    <p className="circuit-footnote">A local circuit of NPC breeders. Judging uses each animal's visible traits and saved condition under the show's published brief; it is not an official breed standard. Projections compare your animal with sampled typical fields, not the real field.</p>
  </section>;
}

function CareerStrip({ career }: { career: ReturnType<typeof circuitCareer> }) {
  const tier = COMPETITION_TIERS[career.licence];
  return <section className="circuit-career" aria-label="Your circuit career">
    <div className="circuit-licence"><span className={`circuit-licence-badge tier-${tier}`}><Icon name="crown" size={18} /></span><span><small>LICENCE</small><b>{title(tier)}</b></span></div>
    <div className="circuit-rep"><div><small>REPUTATION</small><b>{career.reputation}</b>{career.next && <span>{career.next.need - career.reputation} to {title(career.next.tier)}</span>}</div>
      <div className="circuit-progress" role="progressbar" aria-label="Progress to next licence" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(career.progress * 100)}><i style={{ width: `${career.progress * 100}%` }} /></div></div>
    <div className="circuit-season"><small>SEASON {career.season.year}</small><span><AwardMark rank={1} small /><b>{career.season.gold}</b></span><span><AwardMark rank={2} small /><b>{career.season.silver}</b></span><span><AwardMark rank={3} small /><b>{career.season.bronze}</b></span></div>
    <div className="circuit-rival"><small>RIVAL</small>{career.rival ? <><b>{career.rival.keeper}</b><span>You {career.rival.wins} – {career.rival.losses} them</span></> : <span>No rival yet. Beat the field and someone will notice.</span>}</div>
  </section>;
}

function EventCard({ world, event, done, rec, readOnly, onEnter }: { world: World; event: CompetitionEvent; done: boolean; rec?: ReturnType<typeof recommendations>[number]; readOnly: boolean; onEnter: () => void }) {
  const fmt = showFormat(world.seed, event), unlocked = tierUnlocked(world, event.tier), day = world.circuit.day;
  const level = COMPETITION_TIERS.indexOf(event.tier), need = LICENCE_REPUTATION[level];
  const owned = world.fish.filter(f => f.status === 'living' && f.species === event.species).length;
  return <article className={`circuit-event tier-${event.tier} ${unlocked ? '' : 'is-locked'} ${done ? 'is-done' : ''}`} style={themeStyle(event)}>
    <div className="circuit-event-top"><span className="circuit-badge">{!unlocked && <Lock />}{title(event.tier)}</span><span>{speciesName(event.species)}</span></div>
    <h2>{event.name}</h2><p className="circuit-location">{event.city} <span>· {event.venue}</span></p>
    <div className="circuit-chip-row"><Chip icon={BRIEF_ICON[fmt.brief]} tone="brass">{BRIEFS[fmt.brief].name}</Chip><Chip icon="crown">{AWARDS[fmt.award].name}</Chip><Chip icon={INCIDENT_ICON[fmt.incident]} tone={fmt.incident === 'calm' ? 'quiet' : 'rose'}>{fmt.incident === 'calm' ? 'Calm forecast' : `Forecast: ${INCIDENTS[fmt.incident].name.toLowerCase()}`}</Chip></div>
    <dl className="circuit-event-stats"><div><dt>Entry</dt><dd>{money(event.fee)}</dd></div><div><dt>1st prize</dt><dd className="gold">{money(event.prizes[0])}</dd></div><div><dt>Your {speciesName(event.species, true).toLowerCase()}</dt><dd>{owned}</dd></div></dl>
    <p className="circuit-event-hint">{done ? 'Entered this edition · results in the trophy room' : !unlocked ? `${title(event.tier)} licence needs ${need} reputation` : rec ? <><b>{rec.fish.name}</b> · {BAND[rec.projection.band].toLowerCase()}, est. {ordinal(rec.projection.low)}–{ordinal(rec.projection.high)}</> : owned ? 'No eligible adults yet (adult, 70%+ condition)' : `No ${speciesName(event.species, true).toLowerCase()} in your collection`}</p>
    <button className={unlocked && !done && rec ? 'circuit-primary' : ''} disabled={!unlocked || done || readOnly || day >= event.closesDay} onClick={onEnter}>{done ? 'Completed' : !unlocked ? 'Locked' : 'Choose entrants'}</button>
  </article>;
}

// ───────────────────────────── Entry ─────────────────────────────
function CompetitionEntry({ world, event, onCommand, readOnly, onBack, initial }: Props & { event: CompetitionEvent; onBack: () => void; initial: string[] }) {
  const [selected, setSelected] = useState<string[]>(initial);
  const [query, setQuery] = useState('');
  const [tank, setTank] = useState('all');
  const [sort, setSort] = useState<'fit' | 'condition' | 'name'>('fit');
  const [eligibleOnly, setEligibleOnly] = useState(true);
  const [page, setPage] = useState(0);
  const fmt = useMemo(() => showFormat(world.seed, event), [world.seed, event]);
  const genesis = world.shop.model >= 3;
  const animals = useMemo(() => world.fish.filter(fish => fish.status === 'living' && fish.species === event.species).map(fish => {
    const problem = eligibility(fish, event) ?? (courtingClutchOf(world, fish.id) ? 'Courting — finish the courtship first.' : null);
    return { fish, problem, scores: competitionScores(fish, event), projection: problem ? null : projectEntry(world.seed, event, fish, genesis, fmt.brief) };
  }), [world, event, fmt.brief, genesis]);
  const filtered = animals.filter(({ fish, problem }) => (!eligibleOnly || !problem) && (tank === 'all' || fish.tankId === tank) && `${fish.name} ${fish.id}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => sort === 'name' ? a.fish.name.localeCompare(b.fish.name) : sort === 'condition' ? b.fish.life.condition - a.fish.life.condition
      : Number(!!a.problem) - Number(!!b.problem) || weightedTotal(b.scores, fmt.brief) - weightedTotal(a.scores, fmt.brief));
  const pages = Math.max(1, Math.ceil(filtered.length / 18)), safePage = Math.min(page, pages - 1);
  const fee = event.fee * selected.length, level = COMPETITION_TIERS.indexOf(event.tier);
  const open = world.circuit.day >= event.opensDay && world.circuit.day < event.closesDay;
  const problem = !open ? 'This show has closed. Return to the circuit for the current schedule.' : !tierUnlocked(world, event.tier) ? `You need a ${event.tier} licence.` : !selected.length ? 'Choose one or two eligible animals.' : fee > world.credits ? `You need ${money(fee - world.credits)} more to enter.` : selected.some(id => !animals.some(a => a.fish.id === id && !a.problem)) ? 'An entrant is no longer eligible. Update your selection.' : null;
  const reps = [3, 2, 1.5].map(f => Math.round([4, 6, 10, 16, 24, 36][level] * f));
  return <section className="circuit" aria-label="Choose competition entrants" style={themeStyle(event)}>
    <button className="circuit-back" onClick={onBack}><Icon name="chevron" size={14} className="flip" /> All competitions</button>
    <Steps step={1} />
    <header className="circuit-heading compact"><div><span className="circuit-kicker">{event.city} · {event.venue} · {title(event.tier)} · {speciesName(event.species)}</span><h1>{event.name}</h1>
      <div className="circuit-chip-row"><Chip icon={BRIEF_ICON[fmt.brief]} tone="brass">{BRIEFS[fmt.brief].name}: {BRIEFS[fmt.brief].blurb}</Chip><Chip icon="crown">{AWARDS[fmt.award].name}: {AWARDS[fmt.award].blurb.toLowerCase()}</Chip><Chip icon={INCIDENT_ICON[fmt.incident]} tone={fmt.incident === 'calm' ? 'quiet' : 'rose'}>Forecast: {INCIDENTS[fmt.incident].name}</Chip></div></div></header>
    <div className="circuit-entry-layout"><div>
      <div className="circuit-filters"><label>Search<input type="search" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} placeholder="Name or ID" /></label><label>Aquarium<select value={tank} onChange={e => { setTank(e.target.value); setPage(0); }}><option value="all">All aquariums</option>{world.tanks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>Sort by<select value={sort} onChange={e => setSort(e.target.value as typeof sort)}><option value="fit">Best fit</option><option value="condition">Condition</option><option value="name">Name</option></select></label></div>
      <label className="circuit-checkbox"><input type="checkbox" checked={eligibleOnly} onChange={e => { setEligibleOnly(e.target.checked); setPage(0); }} /> Eligible animals only <span>{filtered.length} of {animals.length}</span></label>
      <div className="circuit-entrant-grid">{filtered.slice(safePage * 18, safePage * 18 + 18).map(({ fish, problem: blocker, scores, projection }) => {
        const picked = selected.includes(fish.id);
        return <button key={fish.id} className={`circuit-entrant ${picked ? 'selected' : ''}`} aria-pressed={picked} disabled={!!blocker || (!picked && selected.length >= 2)} onClick={() => setSelected(ids => picked ? ids.filter(id => id !== fish.id) : [...ids, fish.id])}>
          <span className="circuit-selection-check" aria-hidden="true">{picked ? <Icon name="check" size={13} /> : <Icon name="plus" size={13} />}</span><FishPortrait fish={fish} view="current" />
          <strong>{fish.name}</strong><span>{exhibitLabel(fish)} · {fish.sex === 'F' ? '♀' : '♂'} · {fish.life.lengthCm.toFixed(1)} cm</span>
          {blocker ? <small className="circuit-warning"><Icon name="alert" size={12} /> {blocker}</small> : <>
            <ScoreBars scores={scores} brief={fmt.brief} compact />
            <span className={`circuit-band band-${projection!.band}`}><b>{weightedTotal(scores, fmt.brief).toFixed(1)}</b> {BAND[projection!.band]} · est. {ordinal(projection!.low)}–{ordinal(projection!.high)}</span></>}
        </button>;
      })}</div>{!filtered.length && <p className="circuit-empty">No animals match. {animals.length ? 'Clear a filter to see your whole collection.' : `Add ${speciesName(event.species, true).toLowerCase()} to your collection to enter this show.`}</p>}
      {pages > 1 && <div className="circuit-pagination"><button disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>Previous</button><span>{safePage + 1} / {pages}</span><button disabled={safePage + 1 === pages} onClick={() => setPage(safePage + 1)}>Next</button></div>}
    </div><aside className="circuit-entry-summary"><span className="circuit-kicker">YOUR ENTRY</span><h2>{selected.length ? `${selected.length} of 2 chosen` : 'Pick up to two'}</h2>
      <div className="circuit-chosen">{selected.length ? selected.map(id => { const fish = world.fish.find(f => f.id === id); return fish && <div key={id}><FishPortrait fish={fish} view="current" /><span>{fish.name}</span><button aria-label={`Remove ${fish.name}`} onClick={() => setSelected(ids => ids.filter(value => value !== id))}><Icon name="close" size={12} /></button></div>; }) : <p>Sorted by projected fit for the {BRIEFS[fmt.brief].name} brief. Highlighted bars carry the most weight.</p>}</div>
      <dl><div><dt>Fee per animal</dt><dd>{money(event.fee)}</dd></div><div><dt>Total entry</dt><dd>{money(fee)}</dd></div><div><dt>Your balance</dt><dd>{money(world.credits)}</dd></div></dl>
      <button className="circuit-primary" disabled={readOnly || !!problem} onClick={() => onCommand({ type: 'enter-competition', eventId: event.id, fishIds: selected, format: 2 })}>Pay &amp; go to the hall</button>
      <p role="status">{problem ?? 'Entry is final. Your animals stay home; the show records their appearance and condition today.'}</p>
      <div className="circuit-prize-list"><span className="circuit-kicker">PRIZES PER ANIMAL</span>{event.prizes.map((prize, index) => <span key={index}><AwardMark rank={index + 1} small /> {money(prize)} <small>+{reps[index]} rep</small></span>)}<span><Icon name="crown" size={16} /> {AWARDS[fmt.award].name} · {money(event.fee)} <small>+{[4, 6, 10, 16, 24, 36][level]} rep</small></span></div>
    </aside></div>
  </section>;
}

// ───────────────────────────── Hall, show day and results ─────────────────────────────
function CompetitionStage({ world, run, onCommand, readOnly }: Props & { run: CompetitionRun }) {
  const show = run.show, brief = show?.brief ?? 'classic';
  const [inspected, setInspected] = useState(run.participants.find(p => p.isPlayer)?.fish.id ?? run.participants[0]?.fish.id);
  const [tactic, setTactic] = useState<TacticId | null>(null);
  const [ceremony, setCeremony] = useState<number | null>(null);
  useEffect(() => {
    if (ceremony === null) return;
    const timer = window.setTimeout(() => setCeremony(value => value === null || value >= 4 ? null : value + 1), ceremony >= 3 ? 2300 : 1700);
    return () => window.clearTimeout(timer);
  }, [ceremony]);
  const results = run.phase === 'results' && ceremony === null;
  const rivalNames = useMemo(() => new Set(rivals(finishedRuns(world).filter(r => r !== run)).filter(r => r.losses > 0).slice(0, 2).map(r => r.keeper)), [world, run]);
  const participant = run.participants.find(p => p.fish.id === inspected) ?? run.participants[0];
  const begin = () => {
    if (show && !tactic) return;
    if (onCommand(show ? { type: 'judge-competition', tactic: tactic! } : { type: 'judge-competition' }) && !reducedMotion()) setCeremony(0);
  };
  const exhibits = [...run.participants].sort((a, b) => a.fish.id.localeCompare(b.fish.id));
  return <section className={`circuit circuit-show ${results ? 'show-results' : ''}`} style={themeStyle(run.event)} aria-label="Competition show">
    <Steps step={results ? 4 : ceremony !== null ? 3 : 2} />
    <header className="circuit-show-heading"><div className="circuit-show-meta"><span>{title(run.event.tier)} · {speciesName(run.event.species)} exhibition</span><span>{run.event.city} · Year {run.event.year}</span></div><div className="circuit-show-ornament" aria-hidden="true">✧ ── ✦ ── ✧</div><h1>{run.event.name}</h1><p>{run.event.venue} <span>·</span> {run.event.city}</p>
      {show && <div className="circuit-chip-row center"><Chip icon={BRIEF_ICON[brief]} tone="brass">{BRIEFS[brief].name}</Chip><Chip icon="crown">{AWARDS[show.award].name}</Chip></div>}</header>
    {ceremony !== null ? <Ceremony run={run} stage={ceremony} onSkip={() => setCeremony(null)} />
      : results ? <Results {...{ world, run, onCommand, readOnly, participant, setInspected }} />
      : <>
        {show && <section className="circuit-prep" aria-label="Show-day preparation">
          <div className={`circuit-bulletin incident-${show.incident}`}><span className="circuit-bulletin-icon"><Icon name={INCIDENT_ICON[show.incident]} size={22} /></span><div><span className="circuit-kicker">SHOW-DAY BULLETIN</span><h2>{INCIDENTS[show.incident].name}</h2><p>{INCIDENTS[show.incident].blurb}</p>{INCIDENTS[show.incident].counter && <p className="circuit-counter-hint"><Icon name="info" size={13} /> {INCIDENTS[show.incident].counter}</p>}</div></div>
          <div className="circuit-section-title"><h2>Choose your preparation</h2><span>Applies to your entrants only · exact effect shown</span></div>
          <TacticPicker run={run} value={tactic} onChange={setTactic} />
        </section>}
        <div className="circuit-show-controls"><p>{show ? (tactic ? `Ready: ${TACTICS[tactic].name}. The panel will judge ${BRIEFS[brief].name.toLowerCase()} — ${BRIEFS[brief].blurb.toLowerCase()}` : 'Read the bulletin, choose a preparation, then invite the judges.') : 'Explore the exhibition tanks. When you are ready, invite the judges.'}</p>
          <button className="circuit-primary" onClick={begin} disabled={readOnly || (!!show && !tactic)}><Icon name="sparkles" size={15} /> Invite the judges</button></div>
        <div className="circuit-stage-layout"><div>
          <div className="circuit-section-title"><h2>Meet the field</h2><span>{run.participants.length} exhibits · {run.participants.filter(p => p.isPlayer).length} yours</span></div>
          <div className="circuit-exhibits">{exhibits.map((p, index) => <button key={p.fish.id} className={`circuit-tank ${inspected === p.fish.id ? 'selected' : ''} ${p.isPlayer ? 'is-player' : ''}`} aria-pressed={inspected === p.fish.id} onClick={() => setInspected(p.fish.id)} style={{ '--tank-delay': `${index * .06}s` } as CSSProperties}>
            <div className="circuit-tank-top"><span>{String(index + 1).padStart(2, '0')}</span>{p.isPlayer ? <b>YOURS</b> : rivalNames.has(p.owner) ? <b className="rival">RIVAL</b> : null}</div><div className="circuit-tank-glass"><FishPortrait fish={p.fish} view="current" /><span className="circuit-tank-floor" /></div><strong>{p.fish.name}</strong><small>{p.isPlayer ? 'Your collection' : p.owner}</small>
          </button>)}</div>
        </div>{participant && <aside className="circuit-inspection" key={participant.fish.id}><ParticipantDetails participant={participant} results={false} brief={brief} /></aside>}</div>
      </>}
    <p className="circuit-footnote">Your show is saved. Leave and return at any time; reloading never changes a result. Judging uses visible traits and saved condition only.</p>
  </section>;
}

function TacticPicker({ run, value, onChange }: { run: CompetitionRun; value: TacticId | null; onChange: (tactic: TacticId) => void }) {
  const show = run.show!;
  const previews = useMemo(() => Object.fromEntries(TACTIC_IDS.map(tactic => {
    const field = scoreField(run.event, show, run.participants.map(p => ({ fish: p.fish, isPlayer: p.isPlayer, owner: p.owner })), tactic);
    return [tactic, field.filter(e => e.isPlayer).sort((a, b) => a.fish.id.localeCompare(b.fish.id))];
  })) as Record<TacticId, ReturnType<typeof scoreField>>, [run, show]);
  return <div className="circuit-tactics" role="radiogroup" aria-label="Show-day preparation">{TACTIC_IDS.map(tactic => <button key={tactic} role="radio" aria-checked={value === tactic} className={`circuit-tactic ${value === tactic ? 'selected' : ''}`} onClick={() => onChange(tactic)}>
    <span className="circuit-tactic-icon"><Icon name={TACTIC_ICON[tactic]} size={20} /></span><strong>{TACTICS[tactic].name}</strong><p>{TACTICS[tactic].blurb}</p>
    <ul>{previews[tactic].map(entry => { const sum = entry.adjust.presentation + entry.adjust.pattern + entry.adjust.condition; return <li key={entry.fish.id}><span>{entry.fish.name}</span><b className={sum > 0 ? 'up' : sum < 0 ? 'down' : ''}>{CRITERIA.filter(k => entry.adjust[k]).map(k => `${signed(entry.adjust[k])} ${CRITERION_LABEL[k].slice(0, 4).toLowerCase()}`).join(' · ') || (entry.notes.some(n => /kept|beat|calmed|settled/.test(n)) ? 'shielded from the incident' : 'no change')}</b></li>; })}</ul>
  </button>)}</div>;
}

/** Presents the saved result round by round: three criteria, then show-day effects, then the podium. */
function Ceremony({ run, stage, onSkip }: { run: CompetitionRun; stage: number; onSkip: () => void }) {
  const brief = run.show?.brief ?? 'classic', w = BRIEFS[brief].weights;
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { ref.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, []);
  const rows = run.participants.map(p => {
    const b = baseOf(p);
    const partial = stage === 0 ? b.presentation * w[0] : stage === 1 ? b.presentation * w[0] + b.pattern * w[1] : stage === 2 ? weightedTotal(b, brief) : p.total;
    return { p, b, partial: Math.round(partial * 10) / 10, shift: Math.round((p.total - weightedTotal(b, brief)) * 10) / 10 };
  }).sort((x, y) => y.partial - x.partial || x.p.fish.id.localeCompare(y.p.fish.id));
  const stages = ['Presentation round', 'Pattern round', 'Condition round', run.show ? `Show day: ${INCIDENTS[run.show.incident].name}` : 'Final tally', 'The podium'];
  const notes = ['Silhouette, balance and finnage under the lights…', 'Pigment, markings and ornament, exhibit by exhibit…', 'Growth and developmental condition on the day…', run.show ? 'Incident and preparation effects are applied to every card…' : 'Adding up the cards…', 'And the winners are…'];
  return <section className="circuit-ceremony" aria-live="polite" ref={ref}>
    <div className="circuit-ceremony-head"><div><span className="circuit-kicker">ROUND {Math.min(stage + 1, 5)} OF 5</span><h2>{stages[stage]}</h2><p>{notes[stage]}</p></div><button onClick={onSkip}>Skip to results</button></div>
    <div className="circuit-ceremony-progress"><i style={{ width: `${(stage + 1) / 5 * 100}%` }} /></div>
    <ol className="circuit-board" style={{ height: rows.length * 52 }}>{rows.map((row, index) => <li key={row.p.fish.id} className={`${row.p.isPlayer ? 'is-player' : ''} ${stage === 4 && index < 3 ? `podium rank-${index + 1}` : ''}`} style={{ transform: `translateY(${index * 52}px)` }}>
      <span className="circuit-board-rank">{index + 1}</span><span className="circuit-board-name"><b>{row.p.fish.name}</b><small>{row.p.isPlayer ? 'Your entry' : row.p.owner}</small></span>
      {stage >= 3 && row.shift !== 0 && <span className={`circuit-delta ${row.shift > 0 ? 'up' : 'down'}`}>{signed(row.shift)}</span>}
      <span className="circuit-board-bar"><i style={{ width: `${row.partial}%` }} /></span><span className="circuit-board-score">{row.partial.toFixed(1)}</span>
    </li>)}</ol>
  </section>;
}

function Results({ world, run, onCommand, readOnly, participant, setInspected }: Props & { run: CompetitionRun; participant: CompetitionParticipant; setInspected: (id: string) => void }) {
  const [showAll, setShowAll] = useState(true);
  const show = run.show, brief = show?.brief ?? 'classic';
  const sorted = [...run.participants].sort((a, b) => a.rank - b.rank);
  const finished = finishedRuns(world), before = finished.filter(r => r !== run);
  const repBefore = reputationOf(before), repAfter = reputationOf(finished);
  const allRuns = [...world.circuit.history, ...(world.circuit.active ? [world.circuit.active] : [])];
  const licBefore = licenceLevel(repBefore, before), licAfter = licenceLevel(repAfter, allRuns);
  const doneBefore = new Set(milestones(before, repBefore).filter(m => m.done).map(m => m.id));
  const newMilestones = milestones(finished, repAfter).filter(m => m.done && !doneBefore.has(m.id));
  const mine = sorted.filter(p => p.isPlayer);
  const winner = show?.awardWinner ? run.participants.find(p => p.fish.id === show.awardWinner) : undefined;
  return <>
    <section className="circuit-your-show" aria-label="Your result"><div className="circuit-section-title"><h2>Your show</h2><span>{repAfter - repBefore > 0 ? `+${repAfter - repBefore} reputation` : 'Reputation unchanged'}</span></div>
      <div className="circuit-your-grid">{mine.map(p => { const prize = p.rank <= 3 ? run.event.prizes[p.rank - 1] : 0, award = show?.awardWinner === p.fish.id; const t = titleOf(finished, p.fish.id), tPrev = titleOf(before, p.fish.id);
        return <article key={p.fish.id} className={`circuit-your-card rank-${Math.min(p.rank, 4)}`}><AwardMark rank={p.rank} /><FishPortrait fish={p.fish} view="current" /><div><h3>{p.fish.name}</h3><p>{ordinal(p.rank)} of {run.participants.length} · {p.total.toFixed(1)} points</p>
          <div className="circuit-chip-row">{prize > 0 && <Chip icon="coins" tone="brass">{money(prize)}</Chip>}{award && <Chip icon="crown" tone="brass">{AWARDS[show!.award].name} · {money(run.event.fee)}</Chip>}<Chip icon="star" tone="lume">+{entrantReputation(run, p)} rep</Chip>{t && t !== tPrev && <Chip icon="medal" tone="lume">New title: {t}</Chip>}</div></div></article>; })}</div>
      <div className="circuit-rep-change"><div><small>LICENCE</small><b>{title(COMPETITION_TIERS[licAfter])}</b>{licAfter > licBefore && <span className="circuit-unlock"><Icon name="sparkles" size={13} /> Licence unlocked!</span>}</div>
        <div className="circuit-progress large"><i className="before" style={{ width: `${Math.min(100, repBefore / (LICENCE_REPUTATION[Math.min(5, licAfter + 1)] || 1) * 100)}%` }} /><i style={{ width: `${Math.min(100, repAfter / (LICENCE_REPUTATION[Math.min(5, licAfter + 1)] || 1) * 100)}%` }} /></div>
        <span>{repAfter} reputation{licAfter < 5 ? ` · ${LICENCE_REPUTATION[licAfter + 1]} for ${title(COMPETITION_TIERS[licAfter + 1])}` : ' · every licence earned'}</span></div>
      {newMilestones.length > 0 && <div className="circuit-new-milestones">{newMilestones.map(m => <span key={m.id}><Icon name="star" size={14} filled /> <b>{m.name}</b> {m.detail}</span>)}</div>}
      <div className="circuit-results-cta"><button className="circuit-primary" onClick={() => onCommand({ type: 'close-competition' })} disabled={readOnly}>Finish show &amp; return to the circuit <Icon name="chevron" size={14} /></button><span>Want a rival's animal? Make an offer before you leave.</span></div>
    </section>
    <div className="circuit-podium" aria-label="Top three winners">{[sorted[1], sorted[0], sorted[2]].filter(Boolean).map(p => <button className={`circuit-winner rank-${p.rank}`} key={p.fish.id} onClick={() => setInspected(p.fish.id)} aria-label={`Inspect ${ordinal(p.rank)} place ${p.fish.name}`}><AwardMark rank={p.rank} /><FishPortrait fish={p.fish} view="current" /><h2>{p.fish.name}</h2><span>{p.isPlayer ? 'Your animal' : p.owner}</span><strong>{p.total.toFixed(1)} <small>points</small></strong><span className="circuit-prize">{money(run.event.prizes[p.rank - 1])}</span></button>)}</div>
    {winner && <div className="circuit-award-card"><Icon name="crown" size={26} /><div><span className="circuit-kicker">SPECIAL AWARD · {AWARDS[show!.award].name.toUpperCase()}</span><h3>{winner.fish.name} <small>{winner.isPlayer ? 'Your animal' : winner.owner}</small></h3><p>{AWARDS[show!.award].blurb}</p></div><FishPortrait fish={winner.fish} view="current" /></div>}
    <div className="circuit-stage-layout"><div>
      <div className="circuit-reviews">{sorted.filter(p => p.rank <= 3 || p.isPlayer).map(p => <article key={p.fish.id} className={p.isPlayer ? 'is-player' : ''}><div><AwardMark rank={p.rank} small /><span><b>{p.fish.name}</b><small>{p.isPlayer ? 'Your entrant' : p.owner} · {p.total.toFixed(1)} points</small></span></div><blockquote>“{p.comment}”</blockquote></article>)}</div>
      <section className="circuit-rankings"><div className="circuit-section-title"><h2>Full scorecard</h2><button aria-expanded={showAll} onClick={() => setShowAll(value => !value)}>{showAll ? 'Hide' : `Show all ${sorted.length}`}</button></div>
        {showAll && <div className="circuit-table-scroll"><table><thead><tr><th>Place</th><th>Animal</th>{CRITERIA.map((k, i) => <th key={k} className={BRIEFS[brief].focus === k ? 'focus' : ''}>{CRITERION_LABEL[k]} <small>×{Math.round(BRIEFS[brief].weights[i] * 100)}%</small></th>)}{show && <th>Show day</th>}<th>Total</th></tr></thead><tbody>{sorted.map(p => { const shift = p.adjust ? p.adjust.presentation + p.adjust.pattern + p.adjust.condition : 0; return <tr className={p.isPlayer ? 'is-player' : ''} key={p.fish.id}><td>{ordinal(p.rank)}</td><td><button onClick={() => setInspected(p.fish.id)}>{p.fish.name}</button><small>{p.isPlayer ? 'Your animal' : p.owner}{show?.awardWinner === p.fish.id ? ' · ★ ' + AWARDS[show.award].name : ''}</small></td>{CRITERIA.map(k => <td key={k}>{p.scores[k].toFixed(1)}</td>)}{show && <td><span className={`circuit-delta ${shift > 0 ? 'up' : shift < 0 ? 'down' : ''}`} title={CRITERIA.filter(k => p.adjust?.[k]).map(k => `${CRITERION_LABEL[k]} ${signed(p.adjust![k])}`).join(', ') || 'No effect'}>{signed(shift)}</span></td>}<td><b>{p.total.toFixed(1)}</b></td></tr>; })}</tbody></table></div>}
        <p>Criteria are scored out of 100 and weighted by the {BRIEFS[brief].name} brief. {show ? 'Show-day effects (incident and your preparation) are already included in the criterion scores. ' : ''}Higher tiers field more selectively chosen opponents; no exhibit receives hidden bonuses. Ties are broken by animal ID.</p></section>
    </div>{participant && <aside className="circuit-inspection" key={participant.fish.id}><ParticipantDetails participant={participant} results brief={brief} />{!participant.isPlayer && <Negotiation {...{ world, onCommand, readOnly, participant }} />}</aside>}</div>
  </>;
}

function ParticipantDetails({ participant: p, results, brief }: { participant: CompetitionParticipant; results: boolean; brief: keyof typeof BRIEFS }) {
  return <><span className="circuit-kicker">{p.isPlayer ? 'YOUR EXHIBIT' : `EXHIBITED BY ${p.owner.toUpperCase()}`}</span><FishPortrait fish={p.fish} large view="current" /><h2>{p.fish.name}</h2><p>{exhibitLabel(p.fish)} · {p.fish.sex === 'F' ? 'Female' : 'Male'} · gen {p.fish.generation}</p>
    <dl><div><dt>Length</dt><dd>{p.fish.life.lengthCm.toFixed(1)} cm</dd></div><div><dt>Condition at entry</dt><dd>{Math.round(p.fish.life.condition * 100)}%</dd></div><div><dt>Age at entry</dt><dd>{p.fish.life.ageDays} days</dd></div></dl>
    {results ? <><div className="circuit-detail-score"><AwardMark rank={p.rank} small /><span><b>{p.total.toFixed(1)} points</b><small>{ordinal(p.rank)} place</small></span></div><ScoreBars scores={p.scores} brief={brief} /></>
      : <p className="circuit-muted">Scores are revealed by the panel on show day.</p>}</>;
}

function Negotiation({ world, participant, onCommand, readOnly }: Props & { participant: CompetitionParticipant }) {
  const [amount, setAmount] = useState(String(Math.round(participant.askingPrice * .8)));
  const [tankId, setTankId] = useState(world.tanks.find(t => !t.display)?.id ?? world.tanks[0]?.id ?? '');
  const [feedback, setFeedback] = useState('');
  const { negotiation } = participant;
  const tank = world.tanks.find(t => t.id === tankId);
  const residents = world.fish.filter(f => f.status === 'living');
  const free = tank ? tank.capacity - residents.filter(f => f.tankId === tankId).length - reservedPlaces(world, tankId) : 0;
  const price = Number(amount);
  const capacityProblem = !tank ? 'Choose a destination aquarium.' : free < 1 ? 'That aquarium has no unreserved space.' : residents.length + reservedPlaces(world) >= MAX_LIVING ? 'Your collection is at the living-animal limit.' : world.fish.length >= MAX_RECORDS ? 'Your world has reached the record limit.' : null;
  const problem = capacityProblem ?? (!Number.isSafeInteger(price) || price <= 0 ? 'Enter a positive whole-credit offer.' : price > world.credits ? 'This offer exceeds your balance.' : null);
  const offer = (value: number) => { const ok = onCommand({ type: 'competition-offer', participantId: participant.fish.id, amount: value, tankId, timestamp: new Date().toISOString() }); setFeedback(ok ? `${participant.owner} has considered your offer.` : 'Offer could not be completed.'); };
  if (negotiation.status === 'purchased') return <div className="circuit-negotiation circuit-acquired"><h3><Icon name="check" size={16} /> Welcome home</h3><p>Their identity, genome and show record travel with them.</p></div>;
  if (negotiation.status === 'declined') return <div className="circuit-negotiation"><h3>Talks closed</h3><p>{participant.owner} has declined further offers.</p></div>;
  return <div className="circuit-negotiation"><span className="circuit-kicker">MAKE AN OFFER</span><p>{participant.owner} is asking <strong>{money(participant.askingPrice)}</strong>. Three offers at most.</p>
    {negotiation.counter !== null && <div className="circuit-counter"><b>“I could agree to {money(negotiation.counter)}.”</b><span>{participant.owner} · counteroffer · {3 - negotiation.attempts} {3 - negotiation.attempts === 1 ? 'offer' : 'offers'} left</span></div>}
    <label>Destination<select value={tankId} onChange={e => setTankId(e.target.value)}>{world.tanks.map(t => <option key={t.id} value={t.id}>{t.name} · {t.capacity - residents.filter(f => f.tankId === t.id).length - reservedPlaces(world, t.id)} free</option>)}</select></label><label>Your offer<input type="number" min="1" step="1" value={amount} onChange={e => setAmount(e.target.value)} /></label>
    <div className="circuit-offer-actions"><button className="circuit-primary" disabled={readOnly || !!problem} onClick={() => offer(price)}>Make offer</button>{negotiation.counter !== null && <button disabled={readOnly || !!capacityProblem || negotiation.counter > world.credits} onClick={() => offer(negotiation.counter!)}>Accept {money(negotiation.counter)}</button>}</div>
    <p className="circuit-offer-feedback" role="status">{problem ?? feedback}</p></div>;
}

// ───────────────────────────── Honours and trophy room ─────────────────────────────
export function AnimalHonors({ world, fishId }: { world: World; fishId: string }) {
  const runs = finishedRuns(world);
  const records = runs.flatMap(run => run.participants.filter(p => p.fish.id === fishId).map(participant => ({ run, participant })));
  const fishTitle = titleOf(runs, fishId);
  if (!records.length) return <div className="circuit-animal-honors"><h3>Competition history</h3><p>No show appearances yet.</p></div>;
  return <div className="circuit-animal-honors"><h3>Competition history <span>{records.length}</span>{fishTitle && <em className="circuit-title-badge"><Icon name="medal" size={12} /> {fishTitle}</em>}</h3>{records.map(({ run, participant: p }) => <details key={run.event.id}><summary><AwardMark rank={p.rank} small /><span>{run.event.name}{run.show?.awardWinner === p.fish.id ? ' ★' : ''}<small>{title(run.event.tier)} · {run.event.city} · Year {run.event.year} · {p.total.toFixed(1)} pts</small></span></summary><p>{p.comment}</p><small>Presentation {p.scores.presentation.toFixed(1)} · Pattern {p.scores.pattern.toFixed(1)} · Condition {p.scores.condition.toFixed(1)}{run.show ? ` · ${BRIEFS[run.show.brief].name} · ${INCIDENTS[run.show.incident].name}` : ''}</small></details>)}</div>;
}

export function TrophyRoom({ world, onInspect }: { world: World; onInspect: (fishId: string) => void }) {
  const [archive, setArchive] = useState(false);
  const [query, setQuery] = useState('');
  const [species, setSpecies] = useState('all');
  const [page, setPage] = useState(0);
  const runs = finishedRuns(world), career = useMemo(() => circuitCareer(world), [world]), table = useMemo(() => rivals(runs).slice(0, 6), [runs]);
  const byFish = new Map<string, { run: CompetitionRun; participant: CompetitionParticipant }[]>();
  for (const run of runs) for (const participant of run.participants) { const items = byFish.get(participant.fish.id) ?? []; items.push({ run, participant }); byFish.set(participant.fish.id, items); }
  const owned = world.fish.filter((fish: Fish) => (archive || fish.status === 'living') && (species === 'all' || fish.species === species) && fish.name.toLowerCase().includes(query.toLowerCase()));
  const decorated = owned.filter(fish => byFish.has(fish.id)).sort((a, b) => Math.min(...byFish.get(a.id)!.map(r => r.participant.rank)) - Math.min(...byFish.get(b.id)!.map(r => r.participant.rank)));
  const allAwards = world.fish.filter(fish => archive || fish.status === 'living').flatMap(fish => byFish.get(fish.id) ?? []);
  const pages = Math.max(1, Math.ceil(decorated.length / 18)), safePage = Math.min(page, pages - 1);
  return <section className="circuit circuit-trophy-room" aria-label="Trophy room"><header className="circuit-heading"><div><span className="circuit-kicker">THE COLLECTION'S LEGACY</span><h1>Small lives. Lasting legends.</h1><p>Every appearance remembered, every ribbon earned, every rival on record.</p></div></header>
    <CareerStrip career={career} />
    <div className="circuit-trophy-overview">
      <section><div className="circuit-section-title"><h2>Milestones</h2><span>{career.milestones.filter(m => m.done).length} / {career.milestones.length}</span></div><ul className="circuit-milestones">{career.milestones.map(m => <li key={m.id} className={m.done ? 'done' : ''}><Icon name={m.done ? 'star' : 'spark'} size={15} filled={m.done} /><span><b>{m.name}</b><small>{m.detail}</small></span></li>)}</ul></section>
      <section><div className="circuit-section-title"><h2>Rivals</h2><span>Head-to-head, best placing per show</span></div>{table.length ? <table className="circuit-rival-table"><thead><tr><th>Keeper</th><th>Met</th><th>You</th><th>Them</th></tr></thead><tbody>{table.map(r => <tr key={r.keeper}><td>{r.keeper}</td><td>{r.meetings}</td><td className="up">{r.wins}</td><td className="down">{r.losses}</td></tr>)}</tbody></table> : <p className="circuit-muted">Rivals appear after your first show.</p>}
        <div className="circuit-trophy-stats">{[1, 2, 3].map(rank => <div key={rank}><AwardMark rank={rank} small /><span><strong>{allAwards.filter(a => a.participant.rank === rank).length}</strong><small>{rank === 1 ? 'Gold' : rank === 2 ? 'Silver' : 'Bronze'}</small></span></div>)}<div><span><strong>{allAwards.length}</strong><small>Appearances</small></span></div></div></section>
    </div>
    <div className="circuit-toolbar"><label>Find an animal<input type="search" value={query} placeholder="Search by name" onChange={e => { setQuery(e.target.value); setPage(0); }} /></label><label>Species<select value={species} onChange={e => { setSpecies(e.target.value); setPage(0); }}><option value="all">All animals</option>{SPECIES.map(s => <option key={s} value={s}>{speciesName(s, true)}</option>)}</select></label><label className="circuit-checkbox"><input type="checkbox" checked={archive} onChange={e => { setArchive(e.target.checked); setPage(0); }} /> Include sold &amp; rehomed animals</label></div>
    {!decorated.length && <div className="circuit-empty"><span aria-hidden="true">✧</span><h2>Your first ribbon is waiting.</h2><p>{query ? 'No competition records match your search.' : 'Enter a show from Competitions. Every finish joins this collection, with or without a medal.'}</p></div>}
    <div className="circuit-trophy-grid">{decorated.slice(safePage * 18, safePage * 18 + 18).map(fish => { const entries = byFish.get(fish.id)!; const best = Math.min(...entries.map(e => e.participant.rank)); return <article className="circuit-trophy-card" key={fish.id}><div className="circuit-trophy-portrait"><FishPortrait fish={fish} view="current" /><AwardMark rank={best} /></div><button className="circuit-name-link" onClick={() => onInspect(fish.id)}>{fish.name} <Icon name="external" size={12} /></button><p>{speciesName(fish.species)} · {fish.status === 'living' ? 'In your collection' : title(fish.status)} · {entries.length} {entries.length === 1 ? 'appearance' : 'appearances'}</p><AnimalHonors world={world} fishId={fish.id} /></article>; })}</div>{pages > 1 && <div className="circuit-pagination"><button disabled={!safePage} onClick={() => setPage(safePage - 1)}>Previous</button><span>{safePage + 1} / {pages}</span><button disabled={safePage + 1 === pages} onClick={() => setPage(safePage + 1)}>Next</button></div>}
  </section>;
}
