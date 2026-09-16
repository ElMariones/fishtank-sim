import { describe, expect, it } from 'vitest';
import { adultLife } from '../src/core/development';
import {
  BUYERS, DAILY_DEMAND_CEILING, FOUNDER_RESALE_CAP, LEDGER_LIMIT, ledgerBalance, offersFor, planBestSales, planSales, type TraitCache,
} from '../src/core/economy';
import { economyExperiment, EXPERIMENT_DAYS } from '../src/core/economyExperiment';
import { founderGenome, metabolicPotential } from '../src/core/genetics';
import { advanceWorld } from '../src/core/habitat';
import { random } from '../src/core/random';
import { advanceRuntime, commandEnvelope, createRuntime, decodeRuntime, executeCommand } from '../src/core/runtime';
import { decodeSave } from '../src/core/save';
import type { Fish, Genome, World } from '../src/core/types';
import { TICKS_PER_GAME_DAY } from '../src/core/water';
import { applyCommand, createWorld, quote, STOCK_PRICE, type Command } from '../src/core/world';

const NOW = '2026-09-14T12:00:00.000Z';
const DAY = TICKS_PER_GAME_DAY;
const base = createWorld(NOW);
const fishId = (n: number) => `FSH-${String(n).padStart(6, '0')}`;
const uniform = (allele: number): Genome => ({ version: 2, maternal: Array(60).fill(allele), paternal: Array(60).fill(allele) });
/** An adult founder-stock fish with the given genome in Breeding Studio. */
const adult = (n: number, genome: Genome): Fish => ({ ...base.fish[0], id: fishId(n), name: `Fish ${n}`, sex: n % 2 ? 'M' : 'F', genome, tankId: 'tank-2', life: adultLife(genome) });
const withFish = (fish: Fish[]): World => ({ ...base, nextId: Math.max(...fish.map(f => Number(f.id.slice(4)))) + 1, fish: [...base.fish, ...fish] });
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
/** A current save written as world v5: no demand, ledger or shop, and the older version number. */
function asV5(world: World) {
  const { market, ledger, shop, ...rest } = world;
  void market; void ledger; void shop;
  return { ...rest, version: 5 };
}

