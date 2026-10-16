import { describe, expect, it } from 'vitest';
import { competitionSchedule, competitionScores, createCompetitionRun } from '../src/core/competitions';
import { bestOffer, saleTraits, FOUNDER_RESALE_CAP } from '../src/core/economy';
import { goldfishAnatomyFor, goldfishContainsPoint, goldfishPortraitFrame } from '../src/core/goldfishAnatomy';
import { expressGoldfish, isGoldfishGenome, type GoldfishGenome } from '../src/core/goldfishGenetics';
import { goldfishListingProblem, GOLDFISH_SHOP_SIZE, VARIETY_TEMPLATES, withGoldfishAlleles } from '../src/core/goldfishShop';
import { advanceWorld } from '../src/core/habitat';
import { commandEnvelope, createRuntime, decodeRuntime, executeCommand } from '../src/core/runtime';
import { decodeSave } from '../src/core/save';
import type { Fish, World } from '../src/core/types';
import { TICKS_PER_GAME_DAY } from '../src/core/water';
import { applyCommand, createWorld, WORLD_VERSION, type Command } from '../src/core/world';
import { GENOME_VERSION } from '../src/core/catalog';
import { createBehaviorWorld, stepBehavior } from '../src/simulation/behavior';
import { drawGoldfish } from '../src/rendering/goldfish';
import { drawFish } from '../src/rendering/fish';
import { express } from '../src/core/genetics';
import { measureWork } from './support/recordingContext';

const NOW = '2026-10-16T12:00:00.000Z';
const buy = (tankId = 'tank-1'): Command => ({ type: 'buy', species: 'goldfish', tankId, timestamp: NOW });
const roundTrip = (world: World) => decodeSave(JSON.stringify(world));

function goldfishPair(): { world: World; mother: Fish; father: Fish } {
  let world = createWorld(NOW, 481516, GENOME_VERSION);
  world = applyCommand(applyCommand(world, buy()), buy());
  const goldfish = world.fish.filter(fish => fish.species === 'goldfish');
  return { world, mother: goldfish.find(f => f.sex === 'F')!, father: goldfish.find(f => f.sex === 'M')! };
}

