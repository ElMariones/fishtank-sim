import { reservedPlaces } from './breeding';
import { isEgg } from './development';
import { planSales, type TraitCache } from './economy';
import { LISTING_PRICES } from './shop';
import type { Fish, ReliefState, World } from './types';

/**
 * No-money recovery (FS-504). While living fish of both sexes remain, a lineage can always continue: breeding, food,
 * rehoming, moving fish and lower care settings cost nothing. The one economic dead end is losing every fish of one sex
 * without the credits to buy unrelated stock. Then the koi rescue gives one unrelated adult of each missing sex at no
 * cost, at most once every RELIEF_COOLDOWN_DAYS game days, so it restores a pair without becoming an income. The wait
 * counts down at game-day boundaries like rest days, so replay and every split of time agree.
 */
export const RELIEF_MODEL = 1;
export const RELIEF_COOLDOWN_DAYS = 10;
/** Credits below this for each missing sex qualify: the price of one unrelated founder in the NPC shop. */
export const RELIEF_THRESHOLD = LISTING_PRICES.founder;

const SEXES = ['F', 'M'] as const satisfies readonly Fish['sex'][];
const SEX_WORDS = { F: 'female', M: 'male' } as const;
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
const credits = (amount: number) => `◈ ${amount.toLocaleString('en')}`;

export const defaultRelief = (): ReliefState => ({ model: 1, claims: 0, cooldownDays: 0 });

/** Sexes with no living fish at any stage. Eggs and fry count, because they grow into breeders. */
export function missingSexes(world: Pick<World, 'fish'>): Fish['sex'][] {
  const present = new Set<Fish['sex']>();
  for (const fish of world.fish) if (fish.status === 'living') present.add(fish.sex);
  return SEXES.filter(sex => !present.has(sex));
}

export type ReliefStatus = { eligible: boolean; sexes: Fish['sex'][]; reason: string };

/** Whether the koi rescue can help now, which fish it would give, and why, in words the interface shows as they are. */
export function reliefStatus(world: Pick<World, 'fish' | 'credits' | 'relief'>): ReliefStatus {
  const sexes = missingSexes(world), wanted = sexes.map(sex => `one ${SEX_WORDS[sex]}`).join(' and ');
  if (!sexes.length) return { eligible: false, sexes, reason: 'You have living fish of both sexes, so a new generation is possible without the koi rescue.' };
  const threshold = RELIEF_THRESHOLD * sexes.length;
  if (world.credits >= threshold) return {
    eligible: false, sexes,
    reason: `You have ${credits(world.credits)}, enough to buy ${wanted} in the NPC shop, where unrelated founders cost ${credits(RELIEF_THRESHOLD)}.`,
  };
  if (world.relief.cooldownDays > 0) return { eligible: false, sexes, reason: `The koi rescue can help again in ${plural(world.relief.cooldownDays, 'game day')}.` };
  const lost = sexes.length === SEXES.length ? 'No living fish are left' : `No living ${SEX_WORDS[sexes[0]]} is left`;
  return { eligible: true, sexes, reason: `${lost} and you have less than ${credits(threshold)}, so the koi rescue offers ${wanted} at no cost.` };
}

/** One game-day boundary: the rescue's wait counts down. */
export function advanceRelief(world: World): World {
  return world.relief.cooldownDays > 0 ? { ...world, relief: { ...world.relief, cooldownDays: world.relief.cooldownDays - 1 } } : world;
}

/** Default home for rescued fish: the tank with room that holds the most hatched fish to pair with, else the first with room. */
export function reliefDestination(world: World, arriving: number): string | null {
  const residents = new Map<string, number>(), hatched = new Map<string, number>();
  for (const fish of world.fish) if (fish.status === 'living') {
    residents.set(fish.tankId, (residents.get(fish.tankId) ?? 0) + 1);
    if (!isEgg(fish.life)) hatched.set(fish.tankId, (hatched.get(fish.tankId) ?? 0) + 1);
  }
  let best: { id: string; partners: number } | null = null;
  for (const tank of world.tanks) {
    if (tank.capacity - (residents.get(tank.id) ?? 0) - reservedPlaces(world, tank.id) < arriving) continue;
    const partners = hatched.get(tank.id) ?? 0;
    if (!best || partners > best.partners) best = { id: tank.id, partners };
  }
  return best?.id ?? null;
}

export type RecoveryOverview = {
  living: Record<Fish['sex'], number>;
  relief: ReliefStatus;
  /** Hatched living fish that are not courting: those that can be sold or rehomed today. */
  releasable: number;
  /** Of those, how many have a buyer today, and what all of them would fetch sold in record order through the shared sale plan. */
  saleable: number;
  saleTotal: number;
};

/** What a player short of credits can still do, from the same rules the commands use. */
export function recoveryOverview(world: World, cache?: TraitCache): RecoveryOverview {
  const courting = new Set(world.clutches.flatMap(clutch => clutch.stage === 'courting' ? [clutch.motherId, clutch.fatherId] : []));
  const living = { F: 0, M: 0 }, releasable: string[] = [];
  for (const fish of world.fish) {
    if (fish.status !== 'living') continue;
    living[fish.sex]++;
    if (!isEgg(fish.life) && !courting.has(fish.id)) releasable.push(fish.id);
  }
  const plan = planSales(world, releasable, cache);
  return { living, relief: reliefStatus(world), releasable: releasable.length, saleable: plan.sales.length, saleTotal: plan.total };
}