describe('FS-501 offers and demand', () => {
  it('builds every offer from explained terms and keeps founder resale below the stock price', () => {
    const cache: TraitCache = new Map(), seen = new Set<string>();
    const founders = Array.from({ length: 600 }, (_, i) => adult(7 + i, founderGenome(70_000 + i, 2)));
    let best: { fish: Fish; amount: number; buyer: string } | null = null;
    for (const fish of [...founders, adult(700, uniform(0)), adult(701, uniform(5))]) {
      for (const offer of offersFor(base, fish, cache)) {
        expect(sum(offer.terms.map(term => term.amount))).toBe(offer.amount);
        expect(offer.amount).toBeGreaterThanOrEqual(1);
        expect(offer.amount).toBeLessThanOrEqual(FOUNDER_RESALE_CAP);
        seen.add(offer.buyer);
        if (!best || offer.amount > best.amount) best = { fish, amount: offer.amount, buyer: offer.buyer };
      }
    }
    expect(FOUNDER_RESALE_CAP).toBeLessThan(STOCK_PRICE);
    expect([...seen].sort()).toEqual(BUYERS.map(buyer => buyer.id).sort());

    // The same genome bred here earns the capped breeder bonus and is no longer held to the founder limit.
    const top = best!, bred = { ...top.fish, id: fishId(900), parents: [fishId(1), fishId(2)] as [string, string], generation: 5 };
    const bredOffer = offersFor(base, bred)[0];
    expect(bredOffer.amount).toBeGreaterThan(top.amount);
    expect(bredOffer.terms.some(term => term.label === 'Bred here, generation 5')).toBe(true);
    expect(bredOffer.amount).toBeLessThanOrEqual(BUYERS.find(buyer => buyer.id === bredOffer.buyer)!.budget);

    const potential = metabolicPotential(top.fish.genome), life = top.fish.life;
    expect(offersFor(base, { ...top.fish, life: { ...life, lengthCm: 0, ageDays: 0 } })).toEqual([]);
    expect(offersFor(base, { ...top.fish, life: { ...life, lengthCm: potential.adultLengthCm * 0.05 } }).map(offer => offer.buyer)).toEqual(['petShop']);
    const juvenile = offersFor(base, { ...top.fish, life: { ...life, lengthCm: potential.adultLengthCm * 0.4 } })[0];
    expect(juvenile.terms.some(term => term.label.startsWith('Juvenile'))).toBe(true);
    expect(juvenile.amount).toBeLessThan(top.amount);
    const weak = offersFor(base, { ...top.fish, life: { ...life, condition: 0.35 } })[0];
    expect(weak.terms.find(term => term.label.startsWith('Condition'))!.amount).toBeLessThan(0);
  });

  it('uses up demand in sale order, pays exactly the planned batch and recovers demand each game day', () => {
    // Genome v1 fish show no rare colors; keep those neither long-tailed nor unusually sized, which only the pet shop buys.
    const plain: Fish[] = [];
    for (let seed = 0; plain.length < 12; seed++) {
      const fish = adult(7 + plain.length, founderGenome(90_000 + seed, 1));
      if (offersFor(base, fish).map(offer => offer.buyer).join() === 'petShop') plain.push(fish);
    }
    const world = withFish(plain), ids = plain.map(f => f.id), plan = planSales(world, ids);
    expect(plan.sales.map(sale => sale.offer.buyer)).toEqual(Array(10).fill('petShop'));
    expect(plan.unsold).toEqual(ids.slice(10));
    const amounts = plan.sales.map(sale => sale.offer.amount);
    amounts.slice(1).forEach((amount, i) => expect(amount).toBeLessThanOrEqual(amounts[i]));
    expect(amounts[0]).toBeGreaterThan(amounts[9]);

    const before = JSON.stringify(world);
    expect(() => applyCommand(world, { type: 'sell-batch', fishIds: ids, priceModel: 1 })).toThrow('No NPC buyer wants');
    expect(JSON.stringify(world)).toBe(before);
    const soldTen = applyCommand(world, { type: 'sell-batch', fishIds: ids.slice(0, 10), priceModel: 1 });
    expect([soldTen.credits - world.credits, soldTen.market.demand.petShop]).toEqual([plan.total, 0]);
    let oneByOne = world;
    for (const id of ids.slice(0, 10)) oneByOne = applyCommand(oneByOne, { type: 'sell', fishId: id, priceModel: 1 });
    expect([oneByOne.credits, oneByOne.market]).toEqual([soldTen.credits, soldTen.market]);
    expect(() => applyCommand(soldTen, { type: 'sell', fishId: ids[10], priceModel: 1 })).toThrow('No NPC buyer wants');

    expect(advanceWorld(soldTen, 0, DAY).market.demand.petShop).toBe(5);
    expect(planSales(advanceWorld(soldTen, 0, DAY), ids.slice(10)).unsold).toEqual([]);
    let stepped = soldTen;
    for (let day = 0; day < 3; day++) stepped = advanceWorld(stepped, day * DAY, (day + 1) * DAY);
    expect(stepped.market).toEqual(advanceWorld(soldTen, 0, 3 * DAY).market);
    expect(stepped.market.demand.petShop).toBe(10);

    let runtime = createRuntime(world, 'fs501-demand');
    runtime = executeCommand(runtime, commandEnvelope(runtime, { type: 'sell-batch', fishIds: ids.slice(0, 4), priceModel: 1 }));
    runtime = advanceRuntime(runtime, runtime.tick + 2 * DAY);
    runtime = executeCommand(runtime, commandEnvelope(runtime, { type: 'sell', fishId: ids[5], priceModel: 1 }));
    expect(decodeRuntime(JSON.stringify(runtime)).world).toEqual(runtime.world);
  });
});

