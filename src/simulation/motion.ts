import { express } from '../core/genetics';
import { hash, random } from '../core/random';
import type { Fish, Phenotype, Species } from '../core/types';

/** Visual actor: normalized tank position, velocity and the phenotype it draws. Never saved or used for biology. */
/** `species` is optional only for legacy test/fixture actors; every live actor created from a Fish carries it explicitly. */
export type Actor = { id: string; species?: Species; x: number; y: number; vx: number; vy: number; phase: number; phenotype: Phenotype };

export function createActor(fish: Fish): Actor {
  const rng = random(hash(fish.id));
  return { id: fish.id, species: fish.species, x: 0.18 + rng() * 0.64, y: 0.25 + rng() * 0.5, vx: rng() < 0.5 ? -0.03 : 0.03, vy: 0, phase: rng() * Math.PI * 2, phenotype: express(fish.genome) };
}
