import { describe, expect, it } from 'vitest';
import { AXOLOTL_LOCI, AXOLOTL_LOCUS_INDEX } from '../src/core/axolotlCatalog';
import { axolotlFounderGenome, isAxolotlGenome } from '../src/core/axolotlGenetics';
import { newAxolotlName } from '../src/core/axolotlNames';
import { pairingBlockers } from '../src/core/breeding';
import { advanceWorld } from '../src/core/habitat';
import { takenNames } from '../src/core/names';
import { originId } from '../src/core/origins';
import { hash } from '../src/core/random';
import { commandEnvelope, createRuntime, decodeRuntime, executeCommand } from '../src/core/runtime';
import { decodeSave } from '../src/core/save';
import type { World } from '../src/core/types';
import { TICKS_PER_GAME_DAY } from '../src/core/water';
import { applyCommand, createWorld, MAX_LIVING, MAX_RECORDS, STOCK_PRICE, WORLD_VERSION, type Command } from '../src/core/world';
import { createBehaviorWorld, stepBehavior } from '../src/simulation/behavior';

const NOW = '2026-09-18T12:00:00.000Z';
const DAY = TICKS_PER_GAME_DAY;
const limits = { maxLiving: MAX_LIVING, maxRecords: MAX_RECORDS };
const buyAxolotl = (tankId = 'tank-1'): Command => ({ type: 'buy', species: 'axolotl', tankId, timestamp: NOW });

function withAxolotlPair(tankId = 'tank-1'): World {
  return applyCommand(applyCommand(createWorld(NOW), buyAxolotl(tankId)), buyAxolotl(tankId));
}

function axolotlPair(world: World) {
  const axolotls = world.fish.filter(fish => fish.species === 'axolotl');
  return {
    mother: axolotls.find(fish => fish.sex === 'F')!,
    father: axolotls.find(fish => fish.sex === 'M')!,
  };
}

