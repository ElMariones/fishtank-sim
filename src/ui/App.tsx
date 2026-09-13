import { useEffect, useMemo, useRef, useState } from 'react';
import { CHROMOSOMES, LOCI, label } from '../core/catalog';
import {
  cohortsOf, decodePreferences, goalLeaders, goalValue, PREFERENCES_KEY, sortCollection, toggleFavorite, type BreedingGoal, type CollectionSort,
} from '../core/collection';
import { VISUAL_DESCRIPTORS, type VisualDescriptorKey } from '../core/descriptors';
import { express, fingerprint, heterozygosity } from '../core/genetics';
import { MARKING_BLOCKS, MARKING_VISIBLE_ALPHA } from '../core/pattern';
import { kinship } from '../core/pedigree';
import { commandEnvelope, executeCommand, TICK_MS } from '../core/runtime';
import type { LoadedSession } from '../persistence/session';
import { downloadText, SavePanel } from './SavePanel';
import type { Fish, World } from '../core/types';
import { COHORT_SIZE, quote, STOCK_PRICE, type Command } from '../core/world';
import { FishPortrait } from './FishPortrait';
import { ResearchLab } from './ResearchLab';
import { TankCanvas } from './TankCanvas';
import { VisualFixtureLab } from './VisualFixtureLab';
import './styles.css';

