import { describe, expect, it } from 'vitest';
import { GENOME_VERSION } from '../src/core/catalog';
import { isEgg } from '../src/core/development';
import { guppySex, isGuppyGenome } from '../src/core/guppyGenetics';
import { guppyListingProblem, GUPPY_SHOP_SIZE } from '../src/core/guppyShop';
import { commandEnvelope, createRuntime, decodeRuntime, executeCommand } from '../src/core/runtime';
import { decodeSave } from '../src/core/save';
import type { Fish, World } from '../src/core/types';
import { TICKS_PER_GAME_DAY } from '../src/core/water';
import { applyCommand, createWorld, type Command } from '../src/core/world';

const NOW = '2026-11-05T12:00:00.000Z';
const roundTrip = (world: World) => decodeSave(JSON.stringify(world));
const buy = (): Command => ({ type: 'buy', species: 'guppy', tankId: 'tank-1', timestamp: NOW });

function guppyPair() {
  let world = createWorld(NOW, 271828, GENOME_VERSION);
  world = applyCommand(applyCommand(world, buy()), buy());
  const guppies = world.fish.filter(fish => fish.species === 'guppy');
  return { world, mother: guppies.find(f => f.sex === 'F')!, father: guppies.find(f => f.sex === 'M')! };
}

describe('guppies in the world (v20)', () => {
  it('opens a valid guppy counter and an empty guppy atlas, and round-trips', () => {
    const world = createWorld(NOW, 271828, GENOME_VERSION);
    expect(world.version).toBe(20);
    expect(world.guppyShop.listings).toHaveLength(GUPPY_SHOP_SIZE);
    for (const listing of world.guppyShop.listings) { expect(guppyListingProblem(listing)).toBeNull(); expect(listing.sex).toBe(guppySex(listing.genome)); }
    expect(world.atlas.guppy.stage.every(stage => stage === 0)).toBe(true);
    expect(roundTrip(world)).toEqual(world);
  });

  it('buys a guppy listing atomically', () => {
    const world = createWorld(NOW, 271828, GENOME_VERSION), listing = world.guppyShop.listings[0];
    const next = applyCommand(world, { type: 'buy-guppy-listing', listingId: listing.id, tankId: 'tank-1', timestamp: NOW });
    expect(next.fish.at(-1)).toMatchObject({ species: 'guppy', name: listing.name, sex: listing.sex, generation: 0, parents: null });
    expect(next.credits).toBe(world.credits - listing.price);
    expect(next.ledger.entries.at(-1)).toMatchObject({ reason: 'stock', amount: -listing.price });
    expect(roundTrip(next)).toEqual(next);
    const before = JSON.stringify(next);
    expect(() => applyCommand(next, { type: 'buy-guppy-listing', listingId: listing.id, tankId: 'tank-1', timestamp: NOW })).toThrow(/no longer/);
    expect(JSON.stringify(next)).toBe(before);
  });

  it('founds guppies whose recorded sex matches their sex chromosome, and rejects a mismatched save', () => {
    const { world, mother, father } = guppyPair();
    expect(isGuppyGenome(mother.genome) && guppySex(mother.genome)).toBe('F');
    expect(isGuppyGenome(father.genome) && guppySex(father.genome)).toBe('M');
    const tampered = { ...world, fish: world.fish.map(f => f.id === mother.id ? { ...f, sex: 'M' as const } : f) };
    expect(() => decodeSave(JSON.stringify(tampered))).toThrow(/sex/);
  });

  it('fast-breeds live fry whose sex follows their genome', () => {
    const { world, mother, father } = guppyPair();
    const bred = applyCommand(world, { type: 'breed', motherId: mother.id, fatherId: father.id, tankId: 'tank-2', timestamp: NOW, genomeVersion: GENOME_VERSION, count: 12 });
    const fry = bred.fish.filter(f => f.parents?.[0] === mother.id);
    expect(fry).toHaveLength(12);
    for (const young of fry) { expect(isEgg(young.life)).toBe(false); expect(young.sex).toBe(guppySex(young.genome as never)); }
    expect(roundTrip(bred)).toEqual(bred);
  });

  it('courts, carries a brood and gives birth to live fry through the calendar, and replays', () => {
    const { world } = guppyPair();
    let runtime = createRuntime(world, 'guppy-test');
    const mother = runtime.world.fish.find(f => f.species === 'guppy' && f.sex === 'F')!, father = runtime.world.fish.find(f => f.species === 'guppy' && f.sex === 'M')!;
    runtime = executeCommand(runtime, commandEnvelope(runtime, { type: 'pair', motherId: mother.id, fatherId: father.id, nurseryId: 'tank-2', size: 8, timestamp: NOW, genomeVersion: GENOME_VERSION }));
    const stages = new Set<string>();
    for (let day = 0; day < 40; day++) {
      runtime = executeCommand(runtime, commandEnvelope(runtime, { type: 'feed', tankId: 'tank-1' }, runtime.tick + TICKS_PER_GAME_DAY));
      const clutch = runtime.world.clutches.at(-1)!;
      stages.add(clutch.stage);
      if (clutch.stage === 'gestating') {
        expect(clutch.gestation).toBeDefined();
        expect(() => roundTrip(runtime.world)).not.toThrow();
        // A carried brood cannot be cancelled.
        expect(() => applyCommand(runtime.world, { type: 'cancel-clutch', clutchId: clutch.id } as Command)).toThrow();
      }
      if (clutch.stage === 'hatched') break;
    }
    expect(stages).toContain('gestating'); expect(stages).toContain('hatched');
    const fry = runtime.world.fish.filter((f: Fish) => f.parents?.[0] === mother.id);
    expect(fry.length).toBeGreaterThan(0);
    expect(fry.every(f => f.species === 'guppy' && !isEgg(f.life) && f.sex === guppySex(f.genome as never))).toBe(true);
    expect(decodeRuntime(JSON.stringify(runtime)).world).toEqual(runtime.world);
  });

  it('migrates a v19 world: empty guppy atlas, a fresh guppy counter, zero commission income and an empty board', () => {
    const world = createWorld(NOW, 271828, GENOME_VERSION);
    const { guppyShop: _shop, commissions: _letters, ...rest } = world, { guppy: _atlas, ...atlas } = world.atlas;
    const { commission: _income, ...totals } = world.ledger.totals;
    const v19 = { ...rest, atlas, ledger: { ...world.ledger, totals }, version: 19 };
    const migrated = decodeSave(JSON.stringify(v19));
    expect(migrated.version).toBe(20);
    expect(migrated.guppyShop.listings).toHaveLength(GUPPY_SHOP_SIZE);
    expect(migrated.commissions.board).toEqual([]);
    expect(migrated.ledger.totals.commission).toBe(0);
    expect(migrated.atlas.guppy.stage.every(stage => stage === 0)).toBe(true);
    expect(migrated.fish).toEqual(world.fish);
  });
});
