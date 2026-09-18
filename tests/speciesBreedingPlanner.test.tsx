import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { goalLeaders } from '../src/core/collection';
import { predictOffspring, singleLocusOdds } from '../src/core/prediction';
import type { Fish, World } from '../src/core/types';
import { applyCommand, createWorld } from '../src/core/world';
import { BreedingPlanner } from '../src/ui/BreedingPlanner';
import { NormalBreeding } from '../src/ui/NormalBreeding';

const NOW = '2026-09-18T12:00:00.000Z';
const noop = () => {};

function mixedWorld(): World {
  let world = createWorld(NOW);
  world = applyCommand(world, { type: 'buy', species: 'axolotl', tankId: 'tank-1', timestamp: NOW });
  world = applyCommand(world, { type: 'buy', species: 'axolotl', tankId: 'tank-1', timestamp: NOW });
  return world;
}

function pairBySpecies(world: World, species: Fish['species']) {
  const members = world.fish.filter(fish => fish.species === species && fish.status === 'living');
  return {
    mother: members.find(fish => fish.sex === 'F')!,
    father: members.find(fish => fish.sex === 'M')!,
  };
}

function planner(world: World, motherId: string, fatherId: string, goal: Parameters<typeof BreedingPlanner>[0]['goal'] = null) {
  return <BreedingPlanner fish={world.fish} tanks={world.tanks} goal={goal} onGoal={noop}
    motherId={motherId} fatherId={fatherId} onMother={noop} onFather={noop} />;
}

const selectBody = (html: string, id: string) => html.match(new RegExp(`<select id="${id}"[^>]*>([\\s\\S]*?)<\\/select>`))?.[1] ?? '';

describe('species-aware breeding planner boundaries', () => {
  it('limits the opposite-sex candidate list to the selected parent species', () => {
    const world = mixedWorld(), koi = pairBySpecies(world, 'koi'), ax = pairBySpecies(world, 'axolotl');
    const html = renderToStaticMarkup(planner(world, ax.mother.id, ''));
    const fathers = selectBody(html, 'planner-father');

    expect(fathers).toContain(ax.father.name);
    expect(fathers).not.toContain(koi.father.name);
  });

  it('never promotes axolotls as leaders for koi-defined breeding goals', () => {
    const world = mixedWorld();
    const goal = { descriptor: 'base_color:5', direction: 'higher' } as const;
    const leaders = goalLeaders(world.fish, goal);

    expect(leaders.mother?.species).toBe('koi');
    expect(leaders.father?.species).toBe('koi');
  });

  it('does not run the koi prediction panel for an axolotl pair', () => {
    const world = mixedWorld(), ax = pairBySpecies(world, 'axolotl');
    const html = renderToStaticMarkup(planner(world, ax.mother.id, ax.father.id));

    expect(html).not.toContain('Exact single-locus odds');
    expect(html).not.toContain('Allele IDs, unordered pairs, before mutation');
  });

  it('renders a mixed selected pair safely instead of calling offspring prediction on incompatible genomes', () => {
    const world = mixedWorld(), koi = pairBySpecies(world, 'koi'), ax = pairBySpecies(world, 'axolotl');
    expect(() => renderToStaticMarkup(planner(world, koi.mother.id, ax.father.id))).not.toThrow();
  });

  it('does not preserve a cross-species selected partner as an outside-filter parent choice', () => {
    const world = mixedWorld(), koi = pairBySpecies(world, 'koi'), ax = pairBySpecies(world, 'axolotl');
    const html = renderToStaticMarkup(planner(world, koi.mother.id, ax.father.id));
    const fathers = selectBody(html, 'planner-father');

    expect(fathers).not.toContain(`${ax.father.name} · outside candidate filter`);
    expect(fathers).toContain(koi.father.name);
  });

  it('makes the koi-only prediction helpers reject axolotl genomes at their public boundary', () => {
    const world = mixedWorld(), ax = pairBySpecies(world, 'axolotl');
    expect(() => predictOffspring(ax.mother.genome, ax.father.genome)).toThrow(/koi|species/i);
    expect(() => singleLocusOdds(ax.mother.genome, ax.father.genome, 'body_depth')).toThrow(/koi|species/i);
  });

  it('keeps normal courtship visibly blocked and disabled for a mixed selected pair', () => {
    const world = mixedWorld(), koi = pairBySpecies(world, 'koi'), ax = pairBySpecies(world, 'axolotl');
    const html = renderToStaticMarkup(<NormalBreeding world={world} motherId={koi.mother.id} fatherId={ax.father.id}
      nurseryId="tank-2" size={8} readOnly={false} onNursery={noop} onSize={noop} onPair={noop} onCancel={noop} onShowClutch={noop} />);

    expect(html).toMatch(/only members of the same species can breed/i);
    expect(html).toMatch(/<button class="primary" disabled=""[^>]*>Start courtship/);
  });
});
