import { BREEDING_CONDITION, clutchMembers, MS_PER_GAME_DAY, pairingBlockers, reservedPlaces } from './breeding';
import { GENOME_VERSION } from './catalog';
import { isEgg, lifeStage } from './development';
import { metabolicPotential } from './genetics';
import { createKinshipCache } from './pedigree';
import { advanceRuntime, commandEnvelope, createRuntime, decodeRuntime, executeCommand } from './runtime';
import { decodeSave } from './save';
import type { Fish } from './types';
import { TICKS_PER_GAME_DAY } from './water';
import { createWorld, MAX_LIVING, MAX_RECORDS, type Command } from './world';

/**
 * Two-generation normal-mode demonstration (FS-406), for M4's gate: complete two generations without instant-lab
 * shortcuts. A seeded world runs through the same runtime commands and clock as the aquarium. Two founder pairs court into
 * separate nurseries. Once both clutches are adults, a simulated keeper picks the largest adult-length potential of each
 * sex from different clutches, rehomes each clutch's surplus in one batch, and pairs the chosen fish. No instant `breed`
 * command is issued, and the runtime save is decoded and replayed at the end. Nothing reads or writes a player's world.
 */
export const LIFECYCLE_TIMESTAMP = '2026-09-14T00:00:00.000Z';
export const LIFECYCLE_DAY_LIMIT = 90;
const WORLD_ID = 'fs406-two-generations';
const CLUTCH_SIZE = 20;

export type LifecycleEvent = { day: number; kind: 'pair' | 'laid' | 'hatched' | 'ready' | 'rehome' | 'complete'; text: string };
export type LifecycleClutch = {
  clutchId: string; generation: number; mother: string; father: string; nursery: string; size: number;
  pairedOnDay: number; laidOnDay: number | null; hatchedOnDay: number | null; pedigreeF: number;
};
export type LifecycleDemo = {
  /** Game days until the second generation hatched. */
  days: number;
  events: LifecycleEvent[];
  clutches: LifecycleClutch[];
  commands: Command['type'][];
  instantCrosses: number;
  rehomed: number;
  /** Every bred fish belongs to a normal clutch record. */
  birthsFromClutches: boolean;
  /** The fullest tank at any day boundary, counting reserved places. */
  fullest: { tank: string; used: number; capacity: number };
  /** The runtime save decodes and replays to the same world. */
  replayed: boolean;
  /** Why decoding or replaying the save failed, if it did. */
  replayError: string | null;
  records: number;
};

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

