import { z } from 'zod';
import type { LabPreferences } from './collection';
import { isEgg } from './development';
import type { World } from './types';

/**
 * First-session guide (FS-504), following the GDD's proposed first session. Progress is a device-local annotation like
 * collection preferences (ADR-020) and never part of the world save. A step completes from an interface action the app
 * records (select, rename, feed, follow a parent) or from facts in the world and preferences (a courtship or bred fish,
 * a kept hatched offspring, a breeding goal). Completion is stored, so a later sale or cleared goal never unchecks a step.
 * The guide only points at existing controls: it issues no commands, grants nothing and sets no deadline.
 */
export const GUIDE_KEY = 'fishtank-sim.lab.v1.guide';
export const GUIDE_STEPS = ['select', 'rename', 'feed', 'court', 'hatch', 'family', 'goal'] as const;
export type GuideStepId = typeof GUIDE_STEPS[number];
export type GuideProgress = { version: 1; hidden: boolean; done: GuideStepId[] };
export type GuideStep = { id: GuideStepId; title: string; detail: string; done: boolean };

export const GUIDE_TEXT: Record<GuideStepId, { title: string; detail: string }> = {
  select: { title: 'Meet your fish', detail: 'Click a swimming fish, or a card under Your collection, to open it in the inspector.' },
  rename: { title: 'Name a fish', detail: 'Under Given name, type a new name and press Save. A name is only a label: the fish’s ID, genome and family links never change.' },
  feed: { title: 'Feed the tank', detail: 'Press ＋ Feed on the aquarium and watch which fish reach the pellets first. Food is free, and each tank’s auto-feeder keeps its fish fed.' },
  court: {
    title: 'Start a courtship',
    detail: 'In What will they inherit?, choose an adult female and male that share a tank, pick a nursery and press Start courtship. It takes two to four game days, and one game day passes each real minute. If it pauses, the clutch list says why.',
  },
  hatch: { title: 'Hatch and keep a candidate', detail: 'Eggs hatch three game days after they are laid, and markings appear as the fry grow. Star ☆ a hatched offspring you want to keep; favorites are never sold in bulk.' },
  family: { title: 'Trace a family', detail: 'Select a fish bred here and follow its mother or father, from the parent links under its name or the Family tab. The inspector moves to that fish’s aquarium, and Back returns.' },
  goal: { title: 'Choose a breeding goal', detail: 'Optional: build a goal from a few traits to rank your collection and parent choices. There is no deadline. Fish never die in this lab, and their records stay whenever you return.' },
};

const schema = z.object({ version: z.literal(1), hidden: z.boolean(), done: z.array(z.enum(GUIDE_STEPS)).max(64) }).strict();

/** Bred fish or any clutch record mean a lineage already exists. */
export const hasLineage = (world: Pick<World, 'fish' | 'clutches'>) => world.clutches.length > 0 || world.fish.some(fish => fish.parents !== null);

/** Stored progress for this world. Missing or invalid data yields a fresh guide, tucked away when a lineage already exists. */
export function decodeGuide(raw: string | null, world: Pick<World, 'fish' | 'clutches'>): GuideProgress {
  const fallback: GuideProgress = { version: 1, hidden: hasLineage(world), done: [] };
  if (!raw) return fallback;
  try {
    const parsed = schema.parse(JSON.parse(raw));
    return { version: 1, hidden: parsed.hidden, done: GUIDE_STEPS.filter(id => parsed.done.includes(id)) };
  } catch {
    return fallback;
  }
}

/** Records completed steps in guide order. Returns the same object when nothing is new, so callers can skip a state update. */
export function completeGuideSteps(progress: GuideProgress, ids: readonly GuideStepId[]): GuideProgress {
  if (ids.every(id => progress.done.includes(id))) return progress;
  return { ...progress, done: GUIDE_STEPS.filter(id => progress.done.includes(id) || ids.includes(id)) };
}

/** Steps whose facts hold now in the world and preferences; the interface-action steps are never observed here. */
export function observedGuideSteps(world: Pick<World, 'fish' | 'clutches'>, preferences: Pick<LabPreferences, 'goal' | 'favorites'>): GuideStepId[] {
  const steps: GuideStepId[] = [];
  if (hasLineage(world)) steps.push('court');
  if (preferences.favorites.length) {
    const favorites = new Set(preferences.favorites);
    if (world.fish.some(fish => fish.parents !== null && favorites.has(fish.id) && !isEgg(fish.life))) steps.push('hatch');
  }
  if (preferences.goal) steps.push('goal');
  return steps;
}

export const guideSteps = (progress: GuideProgress): GuideStep[] => GUIDE_STEPS.map(id => ({ id, ...GUIDE_TEXT[id], done: progress.done.includes(id) }));
