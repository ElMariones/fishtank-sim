import { HabitatPanel } from './HabitatPanel';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { describeAppearance } from '../core/appearance';
import { daysToHatch, environmentLimits, INCUBATION_DAYS, isEgg, lifeStage, type LifeStage } from '../core/development';
import { advanceWorld, tankEnvironment, tankLoad } from '../core/habitat';
import { describeBehavior, type BehaviorSummary } from '../simulation/behavior';
import { AbsencePanel } from './AbsencePanel';
import { CarePanel } from './CarePanel';
import { CHROMOSOMES, GENOME_VERSION, label } from '../core/catalog';
import { alleleLabel, LOCUS_REGISTRY } from '../core/registry';
import { describeStructure } from '../core/structure';
import { mutationNotebook } from '../core/origins';
import { MutationOrigins } from './MutationOrigins';
import { NavRail, TankHud, type TankSummary } from './Shell';
import { AnimatedNumber, Drawer, StatPill, Toast, WorkspaceTabs } from './ShellParts';
import { Icon } from './Icon';
import { careStatus, careWarnings } from '../core/careAdvice';
import { BloodlineRegistration, BloodlineSection } from './Bloodlines';
import { MAX_FOUNDATION } from '../core/bloodlines';
import {
  birthGroupsOf, cohortsOf, decodePreferences, batchSaleCandidates, goalMatch, PREFERENCES_KEY, sortCollection, toggleFavorite, type BreedingGoal, type CollectionSort,
} from '../core/collection';
import { GOAL_DESCRIPTORS } from '../core/breedingGoals';
import { breedingStatus, courtingClutchOf, reservedPlaces, type ClutchSize } from '../core/breeding';
import { offersFor, planBestSales, PRICE_MODEL, saleDetail, type TraitCache } from '../core/economy';
import { BreedingPlanner } from './BreedingPlanner';
import { MarketPanel } from './MarketPanel';
import { ShopPanel } from './ShopPanel';
import { NormalBreeding } from './NormalBreeding';
import { express, fingerprint, heterozygosity, metabolicPotential } from '../core/genetics';
import { MARKING_BLOCKS, MARKING_VISIBLE_ALPHA } from '../core/pattern';
import { genealogyIndex, visitTrail } from '../core/genealogy';
import { createKinshipCache } from '../core/pedigree';
import { completeGuideSteps, decodeGuide, GUIDE_KEY, guideSteps, observedGuideSteps, type GuideStepId } from '../core/onboarding';
import { RELIEF_COOLDOWN_DAYS, RELIEF_THRESHOLD, reliefStatus } from '../core/recovery';
import { advanceRuntime, commandEnvelope, executeCommand, TICK_MS } from '../core/runtime';
import { OnboardingGuide } from './OnboardingGuide';
import type { LoadedSession } from '../persistence/session';
import { ACTIVE_CHECKPOINT_MS } from '../simulation/time';
import { downloadText, SavePanel } from './SavePanel';
import type { Clutch, Fish, Listing, World } from '../core/types';
import { TICKS_PER_GAME_DAY } from '../core/water';
import { COHORT_SIZE, type Command } from '../core/world';
import { Pagination, SexMark } from './Controls';
import { FamilyView } from './FamilyView';
import { FishPortrait, type PortraitView } from './FishPortrait';
import { TankCanvas } from './TankCanvas';
import './styles.css';
import './theme.css';

const ResearchLab = lazy(() => import('./ResearchLab').then(module => ({ default: module.ResearchLab })));
const VisualFixtureLab = lazy(() => import('./VisualFixtureLab').then(module => ({ default: module.VisualFixtureLab })));