describe('goldfish in the world (v17)', () => {
  it('opens new worlds with a valid goldfish counter and an empty goldfish atlas', () => {
    const world = createWorld(NOW, 481516, GENOME_VERSION);
    expect(world.version).toBe(WORLD_VERSION); expect(WORLD_VERSION).toBe(17);
    expect(world.goldfishShop.listings).toHaveLength(GOLDFISH_SHOP_SIZE);
    for (const listing of world.goldfishShop.listings) {
      expect(goldfishListingProblem(listing)).toBeNull();
      expect(listing.price).toBeGreaterThan(FOUNDER_RESALE_CAP);
    }
    expect(world.atlas.goldfish.evidence).toHaveLength(72);
    expect(roundTrip(world)).toEqual(world);
  });

  it('buys a goldfish listing atomically and records it in the ledger', () => {
    const world = createWorld(NOW, 481516, GENOME_VERSION), listing = world.goldfishShop.listings[0];
    const next = applyCommand(world, { type: 'buy-goldfish-listing', listingId: listing.id, tankId: 'tank-1', timestamp: NOW });
    const fish = next.fish.at(-1)!;
    expect(fish).toMatchObject({ species: 'goldfish', name: listing.name, sex: listing.sex, generation: 0, parents: null });
    expect(fish.genome).toEqual(listing.genome);
    expect(next.credits).toBe(world.credits - listing.price);
    expect(next.goldfishShop.listings.map(l => l.id)).not.toContain(listing.id);
    expect(next.ledger.entries.at(-1)).toMatchObject({ reason: 'stock', amount: -listing.price });
    expect(roundTrip(next)).toEqual(next);
    const before = JSON.stringify(next);
    expect(() => applyCommand(next, { type: 'buy-goldfish-listing', listingId: listing.id, tankId: 'tank-1', timestamp: NOW })).toThrow(/no longer/);
    expect(JSON.stringify(next)).toBe(before);
  });

  it('refills the goldfish counter on the delivery rhythm without touching the koi or axolotl shops', () => {
    const world = createWorld(NOW, 481516, GENOME_VERSION);
    const bought = applyCommand(world, { type: 'buy-goldfish-listing', listingId: world.goldfishShop.listings[0].id, tankId: 'tank-1', timestamp: NOW });
    const later = advanceWorld(bought, 0, TICKS_PER_GAME_DAY * 8);
    expect(later.goldfishShop.listings).toHaveLength(GOLDFISH_SHOP_SIZE);
    const control = advanceWorld(world, 0, TICKS_PER_GAME_DAY * 8);
    expect(later.shop).toEqual(control.shop); expect(later.axolotlShop).toEqual(control.axolotlShop);
    expect(roundTrip(later)).toEqual(later);
  });

  it('breeds goldfish through the instant cross, records the atlas and refuses cross-species pairs', () => {
    const { world, mother, father } = goldfishPair();
    const bred = applyCommand(world, { type: 'breed', motherId: mother.id, fatherId: father.id, tankId: 'tank-2', timestamp: NOW, genomeVersion: GENOME_VERSION, count: 12 });
    const kids = bred.fish.slice(world.fish.length);
    expect(kids.length).toBeGreaterThan(6);
    for (const kid of kids) {
      expect(kid.species).toBe('goldfish'); expect(isGoldfishGenome(kid.genome)).toBe(true);
      expect(kid.parents).toEqual([mother.id, father.id]); expect(kid.generation).toBe(1);
    }
    expect(bred.atlas.goldfish.evidence.some(value => value > 0)).toBe(true);
    expect(bred.atlas.koi).toEqual(world.atlas.koi);
    expect(roundTrip(bred)).toEqual(bred);
    const koiMale = world.fish.find(f => f.species === 'koi' && f.sex === 'M')!;
    expect(() => applyCommand(world, { type: 'breed', motherId: mother.id, fatherId: koiMale.id, tankId: 'tank-2', timestamp: NOW, genomeVersion: GENOME_VERSION })).toThrow(/species/);
  });

  it('courts, spawns and hatches a goldfish clutch through the calendar and replays the journal', () => {
    const { world } = goldfishPair();
    let runtime = createRuntime(world, 'goldfish-test');
    const run = (payload: Command) => { runtime = executeCommand(runtime, commandEnvelope(runtime, payload)); };
    const mother = runtime.world.fish.find(f => f.species === 'goldfish' && f.sex === 'F')!, father = runtime.world.fish.find(f => f.species === 'goldfish' && f.sex === 'M')!;
    run({ type: 'pair', motherId: mother.id, fatherId: father.id, nurseryId: 'tank-2', size: 12, timestamp: NOW, genomeVersion: GENOME_VERSION });
    expect(runtime.world.clutches.at(-1)!.species).toBe('goldfish');
    const target = runtime.tick + TICKS_PER_GAME_DAY * 30;
    runtime = executeCommand(runtime, commandEnvelope(runtime, { type: 'feed', tankId: 'tank-1' }, target));
    const clutch = runtime.world.clutches.at(-1)!;
    expect(['incubating', 'hatched']).toContain(clutch.stage);
    const young = runtime.world.fish.filter(f => f.parents?.[0] === mother.id);
    expect(young.length).toBeGreaterThan(0);
    expect(young.every(f => f.species === 'goldfish')).toBe(true);
    const restored = decodeRuntime(JSON.stringify(runtime));
    expect(restored.world).toEqual(runtime.world);
  });

  it('migrates a world v16 save: goldfish atlas and counter are added, nothing else changes', () => {
    const world = createWorld(NOW, 99, GENOME_VERSION);
    const { goldfishShop: _shop, ...rest } = world, { goldfish: _atlas, ...atlas } = world.atlas;
    const v16 = { ...rest, version: 16, atlas };
    const migrated = decodeSave(JSON.stringify(v16));
    expect(migrated.version).toBe(17);
    expect(migrated.fish).toEqual(world.fish); expect(migrated.credits).toBe(world.credits); expect(migrated.shop).toEqual(world.shop);
    expect(migrated.goldfishShop.listings).toHaveLength(GOLDFISH_SHOP_SIZE);
    expect(migrated.atlas.goldfish.stage.every(stage => stage === 0)).toBe(true);
    expect(roundTrip(migrated)).toEqual(migrated);
    // A runtime saved at v16 rebases onto v17 and keeps the stock its own replay delivered.
    const runtime = createRuntime(migrated, 'legacy');
    const stored = { ...runtime, world: v16, checkpoint: { ...runtime.checkpoint, world: v16 } };
    const restored = decodeRuntime(JSON.stringify(stored));
    expect(restored.world.version).toBe(17); expect(restored.world.fish).toEqual(world.fish);
  });

  it('rejects a goldfish whose species does not match its genome', () => {
    const { world } = goldfishPair();
    const broken = structuredClone(world), fish = broken.fish.find(f => f.species === 'goldfish')!;
    fish.species = 'koi';
    expect(() => decodeSave(JSON.stringify(broken))).toThrow();
    const tampered = structuredClone(world);
    tampered.goldfishShop.listings[0].price += 1;
    expect(() => decodeSave(JSON.stringify(tampered))).toThrow(/price/);
  });
});

