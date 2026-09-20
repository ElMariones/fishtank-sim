import { isEgg } from './development';
import { LEDGER_LIMIT } from './economy';
import { ancestorGraph, genealogyIndex, MAX_ANCESTOR_DEPTH } from './genealogy';
import { createKinshipCache } from './pedigree';
import { decodeRuntime, executeCommand, commandEnvelope, createRuntime, advanceRuntime, JOURNAL_LIMIT, type Runtime } from './runtime';
import { decodeSave } from './save';
import { TICKS_PER_GAME_DAY } from './water';
import { createWorld, MAX_LIVING, MAX_RECORDS, type Command } from './world';
import { INCUBATION_DAYS } from './development';
import type { Fish, World } from './types';

/**
 * FS-702 soak: a deep lineage and a large record set, driven only through the live command interface.
 *
 * The point is not that it finishes. It is that after a hundred generations and a few thousand records, every record
 * still validates, nothing that must stay bounded has grown, no identifier has been handed out twice, and the journal
 * still replays into the same world. A soak that only checked it did not crash would pass while quietly corrupting a
 * lineage, which is the failure this project can least afford.
 *
 * Like the other scenario harnesses, it sends real commands and never edits a world directly.
 */

export const SOAK_TIMESTAMP = '2026-09-20T00:00:00.000Z';
export const SOAK_WORLD_ID = 'fs702-soak';

/** Lineage depth. Each generation is a child of the previous one, so `generation` should reach exactly this. */
export const SOAK_GENERATIONS = 100;

/**
 * Fish records the soak grows to.
 *
 * The design caps *living* fish at `MAX_LIVING` (8 tanks x 60 places = 480), so a two-thousand-fish target can only
 * mean records — living plus sold plus rehomed. That is the number that actually grows without a ceiling during play,
 * and therefore the one worth soaking.
 */
export const SOAK_RECORDS = 2000;

/** Offspring per cross. Enough that both sexes appear almost every time without filling a tank. */
const CLUTCH = 8;
/** Larger crosses once the lineage is deep and the soak is only accumulating records. */
const BULK_CLUTCH = 24;
/** Days waited for a clutch to leave the egg stage before the soak gives up. */
const HATCH_WAIT_DAYS = INCUBATION_DAYS + 2;

/**
 * Cost of one command at a given record count.
 *
 * `applyCommand` deep-copies the world (`structuredClone`) so a rejected command cannot leave it half-changed, which
 * means command cost is expected to grow with the record set. The curve is recorded rather than assumed, because the
 * shape is the thing worth knowing: proportional growth is the price of atomicity, anything steeper is a defect.
 */
export type CostSample = { records: number; msPerCommand: number };

/** One failed invariant. An empty list is the pass condition; the text is what a reader needs to act. */
export type SoakProblem = { check: string; detail: string };

export type SoakReport = {
  /** Deepest `generation` value reached by a living fish. */
  generations: number;
  records: number;
  living: number;
  archived: number;
  gameDays: number;
  commands: number;
  /** Structures that must not grow with the world, sampled at the end. */
  bounds: {
    journalEvents: number; journalLimit: number;
    ledgerEntries: number; ledgerLimit: number;
    clutches: number;
    widestAncestorGraph: number; ancestorGraphLimit: number;
    deepestAncestorGraph: number; ancestorDepthLimit: number;
  };
  /**
   * Wall-clock milliseconds.
   *
   * `msPerCommand*` is the figure to watch across runs: applying a command copies the world, so its cost is expected to
   * rise with the record count. A rise steeper than linear would be the leak this soak exists to catch.
   */
  timings: {
    total: number; deepLineage: number; bulkRecords: number; replay: number;
    /** Cost per command over the first ten generations, when the world holds roughly eighty records. */
    msPerCommandEarly: number;
    /** Cost per command over the rest of the deep lineage. */
    msPerCommandLate: number;
    /** Cost per command measured once the record set is full, which is what a late-session player would feel. */
    msPerCommandAtFullSize: number;
  };
  /** Command cost sampled as the record set grew. */
  costCurve: CostSample[];
  /** Empty when the soak passed. */
  problems: SoakProblem[];
};

const living = (world: World) => world.fish.filter(fish => fish.status === 'living');
const hatched = (fish: Fish) => fish.status === 'living' && !isEgg(fish.life);

