import { courtingClutchOf, pairingBlockers, reservedPlaces } from './breeding';
import { GENOME_VERSION } from './catalog';
import { isEgg, lifeStage } from './development';
import { BUYERS, offersFor, saleTraits, type TraitCache } from './economy';
import { advanceWorld } from './habitat';
import type { BuyerId, Fish, World } from './types';
import { TICKS_PER_GAME_DAY } from './water';
import { applyCommand, createWorld, MAX_LIVING, MAX_RECORDS, MAX_TANKS, STOCK_PRICE, type Command } from './world';

/**
 * E-05 economy and capacity experiment (FS-501). Seeded strategies play the same starting world for EXPERIMENT_DAYS game
 * days through ordinary commands and the shared clock; tanks are free, as in the lab. The report shows what each
 * strategy earns, whether buying stock to resell can profit, and whether mass breeding is bounded by NPC demand.
 */
export const EXPERIMENT_DAYS = 60;
const TIMESTAMP = '2026-09-14T00:00:00.000Z';

type Policy = {
  id: 'observer' | 'resale' | 'selective' | 'collector' | 'maxOutput' | 'labFarm';
  label: string; description: string;
  breed: 'none' | 'normal' | 'lab';
  pairs: 'best' | 'all';
  clutchSize: 8 | 12 | 16 | 20 | 24;
  /** Offspring of each sex kept from every clutch as future parents. */
  keep: number;
  sellFrom: 'hatched' | 'adult';
  collectorsOnly: boolean;
  minOffer: number;
  /** Game days a sellable fish may wait for an acceptable offer before it is rehomed. */
  rehomeAfter: number;
  resale: boolean;
};

export const POLICIES: readonly Policy[] = [
  { id: 'observer', label: 'Observation-focused', description: 'Keeps the six founders; never buys, breeds or sells.', breed: 'none', pairs: 'best', clutchSize: 8, keep: 0, sellFrom: 'adult', collectorsOnly: false, minOffer: 1, rehomeAfter: 0, resale: false },
  { id: 'resale', label: 'Purchase and resale loop', description: 'Buys one unrelated stock fish a game day and sells it at once to the best offer.', breed: 'none', pairs: 'best', clutchSize: 8, keep: 0, sellFrom: 'adult', collectorsOnly: false, minOffer: 1, rehomeAfter: 0, resale: true },
  { id: 'selective', label: 'Selective breeder', description: 'Courts the longest-tailed ready pair, keeps two of each sex per clutch, sells adults for at least ◈ 30 and rehomes those that wait 12 game days.', breed: 'normal', pairs: 'best', clutchSize: 16, keep: 2, sellFrom: 'adult', collectorsOnly: false, minOffer: 30, rehomeAfter: 12, resale: false },
  { id: 'collector', label: 'Collector contracts', description: 'Breeds like the selective breeder but sells only to trait collectors for at least ◈ 60, rehoming those that wait 15 game days.', breed: 'normal', pairs: 'best', clutchSize: 16, keep: 2, sellFrom: 'adult', collectorsOnly: true, minOffer: 60, rehomeAfter: 15, resale: false },
  { id: 'maxOutput', label: 'Maximum-output breeder', description: 'Courts every ready founder pair with 24-egg clutches, sells every hatched fish any buyer takes and rehomes the rest after 3 game days.', breed: 'normal', pairs: 'all', clutchSize: 24, keep: 0, sellFrom: 'hatched', collectorsOnly: false, minOffer: 1, rehomeAfter: 3, resale: false },
  { id: 'labFarm', label: 'Instant lab-cross farmer', description: 'Uses the research shortcut every game day for 20 eggs, sells every hatched fish any buyer takes and rehomes the rest after 3 game days.', breed: 'lab', pairs: 'all', clutchSize: 20, keep: 0, sellFrom: 'hatched', collectorsOnly: false, minOffer: 1, rehomeAfter: 3, resale: false },
];

export type StrategyDay = { day: number; credits: number; income: number; living: number; sold: number; rehomed: number };
export type StrategyResult = {
  id: Policy['id']; label: string; description: string;
  finalCredits: number; net: number; income: number; spent: number;
  sold: number; rehomed: number; bred: number; peakLiving: number; finalLiving: number;
  averagePrice: number; bestDayIncome: number; incomeByBuyer: Record<BuyerId, number>;
  /** Resale loop only: stock price minus what each bought fish sold for. */
  resaleLosses: number[];
  /** Game days that ended below the stock price with no living fish any buyer would take. */
  strandedDays: number;
  days: StrategyDay[];
};
export type EconomyReport = { days: number; strategies: StrategyResult[] };

