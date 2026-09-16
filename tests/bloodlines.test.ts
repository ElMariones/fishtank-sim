import { describe, expect, it } from 'vitest';
import {
  ancestryContributions, bloodlineSummaries, captureStandard, MAX_BLOODLINES, registrationProblem, standardSimilarity,
} from '../src/core/bloodlines';
import { measureDescriptors, VISUAL_DESCRIPTORS } from '../src/core/descriptors';
import { express, founderGenome, inherit } from '../src/core/genetics';
import { advanceWorld } from '../src/core/habitat';
import { advanceRuntime, commandEnvelope, createRuntime, decodeRuntime, executeCommand } from '../src/core/runtime';
import { decodeSave } from '../src/core/save';
import type { Fish, World } from '../src/core/types';
import { FOUNDER_VISUAL_FIXTURES, structureGenome } from '../src/core/visualFixtures';
import { TICKS_PER_GAME_DAY } from '../src/core/water';
import { applyCommand, createWorld, type Command } from '../src/core/world';

const NOW = '2026-09-17T12:00:00.000Z';
const register = (name: string, foundationIds: string[]): Command => ({ type: 'register-bloodline', name, foundationIds, timestamp: NOW });
const refused = (world: World, command: Command, message: string) => {
  const before = JSON.stringify(world);
  expect(() => applyCommand(world, command)).toThrow(message);
  expect(JSON.stringify(world)).toBe(before);
};
/** Crosses a pair and grows the clutch to adults. */
function cross(world: World, motherId: string, fatherId: string, day: number): { world: World; children: Fish[] } {
  const bred = applyCommand(world, { type: 'breed', motherId, fatherId, tankId: 'tank-2', timestamp: NOW, genomeVersion: 3 });
  const grown = advanceWorld(bred, day * TICKS_PER_GAME_DAY, (day + 40) * TICKS_PER_GAME_DAY);
  const kept = grown.fish.slice(-20).slice(0, 2).map(f => f.id);
  const rehomed = applyCommand(grown, { type: 'rehome-batch', fishIds: grown.fish.slice(-18).map(f => f.id) });
  return { world: rehomed, children: rehomed.fish.filter(f => kept.includes(f.id)) };
}