const percent = (n: number) => `${(n * 100).toFixed(1)}%`;
const wholePercent = (n: number) => `${Math.round(n * 100)}%`;
const signedCredits = (n: number) => `${n < 0 ? '−' : '+'}◈ ${Math.abs(n)}`;
const date = (timestamp: string) => new Date(timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const descriptorLabel = new Map(GOAL_DESCRIPTORS.map(descriptor => [descriptor.key, descriptor.label]));
type SexFilter = 'all' | Fish['sex'];
type View = 'aquarium' | 'fixtures' | 'research';

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
  /** One workspace panel is open at a time under the live tank (UI overhaul). */
  const [workspace, setWorkspace] = useState<'collection' | 'breeding' | 'care' | 'habitat'>('collection');
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [batchReview, setBatchReview] = useState<'sale' | 'move' | 'rehome' | 'bloodline' | null>(null);
  const [birthKey, setBirthKey] = useState('all');
  const [moveTarget, setMoveTarget] = useState('');
  const [movedTo, setMovedTo] = useState<string | null>(null);
  const [rehomeId, setRehomeId] = useState<string | null>(null);
  const [showMarket, setShowMarket] = useState(false);
  const [showShop, setShowShop] = useState(false);
  // Buyer traits depend only on genomes, so one cache serves every offer this session (FS-501).
  const [traitCache] = useState<TraitCache>(() => new Map());
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
  // First-session guide progress is device-local, like collection preferences, and never part of the world save (FS-504).
  const [guide, setGuide] = useState(() => {
    let raw: string | null = null;
    try { raw = localStorage.getItem(GUIDE_KEY); } catch { /* The guide is optional. */ }
    return decodeGuide(raw, initial.runtime.world);
  });
  const markGuide = (...steps: GuideStepId[]) => setGuide(current => completeGuideSteps(current, steps));
  useEffect(() => {
    if (blocked) return;
    try { localStorage.setItem(GUIDE_KEY, JSON.stringify(guide)); } catch { /* The guide is optional. */ }
  }, [guide, blocked]);
  // Courtships, kept hatched offspring and goals complete their steps as soon as they exist; completion is then stored.
  const observedSteps = useMemo(() => observedGuideSteps(world, preferences).join(' '), [world.fish, world.clutches, preferences]);
  useEffect(() => { if (observedSteps) markGuide(...observedSteps.split(' ') as GuideStepId[]); }, [observedSteps]);

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
  const offers = useMemo(() => fish ? offersFor(world, fish, traitCache) : [], [world, fish, traitCache]);
  // The family index is built only while the Family tab is open (FS-404).
  const genealogy = useMemo(() => tab === 'Family' ? genealogyIndex(world.fish) : null, [tab, world.fish]);
  const notebook = useMemo(() => tab === 'Genome' ? mutationNotebook(world) : null, [tab, world.fish]);
  // Family at a glance under every fish's name (FS-504): one pass for full siblings and offspring.
  const kin = useMemo(() => {
    let siblings = 0, offspring = 0;
    if (fish) for (const member of world.fish) {
      if (member.id === fish.id || !member.parents) continue;
      if (fish.parents && member.parents[0] === fish.parents[0] && member.parents[1] === fish.parents[1]) siblings++;
      if (member.parents.includes(fish.id)) offspring++;
    }
    return { siblings, offspring };
  }, [world.fish, fish]);
  // A lineage needs both sexes; losing one is the only economic dead end, so the aquarium says what to do (FS-504).
  const relief = useMemo(() => reliefStatus(world), [world.fish, world.credits, world.relief]);
  const guideProgress = guideSteps(guide);

  // Collection pipeline: view → cohort → favorites → sex → sort. Counts show what each filter would reveal.
  const viewFish = (showArchived ? world.fish.filter(f => f.status !== 'living') : residents).filter(f => `${f.name} ${f.id}`.toLowerCase().includes(query.toLowerCase()));
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
  const withBuyer = useMemo(() => saleable.filter(f => offersFor(world, f, traitCache).length), [world, saleable.map(f => f.id).join(','), traitCache]);
  const batch = selectable.filter(f => batchIds.includes(f.id));
  const saleBatch = batchSaleCandidates(batch, favoriteIds);
  // The review shows exactly what the batch command pays: highest offers first, each fish to its best offer, using up demand.
  const saleIds = saleBatch.map(f => f.id).join(',');
  const salePlan = useMemo(() => planBestSales(world, saleIds ? saleIds.split(',') : [], traitCache), [world, saleIds, traitCache]);
  const batchTotal = salePlan.total;
  const rehomeBatch = batch.filter(f => !isEgg(f.life) && !courtingClutchOf(world, f.id));
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
  function focusFish(id: string, focusInspector = false, trail: string[] = []) {
    const target = world.fish.find(f => f.id === id);
    if (!target) return false;
    setSelectedId(id); setSaleId(null); setRehomeId(null); setFamilyTrail(trail);
    if (target.status === 'living') { setTankId(target.tankId); setShowArchived(false); }
    if (focusInspector) setFocusRequest(n => n + 1);
    return true;
  }

  /** The player's own selection, which also completes the guide's first step (FS-504). */
  function select(id: string, focusInspector = false, trail: string[] = []) { if (focusFish(id, focusInspector, trail)) markGuide('select'); }

  /** Following a parent completes the guide's family step (FS-504). */
  function navigateFamily(id: string) {
    if (fish?.parents?.includes(id)) markGuide('family');
    select(id, true, visitTrail(familyTrail, selectedId, id));
  }

  /** Parent links under a fish's name open the family view at that parent, with Back to the fish (FS-504). */
  function followRelative(id: string) { navigateFamily(id); setTab('Family'); }

  /** Moves focus to a control once the state change that reveals it has rendered. */
  function focusSoon(id: string) {
    window.setTimeout(() => {
      const element = document.getElementById(id);
      if (!element) return;
      element.scrollIntoView({ block: 'center' });
      element.focus({ preventScroll: true });
    }, 80);
  }

  function openDrawer(which: 'market' | 'shop' | 'saves' | null) {
    setShowMarket(which === 'market'); setShowShop(which === 'shop'); setShowSaves(which === 'saves');
  }

  function openRecovery() { openDrawer('market'); focusSoon('recovery-title'); }

  /** The koi rescue (FS-504): rescued fish join the chosen tank, and the inspector shows the first of them. */
  function claimRelief(tankId: string) {
    const next = run({ type: 'claim-relief', tankId, timestamp: new Date().toISOString(), genomeVersion: GENOME_VERSION }, 'The koi rescue arrived.');
    if (!next) return;
    const rescued = next.fish.slice(-(next.ledger.entries.at(-1)?.fish ?? 1));
    setNotice(`The koi rescue brought ${rescued.map(f => `${f.name} (${f.sex === 'F' ? 'female' : 'male'})`).join(' and ')} to ${tankName(tankId)} at no cost. Rescued fish are unrelated adults, ready to court a partner that shares their tank. The rescue can help again in ${RELIEF_COOLDOWN_DAYS} game days.`);
    setSelectedId(rescued[0].id); setTankId(tankId); setShowArchived(false); setQuery('');
    setSexFilter('all'); setFavoritesOnly(false); setCohortKey('all'); setBirthKey('all'); setCollectionPage(0);
  }

  /** "Show me" in the first-session guide points at the control for a step; it never performs the step itself (FS-504). */
  function showGuideStep(step: GuideStepId) {
    const newest = (match: (f: Fish) => boolean) => { for (let i = world.fish.length - 1; i >= 0; i--) if (match(world.fish[i])) return world.fish[i]; return undefined; };
    const openBreeding = () => { setWorkspace('breeding'); setBreedingOpen(true); setBreedingMode('normal'); focusSoon('planner-mother'); };
    if (step === 'select') { setWorkspace('collection'); setNotice('Click a swimming fish in the aquarium, or choose a card under Your collection.'); focusSoon('collection'); }
    else if (step === 'rename') {
      const target = fish?.status === 'living' ? fish : newest(f => f.status === 'living');
      if (target) { focusFish(target.id); setTab('Overview'); focusSoon('rename-name'); }
    } else if (step === 'feed') focusSoon('feed-button');
    else if (step === 'court') openBreeding();
    else if (step === 'hatch') {
      const clutch = [...world.clutches].reverse().find(entry => entry.firstFishId);
      if (clutch) { showClutch(clutch); setWorkspace('collection'); setNotice('That clutch is now shown in the collection. Once its eggs hatch, star ☆ one you want to keep.'); focusSoon('collection'); }
      else { setNotice('No eggs yet: start a courtship first. Eggs hatch three game days after they are laid.'); openBreeding(); }
    } else if (step === 'family') {
      const target = fish?.parents ? fish : newest(f => f.parents !== null);
      if (target) { focusFish(target.id, true); setTab('Family'); setNotice(`${target.name}’s family is open in the inspector. Choose its mother or father to follow them.`); }
      else { setNotice('Only fish bred here have parents to follow. Start a courtship first.'); openBreeding(); }
    } else { setWorkspace('breeding'); setBreedingOpen(true); focusSoon('planner-add-goal'); }
  }

  function returnToCollection() {
    setWorkspace('collection');
    window.setTimeout(() => {
      const card = document.getElementById(`card-${selectedId}`);
      (card ?? document.getElementById('collection'))?.focus();
    }, 60);
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
    setWorkspace('collection');
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
    const ids = salePlan.sales.map(sale => sale.fishId), total = batchTotal, buyers = saleDetail(salePlan);
    if (run({ type: 'sell-batch', fishIds: ids, priceModel: PRICE_MODEL }, `${ids.length} fish sold for ◈ ${total.toLocaleString()} (${buyers}). Their archived profiles remain in the family tree.`)) {
      setBatchIds([]); setBatchReview(null); setSaleId(null);
    }
  }

  /** Economy-neutral rehoming (FS-501): the fish leave the aquarium, no credits change and their records stay. */
  function rehomeSelected() {
    const ids = rehomeBatch.map(f => f.id);
    if (run({ type: 'rehome-batch', fishIds: ids }, `${ids.length} fish rehomed outside your aquarium. No credits changed; their archived profiles remain in the family tree.`)) {
      setBatchIds([]); setBatchReview(null);
    }
  }

  /** A shop listing becomes a founder in the chosen tank (FS-502); the collection then shows it. */
  function buyListing(listing: Listing, destinationId: string) {
    const next = run({ type: 'buy-listing', listingId: listing.id, tankId: destinationId, timestamp: new Date().toISOString() },
      `${listing.name} joined ${tankName(destinationId)} for ◈ ${listing.price}. ${listing.note}.`);
    if (next) {
      setSelectedId(next.fish[next.fish.length - 1].id); setTankId(destinationId); setShowArchived(false); setQuery('');
      setSexFilter('all'); setFavoritesOnly(false); setCohortKey('all'); setBirthKey('all'); setCollectionPage(0);
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

  const gameDay = Math.floor(liveTick / TICKS_PER_GAME_DAY);
  const tankSummaries: TankSummary[] = useMemo(() => world.tanks.map(t => {
    const status = careStatus(world, t.id);
    const alert = status.oxygen === 'critical' || status.ammonia === 'high' || status.stocking === 'overstocked' || (status.hatched > 0 && status.fedLevel === 'starving');
    const warn = status.oxygen === 'low' || status.ammonia === 'elevated' || status.stocking === 'heavy' || (status.hatched > 0 && status.fedLevel === 'underfed');
    const here = living.filter(f => f.tankId === t.id);
    return { id: t.id, name: t.name, capacity: t.capacity, living: here.length, eggs: here.filter(f => isEgg(f.life)).length, tone: alert ? 'alert' as const : warn ? 'warn' as const : 'good' as const };
  }), [world, living]);
  const activeStatus = useMemo(() => careStatus(world, tank.id), [world, tank.id]), activeWarnings = useMemo(() => careWarnings(world, tank.id), [world, tank.id]);
  const warningCount = { critical: activeWarnings.filter(w => w.severity === 'critical').length, total: activeWarnings.length };
  const courting = world.clutches.filter(c => c.stage === 'courting').length, incubating = world.clutches.filter(c => c.stage === 'incubating').length;
  const saveState = saveError === 'Saving…' ? 'Saving…' : saveError ? 'Session not saved' : 'Saved on this device';
  const viewTitle = view === 'aquarium' ? tank.name : view === 'research' ? 'Research studies' : 'Visual fixtures';

  return <div className={`app-shell view-${view}`}>
    {view === 'aquarium' ? <><a className="skip-link" href="#collection" onClick={() => setWorkspace('collection')}>Skip to collection</a><a className="skip-link" href="#inspector">Skip to inspector</a></> : null}
    <NavRail view={view} onView={next => { setView(next); openDrawer(null); }} tanks={tankSummaries} activeTankId={tank.id}
      onTank={id => { setTankId(id); setShowArchived(false); setQuery(''); }} onHabitat={() => { setView('aquarium'); setWorkspace('habitat'); focusSoon('workspace-panel'); }}
      credits={world.credits} saveState={saveState} guide={{ done: guideProgress.filter(step => step.done).length, total: guideProgress.length, hidden: guide.hidden }}
      onMarket={() => openDrawer(showMarket ? null : 'market')} onShop={() => openDrawer(showShop ? null : 'shop')} onSaves={() => openDrawer(showSaves ? null : 'saves')}
      onGuide={() => setGuide(current => ({ ...current, hidden: !current.hidden }))} onExport={() => downloadText(JSON.stringify(runtime), 'fishtank-save-v2.json')}
      open={{ market: showMarket, shop: showShop, saves: showSaves }} />
    <div className="shell-main">
    <header className="topbar">
      <div className="topbar-title"><span className="eyebrow">{view === 'aquarium' ? `AQUARIUM ${String(world.tanks.indexOf(tank) + 1).padStart(2, '0')} · GAME DAY ${gameDay}` : 'GENETICS LAB'}</span><strong>{viewTitle}</strong></div>
      <div className="top-stats">
        <StatPill icon="coins" tone="gold" label="lab credits" value={<AnimatedNumber value={world.credits} format={n => `◈ ${n.toLocaleString('en')}`} />} onClick={() => openDrawer(showMarket ? null : 'market')} title="Buyers and ledger" />
        <StatPill icon="fish" tone="aqua" label="living fish" value={<AnimatedNumber value={living.length} />} />
        <StatPill icon="egg" tone="coral" label={`courting · ${incubating} incubating`} value={courting} />
        <StatPill icon="dna" tone="violet" label="records" value={<AnimatedNumber value={world.fish.length} />} />
      </div>
    </header>
    <Drawer open={showSaves} label="Saves" onClose={() => openDrawer(null)}><SavePanel runtime={runtime} session={initial.session} blocked={blocked} readOnly={initial.readOnly} onBusy={value => { saveBusy.current = value; }} onSaved={() => { setBlocked(false); setSaveError(''); }} /></Drawer>
    <Drawer open={showMarket} label="Buyers and ledger" onClose={() => openDrawer(null)}><MarketPanel world={world} readOnly={initial.readOnly} traitCache={traitCache} onClaimRelief={claimRelief} onClose={() => openDrawer(null)} /></Drawer>
    <Drawer open={showShop && view === 'aquarium'} label="NPC shop" wide onClose={() => openDrawer(null)}><ShopPanel world={world} tank={tank} day={gameDay} readOnly={initial.readOnly} traitCache={traitCache} onBuy={buyListing} onClose={() => openDrawer(null)} onRecovery={openRecovery} /></Drawer>
    {view === 'fixtures' ? <Suspense fallback={<p className="loading-card" role="status">Loading visual fixtures…</p>}><VisualFixtureLab onClose={() => setView('aquarium')} /></Suspense> : view === 'research' ? <Suspense fallback={<p className="loading-card" role="status">Loading research…</p>}><ResearchLab onClose={() => setView('aquarium')} /></Suspense> : <div className="workspace">
      <main>
        {saveError && saveError !== 'Saving…' ? <p className="warning" role="alert">{saveError}</p> : null}
        {absence || !guide.hidden || relief.sexes.length ? <div className="notice-strip">
        {absence ? <AbsencePanel summary={absence} notice={initial.resumeNotice} onDismiss={() => setAbsence(null)}
          onOpenTank={id => { setTankId(id); setShowArchived(false); setQuery(''); }} /> : null}
        {guide.hidden ? null : <OnboardingGuide steps={guideProgress} onShow={showGuideStep} onHide={() => setGuide(current => ({ ...current, hidden: true }))} />}
        {relief.sexes.length ? <section className="recovery-alert" aria-labelledby="recovery-alert-title">
          <h2 id="recovery-alert-title">{relief.sexes.length === 2 ? 'No living fish are left' : `No living ${relief.sexes[0] === 'F' ? 'female' : 'male'} is left`}</h2>
          <p>A new generation needs a female and a male. {relief.reason}</p>
          <div className="guide-actions">{world.credits < RELIEF_THRESHOLD * relief.sexes.length
            ? <button className="primary" onClick={openRecovery}>Review recovery options</button>
            : <button className="primary" onClick={() => { openDrawer('shop'); focusSoon('shop-title'); }}>Open NPC shop</button>}</div>
        </section> : null}
        </div> : null}
        <div className="tank-heading"><div><h1>{tank.name}</h1></div>
          <div className="tank-heading-meta"><span className="count-tag"><Icon name="fish" size={14} />{residents.length} / {tank.capacity}</span><span className="count-tag">{tank.planted ? <><Icon name="leaf" size={14} />Planted</> : <><Icon name="wave" size={14} />Open water</>}</span></div></div>
        <section className="aquarium" aria-label="Live aquarium">
          <div className="aquarium-caustics" aria-hidden="true" /><div className="aquarium-bubbles" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <span key={i} />)}</div>
          <TankCanvas fish={swimmers} eggs={residents.length - swimmers.length} tank={tank} selectedId={selectedId} onSelect={select} paused={paused} speed={speed} feedSignal={feedSignal} onBehavior={setBehavior} />
          <TankHud status={activeStatus} warnings={warningCount} paused={paused} onCare={() => { setWorkspace('care'); focusSoon('workspace-panel'); }} />
          {residents.length > swimmers.length ? <span className="egg-badge"><Icon name="egg" size={14} />{residents.length - swimmers.length} eggs incubating</span> : null}
          {!residents.length ? <div className="empty-tank">A little room to evolve.<small>Move a fish here or introduce unrelated stock, which can carry new colors and patterns.</small></div> : null}
          <div className="tank-controls"><div><button aria-label={paused ? 'Resume aquarium' : 'Pause aquarium'} onClick={() => setPaused(v => !v)}><Icon name={paused ? 'play' : 'pause'} size={16} /></button><button onClick={() => setSpeed(v => v === 1 ? 2 : v === 2 ? 4 : 1)} aria-label={`Motion speed ${speed} times`}>{speed}×</button></div><span>Click a fish to inspect · click the water to startle</span><button className="feed-button" id="feed-button" onClick={() => {
            if (run({ type: 'feed', tankId: tank.id }, 'A portion of food joined the water, a quarter of a game day of what these fish need. They eat it over the next hours and leftovers decay. The sinking pellets show hungry, bold fish reaching food first.')) { setFeedSignal(v => v + 1); markGuide('feed'); }
          }}><Icon name="plus" size={16} />Feed</button></div>
        </section>
        <WorkspaceTabs label="Aquarium workspace" active={workspace} onChange={setWorkspace} tabs={[
          { id: 'collection', label: 'Collection', icon: 'grid', badge: residents.length },
          { id: 'breeding', label: 'Breeding', icon: 'heart', badge: courting + incubating || undefined, tone: 'info' },
          { id: 'care', label: 'Care', icon: 'drop', badge: warningCount.total || undefined, tone: warningCount.critical ? 'alert' : 'warn' },
          { id: 'habitat', label: 'Habitat', icon: 'leaf' },
        ]} />
        <div className="workspace-panel" id="workspace-panel" tabIndex={-1} key={workspace}>
        {workspace === 'care' && tank.care ? <div role="tabpanel" id="panel-care" aria-labelledby="tab-care"><CarePanel world={world} tank={tank} tick={liveTick} readOnly={initial.readOnly} defaultOpen onRun={(command, message) => run(command, message) !== null} /></div> : null}
        {workspace === 'habitat' ? <div role="tabpanel" id="panel-habitat" aria-labelledby="tab-habitat"><HabitatPanel key={tank.id} world={world} tank={tank} readOnly={initial.readOnly} expanded onRun={(command, message) => run(command, message) !== null} /></div> : null}
        {workspace === 'breeding' ? <section role="tabpanel" id="panel-breeding" aria-labelledby="tab-breeding" className="breeding-panel is-open">
          <div className="breed-intro">
            <div><div className="eyebrow">THE NEXT GENERATION</div><h2 id="breeding-title">What will they inherit?</h2><p>{breedingOpen ? breedingMode === 'normal' ? 'Pair two adults that share a tank; courtship reserves places in a nursery.' : 'Instant lab cross: twenty eggs at once, without courtship.' : goal ? `Goal active · ${goalLabel}` : 'Breeding planner is tucked away.'}</p></div>
          </div>
          {breedingOpen || workspace === 'breeding' ? <div id="breeding-options" className="breeding-options">
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
        </section> : null}
        {workspace === 'collection' ? <section role="tabpanel" id="panel-collection" aria-labelledby="tab-collection" className="collection"><div id="collection" tabIndex={-1} aria-labelledby="collection-title">
          <div className="collection-heading"><h2 id="collection-title">{showArchived ? 'Archived fish' : 'Your collection'} <span>{collection.length}</span></h2><button className="quiet" onClick={() => { setShowArchived(v => !v); setQuery(''); }}>{showArchived ? 'Show residents' : 'View archive'}</button></div>
          <div className="collection-toolbar"><input aria-label="Search fish" placeholder="Search by name or ID…" value={query} onChange={e => setQuery(e.target.value)} /><button aria-expanded={showShop} onClick={() => openDrawer(showShop ? null : 'shop')}><Icon name="shop" size={16} />NPC shop <span>{world.shop.listings.length} listed</span></button></div>
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
            <FishPortrait fish={parent} view={portraitView} /><span><strong>{parent.name}</strong><small>{parent.sex === 'F' ? 'Mother' : 'Father'} · G{parent.generation}{goal ? ` · ${goalLabel} ${wholePercent(goalMatch(parent, goal))}` : ''}{parent.status !== 'living' ? ` · ${parent.status === 'sold' ? 'Sold' : 'Rehomed'}` : ''}</small></span>
          </button>)}</div> : null}
          {!showArchived && collection.length ? <div className="batch-bar" role="group" aria-label="Batch selection">
            <span className="batch-summary">{batch.length ? <><strong>{batch.length}</strong> selected{salePlan.sales.length ? ` · ${salePlan.sales.length} with offers for ◈ ${batchTotal.toLocaleString()}` : ' · no offers'}</> : 'Select fish to move, sell or rehome together. Favorites and eggs are never sold in bulk. Shift-click selects a range.'}</span>
            <div className="batch-actions">
              <button className="quiet" onClick={() => { setBatchIds(selectable.map(f => f.id)); setBatchReview(null); setMovedTo(null); }}>Select all {selectable.length}{birth ? ' in this clutch' : ''}</button>
              <button className="quiet" onClick={() => { setBatchIds(withBuyer.map(f => f.id)); setBatchReview(null); setMovedTo(null); }} disabled={!withBuyer.length}>Select all with a buyer {withBuyer.length}</button>
              {batch.length ? <button className="quiet" onClick={() => { setBatchIds([]); setBatchReview(null); }}>Clear</button> : null}
              {batch.length && moveDestinations.length ? <button aria-expanded={batchReview === 'move'} aria-controls="batch-review" onClick={openMoveReview}>Review move of {batch.length}</button> : null}
              {rehomeBatch.length ? <button aria-expanded={batchReview === 'rehome'} aria-controls="batch-review" onClick={() => setBatchReview('rehome')}>Review rehoming of {rehomeBatch.length}</button> : null}
              {salePlan.sales.length ? <button className="batch-sell" aria-expanded={batchReview === 'sale'} aria-controls="batch-review" onClick={() => setBatchReview('sale')}>Review sale of {salePlan.sales.length}</button> : null}
              {batch.length && batch.length <= MAX_FOUNDATION && batch.every(f => f.life.lengthCm > 0) ? <button aria-expanded={batchReview === 'bloodline'} aria-controls="batch-review" onClick={() => setBatchReview('bloodline')}>Register bloodline from {batch.length}</button> : null}
            </div>
          </div> : null}
          {movedTo && !batch.length ? <p className="batch-done" role="status">Moved to {tankName(movedTo)}. <button className="quiet" onClick={() => { setTankId(movedTo); setShowArchived(false); setQuery(''); }}>Open {tankName(movedTo)}</button></p> : null}
          {batchReview === 'bloodline' && batch.length ? <BloodlineRegistration world={world} foundation={batch} onRun={run} onDone={() => { setBatchIds([]); setBatchReview(null); }} onCancel={() => setBatchReview(null)} /> : null}
          {batchReview === 'sale' && salePlan.sales.length ? <div className="batch-review" id="batch-review" role="region" aria-labelledby="batch-review-title">
            <h3 id="batch-review-title">Sell {salePlan.sales.length} fish to NPC buyers for ◈ {batchTotal.toLocaleString()}?</h3>
            <p>Fish with the highest offers sell first, each to its best offer, and every sale uses up some of that buyer’s demand. Genomes and family links stay in the archive; sold fish cannot breed, move or be sold again.{batch.length > saleBatch.length ? ` ${batch.length - saleBatch.length} selected ${batch.length - saleBatch.length === 1 ? 'fish is a favorite or an egg and stays' : 'fish are favorites or eggs and stay'}.` : ''}{salePlan.unsold.length ? ` ${salePlan.unsold.length} selected ${salePlan.unsold.length === 1 ? 'fish has no buyer today and stays' : 'fish have no buyer today and stay'}.` : ''}</p>
            <ul>{salePlan.sales.map(sale => {
              const f = world.fish.find(member => member.id === sale.fishId)!;
              return <li key={f.id}><SexMark sex={f.sex} /><span>{f.name}<small>{f.id} · G{f.generation} · {sale.offer.buyerName}</small></span><span>◈ {sale.offer.amount}</span></li>;
            })}</ul>
            <div className="batch-review-actions"><button className="confirm" onClick={sellBatch}>Confirm sale of {salePlan.sales.length}</button><button className="quiet" onClick={() => setBatchReview(null)}>Cancel</button></div>
          </div> : null}
          {batchReview === 'rehome' && rehomeBatch.length ? <div className="batch-review" id="batch-review" role="region" aria-labelledby="batch-review-title">
            <h3 id="batch-review-title">Rehome {rehomeBatch.length} fish outside your aquarium?</h3>
            <p>They leave for new homes. No credits change, and their genomes and family links stay in the archive.{batch.length > rehomeBatch.length ? ` ${batch.length - rehomeBatch.length} selected ${batch.length - rehomeBatch.length === 1 ? 'fish is an egg or courting and stays' : 'fish are eggs or courting and stay'}.` : ''}</p>
            <ul>{rehomeBatch.map(f => <li key={f.id}><SexMark sex={f.sex} /><span>{f.name}<small>{f.id} · G{f.generation} · {lifeSummary(f)}</small></span><span>{favoriteIds.has(f.id) ? '★' : ''}</span></li>)}</ul>
            <div className="batch-review-actions"><button className="confirm" disabled={initial.readOnly} onClick={rehomeSelected}>Confirm rehoming of {rehomeBatch.length}</button><button className="quiet" onClick={() => setBatchReview(null)}>Cancel</button></div>
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
                <FishPortrait fish={f} view={portraitView} /><div className="fish-card-bottom"><strong>{f.name}</strong><small>{f.status === 'living' ? lifeSummary(f) : f.status === 'sold' ? 'Sold · archived' : 'Rehomed · archived'}</small>{goal ? <span className="goal-chip">Match · {goalLabel} {wholePercent(goalMatch(f, goal))}</span> : null}</div>
              </button>
              {f.status === 'living' ? <label className="batch-check"><input type="checkbox" checked={inBatch} aria-label={`Select ${f.name} for a batch move or sale`}
                onChange={event => toggleBatch(f.id, (event.nativeEvent as MouseEvent).shiftKey === true)} /><span aria-hidden="true">{inBatch ? 'Selected' : 'Select'}{favorite ? ' · kept from sales' : isEgg(f.life) ? ' · egg, not for sale' : ''}</span></label> : null}
            </article>;
          })}</div>
          {!collection.length ? <p className="empty-copy">{favoritesOnly && !inCohort.some(f => favoriteIds.has(f.id)) ? 'No favorites here yet. Use ☆ on a card to keep a candidate.' : 'No fish here match this view.'}</p> : null}
        </div></section> : null}
        </div>
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
          <div className="family-glance" role="group" aria-label={`${fish.name}’s family at a glance`}>
            <span>{fish.parents ? <>Parents {fish.parents.map((id, i) => <span key={id}>{i ? ' × ' : ''}{world.fish.some(f => f.id === id)
              ? <button className="link-button" onClick={() => followRelative(id)}>{fishName(id)}</button> : `${id} (record missing)`}</span>)}</> : 'Founder stock · no recorded parents'}</span>
            <span>{fish.parents ? `${kin.siblings} full sibling${kin.siblings === 1 ? '' : 's'} · ` : ''}{kin.offspring} offspring{tab === 'Family' ? null : <> · <button className="link-button" onClick={() => setTab('Family')}>Open family tree</button></>}</span>
          </div>
          <div className="inspector-tabs" role="group" aria-label="Inspector views">{(['Overview', 'Genome', 'Family'] as const).map(t => <button key={t} aria-pressed={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>
          {tab === 'Overview' ? <>
            <form className="rename-form" key={fish.id} onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); if (run({ type: 'rename', fishId: fish.id, name: String(data.get('name')) }, 'Fish name updated.')) markGuide('rename'); }}><label>Given name<input id="rename-name" name="name" aria-label="Given name" defaultValue={fish.name} maxLength={32} required disabled={fish.status !== 'living'} /></label><button disabled={fish.status !== 'living'}>Save</button></form>
            <dl className="facts"><div><dt>Born in the lab</dt><dd>{date(fish.bornAt)}</dd></div><div><dt>Life stage</dt><dd>{lifeSummary(fish)}</dd></div><div><dt>Age</dt><dd>{fish.life.ageDays} game day{fish.life.ageDays === 1 ? '' : 's'}</dd></div><div><dt>Condition</dt><dd>{wholePercent(fish.life.condition)}{selectedLimits.length ? ` · limited by ${selectedLimits.join(', ')}` : ''}</dd></div>{fish.status === 'living' ? <div><dt>Breeding</dt><dd>{breedingStatus(world, fish)}</dd></div> : null}{fish.status === 'living' ? <div><dt>Behavior now</dt><dd>{isEgg(fish.life) ? 'Incubating' : fish.tankId !== tank.id ? 'In another aquarium' : behavior ? describeBehavior(behavior, fishName) : 'Watching…'}</dd></div> : null}<div><dt>Adult length potential</dt><dd>{p.adultLengthCm.toFixed(1)} cm</dd></div>{goal ? <div><dt>Goal · {goalLabel}</dt><dd>{wholePercent(goalMatch(fish, goal))}</dd></div> : null}<div><dt>Best NPC offer</dt><dd>{fish.status !== 'living' ? '—' : offers[0] ? `◈ ${offers[0].amount} · ${offers[0].buyerName}` : isEgg(fish.life) ? 'Eggs cannot be sold' : 'No buyer wants this fish today'}</dd></div><div><dt>Heterozygous loci</dt><dd>{percent(heterozygosity(fish.genome))}</dd></div><div><dt>Pedigree inbreeding F</dt><dd>{percent(currentF)}</dd></div><div><dt>New mutations at birth</dt><dd>{fish.mutations.length}</dd></div></dl>
            {offers[0] ? <details className="offer-details"><summary>Why ◈ {offers[0].amount} from the {offers[0].buyerName.toLowerCase()}</summary>
              <ol>{offers[0].terms.map(term => <li key={term.label}><span>{term.label}</span><span>{signedCredits(term.amount)}</span></li>)}</ol>
              <p>{offers.length > 1 ? `Other offers: ${offers.slice(1).map(offer => `${offer.buyerName} ◈ ${offer.amount}`).join(' · ')}.` : 'No other buyer wants this fish today.'} Offers change as buyers’ demand is used up and recovers each game day.</p>
            </details> : null}
            <div className="trait-block"><div className="eyebrow">INHERITED TENDENCIES</div>{[['Sociability', p.social], ['Boldness', p.bold], ['Activity', p.activity], ['Curiosity', p.curious]].map(([name, value]) => <div className="trait" key={name}><span>{name}</span><meter min="0" max="1" value={Number(value)} aria-label={String(name)} /><span>{Math.round(Number(value) * 100)}</span></div>)}</div>
            <div className="trait-block appearance-block"><div className="eyebrow">APPEARANCE · GENOME V{fish.genome.version}</div>{fish.genome.version === 1 ? <p className="help-copy">Genome v1 fish carry no Color or Ornament chromosomes and keep the classic look. Their offspring carry both chromosomes, where a new mutation can appear.</p> : null}<dl className="appearance-traits">{appearanceRows.map(row => <div key={row.trait}><dt>{row.trait}</dt><dd>{row.value}{row.rarity ? <span className={`rarity ${row.rarity.replace(' ', '-')}`}>{row.rarity}</span> : null}</dd></div>)}</dl>{appearanceRows.some(row => row.rarity) ? <p className="help-copy">Rarity describes founder stock, not your aquarium or any global population.</p> : null}</div>
            <div className="trait-block appearance-block structure-block"><div className="eyebrow">STRUCTURE · GENOME V{fish.genome.version}</div>{fish.genome.version < 3 ? <p className="help-copy">Genome v{fish.genome.version} fish carry no Structure chromosome and keep a standard tail, dorsal fin and two barbels. Their offspring carry it, where a rare structural mutation can appear.</p> : null}<dl className="appearance-traits">{describeStructure(fish.genome).map(row => <div key={row.trait}><dt>{row.trait}</dt><dd>{row.value}{row.carrier ? <span className="rarity carrier">hidden copy</span> : null}</dd></div>)}</dl></div>
            {fish.status === 'living' ? <div className="fish-actions"><label>Move to aquarium<select aria-label="Move to aquarium" value={fish.tankId} onChange={event => {
              if (run({ type: 'move', fishId: fish.id, tankId: event.target.value }, `${fish.name} moved to another aquarium.`)) setTankId(event.target.value);
            }}>{world.tanks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label><button onClick={() => { if (fish.sex === 'F') setMotherId(fish.id); else setFatherId(fish.id); setNotice(`${fish.name} selected as ${fish.sex === 'F' ? 'mother' : 'father'}.${goal ? ' Your breeding goal is unchanged.' : ''}`); }}>Select as {fish.sex === 'F' ? 'mother' : 'father'}</button>
              {saleId === fish.id && offers[0] ? <div className="sale-confirm"><p>Sell {fish.name} to the {offers[0].buyerName.toLowerCase()} for ◈ {offers[0].amount}? Their family record remains available.</p><button onClick={() => { const offer = offers[0]; run({ type: 'sell', fishId: fish.id, priceModel: PRICE_MODEL }, `${fish.name} sold to the ${offer.buyerName.toLowerCase()} for ◈ ${offer.amount}. The archived profile remains in the family tree.`); setSaleId(null); }}>Confirm sale</button><button className="quiet" onClick={() => setSaleId(null)}>Cancel</button></div>
                : rehomeId === fish.id ? <div className="sale-confirm"><p>Rehome {fish.name} outside your aquarium? No credits change, and their family record remains available.</p><button onClick={() => { run({ type: 'rehome-batch', fishIds: [fish.id] }, `${fish.name} was rehomed. The archived profile remains in the family tree.`); setRehomeId(null); }}>Confirm rehoming</button><button className="quiet" onClick={() => setRehomeId(null)}>Cancel</button></div>
                : <>{offers[0] ? <button className="quiet sell" onClick={() => { setSaleId(fish.id); setRehomeId(null); }}>Sell to {offers[0].buyerName} · ◈ {offers[0].amount}</button> : <button className="quiet sell" disabled>No buyer today</button>}<button className="quiet" disabled={isEgg(fish.life)} onClick={() => { setRehomeId(fish.id); setSaleId(null); }}>Rehome · no credits</button></>}
            </div> : <p className="archive-note">{fish.status === 'rehomed' ? 'This fish was rehomed outside your aquarium.' : 'This fish was sold to an NPC buyer.'} Its genome and family links are preserved.</p>}
          </> : null}
          {tab === 'Genome' ? <div className="genome-view"><div className="genome-fingerprint"><span>Genome checksum</span><code>{fingerprint(fish.genome)}</code></div><p className="help-copy">Two phased copies per locus. A0–A5 are allele IDs. Most blend; A5/A5 at the metallic switch expresses strong metallic color. Chromosomes 09–10 (genome v2) hold color and ornament, with named categorical alleles and additive intensity levels. Classic dominates body, accent and eye colors; variants need two nonclassic copies. One motif copy shows faintly, and different motifs mix. Smooth scales dominate variants. Chromosome 11 (genome v3) holds structure: a paired fan or crown tail, a reduced or missing dorsal fin and other barbel counts each need two variant copies, and additive levels shape them. Hidden copies can still pass to offspring.</p>{CHROMOSOMES.map((chromosome, chromosomeIndex) => <div className="chromosome" key={chromosome}><h3>{String(chromosomeIndex + 1).padStart(2, '0')} / {chromosome}{chromosomeIndex * 6 >= fish.genome.maternal.length ? ` · not carried by genome v${fish.genome.version}` : ''}</h3>{LOCUS_REGISTRY.slice(chromosomeIndex * 6, chromosomeIndex * 6 + 6).map(entry => {
            const i = entry.index, locus = entry.id, mutation = fish.mutations.some(m => m.locus === i), inherited = !mutation && fish.origins.some(o => o.locus === i);
            const carried = i < fish.genome.maternal.length, baseline = `Not carried by genome v${fish.genome.version}; reads as ${alleleLabel(locus, entry.baseline ?? 0)}`;
            return <div className={`locus ${i >= 48 ? 'appearance-locus' : ''} ${mutation ? 'mutated' : ''} ${carried ? '' : 'absent'}`} key={locus}><span>{label(locus)}{mutation ? ' *' : inherited ? ' ◆' : ''}</span>{carried ? <><code title="Copy inherited from mother">A{fish.genome.maternal[i]}{i >= 48 ? <small>{alleleLabel(locus, fish.genome.maternal[i])}</small> : null}</code><code title="Copy inherited from father">A{fish.genome.paternal[i]}{i >= 48 ? <small>{alleleLabel(locus, fish.genome.paternal[i])}</small> : null}</code></> : <><code title={baseline}>—</code><code title={baseline}>—</code></>}</div>;
          })}</div>)}<p className="help-copy">* A new mutation in this fish. ◆ A copy inherited from a recorded mutation. No global rarity is measured in this offline lab.</p>{notebook ? <MutationOrigins fish={fish} notebook={notebook} onSelect={id => select(id, true)} /> : null}<div className="marking-blocks"><h3>Inherited marking blocks</h3><p className="help-copy">Each pair of neighbouring Pigments or Pattern loci on one chromosome copy places one marking. Siblings that inherit the same copy share it; a crossover or mutation inside the pair moves it.</p><ol>{p.markings.map((anchor, index) => {
            const visible = (anchor.layer === 'dark' ? p.black : p.red) * (1 - p.translucency) >= MARKING_VISIBLE_ALPHA, drawn = index < p.frequency;
            return <li key={anchor.key} className={drawn && visible ? '' : 'muted'}><span className={`marking-swatch ${anchor.layer}`} aria-hidden="true" /><span>{MARKING_BLOCKS[anchor.block].label}<small>A{anchor.alleles[0]}·A{anchor.alleles[1]} · {anchor.origin === 'both' ? 'on both copies (bolder)' : anchor.origin === 'maternal' ? 'copy from mother' : 'copy from father'}</small></span><span>{anchor.layer === 'dark' ? 'Dark' : 'Warm'}{!drawn ? ' · not drawn' : !visible ? ' · too faint' : ''}</span></li>;
          })}</ol></div></div> : null}
          {tab === 'Family' && genealogy ? <FamilyView key={fish.id} world={world} index={genealogy} fish={fish} depth={familyDepth} trail={familyTrail} pedigreeF={percent(currentF)} founders={fishFounders}
            onDepth={setFamilyDepth} onNavigate={navigateFamily} onBack={() => select(familyTrail[familyTrail.length - 1], true, familyTrail.slice(0, -1))}
            onReturn={() => select(familyTrail[0], true)} /> : null}
          {tab === 'Family' ? <BloodlineSection world={world} fish={fish} onRun={run} onSelect={id => select(id, true)} /> : null}
        </> : <p className="empty-copy">Select a fish from the aquarium or collection.</p>}
      </aside>
    </div>}
    <footer>Fishtank Sim <span>Research prototype · synthetic genetics · local saves · bounded NPC buyers and aquarium expansion</span><a href="https://github.com/ElMariones/fishtank-sim" target="_blank" rel="noreferrer">Project repository ↗</a></footer>
    </div>
    <Toast message={notice} />
  </div>;
}