describe('axolotl release integration', () => {
  it('purchases an axolotl founder with a deterministic independent genome and name', () => {
    const before = createWorld(NOW), nextId = before.nextId, sex = nextId % 2 === 0 ? 'F' : 'M';
    const birthSeed = hash(`${before.seed}:axolotl-founder:${nextId}`);
    const genome = axolotlFounderGenome(birthSeed);
    const expectedName = newAxolotlName(`${before.seed}:fish:${nextId}`, sex, genome, takenNames(before));

    const bought = applyCommand(before, buyAxolotl('tank-1'));
    const founder = bought.fish.at(-1)!;
    expect(founder).toMatchObject({
      id: 'FSH-000007', species: 'axolotl', sex, name: expectedName, birthSeed,
      generation: 0, parents: null, tankId: 'tank-1', status: 'living', mutations: [], origins: [],
    });
    expect(founder.genome).toEqual(genome);
    expect(isAxolotlGenome(founder.genome)).toBe(true);
    expect(bought.credits).toBe(before.credits - STOCK_PRICE);

    const replayed = applyCommand(createWorld(NOW), buyAxolotl('tank-1')).fish.at(-1)!;
    expect(replayed).toEqual(founder);
  });

  it('keeps koi and axolotls together in one tank with deterministic finite simulation', () => {
    const world = applyCommand(createWorld(NOW), buyAxolotl('tank-1'));
    const residents = world.fish.filter(fish => fish.status === 'living' && fish.tankId === 'tank-1');
    expect(new Set(residents.map(fish => fish.species))).toEqual(new Set(['koi', 'axolotl']));

    const run = () => {
      let behavior = createBehaviorWorld(residents, true);
      for (let i = 0; i < 240; i++) behavior = stepBehavior(behavior);
      return behavior;
    };
    const first = run(), second = run();
    expect(second).toEqual(first);
    expect(first.actors).toHaveLength(residents.length);
    expect(new Set(first.actors.map(actor => actor.species))).toEqual(new Set(['koi', 'axolotl']));
    for (const actor of first.actors) {
      expect([actor.x, actor.y, actor.vx, actor.vy, actor.phase, actor.hunger, actor.fear].every(Number.isFinite)).toBe(true);
      expect(actor.x).toBeGreaterThanOrEqual(0.08); expect(actor.x).toBeLessThanOrEqual(0.92);
      expect(actor.y).toBeGreaterThanOrEqual(0.12); expect(actor.y).toBeLessThanOrEqual(0.88);
    }
  });

  it('breeds axolotl parents through the instant lab cross without crossing into koi genetics', () => {
    const world = withAxolotlPair(), { mother, father } = axolotlPair(world);
    const bred = applyCommand(world, { type: 'breed', motherId: mother.id, fatherId: father.id, tankId: 'tank-2', timestamp: NOW });
    const children = bred.fish.slice(world.fish.length);

    expect(children).toHaveLength(20);
    expect(children.every(child => child.species === 'axolotl' && isAxolotlGenome(child.genome))).toBe(true);
    expect(children.every(child => child.parents?.[0] === mother.id && child.parents?.[1] === father.id && child.generation === 1)).toBe(true);
    expect(new Set(children.map(child => child.id)).size).toBe(children.length);
    expect(applyCommand(withAxolotlPair(), { type: 'breed', motherId: mother.id, fatherId: father.id, tankId: 'tank-2', timestamp: NOW }).fish.slice(world.fish.length)).toEqual(children);
  });

  it('rejects cross-species instant and normal pairing atomically in both directions', () => {
    const world = withAxolotlPair(), { mother: axMother, father: axFather } = axolotlPair(world);
    const koiMother = world.fish.find(fish => fish.species === 'koi' && fish.sex === 'F')!;
    const koiFather = world.fish.find(fish => fish.species === 'koi' && fish.sex === 'M')!;
    const before = JSON.stringify(world);

    const crosses = [
      { motherId: koiMother.id, fatherId: axFather.id },
      { motherId: axMother.id, fatherId: koiFather.id },
    ];
    for (const cross of crosses) {
      expect(() => applyCommand(world, { type: 'breed', ...cross, tankId: 'tank-2', timestamp: NOW })).toThrow(/cannot breed|same species/i);
      const request = { ...cross, nurseryId: 'tank-2', size: 8 as const };
      expect(pairingBlockers(world, request, limits).map(blocker => blocker.code)).toContain('species');
      expect(() => applyCommand(world, { type: 'pair', ...request, timestamp: NOW, genomeVersion: 3 })).toThrow(/same species|only members/i);
      expect(JSON.stringify(world)).toBe(before);
    }
  });

  it('runs normal axolotl courtship through spawning and preserves species on the clutch and eggs', () => {
    let world = withAxolotlPair(), { mother, father } = axolotlPair(world);
    world = applyCommand(world, { type: 'pair', motherId: mother.id, fatherId: father.id, nurseryId: 'tank-2', size: 8, timestamp: NOW, genomeVersion: 3 });
    expect(world.clutches[0]).toMatchObject({ species: 'axolotl', motherId: mother.id, fatherId: father.id, stage: 'courting' });

    let tick = 0;
    for (let day = 0; day < 8 && world.clutches[0].stage === 'courting'; day++) {
      world = advanceWorld(world, tick, tick + DAY); tick += DAY;
    }
    const clutch = world.clutches[0];
    expect(clutch.stage).toBe('incubating');
    expect(clutch.firstFishId).not.toBeNull();
    const first = Number(clutch.firstFishId!.slice(4));
    const eggs = world.fish.filter(fish => {
      const n = Number(fish.id.slice(4));
      return n >= first && n < first + clutch.size;
    });
    expect(eggs).toHaveLength(8);
    expect(eggs.every(egg => egg.species === 'axolotl' && isAxolotlGenome(egg.genome))).toBe(true);
    expect(eggs.every(egg => egg.parents?.[0] === mother.id && egg.parents?.[1] === father.id)).toBe(true);
  });

  it('round-trips a v13 world containing axolotls without reinterpretation', () => {
    const world = withAxolotlPair();
    expect(world.version).toBe(WORLD_VERSION);
    const decoded = decodeSave(JSON.stringify(world));
    expect(decoded).toEqual(world);
    expect(decodeSave(JSON.stringify(decoded))).toEqual(decoded);
    expect(decoded.fish.filter(fish => fish.species === 'axolotl').every(fish => isAxolotlGenome(fish.genome))).toBe(true);
  });

  it('preserves axolotl mutation locus IDs without adding mutation metadata to koi', () => {
    const axWorld = applyCommand(createWorld(NOW), buyAxolotl('tank-1'));
    const ax = axWorld.fish.at(-1)!;
    expect(isAxolotlGenome(ax.genome)).toBe(true);
    const axLocus = AXOLOTL_LOCUS_INDEX.axo_pattern_mode, copy = 'maternal' as const;
    const axFrom = ax.genome[copy][axLocus], axTo = axFrom === 5 ? 4 : axFrom + 1;
    ax.genome[copy][axLocus] = axTo;
    ax.mutations = [{ locus: axLocus, locusId: AXOLOTL_LOCI[axLocus], copy, from: axFrom, to: axTo }];
    ax.origins = [{ locus: axLocus, copy, id: originId(ax.id, axLocus, copy) }];

    const decodedAx = decodeSave(JSON.stringify(axWorld));
    expect(decodedAx.fish.at(-1)!.mutations).toEqual(ax.mutations);
    const wrongAxId = structuredClone(axWorld);
    wrongAxId.fish.at(-1)!.mutations[0].locusId = AXOLOTL_LOCI[(axLocus + 1) % AXOLOTL_LOCI.length];
    expect(() => decodeSave(JSON.stringify(wrongAxId))).toThrow(/mutation locus ID/i);

    const koiWorld = createWorld(NOW), koi = koiWorld.fish[0], koiLocus = 24;
    const koiFrom = koi.genome[copy][koiLocus], koiTo = koiFrom === 5 ? 4 : koiFrom + 1;
    koi.genome[copy][koiLocus] = koiTo;
    koi.mutations = [{ locus: koiLocus, copy, from: koiFrom, to: koiTo }];
    koi.origins = [{ locus: koiLocus, copy, id: originId(koi.id, koiLocus, copy) }];
    const koiMutationBytes = JSON.stringify(koi.mutations);
    const decodedKoi = decodeSave(JSON.stringify(koiWorld));
    expect(JSON.stringify(decodedKoi.fish[0].mutations)).toBe(koiMutationBytes);
    expect('locusId' in decodedKoi.fish[0].mutations[0]).toBe(false);
    const mislabeledKoi = structuredClone(koiWorld);
    mislabeledKoi.fish[0].mutations[0].locusId = AXOLOTL_LOCI[0];
    expect(() => decodeSave(JSON.stringify(mislabeledKoi))).toThrow(/Koi mutation record/i);
  });

  it('accepts early-v13 axolotl mutations whose decoder already stripped optional locusId metadata', () => {
    const world = applyCommand(createWorld(NOW), buyAxolotl('tank-1')), ax = world.fish.at(-1)!;
    expect(isAxolotlGenome(ax.genome)).toBe(true);
    const locus = AXOLOTL_LOCUS_INDEX.axo_pattern_mode, copy = 'maternal' as const;
    const from = ax.genome[copy][locus], to = from === 5 ? 4 : from + 1;
    ax.genome[copy][locus] = to;
    ax.mutations = [{ locus, copy, from, to }];
    ax.origins = [{ locus, copy, id: originId(ax.id, locus, copy) }];

    // The v13 schema declares locusId optional. A save that passed through the original stripping
    // decoder can therefore be recovered from its numeric locus; only a present wrong ID is invalid.
    const recovered = decodeSave(JSON.stringify(world));
    expect(recovered.fish.at(-1)!.mutations[0].locusId).toBe(AXOLOTL_LOCI[locus]);
  });

  it('migrates a v12 koi world to the current version by adding koi species without changing genomes or identities', () => {
    const current = createWorld(NOW);
    const legacy = structuredClone(current) as unknown as Record<string, unknown>;
    legacy.version = 12;
    legacy.fish = current.fish.map(({ species: _species, ...fish }) => fish);
    legacy.clutches = current.clutches.map(({ species: _species, ...clutch }) => clutch);

    const migrated = decodeSave(JSON.stringify(legacy));
    expect(migrated.version).toBe(WORLD_VERSION);
    expect(migrated.fish.every(fish => fish.species === 'koi')).toBe(true);
    expect(migrated.fish.map(fish => [fish.id, fish.name, fish.birthSeed, fish.genome, fish.parents, fish.generation, fish.tankId, fish.status]))
      .toEqual(current.fish.map(fish => [fish.id, fish.name, fish.birthSeed, fish.genome, fish.parents, fish.generation, fish.tankId, fish.status]));
  });

  it('rejects v13 saves whose species tag and genome model disagree', () => {
    const koiTaggedAxGenome = structuredClone(applyCommand(createWorld(NOW), buyAxolotl('tank-1')));
    koiTaggedAxGenome.fish.at(-1)!.species = 'koi';
    expect(() => decodeSave(JSON.stringify(koiTaggedAxGenome))).toThrow(/species.*genome|genome.*species/i);

    const axTaggedKoiGenome = structuredClone(createWorld(NOW));
    axTaggedKoiGenome.fish[0].species = 'axolotl';
    expect(() => decodeSave(JSON.stringify(axTaggedKoiGenome))).toThrow(/species.*genome|genome.*species/i);
  });

  it('replays and reloads axolotl purchases and breeding deterministically', () => {
    let runtime = createRuntime(createWorld(NOW), 'axolotl-integration');
    runtime = executeCommand(runtime, commandEnvelope(runtime, buyAxolotl('tank-1'), 10));
    runtime = executeCommand(runtime, commandEnvelope(runtime, buyAxolotl('tank-1'), 20));
    const { mother, father } = axolotlPair(runtime.world);
    runtime = executeCommand(runtime, commandEnvelope(runtime,
      { type: 'breed', motherId: mother.id, fatherId: father.id, tankId: 'tank-2', timestamp: NOW }, 30));

    const restored = decodeRuntime(JSON.stringify(runtime));
    expect(restored).toEqual(runtime);
    expect(restored.world.fish.filter(fish => fish.species === 'axolotl').every(fish => isAxolotlGenome(fish.genome))).toBe(true);
    expect(decodeRuntime(JSON.stringify(restored))).toEqual(restored);
  });
});
