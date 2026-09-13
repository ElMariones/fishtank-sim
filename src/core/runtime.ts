import { z } from 'zod';
import { decodeSave } from './save';
import { applyCommand, commandSchema, type Command } from './world';
import type { World } from './types';
import { offlineWindow, TICK_MS, timelineSegments, type OfflineWindow } from '../simulation/time';

export { TICK_MS };
export const JOURNAL_LIMIT = 64;
export const MAX_SAVE_CHARACTERS = 64_000_000;
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const worldIdSchema = z.string().min(1).max(100).regex(/^[\w-]+$/);
export const envelopeSchema = z.object({
  protocol: z.literal(1), worldId: worldIdSchema, commandId: z.string().max(130),
  expectedRevision: integer, issuedAtTick: integer, payload: commandSchema,
}).strict();
export type Envelope = z.infer<typeof envelopeSchema>;
export type Checkpoint = { world: World; tick: number; revision: number };
export type DomainEvent = { eventId: string; command: Envelope };
export type SimulationState = { version: 1; tankTicks: Record<string, number> };
export type Runtime = {
  schemaVersion: 2; runtimeVersion: 1; worldId: string;
  world: World; tick: number; revision: number; checkpoint: Checkpoint; events: DomainEvent[]; simulation: SimulationState;
};

/** Storage/command schema changes do not reinterpret genomes or appearance. */
export function createRuntime(world: World, worldId: string): Runtime {
  worldIdSchema.parse(worldId);
  return { schemaVersion: 2, runtimeVersion: 1, worldId, world, tick: 0, revision: 0,
    checkpoint: { world, tick: 0, revision: 0 }, events: [],
    simulation: { version: 1, tankTicks: Object.fromEntries(world.tanks.map(tank => [tank.id, 0])) } };
}

/** Visible and background tanks use this same tick integration. No biology is applied until M3 defines it. */
export function advanceRuntime(runtime: Runtime, targetTick: number, eventTicks: readonly number[] = []): Runtime {
  const segments = timelineSegments(runtime.tick, targetTick, eventTicks);
  if (!segments.length) return runtime;
  const tankTicks = { ...runtime.simulation.tankTicks };
  for (const tank of runtime.world.tanks) tankTicks[tank.id] = (tankTicks[tank.id] ?? runtime.tick) + (targetTick - runtime.tick);
  return { ...runtime, tick: targetTick, simulation: { version: 1, tankTicks } };
}

export function applyOfflineCatchup(runtime: Runtime, savedAtMs: number, nowMs: number): { runtime: Runtime; window: OfflineWindow } {
  const window = offlineWindow(savedAtMs, nowMs);
  return { runtime: advanceRuntime(runtime, runtime.tick + window.appliedTicks), window };
}

export function commandEnvelope(runtime: Runtime, payload: Command, tick = runtime.tick): Envelope {
  return { protocol: 1, worldId: runtime.worldId, commandId: `${runtime.worldId}:${runtime.revision + 1}`,
    expectedRevision: runtime.revision, issuedAtTick: tick, payload };
}

/** Monotonic command sequence prevents even compacted retries from creating births or paying twice.
 * Recent exact retries return the existing runtime; conflicting/stale retries reject before mutation.
 */
export function executeCommand(runtime: Runtime, input: Envelope): Runtime {
  const command = envelopeSchema.parse(input);
  if (command.worldId !== runtime.worldId) throw new Error('Command belongs to another world.');
  const previous = runtime.events.find(event => event.command.commandId === command.commandId);
  if (previous) {
    if (JSON.stringify(previous.command) !== JSON.stringify(command)) throw new Error('Command ID was already used with different content.');
    return runtime;
  }
  if (command.expectedRevision !== runtime.revision || command.commandId !== `${runtime.worldId}:${runtime.revision + 1}`)
    throw new Error('Stale command. Refresh the world before trying again.');
  if (command.issuedAtTick < runtime.tick) throw new Error('Command tick cannot move backwards.');
  const advanced = advanceRuntime(runtime, command.issuedAtTick);
  const world = applyCommand(advanced.world, command.payload);
  const revision = runtime.revision + 1;
  integer.parse(revision);
  const events = [...advanced.events, { eventId: `${runtime.worldId}:event:${revision}`, command }];
  // Bounded replay journal; old commands remain stale because revision never resets.
  const checkpoint = events.length >= JOURNAL_LIMIT
    ? { world, tick: command.issuedAtTick, revision } : advanced.checkpoint;
  const tankTicks = { ...advanced.simulation.tankTicks };
  for (const tank of world.tanks) tankTicks[tank.id] ??= command.issuedAtTick;
  return { ...advanced, world, revision, tick: command.issuedAtTick, checkpoint,
    simulation: { version: 1, tankTicks }, events: events.length >= JOURNAL_LIMIT ? [] : events };
}

const checkpointSchema = z.object({ world: z.unknown(), tick: integer, revision: integer }).strict();
const runtimeSchema = z.object({
  schemaVersion: z.literal(2), runtimeVersion: z.literal(1), worldId: worldIdSchema,
  world: z.unknown(), tick: integer, revision: integer, checkpoint: checkpointSchema,
  events: z.array(z.object({ eventId: z.string().max(140), command: envelopeSchema }).strict()).max(JOURNAL_LIMIT - 1),
  simulation: z.object({ version: z.literal(1), tankTicks: z.record(z.string().max(50), integer) }).strict().optional(),
}).strict();

/** Validate both snapshot and replay, including IDs, order, model versions and resulting world. */
export function decodeRuntime(raw: string): Runtime {
  if (raw.length > MAX_SAVE_CHARACTERS) throw new Error('Save exceeds the import size limit.');
  const parsed = runtimeSchema.parse(JSON.parse(raw));
  const checkpoint = { ...parsed.checkpoint, world: decodeSave(JSON.stringify(parsed.checkpoint.world)) };
  let replayed: Runtime = { ...createRuntime(checkpoint.world, parsed.worldId), ...checkpoint, checkpoint };
  for (const event of parsed.events) {
    if (event.eventId !== `${parsed.worldId}:event:${replayed.revision + 1}`) throw new Error('Invalid event sequence.');
    replayed = executeCommand(replayed, event.command);
  }
  const world = decodeSave(JSON.stringify(parsed.world));
  if (replayed.revision !== parsed.revision || replayed.tick > parsed.tick || JSON.stringify(decodeSave(JSON.stringify(replayed.world))) !== JSON.stringify(world))
    throw new Error('Save snapshot does not agree with its replay journal.');
  const simulation = parsed.simulation ?? { version: 1 as const, tankTicks: Object.fromEntries(world.tanks.map(tank => [tank.id, parsed.tick])) };
  const tankIds = new Set(world.tanks.map(tank => tank.id));
  if (Object.keys(simulation.tankTicks).length !== tankIds.size || Object.entries(simulation.tankTicks).some(([id, tick]) => !tankIds.has(id) || tick !== parsed.tick))
    throw new Error('Simulation clocks do not agree with the world tick.');
  return { ...replayed, world, tick: parsed.tick, simulation };
}

/** Legacy v1 records retain their exact identity, genome, seed and parent links. */
export function importRuntime(raw: string, legacyWorldId: string): Runtime {
  if (raw.length > MAX_SAVE_CHARACTERS) throw new Error('Save exceeds the import size limit.');
  const parsed: unknown = JSON.parse(raw);
  if (parsed && typeof parsed === 'object' && 'schemaVersion' in parsed) return decodeRuntime(raw);
  return createRuntime(decodeSave(raw), legacyWorldId);
}
