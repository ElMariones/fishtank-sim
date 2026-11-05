import { describe, expect, it } from 'vitest';
import { GENOME_VERSION } from '../src/core/catalog';
import {
  applyEdits, dosesFor, EXTRACT_COST, germlineFish, MAX_CASSETTES, MIN_INTEGRITY, SPLICE_COST, spliceProblem,
} from '../src/core/geneLab';
import { metabolicPotential, modulesOf } from '../src/core/genetics';
import { SEX_LOCUS } from '../src/core/guppyCatalog';
import { commandEnvelope, createRuntime, decodeRuntime, executeCommand } from '../src/core/runtime';
import { decodeSave } from '../src/core/save';
import type { Fish, World } from '../src/core/types';
import { applyCommand, createWorld, type Command } from '../src/core/world';

const NOW = '2026-11-05T12:00:00.000Z';
const roundTrip = (world: World) => decodeSave(JSON.stringify(world));
const live = () => createWorld(NOW, 271828, GENOME_VERSION);
const adults = (world: World): World => ({ ...world, fish: world.fish.map(f => f.parents ? { ...f, life: { ...world.fish[0].life, lengthCm: metabolicPotential(f.genome).adultLengthCm } } : f) });
const females = (world: World) => world.fish.filter(f => f.status === 'living' && f.sex === 'F' && f.species === 'koi');
const males = (world: World) => world.fish.filter(f => f.status === 'living' && f.sex === 'M' && f.species === 'koi');

/** A donor copy whose allele the recipient carries on neither homolog. */
function differingLocus(donor: Fish, recipient: Fish): number {
  for (let locus = 0; locus < donor.genome.maternal.length; locus++) {
    const allele = donor.genome.maternal[locus];
    if (allele !== recipient.genome.maternal[locus] && allele !== recipient.genome.paternal[locus]) return locus;
  }
  throw new Error('no differing locus');
}

function bred(world: World, mother: Fish, father: Fish, count = 24) {
  const next = applyCommand(world, { type: 'breed', motherId: mother.id, fatherId: father.id, tankId: 'tank-2', timestamp: NOW, genomeVersion: GENOME_VERSION, count });
  return { world: next, children: next.fish.filter(f => f.parents?.[0] === mother.id && f.parents[1] === father.id && !world.fish.some(old => old.id === f.id)) };
}

