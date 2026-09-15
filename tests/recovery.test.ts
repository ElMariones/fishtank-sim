import { describe, expect, it } from 'vitest';
import { pairingBlockers, reservedPlaces } from '../src/core/breeding';
import { careSettings } from '../src/core/care';
import { careWarnings } from '../src/core/careAdvice';
import { ADULT_FROM, isEgg } from '../src/core/development';
import { bestOffer, FOUNDER_RESALE_CAP, ledgerBalance, openingLedger, planSales } from '../src/core/economy';
import { metabolicPotential } from '../src/core/genetics';
import { advanceWorld } from '../src/core/habitat';
import { random } from '../src/core/random';
import { missingSexes, recoveryOverview, RELIEF_COOLDOWN_DAYS, RELIEF_THRESHOLD, reliefDestination, reliefStatus } from '../src/core/recovery';
import { advanceRuntime, commandEnvelope, createRuntime, decodeRuntime, executeCommand } from '../src/core/runtime';
import { decodeSave } from '../src/core/save';
import type { Fish, World } from '../src/core/types';
import { TICKS_PER_GAME_DAY } from '../src/core/water';
import { applyCommand, createWorld, MAX_LIVING, MAX_RECORDS, type Command } from '../src/core/world';

const NOW = '2026-09-15T12:00:00.000Z';
const DAY = TICKS_PER_GAME_DAY;
const MALES = ['FSH-000002', 'FSH-000004', 'FSH-000006'];
const limits = { maxLiving: MAX_LIVING, maxRecords: MAX_RECORDS };
const claim = (tankId = 'tank-1'): Command => ({ type: 'claim-relief', tankId, timestamp: NOW, genomeVersion: 2 });
/** Credits and the ledger's opening balance both at `credits`, as after spending down to that balance. */
const withCredits = (world: World, credits: number): World => ({ ...world, credits, ledger: openingLedger(credits) });
const withoutMales = (credits: number) => withCredits(applyCommand(createWorld(NOW), { type: 'rehome-batch', fishIds: MALES }), credits);
function everyoneRehomed(credits: number) {
  const world = createWorld(NOW);
  return withCredits(applyCommand(world, { type: 'rehome-batch', fishIds: world.fish.map(f => f.id) }), credits);
}
function refused(world: World, command: Command, message: string) {
  const before = JSON.stringify(world);
  expect(() => applyCommand(world, command)).toThrow(message);
  expect(JSON.stringify(world)).toBe(before);
}

type Recovery = { world: World; days: number; commands: Command['type'][] };

/**
 * Reaches an accepted normal pairing using only what a player without spare credits can do: cancel courtships, rehome
 * and move fish, choose free care settings, wait, and take the koi rescue or founder stock the credits already cover.
 */