export function lifecycleDemonstration(): LifecycleDemo {
  let runtime = createRuntime(createWorld(LIFECYCLE_TIMESTAMP), WORLD_ID), day = 0, rehomed = 0;
  const events: LifecycleEvent[] = [], clutches: LifecycleClutch[] = [], commands: Command['type'][] = [], pedigree = createKinshipCache();
  let fullest = { tank: '', used: 0, capacity: 1 };
  const name = (id: string) => runtime.world.fish.find(f => f.id === id)?.name ?? id;
  const tankName = (id: string) => runtime.world.tanks.find(t => t.id === id)?.name ?? id;
  const run = (command: Command) => { runtime = executeCommand(runtime, commandEnvelope(runtime, command)); commands.push(command.type); };
  const members = (clutchId: string) => clutchMembers(runtime.world, runtime.world.clutches.find(c => c.id === clutchId)!);
  const ready = (fish: Fish) => fish.status === 'living' && !isEgg(fish.life) && lifeStage(fish.life, metabolicPotential(fish.genome)) === 'adult'
    && fish.life.condition >= BREEDING_CONDITION && fish.breeding.cooldownDays === 0;
  const largest = (fish: Fish[]) => fish.reduce((best, f) => metabolicPotential(f.genome).adultLengthCm > metabolicPotential(best.genome).adultLengthCm ? f : best);

  function pair(motherId: string, fatherId: string, nurseryId: string, generation: number): string {
    const blockers = pairingBlockers(runtime.world, { motherId, fatherId, nurseryId, size: CLUTCH_SIZE }, { maxLiving: MAX_LIVING, maxRecords: MAX_RECORDS });
    if (blockers.length) throw new Error(blockers.map(blocker => blocker.message).join(' '));
    pedigree.sync(runtime.world.fish);
    run({ type: 'pair', motherId, fatherId, nurseryId, size: CLUTCH_SIZE, timestamp: new Date(Date.parse(LIFECYCLE_TIMESTAMP) + day * MS_PER_GAME_DAY).toISOString(), genomeVersion: GENOME_VERSION });
    const clutch = runtime.world.clutches.at(-1)!;
    clutches.push({ clutchId: clutch.id, generation, mother: name(motherId), father: name(fatherId), nursery: tankName(nurseryId), size: CLUTCH_SIZE,
      pairedOnDay: day, laidOnDay: null, hatchedOnDay: null, pedigreeF: pedigree.kinship(motherId, fatherId) });
    return clutch.id;
  }

  function advanceDay() {
    const before = new Map(runtime.world.clutches.map(clutch => [clutch.id, clutch.stage]));
    runtime = advanceRuntime(runtime, runtime.tick + TICKS_PER_GAME_DAY);
    day++;
    for (const clutch of runtime.world.clutches) {
      const entry = clutches.find(c => c.clutchId === clutch.id);
      if (!entry || before.get(clutch.id) === clutch.stage) continue;
      if (clutch.stage === 'incubating') {
        entry.laidOnDay = day;
        events.push({ day, kind: 'laid', text: `${entry.mother} × ${entry.father} laid ${clutch.size} eggs in ${entry.nursery} (${clutch.id}) after ${clutch.spawnedDay} game days of courtship.` });
      } else if (clutch.stage === 'hatched') {
        entry.hatchedOnDay = day;
        events.push({ day, kind: 'hatched', text: `${clutch.id} hatched: ${clutch.size} generation ${entry.generation} fry in ${entry.nursery}.` });
      }
    }
    for (const tank of runtime.world.tanks) {
      const used = runtime.world.fish.filter(f => f.status === 'living' && f.tankId === tank.id).length + reservedPlaces(runtime.world, tank.id);
      if (used / tank.capacity > fullest.used / fullest.capacity) fullest = { tank: tank.name, used, capacity: tank.capacity };
    }
  }

  run({ type: 'add-tank' });
  const [haru, sumi, kohaku, yuki] = runtime.world.fish;
  const firstA = pair(haru.id, sumi.id, 'tank-2', 1), firstB = pair(kohaku.id, yuki.id, 'tank-3', 1);
  events.push({ day, kind: 'pair', text: `${haru.name} × ${sumi.name} and ${kohaku.name} × ${yuki.name} started courting in ${tankName(haru.tankId)}, reserving ${CLUTCH_SIZE} places each in ${tankName('tank-2')} and ${tankName('tank-3')}.` });

  const firstGeneration = () => [...members(firstA), ...members(firstB)];
  while (day < LIFECYCLE_DAY_LIMIT && !(firstGeneration().length === 2 * CLUTCH_SIZE && firstGeneration().every(ready))) advanceDay();
  if (!firstGeneration().every(ready)) throw new Error(`The first generation was not ready to court within ${LIFECYCLE_DAY_LIMIT} game days.`);
  const females = members(firstA).filter(f => f.sex === 'F'), males = members(firstB).filter(f => f.sex === 'M');
  const mother = largest(females), father = largest(males);
  events.push({ day, kind: 'ready', text: `All ${2 * CLUTCH_SIZE} first-generation fish are adults ready to court. The keeper picks ${mother.name}, the largest adult-length potential among ${females.length} females of ${firstA}, and ${father.name}, the largest among ${males.length} males of ${firstB}.` });

  // Surplus leaves each nursery in one batch; the chosen father joins the chosen mother.
  run({ type: 'add-tank' });
  const surplusA = members(firstA).filter(f => f.id !== mother.id).map(f => f.id), surplusB = members(firstB).filter(f => f.id !== father.id).map(f => f.id);
  run({ type: 'move-batch', fishIds: surplusA, tankId: 'tank-1' });
  run({ type: 'move-batch', fishIds: surplusB, tankId: 'tank-4' });
  run({ type: 'move-batch', fishIds: [father.id], tankId: 'tank-2' });
  rehomed = surplusA.length + surplusB.length;
  events.push({ day, kind: 'rehome', text: `Rehomed ${surplusA.length} of ${firstA} to ${tankName('tank-1')} and ${surplusB.length} of ${firstB} to ${tankName('tank-4')}, one batch each; ${father.name} joined ${mother.name} in ${tankName('tank-2')}.` });

  const second = pair(mother.id, father.id, 'tank-3', 2), secondEntry = clutches.at(-1)!;
  events.push({ day, kind: 'pair', text: `${mother.name} × ${father.name} started courting in ${tankName('tank-2')}, reserving ${CLUTCH_SIZE} places in ${tankName('tank-3')}; expected pedigree F ${percent(secondEntry.pedigreeF)}.` });
  while (day < LIFECYCLE_DAY_LIMIT && runtime.world.clutches.find(c => c.id === second)!.stage !== 'hatched') advanceDay();
  if (secondEntry.hatchedOnDay === null) throw new Error(`The second generation did not hatch within ${LIFECYCLE_DAY_LIMIT} game days.`);
  events.push({ day, kind: 'complete', text: `Two generations complete without an instant lab cross: ${CLUTCH_SIZE} generation 2 fry descend from ${haru.name}, ${sumi.name}, ${kohaku.name} and ${yuki.name}.` });

  const clutchFish = new Set(runtime.world.clutches.flatMap(clutch => clutchMembers(runtime.world, clutch).map(f => f.id)));
  let replayed = false, replayError: string | null = null;
  try {
    // decodeRuntime replays the journal and rejects any disagreement; both sides are decoded so key order cannot differ.
    replayed = JSON.stringify(decodeRuntime(JSON.stringify(runtime)).world) === JSON.stringify(decodeSave(JSON.stringify(runtime.world)));
    if (!replayed) replayError = 'The replayed world differs from the saved world.';
  } catch (failure) { replayError = failure instanceof Error ? failure.message : String(failure); }
  return {
    days: day, events, clutches, commands, instantCrosses: commands.filter(type => type === 'breed').length, rehomed,
    birthsFromClutches: runtime.world.fish.every(f => !f.parents || clutchFish.has(f.id)), fullest, replayed, replayError, records: runtime.world.fish.length,
  };
}