/** Every identifier the world hands out, checked for reuse in one pass. */
function duplicateIds(world: World, runtime: Runtime): SoakProblem[] {
  const problems: SoakProblem[] = [];
  const seen = (label: string, ids: string[] | number[]) => {
    const set = new Set<string | number>();
    const repeated = new Set<string | number>();
    for (const id of ids) (set.has(id) ? repeated : set).add(id);
    if (repeated.size) problems.push({ check: `unique ${label}`, detail: `${repeated.size} repeated, e.g. ${[...repeated].slice(0, 3).join(', ')}` });
  };
  seen('fish id', world.fish.map(fish => fish.id));
  seen('clutch id', world.clutches.map(clutch => clutch.id));
  seen('ledger sequence', world.ledger.entries.map(entry => entry.seq));
  seen('bloodline id', world.bloodlines.map(line => line.id));
  seen('journal event id', runtime.events.map(event => event.eventId));
  seen('journal command id', runtime.events.map(event => event.command.commandId));
  // A ledger that reordered would reconcile but replay wrong, so sequence order is checked as well as uniqueness.
  const seqs = world.ledger.entries.map(entry => entry.seq);
  if (seqs.some((seq, i) => i > 0 && seq <= seqs[i - 1])) problems.push({ check: 'ledger order', detail: 'sequence numbers are not strictly increasing' });
  return problems;
}

/** Things that must not grow as the world does. A leak here is what makes a long session degrade. */
function boundsProblems(world: World, runtime: Runtime): SoakProblem[] {
  const problems: SoakProblem[] = [];
  const check = (label: string, value: number, limit: number) => {
    if (value > limit) problems.push({ check: label, detail: `${value} exceeds the ${limit} limit` });
  };
  check('journal length', runtime.events.length, JOURNAL_LIMIT - 1);
  check('ledger length', world.ledger.entries.length, LEDGER_LIMIT);
  check('record count', world.fish.length, MAX_RECORDS);
  check('living count', living(world).length, MAX_LIVING);
  check('clutch count', world.clutches.length, MAX_RECORDS);
  return problems;
}

/**
 * Run the soak.
 *
 * `generations` and `records` are lowered by the tests that need a fast version; the recorded evidence run uses the
 * exported defaults.
 */