function recoverPair(start: World, startTick: number, maxDays = 150): Recovery {
  let world = start, tick = startTick, home: string | null = null;
  const commands: Command['type'][] = [];
  const run = (command: Command) => { world = applyCommand(world, command); commands.push(command.type); };
  const wait = () => { world = advanceWorld(world, tick, tick + DAY); tick += DAY; };
  const living = () => world.fish.filter(f => f.status === 'living');
  const free = (tankId: string) => world.tanks.find(t => t.id === tankId)!.capacity - living().filter(f => f.tankId === tankId).length - reservedPlaces(world, tankId);
  const promise = (f: Fish) => (isEgg(f.life) ? 0 : 2) + (f.life.lengthCm >= ADULT_FROM * metabolicPotential(f.genome).adultLengthCm ? 2 : 0) + f.life.condition;
  const best = (sex: Fish['sex']) => living().filter(f => f.sex === sex).sort((a, b) => promise(b) - promise(a))[0];
  /** Rehoming is free: release hatched fish from a tank until it has `needed` places, keeping the most promising breeders. */
  const makeRoom = (tankId: string, needed: number) => {
    const keep = new Set([best('F')?.id, best('M')?.id]);
    const spare = living().filter(f => f.tankId === tankId && !isEgg(f.life) && !keep.has(f.id)).map(f => f.id);
    const count = Math.min(spare.length, needed - free(tankId));
    if (count > 0) run({ type: 'rehome-batch', fishIds: spare.slice(0, count) });
    return free(tankId) >= needed;
  };
  for (const clutch of world.clutches) if (clutch.stage === 'courting') run({ type: 'cancel-clutch', clutchId: clutch.id });
  while (tick - startTick < maxDays * DAY) {
    const missing = missingSexes(world);
    if (missing.length) {
      if (reliefStatus(world).eligible) {
        const tankId = reliefDestination(world, missing.length) ?? (makeRoom('tank-1', missing.length) ? 'tank-1' : null);
        if (tankId) { run({ type: 'claim-relief', tankId, timestamp: NOW, genomeVersion: 2 }); continue; }
      } else if (world.credits >= RELIEF_THRESHOLD * missing.length) {
        const listing = world.shop.listings.find(entry => entry.sex === missing[0] && entry.price <= world.credits);
        const tankId = listing ? reliefDestination(world, 1) ?? (makeRoom('tank-1', 1) ? 'tank-1' : null) : null;
        if (listing && tankId) { run({ type: 'buy-listing', listingId: listing.id, tankId, timestamp: NOW }); continue; }
      }
      wait();
      continue;
    }
    const mother = best('F'), father = best('M');
    if (!isEgg(mother.life) && !isEgg(father.life)) {
      // The tank with the cleanest water becomes home: move the pair in, release everyone else there, measured rations at 22 °C.
      home ??= [...world.tanks].sort((a, b) => a.water.ammoniaMgL - b.water.ammoniaMgL)[0].id;
      for (const parent of [mother, father]) if (parent.tankId !== home && makeRoom(home, 1)) run({ type: 'move', fishId: parent.id, tankId: home });
      makeRoom(home, world.tanks.find(t => t.id === home)!.capacity);
      const settings = careSettings(world.tanks.find(t => t.id === home)!);
      if (settings.ration !== 'measured' || settings.targetC !== 22)
        run({ type: 'set-care', tankId: home, ration: 'measured', filterTier: settings.filterTier, aerationTier: settings.aerationTier, targetC: 22 });
      const request = { motherId: mother.id, fatherId: father.id, nurseryId: home, size: 8 as const };
      if (!pairingBlockers(world, request, limits).length) {
        run({ type: 'pair', ...request, timestamp: NOW, genomeVersion: 2 });
        return { world, days: Math.ceil((tick - startTick) / DAY), commands };
      }
    }
    wait();
  }
  throw new Error(`No route back to a breeding pair within ${maxDays} game days.`);
}

