import { describeAppearance } from './appearance';
import { GOAL_BY_KEY } from './breedingGoals';
import { isEgg, lifeStage, type LifeStage } from './development';
import { express, metabolicPotential } from './genetics';
import { clamp } from './random';
import type { BuyerId, Fish, Ledger, LedgerReason, MarketState, World } from './types';

/**
 * Economy model v1 (FS-501). Five NPC buyers each take a bounded number of fish, which recovers at game-day boundaries,
 * and pay within a budget. An offer explains itself: a base price, the buyer's interest in the fish's traits, a capped
 * bonus for fish bred in this aquarium, then stage, condition and demand adjustments. Founders and bought stock never
 * resell above FOUNDER_RESALE_CAP, below the stock price. Every credit change goes to a bounded ledger whose totals
 * reconcile with the balance, and rehoming is economy-neutral. Values are game rules, not real market data.
 */
export const ECONOMY_MODEL = 1;
/** Sale commands carry this. Journal entries without it replay with the lab quote they were recorded under. */
export const PRICE_MODEL = 1;
export const LEDGER_LIMIT = 100;
/** Founders and bought stock never resell for more than this, which stays below the 250-credit stock price. */
export const FOUNDER_RESALE_CAP = 150;
/** Below this condition an offer shrinks in proportion. */
export const HEALTHY_CONDITION = 0.7;
export const BREEDER_BONUS = { perGeneration: 6, max: 30 } as const;
export const STAGE_FACTOR: Record<LifeStage, number> = { egg: 0, fry: 0.25, juvenile: 0.6, adult: 1, elderly: 0.8 };
export const LEDGER_REASONS = ['sale', 'stock', 'equipment', 'waterChange', 'rehome'] as const satisfies readonly LedgerReason[];
export const LEDGER_LABELS: Record<LedgerReason, string> = { sale: 'Sales', stock: 'Unrelated stock', equipment: 'Equipment', waterChange: 'Water changes', rehome: 'Rehoming' };

/** Traits buyers read. They depend only on the genome, so a cache keyed by fish ID stays valid. */
export type SaleTraits = { tail: number; adultLengthCm: number; longevityYears: number; metabolism: number; rarity: 0 | 1 | 2 | 3 };
export type TraitCache = Map<string, SaleTraits>;

export type Buyer = {
  id: BuyerId; name: string; wants: string;
  /** Fish taken before the buyer is satisfied, and how much of that demand returns each game day. */
  capacity: number; recovery: number;
  /** Base price, credits per unit of interest, and the most paid for one fish. */
  base: number; weight: number; budget: number;
  takesFry: boolean;
  /** Interest from 0 to 1, or null when this buyer does not want the fish. */
  interest: (traits: SaleTraits) => number | null;
};

export const BUYERS: readonly Buyer[] = [
  { id: 'petShop', name: 'Corner pet shop', wants: 'any healthy hatched fish', capacity: 10, recovery: 5, base: 14, weight: 0, budget: 20, takesFry: true, interest: () => 0 },
  { id: 'longFin', name: 'Long-fin collector', wants: 'tail length of 55% or more', capacity: 3, recovery: 1, base: 35, weight: 180, budget: 240, takesFry: false,
    interest: t => t.tail >= 0.55 ? clamp((t.tail - 0.55) / 0.45) : null },
  { id: 'pondKeeper', name: 'Pond keeper', wants: 'adults of 60 cm or more that are easy to feed', capacity: 4, recovery: 1, base: 30, weight: 120, budget: 170, takesFry: false,
    interest: t => t.adultLengthCm >= 60 ? clamp(0.7 * (t.adultLengthCm - 60) / 38 + 0.3 * (1.6 - t.metabolism)) : null },
  { id: 'miniature', name: 'Miniature keeper', wants: 'adults of 40 cm or less', capacity: 3, recovery: 1, base: 35, weight: 150, budget: 200, takesFry: false,
    interest: t => t.adultLengthCm <= 40 ? clamp((40 - t.adultLengthCm) / 18) : null },
  { id: 'colorCollector', name: 'Color collector', wants: 'an uncommon, rare or very rare color or pattern', capacity: 2, recovery: 0.5, base: 40, weight: 200, budget: 260, takesFry: false,
    interest: t => t.rarity ? t.rarity / 3 : null },
];
export const BUYER_BY_ID = Object.fromEntries(BUYERS.map(buyer => [buyer.id, buyer])) as Record<BuyerId, Buyer>;
/** The most credits buyers can pay in one game day once their starting demand is used: recovery × budget, summed. */
export const DAILY_DEMAND_CEILING = BUYERS.reduce((sum, buyer) => sum + buyer.recovery * buyer.budget, 0);