describe('FS-604 bloodline registry', () => {
  it('computes ancestry contribution from recorded parents only', () => {
    const fish = (id: string, parents: [string, string] | null) => ({ id, parents }) as Fish;
    const records = [
      fish('FSH-000001', null), fish('FSH-000002', null), fish('FSH-000003', null),
      fish('FSH-000004', ['FSH-000001', 'FSH-000002']), // child of a foundation fish: 1/2
      fish('FSH-000005', ['FSH-000004', 'FSH-000001']), // backcross to the foundation: 3/4
      fish('FSH-000006', ['FSH-000004', 'FSH-000003']), // grandchild through an outcross: 1/4
      fish('FSH-000007', ['FSH-000005', 'FSH-000006']), // (3/4 + 1/4) / 2
      fish('FSH-000008', ['FSH-000999', 'FSH-000005']), // unrecorded parent counts as unrelated: 3/8
    ];
    const shares = ancestryContributions({ fish: [...records].reverse() }, { foundationIds: ['FSH-000001'] });
    expect(records.map(f => shares.get(f.id))).toEqual([1, 0, 0, 0.5, 0.75, 0.25, 0.5, 0.375]);
    const two = ancestryContributions({ fish: records }, { foundationIds: ['FSH-000001', 'FSH-000002'] });
    expect([two.get('FSH-000004'), two.get('FSH-000006'), two.get('FSH-000003')]).toEqual([1, 0.5, 0]);
  });

  it('registers a named line atomically with a standard captured from its foundation', () => {
    const world = createWorld(NOW), [haru, sumi, kohaku] = world.fish;
    const lined = applyCommand(world, register('  Garden Gold ', [haru.id, kohaku.id]));
    const line = lined.bloodlines[0];
    expect([line.id, line.name, line.registeredAt, line.foundationIds, lined.nextBloodlineId]).toEqual(['BL-000001', 'Garden Gold', NOW, [haru.id, kohaku.id], 2]);
    for (const { key } of VISUAL_DESCRIPTORS)
      expect(line.standard.descriptors[key]).toBeCloseTo((measureDescriptors(express(haru.genome))[key] + measureDescriptors(express(kohaku.genome))[key]) / 2, 5);
    expect([line.standard.tail, line.standard.dorsal, line.standard.barbels, line.standard.signatureOrigins]).toEqual(['standard', 'normal', 2, []]);
    // A single foundation fish matches its own standard.
    const solo = applyCommand(lined, register('Sumi line', [sumi.id]));
    expect(standardSimilarity(sumi, solo.bloodlines[1].standard).overall).toBeCloseTo(1, 5);
    expect(decodeSave(JSON.stringify(solo))).toEqual(solo);

    refused(lined, register('garden gold', [sumi.id]), 'already registered');
    refused(lined, register(' ', [sumi.id]), '1 to 32 characters');
    refused(lined, register('Nine', world.fish.map(f => f.id).concat(['FSH-000001', 'FSH-000002', 'FSH-000003'])), 'Too big');
    refused(lined, register('Twice', [sumi.id, sumi.id]), 'listed once');
    refused(lined, register('Ghost', ['FSH-000999']), 'no record');
    const eggs = applyCommand(world, { type: 'breed', motherId: haru.id, fatherId: sumi.id, tankId: 'tank-2', timestamp: NOW, genomeVersion: 3 });
    refused(eggs, register('Unhatched', [eggs.fish.at(-1)!.id]), 'Eggs cannot found');
    let full = world;
    for (let i = 0; i < MAX_BLOODLINES; i++) full = applyCommand(full, register(`Line ${i}`, [haru.id]));
    refused(full, register('One more', [haru.id]), `at most ${MAX_BLOODLINES}`);

    const renamed = applyCommand(solo, { type: 'rename-bloodline', bloodlineId: 'BL-000002', name: 'Sumi Silver' });
    expect(renamed.bloodlines[1].name).toBe('Sumi Silver');
    refused(renamed, { type: 'rename-bloodline', bloodlineId: 'BL-000002', name: 'GARDEN GOLD' }, 'already registered');
    refused(renamed, { type: 'rename-bloodline', bloodlineId: 'BL-000009', name: 'Nope' }, 'not found');
    expect(registrationProblem(renamed, 'Fresh', [haru.id])).toBeNull();
  });

  it('keeps ancestry and similarity separate: a lookalike without ancestry, and descendants that drift', () => {
    let world = createWorld(NOW);
    const [haru, sumi, , yuki] = world.fish;
    world = applyCommand(world, register('Haru line', [haru.id]));
    const standard = world.bloodlines[0].standard;
    // An unrelated fish with Haru's genome: full similarity, no ancestry.
    const lookalike: Fish = { ...world.fish[4], id: 'FSH-000007', name: 'Lookalike', genome: structuredClone(haru.genome) };
    const withLookalike: World = { ...world, nextId: 8, fish: [...world.fish, lookalike] };
    expect(ancestryContributions(withLookalike, world.bloodlines[0]).get(lookalike.id)).toBe(0);
    expect(standardSimilarity(lookalike, standard).overall).toBeCloseTo(1, 9);

    // Children and grandchildren through outcrosses keep a known share of ancestry while similarity varies freely.
    let step = cross(world, haru.id, sumi.id, 0);
    world = step.world;
    const daughter = step.children.find(f => f.sex === 'F') ?? step.children[0];
    step = cross(world, daughter.sex === 'F' ? daughter.id : haru.id, yuki.id, 40);
    world = step.world;
    const shares = ancestryContributions(world, world.bloodlines[0]);
    const children = world.fish.filter(f => f.parents?.[0] === haru.id), grandchildren = world.fish.filter(f => f.parents?.[0] === daughter.id);
    expect(children.every(f => shares.get(f.id) === 0.5)).toBe(true);
    if (daughter.sex === 'F') expect(grandchildren.every(f => shares.get(f.id) === 0.25)).toBe(true);
    const similarities = [...children, ...grandchildren].map(f => standardSimilarity(f, standard).overall);
    expect(Math.min(...similarities)).toBeLessThan(1);
    expect(similarities.every(value => value > 0 && value <= 1)).toBe(true);

    const [summary] = bloodlineSummaries(world);
    const members = world.fish.filter(f => f.status === 'living' && (shares.get(f.id) ?? 0) > 0);
    expect([summary.livingMembers, summary.foundationNames]).toEqual([members.length, ['Haru']]);
    expect(summary.closest!.similarity).toBe(Math.max(...members.map(f => standardSimilarity(f, standard).overall)));
    expect(summary.meanContribution).toBeCloseTo(members.reduce((sum, f) => sum + shares.get(f.id)!, 0) / members.length, 12);
  });

  it('scores children closer to a parent standard than unrelated fish, on a calibrated scale', () => {
    let children = 0, unrelated = 0;
    const samples = 150;
    for (let i = 0; i < samples; i++) {
      const mother = founderGenome(i * 11 + 3, 3), father = founderGenome(i * 17 + 7, 3), stranger = founderGenome(i * 19 + 101, 3);
      const standard = captureStandard([{ genome: mother, origins: [] } as unknown as Fish]);
      children += standardSimilarity({ genome: inherit(mother, father, i).genome, origins: [] }, standard).descriptors / samples;
      unrelated += standardSimilarity({ genome: stranger, origins: [] }, standard).descriptors / samples;
    }
    expect(children).toBeGreaterThan(unrelated + 0.1);
    expect([children, unrelated].every(value => value > 0.2 && value < 0.8)).toBe(true);
  });

  it('carries structure and shared mutation origins into the standard', () => {
    const base = FOUNDER_VISUAL_FIXTURES[2].genome, world = createWorld(NOW);
    const paired = (id: string, sex: Fish['sex']): Fish => ({ ...world.fish[0], id, sex, name: id, genome: structureGenome(base, { tail_topology: [1, 1] }) });
    const withOrigin = (fish: Fish): Fish => ({ ...fish, origins: [{ locus: 5, copy: 'maternal', id: 'FSH-000001/5m' }] });
    const standard = captureStandard([withOrigin(paired('FSH-000011', 'F')), withOrigin(paired('FSH-000012', 'M')), world.fish[1]]);
    expect([standard.tail, standard.dorsal, standard.barbels, standard.signatureOrigins]).toEqual(['paired', 'normal', 2, []]);
    const both = captureStandard([withOrigin(paired('FSH-000011', 'F')), withOrigin(paired('FSH-000012', 'M'))]);
    expect(both.signatureOrigins).toEqual(['FSH-000001/5m']);
    const standardTail: Fish = { ...paired('FSH-000013', 'F'), genome: structureGenome(base, {}) };
    const match = standardSimilarity(withOrigin(paired('FSH-000014', 'F')), both), noTail = standardSimilarity(standardTail, both);
    expect([match.structure, match.origins, noTail.structure, noTail.origins]).toEqual([1, 1, 2 / 3, 0]);
    expect(noTail.overall).toBeLessThan(match.overall);
  });

  it('validates, migrates and replays the registry', () => {
    const world = applyCommand(createWorld(NOW), register('Garden Gold', ['FSH-000001', 'FSH-000003']));
    const tamper = (change: (copy: World) => void) => { const copy = structuredClone(world); change(copy); return () => decodeSave(JSON.stringify(copy)); };
    expect(tamper(copy => { copy.nextBloodlineId = 1; })).toThrow('Invalid bloodline');
    expect(tamper(copy => { copy.bloodlines[0].foundationIds = ['FSH-000999']; })).toThrow('Invalid bloodline');
    expect(tamper(copy => { copy.bloodlines.push({ ...copy.bloodlines[0], id: 'BL-000002', name: 'garden gold' }); copy.nextBloodlineId = 3; })).toThrow('Invalid bloodline');
    expect(tamper(copy => { copy.bloodlines[0].standard.descriptors.length = 1.5; })).toThrow();

    const plain = createWorld(NOW), { bloodlines: _lines, nextBloodlineId: _next, ...v11 } = decodeSave(JSON.stringify(plain));
    const migrated = decodeSave(JSON.stringify({ ...v11, version: 11 }));
    expect(migrated).toEqual(decodeSave(JSON.stringify(plain)));
    expect(Object.keys(migrated)).toEqual(Object.keys(decodeSave(JSON.stringify(plain))));

    let runtime = createRuntime(createWorld(NOW), 'fs604');
    runtime = executeCommand(runtime, commandEnvelope(runtime, register('Garden Gold', ['FSH-000001']), 20));
    runtime = executeCommand(runtime, commandEnvelope(runtime, { type: 'rename-bloodline', bloodlineId: 'BL-000001', name: 'Garden Amber' }, 40));
    runtime = advanceRuntime(runtime, 3 * TICKS_PER_GAME_DAY);
    expect(decodeRuntime(JSON.stringify(runtime))).toEqual(runtime);
    const tampered = JSON.parse(JSON.stringify(runtime));
    tampered.world.bloodlines[0].name = 'Garden Gold';
    expect(() => decodeRuntime(JSON.stringify(tampered))).toThrow('replay');
  });
});