describe('FS-504 koi rescue', () => {
  it('gives one unrelated adult of each missing sex at no cost, ready to court', () => {
    const lonely = withoutMales(100);
    expect([missingSexes(lonely), reliefStatus(lonely).eligible, reliefDestination(lonely, 1)]).toEqual([['M'], true, 'tank-1']);
    const rescued = applyCommand(lonely, claim()), male = rescued.fish.at(-1)!;
    expect(male).toMatchObject({ id: 'FSH-000007', sex: 'M', generation: 0, parents: null, tankId: 'tank-1', status: 'living', mutations: [], genome: { version: 2 } });
    expect([rescued.credits, rescued.nextId, rescued.relief]).toEqual([100, 8, { model: 1, claims: 1, cooldownDays: RELIEF_COOLDOWN_DAYS }]);
    expect(rescued.ledger.entries.at(-1)).toMatchObject({ reason: 'stock', amount: 0, fish: 1, detail: `Koi rescue: ${male.name} at no cost` });
    expect(ledgerBalance(rescued.ledger)).toBe(100);
    expect(decodeSave(JSON.stringify(rescued))).toEqual(rescued);
    const request = { motherId: 'FSH-000001', fatherId: male.id, nurseryId: 'tank-2', size: 20 as const };
    expect(pairingBlockers(rescued, request, limits)).toEqual([]);
    expect(applyCommand(rescued, { type: 'pair', ...request, timestamp: NOW, genomeVersion: 2 }).clutches).toHaveLength(1);

    // With nobody left, a pair arrives together, named apart from every archived record.
    const empty = everyoneRehomed(0), pair = applyCommand(empty, claim('tank-2'));
    expect(pair.fish.slice(-2).map(f => [f.sex, f.tankId, f.life.condition])).toEqual([['F', 'tank-2', 1], ['M', 'tank-2', 1]]);
    expect(new Set(pair.fish.map(f => f.name)).size).toBe(pair.fish.length);
    expect(pair.ledger.entries.at(-1)).toMatchObject({ amount: 0, fish: 2 });
    expect(reliefStatus(withCredits(empty, 2 * RELIEF_THRESHOLD - 1)).eligible).toBe(true);
  });

  it('refuses without changing anything when it is not needed, not affordable to skip, still waiting or has no room', () => {
    const lonely = withoutMales(100), empty = everyoneRehomed(0);
    refused(withCredits(createWorld(NOW), 0), claim(), 'both sexes');
    refused(withCredits(lonely, RELIEF_THRESHOLD), claim(), 'enough to buy one male');
    refused(withCredits(empty, 2 * RELIEF_THRESHOLD), claim(), 'enough to buy one female and one male');
    const waiting = applyCommand(applyCommand(lonely, claim()), { type: 'rehome-batch', fishIds: ['FSH-000007'] });
    refused(waiting, claim(), `again in ${RELIEF_COOLDOWN_DAYS} game days`);
    const cramped = structuredClone(lonely);
    cramped.tanks[0].capacity = 3;
    refused(cramped, claim('tank-1'), 'free places');
    expect(reliefDestination(cramped, 1)).toBe('tank-2');
    refused(lonely, claim('tank-9'), 'Tank not found');
    refused(lonely, { ...claim(), genomeVersion: 3 } as unknown as Command, 'Invalid');
  });

  it('counts the wait down at game-day boundaries and replays exactly', () => {
    let runtime = createRuntime(withoutMales(100), 'fs504-relief');
    runtime = executeCommand(runtime, commandEnvelope(runtime, claim(), 300));
    runtime = executeCommand(runtime, commandEnvelope(runtime, { type: 'rehome-batch', fishIds: ['FSH-000007'] }, 600));
    const nine = advanceRuntime(runtime, 9 * DAY);
    expect(nine.world.relief.cooldownDays).toBe(1);
    expect(() => executeCommand(nine, commandEnvelope(nine, claim(), nine.tick))).toThrow('again in 1 game day.');
    const ten = advanceRuntime(nine, 10 * DAY);
    expect(ten.world.relief.cooldownDays).toBe(0);
    let stepped = runtime.world, from = runtime.tick;
    for (let day = 1; day <= 10; day++) { stepped = advanceWorld(stepped, from, day * DAY); from = day * DAY; }
    expect(stepped).toEqual(ten.world);

    const second = executeCommand(ten, commandEnvelope(ten, claim('tank-2'), ten.tick + 5));
    expect(second.world.relief).toEqual({ model: 1, claims: 2, cooldownDays: RELIEF_COOLDOWN_DAYS });
    const later = advanceRuntime(second, second.tick + 3 * DAY + 7);
    expect(later.world.relief.cooldownDays).toBe(RELIEF_COOLDOWN_DAYS - 3);
    expect(decodeRuntime(JSON.stringify(later))).toEqual(later);
    const tampered = JSON.parse(JSON.stringify(later));
    tampered.world.relief.cooldownDays = 0;
    expect(() => decodeRuntime(JSON.stringify(tampered))).toThrow('replay');

    const invented = JSON.parse(JSON.stringify(createWorld(NOW)));
    invented.relief.cooldownDays = 4;
    expect(() => decodeSave(JSON.stringify(invented))).toThrow('without any claim');
    invented.relief = { model: 1, claims: 1, cooldownDays: RELIEF_COOLDOWN_DAYS + 1 };
    expect(() => decodeSave(JSON.stringify(invented))).toThrow();
  });

  it('migrates world v8 saves and runtimes with no claims while still proving their decorations', () => {
    const asV8 = (world: World) => { const { relief, ...rest } = world; void relief; return { ...rest, version: 8 }; };
    const world = applyCommand(createWorld(NOW), { type: 'purchase-tank' }), migrated = decodeSave(JSON.stringify(asV8(world)));
    expect(migrated).toEqual(world);
    expect(Object.keys(migrated)).toEqual(Object.keys(decodeSave(JSON.stringify(world))));

    let runtime = createRuntime(createWorld(NOW), 'fs504-v8');
    runtime = executeCommand(runtime, commandEnvelope(runtime, { type: 'place-decorations', tankId: 'tank-2', decorations: [{ id: 'DC-1', kind: 'rock', x: 0.45, y: 0.5, scale: 1, rotation: 30 }] }, 100));
    runtime = advanceRuntime(runtime, 5 * DAY);
    const stored = JSON.parse(JSON.stringify(runtime));
    stored.world = asV8(stored.world);
    stored.checkpoint.world = asV8(stored.checkpoint.world);
    const decoded = decodeRuntime(JSON.stringify(stored));
    expect([decoded.world, decoded.events.length]).toEqual([runtime.world, 0]);
    expect(decodeRuntime(JSON.stringify(decoded))).toEqual(decoded);
    stored.world.tanks[1].decorations[0].x = 0.5;
    expect(() => decodeRuntime(JSON.stringify(stored))).toThrow('replay');
  });

  it('restores a pair without becoming an income, even for a keeper who spends to stay eligible', () => {
    const DAYS = 60;
    let world = withoutMales(0), tick = 0, claims = 0, income = 0, spent = 0;
    for (let day = 0; day < DAYS; day++) {
      if (reliefStatus(world).eligible) {
        world = applyCommand(world, claim()); claims++;
        const male = world.fish.at(-1)!, offer = bestOffer(world, male);
        world = applyCommand(world, offer ? { type: 'sell', fishId: male.id, priceModel: 1 } : { type: 'rehome-batch', fishIds: [male.id] });
        income += offer?.amount ?? 0;
        // Turning the proceeds into stock that is rehomed at once keeps credits under the threshold.
        const listing = [...world.shop.listings].sort((a, b) => a.price - b.price).find(entry => entry.sex === 'F' && entry.price <= world.credits);
        if (world.credits >= RELIEF_THRESHOLD && listing) {
          world = applyCommand(world, { type: 'buy-listing', listingId: listing.id, tankId: 'tank-2', timestamp: NOW });
          world = applyCommand(world, { type: 'rehome-batch', fishIds: [world.fish.at(-1)!.id] });
          spent += listing.price;
        }
      }
      world = advanceWorld(world, tick, tick + DAY); tick += DAY;
    }
    expect(claims).toBe(Math.ceil(DAYS / RELIEF_COOLDOWN_DAYS));
    expect(income).toBeLessThanOrEqual(claims * FOUNDER_RESALE_CAP);
    expect(world.credits).toBe(income - spent);
    expect(ledgerBalance(world.ledger)).toBe(world.credits);
  });
});