const RARITY_RANK = { uncommon: 1, rare: 2, 'very rare': 3 } as const;
const STAGE_TEXT: Record<LifeStage, string> = { egg: 'Egg', fry: 'Fry', juvenile: 'Juvenile', adult: 'Adult', elderly: 'Elderly' };
const percent = (value: number) => `${Math.round(value * 100)}%`;

export function saleTraits(fish: Fish, cache?: TraitCache): SaleTraits {
  const cached = cache?.get(fish.id);
  if (cached) return cached;
  const potential = metabolicPotential(fish.genome);
  const rarity = describeAppearance(fish.genome).reduce<0 | 1 | 2 | 3>((best, row) => row.rarity ? Math.max(best, RARITY_RANK[row.rarity]) as 0 | 1 | 2 | 3 : best, 0);
  const traits: SaleTraits = { tail: GOAL_BY_KEY.get('tail')!.value(express(fish.genome)), adultLengthCm: potential.adultLengthCm, longevityYears: potential.longevityYears, metabolism: potential.metabolism, rarity };
  cache?.set(fish.id, traits);
  return traits;
}

export type OfferTerm = { label: string; amount: number };
/** `amount` is the sum of `terms`. */
export type Offer = { buyer: BuyerId; buyerName: string; amount: number; terms: OfferTerm[] };

function offerFrom(buyer: Buyer, fish: Fish, stage: LifeStage, traits: SaleTraits, demand: number): Offer | null {
  if (stage === 'egg' || (stage === 'fry' && !buyer.takesFry) || demand < 1) return null;
  const interest = buyer.interest(traits);
  if (interest === null) return null;
  // Each step rounds the running price and records the change, so the terms always add up to the offer.
  const terms: OfferTerm[] = [{ label: 'Base price', amount: buyer.base }];
  let value = buyer.base, shown = buyer.base;
  const step = (label: string, next: number) => {
    const rounded = Math.round(next);
    if (rounded !== shown) terms.push({ label, amount: rounded - shown });
    value = next; shown = rounded;
  };
  if (buyer.weight) step(`Trait interest ${percent(interest)}`, value + buyer.weight * interest);
  if (buyer.weight && fish.parents) step(`Bred here, generation ${fish.generation}`, value + Math.min(BREEDER_BONUS.max, BREEDER_BONUS.perGeneration * fish.generation));
  step(`${STAGE_TEXT[stage]}, ${percent(STAGE_FACTOR[stage])} of the adult price`, value * STAGE_FACTOR[stage]);
  step(`Condition ${percent(fish.life.condition)}`, value * Math.min(1, fish.life.condition / HEALTHY_CONDITION));
  step(`Wants ${Math.floor(demand)} more of ${buyer.capacity}`, value * (0.5 + 0.5 * demand / buyer.capacity));
  const cap = fish.parents ? buyer.budget : Math.min(buyer.budget, FOUNDER_RESALE_CAP);
  step(fish.parents ? `Budget limit ◈ ${cap}` : `Founder resale limit ◈ ${cap}`, Math.min(cap, value));
  step('Minimum offer', Math.max(1, value));
  return { buyer: buyer.id, buyerName: buyer.name, amount: shown, terms };
}

/** Every buyer's offer for a living, hatched fish, best first; ties keep catalog order. */
export function offersFor(world: Pick<World, 'market'>, fish: Fish, cache?: TraitCache, demand: Record<BuyerId, number> = world.market.demand): Offer[] {
  if (fish.status !== 'living' || isEgg(fish.life)) return [];
  const traits = saleTraits(fish, cache), stage = lifeStage(fish.life, traits);
  return BUYERS.flatMap(buyer => { const offer = offerFrom(buyer, fish, stage, traits, demand[buyer.id]); return offer ? [offer] : []; })
    .sort((a, b) => b.amount - a.amount);
}

export const bestOffer = (world: Pick<World, 'market'>, fish: Fish, cache?: TraitCache): Offer | null => offersFor(world, fish, cache)[0] ?? null;

export type SalePlan = { sales: { fishId: string; offer: Offer }[]; unsold: string[]; total: number; demand: Record<BuyerId, number> };

