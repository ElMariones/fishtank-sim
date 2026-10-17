import { HabitatPanel } from './HabitatPanel';
import { AquascapeDock, AquascapeOverlay, createDraftStore, draftFor, type DraftStore } from './AquascapeEditor';
import { decorationsOf } from '../core/tankManagement';
import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { describeAppearance } from '../core/appearance';
import { environmentLimits, INCUBATION_DAYS, isEgg } from '../core/development';
import { tankEnvironment, tankLoad } from '../core/habitat';
import { absenceObserver } from '../core/absence';
import { calendarLabel } from '../core/competitions';
import { AnimalHonors, Competitions, TrophyRoom } from './Competitions';
import { describeBehavior, type BehaviorSummary } from '../simulation/behavior';
import { AbsencePanel } from './AbsencePanel';
import { CarePanel } from './CarePanel';
import { CHROMOSOMES, GENOME_VERSION, label } from '../core/catalog';
import { alleleLabel, LOCUS_REGISTRY } from '../core/registry';
import { describeStructure } from '../core/structure';
import { mutationNotebook } from '../core/origins';
import { MutationOrigins } from './MutationOrigins';
import { NavRail, TankHud, Topbar, type TankAction, type TankSummary } from './Shell';
import { Drawer, WorkspaceTabs } from './ShellParts';
import { Icon, type IconName } from './Icon';
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
import { express, fingerprint, heterozygosity } from '../core/genetics';
import { MARKING_BLOCKS, MARKING_VISIBLE_ALPHA } from '../core/pattern';
import { genealogyIndex, visitTrail } from '../core/genealogy';
import { createKinshipCache } from '../core/pedigree';
import { completeGuideSteps, decodeGuide, GUIDE_KEY, guideSteps, observedGuideSteps, type GuideStepId } from '../core/onboarding';
import { RELIEF_COOLDOWN_DAYS, RELIEF_THRESHOLD, reliefStatus } from '../core/recovery';
import { advanceRuntime, commandEnvelope, executeCommand } from '../core/runtime';
import { OnboardingGuide } from './OnboardingGuide';
import type { LoadedSession } from '../persistence/session';
import { downloadText, SavePanel } from './SavePanel';
import type { AxolotlListing, Clutch, Fish, GoldfishListing, Listing, World } from '../core/types';
import { SPECIES_INFO } from '../core/species';
import { GoldfishGenomeView, GoldfishTraitPanel } from './GoldfishGenetics';
import { TICKS_PER_GAME_DAY } from '../core/water';
import { COHORT_SIZE, isDisplay, type Command } from '../core/world';
import { ShowcasePlaques } from './Expositorium';
import { styleOf, styleOption } from '../core/aquascape';
import { FastBreeding } from './FastBreeding';
import { Pagination, SexMark } from './Controls';
import { FamilyView } from './FamilyView';
import { FishPortrait, type PortraitView } from './FishPortrait';
import { FishCard } from './FishCard';
import { AxolotlGenomeView, AxolotlTraitPanel } from './AxolotlGenetics';
import { RarityPanel } from './RarityPanel';
import { GenesisPanel } from './GenesisPanel';
import { GenomeAtlas } from './GenomeAtlas';
import { atlasProgress, genotypeVisible, locusStage } from '../core/atlas';
import { DOMINANCE_LABELS, isNovel } from '../core/genesis';
import { isAxolotlGenome } from '../core/axolotlGenetics';
import { LocusTip } from './LocusTip';
import { KOI_EXPRESSION_NOTES, KOI_LOCUS_NOTES } from '../core/locusNotes';
import { TankCanvas } from './TankCanvas';
import { growthShare, lifeSummary } from './lifeText';
import { CommandPalette, ToastStack, type Notice, type NoticeTone, type PaletteCommand } from './kit/Feedback';
import { MenuButton, Select, useContextMenu, type MenuEntry } from './kit/Menu';
import { Dialog, TooltipLayer } from './kit/Overlay';
import './design/tokens.css';
import './design/base.css';
import './design/kit.css';
import './design/shell.css';
import './design/aquarium.css';
import './design/collection.css';
import './design/inspector.css';
import './design/panels.css';
import './design/research.css';
import './design/genesis.css';
import './competitions.css';

const ResearchLab = lazy(() => import('./ResearchLab').then(module => ({ default: module.ResearchLab })));
const VisualFixtureLab = lazy(() => import('./VisualFixtureLab').then(module => ({ default: module.VisualFixtureLab })));