describe('FS-504 no softlock', () => {
  it('recovers from the harshest starting points with only free actions and the credits already held', () => {
    const lone = applyCommand(applyCommand(withoutMales(40), claim()), { type: 'rehome-batch', fishIds: ['FSH-000007'] });
    const cross = applyCommand(createWorld(NOW), { type: 'breed', motherId: 'FSH-000001', fatherId: 'FSH-000002', tankId: 'tank-2', timestamp: NOW, genomeVersion: 2 });
    const eggsOnly = withCredits(applyCommand(cross, { type: 'rehome-batch', fishIds: cross.fish.slice(0, 6).map(f => f.id) }), 0);
    const cases = { empty: everyoneRehomed(0), waiting: lone, eggsOnly, stock: withoutMales(1000) };
    const result = Object.fromEntries(Object.entries(cases).map(([key, world]) => {
      const recovered = recoverPair(world, 0);
      expect(ledgerBalance(recovered.world.ledger)).toBe(recovered.world.credits);
      expect(() => decodeSave(JSON.stringify(recovered.world))).not.toThrow();
      return [key, { days: recovered.days, claims: recovered.commands.filter(type => type === 'claim-relief').length, bought: recovered.commands.includes('buy-listing'), spent: world.credits - recovered.world.credits }];
    }));
    expect(result.empty).toEqual({ days: 0, claims: 1, bought: false, spent: 0 });
    expect(result.waiting).toEqual({ days: RELIEF_COOLDOWN_DAYS, claims: 1, bought: false, spent: 0 });
    expect(result.eggsOnly).toMatchObject({ claims: 0, bought: false, spent: 0 });
    expect(result.eggsOnly.days).toBeGreaterThanOrEqual(18);
    expect(result.eggsOnly.days).toBeLessThanOrEqual(60);
    expect(result.stock).toMatchObject({ claims: 0, bought: true });
    expect(result.stock.spent).toBeGreaterThanOrEqual(RELIEF_THRESHOLD);
  });

  it('keeps a route back to a breeding pair through a seeded walk of spending, selling, rehoming and neglect', () => {
    const rng = random(504);
    const pick = <T>(items: readonly T[]): T | undefined => items[Math.floor(rng() * items.length)];
    let world = createWorld(NOW), tick = 0, checks = 0, lostSex = 0, longest = 0;
    for (let step = 0; step < 500; step++) {
      const alive = world.fish.filter(f => f.status === 'living'), hatched = alive.filter(f => !isEgg(f.life));
      const courting = new Set(world.clutches.flatMap(c => c.stage === 'courting' ? [c.motherId, c.fatherId] : []));
      const idle = hatched.filter(f => !courting.has(f.id));
      const some = (count: number) => [...new Set(Array.from({ length: count }, () => pick(idle)?.id ?? 'FSH-999999'))];
      const parent = (sex: Fish['sex']) => pick(hatched.filter(f => f.sex === sex))?.id ?? 'FSH-999999';
      const tankId = pick(world.tanks)!.id, roll = rng();
      let command: Command | null = null;
      if (roll < 0.07) command = alive.length < 150 ? { type: 'breed', motherId: parent('F'), fatherId: parent('M'), tankId, timestamp: NOW, genomeVersion: 2 } : null;
      else if (roll < 0.12) command = { type: 'pair', motherId: parent('F'), fatherId: parent('M'), nurseryId: tankId, size: 8, timestamp: NOW, genomeVersion: 2 };
      else if (roll < 0.22) command = { type: 'sell-batch', fishIds: some(1 + Math.floor(rng() * 6)), priceModel: 1 };
      else if (roll < 0.3) command = { type: 'rehome-batch', fishIds: some(1 + Math.floor(rng() * 12)) };
      else if (roll < 0.34) { const sex = rng() < 0.5 ? 'F' : 'M'; command = { type: 'rehome-batch', fishIds: idle.filter(f => f.sex === sex).map(f => f.id) }; }
      else if (roll < 0.42) command = { type: 'buy-listing', listingId: pick(world.shop.listings)?.id ?? 'LS-999999', tankId, timestamp: NOW };
      else if (roll < 0.47) command = rng() < 0.5 ? { type: 'purchase-tank' } : { type: 'upgrade-tank', tankId };
      else if (roll < 0.54) command = { type: 'set-care', tankId, ration: pick(['light', 'measured', 'generous'] as const)!, filterTier: Math.floor(rng() * 4), aerationTier: Math.floor(rng() * 4), targetC: 18 + Math.floor(rng() * 11) };
      else if (roll < 0.6) command = { type: 'change-water', tankId, percent: pick([10, 25, 50] as const)! };
      else if (roll < 0.63) command = { type: 'claim-relief', tankId: reliefDestination(world, 2) ?? tankId, timestamp: NOW, genomeVersion: 2 };
      if (command) { try { world = applyCommand(world, command); } catch { continue; } }
      else { const days = 1 + Math.floor(rng() * 3); world = advanceWorld(world, tick, tick + days * DAY); tick += days * DAY; }
      expect(ledgerBalance(world.ledger)).toBe(world.credits);
      const stuck = missingSexes(world).length > 0;
      if (stuck) lostSex++;
      if (checks < 24 && ((stuck && rng() < 0.3) || step % 50 === 49)) {
        const recovered = recoverPair(world, tick);
        checks++; longest = Math.max(longest, recovered.days);
        expect(recovered.world.clutches.filter(c => c.stage === 'courting')).toHaveLength(1);
        expect(recovered.world.credits).toBeLessThanOrEqual(world.credits);
        expect(ledgerBalance(recovered.world.ledger)).toBe(recovered.world.credits);
      }
    }
    expect(lostSex).toBeGreaterThan(0);
    expect(checks).toBeGreaterThanOrEqual(10);
    expect(longest).toBeLessThan(150);
  });
});