describe('FS-501 ledger and rehoming', () => {
  it('writes every credit change to a bounded ledger that reconciles with the balance', () => {
    const rng = random(501);
    const pick = <T>(items: readonly T[]): T | undefined => items[Math.floor(rng() * items.length)];
    let world = createWorld(NOW), tick = 0;
    for (let step = 0; step < 900; step++) {
      // Founders stay as breeding stock so the walk keeps producing fish to sell; offspring are sold and rehomed.
      const alive = world.fish.filter(f => f.status === 'living'), hatched = alive.filter(f => f.life.lengthCm > 0 && f.parents), tank = pick(world.tanks)!.id, roll = rng();
      const some = (count: number) => [...new Set(Array.from({ length: count }, () => pick(hatched)?.id ?? ''))];
      let command: Command | null = null;
      if (roll < 0.1) command = alive.length > 60 ? { type: 'change-water', tankId: tank, percent: 10 } : { type: 'breed', motherId: pick(alive.filter(f => f.sex === 'F'))?.id ?? '', fatherId: pick(alive.filter(f => f.sex === 'M'))?.id ?? '', tankId: tank, timestamp: NOW, genomeVersion: 2 };
      else if (roll < 0.22) command = { type: 'sell', fishId: pick(hatched)?.id ?? '', priceModel: 1 };
      else if (roll < 0.3) command = { type: 'sell-batch', fishIds: some(1 + Math.floor(rng() * 4)), priceModel: 1 };
      else if (roll < 0.35) command = { type: 'sell', fishId: pick(hatched)?.id ?? '' };
      else if (roll < 0.47) command = world.credits >= 800 ? { type: 'buy', tankId: tank, timestamp: NOW, genomeVersion: 2 } : { type: 'change-water', tankId: tank, percent: 10 };
      else if (roll < 0.57) command = { type: 'set-care', tankId: tank, ration: 'measured', filterTier: Math.floor(rng() * 4), aerationTier: Math.floor(rng() * 4), targetC: 22 };
      else if (roll < 0.7) command = { type: 'change-water', tankId: tank, percent: pick([10, 25, 50] as const)! };
      else if (roll < 0.76) command = { type: 'rehome-batch', fishIds: some(1 + Math.floor(rng() * 3)) };
      else if (roll < 0.79) command = { type: 'add-tank' };
      if (command) { try { world = applyCommand(world, command); } catch { continue; } }
      else { world = advanceWorld(world, tick, tick + DAY); tick += DAY; }
      expect(ledgerBalance(world.ledger)).toBe(world.credits);
      expect(world.ledger.entries.length).toBeLessThanOrEqual(LEDGER_LIMIT);
      if (step % 300 === 0) expect(() => decodeSave(JSON.stringify(world))).not.toThrow();
    }
    const { ledger } = world;
    expect(ledger.next - 1).toBeGreaterThan(LEDGER_LIMIT);
    expect(ledger.entries).toHaveLength(LEDGER_LIMIT);
    ledger.entries.slice(1).forEach((entry, i) => expect(entry.seq).toBeGreaterThan(ledger.entries[i].seq));
    expect([ledger.totals.sale > 0, ledger.totals.stock < 0, ledger.totals.equipment < 0, ledger.totals.waterChange < 0, ledger.totals.rehome]).toEqual([true, true, true, true, 0]);
    expect(decodeSave(JSON.stringify(world))).toEqual(decodeSave(JSON.stringify(decodeSave(JSON.stringify(world)))));

    const raw = JSON.parse(JSON.stringify(world));
    expect(() => decodeSave(JSON.stringify({ ...raw, credits: raw.credits + 1 }))).toThrow('Credits do not agree with the ledger');
    expect(() => decodeSave(JSON.stringify({ ...raw, market: { ...raw.market, demand: { ...raw.market.demand, petShop: 11 } } }))).toThrow();
    const swapped = structuredClone(raw);
    [swapped.ledger.entries[0], swapped.ledger.entries[1]] = [swapped.ledger.entries[1], swapped.ledger.entries[0]];
    expect(() => decodeSave(JSON.stringify(swapped))).toThrow('out of order');
  });

  it('rehomes fish without credits while keeping their records', () => {
    const cross: Command = { type: 'breed', motherId: fishId(1), fatherId: fishId(2), tankId: 'tank-2', timestamp: NOW, genomeVersion: 2 };
    const hatched = advanceWorld(applyCommand(createWorld(NOW), cross), 0, 4 * DAY), ids = [fishId(7), fishId(8), fishId(9)];
    const rehomed = applyCommand(hatched, { type: 'rehome-batch', fishIds: ids });
    expect(rehomed.fish.filter(f => ids.includes(f.id)).map(f => f.status)).toEqual(['rehomed', 'rehomed', 'rehomed']);
    expect(rehomed.credits).toBe(hatched.credits);
    expect(rehomed.ledger.entries.at(-1)).toMatchObject({ reason: 'rehome', amount: 0, fish: 3 });
    expect(rehomed.fish.find(f => f.id === fishId(7))!.parents).toEqual([fishId(1), fishId(2)]);
    expect(decodeSave(JSON.stringify(rehomed)).fish.filter(f => f.status === 'rehomed')).toHaveLength(3);
    for (const command of [{ type: 'sell', fishId: fishId(7), priceModel: 1 }, { type: 'move-batch', fishIds: [fishId(8)], tankId: 'tank-1' }, { type: 'rehome-batch', fishIds: [fishId(9)] }] as Command[]) {
      expect(() => applyCommand(rehomed, command)).toThrow('archived or unavailable');
    }
    expect(() => applyCommand(hatched, { type: 'rehome-batch', fishIds: [fishId(7), fishId(7)] })).toThrow('only be rehomed once');
    expect(() => applyCommand(applyCommand(createWorld(NOW), cross), { type: 'rehome-batch', fishIds: [fishId(7)] })).toThrow('Eggs cannot be rehomed');
    const courting = applyCommand(createWorld(NOW), { type: 'pair', motherId: fishId(1), fatherId: fishId(2), nurseryId: 'tank-2', size: 8, timestamp: NOW, genomeVersion: 2 });
    expect(() => applyCommand(courting, { type: 'rehome-batch', fishIds: [fishId(2)] })).toThrow('courting');
  });

  it('migrates older worlds and keeps pre-economy journals replaying at the lab quote', () => {
    const world = createWorld(NOW), fish = world.fish[0];
    const legacy = applyCommand(world, { type: 'sell', fishId: fish.id });
    expect(legacy.credits).toBe(world.credits + quote(fish));
    expect(legacy.ledger.entries.at(-1)).toMatchObject({ reason: 'sale', amount: quote(fish), fish: 1 });
    expect(legacy.market).toEqual(world.market);

    const migrated = decodeSave(JSON.stringify(asV5(legacy)));
    expect(migrated.ledger).toEqual({ model: 1, opening: legacy.credits, next: 1, totals: { sale: 0, stock: 0, equipment: 0, waterChange: 0, rehome: 0 }, entries: [] });
    expect(migrated.market).toEqual(world.market);
    expect(Object.keys(migrated)).toEqual(Object.keys(decodeSave(JSON.stringify(legacy))));
    expect(() => decodeSave(JSON.stringify({ ...asV5(world), fish: world.fish.map((f, i) => i ? f : { ...f, status: 'rehomed' }) }))).toThrow();

    // A world v5 runtime whose journal sold and bought before the economy existed still decodes, rebased at its snapshot.
    let runtime = createRuntime(world, 'fs501-legacy');
    runtime = executeCommand(runtime, commandEnvelope(runtime, { type: 'sell', fishId: fishId(3) }));
    runtime = executeCommand(runtime, commandEnvelope(runtime, { type: 'buy', tankId: 'tank-2', timestamp: NOW, genomeVersion: 2 }));
    runtime = advanceRuntime(runtime, runtime.tick + DAY);
    const stored = JSON.parse(JSON.stringify(runtime));
    stored.world = asV5(stored.world);
    stored.checkpoint.world = asV5(stored.checkpoint.world);
    const decoded = decodeRuntime(JSON.stringify(stored));
    expect([decoded.world.credits, decoded.events.length, decoded.world.ledger.opening]).toEqual([runtime.world.credits, 0, runtime.world.credits]);
  });
});

