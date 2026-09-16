import { ancestryContributions, standardSimilarity } from './bloodlines';
import { BREEDING_CONDITION, clutchMembers, courtingClutchOf, MS_PER_GAME_DAY, pairingBlockers, reservedPlaces } from './breeding';
import { GENOME_VERSION } from './catalog';
import { isEgg, lifeStage } from './development';
import { founderGenome, inherit, metabolicPotential } from './genetics';
import { originId, parseOriginId } from './origins';
import { createKinshipCache } from './pedigree';
import { hash } from './random';
import { alleleLabel, allelesAt, LOCUS_REGISTRY } from './registry';
import { advanceRuntime, commandEnvelope, createRuntime, decodeRuntime, executeCommand, type Runtime } from './runtime';
import { decodeSave } from './save';
import type { Fish, World } from './types';
import { TICKS_PER_GAME_DAY } from './water';
import { createWorld, MAX_LIVING, MAX_RECORDS, type Command } from './world';

/**
 * FS-605 unusual-line demonstration, for M6's gate: koi to an unusual line with valid ancestry. A seeded world plays
 * through the aquarium's own runtime commands and clock with normal breeding only (no instant lab cross):
 * 1. discover: founder pairs court into both starter tanks until an egg carries a new structural mutation;
 * 2. outcross: the grown carrier courts an unrelated founder, and its offspring carrying the origin are kept;
 * 3. intercross: two carriers court, and offspring with two copies express the new structure;
 * 4. fix: expressing fish found a registered bloodline and court, so the next generation is all unusual.
 * Surplus fish are rehomed as soon as they hatch. The journal is replayed at the end. Nothing touches a player's world.
 */
export const UNUSUAL_LINE_SEED = 605;
export const UNUSUAL_LINE_DAY_LIMIT = 600;
const TIMESTAMP = '2026-09-17T00:00:00.000Z';
const WORLD_ID = 'fs605-unusual-line';
const CLUTCH_SIZE = 24 as const;
/** Structural loci (tail topology, dorsal form, barbel count) and the registry baseline they mutate away from. */
const STRUCTURAL_LOCI = LOCUS_REGISTRY.filter(entry => entry.sinceGenome === 3 && entry.mutationRate < 0.003);

export type LinePhase = 'discover' | 'outcross' | 'intercross' | 'fix' | 'complete';
export type LineEvent = { day: number; phase: LinePhase; text: string };
export type UnusualLineDemo = {
  seed: number; days: number; completed: boolean; events: LineEvent[];
  /** The discovered mutation: its origin, locus and the variant it introduced. */
  mutation: { originId: string; locusId: string; variant: string; firstCarrier: string; discoveredOnDay: number; birthsBefore: number } | null;
  phaseDays: Partial<Record<LinePhase, number>>;
  births: number; clutches: number; rehomed: number; instantCrosses: number;
  generations: { label: string; count: number; carriers: number; expressing: number; pedigreeF: number }[];
  bloodline: { name: string; foundation: string[]; standardTail: string; finalAncestry: number[]; finalSimilarity: number[] } | null;
  /** Every final-generation fish expresses the variant and carries the origin on both copies by descent. */
  finalAllExpress: boolean; finalAllCarryBothCopies: boolean;
  replayed: boolean; replayError: string | null;
  /** The final world, for fixtures that walk ancestry and origins. */
  world: World;
};