const percent = (n: number) => `${(n * 100).toFixed(1)}%`;
const wholePercent = (n: number) => `${Math.round(n * 100)}%`;
const date = (timestamp: string) => new Date(timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const descriptorLabel = new Map(VISUAL_DESCRIPTORS.map(descriptor => [descriptor.key, descriptor.label]));
type SexFilter = 'all' | Fish['sex'];
type View = 'aquarium' | 'fixtures' | 'research';
const VIEWS: [View, string][] = [['aquarium', 'Aquarium'], ['fixtures', 'Visual fixtures'], ['research', 'Research']];

function readPreferences(world: World) {
  let raw: string | null = null;
  try { raw = localStorage.getItem(PREFERENCES_KEY); } catch { /* Preferences are optional. */ }
  return decodePreferences(raw, new Set(world.fish.map(f => f.id)));
}

export function App({ initial }: { initial: LoadedSession }) {
  const [runtime, setRuntime] = useState(initial.runtime);
  const world = runtime.world;
  const runtimeRef = useRef(runtime);
  const saveBusy = useRef(false);
  const clockOrigin = useRef({ time: performance.now(), tick: runtime.tick });
  const [blocked, setBlocked] = useState(initial.blocked);
  const [showSaves, setShowSaves] = useState(false);
  const [preferences, setPreferences] = useState(() => readPreferences(initial.runtime.world));
  const [tankId, setTankId] = useState(initial.runtime.world.tanks[0].id);
  const [selectedId, setSelectedId] = useState(initial.runtime.world.fish.find(f => f.status === 'living')?.id ?? '');
  const [tab, setTab] = useState<'Overview' | 'Genome' | 'Family'>('Overview');
  const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [speed, setSpeed] = useState(1);
  const [feedSignal, setFeedSignal] = useState(0);
  const [notice, setNotice] = useState('Select a fish to explore its traits and ancestry.');
  const [saveError, setSaveError] = useState(initial.warning);
  const [motherId, setMotherId] = useState(initial.runtime.world.fish.find(f => f.sex === 'F' && f.status === 'living')?.id ?? '');
  const [fatherId, setFatherId] = useState(initial.runtime.world.fish.find(f => f.sex === 'M' && f.status === 'living')?.id ?? '');
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [sexFilter, setSexFilter] = useState<SexFilter>('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [cohortKey, setCohortKey] = useState('all');
  const [saleId, setSaleId] = useState<string | null>(null);
  const [view, setView] = useState<View>('aquarium');
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [batchReview, setBatchReview] = useState(false);
  const [lastBatchId, setLastBatchId] = useState<string | null>(null);
  const [collectionPage, setCollectionPage] = useState(0);
  const [familyPage, setFamilyPage] = useState(0);
  const [focusRequest, setFocusRequest] = useState(0);
  const inspectorHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (blocked || !initial.session) return;
    let cancelled = false;
    setSaveError('Saving…');
    void initial.session.save(runtime).then(() => {
      if (!cancelled) setSaveError('');
    }).catch(error => {
      if (!cancelled) setSaveError(`Not saved. ${error instanceof Error ? error.message : 'Storage is unavailable.'} Open Saves to retry or export.`);
    });
    return () => { cancelled = true; };
  }, [runtime, blocked, initial.session]);

  useEffect(() => {
    if (blocked) return;
    try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences)); } catch { /* Preferences are optional. */ }
  }, [preferences, blocked]);

  // Keyboard and relative selections move focus to the inspector so it is never lost when the pressed button unmounts.
  useEffect(() => { if (focusRequest) inspectorHeading.current?.focus(); }, [focusRequest]);

  const { goal, favorites } = preferences;
  const favoriteIds = new Set(favorites);
  const tank = world.tanks.find(t => t.id === tankId) ?? world.tanks[0];
  const fish = world.fish.find(f => f.id === selectedId);
  const living = world.fish.filter(f => f.status === 'living');
  const residents = useMemo(() => world.fish.filter(f => f.tankId === tank.id && f.status === 'living'), [world.fish, tank.id]);
  const p = useMemo(() => fish ? express(fish.genome) : null, [fish]);
  const prospectiveF = useMemo(() => kinship(world.fish, motherId, fatherId), [world.fish, motherId, fatherId]);
  const currentF = useMemo(() => fish?.parents ? kinship(world.fish, fish.parents[0], fish.parents[1]) : 0, [world.fish, fish]);
  const leaders = useMemo(() => goal ? goalLeaders(world.fish, goal) : null, [world.fish, goal]);

  // Collection pipeline: view → cohort → favorites → sex → sort. Counts show what each filter would reveal.
  const viewFish = (showArchived ? world.fish.filter(f => f.status === 'sold') : residents).filter(f => `${f.name} ${f.id}`.toLowerCase().includes(query.toLowerCase()));
  const cohorts = cohortsOf(viewFish);
  const cohort = cohorts.find(c => c.key === cohortKey) ?? null;
  const inCohort = cohort ? viewFish.filter(f => f.parents?.[0] === cohort.motherId && f.parents?.[1] === cohort.fatherId) : viewFish;
  const favoriteFiltered = favoritesOnly ? inCohort.filter(f => favoriteIds.has(f.id)) : inCohort;
  const sexCounts = { all: favoriteFiltered.length, F: favoriteFiltered.filter(f => f.sex === 'F').length, M: favoriteFiltered.filter(f => f.sex === 'M').length };
  const sort: CollectionSort = preferences.sort === 'goal' && !goal ? 'newest' : preferences.sort;
  const collection = sortCollection(sexFilter === 'all' ? favoriteFiltered : favoriteFiltered.filter(f => f.sex === sexFilter), sort, goal);
  const pageSize = 60;
  const page = Math.min(collectionPage, Math.max(0, Math.ceil(collection.length / pageSize) - 1));
  const visibleCollection = collection.slice(page * pageSize, (page + 1) * pageSize);
  const children = world.fish.filter(child => child.parents?.includes(selectedId));
  const childPage = Math.min(familyPage, Math.max(0, Math.ceil(children.length / pageSize) - 1));
  useEffect(() => { setCollectionPage(0); }, [tank.id, showArchived, query, sexFilter, favoritesOnly, cohortKey, sort, goal]);
  useEffect(() => { setFamilyPage(0); }, [selectedId]);
  const fishName = (id: string) => world.fish.find(f => f.id === id)?.name ?? id;
  // Batch selection only ever acts on living fish visible in the current collection view.
  const batch = collection.filter(f => f.status === 'living' && batchIds.includes(f.id));
  const batchTotal = batch.reduce((sum, f) => sum + quote(f), 0);

  useEffect(() => { setBatchIds([]); setBatchReview(false); setLastBatchId(null); }, [tank.id, showArchived, sexFilter, favoritesOnly, cohortKey]);

  function run(command: Command, message: string): World | null {
    if (saveBusy.current) { setNotice('Wait for the save operation to finish.'); return null; }
    try {
      const current = runtimeRef.current;
      const tick = Math.max(current.tick, clockOrigin.current.tick + Math.floor((performance.now() - clockOrigin.current.time) / TICK_MS));
      const updated = executeCommand(current, commandEnvelope(current, command, tick));
      runtimeRef.current = updated;
      setRuntime(updated);
      const next = updated.world;
      if (!next.fish.some(f => f.id === motherId && f.status === 'living')) setMotherId(next.fish.find(f => f.sex === 'F' && f.status === 'living')?.id ?? '');
      if (!next.fish.some(f => f.id === fatherId && f.status === 'living')) setFatherId(next.fish.find(f => f.sex === 'M' && f.status === 'living')?.id ?? '');
      setNotice(message);
      return next;
    }
    catch (error) { setNotice(error instanceof Error ? error.message : 'The action could not be completed.'); return null; }
  }

  function select(id: string, focusInspector = false) {
    const target = world.fish.find(f => f.id === id);
    if (!target) return;
    setSelectedId(id); setSaleId(null);
    if (target.status === 'living') { setTankId(target.tankId); setShowArchived(false); }
    if (focusInspector) setFocusRequest(n => n + 1);
  }

  function returnToCollection() {
    const card = document.getElementById(`card-${selectedId}`);
    (card ?? document.getElementById('collection'))?.focus();
  }

  function breed() {
    const pairText = ` Showing all offspring of ${fishName(motherId)} × ${fishName(fatherId)}${goal ? `, ranked by ${descriptorLabel.get(goal.descriptor)?.toLowerCase()}` : ''}.`;
    const next = run({ type: 'breed', motherId, fatherId, tankId: tank.id, timestamp: new Date().toISOString() }, `${COHORT_SIZE} offspring born. Every fish inherited one recombined copy from each parent.${pairText}`);
    if (next) {
      setSelectedId(next.fish[next.fish.length - COHORT_SIZE].id); setShowArchived(false); setQuery('');
      setCohortKey(`${motherId}×${fatherId}`); setFavoritesOnly(false); setSexFilter('all');
    }
  }

  function setGoal(descriptor: VisualDescriptorKey | '') {
    setPreferences(current => {
      const next: BreedingGoal | null = descriptor ? { descriptor, direction: current.goal?.direction ?? 'higher' } : null;
      return { ...current, goal: next, sort: next ? 'goal' : current.sort === 'goal' ? 'newest' : current.sort };
    });
  }

  function chooseLeader(leader: Fish) {
    if (leader.sex === 'F') setMotherId(leader.id); else setFatherId(leader.id);
    setNotice(`${leader.name} selected as ${leader.sex === 'F' ? 'mother' : 'father'}. Your breeding goal is unchanged.`);
  }

  /** Shift-click extends the last toggle across the visible collection, matching the new checked state. */
  function toggleBatch(id: string, extend: boolean) {
    const visible = collection.filter(f => f.status === 'living').map(f => f.id);
    const checked = !batchIds.includes(id);
    let affected = [id];
    if (extend && lastBatchId && visible.includes(lastBatchId)) {
      const [from, to] = [visible.indexOf(lastBatchId), visible.indexOf(id)].sort((a, b) => a - b);
      affected = visible.slice(from, to + 1);
    }
    setBatchIds(checked ? [...new Set([...batchIds, ...affected])] : batchIds.filter(existing => !affected.includes(existing)));
    setLastBatchId(id); setBatchReview(false);
  }

  function sellBatch() {
    const count = batch.length, total = batchTotal;
    if (run({ type: 'sell-batch', fishIds: batch.map(f => f.id) }, `${count} fish sold to the local NPC for ◈ ${total.toLocaleString()}. Their archived profiles remain in the family tree.`)) {
      setBatchIds([]); setBatchReview(false); setSaleId(null);
    }
  }

  const goalLabel = goal ? descriptorLabel.get(goal.descriptor)! : '';

  return <div className="app-shell">
    {view === 'aquarium' ? <><a className="skip-link" href="#collection">Skip to collection</a><a className="skip-link" href="#inspector">Skip to inspector</a></> : null}
    <header className="topbar">
      <a className="brand" href="#"><img src="/favicon.svg" alt="" /><span>fishtank<span className="brand-light"> sim</span></span></a>
      <div className="project-label">GENETICS LAB <span>0.1</span></div>
      <div className="top-actions"><span className="credits">◈ {world.credits.toLocaleString()} <small>lab credits</small></span>
        <nav className="view-switch" aria-label="Lab views">{VIEWS.map(([value, text]) => <button key={value} className="quiet" aria-current={view === value ? 'page' : undefined} onClick={() => setView(value)}>{text}</button>)}</nav>
        <button className="quiet" onClick={() => downloadText(JSON.stringify(runtime), 'fishtank-save-v2.json')}>Export save</button></div>
    </header>
      <div className="save-navigation"><div className="save-state">{saveError === 'Saving…' ? 'Saving…' : saveError ? 'Session not saved' : 'Saved on this device'}</div><button aria-expanded={showSaves} onClick={() => setShowSaves(value => !value)}>Saves</button></div>
      {showSaves ? <SavePanel runtime={runtime} session={initial.session} blocked={blocked} onBusy={value => { saveBusy.current = value; }} onSaved={() => { setBlocked(false); setSaveError(''); }} /> : null}
    {view === 'fixtures' ? <VisualFixtureLab onClose={() => setView('aquarium')} /> : view === 'research' ? <ResearchLab onClose={() => setView('aquarium')} /> : <div className="workspace">
      <aside className="tank-sidebar">
        <div className="eyebrow">YOUR AQUARIUMS</div>
        <nav aria-label="Aquariums">{world.tanks.map((t, i) => <button key={t.id} className={`tank-link ${t.id === tank.id ? 'active' : ''}`} aria-current={t.id === tank.id ? 'true' : undefined} onClick={() => { setTankId(t.id); setShowArchived(false); setQuery(''); }}>
          <span className="tank-number">0{i + 1}</span><span>{t.name}<small>{living.filter(f => f.tankId === t.id).length} / {t.capacity} fish</small></span>
        </button>)}</nav>
        <button className="add-tank quiet" onClick={() => run({ type: 'add-tank' }, 'A new lab tank is ready.')}>＋ Add lab tank</button>
        <div className="sidebar-note"><span className="eyebrow">A LINEAGE STARTS HERE</span><p>Small differences.<br />Extraordinary descendants.</p><span>48 loci · 8 chromosomes<br />One fish at a time.</span></div>

      </aside>
      <main>
        {saveError && saveError !== 'Saving…' ? <p className="warning" role="alert">{saveError}</p> : null}
        <div className="tank-heading"><div><div className="eyebrow">AQUARIUM / {String(world.tanks.indexOf(tank) + 1).padStart(2, '0')}</div><h1>{tank.name}</h1></div><span className="count-tag">{residents.length} inhabitants</span></div>
        <section className="aquarium" aria-label="Live aquarium">
          <TankCanvas fish={residents} tank={tank} selectedId={selectedId} onSelect={select} paused={paused} speed={speed} feedSignal={feedSignal} />
          <div className="tank-overlay"><span>{paused ? 'PAUSED' : 'LIVE AQUARIUM'}</span><span>{tank.planted ? 'Planted habitat' : 'Open water'}</span></div>
          {!residents.length ? <div className="empty-tank">A little room to evolve.<small>Move a fish here or introduce unrelated stock.</small></div> : null}
          <div className="tank-controls"><div><button aria-label={paused ? 'Resume aquarium' : 'Pause aquarium'} onClick={() => setPaused(v => !v)}>{paused ? '▶' : 'Ⅱ'}</button><button onClick={() => setSpeed(v => v === 1 ? 2 : v === 2 ? 4 : 1)} aria-label={`Motion speed ${speed} times`}>{speed}×</button></div><span>Click a fish to inspect</span><button className="feed-button" onClick={() => { setFeedSignal(v => v + 1); setNotice('Food draws fish toward the surface. Feeding is a behavior demo; care and growth arrive in a later milestone.'); }}>＋ Feed</button></div>
        </section>
        <div className="habitat-toolbar"><span>Laboratory mode · offspring show adult genetic potential</span><button className="quiet" onClick={() => run({ type: 'decorate', tankId: tank.id }, 'Habitat appearance updated. Decoration effects are planned for the care simulation.')}>{tank.planted ? 'Remove plants' : 'Add plants'}</button></div>
        <section className="breeding-panel" aria-labelledby="breeding-title">
          <div className="breed-intro"><div className="eyebrow">THE NEXT GENERATION</div><h2 id="breeding-title">What will they inherit?</h2><p>Choose two parents. Discover twenty possibilities.</p></div>
          <div className="goal-row">
            <label className="goal-picker">Breeding goal<select value={goal?.descriptor ?? ''} onChange={event => setGoal(event.target.value as VisualDescriptorKey | '')}>
              <option value="">No goal</option>{VISUAL_DESCRIPTORS.map(descriptor => <option key={descriptor.key} value={descriptor.key}>{descriptor.label}</option>)}
            </select></label>
            <div className="direction-toggle" role="group" aria-label="Goal direction">{(['higher', 'lower'] as const).map(direction => <button key={direction} aria-pressed={goal?.direction === direction} disabled={!goal}
              onClick={() => setPreferences(current => current.goal ? { ...current, goal: { ...current.goal, direction } } : current)}>{direction === 'higher' ? 'Higher ↑' : 'Lower ↓'}</button>)}</div>
            {goal && leaders ? <div className="goal-leaders"><span>Leaders by {goalLabel.toLowerCase()}</span>{[leaders.mother, leaders.father].map(leader => leader ? <button key={leader.id} onClick={() => chooseLeader(leader)}>
              <SexMark sex={leader.sex} decorative />{leader.name}<span className="filter-count">{wholePercent(goalValue(leader, goal))}</span></button> : null)}</div> : <p className="goal-hint">Pick a visible trait to rank the collection and suggest parents. The goal stays while you choose new parents.</p>}
          </div>
          <div className="parent-pickers"><label><span className="picker-label">Mother <SexMark sex="F" decorative /></span><select value={motherId} onChange={e => setMotherId(e.target.value)}><option value="">Select female</option>{living.filter(f => f.sex === 'F').map(f => <option key={f.id} value={f.id}>♀ {f.name} · G{f.generation}{goal ? ` · ${wholePercent(goalValue(f, goal))}` : ''}</option>)}</select></label><span className="cross">×</span><label><span className="picker-label">Father <SexMark sex="M" decorative /></span><select value={fatherId} onChange={e => setFatherId(e.target.value)}><option value="">Select male</option>{living.filter(f => f.sex === 'M').map(f => <option key={f.id} value={f.id}>♂ {f.name} · G{f.generation}{goal ? ` · ${wholePercent(goalValue(f, goal))}` : ''}</option>)}</select></label></div>
          <div className="breed-action"><button className="primary" onClick={breed} disabled={!living.some(f => f.id === motherId) || !living.some(f => f.id === fatherId)}>Breed 20 offspring <span>↗</span></button><small>Expected pedigree F: {percent(prospectiveF)}</small></div>
          <p className="lab-note">Accelerated experiment: no maturity wait or courtship. Parents may be in different lab tanks. Births use the current tank’s free places. Goal values are normalized adult genetic potential.</p>
        </section>
        <div className="status-line" role="status" aria-live="polite">{notice}</div>
        <section className="collection" id="collection" tabIndex={-1} aria-labelledby="collection-title">
          <div className="collection-heading"><h2 id="collection-title">{showArchived ? 'Archived fish' : 'Your collection'} <span>{collection.length}</span></h2><button className="quiet" onClick={() => { setShowArchived(v => !v); setQuery(''); }}>{showArchived ? 'Show residents' : 'View archive'}</button></div>
          <div className="collection-toolbar"><input aria-label="Search fish" placeholder="Search by name or ID…" value={query} onChange={e => setQuery(e.target.value)} /><button onClick={() => {
            const next = run({ type: 'buy', tankId: tank.id, timestamp: new Date().toISOString() }, 'Unrelated founder stock introduced. This is a local NPC purchase.');
            if (next) { setSelectedId(next.fish.at(-1)!.id); setShowArchived(false); setQuery(''); }
          }}>＋ Unrelated stock <span>◈ {STOCK_PRICE}</span></button></div>
          <div className="collection-filters">
            <div className="sex-filter" role="group" aria-label="Show fish by sex">
              {(['all', 'F', 'M'] as const).map(value => <button key={value} aria-pressed={sexFilter === value} onClick={() => setSexFilter(value)}>
                {value === 'all' ? 'All' : <><SexMark sex={value} decorative />{value === 'F' ? 'Females' : 'Males'}</>}<span className="filter-count">{sexCounts[value]}</span>
              </button>)}
            </div>
            <button className="pill-toggle" aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(v => !v)}><span aria-hidden="true">★</span>Favorites<span className="filter-count">{inCohort.filter(f => favoriteIds.has(f.id)).length}</span></button>
            <label className="inline-select">Parents<select value={cohort ? cohort.key : 'all'} onChange={event => setCohortKey(event.target.value)}>
              <option value="all">All parents</option>{cohorts.map(c => <option key={c.key} value={c.key}>{fishName(c.motherId)} × {fishName(c.fatherId)} · {c.size}</option>)}
            </select></label>
            <label className="inline-select">Sort<select value={sort} onChange={event => setPreferences(current => ({ ...current, sort: event.target.value as CollectionSort }))}>
              <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Name</option><option value="goal" disabled={!goal}>{goal ? `${goalLabel} ${goal.direction === 'higher' ? '↑' : '↓'}` : 'Breeding goal (set one first)'}</option>
            </select></label>
          </div>
          {cohort ? <div className="cohort-parents" role="group" aria-label="Parents of this cohort">{[cohort.motherId, cohort.fatherId].flatMap(id => world.fish.filter(f => f.id === id)).map(parent => <button className="cohort-parent" key={parent.id} onClick={event => select(parent.id, event.detail === 0)}>
            <FishPortrait fish={parent} /><span><strong>{parent.name}</strong><small>{parent.sex === 'F' ? 'Mother' : 'Father'} · G{parent.generation}{goal ? ` · ${goalLabel} ${wholePercent(goalValue(parent, goal))}` : ''}{parent.status === 'sold' ? ' · Sold' : ''}</small></span>
          </button>)}</div> : null}
          {!showArchived && collection.length ? <div className="batch-bar" role="group" aria-label="Batch selection">
            <span className="batch-summary">{batch.length ? <><strong>{batch.length}</strong> selected · ◈ {batchTotal.toLocaleString()}</> : 'Tick fish to sell several at once. Shift-click a second box to select a range.'}</span>
            <div className="batch-actions">
              <button className="quiet" onClick={() => { setBatchIds(collection.map(f => f.id)); setBatchReview(false); }}>Select all {collection.length}</button>
              {batch.length ? <button className="quiet" onClick={() => { setBatchIds([]); setBatchReview(false); }}>Clear</button> : null}
              {batch.length ? <button className="batch-sell" aria-expanded={batchReview} aria-controls="batch-review" onClick={() => setBatchReview(true)}>Review sale of {batch.length}</button> : null}
            </div>
          </div> : null}
          {batchReview && batch.length ? <div className="batch-review" id="batch-review" role="region" aria-labelledby="batch-review-title">
            <h3 id="batch-review-title">Sell {batch.length} fish to the local NPC for ◈ {batchTotal.toLocaleString()}?</h3>
            <p>Their genomes and family links stay in the archive. Sold fish cannot breed, move or be sold again.</p>
            <ul>{batch.map(f => <li key={f.id}><SexMark sex={f.sex} /><span>{f.name}<small>{f.id} · G{f.generation}{favoriteIds.has(f.id) ? ' · ★ favorite' : ''}</small></span><span>◈ {quote(f)}</span></li>)}</ul>
            <div className="batch-review-actions"><button className="confirm" onClick={sellBatch}>Confirm sale of {batch.length}</button><button className="quiet" onClick={() => setBatchReview(false)}>Cancel</button></div>
          </div> : null}
          <Pagination page={page} count={collection.length} size={pageSize} onPage={setCollectionPage} label="Collection" />
          <div className="fish-grid">{visibleCollection.map((f, index) => {
            const rank = page * pageSize + index;
            const inBatch = batch.some(member => member.id === f.id), favorite = favoriteIds.has(f.id);
            return <article className={`fish-card ${f.id === selectedId ? 'selected' : ''} ${inBatch ? 'batched' : ''}`} key={f.id}>
              <div className="fish-card-top"><span>G{f.generation}{sort === 'goal' ? ` · #${rank + 1}` : ''}</span><span className="card-marks">
                <button className="favorite-toggle" aria-pressed={favorite} aria-label={`Favorite ${f.name}`} onClick={() => setPreferences(current => toggleFavorite(current, f.id))}>{favorite ? '★' : '☆'}</button><SexMark sex={f.sex} />
              </span></div>
              <button className="fish-card-main" id={`card-${f.id}`} aria-pressed={f.id === selectedId} onClick={event => select(f.id, event.detail === 0)}>
                <FishPortrait fish={f} /><div className="fish-card-bottom"><strong>{f.name}</strong><small>{f.status === 'sold' ? 'Archived' : `${express(f.genome).adultLengthCm.toFixed(0)} cm potential`}</small>{goal ? <span className="goal-chip">{goalLabel} {wholePercent(goalValue(f, goal))}</span> : null}</div>
              </button>
              {f.status === 'living' ? <label className="batch-check"><input type="checkbox" checked={inBatch} aria-label={`Select ${f.name} for batch sale`}
                onChange={event => toggleBatch(f.id, (event.nativeEvent as MouseEvent).shiftKey === true)} /><span aria-hidden="true">{inBatch ? 'Selected' : 'Select'}</span></label> : null}
            </article>;
          })}</div>
          {!collection.length ? <p className="empty-copy">{favoritesOnly && !inCohort.some(f => favoriteIds.has(f.id)) ? 'No favorites here yet. Use ☆ on a card to keep a candidate.' : 'No fish here match this view.'}</p> : null}
        </section>
      </main>
      <aside className="inspector" id="inspector" tabIndex={-1} aria-label="Fish inspector">
        {fish && p ? <>
          <div className="inspector-heading"><span className="eyebrow">SPECIMEN {fish.id.slice(4)}</span><span className="inspector-heading-actions"><button className="quiet back-to-card" onClick={returnToCollection}>↩ Collection</button><span className="generation">G{fish.generation}</span></span></div>
          <div className="hero-portrait"><FishPortrait fish={fish} large /><span>{fish.status === 'sold' ? 'ARCHIVED SPECIMEN' : 'ADULT GENETIC PREVIEW'}</span></div>
          <div className="fish-title"><h2 ref={inspectorHeading} tabIndex={-1}>{fish.name}</h2><SexMark sex={fish.sex} withLabel /></div>
          <p className="fish-subtitle">Koi ancestry · {fish.parents ? 'Bred in your aquarium' : 'Founder stock'}{favoriteIds.has(fish.id) ? ' · ★ Favorite' : ''}</p>
          <div className="inspector-tabs" role="group" aria-label="Inspector views">{(['Overview', 'Genome', 'Family'] as const).map(t => <button key={t} aria-pressed={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>
          {tab === 'Overview' ? <>
            <form className="rename-form" key={fish.id} onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); run({ type: 'rename', fishId: fish.id, name: String(data.get('name')) }, 'Fish name updated.'); }}><label>Given name<input name="name" aria-label="Given name" defaultValue={fish.name} maxLength={32} required disabled={fish.status !== 'living'} /></label><button disabled={fish.status !== 'living'}>Save</button></form>
            <dl className="facts"><div><dt>Born in the lab</dt><dd>{date(fish.bornAt)}</dd></div><div><dt>Adult length potential</dt><dd>{p.adultLengthCm.toFixed(1)} cm</dd></div>{goal ? <div><dt>Goal · {goalLabel}</dt><dd>{wholePercent(goalValue(fish, goal))}</dd></div> : null}<div><dt>Lab sale quote</dt><dd>◈ {quote(fish)}</dd></div><div><dt>Heterozygous loci</dt><dd>{percent(heterozygosity(fish.genome))}</dd></div><div><dt>Pedigree inbreeding F</dt><dd>{percent(currentF)}</dd></div><div><dt>New mutations at birth</dt><dd>{fish.mutations.length}</dd></div></dl>
            <div className="trait-block"><div className="eyebrow">INHERITED TENDENCIES</div>{[['Sociability', p.social], ['Boldness', p.bold], ['Activity', p.activity], ['Curiosity', p.curious]].map(([name, value]) => <div className="trait" key={name}><span>{name}</span><meter min="0" max="1" value={Number(value)} aria-label={String(name)} /><span>{Math.round(Number(value) * 100)}</span></div>)}</div>
            {fish.status === 'living' ? <div className="fish-actions"><label>Move to aquarium<select aria-label="Move to aquarium" value={fish.tankId} onChange={event => {
              if (run({ type: 'move', fishId: fish.id, tankId: event.target.value }, `${fish.name} moved to another aquarium.`)) setTankId(event.target.value);
            }}>{world.tanks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label><button onClick={() => { if (fish.sex === 'F') setMotherId(fish.id); else setFatherId(fish.id); setNotice(`${fish.name} selected as ${fish.sex === 'F' ? 'mother' : 'father'}.${goal ? ' Your breeding goal is unchanged.' : ''}`); }}>Select as {fish.sex === 'F' ? 'mother' : 'father'}</button>
              {saleId === fish.id ? <div className="sale-confirm"><p>Sell {fish.name} to the local NPC for ◈ {quote(fish)}? Their family record remains available.</p><button onClick={() => { run({ type: 'sell', fishId: fish.id }, `${fish.name} sold. The archived profile remains in the family tree.`); setSaleId(null); }}>Confirm sale</button><button className="quiet" onClick={() => setSaleId(null)}>Cancel</button></div> : <button className="quiet sell" onClick={() => setSaleId(fish.id)}>Sell to local NPC · ◈ {quote(fish)}</button>}
            </div> : <p className="archive-note">This fish was sold to the local NPC. Its genome and family links are preserved.</p>}
          </> : null}
          {tab === 'Genome' ? <div className="genome-view"><div className="genome-fingerprint"><span>Genome checksum</span><code>{fingerprint(fish.genome)}</code></div><p className="help-copy">Two phased copies per locus. A0–A5 are allele IDs. Most blend; A5/A5 at the metallic switch expresses strong metallic color.</p>{CHROMOSOMES.map((chromosome, chromosomeIndex) => <div className="chromosome" key={chromosome}><h3>{String(chromosomeIndex + 1).padStart(2, '0')} / {chromosome}</h3>{LOCI.slice(chromosomeIndex * 6, chromosomeIndex * 6 + 6).map((locus, j) => {
            const i = chromosomeIndex * 6 + j, mutation = fish.mutations.some(m => m.locus === i);
            return <div className={`locus ${mutation ? 'mutated' : ''}`} key={locus}><span>{label(locus)}{mutation ? ' *' : ''}</span><code>A{fish.genome.maternal[i]}</code><code>A{fish.genome.paternal[i]}</code></div>;
          })}</div>)}<p className="help-copy">* A new mutation in this fish. No global rarity is measured in this offline lab.</p><div className="marking-blocks"><h3>Inherited marking blocks</h3><p className="help-copy">Each pair of neighbouring Pigments or Pattern loci on one chromosome copy places one marking. Siblings that inherit the same copy share it; a crossover or mutation inside the pair moves it.</p><ol>{p.markings.map((anchor, index) => {
            const visible = (anchor.layer === 'dark' ? p.black : p.red) * (1 - p.translucency) >= MARKING_VISIBLE_ALPHA, drawn = index < p.frequency;
            return <li key={anchor.key} className={drawn && visible ? '' : 'muted'}><span className={`marking-swatch ${anchor.layer}`} aria-hidden="true" /><span>{MARKING_BLOCKS[anchor.block].label}<small>A{anchor.alleles[0]}·A{anchor.alleles[1]} · {anchor.origin === 'both' ? 'on both copies (bolder)' : anchor.origin === 'maternal' ? 'copy from mother' : 'copy from father'}</small></span><span>{anchor.layer === 'dark' ? 'Dark' : 'Warm'}{!drawn ? ' · not drawn' : !visible ? ' · too faint' : ''}</span></li>;
          })}</ol></div></div> : null}
          {tab === 'Family' ? <div className="family-view"><p className="help-copy">Select any relative to inspect them. Living fish bring their aquarium into view; sold fish retain an archived profile.</p><h3>Parents</h3>{fish.parents ? fish.parents.map(id => <Relative key={id} fish={world.fish.find(f => f.id === id)!} onSelect={id => select(id, true)} />) : <p className="empty-copy">Founder · no recorded parents.</p>}<div className="family-self">{fish.name}<small>Generation {fish.generation}</small></div><h3>Offspring</h3><Pagination page={childPage} count={children.length} size={pageSize} onPage={setFamilyPage} label="Offspring" />{children.slice(childPage * pageSize, (childPage + 1) * pageSize).map(child => <Relative key={child.id} fish={child} onSelect={id => select(id, true)} />)}{!world.fish.some(f => f.parents?.includes(fish.id)) ? <p className="empty-copy">Their story is just beginning.</p> : null}<p className="help-copy">Pedigree F uses recorded ancestry and assumes unrelated founders. It is different from heterozygosity.</p></div> : null}
        </> : <p className="empty-copy">Select a fish from the aquarium or collection.</p>}
      </aside>
    </div>}
    <footer>Fishtank Sim <span>Research prototype · synthetic genetics · local saves · unbalanced lab economy</span><a href="https://github.com/ElMariones/fishtank-sim" target="_blank" rel="noreferrer">Project repository ↗</a></footer>
  </div>;
}