type Sale = { buyer: BuyerId; amount: number };

function runStrategy(policy: Policy): StrategyResult {
  let world: World = createWorld(TIMESTAMP), tick = 0;
  const startCredits = world.credits, cache: TraitCache = new Map();
  const keepers = new Set(world.fish.map(f => f.id)), processed = new Set<string>(), sellableSince = new Map<string, number>();
  const incomeByBuyer = Object.fromEntries(BUYERS.map(buyer => [buyer.id, 0])) as Record<BuyerId, number>;
  const days: StrategyDay[] = [], resaleLosses: number[] = [];
  let sold = 0, rehomed = 0, income = 0, spent = 0, peakLiving = 0, strandedDays = 0, bestDayIncome = 0, dayIncome = 0;

  const tryRun = (command: Command) => { try { world = applyCommand(world, command); return true; } catch { return false; } };
  const book = (sales: Sale[]) => {
    for (const sale of sales) { incomeByBuyer[sale.buyer] += sale.amount; income += sale.amount; dayIncome += sale.amount; }
    sold += sales.length;
  };
  const living = () => world.fish.filter(f => f.status === 'living');
  const stageOf = (fish: Fish) => lifeStage(fish.life, saleTraits(fish, cache));
  const tail = (fish: Fish) => saleTraits(fish, cache).tail;
  const ready = (fish: Fish) => fish.status === 'living' && keepers.has(fish.id) && stageOf(fish) === 'adult' && fish.life.condition >= 0.7
    && fish.breeding.cooldownDays === 0 && !courtingClutchOf(world, fish.id);
  const free = (tankId: string) => {
    const tank = world.tanks.find(t => t.id === tankId)!;
    return tank.capacity - world.fish.filter(f => f.status === 'living' && f.tankId === tankId).length - reservedPlaces(world, tankId);
  };
  const tankWith = (places: number, nursery: boolean) => {
    const open = world.tanks.find(t => free(t.id) >= places && !(nursery && world.clutches.some(c => c.stage === 'courting' && c.nurseryId === t.id)));
    if (open) return open.id;
    return world.tanks.length < MAX_TANKS && tryRun({ type: 'add-tank' }) ? world.tanks[world.tanks.length - 1].id : null;
  };

  function court(mother: Fish, father: Fish): boolean {
    if (father.tankId !== mother.tankId && !tryRun({ type: 'move', fishId: father.id, tankId: mother.tankId })) return false;
    const nurseryId = tankWith(policy.clutchSize, true);
    if (!nurseryId || pairingBlockers(world, { motherId: mother.id, fatherId: father.id, nurseryId, size: policy.clutchSize }, { maxLiving: MAX_LIVING, maxRecords: MAX_RECORDS }).length) return false;
    return tryRun({ type: 'pair', motherId: mother.id, fatherId: father.id, nurseryId, size: policy.clutchSize, timestamp: TIMESTAMP, genomeVersion: GENOME_VERSION });
  }

  function breed(day: number) {
    if (policy.breed === 'lab') {
      const [motherId, fatherId] = [['FSH-000001', 'FSH-000002'], ['FSH-000003', 'FSH-000004'], ['FSH-000005', 'FSH-000006']][day % 3];
      const tankId = tankWith(20, false);
      if (tankId) tryRun({ type: 'breed', motherId, fatherId, tankId, timestamp: TIMESTAMP, genomeVersion: GENOME_VERSION });
      return;
    }
    const byTail = (sex: Fish['sex']) => living().filter(f => f.sex === sex && ready(f)).sort((a, b) => tail(b) - tail(a));
    if (policy.pairs === 'best') {
      if (world.clutches.some(c => c.stage === 'courting')) return;
      const [mother] = byTail('F'), [father] = byTail('M');
      if (mother && father) court(mother, father);
      return;
    }
    const fathers = byTail('M');
    for (const mother of byTail('F')) {
      const father = fathers.shift();
      if (!father) break;
      if (!court(mother, father)) fathers.unshift(father);
    }
  }

  /** Once every fish of a hatched clutch is adult, the best-tailed of each sex join the breeders. */
  function keepBest() {
    if (!policy.keep) return;
    for (const clutch of world.clutches) {
      if (processed.has(clutch.id) || clutch.stage !== 'hatched' || !clutch.firstFishId) continue;
      const first = Number(clutch.firstFishId.slice(4));
      const members = world.fish.filter(f => { const n = Number(f.id.slice(4)); return n >= first && n < first + clutch.size && f.status === 'living'; });
      if (members.some(f => stageOf(f) !== 'adult')) continue;
      for (const sex of ['F', 'M'] as const) members.filter(f => f.sex === sex).sort((a, b) => tail(b) - tail(a)).slice(0, policy.keep).forEach(f => keepers.add(f.id));
      processed.add(clutch.id);
    }
  }

  function sellAndRehome(day: number) {
    const unprocessed = world.clutches.filter(c => c.firstFishId && !processed.has(c.id)).map(c => [Number(c.firstFishId!.slice(4)), c.size] as const);
    const awaitingSelection = (fish: Fish) => policy.keep > 0 && unprocessed.some(([first, size]) => { const n = Number(fish.id.slice(4)); return n >= first && n < first + size; });
    const candidates = living().filter(f => !keepers.has(f.id) && !isEgg(f.life) && !courtingClutchOf(world, f.id) && !awaitingSelection(f)
      && (policy.sellFrom === 'hatched' || stageOf(f) === 'adult'));
    for (const fish of candidates) if (!sellableSince.has(fish.id)) sellableSince.set(fish.id, day);
    // Highest offers go first. Re-offering under the demand left by earlier picks gives exactly what the batch pays.
    const demand = { ...world.market.demand }, chosen: string[] = [], sales: Sale[] = [];
    const ranked = candidates.map(fish => ({ fish, amount: offersFor(world, fish, cache)[0]?.amount ?? 0 })).sort((a, b) => b.amount - a.amount);
    for (const { fish } of ranked) {
      const offer = offersFor(world, fish, cache, demand)[0];
      if (!offer || offer.amount < policy.minOffer || (policy.collectorsOnly && offer.buyer === 'petShop')) continue;
      chosen.push(fish.id); sales.push({ buyer: offer.buyer, amount: offer.amount }); demand[offer.buyer] -= 1;
    }
    if (chosen.length && tryRun({ type: 'sell-batch', fishIds: chosen, priceModel: 1 })) book(sales);
    const waited = candidates.filter(f => !chosen.includes(f.id) && day - sellableSince.get(f.id)! >= policy.rehomeAfter);
    if (waited.length && tryRun({ type: 'rehome-batch', fishIds: waited.map(f => f.id) })) rehomed += waited.length;
  }

  for (let day = 1; day <= EXPERIMENT_DAYS; day++) {
    dayIncome = 0;
    if (policy.resale && world.credits >= STOCK_PRICE && tryRun({ type: 'buy', tankId: 'tank-1', timestamp: TIMESTAMP, genomeVersion: GENOME_VERSION })) {
      spent += STOCK_PRICE;
      const stock = world.fish[world.fish.length - 1], offer = offersFor(world, stock, cache)[0];
      if (offer && tryRun({ type: 'sell', fishId: stock.id, priceModel: 1 })) { book([{ buyer: offer.buyer, amount: offer.amount }]); resaleLosses.push(STOCK_PRICE - offer.amount); }
      else if (tryRun({ type: 'rehome-batch', fishIds: [stock.id] })) rehomed++;
    }
    if (policy.breed !== 'none') { breed(day); keepBest(); sellAndRehome(day); }
    world = advanceWorld(world, tick, tick + TICKS_PER_GAME_DAY);
    tick += TICKS_PER_GAME_DAY;
    const alive = living();
    peakLiving = Math.max(peakLiving, alive.length);
    bestDayIncome = Math.max(bestDayIncome, dayIncome);
    if (world.credits < STOCK_PRICE && !alive.some(f => offersFor(world, f, cache).length)) strandedDays++;
    days.push({ day, credits: world.credits, income: dayIncome, living: alive.length, sold, rehomed });
  }
  return {
    id: policy.id, label: policy.label, description: policy.description, finalCredits: world.credits, net: world.credits - startCredits, income, spent,
    sold, rehomed, bred: world.fish.filter(f => f.parents).length, peakLiving, finalLiving: living().length,
    averagePrice: sold ? Math.round(income / sold) : 0, bestDayIncome, incomeByBuyer, resaleLosses, strandedDays, days,
  };
}

export function economyExperiment(): EconomyReport {
  return { days: EXPERIMENT_DAYS, strategies: POLICIES.map(runStrategy) };
}
