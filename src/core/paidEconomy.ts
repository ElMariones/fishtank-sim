import { clutchMembers, courtingClutchOf, pairingBlockers, reservedPlaces } from './breeding';
import { AERATION_TIERS, careSettings, FILTER_TIERS } from './care';
import { GENOME_VERSION } from './catalog';
import { isEgg, lifeStage } from './development';
import { BUYERS, ledgerBalance, offersFor, planSales, saleTraits, type TraitCache } from './economy';
import { advanceWorld } from './habitat';
import { routeToPairing } from './playtest';
import { missingSexes, reliefDestination, reliefStatus } from './recovery';
import { decodeSave } from './save';
import { LISTING_PRICES } from './shop';
import { DECORATION_PRICE, decorationsOf, TANK_PRICE, TANK_UPGRADE_PRICE } from './tankManagement';
import type { BuyerId, Fish, World } from './types';
import { TICKS_PER_GAME_DAY } from './water';
import { applyCommand, createWorld, MAX_LIVING, MAX_RECORDS, MAX_TANKS, type Command } from './world';

/**
 * FS-505 paid-economy playtest (E-05 with prices). Seeded keepers play the complete solo loop for PLAYTEST_DAYS game days
 * with only the commands the live aquarium sends: paid aquariums and expansions, shop listings, decorations, equipment,
 * water changes, normal courtship, reviewed sales, rehoming and the koi rescue. Legacy free commands (`add-tank`,
 * `decorate`, `buy`, `breed`) are refused by the harness. Every game day checks that the ledger reconciles; at fixed days
 * a copy of the world must reach an accepted pairing without gaining credits. Nothing reads or writes a player's world.
 */
export const PLAYTEST_DAYS = 90;
export const ROUTE_CHECK_EVERY = 15;
export const ROUTE_CHECK_DAYS = 60;
const TIMESTAMP = '2026-09-16T00:00:00.000Z';
const LEGACY_FREE: readonly Command['type'][] = ['add-tank', 'decorate', 'buy', 'breed'];

type Keeper = {
  id: 'guided' | 'selective' | 'expander' | 'shopCollector' | 'premiumCare' | 'spendDown';
  label: string; description: string;
  clutchSize: 16 | 20 | 24;
  /** Offspring of each sex kept from every clutch as future parents. */
  keep: number;
  /** Lowest acceptable offer, and whether the pet shop counts as a buyer. */
  minOffer: number; collectorsOnly: boolean;
  /** Game days a sellable adult may wait for an acceptable offer before it is rehomed. */
  rehomeAfter: number;
  /** When to buy room: never, only when a clutch has no nursery, or whenever credits allow. */
  expand: 'whenNeeded' | 'eager';
  /** Credits kept back from purchases of room, stock and equipment. */
  reserve: number;
  /** Shop listings of visible variants or documented carriers bought as breeders, at most this many. */
  shopBuys: number;
  premiumCare: boolean;
  decorate: boolean;
  /** First-session actions from the guide: rename and feed. */
  guide: boolean;
  /** Spends every credit on aquariums and decorations on day 1, then rehomes every male. */
  spendDown: boolean;
};