export function soak(generations = SOAK_GENERATIONS, records = SOAK_RECORDS): SoakReport {
  const startedAt = Date.now();
  const problems: SoakProblem[] = [];
  let runtime = createRuntime(createWorld(SOAK_TIMESTAMP), SOAK_WORLD_ID);
  let day = 0, commands = 0;
  const kinship = createKinshipCache();

  const run = (command: Command) => { runtime = executeCommand(runtime, commandEnvelope(runtime, command)); commands++; };
  const costCurve: CostSample[] = [];
  /** Time a short burst of the cheapest real command there is, so the figure is copy cost and nothing else. */
  const sampleCost = (fishId: string) => {
    const started = Date.now(), burst = 8;
    for (let i = 0; i < burst; i++) run({ type: 'rename', fishId, name: `Soak ${costCurve.length}-${i}` });
    costCurve.push({ records: runtime.world.fish.length, msPerCommand: +((Date.now() - started) / burst).toFixed(3) });
  };
  const advanceDays = (count: number) => { runtime = advanceRuntime(runtime, runtime.tick + count * TICKS_PER_GAME_DAY); day += count; };
  const note = (check: string, detail: string) => { if (problems.length < 40) problems.push({ check, detail }); };

  /** Cross a pair, wait for the eggs to hatch, and return the offspring. */
  const crossAndHatch = (mother: Fish, father: Fish, count: number, tankId: string): Fish[] => {
    const before = new Set(runtime.world.fish.map(fish => fish.id));
    run({ type: 'breed', motherId: mother.id, fatherId: father.id, tankId, count, timestamp: SOAK_TIMESTAMP });
    const bornIds = runtime.world.fish.filter(fish => !before.has(fish.id)).map(fish => fish.id);
    for (let waited = 0; waited < HATCH_WAIT_DAYS; waited++) {
      if (bornIds.every(id => hatched(runtime.world.fish.find(fish => fish.id === id)!))) break;
      advanceDays(1);
    }
    return bornIds.map(id => runtime.world.fish.find(fish => fish.id === id)!);
  };

  /** Archive everyone in `ids`, which is what keeps living fish under the cap while records keep growing. */
  const rehome = (ids: string[]) => {
    if (ids.length) run({ type: 'rehome-batch', fishIds: ids });
  };

  const tankId = runtime.world.tanks[0].id;
  let mother = runtime.world.fish.find(fish => fish.sex === 'F')!;
  let father = runtime.world.fish.find(fish => fish.sex === 'M')!;

  // ---- Phase 1: a hundred generations deep --------------------------------------------------------------------
  const lineageStart = Date.now();
  let earlyCommands = 0, earlyMs = 0;
  for (let generation = 1; generation <= generations; generation++) {
    const offspring = crossAndHatch(mother, father, CLUTCH, tankId);
    const daughter = offspring.find(fish => fish.sex === 'F' && hatched(fish));
    const son = offspring.find(fish => fish.sex === 'M' && hatched(fish));
    if (!daughter || !son) {
      note('lineage continues', `generation ${generation} produced no usable pair from ${offspring.length} offspring`);
      break;
    }
    // Everything except the next pair is archived, along with the parents that are now spent.
    rehome([...offspring.filter(fish => fish.id !== daughter.id && fish.id !== son.id).map(fish => fish.id), mother.id, father.id]);

    if (daughter.generation !== generation || son.generation !== generation) {
      note('generation counter', `expected ${generation}, saw ${daughter.generation} and ${son.generation}`);
    }
    mother = runtime.world.fish.find(fish => fish.id === daughter.id)!;
    father = runtime.world.fish.find(fish => fish.id === son.id)!;

    if (generation === 10) { earlyMs = Date.now() - lineageStart; earlyCommands = commands; }

    // Sampled rather than every generation: these are the expensive checks, and a fault would persist.
    if (generation % 10 === 0 || generation === generations) {
      problems.push(...duplicateIds(runtime.world, runtime), ...boundsProblems(runtime.world, runtime));
      kinship.sync(runtime.world.fish);
      const f = kinship.kinship(mother.id, father.id);
      if (!Number.isFinite(f) || f < 0 || f > 1) note('pedigree F', `generation ${generation} produced ${f}`);
      try {
        decodeSave(JSON.stringify(runtime.world));
      } catch (error) {
        note('save validates', `generation ${generation}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  const deepLineage = Date.now() - lineageStart;
  const lateCommands = commands, lateMs = deepLineage;

  // ---- Phase 2: grow the record set ---------------------------------------------------------------------------
  const bulkStart = Date.now();
  let guard = 0;
  let nextSampleAt = 250;
  while (runtime.world.fish.length < records && guard++ < records) {
    if (runtime.world.fish.length >= nextSampleAt) { sampleCost(mother.id); nextSampleAt += 250; }
    const offspring = crossAndHatch(mother, father, BULK_CLUTCH, tankId);
    const daughter = offspring.find(fish => fish.sex === 'F' && hatched(fish));
    const son = offspring.find(fish => fish.sex === 'M' && hatched(fish));
    // Keep one fresh pair and archive the rest. The outgoing parents are retired only once both replacements exist,
    // so a clutch that happens to be all one sex cannot end the run — and living fish stay at two either way.
    const keep = new Set([daughter?.id, son?.id].filter((id): id is string => Boolean(id)));
    const retiring = offspring.filter(fish => !keep.has(fish.id)).map(fish => fish.id);
    if (daughter && son) retiring.push(mother.id, father.id);
    rehome(retiring);
    if (daughter) mother = runtime.world.fish.find(fish => fish.id === daughter.id)!;
    if (son) father = runtime.world.fish.find(fish => fish.id === son.id)!;
  }
  const bulkRecords = Date.now() - bulkStart;

  // Command cost at full size. A player late in a save feels this, not the early figure, so it is measured directly
  // rather than extrapolated: a handful of renames, which touch one fish and copy the world like any other command.
  sampleCost(mother.id);
  const msPerCommandAtFullSize = costCurve.at(-1)!.msPerCommand;

  // Leave the world populated. A soak that ends with two fish would not have exercised anything that walks the living
  // set, so the last clutch stays in the tank.
  const finalClutch = crossAndHatch(mother, father, BULK_CLUTCH, tankId);
  if (finalClutch.some(fish => !hatched(fish))) note('final clutch hatches', `${finalClutch.filter(fish => !hatched(fish)).length} of ${finalClutch.length} were still eggs`);

  // ---- Final invariants ---------------------------------------------------------------------------------------
  problems.push(...duplicateIds(runtime.world, runtime), ...boundsProblems(runtime.world, runtime));
  try {
    decodeSave(JSON.stringify(runtime.world));
  } catch (error) {
    note('save validates', error instanceof Error ? error.message : String(error));
  }

  // Replay: the snapshot and its journal must decode into the same world, or a reload would not restore this session.
  const replayStart = Date.now();
  try {
    const restored = decodeRuntime(JSON.stringify(runtime));
    if (restored.revision !== runtime.revision) note('replay revision', `${restored.revision} from a runtime at ${runtime.revision}`);
    if (restored.world.fish.length !== runtime.world.fish.length) note('replay records', `${restored.world.fish.length} against ${runtime.world.fish.length}`);
  } catch (error) {
    note('journal replays', error instanceof Error ? error.message : String(error));
  }
  const replay = Date.now() - replayStart;

  // A repeated command must be absorbed, not applied twice; a stale one must be refused before it changes anything.
  const repeated = runtime.events.at(-1);
  if (repeated) {
    const before = runtime.world.fish.length;
    const again = executeCommand(runtime, repeated.command);
    if (again.world.fish.length !== before) note('duplicate command', `replaying a recorded command changed the record count to ${again.world.fish.length}`);
    if (again.revision !== runtime.revision) note('duplicate command', `replaying a recorded command moved the revision to ${again.revision}`);
  } else {
    note('duplicate command', 'the journal was empty, so retry behaviour was not exercised');
  }
  const stale = commandEnvelope(runtime, { type: 'rename', fishId: mother.id, name: 'Stale' });
  try {
    executeCommand(runtime, { ...stale, expectedRevision: stale.expectedRevision - 1 });
    note('stale command', 'a command with a stale expected revision was accepted');
  } catch {
    // Expected: a stale revision is refused before anything changes.
  }

  // Ancestor graphs must stay bounded no matter how deep the lineage runs: 2 + 4 + ... + 64 = 126 distinct ancestors
  // over at most six generations, however many thousand fish stand behind them.
  const ANCESTOR_LIMIT = 126;
  const index = genealogyIndex(runtime.world.fish);
  let widest = 0, deepest = 0;
  for (const fish of living(runtime.world).slice(0, 12)) {
    const graph = ancestorGraph(index, fish.id, MAX_ANCESTOR_DEPTH);
    widest = Math.max(widest, graph.size);
    deepest = Math.max(deepest, graph.generations.length);
  }
  if (widest > ANCESTOR_LIMIT) note('ancestor graph width', `${widest} ancestors exceeds ${ANCESTOR_LIMIT}`);
  if (deepest > MAX_ANCESTOR_DEPTH) note('ancestor graph depth', `${deepest} generations exceeds ${MAX_ANCESTOR_DEPTH}`);

  const world = runtime.world;
  return {
    generations: Math.max(...world.fish.map(fish => fish.generation)),
    records: world.fish.length,
    living: living(world).length,
    archived: world.fish.length - living(world).length,
    gameDays: day,
    commands,
    bounds: {
      journalEvents: runtime.events.length, journalLimit: JOURNAL_LIMIT - 1,
      ledgerEntries: world.ledger.entries.length, ledgerLimit: LEDGER_LIMIT,
      clutches: world.clutches.length,
      widestAncestorGraph: widest, ancestorGraphLimit: ANCESTOR_LIMIT,
      deepestAncestorGraph: deepest, ancestorDepthLimit: MAX_ANCESTOR_DEPTH,
    },
    timings: {
      total: Date.now() - startedAt, deepLineage, bulkRecords, replay,
      msPerCommandEarly: earlyCommands ? +(earlyMs / earlyCommands).toFixed(3) : 0,
      msPerCommandLate: lateCommands > earlyCommands ? +((lateMs - earlyMs) / (lateCommands - earlyCommands)).toFixed(3) : 0,
      msPerCommandAtFullSize,
    },
    costCurve,
    problems,
  };
}