/** `target` limits discovery to one structural locus, such as `tail_topology`; by default the first structural mutation counts. */
export function unusualLineDemonstration(seed = UNUSUAL_LINE_SEED, target: 'any' | 'tail_topology' | 'dorsal_form' | 'barbel_count' = 'tail_topology'): UnusualLineDemo {
  let runtime: Runtime = createRuntime(createWorld(TIMESTAMP, seed), `${WORLD_ID}-${seed}`), day = 0, phase: LinePhase = 'discover';
  const events: LineEvent[] = [], commands: Command['type'][] = [], phaseDays: UnusualLineDemo['phaseDays'] = {};
  const kinship = createKinshipCache();
  let line: { originId: string; locus: number; allele: number; carrierId: string } | null = null;
  const wanted = STRUCTURAL_LOCI.filter(entry => target === 'any' || entry.id === target);
  let mutation: UnusualLineDemo['mutation'] = null, bloodline: UnusualLineDemo['bloodline'] = null;
  let births = 0, rehomed = 0, discoveryCourtships = 0, outcrossClutch: string | null = null, intercrossClutch: string | null = null, fixClutch: string | null = null;
  const generations: UnusualLineDemo['generations'] = [];
  const keep = new Set<string>();

  const world = () => runtime.world;
  const byId = (id: string) => world().fish.find(f => f.id === id)!;
  const log = (text: string) => events.push({ day, phase, text });
  const run = (command: Command) => { runtime = executeCommand(runtime, commandEnvelope(runtime, command)); commands.push(command.type); };
  const living = () => world().fish.filter(f => f.status === 'living');
  const founders = () => living().filter(f => !f.parents);
  const ready = (fish: Fish) => fish.status === 'living' && !isEgg(fish.life) && lifeStage(fish.life, metabolicPotential(fish.genome)) === 'adult'
    && fish.life.condition >= BREEDING_CONDITION && fish.breeding.cooldownDays === 0 && !courtingClutchOf(world(), fish.id);
  const copies = (fish: Fish) => line ? fish.origins.filter(origin => origin.id === line!.originId).length : 0;
  const expresses = (fish: Fish) => !!line && allelesAt(fish.genome, LOCUS_REGISTRY[line.locus].id).every(allele => allele === line!.allele);
  const free = (tankId: string) => {
    const tank = world().tanks.find(t => t.id === tankId)!;
    return tank.capacity - living().filter(f => f.tankId === tankId).length - reservedPlaces(world(), tankId);
  };

  /** Courts a pair into a free nursery, moving the father in when needed. Returns the clutch ID, or null when blocked. */
  function court(mother: Fish, father: Fish): string | null {
    const nursery = world().tanks.find(t => free(t.id) >= CLUTCH_SIZE + 1 && !world().clutches.some(c => c.stage === 'courting' && c.nurseryId === t.id));
    if (!nursery) return null;
    if (father.tankId !== mother.tankId) {
      if (free(mother.tankId) < 1) return null;
      run({ type: 'move', fishId: father.id, tankId: mother.tankId });
    }
    const request = { motherId: mother.id, fatherId: father.id, nurseryId: nursery.id, size: CLUTCH_SIZE };
    if (pairingBlockers(world(), request, { maxLiving: MAX_LIVING, maxRecords: MAX_RECORDS }).length) return null;
    run({ type: 'pair', ...request, timestamp: new Date(Date.parse(TIMESTAMP) + day * MS_PER_GAME_DAY).toISOString(), genomeVersion: GENOME_VERSION });
    return world().clutches.at(-1)!.id;
  }

  const hatched = (clutchId: string | null) => !!clutchId && world().clutches.find(c => c.id === clutchId)!.stage === 'hatched';
  const members = (clutchId: string) => clutchMembers(world(), world().clutches.find(c => c.id === clutchId)!);
  const pairF = (clutchId: string) => { kinship.sync(world().fish); const c = world().clutches.find(entry => entry.id === clutchId)!; return kinship.kinship(c.motherId, c.fatherId); };

  function rehomeSurplus() {
    const surplus = living().filter(f => f.parents && !isEgg(f.life) && !keep.has(f.id) && !courtingClutchOf(world(), f.id)).map(f => f.id);
    if (surplus.length) { run({ type: 'rehome-batch', fishIds: surplus }); rehomed += surplus.length; }
  }

  function advanceDay() {
    const before = world().fish.length;
    runtime = advanceRuntime(runtime, runtime.tick + TICKS_PER_GAME_DAY);
    day++;
    births += world().fish.length - before;
  }

  while (day < UNUSUAL_LINE_DAY_LIMIT) {
    if (phase === 'discover') {
      // Every ready founder female courts a ready founder male while a nursery is free.
      const males = founders().filter(f => f.sex === 'M' && ready(f));
      for (const mother of founders().filter(f => f.sex === 'F' && ready(f))) {
        const father = males.shift();
        if (father && court(mother, father)) discoveryCourtships++;
      }
      const found = living().flatMap(f => f.mutations.filter(m => wanted.some(entry => entry.index === m.locus) && m.from === LOCUS_REGISTRY[m.locus].baseline && m.to !== m.from).map(m => ({ fish: f, m })))[0];
      if (found) {
        const entry = LOCUS_REGISTRY[found.m.locus];
        line = { originId: originId(found.fish.id, found.m.locus, found.m.copy), locus: found.m.locus, allele: found.m.to, carrierId: found.fish.id };
        keep.add(found.fish.id);
        mutation = { originId: line.originId, locusId: entry.id, variant: alleleLabel(entry.id, found.m.to), firstCarrier: found.fish.name, discoveredOnDay: day, birthsBefore: births };
        log(`After ${discoveryCourtships} founder courtships of ${CLUTCH_SIZE} eggs each, ${found.fish.name} (${found.fish.id}), one of the first ${births} eggs, carries a new ${entry.id.replaceAll('_', ' ')} mutation, ${alleleLabel(entry.id, found.m.from)} → ${alleleLabel(entry.id, found.m.to)}, on one copy. It will show nothing: the variant is recessive. Other eggs are rehomed once they hatch.`);
        phaseDays.discover = day; phase = 'outcross';
      }
    } else if (phase === 'outcross' && !outcrossClutch) {
      const carrier = byId(line!.carrierId);
      if (ready(carrier)) {
        const partner = founders().filter(f => f.sex !== carrier.sex && ready(f) && !carrier.parents!.includes(f.id))[0];
        if (partner) {
          const [mother, father] = carrier.sex === 'F' ? [carrier, partner] : [partner, carrier];
          outcrossClutch = court(mother, father);
          if (outcrossClutch) log(`The grown carrier ${carrier.name} courts the unrelated founder ${partner.name}.`);
        }
      }
    } else if (phase === 'outcross' && hatched(outcrossClutch)) {
      const f1 = members(outcrossClutch!), carriers = f1.filter(f => copies(f) === 1);
      carriers.forEach(f => keep.add(f.id));
      generations.push({ label: 'Outcross offspring', count: f1.length, carriers: carriers.length, expressing: f1.filter(expresses).length, pedigreeF: pairF(outcrossClutch!) });
      log(`${f1.length} offspring hatched; ${carriers.length} inherited the mutation on one copy and are kept, the rest are rehomed.`);
      phaseDays.outcross = day; phase = 'intercross';
    } else if (phase === 'intercross' && !intercrossClutch) {
      const carriers = living().filter(f => copies(f) === 1 && f.parents && ready(f) && f.id !== line!.carrierId);
      const mother = carriers.find(f => f.sex === 'F'), father = carriers.find(f => f.sex === 'M');
      if (mother && father) {
        intercrossClutch = court(mother, father);
        if (intercrossClutch) log(`Carrier siblings ${mother.name} × ${father.name} court; about a quarter of their offspring should inherit two copies.`);
      }
    } else if (phase === 'intercross' && hatched(intercrossClutch)) {
      const f2 = members(intercrossClutch!), showing = f2.filter(expresses);
      showing.forEach(f => keep.add(f.id));
      generations.push({ label: 'Carrier intercross offspring', count: f2.length, carriers: f2.filter(f => copies(f) === 1).length, expressing: showing.length, pedigreeF: pairF(intercrossClutch!) });
      log(`${f2.length} offspring hatched; ${showing.length} express the new structure with two copies and are kept.`);
      if (showing.some(f => f.sex === 'F') && showing.some(f => f.sex === 'M')) { phaseDays.intercross = day; phase = 'fix'; }
      else { log('Not both sexes expressed it; the carriers court again.'); intercrossClutch = null; }
    } else if (phase === 'fix' && !fixClutch) {
      const showing = living().filter(f => expresses(f) && ready(f));
      const mother = showing.find(f => f.sex === 'F'), father = showing.find(f => f.sex === 'M');
      if (mother && father) {
        if (!bloodline) {
          const foundation = [...showing.filter(f => f.sex === 'F').slice(0, 2), ...showing.filter(f => f.sex === 'M').slice(0, 2)];
          const lineName = `${mutation!.variant.replace(/^./, c => c.toUpperCase())} line`;
          run({ type: 'register-bloodline', name: lineName, foundationIds: foundation.map(f => f.id), timestamp: TIMESTAMP });
          bloodline = { name: lineName, foundation: foundation.map(f => f.name), standardTail: world().bloodlines[0].standard.tail, finalAncestry: [], finalSimilarity: [] };
          log(`Registered the ${lineName} with ${foundation.length} expressing foundation fish.`);
        }
        fixClutch = court(mother, father);
        if (fixClutch) log(`Expressing ${mother.name} × ${father.name} court; every offspring should express the variant.`);
      }
    } else if (phase === 'fix' && hatched(fixClutch)) {
      const f3 = members(fixClutch!), line = world().bloodlines[0], shares = ancestryContributions(world(), line);
      f3.forEach(f => keep.add(f.id));
      generations.push({ label: 'Line offspring', count: f3.length, carriers: f3.filter(f => copies(f) === 1).length, expressing: f3.filter(expresses).length, pedigreeF: pairF(fixClutch!) });
      bloodline!.finalAncestry = f3.map(f => shares.get(f.id) ?? 0);
      bloodline!.finalSimilarity = f3.map(f => standardSimilarity(f, line.standard).overall);
      log(`${f3.length} offspring hatched; ${f3.filter(expresses).length} express the variant. The line is established.`);
      phaseDays.fix = day; phase = 'complete';
      break;
    }
    rehomeSurplus();
    advanceDay();
  }

  const final = fixClutch ? members(fixClutch) : [];
  let replayed = false, replayError: string | null = null;
  try {
    replayed = JSON.stringify(decodeRuntime(JSON.stringify(runtime)).world) === JSON.stringify(decodeSave(JSON.stringify(runtime.world)));
    if (!replayed) replayError = 'The replayed world differs from the saved world.';
  } catch (failure) { replayError = failure instanceof Error ? failure.message : String(failure); }
  return {
    seed, days: day, completed: phase === 'complete', events, mutation, phaseDays, births, rehomed,
    clutches: world().clutches.length, instantCrosses: commands.filter(type => type === 'breed').length, generations, bloodline,
    finalAllExpress: final.length > 0 && final.every(expresses), finalAllCarryBothCopies: final.length > 0 && final.every(f => copies(f) === 2),
    replayed, replayError, world: runtime.world,
  };
}