describe('FS-505 best-first batch sales', () => {
  it('prices the most valuable fish before cheaper sales use up demand, and the command pays the reviewed plan', () => {
    let world = createWorld(NOW);
    for (const [motherId, fatherId] of [['FSH-000001', 'FSH-000002'], ['FSH-000003', 'FSH-000004']])
      world = applyCommand(world, { type: 'breed', motherId, fatherId, tankId: 'tank-2', timestamp: NOW, genomeVersion: 2 });
    world = advanceWorld(world, 0, 35 * DAY);
    const newestFirst = world.fish.filter(f => f.parents).map(f => f.id).reverse();
    const inOrder = planSales(world, newestFirst), best = planBestSales(world, newestFirst);
    expect(inOrder.total).toBe(536);
    expect(best.total).toBe(697);
    expect(new Set([...best.sales.map(sale => sale.fishId), ...best.unsold])).toEqual(new Set(newestFirst));
    const prices = best.sales.map(sale => sale.offer.amount);
    expect(prices).toEqual([...prices].sort((a, b) => b - a));
    // Sending the planned order to the ordinary sequential plan reproduces every price.
    expect(planSales(world, best.sales.map(sale => sale.fishId)).sales).toEqual(best.sales);
    const sold = applyCommand(world, { type: 'sell-batch', fishIds: best.sales.map(sale => sale.fishId), priceModel: 1 });
    expect(sold.credits - world.credits).toBe(best.total);
    // Ties keep the given order, so equal offers are not reshuffled.
    const founders = planBestSales(base, ['FSH-000002', 'FSH-000001']);
    expect(founders.sales.map(sale => sale.fishId)).toEqual(founders.sales[0].offer.amount === founders.sales[1].offer.amount ? ['FSH-000002', 'FSH-000001'] : [...founders.sales].sort((a, b) => b.offer.amount - a.offer.amount).map(sale => sale.fishId));
  });
});

