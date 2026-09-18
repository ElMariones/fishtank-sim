import { describe, expect, it } from 'vitest';
import { AXOLOTL_LOCUS_INDEX, axolotlAlleleLabel } from '../src/core/axolotlCatalog';
import { axolotlFounderGenome, expressAxolotl, type AxolotlGenome } from '../src/core/axolotlGenetics';
import { bloodlineSummaries, captureStandard, registrationProblem, standardSimilarity } from '../src/core/bloodlines';
import { offersFor, saleTraits } from '../src/core/economy';
import { mutationNotebook, originId, originProblem } from '../src/core/origins';
import { missingSexes, recoveryOverview, reliefDestination, reliefStatus } from '../src/core/recovery';
import type { Fish, World } from '../src/core/types';
import { applyCommand, createWorld } from '../src/core/world';

const NOW = '2026-09-18T12:00:00.000Z';

function axolotl(base: Fish, id: string, sex: Fish['sex'], genome: AxolotlGenome = axolotlFounderGenome(Number(id.slice(4)))): Fish {
  const p = expressAxolotl(genome);
  return {
    ...base,
    id,
    name: `Axolotl ${id.slice(-2)}`,
    sex,
    species: 'axolotl',
    genome,
    birthSeed: Number(id.slice(4)),
    generation: 0,
    parents: null,
    mutations: [],
    origins: [],
    status: 'living',
    life: { model: 1, ageDays: 30, lengthCm: p.adultLengthCm, condition: 1 },
  };
}

describe('species boundaries outside breeding and rendering', () => {
  it('counts only koi sexes and koi partners for the koi rescue', () => {
    const base = createWorld(NOW);
    const axMale = axolotl(base.fish[0], 'FSH-000007', 'M');
    const fish = [
      ...base.fish.map(member => member.sex === 'M'
        ? { ...member, status: 'rehomed' as const }
        : { ...member, tankId: 'tank-2' }),
      { ...axMale, tankId: 'tank-1' },
    ];
    const world: World = { ...base, nextId: 8, credits: 0, fish };

    expect(missingSexes(world)).toEqual(['M']);
    expect(reliefStatus(world).eligible).toBe(true);
    expect(reliefDestination(world, 1)).toBe('tank-2');
    expect(recoveryOverview(world).living).toEqual({ F: 3, M: 0 });
  });

  it('keeps koi bloodline registration and summaries away from axolotl genomes', () => {
    const base = createWorld(NOW);
    const ax = axolotl(base.fish[0], 'FSH-000007', 'M');
    const mixed: World = { ...base, nextId: 8, fish: [...base.fish, ax] };

    expect(registrationProblem(mixed, 'Ax line', [ax.id])).toBe('Only koi can found a koi bloodline.');
    expect(registrationProblem(mixed, 'Mixed line', [base.fish[0].id, ax.id])).toBe('Only koi can found a koi bloodline.');
    expect(() => captureStandard([ax])).toThrow('Only koi can found a koi bloodline.');

    const standard = captureStandard([base.fish[0]]);
    expect(standardSimilarity(ax, standard)).toEqual({ overall: 0, descriptors: 0, structure: 0, origins: null });

    const registered = applyCommand(base, { type: 'register-bloodline', name: 'Haru line', foundationIds: [base.fish[0].id], timestamp: NOW });
    const descendant = { ...ax, parents: [base.fish[0].id, base.fish[1].id] as [string, string], generation: 1 };
    const fish = registered.fish.map(member => member.id === base.fish[0].id ? { ...member, status: 'sold' as const } : member);
    const [summary] = bloodlineSummaries({ fish: [...fish, descendant], bloodlines: registered.bloodlines });
    expect([summary.livingMembers, summary.closest]).toEqual([0, null]);
  });

  it('labels axolotl mutation origins from the axolotl registry and rejects cross-species carriage', () => {
    const base = createWorld(NOW);
    const genome = axolotlFounderGenome(7707);
    const locus = AXOLOTL_LOCUS_INDEX.axo_base_hue;
    const from = genome.maternal[locus], to = from === 5 ? 4 : from + 1;
    const mutated: AxolotlGenome = { ...genome, maternal: [...genome.maternal] };
    mutated.maternal[locus] = to;
    const mutation = { locus, copy: 'maternal' as const, from, to };
    const first = {
      ...axolotl(base.fish[0], 'FSH-000007', 'M', mutated),
      mutations: [mutation],
      origins: [{ locus, copy: 'maternal' as const, id: originId('FSH-000007', locus, 'maternal') }],
    };
    const carrier = {
      ...axolotl(base.fish[0], 'FSH-000008', 'F', structuredClone(mutated)),
      parents: [first.id, first.id] as [string, string],
      generation: 1,
      origins: [{ locus, copy: 'maternal' as const, id: first.origins[0].id }],
    };

    const [row] = mutationNotebook({ fish: [first, carrier] }).origins;
    expect([row.locusId, row.locusLabel, row.structural]).toEqual(['axo_base_hue', 'Base hue', false]);
    expect(row.change).toBe(`A${from} → A${to} (${axolotlAlleleLabel('axo_base_hue', from)} → ${axolotlAlleleLabel('axo_base_hue', to)})`);

    const koiCarrier: Fish = {
      ...base.fish[0],
      parents: [first.id, base.fish[1].id],
      generation: 1,
      origins: [{ locus, copy: 'maternal', id: first.origins[0].id }],
    };
    expect(originProblem(koiCarrier, new Map([[first.id, first], [koiCarrier.id, koiCarrier]]))).toBe('A mutation origin cannot cross species.');
  });

  it('derives axolotl sale traits without koi appearance descriptors', () => {
    const base = createWorld(NOW);
    const genome = axolotlFounderGenome(8808);
    const switchLocus = AXOLOTL_LOCUS_INDEX.axo_leucistic_switch;
    const leucistic: AxolotlGenome = { ...genome, maternal: [...genome.maternal], paternal: [...genome.paternal] };
    leucistic.maternal[switchLocus] = 5;
    leucistic.paternal[switchLocus] = 5;
    const fish = axolotl(base.fish[0], 'FSH-000007', 'M', leucistic), p = expressAxolotl(leucistic);

    expect(saleTraits(fish)).toEqual({
      tail: p.morphology.tail.length,
      adultLengthCm: p.adultLengthCm,
      longevityYears: p.longevity,
      metabolism: p.metabolism,
      rarity: 3,
    });
    expect(offersFor(base, fish).length).toBeGreaterThan(0);
  });
});
