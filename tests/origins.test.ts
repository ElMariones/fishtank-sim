import { describe, expect, it } from 'vitest';
import { founderGenome, inherit } from '../src/core/genetics';
import { advanceWorld } from '../src/core/habitat';
import { childOrigins, emptyTrace, mutationNotebook, originId, parseOriginId, reconstructOrigins, type InheritanceTrace } from '../src/core/origins';
import { random } from '../src/core/random';
import { advanceRuntime, commandEnvelope, createRuntime, decodeRuntime, executeCommand } from '../src/core/runtime';
import { decodeSave } from '../src/core/save';
import type { Fish, World } from '../src/core/types';
import { TICKS_PER_GAME_DAY } from '../src/core/water';
import { applyCommand, createWorld, WORLD_VERSION, type Command } from '../src/core/world';

const NOW = '2026-09-17T12:00:00.000Z';

/** A lineage bred with instant crosses from the six founders: every generation crosses random living adults. */
function breedLineage(generations: number, seed = 603): World {
  const rng = random(seed);
  let world = createWorld(NOW, 603_000 + seed);
  for (let g = 0; g < generations; g++) {
    const living = world.fish.filter(f => f.status === 'living');
    const pick = (sex: Fish['sex']) => { const pool = living.filter(f => f.sex === sex); return pool[Math.floor(rng() * pool.length)]; };
    for (let cross = 0; cross < 2; cross++) {
      const tank = world.tanks.find(t => world.fish.filter(f => f.status === 'living' && f.tankId === t.id).length <= t.capacity - 20);
      if (!tank) break;
      world = applyCommand(world, { type: 'breed', motherId: pick('F').id, fatherId: pick('M').id, tankId: tank.id, timestamp: NOW, genomeVersion: 3 });
    }
    // Keep the population bounded: rehome all but a random 30 hatched fish, then let the eggs hatch.
    world = advanceWorld(world, g * 5 * TICKS_PER_GAME_DAY, (g + 1) * 5 * TICKS_PER_GAME_DAY);
    const hatched = world.fish.filter(f => f.status === 'living' && f.life.lengthCm > 0);
    const keep = new Set([...hatched].sort(() => rng() - 0.5).slice(0, 30).map(f => f.id));
    const leave = hatched.filter(f => !keep.has(f.id)).map(f => f.id);
    if (leave.length) world = applyCommand(world, { type: 'rehome-batch', fishIds: leave });
  }
  return world;
}

function isDescendant(world: World, fish: Fish, ancestorId: string): boolean {
  const byId = new Map(world.fish.map(f => [f.id, f]));
  const stack = [fish];
  while (stack.length) {
    const current = stack.pop()!;
    if (current.id === ancestorId) return true;
    if (current.parents) for (const parent of current.parents) stack.push(byId.get(parent)!);
  }
  return false;
}