describe('FS-501 E-05 economy experiment', () => {
  it('shows resale loses money, sales stay within NPC demand and farming earns less per fish', () => {
    const report = economyExperiment(), byId = Object.fromEntries(report.strategies.map(strategy => [strategy.id, strategy]));
    expect(report.days).toBe(EXPERIMENT_DAYS);
    expect([byId.observer.net, byId.observer.sold, byId.observer.strandedDays]).toEqual([0, 0, 0]);
    expect(byId.resale.resaleLosses.length).toBeGreaterThan(0);
    expect(Math.min(...byId.resale.resaleLosses)).toBeGreaterThanOrEqual(STOCK_PRICE - FOUNDER_RESALE_CAP);
    expect(byId.resale.net).toBeLessThan(0);
    const startingDemand = sum(BUYERS.map(buyer => buyer.capacity * buyer.budget));
    for (const strategy of report.strategies) {
      let cumulative = 0;
      strategy.days.forEach((day, i) => { cumulative += day.income; expect(cumulative).toBeLessThanOrEqual(startingDemand + (i + 1) * DAILY_DEMAND_CEILING); });
      expect(sum(Object.values(strategy.incomeByBuyer))).toBe(strategy.income);
      expect(strategy.finalLiving).toBeLessThanOrEqual(480);
    }
    expect(byId.labFarm.sold).toBeGreaterThan(byId.selective.sold);
    expect(byId.labFarm.averagePrice).toBeLessThan(byId.collector.averagePrice);
  });
});