export const KEEPERS: readonly Keeper[] = [
  { id: 'guided', label: 'First-session keeper', description: 'Follows the guide: names and feeds, courts the best founder pair into a 20-egg clutch, keeps two of each sex, sells adults for at least ◈ 20, rehomes those that wait 10 game days, and buys an aquarium only when a clutch has no nursery, keeping ◈ 250 back.', clutchSize: 20, keep: 2, minOffer: 20, collectorsOnly: false, rehomeAfter: 10, expand: 'whenNeeded', reserve: 250, shopBuys: 0, premiumCare: false, decorate: false, guide: true, spendDown: false },
  { id: 'selective', label: 'Selective breeder, paid room', description: 'E-05’s selective breeder with prices: 16-egg clutches, keeps two of each sex, sells adults for at least ◈ 30, rehomes after 12 game days, and pays for room only when a clutch has no nursery.', clutchSize: 16, keep: 2, minOffer: 30, collectorsOnly: false, rehomeAfter: 12, expand: 'whenNeeded', reserve: 0, shopBuys: 0, premiumCare: false, decorate: false, guide: false, spendDown: false },
  { id: 'expander', label: 'Expansion first', description: 'Buys expansions and aquariums whenever credits allow, keeps four of each sex per 24-egg clutch, sells adults for at least ◈ 30 and rehomes after 20 game days.', clutchSize: 24, keep: 4, minOffer: 30, collectorsOnly: false, rehomeAfter: 20, expand: 'eager', reserve: 0, shopBuys: 0, premiumCare: false, decorate: false, guide: false, spendDown: false },
  { id: 'shopCollector', label: 'Shop variant collector', description: 'Buys up to four visible-variant or carrier listings as breeders, courts the rarest ready pair, sells only to trait collectors for at least ◈ 60 and rehomes after 15 game days.', clutchSize: 16, keep: 2, minOffer: 60, collectorsOnly: true, rehomeAfter: 15, expand: 'whenNeeded', reserve: 100, shopBuys: 4, premiumCare: false, decorate: false, guide: false, spendDown: false },
  { id: 'premiumCare', label: 'Premium care and decoration', description: 'The selective breeder who also buys Strong filters and aeration, six decorations per starter tank and a 25% water change in every tank each five game days.', clutchSize: 16, keep: 2, minOffer: 30, collectorsOnly: false, rehomeAfter: 12, expand: 'whenNeeded', reserve: 0, shopBuys: 0, premiumCare: true, decorate: true, guide: false, spendDown: false },
  { id: 'spendDown', label: 'Spend-down and rescue', description: 'Spends every credit on three aquariums on day 1 and rehomes every male, then recovers with the koi rescue and breeds like the selective breeder.', clutchSize: 16, keep: 2, minOffer: 30, collectorsOnly: false, rehomeAfter: 12, expand: 'whenNeeded', reserve: 0, shopBuys: 0, premiumCare: false, decorate: false, guide: false, spendDown: true },
];

/** Where credits came from and went, from the ledger totals and the harness's own split of equipment spending. */
export type SourcesAndSinks = {
  sales: number;
  stock: number; aquariums: number; expansions: number; decorations: number; careEquipment: number; waterChanges: number;
};
export type KeeperDay = { day: number; credits: number; income: number; spent: number; living: number; places: number };
export type RouteCheck = { day: number; days: number; claims: number; bought: boolean };
export type Milestones = {
  firstCourtship: number | null; firstEggs: number | null; firstHatch: number | null; firstSale: number | null;
  firstRoomBought: number | null; secondGeneration: number | null;
};
export type KeeperResult = {
  id: Keeper['id']; label: string; description: string;
  finalCredits: number; net: number; lowestCredits: number; lowestDay: number;
  flows: SourcesAndSinks; incomeByBuyer: Record<BuyerId, number>;
  sold: number; rehomed: number; bred: number; rescues: number; bought: number;
  aquariums: number; expansions: number; finalPlaces: number; peakLiving: number;
  /** First game day on which cumulative sales covered cumulative spending, if any. */
  paybackDay: number | null;
  /** Game days that ended with a sex missing. */
  missingSexDays: number;
  milestones: Milestones;
  routeChecks: RouteCheck[];
  /** Every day's ledger reconciled with the balance, and the final world decodes as a valid save. */
  reconciled: boolean; validSave: boolean;
  /** The world's own ledger totals by reason, to check the harness's split against. */
  ledgerTotals: World['ledger']['totals'];
  commands: Partial<Record<Command['type'], number>>;
  refused: number;
  days: KeeperDay[];
};
export type PaidEconomyReport = { days: number; keepers: KeeperResult[] };

export const totalSinks = (flows: SourcesAndSinks) => flows.stock + flows.aquariums + flows.expansions + flows.decorations + flows.careEquipment + flows.waterChanges;

