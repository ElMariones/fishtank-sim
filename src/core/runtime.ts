import { z } from 'zod';
import { advanceWorld, type DayReport } from './habitat';
import { NAMING_MODEL } from './names';
import { decodeSave } from './save';
import { initialShop, SHOP_MODEL } from './shop';
import { TICKS_PER_GAME_DAY } from './water';
import { applyCommand, commandSchema, WORLD_VERSION, type Command } from './world';
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
  const tick = world.circuit.day * TICKS_PER_GAME_DAY;
  return { schemaVersion: 2, runtimeVersion: 1, worldId, world, tick, revision: 0,
    checkpoint: { world, tick, revision: 0 }, events: [],
    simulation: { version: 1, tankTicks: Object.fromEntries(world.tanks.map(tank => [tank.id, tick])) } };
}

/**
 * Visible and background tanks use this same tick integration. Care and water advance through fixed absolute steps and
 * development at day boundaries, so fine, coarse, background and offline advances agree exactly. `onDay` only observes.
 */
export function advanceRuntime(runtime: Runtime, targetTick: number, eventTicks: readonly number[] = [], onDay?: (report: DayReport) => void): Runtime {
  const segments = timelineSegments(runtime.tick, targetTick, eventTicks);
  if (!segments.length) return runtime;
  const tankTicks = { ...runtime.simulation.tankTicks };
  for (const tank of runtime.world.tanks) tankTicks[tank.id] = (tankTicks[tank.id] ?? runtime.tick) + (targetTick - runtime.tick);
  return { ...runtime, world: advanceWorld(runtime.world, runtime.tick, targetTick, onDay), tick: targetTick, simulation: { version: 1, tankTicks } };
}

