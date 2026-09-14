import { useEffect, useMemo, useRef, useState } from 'react';
import { appearanceAlleleLabel, describeAppearance } from '../core/appearance';
import { daysToHatch, environmentLimits, INCUBATION_DAYS, isEgg, lifeStage, type LifeStage } from '../core/development';
import { advanceWorld, tankEnvironment, tankLoad } from '../core/habitat';
import { describeBehavior, type BehaviorSummary } from '../simulation/behavior';
import { AbsencePanel } from './AbsencePanel';
import { CarePanel } from './CarePanel';
import { ALL_LOCI, CHROMOSOMES, GENOME_VERSION, label } from '../core/catalog';
import {
  birthGroupsOf, cohortsOf, decodePreferences, batchSaleCandidates, goalMatch, PREFERENCES_KEY, sortCollection, toggleFavorite, type BreedingGoal, type CollectionSort,
} from '../core/collection';
import { GOAL_DESCRIPTORS } from '../core/breedingGoals';
import { breedingStatus, courtingClutchOf, reservedPlaces, type ClutchSize } from '../core/breeding';
import { BreedingPlanner } from './BreedingPlanner';
import { NormalBreeding } from './NormalBreeding';
import { express, fingerprint, heterozygosity, metabolicPotential } from '../core/genetics';
import { MARKING_BLOCKS, MARKING_VISIBLE_ALPHA } from '../core/pattern';
import { genealogyIndex, visitTrail } from '../core/genealogy';
import { createKinshipCache } from '../core/pedigree';
import { advanceRuntime, commandEnvelope, executeCommand, TICK_MS } from '../core/runtime';
import type { LoadedSession } from '../persistence/session';
import { ACTIVE_CHECKPOINT_MS } from '../simulation/time';
import { downloadText, SavePanel } from './SavePanel';
import type { Clutch, Fish, World } from '../core/types';
import { COHORT_SIZE, quote, STOCK_PRICE, type Command } from '../core/world';
import { Pagination, SexMark } from './Controls';
import { FamilyView } from './FamilyView';
import { FishPortrait, type PortraitView } from './FishPortrait';
import { ResearchLab } from './ResearchLab';
import { TankCanvas } from './TankCanvas';
import { VisualFixtureLab } from './VisualFixtureLab';
import './styles.css';