describe('FS-603 mutation origins', () => {
  it('records the transmitted homologs without changing any birth', () => {
    const rng = random(6031);
    for (let trial = 0; trial < 200; trial++) {
      const mother = founderGenome(Math.floor(rng() * 1e9), 3), father = founderGenome(Math.floor(rng() * 1e9), trial % 2 ? 3 : 2), seed = Math.floor(rng() * 4e9);
      const trace = emptyTrace(), traced = inherit(mother, father, seed, 0.05, 3, trace);
      expect(traced).toEqual(inherit(mother, father, seed, 0.05, 3));
      expect([trace.maternal.length, trace.paternal.length]).toEqual([66, 66]);
      for (const [copy, parent] of [['maternal', mother], ['paternal', father]] as const) {
        trace[copy].forEach((side, locus) => {
          if (traced.mutations.some(m => m.locus === locus && m.copy === copy) || locus >= parent.maternal.length) return;
          expect(traced.genome[copy][locus]).toBe((side === 0 ? parent.maternal : parent.paternal)[locus]);
        });
      }
    }
    expect(originId('FSH-000123', 60, 'paternal')).toBe('FSH-000123/60p');
    expect(parseOriginId('FSH-000123/60p')).toEqual({ fishId: 'FSH-000123', locus: 60, copy: 'paternal' });
    expect(parseOriginId('FSH-1/60x')).toBeNull();
  });

  it('passes an origin only through the homolog that carries it, and a new mutation replaces it', () => {
    // The mother carries a paired-fan origin on her paternal copy only; both her copies otherwise match the father.
    const mother: Pick<Fish, 'origins'> = { origins: [{ locus: 60, copy: 'paternal', id: 'FSH-000010/60p' }] }, father: Pick<Fish, 'origins'> = { origins: [] };
    const trace: InheritanceTrace = { maternal: Array(66).fill(0), paternal: Array(66).fill(1) };
    expect(childOrigins('FSH-000020', mother, father, trace, [])).toEqual([]);
    trace.maternal[60] = 1;
    expect(childOrigins('FSH-000020', mother, father, trace, [])).toEqual([{ locus: 60, copy: 'maternal', id: 'FSH-000010/60p' }]);
    expect(childOrigins('FSH-000020', mother, father, trace, [{ locus: 60, copy: 'maternal', from: 1, to: 0 }])).toEqual([{ locus: 60, copy: 'maternal', id: 'FSH-000020/60m' }]);
  });

  it('keeps every origin identical by descent across a bred lineage, clutches included', () => {
    let world = breedLineage(12);
    // A normal clutch spawns through the same origin rules.
    const adults = world.fish.filter(f => f.status === 'living' && f.life.lengthCm > 0);
    const mother = adults.find(f => f.sex === 'F')!, father = adults.find(f => f.sex === 'M' && f.tankId === mother.tankId) ?? adults.find(f => f.sex === 'M')!;
    if (father.tankId !== mother.tankId) world = applyCommand(world, { type: 'move', fishId: father.id, tankId: mother.tankId });
    const clutchCommand: Command = { type: 'pair', motherId: mother.id, fatherId: father.id, nurseryId: mother.tankId, size: 8, timestamp: NOW, genomeVersion: 3 };
    try { world = applyCommand(world, clutchCommand); world = advanceWorld(world, 100 * TICKS_PER_GAME_DAY, 140 * TICKS_PER_GAME_DAY); } catch { /* Not every seeded pair is ready; crosses already cover births. */ }

    const byId = new Map(world.fish.map(f => [f.id, f]));
    let inherited = 0, own = 0;
    for (const fish of world.fish) {
      for (const origin of fish.origins) {
        const parsed = parseOriginId(origin.id)!, first = byId.get(parsed.fishId)!, mutation = first.mutations.find(m => m.locus === parsed.locus && m.copy === parsed.copy)!;
        expect(fish.genome[origin.copy][origin.locus]).toBe(mutation.to);
        expect(isDescendant(world, fish, first.id)).toBe(true);
        if (first.id === fish.id) own++; else inherited++;
      }
      for (const mutation of fish.mutations) expect(fish.origins).toContainEqual({ locus: mutation.locus, copy: mutation.copy, id: originId(fish.id, mutation.locus, mutation.copy) });
    }
    expect(own).toBeGreaterThan(20);
    expect(inherited).toBeGreaterThan(own);
    expect(decodeSave(JSON.stringify(world))).toEqual(world);

    // Carrier counts equal a brute-force count over every record.
    const notebook = mutationNotebook(world);
    expect([notebook.records, notebook.living]).toEqual([world.fish.length, world.fish.filter(f => f.status === 'living').length]);
    for (const entry of notebook.origins) {
      const carriers = world.fish.filter(f => f.origins.some(o => o.id === entry.id));
      const living = carriers.filter(f => f.status === 'living');
      expect([entry.records, entry.living, entry.homozygous]).toEqual([carriers.length, living.length, living.filter(f => f.origins.filter(o => o.id === entry.id).length === 2).length]);
      expect(entry.change.startsWith(`A${entry.from} → A${entry.to}`)).toBe(true);
    }
    expect(notebook.origins.some(entry => entry.living > 1)).toBe(true);
    expect(notebook.origins.map(entry => entry.living)).toEqual([...notebook.origins.map(entry => entry.living)].sort((a, b) => b - a));
  });

  it('rejects origins that disagree with the recorded mutations or alleles', () => {
    const world = breedLineage(6, 17), carrier = world.fish.find(f => f.origins.some(o => !o.id.startsWith(f.id)))!;
    expect(carrier).toBeDefined();
    const tamper = (change: (copy: World, fish: Fish) => void) => { const copy = structuredClone(world); change(copy, copy.fish.find(f => f.id === carrier.id)!); return () => decodeSave(JSON.stringify(copy)); };
    expect(tamper((_, fish) => { fish.origins[0].id = 'FSH-000001/5m'; })).toThrow('names no recorded mutation');
    expect(tamper((_, fish) => { const o = fish.origins.find(x => !x.id.startsWith(fish.id))!; fish.genome[o.copy][o.locus] = (fish.genome[o.copy][o.locus] + 1) % 2; })).toThrow();
    expect(tamper((_, fish) => { fish.origins.push({ ...fish.origins[0] }); })).toThrow('Invalid mutation origin');
    const founder = world.fish.find(f => !f.parents)!;
    expect(tamper(copy => { copy.fish.find(f => f.id === founder.id)!.origins = [...carrier.origins]; })).toThrow();
    const mutant = world.fish.find(f => f.mutations.length)!;
    expect(tamper(copy => { copy.fish.find(f => f.id === mutant.id)!.origins = []; })).toThrow('missing its origin');
  });

  it('migrates world v10 saves by tracing origins where the transmitted copy is certain, and rebases runtimes', () => {
    const world = breedLineage(10, 29);
    const stripped = { ...world, version: 10, fish: world.fish.map(({ origins: _origins, ...rest }) => rest) };
    const migrated = decodeSave(JSON.stringify(stripped));
    const rebuilt = new Map(migrated.fish.map(f => [f.id, f.origins]));
    let traced = 0, recovered = 0;
    for (const fish of world.fish) {
      const found = rebuilt.get(fish.id)!;
      // Rebuilt origins never invent descent: each is one the traced world recorded.
      for (const origin of found) expect(fish.origins).toContainEqual(origin);
      traced += fish.origins.length; recovered += found.length;
    }
    expect(recovered / traced).toBeGreaterThan(0.6);
    // Ambiguous transmissions are counted; the rest of the gap is descent below an untraced ancestor.
    const { untraced } = reconstructOrigins(stripped.fish);
    expect(untraced).toBeGreaterThan(0);
    expect(untraced).toBeLessThanOrEqual(traced - recovered);
    expect(Object.keys(migrated.fish[0])).toEqual(Object.keys(decodeSave(JSON.stringify(world)).fish[0]));

    let runtime = createRuntime(createWorld(NOW, 29), 'fs603-v10');
    runtime = executeCommand(runtime, commandEnvelope(runtime, { type: 'breed', motherId: 'FSH-000001', fatherId: 'FSH-000002', tankId: 'tank-2', timestamp: NOW, genomeVersion: 3 }, 50));
    runtime = executeCommand(runtime, commandEnvelope(runtime, { type: 'breed', motherId: 'FSH-000003', fatherId: 'FSH-000004', tankId: 'tank-2', timestamp: NOW, genomeVersion: 3 }, 60));
    runtime = advanceRuntime(runtime, 6 * TICKS_PER_GAME_DAY);
    const stored = JSON.parse(JSON.stringify(runtime));
    for (const slot of [stored.world, stored.checkpoint.world]) { slot.version = 10; for (const fish of slot.fish) delete fish.origins; }
    const decoded = decodeRuntime(JSON.stringify(stored));
    expect(decoded.world.version).toBe(WORLD_VERSION);
    expect(decoded.world.fish.map(f => f.genome)).toEqual(runtime.world.fish.map(f => f.genome));
    expect(decoded.events).toHaveLength(0);
    expect(decodeRuntime(JSON.stringify(decoded))).toEqual(decoded);
  });
});