function playKeeper(keeper: Keeper): KeeperResult {
  let world: World = createWorld(TIMESTAMP), tick = 0, day = 0;
  const cache: TraitCache = new Map(), startCredits = world.credits;
  const keepers = new Set(world.fish.map(f => f.id)), processed = new Set<string>(), sellableSince = new Map<string, number>();
  const flows: SourcesAndSinks = { sales: 0, stock: 0, aquariums: 0, expansions: 0, decorations: 0, careEquipment: 0, waterChanges: 0 };
  const incomeByBuyer = Object.fromEntries(BUYERS.map(buyer => [buyer.id, 0])) as Record<BuyerId, number>;
  const milestones: Milestones = { firstCourtship: null, firstEggs: null, firstHatch: null, firstSale: null, firstRoomBought: null, secondGeneration: null };
  const commands: Partial<Record<Command['type'], number>> = {}, days: KeeperDay[] = [], routeChecks: RouteCheck[] = [];
  let sold = 0, rehomed = 0, bought = 0, aquariums = 0, expansions = 0, refused = 0, peakLiving = 0, missingSexDays = 0;
  let lowestCredits = world.credits, lowestDay = 0, paybackDay: number | null = null, reconciled = true, dayIncome = 0, daySpent = 0;

  /** Runs a live command and books its credit change; refused commands leave the world unchanged. */
  const tryRun = (command: Command) => {
    if (LEGACY_FREE.includes(command.type)) throw new Error(`The paid playtest never sends the legacy ${command.type} command.`);
    try {
      const before = world.credits;
      world = applyCommand(world, command);
      commands[command.type] = (commands[command.type] ?? 0) + 1;
      if (world.credits < before) daySpent += before - world.credits;
      return true;
    } catch { refused++; return false; }
  };
  const living = () => world.fish.filter(f => f.status === 'living');
  const traits = (fish: Fish) => saleTraits(fish, cache);
  const stageOf = (fish: Fish) => lifeStage(fish.life, traits(fish));
  const spare = (cost: number) => world.credits - cost >= keeper.reserve;
  const free = (tankId: string) => {
    const tank = world.tanks.find(t => t.id === tankId)!;
    return tank.capacity - world.fish.filter(f => f.status === 'living' && f.tankId === tankId).length - reservedPlaces(world, tankId);
  };
  const places = () => world.tanks.reduce((sum, tank) => sum + tank.capacity, 0);

  function buyRoom(): boolean {
    const expandable = world.tanks.find(tank => tank.capacity < 60);
    if (expandable && spare(TANK_UPGRADE_PRICE) && tryRun({ type: 'upgrade-tank', tankId: expandable.id })) {
      flows.expansions += TANK_UPGRADE_PRICE; expansions++; milestones.firstRoomBought ??= day; return true;
    }
    if (world.tanks.length < MAX_TANKS && spare(TANK_PRICE) && tryRun({ type: 'purchase-tank' })) {
      flows.aquariums += TANK_PRICE; aquariums++; milestones.firstRoomBought ??= day; return true;
    }
    return false;
  }

  function nurseryFor(size: number): string | null {
    const open = () => world.tanks.find(t => free(t.id) >= size && !world.clutches.some(c => c.stage === 'courting' && c.nurseryId === t.id))?.id ?? null;
    let found = open();
    for (let attempt = 0; !found && attempt < 3 && buyRoom(); attempt++) found = open();
    return found;
  }

  /** Higher is a more promising breeder: collectors chase rarity, everyone else tail length. */
  const promise = (fish: Fish) => keeper.shopBuys ? traits(fish).rarity + traits(fish).tail : traits(fish).tail;
  const ready = (fish: Fish) => fish.status === 'living' && keepers.has(fish.id) && stageOf(fish) === 'adult' && fish.life.condition >= 0.7
    && fish.breeding.cooldownDays === 0 && !courtingClutchOf(world, fish.id);

  function court() {
    if (world.clutches.some(c => c.stage === 'courting')) return;
    const byPromise = (sex: Fish['sex']) => living().filter(f => f.sex === sex && ready(f)).sort((a, b) => promise(b) - promise(a));
    const [mother] = byPromise('F'), [father] = byPromise('M');
    if (!mother || !father) return;
    if (father.tankId !== mother.tankId && !tryRun({ type: 'move', fishId: father.id, tankId: mother.tankId })) return;
    const nurseryId = nurseryFor(keeper.clutchSize);
    const request = { motherId: mother.id, fatherId: father.id, nurseryId: nurseryId ?? '', size: keeper.clutchSize };
    if (!nurseryId || pairingBlockers(world, request, { maxLiving: MAX_LIVING, maxRecords: MAX_RECORDS }).length) return;
    if (tryRun({ type: 'pair', ...request, timestamp: TIMESTAMP, genomeVersion: GENOME_VERSION })) {
      milestones.firstCourtship ??= day;
      if (mother.parents || father.parents) milestones.secondGeneration ??= day;
    }
  }

  function keepBest() {
    for (const clutch of world.clutches) {
      if (processed.has(clutch.id) || clutch.stage !== 'hatched') continue;
      const members = clutchMembers(world, clutch).filter(f => f.status === 'living');
      if (members.some(f => stageOf(f) !== 'adult')) continue;
      for (const sex of ['F', 'M'] as const) members.filter(f => f.sex === sex).sort((a, b) => promise(b) - promise(a)).slice(0, keeper.keep).forEach(f => keepers.add(f.id));
      processed.add(clutch.id);
    }
  }

  function sellAndRehome() {
    const waiting = new Set(world.clutches.filter(c => c.firstFishId && !processed.has(c.id)).flatMap(c => clutchMembers(world, c).map(f => f.id)));
    const candidates = living().filter(f => !keepers.has(f.id) && !isEgg(f.life) && !courtingClutchOf(world, f.id) && !waiting.has(f.id) && stageOf(f) === 'adult');
    for (const fish of candidates) if (!sellableSince.has(fish.id)) sellableSince.set(fish.id, day);
    const demand = { ...world.market.demand }, chosen: string[] = [];
    const ranked = candidates.map(fish => ({ fish, amount: offersFor(world, fish, cache)[0]?.amount ?? 0 })).sort((a, b) => b.amount - a.amount);
    for (const { fish } of ranked) {
      const offer = offersFor(world, fish, cache, demand)[0];
      if (!offer || offer.amount < keeper.minOffer || (keeper.collectorsOnly && offer.buyer === 'petShop')) continue;
      chosen.push(fish.id); demand[offer.buyer] -= 1;
    }
    if (chosen.length) {
      const plan = planSales(world, chosen, cache);
      if (tryRun({ type: 'sell-batch', fishIds: chosen, priceModel: 1 })) {
        for (const sale of plan.sales) incomeByBuyer[sale.offer.buyer] += sale.offer.amount;
        flows.sales += plan.total; dayIncome += plan.total; sold += chosen.length; milestones.firstSale ??= day;
      }
    }
    const waited = candidates.filter(f => !chosen.includes(f.id) && day - sellableSince.get(f.id)! >= keeper.rehomeAfter).map(f => f.id);
    if (waited.length && tryRun({ type: 'rehome-batch', fishIds: waited })) rehomed += waited.length;
  }

  function shop() {
    if (bought >= keeper.shopBuys) return;
    const wanted = [...world.shop.listings].filter(listing => listing.category !== 'founder' && spare(listing.price)).sort((a, b) => a.price - b.price);
    const counts = { F: 0, M: 0 };
    for (const fish of living()) if (keepers.has(fish.id) && !fish.parents) counts[fish.sex]++;
    const listing = wanted.find(entry => counts[entry.sex] <= counts[entry.sex === 'F' ? 'M' : 'F']) ?? wanted[0];
    const tankId = listing ? reliefDestination(world, 1) : null;
    if (listing && tankId && tryRun({ type: 'buy-listing', listingId: listing.id, tankId, timestamp: TIMESTAMP })) {
      flows.stock += listing.price; bought++; keepers.add(world.fish.at(-1)!.id);
    }
  }

  function care() {
    for (const tank of world.tanks) {
      const settings = careSettings(tank), strong = { filterTier: 2, aerationTier: 2 };
      if (settings.filterTier < strong.filterTier || settings.aerationTier < strong.aerationTier) {
        const cost = Math.max(0, FILTER_TIERS[strong.filterTier].price - FILTER_TIERS[settings.filterTier].price) + Math.max(0, AERATION_TIERS[strong.aerationTier].price - AERATION_TIERS[settings.aerationTier].price);
        if (spare(cost) && tryRun({ type: 'set-care', tankId: tank.id, ration: settings.ration, targetC: settings.targetC, ...strong })) flows.careEquipment += cost;
      }
      if (day % 5 === 0) {
        const before = world.credits;
        if (tryRun({ type: 'change-water', tankId: tank.id, percent: 25 })) flows.waterChanges += before - world.credits;
      }
    }
  }

  function decorate() {
    for (const tank of world.tanks.slice(0, 2)) {
      const current = decorationsOf(tank);
      if (current.length >= 6 || !spare(DECORATION_PRICE * (6 - current.length))) continue;
      const added = Array.from({ length: 6 - current.length }, (_, i) => ({ id: `DC-${100 + i}`, kind: 'cover' as const, x: 0.12 + 0.15 * i, y: 0.25, scale: 0.6, rotation: 0 }));
      if (tryRun({ type: 'place-decorations', tankId: tank.id, decorations: [...current, ...added] })) flows.decorations += DECORATION_PRICE * added.length;
    }
  }

  function rescue() {
    const missing = missingSexes(world);
    if (!missing.length || !reliefStatus(world).eligible) return;
    const tankId = reliefDestination(world, missing.length);
    if (tankId && tryRun({ type: 'claim-relief', tankId, timestamp: TIMESTAMP, genomeVersion: GENOME_VERSION })) world.fish.slice(-missing.length).forEach(f => keepers.add(f.id));
  }

  // Day 0: the keeper's opening moves.
  if (keeper.guide) {
    tryRun({ type: 'rename', fishId: 'FSH-000001', name: 'Ember' });
    tryRun({ type: 'feed', tankId: 'tank-1' });
  }
  if (keeper.spendDown) {
    for (let i = 0; i < 3; i++) if (tryRun({ type: 'purchase-tank' })) { flows.aquariums += TANK_PRICE; aquariums++; milestones.firstRoomBought ??= day; }
    tryRun({ type: 'rehome-batch', fishIds: living().filter(f => f.sex === 'M').map(f => f.id) });
  }

  for (day = 1; day <= PLAYTEST_DAYS; day++) {
    dayIncome = 0; daySpent = 0;
    rescue();
    if (keeper.premiumCare) care();
    if (keeper.decorate) decorate();
    shop();
    court();
    keepBest();
    sellAndRehome();
    if (keeper.expand === 'eager') buyRoom();
    const clutchStages = new Map(world.clutches.map(c => [c.id, c.stage]));
    world = advanceWorld(world, tick, tick + TICKS_PER_GAME_DAY);
    tick += TICKS_PER_GAME_DAY;
    for (const clutch of world.clutches) {
      if (clutch.stage === 'incubating' && clutchStages.get(clutch.id) === 'courting') milestones.firstEggs ??= day;
      if (clutch.stage === 'hatched' && clutchStages.get(clutch.id) === 'incubating') milestones.firstHatch ??= day;
    }
    if (ledgerBalance(world.ledger) !== world.credits) reconciled = false;
    const alive = living();
    peakLiving = Math.max(peakLiving, alive.length);
    if (missingSexes(world).length) missingSexDays++;
    if (world.credits < lowestCredits) { lowestCredits = world.credits; lowestDay = day; }
    if (paybackDay === null && flows.sales > 0 && flows.sales >= totalSinks(flows)) paybackDay = day;
    if (day % ROUTE_CHECK_EVERY === 0) {
      // The probe plays a copy; the keeper's own world is never changed by it.
      const route = routeToPairing(world, tick, ROUTE_CHECK_DAYS, TIMESTAMP);
      routeChecks.push({ day, days: route.days, claims: route.commands.filter(type => type === 'claim-relief').length, bought: route.commands.includes('buy-listing') });
    }
    days.push({ day, credits: world.credits, income: dayIncome, spent: daySpent, living: alive.length, places: places() });
  }

  let validSave = true;
  try { decodeSave(JSON.stringify(world)); } catch { validSave = false; }
  return {
    id: keeper.id, label: keeper.label, description: keeper.description,
    finalCredits: world.credits, net: world.credits - startCredits, lowestCredits, lowestDay, flows, incomeByBuyer,
    sold, rehomed, bred: world.fish.filter(f => f.parents).length, rescues: world.relief.claims, bought,
    aquariums, expansions, finalPlaces: places(), peakLiving, paybackDay, missingSexDays, milestones, routeChecks,
    reconciled, validSave, ledgerTotals: world.ledger.totals, commands, refused, days,
  };
}

export function paidEconomyPlaytest(ids?: readonly Keeper['id'][]): PaidEconomyReport {
  return { days: PLAYTEST_DAYS, keepers: KEEPERS.filter(keeper => !ids || ids.includes(keeper.id)).map(playKeeper) };
}

/** Prices the playtest used, for the report's notes. */
export const PAID_PRICES = { aquarium: TANK_PRICE, expansion: TANK_UPGRADE_PRICE, decoration: DECORATION_PRICE, listings: LISTING_PRICES } as const;
