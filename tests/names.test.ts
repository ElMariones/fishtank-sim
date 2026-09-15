import { describe, expect, it } from 'vitest';
import { advanceWorld } from '../src/core/habitat';
import { generateName, MAX_NAME_LENGTH, NAME_NOUNS, NAME_PREFIXES, NAME_SUFFIXES, NAMING_MODEL } from '../src/core/names';
import { commandEnvelope, createRuntime, decodeRuntime, executeCommand } from '../src/core/runtime';
import { decodeSave } from '../src/core/save';
import type { World } from '../src/core/types';
import { TICKS_PER_GAME_DAY } from '../src/core/water';
import { applyCommand, createWorld, type Command } from '../src/core/world';

const NOW = '2026-09-15T12:00:00.000Z';
const DAY = TICKS_PER_GAME_DAY;
const NUMBERED = /^(Fry|Newcomer) \d+$/;
const cross: Command = { type: 'breed', motherId: 'FSH-000001', fatherId: 'FSH-000002', tankId: 'tank-2', timestamp: NOW, genomeVersion: 2 };
const pair: Command = { type: 'pair', motherId: 'FSH-000003', fatherId: 'FSH-000004', nurseryId: 'tank-2', size: 20, timestamp: NOW, genomeVersion: 2 };
const names = (world: World) => world.fish.map(member => member.name);
/** A world v7 saved before naming model 2: no naming field, so it decodes as model 1. */
function beforeNaming(world: World) {
  const { naming, ...rest } = world;
  void naming;
  return rest;
}

describe('ADR-055 generated fish names', () => {
  it('draws from large pools of unique, single-line parts', () => {
    expect(NAME_PREFIXES.length).toBeGreaterThanOrEqual(200);
    expect(NAME_NOUNS.length).toBeGreaterThanOrEqual(500);
    expect(NAME_SUFFIXES.length).toBeGreaterThanOrEqual(200);
    for (const pool of [NAME_PREFIXES, NAME_NOUNS, NAME_SUFFIXES]) {
      expect(new Set(pool).size).toBe(pool.length);
      for (const part of pool) expect(part).toMatch(/^\S+( \S+)*$/);
    }
    for (const part of [...NAME_PREFIXES, ...NAME_NOUNS]) expect(part).not.toContain(' ');
  });

  it('gives readable one-, two- and three-part names that are deterministic and avoid names in use', () => {
    expect(generateName('seed:fish:1')).toBe(generateName('seed:fish:1'));
    const taken = new Set<string>();
    let single = 0, prefixed = 0;
    for (let i = 0; i < 10_000; i++) {
      const name = generateName(`481516:fish:${i}`, taken);
      expect(taken.has(name)).toBe(false);
      expect(name.length).toBeLessThanOrEqual(MAX_NAME_LENGTH);
      const words = name.toLowerCase().split(' ');
      expect(new Set(words).size).toBe(words.length);
      taken.add(name);
      if (NAME_NOUNS.includes(name)) single++;
      if (NAME_PREFIXES.some(prefix => name.startsWith(`${prefix} `))) prefixed++;
    }
    expect(taken.size).toBe(10_000);
    // Single nouns are a limited set, so draws that land on a used one reroll into longer names.
    expect(single).toBeGreaterThan(400);
    expect(prefixed).toBeGreaterThan(3_000);
    // Without avoidance, multi-part names still almost never repeat.
    const multi = Array.from({ length: 10_000 }, (_, i) => generateName(`7:fish:${i}`)).filter(name => !NAME_NOUNS.includes(name));
    expect(new Set(multi).size).toBeGreaterThan(multi.length * 0.99);
  });

  it('names new worlds, shop deliveries, lab crosses, bought stock and clutch eggs, keeping them distinct', () => {
    const world = createWorld(NOW);
    expect(world.naming).toBe(NAMING_MODEL);
    const listed = world.shop.listings.map(listing => listing.name);
    expect(new Set(listed).size).toBe(listed.length);

    let next = applyCommand(world, cross);
    next = applyCommand(next, { type: 'buy', tankId: 'tank-1', timestamp: NOW, genomeVersion: 2 });
    // Buying a listing empties a place, so the day-3 delivery names a new specimen.
    next = applyCommand(next, { type: 'buy-listing', listingId: world.shop.listings[0].id, tankId: 'tank-1', timestamp: NOW });
    next = applyCommand(next, pair);
    let tick = 0;
    for (let day = 0; day < 10 && next.clutches[0].stage === 'courting'; day++) { next = advanceWorld(next, tick, tick + DAY); tick += DAY; }
    next = advanceWorld(next, tick, tick + 6 * DAY);
    expect(next.clutches[0].stage).not.toBe('courting');
    expect(next.fish.length).toBe(6 + 20 + 1 + 1 + 20);
    expect(next.shop.nextListing).toBeGreaterThan(world.shop.nextListing);

    const born = names(next).slice(6);
    for (const name of born) expect(name).not.toMatch(NUMBERED);
    const everyName = [...names(next), ...next.shop.listings.map(listing => listing.name)];
    expect(new Set(everyName).size).toBe(everyName.length);
    expect(decodeSave(JSON.stringify(next))).toEqual(next);
  });

  it('replays older world v7 journals with numbered names, then names later fish under the current model', () => {
    const legacy = { ...createWorld(NOW), naming: 1 as const };
    let runtime = createRuntime(legacy, 'adr055-legacy');
    runtime = executeCommand(runtime, commandEnvelope(runtime, cross, 10));
    expect(names(runtime.world).slice(6)).toEqual(Array.from({ length: 20 }, (_, i) => `Fry ${i + 7}`));

    const stored = JSON.parse(JSON.stringify(runtime));
    stored.world = beforeNaming(stored.world);
    stored.checkpoint.world = beforeNaming(stored.checkpoint.world);
    const decoded = decodeRuntime(JSON.stringify(stored));
    expect(names(decoded.world)).toEqual(names(runtime.world));
    expect([decoded.world.naming, decoded.checkpoint.world.naming, decoded.events.length]).toEqual([NAMING_MODEL, NAMING_MODEL, 0]);

    const after = executeCommand(decoded, commandEnvelope(decoded, { ...cross, tankId: 'tank-1' }, 20));
    for (const name of names(after.world).slice(26)) expect(name).not.toMatch(NUMBERED);
    expect(decodeRuntime(JSON.stringify(after))).toEqual(after);
  });
});