export function applyOfflineCatchup(runtime: Runtime, savedAtMs: number, nowMs: number, onDay?: (report: DayReport) => void): { runtime: Runtime; window: OfflineWindow } {
  const window = offlineWindow(savedAtMs, nowMs);
  return { runtime: advanceRuntime(runtime, runtime.tick + window.appliedTicks, [], onDay), window };
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

/**
 * Validate both snapshot and replay, including IDs, order, model versions and resulting world. Replay advances to the
 * snapshot tick, so water and development integrated by clock checkpoints must agree as well. A snapshot from an older
 * world version predates some time-integrated state, so it is compared without water and life state; its migrated values
 * start at that snapshot, and the journal folds into a new checkpoint there. A world v7 snapshot under an older naming
 * model replays under the current one, so it is compared without names and the ledger text that quotes them (ADR-056),
 * then rebased the same way: stored names stay, and fish named from then on get current names.
 */
export function decodeRuntime(raw: string): Runtime {
  if (raw.length > MAX_SAVE_CHARACTERS) throw new Error('Save exceeds the import size limit.');
  const parsed = runtimeSchema.parse(JSON.parse(raw));
  const sourceVersion = Number((parsed.world as { version?: unknown } | null)?.version);
  const legacyWorld = (parsed.world as { version?: unknown } | null)?.version !== WORLD_VERSION;
  const checkpoint = { ...parsed.checkpoint, world: decodeSave(JSON.stringify(parsed.checkpoint.world)) };
  let replayed: Runtime = { ...createRuntime(checkpoint.world, parsed.worldId), ...checkpoint, checkpoint };
  for (const event of parsed.events) {
    if (event.eventId !== `${parsed.worldId}:event:${replayed.revision + 1}`) throw new Error('Invalid event sequence.');
    replayed = executeCommand(replayed, event.command);
  }
  const world = decodeSave(JSON.stringify(parsed.world));
  const mismatch = new Error('Save snapshot does not agree with its replay journal.');
  if (replayed.revision !== parsed.revision || replayed.tick > parsed.tick) throw mismatch;
  replayed = advanceRuntime(replayed, parsed.tick);
  const staleNames = world.naming !== NAMING_MODEL;
  const comparable = (candidate: World) => {
    // World v13 adds species identity. Every older world was koi-only, so this field carries no historical evidence and
    // is omitted only while proving an old snapshot against its replay. Current v13 snapshots compare it normally.
    // World v14 adds the axolotl shop. An older snapshot has none to prove, so its replayed stock is left out.
    if (sourceVersion < 7) {
      const records = { ...recordsOnly(candidate), circuit: null };
      return JSON.stringify(sourceVersion < 13 ? withoutSpecies(records) : records);
    }
    const named = staleNames ? withoutNamesWorld(candidate) : candidate;
    // Decorations are recorded from world v8; the koi rescue (world v9) starts at its default in every older snapshot.
    // Mutation origins are recorded from world v11 (FS-603); older snapshots rebuild them, so they are compared without.
    const decorated = sourceVersion < 8 ? withoutDecorations(named) : named;
    const originated = sourceVersion < 11 ? withoutOrigins(decorated) : decorated;
    const speciated = sourceVersion < 13 ? withoutSpecies(originated) : originated;
    const stocked = sourceVersion < 14 ? { ...speciated, axolotlShop: null } : speciated;
    return JSON.stringify(sourceVersion < 15 ? { ...stocked, circuit: null } : stocked);
  };
  if (comparable(decodeSave(JSON.stringify(replayed.world))) !== comparable(world)) throw mismatch;
  const simulation = parsed.simulation ?? { version: 1 as const, tankTicks: Object.fromEntries(world.tanks.map(tank => [tank.id, parsed.tick])) };
  const tankIds = new Set(world.tanks.map(tank => tank.id));
  if (Object.keys(simulation.tankTicks).length !== tankIds.size || Object.entries(simulation.tankTicks).some(([id, tick]) => !tankIds.has(id) || tick !== parsed.tick))
    throw new Error('Simulation clocks do not agree with the world tick.');
  if (sourceVersion >= 15 && world.circuit.day !== Math.floor(parsed.tick / TICKS_PER_GAME_DAY)) throw new Error('Calendar does not agree with the world tick.');
  if (legacyWorld || staleNames) {
    if (sourceVersion < 15) world.circuit.day = Math.floor(parsed.tick / TICKS_PER_GAME_DAY);
    // The first delivery arrives at migration, not at the old world's day zero.
    if (sourceVersion < 7) world.shop = initialShop(world.seed, Math.floor(parsed.tick / TICKS_PER_GAME_DAY));
    // An older world had no axolotl shop to store. Its replay from the checkpoint stocked one under the same delivery rules,
    // so the rebased world keeps that stock: deterministic, and what the shop would hold had it existed all along.
    if (sourceVersion < 14) world.axolotlShop = replayed.world.axolotlShop;
    // Existing fish and listings keep their names; only fish named after the rebase use the current model.
    world.naming = NAMING_MODEL;
    // Listings already in the shop keep their genomes; deliveries after the rebase use genome v3 (FS-601).
    world.shop = { ...world.shop, model: SHOP_MODEL };
    return { ...replayed, world, tick: parsed.tick, simulation, checkpoint: { world, tick: parsed.tick, revision: parsed.revision }, events: [] };
  }
  return { ...replayed, world, tick: parsed.tick, simulation };
}

/**
 * Identity, genome, pedigree, ownership, credits and tank records without water, life, demand, ledger state or fish
 * names: what older snapshots can prove. Their journals replay under the current naming model, and names are mutable text.
 */
function recordsOnly(world: World) {
  return {
    ...world, market: null, ledger: null, shop: null, naming: null, axolotlShop: null,
    tanks: world.tanks.map(tank => ({ id: tank.id, name: tank.name, capacity: tank.capacity, planted: tank.planted })),
    fish: world.fish.map(member => ({ ...member, name: null, life: null, breeding: null })),
  };
}

/** Everything a current world v7 snapshot proves except fish and listing names and ledger text, which quotes names. */
function withoutNamesWorld(world: World) {
  return {
    ...world, naming: null,
    fish: world.fish.map(member => ({ ...member, name: null })),
    shop: { ...world.shop, listings: world.shop.listings.map(listing => ({ ...listing, name: null })) },
    axolotlShop: { ...world.axolotlShop, listings: world.axolotlShop.listings.map(listing => ({ ...listing, name: null })) },
    ledger: { ...world.ledger, entries: world.ledger.entries.map(entry => ({ ...entry, detail: null })) },
  };
}

function withoutOrigins<T extends { fish: readonly object[] }>(world: T) {
  return { ...world, fish: world.fish.map(member => ({ ...member, origins: null })) };
}

function withoutSpecies<T extends { fish: readonly object[]; clutches: readonly object[] }>(world: T) {
  return {
    ...world,
    fish: world.fish.map(member => { const { species: _species, ...rest } = member as { species?: unknown }; return rest; }),
    clutches: world.clutches.map(entry => { const { species: _species, ...rest } = entry as { species?: unknown }; return rest; }),
  };
}

function withoutDecorations(world: ReturnType<typeof withoutNamesWorld> | World) {
  return { ...world, tanks: world.tanks.map(({ decorations: _decorations, ...tank }) => tank) };
}

/** Legacy v1 records retain their exact identity, genome, seed and parent links. */
export function importRuntime(raw: string, legacyWorldId: string): Runtime {
  if (raw.length > MAX_SAVE_CHARACTERS) throw new Error('Save exceeds the import size limit.');
  const parsed: unknown = JSON.parse(raw);
  if (parsed && typeof parsed === 'object' && 'schemaVersion' in parsed) return decodeRuntime(raw);
  // A bare save has no journal to replay, so it moves to the current naming and shop models at once.
  const world = decodeSave(raw);
  return createRuntime({ ...world, naming: NAMING_MODEL, shop: { ...world.shop, model: SHOP_MODEL } }, legacyWorldId);
}