describe('FS-504 recovery guidance', () => {
  it('names a free care fix whenever the priced ones are out of reach, and never offers a free tank', () => {
    const polluted = structuredClone(createWorld(NOW));
    polluted.tanks[0].water.ammoniaMgL = 3;
    polluted.tanks[0].care.ration = 'measured';
    const ammonia = (world: World) => careWarnings(world, 'tank-1').find(warning => warning.code === 'ammonia')!.fixes;
    expect(ammonia(polluted).some(fix => fix.kind === 'hint')).toBe(false);
    expect(ammonia(withCredits(polluted, 0)).filter(fix => fix.kind === 'hint').map(fix => fix.label)).toEqual([expect.stringContaining('which is free')]);

    const crowded = structuredClone(withCredits(polluted, 0));
    crowded.tanks[0].water.volumeL = 1000;
    const warnings = careWarnings(crowded, 'tank-1');
    expect(warnings.find(warning => warning.code === 'crowding')!.fixes.every(fix => fix.kind === 'hint')).toBe(true);
    for (const warning of warnings) expect(warning.fixes.some(fix => fix.kind === 'hint' || fix.kind === 'command' || fix.cost === 0)).toBe(true);
    expect(warnings.flatMap(warning => warning.fixes).some(fix => fix.kind === 'command' && fix.command.type === 'add-tank')).toBe(false);
  });

  it('summarizes what can still be sold, rehomed or rescued from the same rules the commands use', () => {
    const world = createWorld(NOW), overview = recoveryOverview(world), plan = planSales(world, world.fish.map(f => f.id));
    expect(overview).toMatchObject({ living: { F: 3, M: 3 }, releasable: 6, saleable: plan.sales.length, saleTotal: plan.total, relief: { eligible: false, sexes: [] } });
    const courting = applyCommand(world, { type: 'pair', motherId: 'FSH-000001', fatherId: 'FSH-000002', nurseryId: 'tank-2', size: 8, timestamp: NOW, genomeVersion: 2 });
    expect(recoveryOverview(courting).releasable).toBe(4);
    expect(recoveryOverview(everyoneRehomed(0))).toMatchObject({ living: { F: 0, M: 0 }, releasable: 0, saleable: 0, saleTotal: 0, relief: { eligible: true, sexes: ['F', 'M'] } });
  });
});