describe('goldfish economy, shows and behavior', () => {
  const genome = (template: keyof typeof VARIETY_TEMPLATES, base: GoldfishGenome) => withGoldfishAlleles(base, { gf_swim_bladder: [5, 5], gf_eye_program: [0, 0], gf_bubble_program: [0, 0], ...VARIETY_TEMPLATES[template] });
  const asFish = (g: GoldfishGenome, parents: [string, string] | null = ['FSH-000001', 'FSH-000002']): Fish => ({
    id: 'FSH-000099', name: 'Test', sex: 'F', species: 'goldfish', genome: g, birthSeed: 1, generation: parents ? 1 : 0, parents, bornAt: NOW, tankId: 'tank-1', status: 'living',
    mutations: [], origins: [], life: { model: 1, ageDays: 60, lengthCm: expressGoldfish(g).adultLengthCm, condition: 1 }, breeding: { model: 1, cooldownDays: 0 },
  });

  it('the pond keeper takes hardy single tails but not fancy twin tails', () => {
    const { world } = goldfishPair();
    const base = world.fish.find(f => f.species === 'goldfish')!.genome as GoldfishGenome;
    const comet = asFish(withGoldfishAlleles(genome('comet', base), { gf_adult_size: [5, 5] })), ranchu = asFish(genome('ranchu', base));
    expect(saleTraits(comet).goldfish!.hardy).toBe(true);
    expect(saleTraits(ranchu).goldfish!.hardy).toBe(false);
    const pondCut = (fish: Fish) => bestOffer(world, fish)?.buyer;
    expect(pondCut(ranchu)).not.toBe('pondKeeper');
    expect(saleTraits(ranchu).rarity).toBeGreaterThan(saleTraits(comet).rarity);
  });

  it('schedules goldfish shows and judges goldfish against their variety standard', () => {
    const events = competitionSchedule(481516, 0).filter(e => e.species === 'goldfish');
    expect(events).toHaveLength(6);
    const { world } = goldfishPair();
    const entrant = { ...world.fish.find(f => f.species === 'goldfish')! };
    entrant.life = { ...entrant.life, condition: 0.95 };
    const scores = competitionScores(entrant, events[0]);
    for (const value of Object.values(scores)) { expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThanOrEqual(100); }
    const run = createCompetitionRun(world, events[0], [entrant]);
    expect(run.participants.every(p => p.fish.species === 'goldfish')).toBe(true);
    const entered = applyCommand({ ...world, credits: world.credits }, { type: 'enter-competition', eventId: events[0].id, fishIds: [entrant.id] });
    expect(entered.circuit.active?.event.species).toBe('goldfish');
    expect(roundTrip(entered)).toEqual(entered);
  });

  it('simulates goldfish in mixed tanks deterministically', () => {
    const { world } = goldfishPair();
    const residents = world.fish.filter(f => f.tankId === 'tank-1' && f.status === 'living');
    const run = () => { let behavior = createBehaviorWorld(residents, true); for (let i = 0; i < 200; i++) behavior = stepBehavior(behavior); return behavior; };
    const first = run();
    expect(run()).toEqual(first);
    for (const actor of first.actors) expect([actor.x, actor.y, actor.vx, actor.vy].every(Number.isFinite)).toBe(true);
  });
});

describe('goldfish anatomy and renderer', () => {
  const varieties = Object.keys(VARIETY_TEMPLATES) as (keyof typeof VARIETY_TEMPLATES)[];
  const base = (n: number) => goldfishPair().world.fish.filter(f => f.species === 'goldfish')[n % 2].genome as GoldfishGenome;
  it('builds finite, pickable anatomy for every variety and frames portraits inside the canvas', () => {
    varieties.forEach((variety, i) => {
      const p = expressGoldfish(withGoldfishAlleles(base(i), VARIETY_TEMPLATES[variety]!)), a = goldfishAnatomyFor(p);
      for (const v of Object.values(a.bounds)) expect(Number.isFinite(v)).toBe(true);
      expect(goldfishContainsPoint(a, { x: -0.1, y: 0 })).toBe(true);
      expect(goldfishContainsPoint(a, { x: 3, y: 3 })).toBe(false);
      const frame = goldfishPortraitFrame(p, 240, 160);
      const l = frame.size * p.body.length;
      expect(frame.originX + a.bounds.minX * l).toBeGreaterThanOrEqual(-0.5); expect(frame.originX + a.bounds.maxX * l).toBeLessThanOrEqual(240.5);
      expect(frame.originY + a.bounds.minY * l).toBeGreaterThanOrEqual(-0.5); expect(frame.originY + a.bounds.maxY * l).toBeLessThanOrEqual(160.5);
    });
  });

  it('draws every variety through the shared fish entry point', () => {
    varieties.forEach((variety, i) => {
      const genome = withGoldfishAlleles(base(i), VARIETY_TEMPLATES[variety]!), phenotype = express(genome);
      const work = measureWork(ctx => drawFish(ctx, phenotype, 7, 60, 1.2, { tailPhase: 1, finPhase: 2, effort: 0.5, grounded: 0 }));
      expect(work.fills).toBeGreaterThan(5); expect(work.total).toBeGreaterThan(50);
      // Texture paths are cached per phenotype, so compare the drawing calls rather than path construction.
      const direct = measureWork(ctx => drawGoldfish(ctx, phenotype.goldfish!, 7, 60, 1.2, { tailPhase: 1, finPhase: 2, effort: 0.5 }));
      expect([direct.fills, direct.strokes, direct.clips]).toEqual([work.fills, work.strokes, work.clips]);
    });
  });
});