describe('Genome Editor (world v21)', () => {
  it('extracts a cassette, charges the digest and keeps the donor unchanged', () => {
    const world = live(), donor = males(world)[0], before = JSON.stringify(donor);
    const next = applyCommand(world, { type: 'extract-gene', fishId: donor.id, locus: 7, copy: 'paternal', integrity: 90 });
    const [cassette] = next.geneLab.cassettes;
    expect(cassette).toMatchObject({ id: 'GC-000001', species: 'koi', locus: 7, allele: donor.genome.paternal[7], donorId: donor.id, donorCopy: 'paternal', integrity: 90, doses: 3 });
    expect(next.credits).toBe(world.credits - EXTRACT_COST);
    expect(next.ledger.entries.at(-1)).toMatchObject({ reason: 'research', amount: -EXTRACT_COST });
    expect(JSON.stringify(next.fish.find(f => f.id === donor.id))).toBe(before);
    expect(roundTrip(next)).toEqual(next);
    expect([dosesFor(30), dosesFor(60), dosesFor(85)]).toEqual([1, 2, 3]);
  });

  it('rejects a damaged sample, a full vault and the guppy sex locus without changing anything', () => {
    let world = live();
    const donor = males(world)[0], frozen = JSON.stringify(world);
    expect(() => applyCommand(world, { type: 'extract-gene', fishId: donor.id, locus: 3, copy: 'maternal', integrity: MIN_INTEGRITY - 1 })).toThrow(/too damaged/);
    expect(JSON.stringify(world)).toBe(frozen);
    for (let i = 0; i < MAX_CASSETTES; i++) world = applyCommand(world, { type: 'extract-gene', fishId: donor.id, locus: i, copy: 'maternal', integrity: 50 });
    expect(() => applyCommand(world, { type: 'extract-gene', fishId: donor.id, locus: 20, copy: 'maternal', integrity: 50 })).toThrow(/vault holds/);
    let guppies = applyCommand(live(), { type: 'buy', tankId: 'tank-1', timestamp: NOW, species: 'guppy', genomeVersion: GENOME_VERSION });
    guppies = applyCommand(guppies, { type: 'buy', tankId: 'tank-1', timestamp: NOW, species: 'guppy', genomeVersion: GENOME_VERSION });
    const guppy = guppies.fish.find(f => f.species === 'guppy')!;
    expect(() => applyCommand(guppies, { type: 'extract-gene', fishId: guppy.id, locus: SEX_LOCUS, copy: 'paternal', integrity: 90 })).toThrow(/sex locus/);
  });

  it('splices both copies so every child inherits the allele, while the parent genome stays as born', () => {
    let world = live();
    const mother = females(world)[0], father = males(world)[0], donor = males(world)[1];
    const locus = differingLocus(donor, mother), allele = donor.genome.maternal[locus];
    world = applyCommand(world, { type: 'extract-gene', fishId: donor.id, locus, copy: 'maternal', integrity: 88 });
    const id = world.geneLab.cassettes[0].id;
    expect(() => applyCommand(world, { type: 'splice-gene', cassetteId: id, fishId: mother.id, copies: 'both', fidelity: 60 })).toThrow(/fidelity of 70/);
    const credits = world.credits;
    world = applyCommand(world, { type: 'splice-gene', cassetteId: id, fishId: mother.id, copies: 'both', fidelity: 82 });
    expect(world.credits).toBe(credits - 2 * SPLICE_COST);
    expect(world.geneLab.cassettes[0].doses).toBe(1);
    expect(world.geneLab.edits).toHaveLength(2);
    expect(world.fish.find(f => f.id === mother.id)!.genome).toEqual(mother.genome);
    const germ = germlineFish(world, world.fish.find(f => f.id === mother.id)!);
    expect([germ.genome.maternal[locus], germ.genome.paternal[locus]]).toEqual([allele, allele]);
    expect(roundTrip(world)).toEqual(world);
    const { world: after, children } = bred(world, mother, father);
    expect(children.length).toBeGreaterThan(15);
    expect(children.filter(child => child.genome.maternal[locus] === allele).length).toBeGreaterThanOrEqual(children.length - 1);
    expect(roundTrip(after)).toEqual(after);
  });

  it('a single edited copy reaches about half of the offspring, and restoring it stops transmission', () => {
    let world = live();
    const mother = females(world)[0], father = males(world)[0], donor = males(world)[1];
    const locus = differingLocus(donor, mother), allele = donor.genome.maternal[locus];
    world = applyCommand(world, { type: 'extract-gene', fishId: donor.id, locus, copy: 'maternal', integrity: 95 });
    world = applyCommand(world, { type: 'splice-gene', cassetteId: 'GC-000001', fishId: mother.id, copies: 'paternal', fidelity: 55 });
    const carriers = bred(world, mother, father).children.filter(child => child.genome.maternal[locus] === allele).length;
    expect(carriers).toBeGreaterThan(4);
    expect(carriers).toBeLessThan(20);
    world = applyCommand(world, { type: 'restore-germline', fishId: mother.id, locus, copy: 'paternal' });
    expect(world.geneLab.edits).toEqual([]);
    expect(bred(world, mother, father).children.some(child => child.genome.maternal[locus] === allele)).toBe(false);
  });

  it('refuses another species, an egg and a copy that already carries the allele', () => {
    let world = live();
    const donor = males(world)[0], koi = females(world)[0];
    world = applyCommand(world, { type: 'buy', tankId: 'tank-1', timestamp: NOW, species: 'goldfish', genomeVersion: GENOME_VERSION });
    world = applyCommand(world, { type: 'extract-gene', fishId: donor.id, locus: 2, copy: 'maternal', integrity: 70 });
    const cassette = world.geneLab.cassettes[0], goldfish = world.fish.find(f => f.species === 'goldfish')!;
    expect(spliceProblem(world, cassette, goldfish, 'maternal')).toMatch(/only splices into a koi/);
    expect(spliceProblem(world, cassette, donor, 'maternal')).toMatch(/already carries/);
    const { world: withEggs, children } = bred(world, koi, donor, 2);
    expect(spliceProblem(withEggs, cassette, children[0], 'maternal')).toMatch(/Eggs/);
  });

  it('carries a mutation origin with the spliced allele into another lineage', () => {
    let world = live();
    const [mother, other] = females(world), [father] = males(world);
    let source: Fish | undefined;
    for (let round = 0; round < 6 && !source; round++) {
      const result = bred(world, mother, father);
      world = adults(result.world);
      source = world.fish.find(f => f.status === 'living' && f.origins.some(o => o.id.startsWith(f.id)));
    }
    expect(source).toBeDefined();
    const origin = source!.origins.find(o => o.id.startsWith(source!.id))!;
    const allele = source!.genome[origin.copy][origin.locus];
    world = applyCommand(world, { type: 'extract-gene', fishId: source!.id, locus: origin.locus, copy: origin.copy, integrity: 90 });
    expect(world.geneLab.cassettes[0].origin).toBe(origin.id);
    // A female from another lineage that carries the allele on neither copy.
    const recipient = world.fish.find(f => f.status === 'living' && f.species === 'koi' && f.sex === 'F' && !f.parents && f.genome.maternal[origin.locus] !== allele && f.genome.paternal[origin.locus] !== allele)
      ?? (() => { throw new Error('no recipient for this seed'); })();
    expect(recipient.id === other.id || recipient.id === mother.id).toBe(true);
    world = applyCommand(world, { type: 'splice-gene', cassetteId: 'GC-000001', fishId: recipient.id, copies: 'both', fidelity: 90 });
    const { world: after, children } = bred(world, recipient, father);
    const carrying = children.filter(child => child.genome.maternal[origin.locus] === allele);
    expect(carrying.length).toBeGreaterThan(0);
    expect(carrying.every(child => child.origins.some(o => o.id === origin.id && o.copy === 'maternal'))).toBe(true);
    expect(roundTrip(after)).toEqual(after);
  });

  it('pins latent genotypes to the unedited genome', () => {
    const world = createWorld(NOW, 99, 3), fish = world.fish[0];
    const edited = applyEdits(fish.genome, [{ locus: 0, copy: 'maternal', allele: (fish.genome.maternal[0] + 1) % 3, novel: null }]);
    expect(edited.maternal[0]).not.toBe(fish.genome.maternal[0]);
    expect(modulesOf(edited)).toEqual(modulesOf(fish.genome));
  });

  it('replays editor commands from the journal', () => {
    let runtime = createRuntime(live(), 'editor-world');
    const mother = females(runtime.world)[0], donor = males(runtime.world)[1], locus = differingLocus(donor, mother);
    const commands: Command[] = [
      { type: 'extract-gene', fishId: donor.id, locus, copy: 'maternal', integrity: 77 },
      { type: 'label-cassette', cassetteId: 'GC-000001', label: 'Bright scales' },
      { type: 'splice-gene', cassetteId: 'GC-000001', fishId: mother.id, copies: 'maternal', fidelity: 64 },
      { type: 'extract-gene', fishId: donor.id, locus: 1, copy: 'paternal', integrity: 40 },
      { type: 'discard-cassette', cassetteId: 'GC-000002' },
    ];
    for (const command of commands) runtime = executeCommand(runtime, commandEnvelope(runtime, command));
    expect(runtime.world.geneLab.cassettes.map(c => [c.id, c.label, c.doses])).toEqual([['GC-000001', 'Bright scales', 1]]);
    expect(decodeRuntime(JSON.stringify(runtime))).toEqual(runtime);
  });

  it('migrates a world v20 save with an empty vault', () => {
    const world = live(), { geneLab: _lab, ...old } = world;
    const migrated = decodeSave(JSON.stringify({ ...old, version: 20 }));
    expect(migrated.version).toBe(21);
    expect(migrated.geneLab).toEqual({ model: 1, nextCassette: 1, cassettes: [], edits: [] });
  });
});