export type PacingReport = {
  samples: number;
  /** Founder-stock route: the chance one founder carries, or expresses, a variant at each structural locus. */
  founderCarrier: Record<string, number>; founderExpressing: Record<string, number>;
  /** Mutation route: births from standard parents until the first new structural variant, by percentile. */
  birthsToMutation: { p10: number; median: number; p90: number };
  /** Share of first mutations at each locus. */
  firstLocus: Record<string, number>;
};

/**
 * Discovery pacing without a world: exact founder-carrier odds from the registry, and seeded births from standard-structure
 * founder genomes counted until a structural locus first mutates away from its baseline.
 */
export function mutationPacing(samples = 400, seed = 6050): PacingReport {
  const founderCarrier: Record<string, number> = {}, founderExpressing: Record<string, number> = {};
  for (const entry of STRUCTURAL_LOCI) {
    const baseline = entry.alleles[entry.baseline!].founderWeight;
    founderCarrier[entry.id] = 1 - baseline * baseline;
    founderExpressing[entry.id] = (1 - baseline) ** 2;
  }
  const counts: number[] = [], firstLocus: Record<string, number> = Object.fromEntries(STRUCTURAL_LOCI.map(entry => [entry.id, 0]));
  for (let sample = 0; sample < samples; sample++) {
    const standard = (n: number) => {
      const genome = founderGenome(hash(`fs-605:pacing:${seed}:${sample}:${n}`), 3);
      for (const entry of STRUCTURAL_LOCI) { genome.maternal[entry.index] = entry.baseline!; genome.paternal[entry.index] = entry.baseline!; }
      return genome;
    };
    const mother = standard(0), father = standard(1);
    for (let birth = 1; birth <= 20_000; birth++) {
      const { mutations } = inherit(mother, father, hash(`fs-605:pacing-birth:${seed}:${sample}:${birth}`));
      const hit = mutations.find(m => STRUCTURAL_LOCI.some(entry => entry.index === m.locus));
      if (hit) { counts.push(birth); firstLocus[LOCUS_REGISTRY[hit.locus].id]++; break; }
    }
  }
  counts.sort((a, b) => a - b);
  const at = (q: number) => counts[Math.min(counts.length - 1, Math.floor(q * counts.length))];
  return {
    samples, founderCarrier, founderExpressing, birthsToMutation: { p10: at(0.1), median: at(0.5), p90: at(0.9) },
    firstLocus: Object.fromEntries(Object.entries(firstLocus).map(([id, count]) => [id, count / counts.length])),
  };
}

/** Origin check used by fixtures: the first carrier named in an origin ID really recorded that mutation. */
export function originFirstCarrier(world: Pick<World, 'fish'>, id: string): Fish | undefined {
  const parsed = parseOriginId(id);
  return parsed ? world.fish.find(f => f.id === parsed.fishId && f.mutations.some(m => m.locus === parsed.locus && m.copy === parsed.copy)) : undefined;
}
