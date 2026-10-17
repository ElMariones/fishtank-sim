import { AXOLOTL_V2_REGISTRY } from './axolotlCatalog';
import {
  ALL_CHANNELS, AXOLOTL_SCALE, EXTRA_CHANNELS, GOLDFISH_SCALE, isNovel, KOI_SCALE,
  type AlleleKind, type Channel, type GenesisBlock, type ModuleCopies, type NovelAllele, type NovelScale,
} from './genesis';
import { GOLDFISH_LOCUS_REGISTRY } from './goldfishCatalog';
import { inheritModules, type ModuleMutation } from './modules';
import { clamp, hash, random } from './random';
import type { Species } from './types';

/**
 * Genesis model 2 (world v18): the open-ended allele and body-plan layer added on top of each species' model 1 meiosis.
 *
 * A child is first produced exactly as model 1 produces it (same streams, same draws). Under model 2 it then
 * - receives module genes from its parents' Body plan chromosomes (or their latent module genotypes), and
 * - has every open-ended allele that arose in its own birth **enriched** from a stream keyed by the allele's ID: most
 *   stay small drifts, about one in eight is a leap (a much larger step with an extra side effect), and about one in
 *   eight is regulatory (its value barely moves but its dominance flips). Drifts may gain one of the new model 2 side
 *   effects (body depth, eye size, pattern contrast, lifespan).
 *
 * Nothing here runs for model 1 worlds, so every recorded journal replays unchanged.
 */
export const GENESIS_MODEL_2 = 2 as const;
export const LEAP_SHARE = 0.12;
export const REGULATORY_SHARE = 0.12;

export const scaleFor = (species: Species): NovelScale => species === 'koi' ? KOI_SCALE : species === 'axolotl' ? AXOLOTL_SCALE : GOLDFISH_SCALE;

/** The value of a catalog allele on its locus' scale (koi alleles are their own level; the others read their registry). */
export function catalogValue(species: Species, locus: number, allele: number): number {
  if (species === 'koi') return allele;
  const entry = species === 'axolotl' ? AXOLOTL_V2_REGISTRY[locus] : GOLDFISH_LOCUS_REGISTRY[locus];
  return entry?.alleles[allele]?.effect ?? 0;
}

const round = (value: number) => Math.round(value * 1000) / 1000;
const ordered = (effects: Partial<Record<Channel, number>>) => {
  const out: Partial<Record<Channel, number>> = {};
  for (const channel of ALL_CHANNELS) if (effects[channel] !== undefined && effects[channel] !== 0) out[channel] = round(clamp(effects[channel]!, -1, 1));
  return out;
};

/** Model 2 treatment of one allele that arose in this birth. Pure: the same ID always gives the same allele. */
export function enrichAllele(allele: NovelAllele, species: Species, pool: ReadonlyMap<number, NovelAllele>): NovelAllele {
  const rng = random(hash(`genesis-v2:allele:${allele.id}`)), scale = scaleFor(species), roll = rng();
  const kind: AlleleKind = roll < LEAP_SHARE ? 'leap' : roll < LEAP_SHARE + REGULATORY_SHARE ? 'regulatory' : 'drift';
  const parentValue = isNovel(allele.parent) ? pool.get(allele.parent)?.value ?? allele.value : catalogValue(species, allele.locus, allele.parent);
  const effects: Partial<Record<Channel, number>> = { ...allele.effects };
  let value = allele.value, potency = allele.potency;
  if (kind === 'leap') {
    const step = value - parentValue || (rng() < 0.5 ? -1 : 1) * scale.step[0];
    value = clamp(parentValue + step * (2.2 + 0.8 * rng()), scale.min, scale.max);
    const channel = ALL_CHANNELS[Math.floor(rng() * ALL_CHANNELS.length)];
    effects[channel] = (effects[channel] ?? 0) + (rng() < 0.5 ? -1 : 1) * scale.effect * (0.5 + 0.7 * rng());
  } else if (kind === 'regulatory') {
    value = clamp(parentValue + (value - parentValue) * 0.3, scale.min, scale.max);
    potency = rng() < 0.5 ? potency * 0.32 : potency * 1.85 + 0.1;
  } else if (rng() < 0.35) {
    const channel = EXTRA_CHANNELS[Math.floor(rng() * EXTRA_CHANNELS.length)];
    effects[channel] = (effects[channel] ?? 0) + (rng() < 0.5 ? -1 : 1) * scale.effect * (0.3 + 0.7 * rng());
  }
  return { id: allele.id, locus: allele.locus, parent: allele.parent, value: round(value), potency: round(clamp(potency, 0.12, 1.9)), effects: ordered(effects), kind };
}

type WithGenesis = { genesis?: GenesisBlock };

/**
 * Turn a model 1 child into a model 2 child: enrich the alleles that arose in this birth and add module genes. `pool`
 * holds every novel allele the parents carried, so carried alleles keep their definitions and derived ones find their
 * parent's value.
 */
export function upgradeChild<T extends WithGenesis>(species: Species, child: T, mother: ModuleCopies, father: ModuleCopies, pool: ReadonlyMap<number, NovelAllele>, seed: number): { genome: T; moduleMutations: ModuleMutation[] } {
  const block = child.genesis;
  if (!block) return { genome: child, moduleMutations: [] };
  const local = new Map(pool);
  for (const entry of block.novel) if (!local.has(entry.id)) local.set(entry.id, entry);
  const novel = block.novel.map(entry => pool.has(entry.id) ? entry : enrichAllele(entry, species, local));
  const { modules, mutations } = inheritModules(species, mother, father, seed);
  // Key order matches the save schema (dev, load, novel, model, modules), so replay comparisons stay byte-identical.
  return { genome: { ...child, genesis: { dev: block.dev, load: block.load, novel, model: GENESIS_MODEL_2, modules } }, moduleMutations: mutations };
}
