import { z } from 'zod';
import { ALL_LOCI, LOCI } from './catalog';
import { MAX_RECORDS, MAX_TANKS } from './world';
import type { World } from './types';

const alleles = (count: number) => z.array(z.number().int().min(0).max(5)).length(count);
/** Genome v1 records stay valid unchanged; genome v2 records carry the appended Color and Ornament loci. */
const genome = z.discriminatedUnion('version', [
  z.object({ version: z.literal(1), maternal: alleles(LOCI.length), paternal: alleles(LOCI.length) }),
  z.object({ version: z.literal(2), maternal: alleles(ALL_LOCI.length), paternal: alleles(ALL_LOCI.length) }),
]);
const schema = z.object({
  version: z.literal(1), seed: z.number().int().min(0).max(4294967295), nextId: z.number().int().positive(), credits: z.number().int().nonnegative().max(1e9),
  tanks: z.array(z.object({ id: z.string().max(50), name: z.string().min(1).max(32), capacity: z.number().int().min(1).max(60), planted: z.boolean() })).min(1).max(MAX_TANKS),
  fish: z.array(z.object({
    id: z.string().regex(/^FSH-\d{6}$/), name: z.string().min(1).max(32), sex: z.enum(['F', 'M']),
    genome,
    birthSeed: z.number().int().min(0).max(4294967295), generation: z.number().int().min(0).max(MAX_RECORDS),
    parents: z.tuple([z.string(), z.string()]).nullable(), bornAt: z.string().datetime(),
    tankId: z.string(), status: z.enum(['living', 'sold']),
    mutations: z.array(z.object({ locus: z.number().int().min(0).max(ALL_LOCI.length - 1), copy: z.enum(['maternal', 'paternal']), from: z.number().int().min(0).max(5), to: z.number().int().min(0).max(5) })).max(ALL_LOCI.length * 2),
  })).max(MAX_RECORDS),
});

export function decodeSave(raw: string): World {
  if (raw.length > 12_000_000) throw new Error('Save is too large for this lab.');
  const world = schema.parse(JSON.parse(raw));
  const ids = new Map(world.fish.map(f => [f.id, f]));
  const tanks = new Set(world.tanks.map(t => t.id));
  if (ids.size !== world.fish.length || tanks.size !== world.tanks.length) throw new Error('Duplicate records in save.');
  for (const fish of world.fish) {
    if (!tanks.has(fish.tankId) || Number(fish.id.slice(4)) >= world.nextId) throw new Error('Invalid record reference.');
    if (fish.mutations.some(mutation => mutation.locus >= fish.genome.maternal.length)) throw new Error('Mutation record is outside the genome.');
    if (fish.parents) {
      const [m, p] = fish.parents.map(parent => ids.get(parent));
      if (!m || !p || m.id === p.id || m.sex !== 'F' || p.sex !== 'M' || Math.max(m.generation, p.generation) + 1 !== fish.generation) throw new Error('Invalid pedigree.');
    } else if (fish.generation !== 0) throw new Error('Founder generation must be zero.');
  }
  for (const tank of world.tanks) {
    if (world.fish.filter(f => f.status === 'living' && f.tankId === tank.id).length > tank.capacity) throw new Error('Tank exceeds capacity.');
  }
  return world;
}

export const SAVE_KEY = 'fishtank-sim.lab.v1';