const percent = (n: number) => `${(n * 100).toFixed(1)}%`;
const wholePercent = (n: number) => `${Math.round(n * 100)}%`;
const date = (timestamp: string) => new Date(timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const descriptorLabel = new Map(GOAL_DESCRIPTORS.map(descriptor => [descriptor.key, descriptor.label]));
type SexFilter = 'all' | Fish['sex'];
type View = 'aquarium' | 'fixtures' | 'research';
const VIEWS: [View, string][] = [['aquarium', 'Aquarium'], ['fixtures', 'Visual fixtures'], ['research', 'Research']];

function readPreferences(world: World) {
  let raw: string | null = null;
  try { raw = localStorage.getItem(PREFERENCES_KEY); } catch { /* Preferences are optional. */ }
  return decodePreferences(raw, new Set(world.fish.map(f => f.id)));
}

const STAGE_LABELS: Record<LifeStage, string> = { egg: 'Egg', fry: 'Fry', juvenile: 'Juvenile', adult: 'Adult', elderly: 'Elderly' };

/** Current stage and size beside the genetic adult length, which remains only a potential (FS-302). */
function lifeSummary(fish: Fish): string {
  const potential = metabolicPotential(fish.genome), stage = lifeStage(fish.life, potential);
  if (stage === 'egg') {
    const days = daysToHatch(fish.life);
    return `Egg · hatches in ${days} game day${days === 1 ? '' : 's'}`;
  }
  const length = fish.life.lengthCm;
  return `${STAGE_LABELS[stage]} · ${length.toFixed(length < 10 ? 1 : 0)} of ${potential.adultLengthCm.toFixed(0)} cm`;
}

export function App({ initial }: { initial: LoadedSession }) {
  const [runtime, setRuntime] = useState(initial.runtime);
  const runtimeRef = useRef(runtime);
  const saveBusy = useRef(false);
  const clockOrigin = useRef({ time: performance.now(), tick: runtime.tick });
  // The display previews the shared clock up to now every five seconds without saving; commands advance the saved runtime.
  const [clockNow, setClockNow] = useState(() => performance.now());
  useEffect(() => {
    const interval = window.setInterval(() => setClockNow(performance.now()), 5_000);
    return () => window.clearInterval(interval);
  }, []);
  const liveTick = Math.max(runtime.tick, clockOrigin.current.tick + Math.floor((clockNow - clockOrigin.current.time) / TICK_MS));
  const world = useMemo(() => advanceWorld(runtime.world, runtime.tick, liveTick), [runtime.world, runtime.tick, liveTick]);
  const [blocked, setBlocked] = useState(initial.blocked);
  const [showSaves, setShowSaves] = useState(false);
  const [preferences, setPreferences] = useState(() => readPreferences(initial.runtime.world));
  const [tankId, setTankId] = useState(initial.runtime.world.tanks[0].id);
  const [selectedId, setSelectedId] = useState(initial.runtime.world.fish.find(f => f.status === 'living')?.id ?? '');
  const [tab, setTab] = useState<'Overview' | 'Genome' | 'Family'>('Overview');
  const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [speed, setSpeed] = useState(1);
  const [feedSignal, setFeedSignal] = useState(0);
  const [behavior, setBehavior] = useState<BehaviorSummary | null>(null);
  // The absence summary already carries the resume notice, so the live status line only points to it.
  const [notice, setNotice] = useState(initial.absence ? 'While you were away: the summary above shows what changed in each tank.'
    : initial.resumeNotice || 'Select a fish to explore its traits and ancestry.');
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
  const [batchReview, setBatchReview] = useState<'sale' | 'move' | null>(null);
  const [birthKey, setBirthKey] = useState('all');
  const [moveTarget, setMoveTarget] = useState('');
  const [movedTo, setMovedTo] = useState<string | null>(null);
  const [lastBatchId, setLastBatchId] = useState<string | null>(null);
  const [collectionPage, setCollectionPage] = useState(0);
  const [familyDepth, setFamilyDepth] = useState(2);
  const [familyTrail, setFamilyTrail] = useState<string[]>([]);
  const [focusRequest, setFocusRequest] = useState(0);
  const [breedingOpen, setBreedingOpen] = useState(true);
  const [heroView, setHeroView] = useState<PortraitView>('current');
  const [absence, setAbsence] = useState(initial.absence);
  const [breedingMode, setBreedingMode] = useState<'normal' | 'lab'>('normal');
  const [nurseryId, setNurseryId] = useState(initial.runtime.world.tanks[1]?.id ?? initial.runtime.world.tanks[0].id);
  const [clutchSize, setClutchSize] = useState<ClutchSize>(20);
  const inspectorHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (blocked || initial.readOnly || !initial.session) return;
    let cancelled = false;
    setSaveError('Saving…');
    void initial.session.save(runtime).then(() => {
      if (!cancelled) setSaveError('');
    }).catch(error => {
      if (!cancelled) setSaveError(`Not saved. ${error instanceof Error ? error.message : 'Storage is unavailable.'} Open Saves to retry or export.`);
    });
    return () => { cancelled = true; };
  }, [runtime, blocked, initial.readOnly, initial.session]);

  // One shared deterministic clock advances visible and background tanks; motion speed remains visual-only.
  // Idle checkpoints are sparse because every commit validates snapshots on the main thread; commands still save at once.
  useEffect(() => {
    if (blocked || initial.readOnly) return;
    const interval = window.setInterval(() => {
      const target = clockOrigin.current.tick + Math.floor((performance.now() - clockOrigin.current.time) / TICK_MS);
      setRuntime(current => {
        const advanced = advanceRuntime(current, Math.max(current.tick, target));
        runtimeRef.current = advanced;
        return advanced;
      });
    }, ACTIVE_CHECKPOINT_MS);
    return () => window.clearInterval(interval);
  }, [blocked, initial.readOnly]);

  useEffect(() => {
    if (blocked) return;
    try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences)); } catch { /* Preferences are optional. */ }
  }, [preferences, blocked]);

  // Keyboard and relative selections move focus to the inspector so it is never lost when the pressed button unmounts.
  useEffect(() => { if (focusRequest) inspectorHeading.current?.focus(); }, [focusRequest]);

  const { goal, favorites } = preferences;
  const portraitView: PortraitView = preferences.portraits ?? 'current';
  const favoriteIds = new Set(favorites);
  const tank = world.tanks.find(t => t.id === tankId) ?? world.tanks[0];
  const fish = world.fish.find(f => f.id === selectedId);
  const living = world.fish.filter(f => f.status === 'living');
  const residents = useMemo(() => world.fish.filter(f => f.tankId === tank.id && f.status === 'living'), [world.fish, tank.id]);
  const swimmers = useMemo(() => residents.filter(f => !isEgg(f.life)), [residents]);
  const breeders = living.filter(f => !isEgg(f.life));
  const p = useMemo(() => fish ? express(fish.genome) : null, [fish]);
  const selectedLimits = useMemo(() => {
    const home = fish?.status === 'living' ? world.tanks.find(t => t.id === fish.tankId) : undefined;
    return home ? environmentLimits(tankEnvironment(home, tankLoad(world.fish, home.id))) : [];
  }, [fish, world]);
  const appearanceRows = useMemo(() => fish ? describeAppearance(fish.genome) : [], [fish]);
  // One kinship cache per session keeps computed pairs as the world grows; recorded parents never change (FS-405).
  const [kinshipCache] = useState(() => createKinshipCache());
  const pedigree = useMemo(() => { kinshipCache.sync(world.fish); return kinshipCache; }, [kinshipCache, world.fish]);
  const prospectiveF = useMemo(() => pedigree.kinship(motherId, fatherId), [pedigree, world.fish, motherId, fatherId]);
  const pairFounders = useMemo(() => pedigree.founders([motherId, fatherId]).founders.length, [pedigree, world.fish, motherId, fatherId]);
  const currentF = useMemo(() => fish ? pedigree.inbreeding(fish.id) : 0, [pedigree, world.fish, fish]);
  const fishFounders = useMemo(() => fish && tab === 'Family' ? pedigree.founders([fish.id]).founders.length : 0, [pedigree, world.fish, fish, tab]);
  // The family index is built only while the Family tab is open (FS-404).
  const genealogy = useMemo(() => tab === 'Family' ? genealogyIndex(world.fish) : null, [tab, world.fish]);

  // Collection pipeline: view → cohort → favorites → sex → sort. Counts show what each filter would reveal.
  const viewFish = (showArchived ? world.fish.filter(f => f.status === 'sold') : residents).filter(f => `${f.name} ${f.id}`.toLowerCase().includes(query.toLowerCase()));
  const cohorts = cohortsOf(viewFish);
  const cohort = cohorts.find(c => c.key === cohortKey) ?? null;
  // Within a parent pair, the clutch filter narrows the view to fish laid together (FS-406).
  const births = cohort ? birthGroupsOf(viewFish, cohort.motherId, cohort.fatherId) : [];
  const birth = births.find(group => group.key === birthKey) ?? null;
  const inCohort = cohort ? viewFish.filter(f => f.parents?.[0] === cohort.motherId && f.parents?.[1] === cohort.fatherId && (!birth || f.bornAt === birth.bornAt)) : viewFish;
  const favoriteFiltered = favoritesOnly ? inCohort.filter(f => favoriteIds.has(f.id)) : inCohort;
  const sexCounts = { all: favoriteFiltered.length, F: favoriteFiltered.filter(f => f.sex === 'F').length, M: favoriteFiltered.filter(f => f.sex === 'M').length };
  const sort: CollectionSort = preferences.sort === 'goal' && !goal ? 'newest' : preferences.sort;
  const collection = sortCollection(sexFilter === 'all' ? favoriteFiltered : favoriteFiltered.filter(f => f.sex === sexFilter), sort, goal);
  const pageSize = 60;
  const page = Math.min(collectionPage, Math.max(0, Math.ceil(collection.length / pageSize) - 1));
  const visibleCollection = collection.slice(page * pageSize, (page + 1) * pageSize);
  useEffect(() => { setCollectionPage(0); }, [tank.id, showArchived, query, sexFilter, favoritesOnly, cohortKey, birthKey, sort, goal]);
  const fishName = (id: string) => world.fish.find(f => f.id === id)?.name ?? id;
  // Batch selection only ever acts on living fish visible in the current collection view. Any of them can be moved;
  // favorites and eggs are never sold in bulk.
  const selectable = collection.filter(f => f.status === 'living');
  const saleable = batchSaleCandidates(collection, favoriteIds);
  const batch = selectable.filter(f => batchIds.includes(f.id));
  const saleBatch = batchSaleCandidates(batch, favoriteIds);
  const batchTotal = saleBatch.reduce((sum, f) => sum + quote(f), 0);
  const freePlaces = (id: string) => {
    const home = world.tanks.find(t => t.id === id);
    return home ? home.capacity - living.filter(f => f.tankId === id).length - reservedPlaces(world, id) : 0;
  };
  const moveDestinations = world.tanks.filter(t => t.id !== tank.id);
  const moveDestination = moveDestinations.find(t => t.id === moveTarget) ?? null;
  const arriving = moveDestination ? batch.filter(f => f.tankId !== moveDestination.id).length : 0;
  const placesAfter = moveDestination ? freePlaces(moveDestination.id) - arriving : 0;
  // A courting fish that leaves its partner behind pauses that courtship (FS-402), so the move review says so first.
  const pausedByMove = moveDestination ? batch.flatMap(f => {
    const clutch = courtingClutchOf(world, f.id);
    if (!clutch) return [];
    const partnerId = clutch.motherId === f.id ? clutch.fatherId : clutch.motherId, partner = world.fish.find(member => member.id === partnerId);
    const partnerTank = batch.some(member => member.id === partnerId) ? moveDestination.id : partner?.tankId;
    return partnerTank === moveDestination.id ? [] : [`${f.name} is courting ${partner?.name ?? 'a partner'}; the courtship pauses until they share a tank again.`];
  }) : [];

  useEffect(() => { setBatchIds([]); setBatchReview(null); setLastBatchId(null); setMovedTo(null); }, [tank.id, showArchived, sexFilter, favoritesOnly, cohortKey, birthKey]);

  function run(command: Command, message: string): World | null {
    if (initial.readOnly) { setNotice('This tab is read-only. Close the editing tab and reload to take control.'); return null; }
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

  /** `trail` is the family breadcrumb to keep; a selection made outside the family view starts a new one. */
  function select(id: string, focusInspector = false, trail: string[] = []) {
    const target = world.fish.find(f => f.id === id);
    if (!target) return;
    setSelectedId(id); setSaleId(null); setFamilyTrail(trail);
    if (target.status === 'living') { setTankId(target.tankId); setShowArchived(false); }
    if (focusInspector) setFocusRequest(n => n + 1);
  }

  function navigateFamily(id: string) { select(id, true, visitTrail(familyTrail, selectedId, id)); }

  function returnToCollection() {
    const card = document.getElementById(`card-${selectedId}`);
    (card ?? document.getElementById('collection'))?.focus();
  }

  function breed() {
    const pairText = ` Showing this clutch of ${fishName(motherId)} × ${fishName(fatherId)}${goal ? `, ranked by ${descriptorLabel.get(goal.descriptor)?.toLowerCase()}` : ''}.`;
    const timestamp = new Date().toISOString();
    const next = run({ type: 'breed', motherId, fatherId, tankId: tank.id, timestamp, genomeVersion: GENOME_VERSION }, `${COHORT_SIZE} eggs laid. They hatch in ${INCUBATION_DAYS} game days and grow fastest in good water; each inherited one recombined copy from each parent.${pairText}`);
    if (next) {
      setSelectedId(next.fish[next.fish.length - COHORT_SIZE].id); setShowArchived(false); setQuery('');
      setCohortKey(`${motherId}×${fatherId}`); setBirthKey(timestamp); setFavoritesOnly(false); setSexFilter('all');
    }
  }

  const tankName = (id: string) => world.tanks.find(t => t.id === id)?.name ?? id;

  function pair() {
    const home = world.fish.find(f => f.id === motherId)?.tankId ?? '';
    run({ type: 'pair', motherId, fatherId, nurseryId, size: clutchSize, timestamp: new Date().toISOString(), genomeVersion: GENOME_VERSION },
      `${fishName(motherId)} and ${fishName(fatherId)} started courting in ${tankName(home)}. ${clutchSize} places are reserved in ${tankName(nurseryId)}; the eggs arrive there when courtship completes.`);
  }

  function cancelClutch(clutch: Clutch) {
    run({ type: 'cancel-clutch', clutchId: clutch.id }, `The courtship of ${fishName(clutch.motherId)} and ${fishName(clutch.fatherId)} was cancelled. ${clutch.size} places in ${tankName(clutch.nurseryId)} are free again.`);
  }

  function showClutch(clutch: Clutch) {
    setTankId(clutch.nurseryId); setShowArchived(false); setQuery(''); setFavoritesOnly(false); setSexFilter('all');
    setCohortKey(`${clutch.motherId}×${clutch.fatherId}`);
    setBirthKey(world.fish.find(f => f.id === clutch.firstFishId)?.bornAt ?? 'all');
    if (clutch.firstFishId) setSelectedId(clutch.firstFishId);
  }

  /** Shift-click extends the last toggle across the visible collection, matching the new checked state. */
  function toggleBatch(id: string, extend: boolean) {
    const visible = selectable.map(f => f.id);
    if (!visible.includes(id)) return;
    const checked = !batchIds.includes(id);
    let affected = [id];
    if (extend && lastBatchId && visible.includes(lastBatchId)) {
      const [from, to] = [visible.indexOf(lastBatchId), visible.indexOf(id)].sort((a, b) => a - b);
      affected = visible.slice(from, to + 1);
    }
    setBatchIds(checked ? [...new Set([...batchIds, ...affected])] : batchIds.filter(existing => !affected.includes(existing)));
    setLastBatchId(id); setBatchReview(null); setMovedTo(null);
  }

  function sellBatch() {
    const count = saleBatch.length, total = batchTotal;
    if (run({ type: 'sell-batch', fishIds: saleBatch.map(f => f.id) }, `${count} fish sold to the local NPC for ◈ ${total.toLocaleString()}. Their archived profiles remain in the family tree.`)) {
      setBatchIds([]); setBatchReview(null); setSaleId(null);
    }
  }

  function openMoveReview() {
    const fits = moveDestinations.find(t => freePlaces(t.id) >= batch.filter(f => f.tankId !== t.id).length);
    setMoveTarget(current => moveDestinations.some(t => t.id === current) ? current : (fits ?? moveDestinations[0]).id);
    setBatchReview('move'); setMovedTo(null);
  }

  /** Batch rehoming (FS-406): one command moves every reviewed fish, or none if any member or the destination fails. */
  function moveBatch() {
    if (!moveDestination) return;
    const count = batch.length, destination = moveDestination;
    if (run({ type: 'move-batch', fishIds: batch.map(f => f.id), tankId: destination.id }, `${count} fish moved from ${tank.name} to ${destination.name} in one transfer. Their records, genomes and family links are unchanged.`)) {
      setBatchIds([]); setBatchReview(null); setMovedTo(destination.id);
    }
  }

  const goalLabel = goal ? goal.secondary?.length ? 'Combined goal' : descriptorLabel.get(goal.descriptor)! : '';

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
      {showSaves ? <SavePanel runtime={runtime} session={initial.session} blocked={blocked} readOnly={initial.readOnly} onBusy={value => { saveBusy.current = value; }} onSaved={() => { setBlocked(false); setSaveError(''); }} /> : null}
    {view === 'fixtures' ? <VisualFixtureLab onClose={() => setView('aquarium')} /> : view === 'research' ? <ResearchLab onClose={() => setView('aquarium')} /> : <div className="workspace">
      <aside className="tank-sidebar">
        <div className="eyebrow">YOUR AQUARIUMS</div>
        <nav aria-label="Aquariums">{world.tanks.map((t, i) => <button key={t.id} className={`tank-link ${t.id === tank.id ? 'active' : ''}`} aria-current={t.id === tank.id ? 'true' : undefined} onClick={() => { setTankId(t.id); setShowArchived(false); setQuery(''); }}>
          <span className="tank-number">0{i + 1}</span><span>{t.name}<small>{living.filter(f => f.tankId === t.id).length} / {t.capacity} fish</small></span>
        </button>)}</nav>
        <button className="add-tank quiet" onClick={() => run({ type: 'add-tank' }, 'A new lab tank is ready.')}>＋ Add lab tank</button>
        <div className="sidebar-note"><span className="eyebrow">A LINEAGE STARTS HERE</span><p>Small differences.<br />Extraordinary descendants.</p><span>60 loci · 10 chromosomes<br />One fish at a time.</span></div>

      </aside>
      <main>
        {saveError && saveError !== 'Saving…' ? <p className="warning" role="alert">{saveError}</p> : null}
        {absence ? <AbsencePanel summary={absence} notice={initial.resumeNotice} onDismiss={() => setAbsence(null)}
          onOpenTank={id => { setTankId(id); setShowArchived(false); setQuery(''); }} /> : null}
        <div className="tank-heading"><div><div className="eyebrow">AQUARIUM / {String(world.tanks.indexOf(tank) + 1).padStart(2, '0')}</div><h1>{tank.name}</h1></div><span className="count-tag">{residents.length} inhabitants</span></div>
        {tank.care ? <CarePanel world={world} tank={tank} tick={liveTick} readOnly={initial.readOnly} onRun={(command, message) => run(command, message) !== null} /> : null}
        <section className="aquarium" aria-label="Live aquarium">
          <TankCanvas fish={swimmers} eggs={residents.length - swimmers.length} tank={tank} selectedId={selectedId} onSelect={select} paused={paused} speed={speed} feedSignal={feedSignal} onBehavior={setBehavior} />
          <div className="tank-overlay"><span>{paused ? 'PAUSED' : 'LIVE AQUARIUM'}</span><span>{tank.planted ? 'Planted habitat' : 'Open water'}{residents.length > swimmers.length ? ` · ${residents.length - swimmers.length} eggs incubating` : ''}</span></div>
          {!residents.length ? <div className="empty-tank">A little room to evolve.<small>Move a fish here or introduce unrelated stock, which can carry new colors and patterns.</small></div> : null}
          <div className="tank-controls"><div><button aria-label={paused ? 'Resume aquarium' : 'Pause aquarium'} onClick={() => setPaused(v => !v)}>{paused ? '▶' : 'Ⅱ'}</button><button onClick={() => setSpeed(v => v === 1 ? 2 : v === 2 ? 4 : 1)} aria-label={`Motion speed ${speed} times`}>{speed}×</button></div><span>Click a fish to inspect · click the water to startle</span><button className="feed-button" onClick={() => {
            if (run({ type: 'feed', tankId: tank.id }, 'A portion of food joined the water, a quarter of a game day of what these fish need. They eat it over the next hours and leftovers decay. The sinking pellets show hungry, bold fish reaching food first.')) setFeedSignal(v => v + 1);
          }}>＋ Feed</button></div>
        </section>
        <div className="habitat-toolbar"><span>Fish swim at their current stage and size · portraits can show adult potential</span><button className="quiet" onClick={() => run({ type: 'decorate', tankId: tank.id }, 'Habitat updated. Plants offer cover and fish steer around rocks. Water and growth are unchanged by decorations.')}>{tank.planted ? 'Remove plants and rocks' : 'Add plants and rocks'}</button></div>
        <section className={`breeding-panel ${breedingOpen ? 'is-open' : 'is-collapsed'}`} aria-labelledby="breeding-title">
          <div className="breed-intro">
            <div><div className="eyebrow">THE NEXT GENERATION</div><h2 id="breeding-title">What will they inherit?</h2><p>{breedingOpen ? breedingMode === 'normal' ? 'Pair two adults that share a tank; courtship reserves places in a nursery.' : 'Instant lab cross: twenty eggs at once, without courtship.' : goal ? `Goal active · ${goalLabel}` : 'Breeding planner is tucked away.'}</p></div>
            <button className="breeding-toggle" aria-expanded={breedingOpen} aria-controls="breeding-options" onClick={() => setBreedingOpen(value => !value)}>{breedingOpen ? 'Hide options' : 'Open breeding options'}<span aria-hidden="true">{breedingOpen ? '⌃' : '⌄'}</span></button>
          </div>
          {breedingOpen ? <div id="breeding-options" className="breeding-options">
            <div className="framing-toggle breeding-mode" role="group" aria-label="Breeding mode">
              <button aria-pressed={breedingMode === 'normal'} onClick={() => setBreedingMode('normal')}>Normal breeding</button>
              <button aria-pressed={breedingMode === 'lab'} onClick={() => setBreedingMode('lab')}>Instant lab cross</button>
            </div>
            <BreedingPlanner fish={world.fish} tanks={world.tanks} goal={goal} motherId={motherId} fatherId={fatherId} onMother={setMotherId} onFather={setFatherId}
              onGoal={(next: BreedingGoal | null) => setPreferences(current => ({ ...current, goal: next, sort: next ? 'goal' : current.sort === 'goal' ? 'newest' : current.sort }))} />
            {breedingMode === 'normal' ? <>
              <NormalBreeding world={world} motherId={motherId} fatherId={fatherId} nurseryId={nurseryId} size={clutchSize} readOnly={initial.readOnly}
                onNursery={setNurseryId} onSize={setClutchSize} onPair={pair} onCancel={cancelClutch} onShowClutch={showClutch} />
              <p className="help-copy">Expected pedigree F: {percent(prospectiveF)}, from recorded ancestry; {pairFounders === 1 ? 'the one founder behind this pair is' : `the ${pairFounders} founders behind this pair are`} assumed unrelated and not inbred. Parents must be adults with at least 70% condition, not resting after a clutch, and in the same tank. Courtship pauses, with the reason shown, if they are separated, their condition falls or the water turns harsh.</p>
            </> : <>
              <div className="breed-action"><button className="primary" onClick={breed} disabled={!breeders.some(f => f.id === motherId) || !breeders.some(f => f.id === fatherId) || residents.length + reservedPlaces(world, tank.id) + COHORT_SIZE > tank.capacity}>Breed 20 offspring <span>↗</span></button><small>Expected pedigree F: {percent(prospectiveF)}</small></div>
              <p className="help-copy">Clutch destination: {tank.name} · {tank.capacity - residents.length - reservedPlaces(world, tank.id)} free places · {COHORT_SIZE} required.</p>
              <p className="lab-note">Research shortcut: an instant cross skips maturity, condition, rest days, courtship and shared-habitat checks, and lays twenty eggs in this tank at once. Eggs still hatch after {INCUBATION_DAYS} game days and grow under this tank’s care. Goal values are normalized adult genetic potential.</p>
            </>}
          </div> : null}
        </section>
        <div className="status-line" role="status" aria-live="polite">{notice}</div>
        <section className="collection" id="collection" tabIndex={-1} aria-labelledby="collection-title">
          <div className="collection-heading"><h2 id="collection-title">{showArchived ? 'Archived fish' : 'Your collection'} <span>{collection.length}</span></h2><button className="quiet" onClick={() => { setShowArchived(v => !v); setQuery(''); }}>{showArchived ? 'Show residents' : 'View archive'}</button></div>
          <div className="collection-toolbar"><input aria-label="Search fish" placeholder="Search by name or ID…" value={query} onChange={e => setQuery(e.target.value)} /><button onClick={() => {
            const next = run({ type: 'buy', tankId: tank.id, timestamp: new Date().toISOString(), genomeVersion: GENOME_VERSION }, 'Unrelated founder stock introduced. This is a local NPC purchase.');
            if (next) { setSelectedId(next.fish.at(-1)!.id); setShowArchived(false); setQuery(''); }
          }}>＋ Unrelated stock <span>◈ {STOCK_PRICE}</span></button></div>
          <div className="collection-filters">
            <div className="sex-filter" role="group" aria-label="Show fish by sex">
              {(['all', 'F', 'M'] as const).map(value => <button key={value} aria-pressed={sexFilter === value} onClick={() => setSexFilter(value)}>
                {value === 'all' ? 'All' : <><SexMark sex={value} decorative />{value === 'F' ? 'Females' : 'Males'}</>}<span className="filter-count">{sexCounts[value]}</span>
              </button>)}
            </div>
            <button className="pill-toggle" aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(v => !v)}><span aria-hidden="true">★</span>Favorites<span className="filter-count">{inCohort.filter(f => favoriteIds.has(f.id)).length}</span></button>
            <label className="inline-select">Parents<select value={cohort ? cohort.key : 'all'} onChange={event => { setCohortKey(event.target.value); setBirthKey('all'); }}>
              <option value="all">All parents</option>{cohorts.map(c => <option key={c.key} value={c.key}>{fishName(c.motherId)} × {fishName(c.fatherId)} · {c.size}</option>)}
            </select></label>
            {births.length > 1 || birth ? <label className="inline-select">Clutch<select value={birth ? birth.key : 'all'} onChange={event => setBirthKey(event.target.value)}>
              <option value="all">All {births.length} clutches</option>{births.map(group => <option key={group.key} value={group.key}>#{Number(group.firstId.slice(4))}–{Number(group.lastId.slice(4))} · {group.size} fish</option>)}
            </select></label> : null}
            <label className="inline-select">Sort<select value={sort} onChange={event => setPreferences(current => ({ ...current, sort: event.target.value as CollectionSort }))}>
              <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Name</option><option value="goal" disabled={!goal}>{goal ? `${goalLabel} · best match first` : 'Breeding goal (set one first)'}</option>
            </select></label>
            <div className="framing-toggle portrait-toggle" role="group" aria-label="Collection portraits show">
              <button aria-pressed={portraitView === 'current'} onClick={() => setPreferences(current => ({ ...current, portraits: 'current' }))}>Now</button>
              <button aria-pressed={portraitView === 'adult'} onClick={() => setPreferences(current => ({ ...current, portraits: 'adult' }))}>Adult potential</button>
            </div>
          </div>
          {cohort ? <div className="cohort-parents" role="group" aria-label="Parents of this cohort">{[cohort.motherId, cohort.fatherId].flatMap(id => world.fish.filter(f => f.id === id)).map(parent => <button className="cohort-parent" key={parent.id} onClick={event => select(parent.id, event.detail === 0)}>
            <FishPortrait fish={parent} view={portraitView} /><span><strong>{parent.name}</strong><small>{parent.sex === 'F' ? 'Mother' : 'Father'} · G{parent.generation}{goal ? ` · ${goalLabel} ${wholePercent(goalMatch(parent, goal))}` : ''}{parent.status === 'sold' ? ' · Sold' : ''}</small></span>
          </button>)}</div> : null}
          {!showArchived && collection.length ? <div className="batch-bar" role="group" aria-label="Batch selection">
            <span className="batch-summary">{batch.length ? <><strong>{batch.length}</strong> selected{saleBatch.length ? ` · ${saleBatch.length} saleable for ◈ ${batchTotal.toLocaleString()}` : ' · none saleable'}</> : 'Select fish to move or sell together. Favorites and eggs are never sold in bulk. Shift-click selects a range.'}</span>
            <div className="batch-actions">
              <button className="quiet" onClick={() => { setBatchIds(selectable.map(f => f.id)); setBatchReview(null); setMovedTo(null); }}>Select all {selectable.length}{birth ? ' in this clutch' : ''}</button>
              <button className="quiet" onClick={() => { setBatchIds(saleable.map(f => f.id)); setBatchReview(null); setMovedTo(null); }}>Select all saleable {saleable.length}</button>
              {batch.length ? <button className="quiet" onClick={() => { setBatchIds([]); setBatchReview(null); }}>Clear</button> : null}
              {batch.length && moveDestinations.length ? <button aria-expanded={batchReview === 'move'} aria-controls="batch-review" onClick={openMoveReview}>Review move of {batch.length}</button> : null}
              {saleBatch.length ? <button className="batch-sell" aria-expanded={batchReview === 'sale'} aria-controls="batch-review" onClick={() => setBatchReview('sale')}>Review sale of {saleBatch.length}</button> : null}
            </div>
          </div> : null}
          {movedTo && !batch.length ? <p className="batch-done" role="status">Moved to {tankName(movedTo)}. <button className="quiet" onClick={() => { setTankId(movedTo); setShowArchived(false); setQuery(''); }}>Open {tankName(movedTo)}</button></p> : null}
          {batchReview === 'sale' && saleBatch.length ? <div className="batch-review" id="batch-review" role="region" aria-labelledby="batch-review-title">
            <h3 id="batch-review-title">Sell {saleBatch.length} fish to the local NPC for ◈ {batchTotal.toLocaleString()}?</h3>
            <p>Their genomes and family links stay in the archive. Sold fish cannot breed, move or be sold again.{batch.length > saleBatch.length ? ` ${batch.length - saleBatch.length} selected ${batch.length - saleBatch.length === 1 ? 'fish is a favorite or an egg and stays' : 'fish are favorites or eggs and stay'}.` : ''}</p>
            <ul>{saleBatch.map(f => <li key={f.id}><SexMark sex={f.sex} /><span>{f.name}<small>{f.id} · G{f.generation}</small></span><span>◈ {quote(f)}</span></li>)}</ul>
            <div className="batch-review-actions"><button className="confirm" onClick={sellBatch}>Confirm sale of {saleBatch.length}</button><button className="quiet" onClick={() => setBatchReview(null)}>Cancel</button></div>
          </div> : null}
          {batchReview === 'move' && batch.length && moveDestination ? <div className="batch-review move-review" id="batch-review" role="region" aria-labelledby="batch-review-title">
            <h3 id="batch-review-title">Move {batch.length} fish from {tank.name} to {moveDestination.name}?</h3>
            <label className="inline-select">Destination<select value={moveDestination.id} onChange={event => setMoveTarget(event.target.value)}>
              {moveDestinations.map(t => <option key={t.id} value={t.id}>{t.name} · {Math.max(0, freePlaces(t.id))} free</option>)}
            </select></label>
            <p>{moveDestination.name} has {Math.max(0, freePlaces(moveDestination.id))} free places{reservedPlaces(world, moveDestination.id) ? `, after ${reservedPlaces(world, moveDestination.id)} reserved for a courting clutch` : ''}; {placesAfter >= 0 ? `${placesAfter} remain after this move` : `that is ${-placesAfter} too few for this move`}. Records, genomes, family links and clutch records do not change{batch.some(f => isEgg(f.life)) ? ', and moved eggs keep incubating' : ''}.</p>
            {pausedByMove.map(text => <p className="move-warning" key={text}>{text}</p>)}
            <ul>{batch.map(f => <li key={f.id}><SexMark sex={f.sex} /><span>{f.name}<small>{f.id} · G{f.generation} · {lifeSummary(f)}</small></span><span>{favoriteIds.has(f.id) ? '★' : ''}</span></li>)}</ul>
            <div className="batch-review-actions"><button className="confirm" disabled={placesAfter < 0 || initial.readOnly} onClick={moveBatch}>Confirm move of {batch.length}</button><button className="quiet" onClick={() => setBatchReview(null)}>Cancel</button></div>
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
                <FishPortrait fish={f} view={portraitView} /><div className="fish-card-bottom"><strong>{f.name}</strong><small>{f.status === 'sold' ? 'Archived' : lifeSummary(f)}</small>{goal ? <span className="goal-chip">Match · {goalLabel} {wholePercent(goalMatch(f, goal))}</span> : null}</div>
              </button>
              {f.status === 'living' ? <label className="batch-check"><input type="checkbox" checked={inBatch} aria-label={`Select ${f.name} for a batch move or sale`}
                onChange={event => toggleBatch(f.id, (event.nativeEvent as MouseEvent).shiftKey === true)} /><span aria-hidden="true">{inBatch ? 'Selected' : 'Select'}{favorite ? ' · kept from sales' : isEgg(f.life) ? ' · egg, not for sale' : ''}</span></label> : null}
            </article>;
          })}</div>
          {!collection.length ? <p className="empty-copy">{favoritesOnly && !inCohort.some(f => favoriteIds.has(f.id)) ? 'No favorites here yet. Use ☆ on a card to keep a candidate.' : 'No fish here match this view.'}</p> : null}
        </section>
      </main>
      <aside className="inspector" id="inspector" tabIndex={-1} aria-label="Fish inspector">
        {fish && p ? <>
          <div className="inspector-heading"><span className="eyebrow">SPECIMEN {fish.id.slice(4)}</span><span className="inspector-heading-actions"><button className="quiet back-to-card" onClick={returnToCollection}>↩ Collection</button><span className="generation">G{fish.generation}</span></span></div>
          <div className="hero-portrait">
            <div className="framing-toggle hero-toggle" role="group" aria-label="Large portrait shows">
              <button aria-pressed={heroView === 'current'} onClick={() => setHeroView('current')}>{fish.status === 'living' ? 'Now' : 'Last recorded'}</button>
              <button aria-pressed={heroView === 'adult'} onClick={() => setHeroView('adult')}>Adult potential</button>
            </div>
            <FishPortrait fish={fish} large view={heroView} />
            <span>{heroView === 'adult' ? 'ADULT GENETIC POTENTIAL · A PREVIEW, NOT HOW THIS FISH LOOKS TODAY' : `${fish.status === 'living' ? 'NOW' : 'LAST RECORDED'} · ${lifeSummary(fish).toUpperCase()}`}</span>
          </div>
          <div className="fish-title"><h2 ref={inspectorHeading} tabIndex={-1}>{fish.name}</h2><SexMark sex={fish.sex} withLabel /></div>
          <p className="fish-subtitle">Koi ancestry · {fish.parents ? 'Bred in your aquarium' : 'Founder stock'}{favoriteIds.has(fish.id) ? ' · ★ Favorite' : ''}</p>
          <div className="inspector-tabs" role="group" aria-label="Inspector views">{(['Overview', 'Genome', 'Family'] as const).map(t => <button key={t} aria-pressed={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>
          {tab === 'Overview' ? <>
            <form className="rename-form" key={fish.id} onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); run({ type: 'rename', fishId: fish.id, name: String(data.get('name')) }, 'Fish name updated.'); }}><label>Given name<input name="name" aria-label="Given name" defaultValue={fish.name} maxLength={32} required disabled={fish.status !== 'living'} /></label><button disabled={fish.status !== 'living'}>Save</button></form>
            <dl className="facts"><div><dt>Born in the lab</dt><dd>{date(fish.bornAt)}</dd></div><div><dt>Life stage</dt><dd>{lifeSummary(fish)}</dd></div><div><dt>Age</dt><dd>{fish.life.ageDays} game day{fish.life.ageDays === 1 ? '' : 's'}</dd></div><div><dt>Condition</dt><dd>{wholePercent(fish.life.condition)}{selectedLimits.length ? ` · limited by ${selectedLimits.join(', ')}` : ''}</dd></div>{fish.status === 'living' ? <div><dt>Breeding</dt><dd>{breedingStatus(world, fish)}</dd></div> : null}{fish.status === 'living' ? <div><dt>Behavior now</dt><dd>{isEgg(fish.life) ? 'Incubating' : fish.tankId !== tank.id ? 'In another aquarium' : behavior ? describeBehavior(behavior, fishName) : 'Watching…'}</dd></div> : null}<div><dt>Adult length potential</dt><dd>{p.adultLengthCm.toFixed(1)} cm</dd></div>{goal ? <div><dt>Goal · {goalLabel}</dt><dd>{wholePercent(goalMatch(fish, goal))}</dd></div> : null}<div><dt>Lab sale quote</dt><dd>◈ {quote(fish)}</dd></div><div><dt>Heterozygous loci</dt><dd>{percent(heterozygosity(fish.genome))}</dd></div><div><dt>Pedigree inbreeding F</dt><dd>{percent(currentF)}</dd></div><div><dt>New mutations at birth</dt><dd>{fish.mutations.length}</dd></div></dl>
            <div className="trait-block"><div className="eyebrow">INHERITED TENDENCIES</div>{[['Sociability', p.social], ['Boldness', p.bold], ['Activity', p.activity], ['Curiosity', p.curious]].map(([name, value]) => <div className="trait" key={name}><span>{name}</span><meter min="0" max="1" value={Number(value)} aria-label={String(name)} /><span>{Math.round(Number(value) * 100)}</span></div>)}</div>
            <div className="trait-block appearance-block"><div className="eyebrow">APPEARANCE · GENOME V{fish.genome.version}</div>{fish.genome.version === 1 ? <p className="help-copy">Genome v1 fish carry no Color or Ornament chromosomes and keep the classic look. Their offspring carry both chromosomes, where a new mutation can appear.</p> : null}<dl className="appearance-traits">{appearanceRows.map(row => <div key={row.trait}><dt>{row.trait}</dt><dd>{row.value}{row.rarity ? <span className={`rarity ${row.rarity.replace(' ', '-')}`}>{row.rarity}</span> : null}</dd></div>)}</dl>{appearanceRows.some(row => row.rarity) ? <p className="help-copy">Rarity describes founder stock, not your aquarium or any global population.</p> : null}</div>
            {fish.status === 'living' ? <div className="fish-actions"><label>Move to aquarium<select aria-label="Move to aquarium" value={fish.tankId} onChange={event => {
              if (run({ type: 'move', fishId: fish.id, tankId: event.target.value }, `${fish.name} moved to another aquarium.`)) setTankId(event.target.value);
            }}>{world.tanks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label><button onClick={() => { if (fish.sex === 'F') setMotherId(fish.id); else setFatherId(fish.id); setNotice(`${fish.name} selected as ${fish.sex === 'F' ? 'mother' : 'father'}.${goal ? ' Your breeding goal is unchanged.' : ''}`); }}>Select as {fish.sex === 'F' ? 'mother' : 'father'}</button>
              {saleId === fish.id ? <div className="sale-confirm"><p>Sell {fish.name} to the local NPC for ◈ {quote(fish)}? Their family record remains available.</p><button onClick={() => { run({ type: 'sell', fishId: fish.id }, `${fish.name} sold. The archived profile remains in the family tree.`); setSaleId(null); }}>Confirm sale</button><button className="quiet" onClick={() => setSaleId(null)}>Cancel</button></div> : <button className="quiet sell" onClick={() => setSaleId(fish.id)}>Sell to local NPC · ◈ {quote(fish)}</button>}
            </div> : <p className="archive-note">This fish was sold to the local NPC. Its genome and family links are preserved.</p>}
          </> : null}
          {tab === 'Genome' ? <div className="genome-view"><div className="genome-fingerprint"><span>Genome checksum</span><code>{fingerprint(fish.genome)}</code></div><p className="help-copy">Two phased copies per locus. A0–A5 are allele IDs. Most blend; A5/A5 at the metallic switch expresses strong metallic color. Chromosomes 09–10 (genome v2) hold color and ornament, with named categorical alleles and additive intensity levels. Classic dominates body, accent and eye colors; variants need two nonclassic copies. One motif copy shows faintly, and different motifs mix. Smooth scales dominate variants. Hidden copies can still pass to offspring.</p>{CHROMOSOMES.map((chromosome, chromosomeIndex) => <div className="chromosome" key={chromosome}><h3>{String(chromosomeIndex + 1).padStart(2, '0')} / {chromosome}{chromosomeIndex * 6 >= fish.genome.maternal.length ? ' · not carried by genome v1' : ''}</h3>{ALL_LOCI.slice(chromosomeIndex * 6, chromosomeIndex * 6 + 6).map((locus, j) => {
            const i = chromosomeIndex * 6 + j, mutation = fish.mutations.some(m => m.locus === i);
            const carried = i < fish.genome.maternal.length;
            return <div className={`locus ${i >= 48 ? 'appearance-locus' : ''} ${mutation ? 'mutated' : ''} ${carried ? '' : 'absent'}`} key={locus}><span>{label(locus)}{mutation ? ' *' : ''}</span>{carried ? <><code title="Copy inherited from mother">A{fish.genome.maternal[i]}{i >= 48 ? <small>{appearanceAlleleLabel(locus, fish.genome.maternal[i])}</small> : null}</code><code title="Copy inherited from father">A{fish.genome.paternal[i]}{i >= 48 ? <small>{appearanceAlleleLabel(locus, fish.genome.paternal[i])}</small> : null}</code></> : <><code title="Not carried by genome v1; reads as classic">—</code><code title="Not carried by genome v1; reads as classic">—</code></>}</div>;
          })}</div>)}<p className="help-copy">* A new mutation in this fish. No global rarity is measured in this offline lab.</p><div className="marking-blocks"><h3>Inherited marking blocks</h3><p className="help-copy">Each pair of neighbouring Pigments or Pattern loci on one chromosome copy places one marking. Siblings that inherit the same copy share it; a crossover or mutation inside the pair moves it.</p><ol>{p.markings.map((anchor, index) => {
            const visible = (anchor.layer === 'dark' ? p.black : p.red) * (1 - p.translucency) >= MARKING_VISIBLE_ALPHA, drawn = index < p.frequency;
            return <li key={anchor.key} className={drawn && visible ? '' : 'muted'}><span className={`marking-swatch ${anchor.layer}`} aria-hidden="true" /><span>{MARKING_BLOCKS[anchor.block].label}<small>A{anchor.alleles[0]}·A{anchor.alleles[1]} · {anchor.origin === 'both' ? 'on both copies (bolder)' : anchor.origin === 'maternal' ? 'copy from mother' : 'copy from father'}</small></span><span>{anchor.layer === 'dark' ? 'Dark' : 'Warm'}{!drawn ? ' · not drawn' : !visible ? ' · too faint' : ''}</span></li>;
          })}</ol></div></div> : null}
          {tab === 'Family' && genealogy ? <FamilyView key={fish.id} world={world} index={genealogy} fish={fish} depth={familyDepth} trail={familyTrail} pedigreeF={percent(currentF)} founders={fishFounders}
            onDepth={setFamilyDepth} onNavigate={navigateFamily} onBack={() => select(familyTrail[familyTrail.length - 1], true, familyTrail.slice(0, -1))}
            onReturn={() => select(familyTrail[0], true)} /> : null}
        </> : <p className="empty-copy">Select a fish from the aquarium or collection.</p>}
      </aside>
    </div>}
    <footer>Fishtank Sim <span>Research prototype · synthetic genetics · local saves · unbalanced lab economy</span><a href="https://github.com/ElMariones/fishtank-sim" target="_blank" rel="noreferrer">Project repository ↗</a></footer>
  </div>;
}