const percent = (n: number) => `${(n * 100).toFixed(1)}%`;
const wholePercent = (n: number) => `${Math.round(n * 100)}%`;
const signedCredits = (n: number) => `${n < 0 ? '−' : '+'}◈ ${Math.abs(n)}`;
const date = (timestamp: string) => new Date(timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const descriptorLabel = new Map(GOAL_DESCRIPTORS.map(descriptor => [descriptor.key, descriptor.label]));
const RAIL_KEY = 'fishtank:rail-compact';
type SexFilter = 'all' | Fish['sex'];
type SpeciesFilter = 'all' | Fish['species'];
type View = 'aquarium' | 'fixtures' | 'research' | 'competitions' | 'trophies' | 'atlas';
type Workspace = 'collection' | 'breeding' | 'care' | 'habitat';
const WORKSPACES: Workspace[] = ['collection', 'breeding', 'care', 'habitat'];
const VIEW_TITLES: Record<View, string> = { aquarium: '', research: 'Research studies', competitions: 'Competition circuit', trophies: 'Trophy room', fixtures: 'Visual fixtures', atlas: 'Genome Atlas' };

function readPreferences(world: World) {
  let raw: string | null = null;
  try { raw = localStorage.getItem(PREFERENCES_KEY); } catch { /* Preferences are optional. */ }
  return decodePreferences(raw, new Set(world.fish.map(f => f.id)));
}
function readFlag(key: string) { try { return localStorage.getItem(key) === '1'; } catch { return false; } }
const VIEWS: View[] = ['aquarium', 'atlas', 'competitions', 'trophies', 'research', 'fixtures'];
const viewFromHash = (): View => { const hash = location.hash.replace(/^#\/?/, '') as View; return VIEWS.includes(hash) ? hash : 'aquarium'; };
const typing = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

export function App({ initial }: { initial: LoadedSession }) {
  const [runtime, setRuntime] = useState(initial.runtime);
  const runtimeRef = useRef(runtime);
  const saveBusy = useRef(false);
  // Only explicit calendar advances move domain time. Swimming is a separate presentation clock.
  const liveTick = runtime.tick;
  const world = runtime.world;
  const gameDay = Math.floor(liveTick / TICKS_PER_GAME_DAY);
  const [advancing, setAdvancing] = useState(false);
  const advancingRef = useRef(false);
  const [blocked, setBlocked] = useState(initial.blocked);
  const [showSaves, setShowSaves] = useState(false);
  const [preferences, setPreferences] = useState(() => readPreferences(initial.runtime.world));
  const [tankId, setTankId] = useState(initial.runtime.world.tanks[0].id);
  const [selectedId, setSelectedId] = useState(initial.runtime.world.fish.find(f => f.status === 'living')?.id ?? '');
  const [tab, setTab] = useState<'Overview' | 'Genome' | 'Family'>('Overview');
  const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [feedSignal, setFeedSignal] = useState(0);
  const [spotlight, setSpotlight] = useState(true);
  const [behavior, setBehavior] = useState<BehaviorSummary | null>(null);
  // Every notice is a toast and stays in the activity log for the session.
  const noticeSeq = useRef(0);
  const [notices, setNotices] = useState<Notice[]>(() => {
    const text = initial.absence ? 'While you were away: the calendar report above shows what changed in each tank.' : initial.resumeNotice;
    return text ? [{ id: ++noticeSeq.current, text, at: Date.now(), day: Math.floor(initial.runtime.tick / TICKS_PER_GAME_DAY), tone: 'info' }] : [];
  });
  const [readNotice, setReadNotice] = useState(0);
  const dayRef = useRef(gameDay);
  dayRef.current = gameDay;
  function setNotice(text: string, tone: NoticeTone = /◈/.test(text) ? 'money' : 'info') {
    if (!text) return;
    const entry = { id: ++noticeSeq.current, text, at: Date.now(), day: dayRef.current, tone };
    setNotices(current => [entry, ...current].slice(0, 80));
  }
  const [saveError, setSaveError] = useState(initial.warning);
  const [motherId, setMotherId] = useState(initial.runtime.world.fish.find(f => f.sex === 'F' && f.status === 'living')?.id ?? '');
  const [fatherId, setFatherId] = useState(initial.runtime.world.fish.find(f => f.sex === 'M' && f.status === 'living')?.id ?? '');
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [sexFilter, setSexFilter] = useState<SexFilter>('all');
  const [speciesFilter, setSpeciesFilter] = useState<SpeciesFilter>('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [cohortKey, setCohortKey] = useState('all');
  const [saleId, setSaleId] = useState<string | null>(null);
  const [view, setView] = useState<View>(viewFromHash);
  // The open view lives in the address, so Back, Forward and bookmarks return to it.
  const firstView = useRef(true);
  useEffect(() => {
    const target = view === 'aquarium' ? '' : `#/${view}`, url = target || `${location.pathname}${location.search}`;
    // The first sync only normalizes the address (a legacy `#research` link); later view changes add history entries.
    if (location.hash !== target) { if (firstView.current) history.replaceState(null, '', url); else history.pushState(null, '', url); }
    firstView.current = false;
  }, [view]);
  useEffect(() => { const pop = () => setView(viewFromHash()); window.addEventListener('popstate', pop); return () => window.removeEventListener('popstate', pop); }, []);
  /** One workspace panel is open at a time under the live tank. */
  const [workspace, setWorkspace] = useState<Workspace>('collection');
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [batchMode, setBatchMode] = useState(false);
  const [batchReview, setBatchReview] = useState<'sale' | 'move' | 'rehome' | 'bloodline' | null>(null);
  const [birthKey, setBirthKey] = useState('all');
  const [moveTarget, setMoveTarget] = useState('');
  const [movedTo, setMovedTo] = useState<string | null>(null);
  const [rehomeId, setRehomeId] = useState<string | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [renamingTankId, setRenamingTankId] = useState<string | null>(null);
  const renamingTank = world.tanks.find(t => t.id === renamingTankId) ?? null;
  const [showMarket, setShowMarket] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [railCompact, setRailCompact] = useState(() => readFlag(RAIL_KEY));
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
  const [fastTankId, setFastTankId] = useState(initial.runtime.world.tanks[0].id);
  const [fastCount, setFastCount] = useState(COHORT_SIZE);
  const [nurseryId, setNurseryId] = useState(initial.runtime.world.tanks[1]?.id ?? initial.runtime.world.tanks[0].id);
  const [clutchSize, setClutchSize] = useState<ClutchSize>(20);
  const inspectorHeading = useRef<HTMLHeadingElement>(null);
  const cardMenu = useContextMenu();
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
  useEffect(() => { try { localStorage.setItem(RAIL_KEY, railCompact ? '1' : '0'); } catch { /* Optional. */ } }, [railCompact]);
  // Courtships, kept hatched offspring and goals complete their steps as soon as they exist; completion is then stored.
  const observedSteps = useMemo(() => observedGuideSteps(world, preferences).join(' '), [world.fish, world.clutches, preferences]);
  useEffect(() => { if (observedSteps) markGuide(...observedSteps.split(' ') as GuideStepId[]); }, [observedSteps]);

  useEffect(() => {
    if (blocked || initial.readOnly || !initial.session) return;
    // The loaded runtime is already stored. Saving it again on mount would let a remount (development hot reload)
    // write the page-load snapshot over newer progress.
    if (runtime === initial.runtime) return;
    let cancelled = false;
    setSaveError('Saving…');
    void initial.session.save(runtime).then(() => {
      if (!cancelled) setSaveError('');
    }).catch(error => {
      if (!cancelled) setSaveError(`Not saved. ${error instanceof Error ? error.message : 'Storage is unavailable.'} Open Saves to retry or export.`);
    });
    return () => { cancelled = true; };
  }, [runtime, blocked, initial.readOnly, initial.session]);

  useEffect(() => {
    if (blocked) return;
    try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences)); } catch { /* Preferences are optional. */ }
  }, [preferences, blocked]);

  // Keyboard and relative selections move focus to the inspector so it is never lost when the pressed button unmounts.
  useEffect(() => { if (focusRequest) inspectorHeading.current?.focus(); }, [focusRequest]);

  const { goal, favorites } = preferences;
  const portraitView: PortraitView = preferences.portraits ?? 'current';
  const fastBreeding = preferences.fastBreeding === true;
  const favoriteIds = new Set(favorites);
  const tank = world.tanks.find(t => t.id === tankId) ?? world.tanks[0];
  const tankIndex = world.tanks.indexOf(tank);
  // The draft lives in its own store, so dragging a piece never re-renders the app (FS-117).
  const [aquascape, setAquascape] = useState<DraftStore | null>(null);
  const [pendingAquascape, setPendingAquascape] = useState(false);
  // A draft belongs to one aquarium: switching tanks or views discards it.
  useEffect(() => { setAquascape(null); }, [tank.id]);
  const openAquascape = () => { setAquascape(createDraftStore(draftFor(tank))); requestAnimationFrame(() => document.querySelector('.aquarium-stage')?.scrollIntoView({ behavior: 'smooth', block: 'start' })); };
  // Opening the editor for another aquarium waits for that aquarium to become the current one.
  useEffect(() => { if (pendingAquascape) { setPendingAquascape(false); openAquascape(); } }, [pendingAquascape, tank.id]);
  const fish = world.fish.find(f => f.id === selectedId);
  const living = world.fish.filter(f => f.status === 'living');
  const residents = useMemo(() => world.fish.filter(f => f.tankId === tank.id && f.status === 'living'), [world.fish, tank.id]);
  const swimmers = useMemo(() => residents.filter(f => !isEgg(f.life)), [residents]);
  // A tank switch shows the new aquarium at once; the collection of up to 60 portraits follows in a deferred render.
  const collectionTankId = useDeferredValue(tank.id), collectionPending = collectionTankId !== tank.id;
  const collectionResidents = useMemo(() => collectionTankId === tank.id ? residents : world.fish.filter(f => f.tankId === collectionTankId && f.status === 'living'), [residents, world.fish, collectionTankId, tank.id]);
  const p = useMemo(() => fish ? express(fish.genome) : null, [fish]);
  const selectedLimits = useMemo(() => {
    const home = fish?.status === 'living' ? world.tanks.find(t => t.id === fish.tankId) : undefined;
    return home ? environmentLimits(tankEnvironment(home, tankLoad(world.fish, home.id))) : [];
  }, [fish, world]);
  const koiGenome = fish && fish.species === 'koi' && !isAxolotlGenome(fish.genome) ? fish.genome : null;
  const appearanceRows = useMemo(() => koiGenome ? describeAppearance(koiGenome) : [], [koiGenome]);
  const alleleNames = useMemo(() => new Map(world.alleles.map(record => [record.id, record.name])), [world.alleles]);
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
  const viewFish = (showArchived ? world.fish.filter(f => f.status !== 'living') : collectionResidents).filter(f => `${f.name} ${f.id}`.toLowerCase().includes(query.toLowerCase()));
  const cohorts = cohortsOf(viewFish);
  const cohort = cohorts.find(c => c.key === cohortKey) ?? null;
  // Within a parent pair, the clutch filter narrows the view to fish laid together (FS-406).
  const births = cohort ? birthGroupsOf(viewFish, cohort.motherId, cohort.fatherId) : [];
  const birth = births.find(group => group.key === birthKey) ?? null;
  const inCohort = cohort ? viewFish.filter(f => f.parents?.[0] === cohort.motherId && f.parents?.[1] === cohort.fatherId && (!birth || f.bornAt === birth.bornAt)) : viewFish;
  const favoriteFiltered = favoritesOnly ? inCohort.filter(f => favoriteIds.has(f.id)) : inCohort;
  const sexCounts = { all: favoriteFiltered.length, F: favoriteFiltered.filter(f => f.sex === 'F').length, M: favoriteFiltered.filter(f => f.sex === 'M').length };
  const sexFiltered = sexFilter === 'all' ? favoriteFiltered : favoriteFiltered.filter(f => f.sex === sexFilter);
  const speciesCounts = { all: sexFiltered.length, koi: sexFiltered.filter(f => f.species === 'koi').length, axolotl: sexFiltered.filter(f => f.species === 'axolotl').length, goldfish: sexFiltered.filter(f => f.species === 'goldfish').length };
  const sort: CollectionSort = preferences.sort === 'goal' && !goal ? 'newest' : preferences.sort;
  const collection = sortCollection(speciesFilter === 'all' ? sexFiltered : sexFiltered.filter(f => f.species === speciesFilter), sort, goal);
  const pageSize = 60;
  const page = Math.min(collectionPage, Math.max(0, Math.ceil(collection.length / pageSize) - 1));
  const visibleCollection = collection.slice(page * pageSize, (page + 1) * pageSize);
  useEffect(() => { setCollectionPage(0); }, [tank.id, showArchived, query, sexFilter, speciesFilter, favoritesOnly, cohortKey, birthKey, sort, goal]);
  const fishName = (id: string) => world.fish.find(f => f.id === id)?.name ?? id;
  const tankName = (id: string) => world.tanks.find(t => t.id === id)?.name ?? id;
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
  // Clearing the aquarium: every hatched, non-courting, non-favorite resident; buyers take who they want, the rest are rehomed.
  const clearable = batchSaleCandidates(residents, favoriteIds).filter(f => !courtingClutchOf(world, f.id));
  const clearIds = clearable.map(f => f.id).join(',');
  const clearPlan = useMemo(() => clearOpen ? planBestSales(world, clearIds ? clearIds.split(',') : [], traitCache) : null, [clearOpen, world, clearIds, traitCache]);
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

  // Functional updates keep unchanged state identical, so a tank switch does not trigger an extra full render.
  useEffect(() => { setBatchIds(ids => ids.length ? [] : ids); setBatchReview(null); setLastBatchId(null); setMovedTo(null); }, [tank.id, showArchived, sexFilter, favoritesOnly, cohortKey, birthKey]);

  function run(command: Command, message: string, tone?: NoticeTone): World | null {
    if (initial.readOnly) { setNotice('This tab is read-only. Close the editing tab and reload to take control.', 'warn'); return null; }
    if (saveBusy.current) { setNotice('Wait for the save operation to finish.', 'warn'); return null; }
    if (advancingRef.current) { setNotice('Wait for the calendar to finish advancing.', 'warn'); return null; }
    try {
      const current = runtimeRef.current;
      const updated = executeCommand(current, commandEnvelope(current, command));
      runtimeRef.current = updated;
      setRuntime(updated);
      const next = updated.world;
      if (!next.fish.some(f => f.id === motherId && f.status === 'living')) setMotherId(next.fish.find(f => f.sex === 'F' && f.status === 'living')?.id ?? '');
      if (!next.fish.some(f => f.id === fatherId && f.status === 'living')) setFatherId(next.fish.find(f => f.sex === 'M' && f.status === 'living')?.id ?? '');
      setNotice(message, tone ?? (/◈/.test(message) ? 'money' : 'success'));
      return next;
    }
    catch (error) { setNotice(error instanceof Error ? error.message : 'The action could not be completed.', 'warn'); return null; }
  }

  const calendarBlocked = initial.readOnly ? 'This tab is read-only' : blocked ? 'Resolve the save warning in Saves first'
    : aquascape ? 'Apply or cancel the aquascape first' : world.circuit.active?.phase === 'exhibition' ? 'Finish judging your exhibition before advancing the date' : null;

  async function skipDays(days: 1 | 7 | 30) {
    if (calendarBlocked || saveBusy.current || advancingRef.current) { if (calendarBlocked) setNotice(`${calendarBlocked}.`, 'warn'); return; }
    advancingRef.current = true;
    setAdvancing(true);
    setShowSaves(false);
    // Yield between whole days so month skips keep progress visible, while publishing one atomic final runtime.
    const start = runtimeRef.current;
    const observer = absenceObserver(start.world);
    let next = start;
    try {
      for (let day = 0; day < days; day++) {
        await new Promise<void>(resolve => window.setTimeout(resolve, 0));
        next = advanceRuntime(next, next.tick + TICKS_PER_GAME_DAY, [], observer.onDay);
      }
      runtimeRef.current = next;
      setRuntime(next);
      const summary = observer.summarize(next.world);
      setAbsence(summary);
      const born = next.world.fish.length - start.world.fish.length;
      dayRef.current = Math.floor(next.tick / TICKS_PER_GAME_DAY);
      // Genesis: eggs that never developed, and what the Genome Atlas learned from hatched clutches.
      const failed = next.world.clutches.filter(clutch => clutch.outcome && !start.world.clutches.some(old => old.id === clutch.id && old.outcome)).reduce((sum, clutch) => sum + clutch.outcome!.nonviable, 0);
      const learned = (['koi', 'axolotl', 'goldfish'] as const).reduce((sum, species) => { const a = atlasProgress(next.world, species), b = atlasProgress(start.world, species); return sum + a.identified - b.identified + a.characterized - b.characterized + a.mapped - b.mapped; }, 0);
      setNotice(`${calendarLabel(dayRef.current)}. ${days} day${days === 1 ? '' : 's'} simulated${born ? ` · ${born} new eggs` : ''}${failed ? ` · ${failed} egg${failed === 1 ? '' : 's'} never developed (lethal recessives)` : ''}${learned ? ` · the Genome Atlas made ${learned} discover${learned === 1 ? 'y' : 'ies'}` : ''}. Growth, hatching, courtship and care updated in every aquarium.`, failed ? 'warn' : 'success');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not advance the calendar.', 'warn');
    } finally {
      advancingRef.current = false;
      setAdvancing(false);
    }
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
      element.scrollIntoView({ block: 'center', behavior: 'smooth' });
      element.focus({ preventScroll: true });
    }, 80);
  }

  function openDrawer(which: 'market' | 'shop' | 'saves' | null) {
    if (which === 'saves' && advancingRef.current) { setNotice('Wait for the calendar advance before opening Saves.', 'warn'); return; }
    setShowMarket(which === 'market'); setShowShop(which === 'shop'); setShowSaves(which === 'saves');
  }

  function openRecovery() { openDrawer('market'); focusSoon('recovery-title'); }

  /** The koi rescue (FS-504): rescued fish join the chosen tank, and the inspector shows the first of them. */
  function claimRelief(tankId: string) {
    const next = run({ type: 'claim-relief', tankId, timestamp: new Date().toISOString(), genomeVersion: GENOME_VERSION }, 'The koi rescue arrived.');
    if (!next) return;
    const rescued = next.fish.slice(-(next.ledger.entries.at(-1)?.fish ?? 1));
    setNotice(`The koi rescue brought ${rescued.map(f => `${f.name} (${f.sex === 'F' ? 'female' : 'male'})`).join(' and ')} to ${tankName(tankId)} at no cost. Rescued fish are unrelated adults, ready to court a partner that shares their tank. The rescue can help again in ${RELIEF_COOLDOWN_DAYS} game days.`, 'success');
    setSelectedId(rescued[0].id); setTankId(tankId); setShowArchived(false); setQuery('');
    setSexFilter('all'); setSpeciesFilter('koi'); setFavoritesOnly(false); setCohortKey('all'); setBirthKey('all'); setCollectionPage(0);
  }

  /** "Show me" in the first-session guide points at the control for a step; it never performs the step itself (FS-504). */
  function showGuideStep(step: GuideStepId) {
    const newest = (match: (f: Fish) => boolean) => { for (let i = world.fish.length - 1; i >= 0; i--) if (match(world.fish[i])) return world.fish[i]; return undefined; };
    const openBreeding = () => { setWorkspace('breeding'); setBreedingOpen(true); focusSoon('planner-mother'); };
    if (step === 'select') { setWorkspace('collection'); setNotice('Click a swimming fish in the aquarium, or choose a card in the collection.'); focusSoon('collection'); }
    else if (step === 'rename') {
      const target = fish?.status === 'living' ? fish : newest(f => f.status === 'living');
      if (target) { focusFish(target.id); setTab('Overview'); focusSoon('rename-name'); }
    } else if (step === 'feed') focusSoon('feed-button');
    else if (step === 'court') openBreeding();
    else if (step === 'hatch') {
      const clutch = [...world.clutches].reverse().find(entry => entry.firstFishId);
      if (clutch) { showClutch(clutch); setWorkspace('collection'); setNotice('That clutch is now shown in the collection. Once its eggs hatch, star one you want to keep.'); focusSoon('collection'); }
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
      card?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 60);
  }

  function breed() {
    const pairText = ` Showing this clutch of ${fishName(motherId)} × ${fishName(fatherId)}${goal ? `, ranked by ${descriptorLabel.get(goal.descriptor)?.toLowerCase()}` : ''}.`;
    const timestamp = new Date().toISOString(), destination = world.tanks.find(t => t.id === fastTankId) ?? tank;
    const before = world.fish.length;
    const next = run({ type: 'breed', motherId, fatherId, tankId: destination.id, timestamp, genomeVersion: GENOME_VERSION, count: fastCount },
      `${fastCount} egg${fastCount === 1 ? '' : 's'} laid in ${destination.name}. They hatch in ${INCUBATION_DAYS} game days and grow fastest in good water; each inherited one recombined copy from each parent.${pairText}`);
    if (next) {
      const born = next.fish.length - before;
      if (born < fastCount) setNotice(`${born} of ${fastCount} embryos developed in ${destination.name}. ${fastCount - born} carried a lethal recessive on both copies and never developed: the parents share hidden load. They are recorded in the Genome Atlas’s defect notebook.`, born ? 'warn' : 'warn');
      if (!born) return;
      if (destination.id !== tank.id) setTankId(destination.id);
      setSelectedId(next.fish[before].id); setShowArchived(false); setQuery('');
      setCohortKey(`${motherId}×${fatherId}`); setBirthKey(timestamp); setFavoritesOnly(false); setSexFilter('all');
    }
  }

  function pair() {
    const home = world.fish.find(f => f.id === motherId)?.tankId ?? '';
    run({ type: 'pair', motherId, fatherId, nurseryId, size: clutchSize, timestamp: new Date().toISOString(), genomeVersion: GENOME_VERSION },
      `${fishName(motherId)} and ${fishName(fatherId)} started courting in ${tankName(home)}. ${clutchSize} places are reserved in ${tankName(nurseryId)}; the eggs arrive there when courtship completes.`);
  }

  function cancelClutch(clutch: Clutch) {
    run({ type: 'cancel-clutch', clutchId: clutch.id }, `The courtship of ${fishName(clutch.motherId)} and ${fishName(clutch.fatherId)} was cancelled. ${clutch.size} places in ${tankName(clutch.nurseryId)} are free again.`, 'info');
  }

  function showClutch(clutch: Clutch) {
    setWorkspace('collection');
    setTankId(clutch.nurseryId); setShowArchived(false); setQuery(''); setFavoritesOnly(false); setSexFilter('all'); setSpeciesFilter(clutch.species);
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
    setLastBatchId(id); setBatchReview(null); setMovedTo(null); setBatchMode(true);
  }
  function exitBatch() { setBatchIds([]); setBatchReview(null); setBatchMode(false); }

  function sellBatch() {
    const ids = salePlan.sales.map(sale => sale.fishId), total = batchTotal, buyers = saleDetail(salePlan);
    if (run({ type: 'sell-batch', fishIds: ids, priceModel: PRICE_MODEL }, `${ids.length} fish sold for ◈ ${total.toLocaleString()} (${buyers}). Their archived profiles remain in the family tree.`)) {
      setBatchIds([]); setBatchReview(null); setSaleId(null); setBatchMode(false);
    }
  }

  /** Economy-neutral rehoming (FS-501): the fish leave the aquarium, no credits change and their records stay. */
  function rehomeSelected() {
    const ids = rehomeBatch.map(f => f.id);
    if (run({ type: 'rehome-batch', fishIds: ids }, `${ids.length} fish rehomed outside your aquarium. No credits changed; their archived profiles remain in the family tree.`)) {
      setBatchIds([]); setBatchReview(null); setBatchMode(false);
    }
  }

  /** One command sells every clearable resident that has a buyer, in the reviewed order, and rehomes the rest. */
  function clearTank() {
    if (!clearPlan) return;
    const order = [...clearPlan.sales.map(sale => sale.fishId), ...clearPlan.unsold], sold = clearPlan.sales.length, rehomed = clearPlan.unsold.length;
    const parts = [sold ? `${sold} sold for ◈ ${clearPlan.total.toLocaleString()}` : '', rehomed ? `${rehomed} with no buyer rehomed` : ''].filter(Boolean).join(' and ');
    if (order.length && run({ type: 'clear-batch', fishIds: order, priceModel: PRICE_MODEL }, `${tank.name} cleared: ${parts}. Their archived profiles remain in the family tree.`)) {
      setBatchIds([]); setBatchReview(null); setSaleId(null); setRehomeId(null);
    }
    setClearOpen(false);
  }

  /** A shop listing becomes a founder in the chosen tank (FS-502); the collection then shows it. */
  function buyListing(listing: Listing, destinationId: string) {
    const next = run({ type: 'buy-listing', listingId: listing.id, tankId: destinationId, timestamp: new Date().toISOString() },
      `${listing.name} joined ${tankName(destinationId)} for ◈ ${listing.price}. ${listing.note}.`);
    if (next) {
      setSelectedId(next.fish[next.fish.length - 1].id); setTankId(destinationId); setShowArchived(false); setQuery('');
      setSexFilter('all'); setSpeciesFilter('koi'); setFavoritesOnly(false); setCohortKey('all'); setBirthKey('all'); setCollectionPage(0);
    }
  }

  /** An axolotl shop listing (world v14): its listed genome, sex and name join the chosen tank. */
  function buyAxolotlListing(listing: AxolotlListing, destinationId: string) {
    const next = run({ type: 'buy-axolotl-listing', listingId: listing.id, tankId: destinationId, timestamp: new Date().toISOString() },
      `${listing.name} the axolotl joined ${tankName(destinationId)} for ◈ ${listing.price}. ${listing.note.replace(/^./, c => c.toUpperCase())}.`);
    if (!next) return;
    const newcomer = next.fish[next.fish.length - 1];
    setSelectedId(newcomer.id); setTankId(destinationId); setShowArchived(false); setQuery('');
    setSexFilter('all'); setSpeciesFilter('axolotl'); setFavoritesOnly(false); setCohortKey('all'); setBirthKey('all'); setCollectionPage(0);
  }

  /** A goldfish shop listing (world v17): its listed genome, sex and name join the chosen tank. */
  function buyGoldfishListing(listing: GoldfishListing, destinationId: string) {
    const next = run({ type: 'buy-goldfish-listing', listingId: listing.id, tankId: destinationId, timestamp: new Date().toISOString() },
      `${listing.name} the goldfish joined ${tankName(destinationId)} for ◈ ${listing.price}. ${listing.note.replace(/^./, c => c.toUpperCase())}.`);
    if (!next) return;
    const newcomer = next.fish[next.fish.length - 1];
    setSelectedId(newcomer.id); setTankId(destinationId); setShowArchived(false); setQuery('');
    setSexFilter('all'); setSpeciesFilter('goldfish'); setFavoritesOnly(false); setCohortKey('all'); setBirthKey('all'); setCollectionPage(0);
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
      setBatchIds([]); setBatchReview(null); setMovedTo(destination.id); setBatchMode(false);
    }
  }

  function moveOne(target: Fish, destinationId: string) {
    if (destinationId === target.tankId) return;
    if (run({ type: 'move', fishId: target.id, tankId: destinationId }, `${target.name} moved to ${tankName(destinationId)}.`)) setTankId(destinationId);
  }
  function setAsParent(target: Fish) {
    if (target.sex === 'F') setMotherId(target.id); else setFatherId(target.id);
    setNotice(`${target.name} selected as ${target.sex === 'F' ? 'mother' : 'father'}.${goal ? ' Your breeding goal is unchanged.' : ''}`, 'info');
  }
  function feed() {
    if (run({ type: 'feed', tankId: tank.id }, 'A portion of food joined the water, a quarter of a game day of what these fish need. They eat it over the next hours and leftovers decay. The sinking pellets show hungry, bold fish reaching food first.')) { setFeedSignal(v => v + 1); markGuide('feed'); }
  }
  function openTank(id: string) { setView('aquarium'); setTankId(id); setShowArchived(false); setQuery(''); }
  function tankAction(id: string, action: TankAction) {
    if (action === 'rename') { setRenamingTankId(id); return; }
    openTank(id);
    if (action === 'aquascape') { if (id === tank.id) openAquascape(); else setPendingAquascape(true); }
    else if (action === 'care') { setWorkspace('care'); focusSoon('workspace-panel'); }
    else if (action === 'habitat') { setWorkspace('habitat'); focusSoon('workspace-panel'); }
  }
  function goWorkspace(next: Workspace) { setView('aquarium'); setWorkspace(next); }

  const goalLabel = goal ? goal.secondary?.length ? 'Combined goal' : descriptorLabel.get(goal.descriptor)! : '';

  const tankSummaries: TankSummary[] = useMemo(() => world.tanks.map(t => {
    const status = careStatus(world, t.id);
    const alert = status.oxygen === 'critical' || status.ammonia === 'high' || status.stocking === 'overstocked' || (status.hatched > 0 && status.fedLevel === 'starving');
    const warn = status.oxygen === 'low' || status.ammonia === 'elevated' || status.stocking === 'heavy' || (status.hatched > 0 && status.fedLevel === 'underfed');
    const here = living.filter(f => f.tankId === t.id);
    return { id: t.id, name: t.name, capacity: t.capacity, living: here.length, eggs: here.filter(f => isEgg(f.life)).length, tone: alert ? 'alert' as const : warn ? 'warn' as const : 'good' as const, style: styleOf(t), display: isDisplay(t) };
  }), [world, living]);
  const activeStatus = useMemo(() => careStatus(world, tank.id), [world, tank.id]), activeWarnings = useMemo(() => careWarnings(world, tank.id), [world, tank.id]);
  const warningCount = { critical: activeWarnings.filter(w => w.severity === 'critical').length, total: activeWarnings.length };
  const courting = world.clutches.filter(c => c.stage === 'courting').length, incubating = world.clutches.filter(c => c.stage === 'incubating').length;
  const saveState = saveError === 'Saving…' ? 'Saving…' : saveError ? 'Session not saved' : 'Saved on this device';
  const viewTitle = view === 'aquarium' ? tank.name : VIEW_TITLES[view];
  const style = styleOf(tank);
  const workingTanks = world.tanks.filter(t => !isDisplay(t));
  const eggsHere = residents.length - swimmers.length;
  const unread = notices.filter(notice => notice.id > readNotice).length;

  // ---- Menus -------------------------------------------------------------------------------------------------------
  const moveMenu = (target: Fish): MenuEntry[] => world.tanks.map(t => ({ id: `move-${t.id}`, label: t.name, hint: t.id === target.tankId ? 'Current aquarium' : `${Math.max(0, freePlaces(t.id))} free places`,
    checked: t.id === target.tankId, disabled: t.id !== target.tankId && freePlaces(t.id) <= 0, onSelect: () => moveOne(target, t.id) }));
  const saleHint = (target: Fish) => { const best = offersFor(world, target, traitCache)[0]; return isEgg(target.life) ? 'Eggs cannot be sold' : best ? `◈ ${best.amount} · ${best.buyerName}` : 'No buyer today'; };
  function fishMenu(target: Fish): MenuEntry[] {
    const livingTarget = target.status === 'living', favorite = favoriteIds.has(target.id);
    return [
      { type: 'heading', id: 'h', label: target.name },
      { id: 'inspect', label: 'Inspect', icon: 'eye', onSelect: () => select(target.id, true) },
      { id: 'family', label: 'Open family tree', icon: 'family', onSelect: () => { select(target.id, true); setTab('Family'); } },
      { id: 'genome', label: 'Read genome', icon: 'dna', tone: 'gene', onSelect: () => { select(target.id, true); setTab('Genome'); } },
      { type: 'separator', id: 's1' },
      { id: 'favorite', label: favorite ? 'Remove from favorites' : 'Keep as favorite', icon: 'star', tone: 'brass', onSelect: () => setPreferences(current => toggleFavorite(current, target.id)) },
      ...(livingTarget ? [
        { id: 'parent', label: `Set as ${target.sex === 'F' ? 'mother' : 'father'}`, icon: 'heart' as IconName, tone: 'koi' as const, disabled: isEgg(target.life), onSelect: () => setAsParent(target) },
        { id: 'move', label: 'Move to', icon: 'move' as IconName, items: moveMenu(target) },
        { id: 'batch', label: batchIds.includes(target.id) ? 'Remove from selection' : 'Add to selection', icon: 'select' as IconName, onSelect: () => toggleBatch(target.id, false) },
        { type: 'separator' as const, id: 's2' },
        { id: 'sell', label: 'Sell…', icon: 'tag' as IconName, tone: 'brass' as const, hint: saleHint(target), disabled: isEgg(target.life) || !offersFor(world, target, traitCache).length, onSelect: () => { select(target.id); setSaleId(target.id); setRehomeId(null); } },
        { id: 'rehome', label: 'Rehome…', icon: 'home' as IconName, disabled: isEgg(target.life), onSelect: () => { select(target.id); setRehomeId(target.id); setSaleId(null); } },
      ] : []),
      { type: 'separator', id: 's3' },
      { id: 'copy', label: 'Copy specimen ID', icon: 'copy', hint: target.id, onSelect: () => { void navigator.clipboard?.writeText(target.id).then(() => setNotice(`Copied ${target.id}.`, 'info'), () => setNotice('Clipboard is unavailable here.', 'warn')); } },
    ];
  }
  const tankMenu: MenuEntry[] = [
    { type: 'heading', id: 'h', label: tank.name },
    { id: 'feed', label: 'Feed', icon: 'food', shortcut: 'F', disabled: initial.readOnly || !!aquascape, onSelect: feed },
    { id: 'motion', label: paused ? 'Resume swimming' : 'Pause swimming', icon: paused ? 'play' : 'pause', shortcut: 'M', onSelect: () => setPaused(v => !v) },
    { id: 'aquascape', label: 'Aquascape', icon: 'brush', tone: 'brass', disabled: initial.readOnly || !!aquascape, onSelect: openAquascape },
    { type: 'separator', id: 's' },
    { id: 'care', label: 'Care controls', icon: 'drop', shortcut: '3', onSelect: () => { setWorkspace('care'); focusSoon('workspace-panel'); } },
    { id: 'habitat', label: 'Habitat & expansion', icon: 'leaf', shortcut: '4', onSelect: () => { setWorkspace('habitat'); focusSoon('workspace-panel'); } },
    { id: 'rename-tank', label: 'Rename aquarium…', icon: 'tag', disabled: initial.readOnly, onSelect: () => setRenamingTankId(tank.id) },
    { id: 'shop', label: 'Buy stock for this tank', icon: 'shop', onSelect: () => openDrawer('shop') },
    { id: 'clear', label: 'Sell all fish…', icon: 'coins', tone: 'brass', hint: clearable.length ? `${clearable.length} · no buyer → rehomed` : 'Nothing to sell', disabled: initial.readOnly || !!aquascape || !clearable.length, onSelect: () => setClearOpen(true) },
    { id: 'switch', label: 'Switch aquarium', icon: 'tank', items: world.tanks.map(t => ({ id: `t-${t.id}`, label: t.name, checked: t.id === tank.id, onSelect: () => openTank(t.id) })) },
  ];

  // ---- Command palette and shortcuts ------------------------------------------------------------------------------
  const paletteCommands: PaletteCommand[] = paletteOpen ? [
    { id: 'v-aquarium', label: 'Aquarium', group: 'Go to', icon: 'tank', run: () => setView('aquarium') },
    { id: 'v-competitions', label: 'Competition circuit', group: 'Go to', icon: 'trophy', run: () => setView('competitions') },
    { id: 'v-trophies', label: 'Trophy room', group: 'Go to', icon: 'medal', run: () => setView('trophies') },
    { id: 'v-atlas', label: 'Genome Atlas', group: 'Go to', icon: 'dna', run: () => setView('atlas') },
    { id: 'v-research', label: 'Research studies', group: 'Go to', icon: 'flask', run: () => setView('research') },
    { id: 'v-fixtures', label: 'Visual fixtures', group: 'Go to', icon: 'grid', run: () => setView('fixtures') },
    { id: 'w-collection', label: 'Collection', group: 'Go to', icon: 'grid', shortcut: '1', run: () => goWorkspace('collection') },
    { id: 'w-breeding', label: 'Breeding planner', group: 'Go to', icon: 'heart', shortcut: '2', run: () => goWorkspace('breeding') },
    { id: 'w-care', label: 'Care controls', group: 'Go to', icon: 'drop', shortcut: '3', run: () => goWorkspace('care') },
    { id: 'w-habitat', label: 'Habitat & expansion', group: 'Go to', icon: 'leaf', shortcut: '4', run: () => goWorkspace('habitat') },
    { id: 'a-feed', label: `Feed ${tank.name}`, group: 'Actions', icon: 'food', shortcut: 'F', run: feed },
    { id: 'a-day', label: 'Advance one day', group: 'Actions', icon: 'clock', shortcut: '.', run: () => void skipDays(1) },
    { id: 'a-week', label: 'Advance one week', group: 'Actions', icon: 'calendar', run: () => void skipDays(7) },
    { id: 'a-month', label: 'Advance one month', group: 'Actions', icon: 'fastForward', run: () => void skipDays(30) },
    { id: 'a-aquascape', label: `Aquascape ${tank.name}`, group: 'Actions', icon: 'brush', run: () => { setView('aquarium'); openAquascape(); } },
    { id: 'a-motion', label: paused ? 'Resume swimming' : 'Pause swimming', group: 'Actions', icon: paused ? 'play' : 'pause', shortcut: 'M', run: () => setPaused(v => !v) },
    { id: 'a-shop', label: 'Open NPC shop', group: 'Actions', icon: 'shop', run: () => { setView('aquarium'); openDrawer('shop'); } },
    { id: 'a-ledger', label: 'Buyers & ledger', group: 'Actions', icon: 'coins', run: () => openDrawer('market') },
    { id: 'a-saves', label: 'Saves, import & backups', group: 'Actions', icon: 'save', run: () => openDrawer('saves') },
    { id: 'a-export', label: 'Export save file', group: 'Actions', icon: 'download', run: () => downloadText(JSON.stringify(runtime), 'fishtank-save-v2.json') },
    { id: 'a-guide', label: guide.hidden ? 'Show first-session guide' : 'Hide first-session guide', group: 'Actions', icon: 'compass', run: () => setGuide(current => ({ ...current, hidden: !current.hidden })) },
    { id: 'a-rail', label: railCompact ? 'Expand navigation' : 'Collapse navigation', group: 'Actions', icon: 'sidebar', run: () => setRailCompact(v => !v) },
    ...world.tanks.map((t, i) => ({ id: `t-${t.id}`, label: t.name, group: 'Aquariums', icon: 'tank' as IconName, hint: `Aquarium ${i + 1} · ${living.filter(f => f.tankId === t.id).length}/${t.capacity}`, run: () => openTank(t.id) })),
    ...world.fish.filter(f => f.status === 'living').concat(world.fish.filter(f => f.status !== 'living')).map(f => ({
      id: `f-${f.id}`, label: f.name, group: f.status === 'living' ? 'Animals' : 'Archive', icon: (f.species === 'axolotl' ? 'leaf' : f.species === 'goldfish' ? 'goldfish' : 'fish') as IconName,
      hint: `${f.id} · G${f.generation} · ${f.status === 'living' ? tankName(f.tankId) : f.status}`, keywords: `${f.id} ${f.species} ${f.sex === 'F' ? 'female' : 'male'}`,
      run: () => { setView('aquarium'); select(f.id, true); },
    })),
  ] : [];
  const shortcut = useRef<(event: KeyboardEvent) => void>(() => {});
  const goPrefix = useRef(0);
  shortcut.current = event => {
    const layered = document.querySelector('.dialog, .menu, .palette, .popover, .drawer-root');
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); if (!document.querySelector('.dialog')) setPaletteOpen(v => !v); return; }
    if (event.ctrlKey || event.metaKey || event.altKey || typing(event.target) || layered) return;
    const key = event.key;
    if (performance.now() - goPrefix.current < 900) {
      goPrefix.current = 0;
      const target = ({ a: 'aquarium', c: 'competitions', t: 'trophies', r: 'research', l: 'atlas' } as Record<string, View>)[key.toLowerCase()];
      if (target) { event.preventDefault(); setView(target); return; }
    }
    if (key === 'g') { goPrefix.current = performance.now(); return; }
    if (key === '/' ) { event.preventDefault(); setPaletteOpen(true); }
    else if (key === '?') { event.preventDefault(); setShortcutsOpen(true); }
    else if (key === '.') { event.preventDefault(); void skipDays(1); }
    else if (view === 'aquarium' && (key === 'f' || key === 'F')) { event.preventDefault(); if (!aquascape) feed(); }
    else if (view === 'aquarium' && (key === 'm' || key === 'M')) { event.preventDefault(); setPaused(v => !v); }
    else if (view === 'aquarium' && /^[1-4]$/.test(key) && !aquascape) { event.preventDefault(); setWorkspace(WORKSPACES[Number(key) - 1]); }
    else if ((key === '[' || key === ']') && !aquascape) {
      event.preventDefault();
      const next = world.tanks[(tankIndex + (key === ']' ? 1 : -1) + world.tanks.length) % world.tanks.length];
      openTank(next.id);
    }
  };
  useEffect(() => {
    const listener = (event: KeyboardEvent) => shortcut.current(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  const saleFish = saleId ? world.fish.find(f => f.id === saleId) : undefined, rehomeFish = rehomeId ? world.fish.find(f => f.id === rehomeId) : undefined;
  // A pending sale only lives while its buyer's offer does, so a confirmation never appears later on its own.
  useEffect(() => { if (saleId && (saleId !== fish?.id || !offers[0])) setSaleId(null); }, [saleId, fish?.id, offers]);
  const backToProfile = () => inspectorHeading.current ?? document.getElementById('collection');

  return <div className={`app-shell view-${view} ${railCompact ? 'rail-compact' : ''}`}>
    {view === 'aquarium' ? <><a className="skip-link" href="#collection" onClick={event => { event.preventDefault(); setWorkspace('collection'); focusSoon('collection'); }}>Skip to collection</a>
      <a className="skip-link" href="#inspector" onClick={event => { event.preventDefault(); document.getElementById('inspector')?.focus(); }}>Skip to inspector</a></> : null}
    <NavRail view={view} onView={next => { setView(next); openDrawer(null); }} compact={railCompact} onCompact={() => setRailCompact(v => !v)}
      tanks={tankSummaries} activeTankId={tank.id} loadingTankId={collectionPending ? tank.id : null}
      onTank={openTank} onTankAction={tankAction} onAddTank={() => { setView('aquarium'); setWorkspace('habitat'); focusSoon('workspace-panel'); }}
      onAddDisplay={() => { setView('aquarium'); setWorkspace('habitat'); focusSoon('display-offer'); }}
      credits={world.credits} saveState={saveState} guide={{ done: guideProgress.filter(step => step.done).length, total: guideProgress.length, hidden: guide.hidden }}
      onMarket={() => openDrawer(showMarket ? null : 'market')} onShop={() => openDrawer(showShop ? null : 'shop')} onSaves={() => openDrawer(showSaves ? null : 'saves')}
      onGuide={() => setGuide(current => ({ ...current, hidden: !current.hidden }))} onExport={() => downloadText(JSON.stringify(runtime), 'fishtank-save-v2.json')}
      open={{ market: showMarket, shop: showShop, saves: showSaves }} />
    <div className="shell-main">
      <Topbar eyebrow={view === 'aquarium' ? isDisplay(tank) ? 'Expositorium · display aquarium' : `Aquarium ${String(workingTanks.indexOf(tank) + 1).padStart(2, '0')} of ${workingTanks.length}` : 'Genetics lab'} title={viewTitle}
        calendar={{ label: calendarLabel(gameDay), day: gameDay, disabledReason: calendarBlocked, advancing, onAdvance: days => void skipDays(days) }}
        credits={world.credits} living={living.length} courting={courting} incubating={incubating} records={world.fish.length}
        onLedger={() => openDrawer(showMarket ? null : 'market')} onSearch={() => setPaletteOpen(true)} onShortcuts={() => setShortcutsOpen(true)}
        notices={notices} unread={unread} onReadNotices={() => setReadNotice(notices[0]?.id ?? 0)} onClearNotices={() => { setNotices([]); setReadNotice(noticeSeq.current); }} />
      <Drawer open={showSaves} label="Saves" icon="save" eyebrow="Your world" onClose={() => openDrawer(null)}><SavePanel runtime={runtime} session={initial.session} blocked={blocked} readOnly={initial.readOnly} onBusy={value => { saveBusy.current = value; }} onSaved={() => { setBlocked(false); setSaveError(''); }} /></Drawer>
      <Drawer open={showMarket} label="Buyers and ledger" icon="coins" eyebrow="Economy" onClose={() => openDrawer(null)}><MarketPanel world={world} readOnly={initial.readOnly} traitCache={traitCache} onClaimRelief={claimRelief} onClose={() => openDrawer(null)} /></Drawer>
      <Drawer open={showShop && view === 'aquarium'} label="NPC shop" icon="shop" eyebrow="New bloodlines" wide onClose={() => openDrawer(null)}><ShopPanel world={world} tank={tank} day={gameDay} readOnly={initial.readOnly} traitCache={traitCache} onBuy={buyListing} onBuyAxolotl={buyAxolotlListing} onBuyGoldfish={buyGoldfishListing} onClose={() => openDrawer(null)} onRecovery={openRecovery} /></Drawer>
      {view === 'atlas' ? <div className="view-frame" key="atlas"><GenomeAtlas world={world} readOnly={initial.readOnly || blocked} onRun={run} onInspect={id => { setView('aquarium'); select(id, true); }} /></div>
        : view === 'competitions' ? <div className="view-frame" key="competitions"><Competitions world={world} readOnly={initial.readOnly || blocked || advancing} onCommand={command => run(command, 'Competition record updated.') !== null} /></div>
        : view === 'trophies' ? <div className="view-frame" key="trophies"><TrophyRoom world={world} onInspect={id => { setView('aquarium'); select(id, true); }} /></div>
        : view === 'fixtures' ? <div className="view-frame" key="fixtures"><Suspense fallback={<p className="loading-card" role="status">Loading visual fixtures…</p>}><VisualFixtureLab onClose={() => setView('aquarium')} /></Suspense></div>
        : view === 'research' ? <div className="view-frame" key="research"><Suspense fallback={<p className="loading-card" role="status">Loading research…</p>}><ResearchLab onClose={() => setView('aquarium')} /></Suspense></div>
        : <div className="workspace">
      <main id="main">
        {saveError && saveError !== 'Saving…' ? <p className="warning" role="alert"><Icon name="alert" size={18} /><span>{saveError}</span></p> : null}
        {absence || !guide.hidden || relief.sexes.length ? <div className="notice-strip">
          {absence ? <AbsencePanel summary={absence} notice="Growth, births and care across your aquariums during this calendar advance." onDismiss={() => setAbsence(null)} onOpenTank={openTank} /> : null}
          {guide.hidden ? null : <OnboardingGuide steps={guideProgress} onShow={showGuideStep} onHide={() => setGuide(current => ({ ...current, hidden: true }))} />}
          {relief.sexes.length ? <section className="recovery-alert" aria-labelledby="recovery-alert-title">
            <span className="notice-icon" aria-hidden="true"><Icon name="alert" size={18} /></span>
            <div><h2 id="recovery-alert-title">{relief.sexes.length === 2 ? 'No living fish are left' : `No living ${relief.sexes[0] === 'F' ? 'female' : 'male'} is left`}</h2>
              <p>A new generation needs a female and a male. {relief.reason}</p>
              <div className="guide-actions">{world.credits < RELIEF_THRESHOLD * relief.sexes.length
                ? <button className="primary btn-sm" onClick={openRecovery}>Review recovery options</button>
                : <button className="primary btn-sm" onClick={() => { openDrawer('shop'); focusSoon('shop-title'); }}>Open NPC shop</button>}</div></div>
          </section> : null}
        </div> : null}
        <section className={`aquarium-stage ${aquascape ? 'is-editing' : ''}`} aria-labelledby="tank-title">
          <div className="tank-heading">
            <div className="tank-heading-title">
              <span className="eyebrow">{styleOption('backdrop', style.backdrop).name} · {styleOption('substrate', style.substrate).name} · {styleOption('lighting', style.lighting).name}{style.effect ? ` · ${styleOption('effect', style.effect).name}` : ''}</span>
              <h1 id="tank-title">{tank.name}</h1>
            </div>
            <div className="tank-heading-meta">
              <span className="chip lume" data-tip={`${residents.length} of ${tank.capacity} places used`}><Icon name="fish" size={14} /><span className="mono">{residents.length}/{tank.capacity}</span></span>
              {eggsHere ? <span className="chip koi"><Icon name="egg" size={13} />{eggsHere} eggs</span> : null}
              <span className="chip">{tank.planted ? <><Icon name="leaf" size={13} />Planted</> : <><Icon name="wave" size={13} />Open water</>}</span>
              <span className="chip"><Icon name="drop" size={13} /><span className="mono">{tank.water.volumeL.toLocaleString('en')} L</span></span>
              <MenuButton className="icon-button btn-sm" items={tankMenu} label="Aquarium actions" ariaLabel="Aquarium actions" tip="Aquarium actions" placement="bottom-end"><Icon name="more" size={17} /></MenuButton>
            </div>
          </div>
          <div className="aquarium-frame">
            <div className={`aquarium ${aquascape ? 'is-editing' : ''}`} aria-label="Live aquarium" role="group">
              <TankCanvas fish={swimmers} eggs={eggsHere} tank={tank} selectedId={selectedId} onSelect={select} paused={paused} speed={1} feedSignal={feedSignal} onBehavior={setBehavior} tanks={world.tanks} preview={aquascape} editing={!!aquascape} display={isDisplay(tank)} spotlight={spotlight} />
              {aquascape ? <><AquascapeOverlay store={aquascape} saved={decorationsOf(tank)} /><span className="editing-badge"><Icon name="brush" size={14} />Aquascaping · time and fish wait until you apply or cancel</span></> : null}
              {aquascape ? null : <TankHud status={activeStatus} tank={tank} warnings={warningCount} paused={paused} onCare={() => { setWorkspace('care'); focusSoon('workspace-panel'); }} />}
              {eggsHere && !aquascape ? <span className="egg-badge"><Icon name="egg" size={13} />{eggsHere} eggs incubating</span> : null}
              {!residents.length && !aquascape ? <div className="empty-tank"><Icon name="bubbles" size={30} /><strong>A little room to evolve</strong><small>Move a fish here or introduce unrelated stock, which can carry new colours and patterns.</small>
                <button className="primary btn-sm" onClick={() => openDrawer('shop')}><Icon name="shop" size={14} />Browse the NPC shop</button></div> : null}
            </div>
          </div>
          {isDisplay(tank) && !aquascape ? <ShowcasePlaques fish={residents} selectedId={selectedId} spotlight={spotlight} onSelect={id => select(id)}
            onSpotlight={() => setSpotlight(value => !value)} onTreat={() => setFeedSignal(value => value + 1)} /> : null}
          {aquascape ? null : <div className="tank-stand">
            <div className="stand-group">
              <button className="stand-button" aria-pressed={!paused} data-tip="Pause or play swimming (M)" onClick={() => setPaused(v => !v)}>
                <Icon name={paused ? 'play' : 'pause'} size={15} /><span>{paused ? 'Motion off' : 'Motion on'}</span></button>
              <span className="stand-hint"><Icon name="eye" size={14} />Click a fish to inspect · click open water to tap the glass</span>
            </div>
            <div className="stand-group">
              <button className="aquascape-button" onClick={openAquascape} disabled={initial.readOnly} data-tip="Decorate this aquarium"><Icon name="brush" size={16} />Aquascape</button>
              <button className="primary feed-button" id="feed-button" onClick={feed} data-tip="Drop a portion of food (F)"><Icon name="food" size={17} />Feed</button>
            </div>
          </div>}
        </section>
        {aquascape ? <AquascapeDock world={world} tank={tank} store={aquascape} readOnly={initial.readOnly} onRun={(command, message) => run(command, message) !== null} onClose={() => setAquascape(null)} /> : <><WorkspaceTabs label="Aquarium workspace" active={workspace} onChange={setWorkspace} tabs={[
          { id: 'collection', label: 'Collection', icon: 'grid', badge: residents.length },
          { id: 'breeding', label: 'Breeding', icon: 'heart', badge: courting + incubating || undefined, tone: 'info' },
          { id: 'care', label: 'Care', icon: 'drop', badge: warningCount.total || undefined, tone: warningCount.critical ? 'alert' : 'warn' },
          { id: 'habitat', label: 'Habitat', icon: 'leaf' },
        ]} />
        <div className="workspace-panel" id="workspace-panel" tabIndex={-1} key={workspace}>
        {workspace === 'care' && tank.care ? <div role="tabpanel" id="panel-care" aria-labelledby="tab-care"><CarePanel world={world} tank={tank} tick={liveTick} readOnly={initial.readOnly} defaultOpen onRun={(command, message) => run(command, message) !== null} /></div> : null}
        {workspace === 'habitat' ? <div role="tabpanel" id="panel-habitat" aria-labelledby="tab-habitat"><HabitatPanel key={tank.id} world={world} tank={tank} readOnly={initial.readOnly} expanded onAquascape={openAquascape} onRun={(command, message) => run(command, message) !== null} /></div> : null}
        {workspace === 'breeding' ? <section role="tabpanel" id="panel-breeding" aria-labelledby="tab-breeding" className="breeding-panel panel">
          <header className="panel-header">
            <span className="panel-icon koi" aria-hidden="true"><Icon name="heart" size={20} /></span>
            <div><span className="eyebrow">The next generation</span><h2 id="breeding-title">What will they inherit?</h2>
              <p>{!fastBreeding ? 'Pair two adults that share a tank; courtship reserves places in a nursery.' : 'Fast breeding: instant eggs from any two parents, in the tank you choose.'}{goal ? ` Goal active · ${goalLabel}.` : ''}</p></div>
            <div className="breeding-mode fast-switch">
              <button className={`switch ${fastBreeding ? 'on' : ''}`} id="fast-breeding-toggle" role="switch" aria-checked={fastBreeding} aria-pressed={fastBreeding} onClick={() => setPreferences(current => ({ ...current, fastBreeding: !fastBreeding }))}
                data-tip={fastBreeding ? 'Instant eggs, any tanks, you pick where they spawn' : 'Normal courtship rules apply'}>
                <span className="switch-track" aria-hidden="true"><span className="switch-thumb" /></span><span>Fast breeding</span></button>
            </div>
          </header>
          {breedingOpen || workspace === 'breeding' ? <div id="breeding-options" className="breeding-options">
            <BreedingPlanner world={world} fish={world.fish} tanks={world.tanks} goal={goal} motherId={motherId} fatherId={fatherId} onMother={setMotherId} onFather={setFatherId}
              onGoal={(next: BreedingGoal | null) => setPreferences(current => ({ ...current, goal: next, sort: next ? 'goal' : current.sort === 'goal' ? 'newest' : current.sort }))} />
            {!fastBreeding ? <>
              <NormalBreeding world={world} motherId={motherId} fatherId={fatherId} nurseryId={nurseryId} size={clutchSize} readOnly={initial.readOnly}
                onNursery={setNurseryId} onSize={setClutchSize} onPair={pair} onCancel={cancelClutch} onShowClutch={showClutch} />
              <p className="help-copy">Expected pedigree F: <b className="mono">{percent(prospectiveF)}</b>, from recorded ancestry; {pairFounders === 1 ? 'the one founder behind this pair is' : `the ${pairFounders} founders behind this pair are`} assumed unrelated and not inbred. Parents must be adults with at least 70% condition, not resting after a clutch, and in the same tank. Courtship pauses, with the reason shown, if they are separated, their condition falls or the water turns harsh.</p>
            </> : <FastBreeding world={world} motherId={motherId} fatherId={fatherId} tankId={fastTankId} count={fastCount} readOnly={initial.readOnly} expectedF={percent(prospectiveF)}
              onTank={setFastTankId} onCount={setFastCount} onBreed={breed} />}
          </div> : null}
        </section> : null}
        {workspace === 'collection' ? <section role="tabpanel" id="panel-collection" aria-labelledby="tab-collection" className={`collection ${collectionPending ? 'is-loading' : ''} ${batchMode || batch.length ? 'selecting' : ''}`} aria-busy={collectionPending}><div id="collection" tabIndex={-1} aria-labelledby="collection-title">
          <div className="collection-heading">
            <div className="collection-title"><h2 id="collection-title">{showArchived ? 'Archive' : 'Collection'}</h2><span className="badge">{collection.length}</span>
              {showArchived ? <span className="chip">Sold and rehomed animals keep their records</span> : null}</div>
            <div className="collection-actions">
              {showArchived ? null : <button className="btn-sm" aria-pressed={batchMode || batch.length > 0} onClick={() => batchMode || batch.length ? exitBatch() : setBatchMode(true)} data-tip="Select several animals to move, sell or rehome">
                <Icon name="select" size={15} />{batchMode || batch.length ? 'Done' : 'Select'}</button>}
              <button className="quiet btn-sm" onClick={() => { setShowArchived(v => !v); setQuery(''); exitBatch(); }}><Icon name={showArchived ? 'fish' : 'history'} size={15} />{showArchived ? 'Residents' : 'Archive'}</button>
              <button className="btn-sm" aria-expanded={showShop} onClick={() => openDrawer(showShop ? null : 'shop')}><Icon name="shop" size={15} />NPC shop<span className="badge">{world.shop.listings.length}</span></button>
            </div>
          </div>
          <div className="collection-toolbar">
            <label className="search-field"><Icon name="search" size={16} /><span className="visually-hidden">Search fish</span>
              <input type="search" name="collection-search" autoComplete="off" spellCheck={false} aria-label="Search fish" placeholder="Search by name or ID…" value={query} onChange={e => setQuery(e.target.value)} />
              {query ? <button className="bare search-clear" aria-label="Clear search" onClick={() => setQuery('')}><Icon name="close" size={14} /></button> : null}</label>
            <div className="sex-filter species-filter" role="group" aria-label="Show animals by species">
              {(['all', 'koi', 'goldfish', 'axolotl'] as const).map(value => <button key={value} aria-pressed={speciesFilter === value} onClick={() => setSpeciesFilter(value)}>
                {value === 'all' ? 'All' : SPECIES_INFO[value].titles}<span className="filter-count">{speciesCounts[value]}</span>
              </button>)}
            </div>
            <div className="sex-filter" role="group" aria-label="Show fish by sex">
              {(['all', 'F', 'M'] as const).map(value => <button key={value} aria-pressed={sexFilter === value} onClick={() => setSexFilter(value)} aria-label={value === 'all' ? undefined : value === 'F' ? 'Females' : 'Males'}>
                {value === 'all' ? 'Both' : <SexMark sex={value} decorative />}<span className="filter-count">{sexCounts[value]}</span>
              </button>)}
            </div>
            <button className={`pill-toggle favorites-toggle btn-sm`} aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(v => !v)}><Icon name="star" size={14} filled={favoritesOnly} />Favorites<span className="filter-count">{inCohort.filter(f => favoriteIds.has(f.id)).length}</span></button>
          </div>
          <div className="collection-filters">
            <Select label="Parents" prefix="Parents" icon="family" className="btn-sm" value={cohort ? cohort.key : 'all'} onChange={value => { setCohortKey(value); setBirthKey('all'); }}
              options={[{ value: 'all', label: 'All parents' }, ...cohorts.map(c => ({ value: c.key, label: `${fishName(c.motherId)} × ${fishName(c.fatherId)}`, hint: `${c.size} offspring` }))]} />
            {births.length > 1 || birth ? <Select label="Clutch" prefix="Clutch" icon="egg" className="btn-sm" value={birth ? birth.key : 'all'} onChange={setBirthKey}
              options={[{ value: 'all', label: `All ${births.length} clutches` }, ...births.map(group => ({ value: group.key, label: `#${Number(group.firstId.slice(4))}–${Number(group.lastId.slice(4))}`, hint: `${group.size} fish` }))]} /> : null}
            <Select label="Sort" prefix="Sort" icon="sort" className="btn-sm" value={sort} onChange={value => setPreferences(current => ({ ...current, sort: value as CollectionSort }))}
              options={[{ value: 'newest', label: 'Newest first' }, { value: 'oldest', label: 'Oldest first' }, { value: 'name', label: 'Name' },
                { value: 'goal', label: goal ? `${goalLabel} · best match` : 'Breeding goal', hint: goal ? undefined : 'Set a goal in Breeding first', disabled: !goal }]} />
            <div className="framing-toggle portrait-toggle" role="group" aria-label="Collection portraits show">
              <button aria-pressed={portraitView === 'current'} onClick={() => setPreferences(current => ({ ...current, portraits: 'current' }))}>Now</button>
              <button aria-pressed={portraitView === 'adult'} onClick={() => setPreferences(current => ({ ...current, portraits: 'adult' }))}>Adult potential</button>
            </div>
          </div>
          {cohort ? <div className="cohort-parents" role="group" aria-label="Parents of this cohort">{[cohort.motherId, cohort.fatherId].flatMap(id => world.fish.filter(f => f.id === id)).map(parent => <button className="cohort-parent" key={parent.id} onClick={event => select(parent.id, event.detail === 0)}>
            <FishPortrait fish={parent} view={portraitView} /><span><span className="eyebrow">{parent.sex === 'F' ? 'Mother' : 'Father'}</span><strong>{parent.name}</strong><small>G{parent.generation}{goal ? ` · ${goalLabel} ${wholePercent(goalMatch(parent, goal))}` : ''}{parent.status !== 'living' ? ` · ${parent.status === 'sold' ? 'Sold' : 'Rehomed'}` : ''}</small></span>
          </button>)}</div> : null}
          {movedTo && !batch.length ? <p className="batch-done" role="status"><Icon name="checkCircle" size={16} />Moved to {tankName(movedTo)}. <button className="quiet btn-sm" onClick={() => openTank(movedTo)}>Open {tankName(movedTo)}</button></p> : null}
          <Pagination page={page} count={collection.length} size={pageSize} onPage={setCollectionPage} label="Collection" />
          {collectionPending ? <div className="collection-loading-anchor"><div className="collection-loading" role="status"><span className="loading-bar" aria-hidden="true" />Loading {tank.name}'s fish…</div></div> : null}
          <div className="fish-grid">{visibleCollection.map((f, index) => <FishCard key={f.id} fish={f} index={index} view={portraitView} selected={f.id === selectedId} inBatch={batchIds.includes(f.id)}
            batchMode={batchMode || batch.length > 0} favorite={favoriteIds.has(f.id)} rank={sort === 'goal' ? page * pageSize + index + 1 : undefined}
            goal={goal && f.species === 'koi' ? { label: goalLabel, match: wholePercent(goalMatch(f, goal)) } : null}
            onSelect={keyboard => select(f.id, keyboard)} onFavorite={() => setPreferences(current => toggleFavorite(current, f.id))} onBatch={extend => toggleBatch(f.id, extend)}
            onMenu={event => cardMenu.open(event, fishMenu(f), `${f.name} actions`)} onMenuKey={element => cardMenu.openFor(element, fishMenu(f), `${f.name} actions`)} />)}</div>
          {!collection.length ? <div className="empty-state"><Icon name={favoritesOnly ? 'star' : 'fish'} size={28} /><strong>{favoritesOnly && !inCohort.some(f => favoriteIds.has(f.id)) ? 'No favorites here yet' : 'No animals match this view'}</strong>
            <p>{favoritesOnly ? 'Use the star on a card to keep a candidate.' : 'Clear a filter or search, or bring new stock from the NPC shop.'}</p></div> : null}
          {!showArchived && (batchMode || batch.length) ? <div className="batch-bar" role="group" aria-label="Batch selection">
            <span className="batch-summary"><span className="batch-count mono">{batch.length}</span><span><strong>{batch.length ? `${batch.length} selected` : 'Selecting'}</strong>
              <small>{batch.length ? salePlan.sales.length ? `${salePlan.sales.length} with offers · ◈ ${batchTotal.toLocaleString()}` : 'No buyer offers' : 'Click cards to select · shift-click for a range'}</small></span></span>
            <div className="batch-actions">
              <MenuButton className="quiet btn-sm" label="Selection" items={[
                { id: 'all', label: `Select all ${selectable.length}${birth ? ' in this clutch' : ''}`, icon: 'select', onSelect: () => { setBatchIds(selectable.map(f => f.id)); setBatchReview(null); setMovedTo(null); } },
                { id: 'buyers', label: `Select all with a buyer`, hint: `${withBuyer.length} animals`, icon: 'tag', disabled: !withBuyer.length, onSelect: () => { setBatchIds(withBuyer.map(f => f.id)); setBatchReview(null); setMovedTo(null); } },
                { id: 'clear', label: 'Clear selection', icon: 'close', disabled: !batch.length, onSelect: () => { setBatchIds([]); setBatchReview(null); } },
              ]} placement="top-start"><Icon name="select" size={15} />Select<Icon name="chevronDown" size={13} /></MenuButton>
              {batch.length && moveDestinations.length ? <button className="btn-sm" aria-haspopup="dialog" onClick={openMoveReview}><Icon name="move" size={15} />Move</button> : null}
              {rehomeBatch.length ? <button className="btn-sm" aria-haspopup="dialog" onClick={() => setBatchReview('rehome')}><Icon name="home" size={15} />Rehome {rehomeBatch.length}</button> : null}
              {batch.length && batch.length <= MAX_FOUNDATION && batch.every(f => f.life.lengthCm > 0) ? <button className="btn-sm" aria-haspopup="dialog" onClick={() => setBatchReview('bloodline')}><Icon name="crown" size={15} />Bloodline</button> : null}
              {salePlan.sales.length ? <button className="batch-sell btn-sm" aria-haspopup="dialog" onClick={() => setBatchReview('sale')}><Icon name="tag" size={15} />Sell {salePlan.sales.length} · ◈ {batchTotal.toLocaleString()}</button> : null}
              <button className="quiet icon-button btn-sm" aria-label="Finish selecting" data-tip="Finish selecting" onClick={exitBatch}><Icon name="close" size={15} /></button>
            </div>
          </div> : null}
        </div></section> : null}
        </div></>}
      </main>
      <aside className="inspector" id="inspector" tabIndex={-1} aria-label="Fish inspector">
        {fish && p ? <>
          <div className="inspector-heading">
            <span className="eyebrow">Specimen <span className="mono">{fish.id.slice(4)}</span></span>
            <span className="inspector-heading-actions">
              <button className="quiet icon-button btn-sm back-to-card" onClick={returnToCollection} aria-label="Back to this card in the collection" data-tip="Find in collection"><Icon name="grid" size={15} /></button>
              <MenuButton className="quiet icon-button btn-sm" items={fishMenu(fish)} label={`${fish.name} actions`} ariaLabel={`${fish.name} actions`} tip="Actions" placement="bottom-end"><Icon name="more" size={17} /></MenuButton>
            </span>
          </div>
          <div className={`hero-portrait species-${fish.species}`}>
            <div className="framing-toggle hero-toggle" role="group" aria-label="Large portrait shows">
              <button aria-pressed={heroView === 'current'} onClick={() => setHeroView('current')}>{fish.status === 'living' ? 'Now' : 'Last recorded'}</button>
              <button aria-pressed={heroView === 'adult'} onClick={() => setHeroView('adult')}>Adult potential</button>
            </div>
            <FishPortrait fish={fish} large view={heroView} />
            <span className="hero-caption">{heroView === 'adult' ? 'Adult genetic potential · a preview, not how this animal looks today' : `${fish.status === 'living' ? 'Now' : 'Last recorded'} · ${lifeSummary(fish)}`}</span>
          </div>
          <div className="fish-title"><h2 ref={inspectorHeading} tabIndex={-1}>{fish.name}</h2><SexMark sex={fish.sex} withLabel /></div>
          <div className="fish-tags">
            <span className="generation">G{fish.generation}</span>
            <span className={`chip ${fish.species}`}><Icon name={fish.species === 'axolotl' ? 'leaf' : fish.species === 'goldfish' ? 'goldfish' : 'fish'} size={13} />{SPECIES_INFO[fish.species].title}</span>
            <span className="chip">{fish.parents ? 'Bred here' : 'Founder stock'}</span>
            {favoriteIds.has(fish.id) ? <span className="chip brass"><Icon name="star" size={12} filled />Favorite</span> : null}
            {fish.status !== 'living' ? <span className="chip warn">{fish.status === 'sold' ? 'Sold' : 'Rehomed'}</span> : null}
          </div>
          <div className="family-glance" role="group" aria-label={`${fish.name}’s family at a glance`}>
            <Icon name="family" size={15} />
            <span>{fish.parents ? <>{fish.parents.map((id, i) => <span key={id}>{i ? ' × ' : ''}{world.fish.some(f => f.id === id)
              ? <button className="link-button" onClick={() => followRelative(id)}>{fishName(id)}</button> : `${id} (record missing)`}</span>)}</> : 'No recorded parents'}
              <small>{fish.parents ? `${kin.siblings} full sibling${kin.siblings === 1 ? '' : 's'} · ` : ''}{kin.offspring} offspring{tab === 'Family' ? null : <> · <button className="link-button" onClick={() => setTab('Family')}>Open family tree</button></>}</small></span>
          </div>
          <div className="vitals">
            {(() => { const c = fish.life.condition, ring = c >= 0.7 ? 'var(--kelp)' : c >= 0.4 ? 'var(--amber)' : 'var(--rose)';
              return <div className="vital" data-tip={selectedLimits.length ? `Limited by ${selectedLimits.join(', ')}` : 'Nothing is limiting this animal'}>
                <span className="ring" style={{ '--value': c, '--ring': ring } as React.CSSProperties}>{wholePercent(c)}</span>
                <span><small>Condition</small><b>{selectedLimits.length ? 'Limited' : c >= 0.7 ? 'Thriving' : 'Recovering'}</b></span></div>; })()}
            <div className="vital"><span><small>Size</small><b className="mono">{fish.life.lengthCm.toFixed(fish.life.lengthCm < 10 ? 1 : 0)} cm</b>
              <span className="bar tide"><span style={{ width: `${Math.round(growthShare(fish) * 100)}%` }} /></span><small>of {p.adultLengthCm.toFixed(0)} cm potential</small></span></div>
            <div className="vital brass"><span><small>Best offer</small><b className="mono">{fish.status !== 'living' ? '—' : offers[0] ? `◈ ${offers[0].amount}` : '—'}</b>
              <small>{fish.status !== 'living' ? 'Archived' : offers[0] ? offers[0].buyerName : isEgg(fish.life) ? 'Eggs cannot be sold' : 'No buyer today'}</small></span></div>
            <div className="vital gene"><span><small>Pedigree F</small><b className="mono">{percent(currentF)}</b><small>{percent(heterozygosity(fish.genome))} heterozygous</small></span></div>
          </div>
          <AnimalHonors world={world} fishId={fish.id} />
          <div className="inspector-tabs" role="tablist" aria-label="Inspector views">{(['Overview', 'Genome', 'Family'] as const).map((t, i, all) => <button key={t} role="tab" id={`inspector-tab-${t}`} aria-selected={tab === t} aria-controls="inspector-panel" tabIndex={tab === t ? 0 : -1} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}
            onKeyDown={event => { const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0; if (!step) return; event.preventDefault(); const next = all[(i + step + all.length) % all.length]; setTab(next); document.getElementById(`inspector-tab-${next}`)?.focus(); }}>
            <Icon name={t === 'Overview' ? 'eye' : t === 'Genome' ? 'dna' : 'family'} size={15} />{t}</button>)}</div>
          <div id="inspector-panel" role="tabpanel" aria-labelledby={`inspector-tab-${tab}`}>
          {tab === 'Overview' ? <div className="inspector-panel">
            <form className="rename-form" key={fish.id} onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); if (run({ type: 'rename', fishId: fish.id, name: String(data.get('name')) }, 'Fish name updated.')) markGuide('rename'); }}>
              <label>Given name<input id="rename-name" name="name" autoComplete="off" spellCheck={false} aria-label="Given name" defaultValue={fish.name} maxLength={32} required disabled={fish.status !== 'living'} /></label><button disabled={fish.status !== 'living'}>Rename</button></form>
            <dl className="facts">
              <div><dt>Species</dt><dd>{fish.species === 'koi' ? 'Koi' : SPECIES_INFO[fish.species].latin}</dd></div>
              <div><dt>Born in the lab</dt><dd>{date(fish.bornAt)}</dd></div>
              <div><dt>Life stage</dt><dd>{lifeSummary(fish)}</dd></div>
              <div><dt>Age</dt><dd>{fish.life.ageDays} game day{fish.life.ageDays === 1 ? '' : 's'}</dd></div>
              {selectedLimits.length ? <div><dt>Condition limits</dt><dd>{selectedLimits.join(', ')}</dd></div> : null}
              {fish.status === 'living' ? <div><dt>Breeding</dt><dd>{breedingStatus(world, fish)}</dd></div> : null}
              {fish.status === 'living' ? <div><dt>Behavior now</dt><dd>{isEgg(fish.life) ? 'Incubating' : fish.tankId !== tank.id ? 'In another aquarium' : behavior ? describeBehavior(behavior, fishName) : 'Watching…'}</dd></div> : null}
              {fish.status === 'living' ? <div><dt>Aquarium</dt><dd>{tankName(fish.tankId)}</dd></div> : null}
              {goal && fish.species === 'koi' ? <div><dt>Goal · {goalLabel}</dt><dd>{wholePercent(goalMatch(fish, goal))}</dd></div> : null}
              <div><dt>New mutations at birth</dt><dd>{fish.mutations.length}</dd></div>
            </dl>
            {offers[0] ? <details className="offer-details"><summary>Why ◈ {offers[0].amount} from the {offers[0].buyerName.toLowerCase()}</summary>
              <ol>{offers[0].terms.map(term => <li key={term.label}><span>{term.label}</span><span className="mono">{signedCredits(term.amount)}</span></li>)}</ol>
              <p>{offers.length > 1 ? `Other offers: ${offers.slice(1).map(offer => `${offer.buyerName} ◈ ${offer.amount}`).join(' · ')}.` : 'No other buyer wants this fish today.'} Offers change as buyers’ demand is used up and recovers each game day.</p>
            </details> : null}
            <div className="trait-block"><div className="block-title"><Icon name="sparkles" size={15} /><span className="eyebrow">Inherited tendencies</span></div>
              {([['Sociability', p.social], ['Boldness', p.bold], ['Activity', p.activity], ['Curiosity', p.curious]] as const).map(([name, value]) => <div className="trait" key={name} role="meter" aria-label={name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
                <span>{name}</span><span className="bar gene"><span style={{ width: `${Math.round(value * 100)}%` }} /></span><span className="mono">{Math.round(value * 100)}</span></div>)}</div>
            <RarityPanel world={world} fish={fish} />
            <GenesisPanel world={world} fish={fish} readOnly={initial.readOnly || blocked} onRun={run} />
            {fish.species === 'goldfish' ? <GoldfishTraitPanel fish={fish} genotypeKnown={genotypeVisible(world, fish)} /> : fish.species === 'axolotl' ? <AxolotlTraitPanel fish={fish} genotypeKnown={genotypeVisible(world, fish)} /> : koiGenome ? <>
              <div className="trait-block appearance-block"><div className="block-title"><Icon name="brush" size={15} /><span className="eyebrow">Appearance · genome v{koiGenome.version}</span></div>{koiGenome.version === 1 ? <p className="help-copy">Genome v1 fish carry no Color or Ornament chromosomes and keep the classic look. Their offspring carry both chromosomes, where a new mutation can appear.</p> : null}<dl className="appearance-traits">{appearanceRows.map(row => <div key={row.trait}><dt>{row.trait}</dt><dd>{row.value}</dd></div>)}</dl></div>
              <div className="trait-block appearance-block structure-block"><div className="block-title"><Icon name="layers" size={15} /><span className="eyebrow">Structure · genome v{koiGenome.version}</span></div>{koiGenome.version < 3 ? <p className="help-copy">Genome v{koiGenome.version} fish carry no Structure chromosome and keep a standard tail, dorsal fin and two barbels. Their offspring carry it, where a rare structural mutation can appear.</p> : null}<dl className="appearance-traits">{describeStructure(koiGenome).map(row => <div key={row.trait}><dt>{row.trait}</dt><dd>{row.value}{row.carrier && genotypeVisible(world, fish) ? <span className="rarity carrier">hidden copy</span> : null}</dd></div>)}</dl></div>
            </> : null}
            {fish.status === 'living' ? <div className="fish-actions">
              <button className="primary" disabled={isEgg(fish.life)} onClick={() => setAsParent(fish)}><Icon name="heart" size={16} />Select as {fish.sex === 'F' ? 'mother' : 'father'}</button>
              <Select label="Move to aquarium" prefix="Move to" icon="move" value={fish.tankId} onChange={value => moveOne(fish, value)}
                options={world.tanks.map(t => ({ value: t.id, label: t.name, hint: t.id === fish.tankId ? 'Current aquarium' : `${Math.max(0, freePlaces(t.id))} free`, disabled: t.id !== fish.tankId && freePlaces(t.id) <= 0 }))} />
              <div className="fish-actions-row">
                {offers[0] ? <button className="brass sell" onClick={() => { setSaleId(fish.id); setRehomeId(null); }}><Icon name="tag" size={15} />Sell · ◈ {offers[0].amount}</button> : <button className="sell" disabled>No buyer today</button>}
                <button className="quiet" disabled={isEgg(fish.life)} onClick={() => { setRehomeId(fish.id); setSaleId(null); }}><Icon name="home" size={15} />Rehome</button>
              </div>
            </div> : <p className="archive-note">{fish.status === 'rehomed' ? 'This fish was rehomed outside your aquarium.' : 'This fish was sold to an NPC buyer.'} Its genome and family links are preserved.</p>}
          </div> : null}
          {tab === 'Genome' && fish.species === 'axolotl' ? <div className="genome-view inspector-panel"><div className="genome-fingerprint"><span>Axolotl genome checksum</span><code>{fingerprint(fish.genome)}</code></div><AxolotlGenomeView fish={fish} world={world} />{notebook ? <MutationOrigins fish={fish} notebook={notebook} onSelect={id => select(id, true)} /> : null}</div> : null}
          {tab === 'Genome' && fish.species === 'goldfish' ? <div className="genome-view inspector-panel"><div className="genome-fingerprint"><span>Goldfish genome checksum</span><code>{fingerprint(fish.genome)}</code></div><GoldfishGenomeView fish={fish} world={world} />{notebook ? <MutationOrigins fish={fish} notebook={notebook} onSelect={id => select(id, true)} /> : null}</div> : null}
          {tab === 'Genome' && fish.species === 'koi' ? <div className="genome-view inspector-panel">
            <div className="genome-fingerprint"><span>Genome checksum</span><code>{fingerprint(fish.genome)}</code></div>
            <div className="allele-legend"><span><i className="allele-dot m" />Copy from mother</span><span><i className="allele-dot p" />Copy from father</span><span><b>*</b> new mutation</span><span><b>◆</b> inherited mutation</span></div>
            {world.atlas.mode === 'discovery' ? <p className="help-copy atlas-note"><Icon name="search" size={13} /> Discovery mode: unidentified loci show as numbers and {genotypeVisible(world, fish) ? 'this sequenced animal’s alleles are shown without meaning until the Atlas works them out' : 'alleles stay hidden until you sequence this animal'}. Open the Genome Atlas to see what you have learned.</p> : null}
            <details className="help-details"><summary>How to read this genome</summary><p className="help-copy">Two phased copies per locus. A0–A5 are allele IDs; N marks a new open-ended allele that arose in this world. Genome v4 (Genesis) reads quantitative loci by dominance (each allele has a potency, so a strong copy can hide a weak one) and adds chromosome 12, Development: a pigment cascade that can silence every color, a dominant veil fin program, canalization, photophore glow, maturity timing and regeneration. Most blend; A5/A5 at the metallic switch expresses strong metallic color. Chromosomes 09–10 (genome v2) hold color and ornament, with named categorical alleles and additive intensity levels. Classic dominates body, accent and eye colors; variants need two nonclassic copies. One motif copy shows faintly, and different motifs mix. Smooth scales dominate variants. Chromosome 11 (genome v3) holds structure: a paired fan or crown tail, a reduced or missing dorsal fin and other barbel counts each need two variant copies, and additive levels shape them. Hidden copies can still pass to offspring.</p></details>
            {CHROMOSOMES.map((chromosome, chromosomeIndex) => {
              const absent = chromosomeIndex * 6 >= fish.genome.maternal.length;
              return <div className={`chromosome ${absent ? 'absent' : ''}`} key={chromosome}><h3><span className="chromosome-index mono">{String(chromosomeIndex + 1).padStart(2, '0')}</span>{chromosome}{absent ? <small>not carried by genome v{fish.genome.version}</small> : null}</h3>{LOCUS_REGISTRY.slice(chromosomeIndex * 6, chromosomeIndex * 6 + 6).map(entry => {
                const i = entry.index, locus = entry.id, mutation = fish.mutations.some(m => m.locus === i), inherited = !mutation && fish.origins.some(o => o.locus === i);
                const carried = i < fish.genome.maternal.length, baseline = `Not carried by genome v${fish.genome.version}; reads as ${alleleLabel(locus, entry.baseline ?? 0)}`;
                const stage = locusStage(world, 'koi', i), seen = genotypeVisible(world, fish);
                const name = stage >= 1 ? label(locus) : `Locus ${chromosomeIndex + 1}.${i % 6 + 1}`;
                const description = stage >= 1 ? KOI_LOCUS_NOTES[locus] : 'Not identified yet. Breed parents that carry different alleles here; the Genome Atlas collects the evidence.';
                const inheritance = stage >= 2 ? `${KOI_EXPRESSION_NOTES[entry.expression]}${entry.dominance && fish.genome.genesis ? ` Genesis: ${DOMINANCE_LABELS[entry.dominance]}.` : ''}` : 'How its two copies combine is not worked out yet.';
                const allele = (value: number, copy: 'm' | 'p') => !seen ? <code className={`allele ${copy} hidden`} title="Sequence this animal to read its alleles">??</code>
                  : <code className={`allele ${copy}`} title={`Copy inherited from ${copy === 'm' ? 'mother' : 'father'}`}>{isNovel(value) ? 'N' : `A${value}`}{isNovel(value) ? <small>{alleleNames.get(value) ?? 'new allele'}</small> : i >= 48 && stage >= 2 ? <small>{alleleLabel(locus, value)}</small> : null}</code>;
                return <div className={`locus ${i >= 48 ? 'appearance-locus' : ''} ${mutation ? 'mutated' : ''} ${carried ? '' : 'absent'} ${stage ? '' : 'unknown'}`} key={locus}><span><LocusTip label={name} description={description} inheritance={inheritance}>{mutation ? ' *' : inherited ? ' ◆' : ''}</LocusTip></span>{carried ? <>{allele(fish.genome.maternal[i], 'm')}{allele(fish.genome.paternal[i], 'p')}</> : <><code title={baseline}>—</code><code title={baseline}>—</code></>}</div>;
              })}</div>;
            })}
            <p className="help-copy">No global rarity is measured in this offline lab.</p>{notebook ? <MutationOrigins fish={fish} notebook={notebook} onSelect={id => select(id, true)} /> : null}<div className="marking-blocks"><h3>Inherited marking blocks</h3><p className="help-copy">Each pair of neighbouring Pigments or Pattern loci on one chromosome copy places one marking. Siblings that inherit the same copy share it; a crossover or mutation inside the pair moves it.</p><ol>{p.markings.map((anchor, index) => {
              const visible = (anchor.layer === 'dark' ? p.black : p.red) * (1 - p.translucency) >= MARKING_VISIBLE_ALPHA, drawn = index < p.frequency;
              return <li key={anchor.key} className={drawn && visible ? '' : 'muted'}><span className={`marking-swatch ${anchor.layer}`} aria-hidden="true" /><span>{MARKING_BLOCKS[anchor.block].label}<small>A{anchor.alleles[0]}·A{anchor.alleles[1]} · {anchor.origin === 'both' ? 'on both copies (bolder)' : anchor.origin === 'maternal' ? 'copy from mother' : 'copy from father'}</small></span><span>{anchor.layer === 'dark' ? 'Dark' : 'Warm'}{!drawn ? ' · not drawn' : !visible ? ' · too faint' : ''}</span></li>;
            })}</ol></div></div> : null}
          {tab === 'Family' && genealogy ? <div className="inspector-panel"><FamilyView key={fish.id} world={world} index={genealogy} fish={fish} depth={familyDepth} trail={familyTrail} pedigreeF={percent(currentF)} founders={fishFounders}
            onDepth={setFamilyDepth} onNavigate={navigateFamily} onBack={() => select(familyTrail[familyTrail.length - 1], true, familyTrail.slice(0, -1))}
            onReturn={() => select(familyTrail[0], true)} />
            {fish.species === 'koi' ? <BloodlineSection world={world} fish={fish} onRun={run} onSelect={id => select(id, true)} /> : <p className="help-copy">{SPECIES_INFO[fish.species].title} ancestry and pedigree are fully tracked here. Named bloodline standards remain koi-specific because those standards are defined on koi visual descriptors.</p>}</div> : null}
          </div>
        </> : <div className="empty-state inspector-empty"><Icon name="fish" size={30} /><strong>No animal selected</strong><p>Click a swimming fish or a card in the collection to read its profile, genome and family.</p></div>}
      </aside>
    </div>}
    </div>

    {/* ---- Confirmations ---- */}
    <Dialog open={!!saleFish && !!offers[0] && saleFish.id === fish?.id} onClose={() => setSaleId(null)} fallbackFocus={backToProfile} tone="brass" icon="tag"
      title={saleFish && offers[0] ? `Sell ${saleFish.name} for ◈ ${offers[0].amount}?` : ''}
      description={offers[0] ? `The ${offers[0].buyerName.toLowerCase()} pays the best price today. ${saleFish?.name}'s genome and family record stay in the archive.` : undefined}
      actions={<><button className="quiet" onClick={() => setSaleId(null)}>Cancel</button><button className="confirm" onClick={() => {
        const offer = offers[0]; if (saleFish && offer) run({ type: 'sell', fishId: saleFish.id, priceModel: PRICE_MODEL }, `${saleFish.name} sold to the ${offer.buyerName.toLowerCase()} for ◈ ${offer.amount}. The archived profile remains in the family tree.`); setSaleId(null);
      }}><Icon name="coins" size={16} />Confirm sale</button></>}>
      {offers[0] ? <ol className="dialog-list">{offers[0].terms.map(term => <li key={term.label}><Icon name="spark" size={13} /><span>{term.label}</span><span>{signedCredits(term.amount)}</span></li>)}</ol> : null}
    </Dialog>
    <Dialog open={!!renamingTank} onClose={() => setRenamingTankId(null)} fallbackFocus={() => document.getElementById('collection')} icon="tag" title="Rename aquarium"
      description="A name is only a label. Residents, water and history stay exactly as they are.">
      {renamingTank ? <form className="rename-form" key={renamingTank.id} onSubmit={event => { event.preventDefault(); const name = String(new FormData(event.currentTarget).get('name')); if (run({ type: 'rename-tank', tankId: renamingTank.id, name }, 'Aquarium renamed.')) setRenamingTankId(null); }}>
        <label>Aquarium name<input name="name" autoFocus autoComplete="off" spellCheck={false} aria-label="Aquarium name" defaultValue={renamingTank.name} maxLength={32} required /></label>
        <button className="primary">Rename</button></form> : null}
    </Dialog>
    <Dialog open={!!rehomeFish}onClose={() => setRehomeId(null)} fallbackFocus={backToProfile} icon="home" title={rehomeFish ? `Rehome ${rehomeFish.name}?` : ''}
      description="They leave for a new home outside your aquarium. No credits change, and their family record remains available."
      actions={<><button className="quiet" onClick={() => setRehomeId(null)}>Cancel</button><button className="primary" onClick={() => { if (rehomeFish) run({ type: 'rehome-batch', fishIds: [rehomeFish.id] }, `${rehomeFish.name} was rehomed. The archived profile remains in the family tree.`, 'info'); setRehomeId(null); }}>Confirm rehoming</button></>} />
    <Dialog open={batchReview === 'sale' && salePlan.sales.length > 0} onClose={() => setBatchReview(null)} fallbackFocus={() => document.getElementById('collection')} tone="brass" icon="coins" wide
      title={`Sell ${salePlan.sales.length} animals to NPC buyers?`}
      description={`Highest offers sell first, each to its best buyer, and every sale uses up some of that buyer’s demand. Genomes and family links stay in the archive.${batch.length > saleBatch.length ? ` ${batch.length - saleBatch.length} selected ${batch.length - saleBatch.length === 1 ? 'animal is a favorite or an egg and stays' : 'animals are favorites or eggs and stay'}.` : ''}${salePlan.unsold.length ? ` ${salePlan.unsold.length} ${salePlan.unsold.length === 1 ? 'has' : 'have'} no buyer today and stay.` : ''}`}
      actions={<><button className="quiet" onClick={() => setBatchReview(null)}>Cancel</button><button className="confirm" onClick={sellBatch}><Icon name="coins" size={16} />Confirm sale · ◈ {batchTotal.toLocaleString()}</button></>}>
      <ul className="dialog-list">{salePlan.sales.map(sale => { const f = world.fish.find(member => member.id === sale.fishId)!;
        return <li key={f.id}><SexMark sex={f.sex} /><span>{f.name}<small>{f.id} · G{f.generation} · {sale.offer.buyerName}</small></span><span>◈ {sale.offer.amount}</span></li>; })}</ul>
      <div className="dialog-total"><span>Total</span><strong>◈ {batchTotal.toLocaleString()}</strong></div>
    </Dialog>
    <Dialog open={clearOpen && !!clearPlan && clearable.length > 0} onClose={() => setClearOpen(false)} fallbackFocus={() => document.getElementById('collection')} tone="brass" icon="coins" wide
      title={`Sell all fish in ${tank.name}?`}
      description={clearPlan ? `${clearPlan.sales.length ? `${clearPlan.sales.length} sell to their best NPC buyers for ◈ ${clearPlan.total.toLocaleString()}` : 'No NPC buyer wants any of them today'}${clearPlan.unsold.length ? `; ${clearPlan.unsold.length} with no buyer ${clearPlan.unsold.length === 1 ? 'is' : 'are'} rehomed for free` : ''}. Genomes and family links stay in the archive.${residents.length > clearable.length ? ` ${residents.length - clearable.length} ${residents.length - clearable.length === 1 ? 'favorite, egg or courting animal stays' : 'favorites, eggs or courting animals stay'}.` : ''}` : undefined}
      actions={<><button className="quiet" onClick={() => setClearOpen(false)}>Cancel</button><button className="confirm" disabled={initial.readOnly} onClick={clearTank}><Icon name="coins" size={16} />Sell {clearPlan?.sales.length ?? 0}{clearPlan?.unsold.length ? ` · rehome ${clearPlan.unsold.length}` : ''}{clearPlan?.total ? ` · ◈ ${clearPlan.total.toLocaleString()}` : ''}</button></>}>
      {clearPlan ? <ul className="dialog-list">{clearPlan.sales.map(sale => { const f = world.fish.find(member => member.id === sale.fishId)!;
        return <li key={f.id}><SexMark sex={f.sex} /><span>{f.name}<small>{f.id} · G{f.generation} · {sale.offer.buyerName}</small></span><span>◈ {sale.offer.amount}</span></li>; })}
        {clearPlan.unsold.map(id => { const f = world.fish.find(member => member.id === id)!;
        return <li key={f.id}><SexMark sex={f.sex} /><span>{f.name}<small>{f.id} · G{f.generation} · no buyer today</small></span><span>Rehomed</span></li>; })}</ul> : null}
      {clearPlan?.sales.length ? <div className="dialog-total"><span>Total</span><strong>◈ {clearPlan.total.toLocaleString()}</strong></div> : null}
    </Dialog>
    <Dialog open={batchReview === 'rehome' && rehomeBatch.length > 0} onClose={() => setBatchReview(null)} fallbackFocus={() => document.getElementById('collection')} icon="home" wide title={`Rehome ${rehomeBatch.length} animals outside your aquarium?`}
      description={`They leave for new homes. No credits change, and their genomes and family links stay in the archive.${batch.length > rehomeBatch.length ? ` ${batch.length - rehomeBatch.length} selected ${batch.length - rehomeBatch.length === 1 ? 'animal is an egg or courting and stays' : 'animals are eggs or courting and stay'}.` : ''}`}
      actions={<><button className="quiet" onClick={() => setBatchReview(null)}>Cancel</button><button className="primary" disabled={initial.readOnly} onClick={rehomeSelected}>Confirm rehoming of {rehomeBatch.length}</button></>}>
      <ul className="dialog-list">{rehomeBatch.map(f => <li key={f.id}><SexMark sex={f.sex} /><span>{f.name}<small>{f.id} · G{f.generation} · {lifeSummary(f)}</small></span><span>{favoriteIds.has(f.id) ? '★' : ''}</span></li>)}</ul>
    </Dialog>
    <Dialog open={batchReview === 'move' && batch.length > 0 && !!moveDestination} onClose={() => setBatchReview(null)} fallbackFocus={() => document.getElementById('collection')} icon="move" wide
      title={moveDestination ? `Move ${batch.length} animals to ${moveDestination.name}?` : ''}
      description={moveDestination ? `${moveDestination.name} has ${Math.max(0, freePlaces(moveDestination.id))} free places${reservedPlaces(world, moveDestination.id) ? `, after ${reservedPlaces(world, moveDestination.id)} reserved for a courting clutch` : ''}; ${placesAfter >= 0 ? `${placesAfter} remain after this move` : `that is ${-placesAfter} too few for this move`}. Records, genomes, family links and clutch records do not change${batch.some(f => isEgg(f.life)) ? ', and moved eggs keep incubating' : ''}.` : undefined}
      actions={<><button className="quiet" onClick={() => setBatchReview(null)}>Cancel</button><button className="primary" disabled={placesAfter < 0 || initial.readOnly} onClick={moveBatch}><Icon name="move" size={16} />Confirm move of {batch.length}</button></>}>
      {moveDestination ? <Select label="Destination" prefix="Destination" icon="tank" value={moveDestination.id} onChange={setMoveTarget}
        options={moveDestinations.map(t => ({ value: t.id, label: t.name, hint: `${Math.max(0, freePlaces(t.id))} free places` }))} /> : null}
      {pausedByMove.map(text => <p className="dialog-note" key={text}>{text}</p>)}
      <ul className="dialog-list">{batch.map(f => <li key={f.id}><SexMark sex={f.sex} /><span>{f.name}<small>{f.id} · G{f.generation} · {lifeSummary(f)}</small></span><span>{favoriteIds.has(f.id) ? '★' : ''}</span></li>)}</ul>
    </Dialog>
    <Dialog open={batchReview === 'bloodline' && batch.length > 0} onClose={() => setBatchReview(null)} fallbackFocus={() => document.getElementById('collection')} tone="gene" icon="crown" wide title={`Register a bloodline from ${batch.length} founders`}
      description="Name a standard defined by what these animals share. Descendants that meet it carry the bloodline in their records.">
      {batchReview === 'bloodline' && batch.length ? <BloodlineRegistration world={world} foundation={batch} onRun={run} onDone={() => { setBatchIds([]); setBatchReview(null); setBatchMode(false); }} onCancel={() => setBatchReview(null)} /> : null}
    </Dialog>
    <Dialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} icon="command" wide title="Keyboard shortcuts" description="Fishtank is a local genetics lab: synthetic genomes, local saves, NPC buyers and shows. Your world is saved only in this browser; the typefaces load from Google Fonts.">
      <div className="shortcut-grid">{([
        ['Search and commands', ['Ctrl', 'K']], ['Search (anywhere)', ['/']], ['Advance one day', ['.']], ['Feed this aquarium', ['F']], ['Pause or play swimming', ['M']],
        ['Previous / next aquarium', ['[', ']']], ['Collection · Breeding · Care · Habitat', ['1', '4']], ['Go to aquarium / competitions / trophies', ['G', 'A']],
        ['Card or tank actions', ['Shift', 'F10']], ['Close a menu, dialog or drawer', ['Esc']],
      ] as const).map(([text, keys]) => <div key={text}><span>{text}</span><span>{keys.map(k => <kbd key={k}>{k}</kbd>)}</span></div>)}</div>
      <p className="help-copy">Version 0.1 research lab · <a className="link-button" href="https://github.com/ElMariones/fishtank-sim" target="_blank" rel="noreferrer">project repository</a></p>
    </Dialog>
    <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={paletteCommands} />
    <ToastStack notices={notices} />
    {cardMenu.node}
    <TooltipLayer />
  </div>;
}