/** Sells in the given order: each fish goes to its best offer, which uses up that buyer's demand for the fish after it. */
export function planSales(world: Pick<World, 'market' | 'fish'>, fishIds: readonly string[], cache?: TraitCache): SalePlan {
  const demand = { ...world.market.demand }, byId = new Map(world.fish.map(member => [member.id, member]));
  const sales: SalePlan['sales'] = [], unsold: string[] = [];
  let total = 0;
  for (const id of fishIds) {
    const fish = byId.get(id), offer = fish ? offersFor(world, fish, cache, demand)[0] : undefined;
    if (!offer) { unsold.push(id); continue; }
    sales.push({ fishId: id, offer });
    demand[offer.buyer] -= 1;
    total += offer.amount;
  }
  return { sales, unsold, total, demand };
}

/**
 * FS-505: the batch the interface reviews. Each step sells the fish with the highest offer under the demand left, so
 * valuable fish are not priced after cheaper sales have used up their buyer. Offers only fall as demand is used, so a
 * stale queue entry is an upper bound and is re-priced before it is chosen. Realized prices never rise along the plan,
 * ties keep the given order, and sending the planned order to `sell-batch` pays exactly this plan.
 */
export function planBestSales(world: Pick<World, 'market' | 'fish'>, fishIds: readonly string[], cache?: TraitCache): SalePlan {
  type Entry = { id: string; index: number; fish: Fish | undefined; amount: number };
  const byId = new Map(world.fish.map(member => [member.id, member])), demand = { ...world.market.demand };
  const before = (a: Entry, b: Entry) => b.amount - a.amount || a.index - b.index;
  const queue: Entry[] = fishIds.map((id, index) => {
    const fish = byId.get(id);
    return { id, index, fish, amount: fish ? offersFor(world, fish, cache, demand)[0]?.amount ?? 0 : 0 };
  }).sort(before);
  const sales: SalePlan['sales'] = [], unsold: Entry[] = [];
  let total = 0;
  while (queue.length) {
    const head = queue.shift()!, offer = head.fish ? offersFor(world, head.fish, cache, demand)[0] : undefined;
    if (!offer) { unsold.push(head); continue; }
    if (offer.amount < head.amount) {
      head.amount = offer.amount;
      let at = queue.findIndex(entry => before(head, entry) < 0);
      if (at < 0) at = queue.length;
      queue.splice(at, 0, head);
      continue;
    }
    sales.push({ fishId: head.id, offer });
    demand[offer.buyer] -= 1;
    total += offer.amount;
  }
  return { sales, unsold: unsold.sort((a, b) => a.index - b.index).map(entry => entry.id), total, demand };
}

export function saleDetail(plan: SalePlan): string {
  const counts = new Map<string, number>();
  for (const sale of plan.sales) counts.set(sale.offer.buyerName, (counts.get(sale.offer.buyerName) ?? 0) + 1);
  return [...counts].map(([name, count]) => `${name} ×${count}`).join(', ').slice(0, 120);
}

export const defaultMarket = (): MarketState => ({ model: 1, demand: Object.fromEntries(BUYERS.map(buyer => [buyer.id, buyer.capacity])) as Record<BuyerId, number> });

/** One game-day boundary: each buyer wants a little more, up to its capacity. */
export function recoverDemand(world: World): World {
  const { demand } = world.market;
  if (BUYERS.every(buyer => demand[buyer.id] >= buyer.capacity)) return world;
  return { ...world, market: { ...world.market, demand: Object.fromEntries(BUYERS.map(buyer => [buyer.id, Math.min(buyer.capacity, demand[buyer.id] + buyer.recovery)])) as Record<BuyerId, number> } };
}

export const openingLedger = (credits: number): Ledger => ({ model: 1, opening: credits, next: 1, totals: { sale: 0, stock: 0, equipment: 0, waterChange: 0, rehome: 0 }, entries: [] });

export function recordEntry(ledger: Ledger, reason: LedgerReason, amount: number, fish: number, detail: string): Ledger {
  return {
    ...ledger, next: ledger.next + 1, totals: { ...ledger.totals, [reason]: ledger.totals[reason] + amount },
    entries: [...ledger.entries, { seq: ledger.next, reason, amount, fish, detail: detail.slice(0, 120) }].slice(-LEDGER_LIMIT),
  };
}

export const ledgerBalance = (ledger: Ledger) => LEDGER_REASONS.reduce((sum, reason) => sum + ledger.totals[reason], ledger.opening);