/** Colour-coded sex symbol (pink ♀, blue ♂). The text label keeps it readable without colour or sight. */
function SexMark({ sex, withLabel = false, decorative = false }: { sex: Fish['sex']; withLabel?: boolean; decorative?: boolean }) {
  const female = sex === 'F', text = female ? 'Female' : 'Male';
  return <span className={`sex-mark ${female ? 'female' : 'male'}`} aria-hidden={decorative || undefined}>
    <span className="sex-symbol" aria-hidden="true">{female ? '♀' : '♂'}</span>
    {withLabel ? <span className="sex-label">{text}</span> : decorative ? null : <span className="visually-hidden">{text}</span>}
  </span>;
}

function Relative({ fish, onSelect }: { fish: Fish; onSelect: (id: string) => void }) {
  return <button className="relative" onClick={() => onSelect(fish.id)}><FishPortrait fish={fish} /><span><strong>{fish.name}</strong><small>G{fish.generation} · <SexMark sex={fish.sex} withLabel />{fish.status === 'sold' ? ' · Sold' : ''}</small></span><span>↗</span></button>;
}

function Pagination({ page, count, size, onPage, label }: { page: number; count: number; size: number; onPage: (page: number) => void; label: string }) {
  if (count <= size) return null;
  return <nav className="pagination" aria-label={`${label} pages`}>
    <button disabled={page === 0} onClick={() => onPage(page - 1)}>Previous {label.toLowerCase()} page</button>
    <span>{page * size + 1}–{Math.min(count, (page + 1) * size)} of {count.toLocaleString()}</span>
    <button disabled={(page + 1) * size >= count} onClick={() => onPage(page + 1)}>Next {label.toLowerCase()} page</button>
  </nav>;
}
