import { MAX_ALLELE_RECORDS, newAlleleRecords, observeFamily, recordLethal } from './atlas';
import { MUTATION_RATE } from './catalog';
import { ADULT_FROM, eggLife, isEgg, lifeStage, maturityAge } from './development';
import { express, inherit, metabolicPotential } from './genetics';
import { newFishName, takenNames } from './names';
import { childOrigins, emptyTrace } from './origins';
import { clamp, hash } from './random';
import type { BlockerCode, BreedingState, Clutch, ClutchStage, Fish, World } from './types';
import { waterStatus } from './water';

/**
 * Breeding model v1 (FS-401/402). Normal breeding pairs an adult female and male that share a tank. Pairing checks hard
 * eligibility and reserves nursery places atomically. Courtship then progresses once per game day while nothing blocks
 * it, and each pausing reason is recorded. When courtship completes, the reserved places become tracked eggs in the
 * nursery and both parents rest. Everything runs at absolute game-day boundaries with basic arithmetic, so replay and
 * every split of time agree. The instant lab `breed` command is unchanged and remains a labeled research shortcut.
 */
export const BREEDING_MODEL = 1;
export const CLUTCH_SIZES = [8, 12, 16, 20, 24] as const;
export type ClutchSize = typeof CLUTCH_SIZES[number];
/** Both parents need at least this condition to start and to continue courting. */
export const BREEDING_CONDITION = 0.7;
/** Game days each parent rests after spawning. */
export const COOLDOWN_DAYS = { F: 8, M: 4 } as const;
/** Courtship progress per game day at average fertility (0.6): two game days. */
export const COURTSHIP_PER_DAY = 0.5;
export const COURTSHIP_RATE_LIMITS = [0.25, 0.75] as const;
/** Water temperatures outside this range pause courtship. */
export const SPAWNING_TEMPERATURE = [18, 28] as const;
/** Real milliseconds per game day at 1×, used only to date eggs from the pairing timestamp. */
export const MS_PER_GAME_DAY = 60_000;
export const BLOCKER_CODES = ['role', 'species', 'unavailable', 'immature', 'condition', 'cooldown', 'busy', 'apart', 'water', 'nursery-missing', 'nursery-full', 'nursery-busy', 'limit'] as const satisfies readonly BlockerCode[];
export const CLUTCH_STAGES = ['courting', 'incubating', 'hatched', 'cancelled'] as const satisfies readonly ClutchStage[];

export const idleBreeding = (): BreedingState => ({ model: 1, cooldownDays: 0 });
export type Blocker = { code: BlockerCode; fishId?: string; message: string; fix: string };
export type PairRequest = { motherId: string; fatherId: string; nurseryId: string; size: number };
export type PopulationLimits = { maxLiving: number; maxRecords: number };

const fishNumber = (id: string) => Number(id.slice(4));
const fishId = (n: number) => `FSH-${n.toString().padStart(6, '0')}`;
export const clutchId = (n: number) => `CL-${n.toString().padStart(6, '0')}`;
const pct = (value: number) => `${Math.round(value * 100)}%`;
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** Nursery places held by courting clutches, in one tank or across the world. */
export const reservedPlaces = (world: Pick<World, 'clutches'>, nurseryId?: string) =>
  world.clutches.reduce((sum, clutch) => clutch.stage === 'courting' && (nurseryId === undefined || clutch.nurseryId === nurseryId) ? sum + clutch.size : sum, 0);

export const courtingClutchOf = (world: Pick<World, 'clutches'>, id: string) =>
  world.clutches.find(clutch => clutch.stage === 'courting' && (clutch.motherId === id || clutch.fatherId === id));

/** The tracked eggs a clutch laid: consecutive IDs from its first fish (a Genesis clutch records how many). */
export function clutchMembers(world: Pick<World, 'fish'>, clutch: Clutch): Fish[] {
  if (!clutch.firstFishId) return [];
  const first = fishNumber(clutch.firstFishId), laid = clutch.outcome?.laid ?? clutch.size;
  return world.fish.filter(member => { const n = fishNumber(member.id); return n >= first && n < first + laid; });
}

/**
 * Genesis clutch size: the reserved places, scaled by both parents' fertility, vigor and load (a legacy parent counts by
 * its fertility alone). At least one egg is always laid.
 */
export function eggsLaid(mother: Fish, father: Fish, reserved: number): number {
  const factor = (fish: Fish) => express(fish.genome).genesis?.clutchFactor ?? (0.45 + 0.6 * metabolicPotential(fish.genome).fertility);
  return Math.max(1, Math.min(reserved, Math.round(reserved * (factor(mother) + factor(father)) / 2)));
}

/** Days until a Genesis animal may court, or 0 once it is old enough (and always 0 for older genomes). */
export function daysToMaturity(fish: Fish): number {
  return Math.max(0, maturityAge(fish.genome) - fish.life.ageDays);
}

/** Hard eligibility for starting courtship. An empty list means the pairing can be committed. */
export function pairingBlockers(world: World, request: PairRequest, limits: PopulationLimits): Blocker[] {
  const blockers: Blocker[] = [], byId = new Map(world.fish.map(member => [member.id, member]));
  const tankName = (id: string) => world.tanks.find(tank => tank.id === id)?.name ?? id;
  const mother = byId.get(request.motherId), father = byId.get(request.fatherId);
  for (const [parent, id, sex] of [[mother, request.motherId, 'F'], [father, request.fatherId, 'M']] as const) {
    if (!parent || parent.status !== 'living') {
      blockers.push({ code: 'unavailable', fishId: id, message: `${parent?.name ?? id} is not a living resident.`, fix: `Choose a living ${sex === 'F' ? 'female' : 'male'}.` });
    } else if (parent.sex !== sex) {
      blockers.push({ code: 'role', fishId: id, message: `${parent.name} is ${parent.sex === 'F' ? 'female' : 'male'}.`, fix: `Choose a ${sex === 'F' ? 'female as the mother' : 'male as the father'}.` });
    }
  }
  if (request.motherId === request.fatherId) blockers.push({ code: 'role', message: 'A fish cannot pair with itself.', fix: 'Choose a female and a male.' });
  if (blockers.length || !mother || !father) return blockers;
  if (mother.species !== father.species) return [{
    code: 'species', message: `${mother.name} is ${mother.species === 'koi' ? 'a koi' : 'an axolotl'} and ${father.name} is ${father.species === 'koi' ? 'a koi' : 'an axolotl'}; only members of the same species can breed.`,
    fix: `Choose a ${mother.species === 'koi' ? 'koi' : 'axolotl'} partner.`,
  }];

  for (const parent of [mother, father]) {
    const potential = metabolicPotential(parent.genome), stage = lifeStage(parent.life, potential), waiting = daysToMaturity(parent);
    if (stage !== 'adult' && stage !== 'elderly') blockers.push({
      code: 'immature', fishId: parent.id,
      message: stage === 'egg' ? `${parent.name} is still an egg.`
        : `${parent.name} is a ${stage} at ${parent.life.lengthCm.toFixed(1)} of ${potential.adultLengthCm.toFixed(0)} cm; fish court from ${Math.ceil(potential.adultLengthCm * ADULT_FROM)} cm.`,
      fix: 'Wait for it to grow; good care speeds growth.',
    });
    else if (waiting > 0) blockers.push({
      code: 'immature', fishId: parent.id,
      message: `${parent.name} is grown but not yet mature: its maturity timing makes it ready to court in ${plural(waiting, 'game day')}.`,
      fix: 'Wait, or select for earlier maturity.',
    });
    if (parent.life.condition < BREEDING_CONDITION) blockers.push({
      code: 'condition', fishId: parent.id, message: `${parent.name}'s condition is ${pct(parent.life.condition)}; courtship needs ${pct(BREEDING_CONDITION)}.`,
      fix: `Fix the care warnings in ${tankName(parent.tankId)} and let it recover.`,
    });
    if (parent.breeding.cooldownDays > 0) blockers.push({
      code: 'cooldown', fishId: parent.id, message: `${parent.name} spawned recently and can court again in ${plural(parent.breeding.cooldownDays, 'game day')}.`,
      fix: 'Wait for the rest to end, or choose another fish.',
    });
    const courting = courtingClutchOf(world, parent.id);
    if (courting) {
      const partner = byId.get(courting.motherId === parent.id ? courting.fatherId : courting.motherId);
      blockers.push({ code: 'busy', fishId: parent.id, message: `${parent.name} is already courting ${partner?.name ?? 'another fish'}.`, fix: 'Cancel that courtship, or wait until it spawns.' });
    }
  }
  if (mother.tankId !== father.tankId) blockers.push({
    code: 'apart', message: `${mother.name} is in ${tankName(mother.tankId)} and ${father.name} is in ${tankName(father.tankId)}.`, fix: 'Move one of them so they share a tank.',
  });

  const nursery = world.tanks.find(tank => tank.id === request.nurseryId);
  if (!nursery) blockers.push({ code: 'nursery-missing', message: 'Choose a nursery tank for the eggs.', fix: 'Pick one of your tanks.' });
  else {
    const holder = world.clutches.find(clutch => clutch.stage === 'courting' && clutch.nurseryId === nursery.id);
    if (holder) blockers.push({
      code: 'nursery-busy', message: `${nursery.name} is already reserved for ${byId.get(holder.motherId)?.name ?? holder.motherId} × ${byId.get(holder.fatherId)?.name ?? holder.fatherId}.`,
      fix: 'Choose another nursery, or wait until that clutch spawns.',
    });
    const residents = world.fish.filter(member => member.status === 'living' && member.tankId === nursery.id).length;
    const free = nursery.capacity - residents - reservedPlaces(world, nursery.id);
    if (free < request.size) blockers.push({
      code: 'nursery-full', message: `${nursery.name} has ${plural(Math.max(0, free), 'free place')}; this clutch needs ${request.size}.`,
      fix: 'Choose a smaller clutch or another nursery, or move fish out.',
    });
  }
  const living = world.fish.filter(member => member.status === 'living').length, reserved = reservedPlaces(world);
  if (living + reserved + request.size > limits.maxLiving) blockers.push({
    code: 'limit', message: `The lab holds at most ${limits.maxLiving.toLocaleString('en')} living fish, counting reserved eggs.`, fix: 'Sell fish to make room.',
  });
  else if (world.fish.length + reserved + request.size > limits.maxRecords) blockers.push({
    code: 'limit', message: `This save supports ${limits.maxRecords.toLocaleString('en')} fish records, counting reserved eggs.`, fix: 'Export your save before starting another lineage.',
  });
  return blockers;
}

/** Reasons an ongoing courtship pauses today. Pairing already guaranteed the hard rules; these can change afterwards. */
export function courtshipBlockers(world: World, pair: Pick<Clutch, 'motherId' | 'fatherId'>): Blocker[] {
  const byId = new Map(world.fish.map(member => [member.id, member])), mother = byId.get(pair.motherId), father = byId.get(pair.fatherId);
  if (!mother || !father || mother.status !== 'living' || father.status !== 'living')
    return [{ code: 'unavailable', message: 'A parent is no longer a living resident.', fix: 'Cancel this courtship.' }];
  if (mother.species !== father.species) return [{ code: 'species', message: 'The recorded parents are different species.', fix: 'Cancel this invalid courtship.' }];
  const blockers: Blocker[] = [];
  if (mother.tankId !== father.tankId) blockers.push({
    code: 'apart', message: `${mother.name} and ${father.name} are in different tanks.`, fix: 'Move them back into one tank.',
  });
  for (const parent of [mother, father]) if (parent.life.condition < BREEDING_CONDITION) blockers.push({
    code: 'condition', fishId: parent.id, message: `${parent.name}'s condition fell to ${pct(parent.life.condition)}; courtship needs ${pct(BREEDING_CONDITION)}.`,
    fix: "Fix the care warnings in its tank and let it recover.",
  });
  const tank = mother.tankId === father.tankId ? world.tanks.find(t => t.id === mother.tankId) : undefined;
  if (tank) {
    const status = waterStatus(tank.water), temperature = tank.water.temperatureC, reasons: string[] = [];
    if (status.oxygen === 'critical') reasons.push('critical oxygen');
    if (status.ammonia === 'high') reasons.push('high ammonia');
    if (temperature < SPAWNING_TEMPERATURE[0] || temperature > SPAWNING_TEMPERATURE[1]) reasons.push(`water at ${temperature.toFixed(1)} °C (spawning needs ${SPAWNING_TEMPERATURE[0]}–${SPAWNING_TEMPERATURE[1]} °C)`);
    if (reasons.length) blockers.push({ code: 'water', message: `${tank.name} has ${reasons.join(' and ')}.`, fix: `Use the care fixes for ${tank.name}.` });
  }
  return blockers;
}

/** Progress per game day: faster for fertile pairs, bounded so every courtship takes two to four game days. */
export function courtshipRate(mother: Fish, father: Fish): number {
  const fertility = (metabolicPotential(mother.genome).fertility + metabolicPotential(father.genome).fertility) / 2;
  return clamp(COURTSHIP_PER_DAY * fertility / 0.6, COURTSHIP_RATE_LIMITS[0], COURTSHIP_RATE_LIMITS[1]);
}

/**
 * One game-day boundary for breeding, after development: rest days count down, courtships progress or record why they
 * paused, completed courtships lay their reserved eggs, and incubating clutches become hatched when no egg remains.
 * Eggs laid today develop from the next boundary. A nursery that somehow cannot hold the eggs pauses instead of overflowing.
 */
export function advanceClutches(world: World): World {
  const resting = world.fish.some(member => member.breeding.cooldownDays > 0);
  if (!resting && !world.clutches.some(clutch => clutch.stage === 'courting' || clutch.stage === 'incubating')) return world;
  let next: World = {
    ...world, clutches: [...world.clutches],
    fish: resting ? world.fish.map(member => member.breeding.cooldownDays > 0 ? { ...member, breeding: { ...member.breeding, cooldownDays: member.breeding.cooldownDays - 1 } } : member) : world.fish,
  };
  for (let i = 0; i < next.clutches.length; i++) {
    const clutch = next.clutches[i], days = clutch.days + 1;
    if (clutch.stage === 'incubating') {
      const members = clutchMembers(next, clutch), hatched = !members.some(member => member.status === 'living' && isEgg(member.life));
      next.clutches[i] = { ...clutch, days, stage: hatched ? 'hatched' : 'incubating' };
      // Genesis worlds learn from every hatched clutch (Genome Atlas).
      if (hatched && next.atlas) {
        const mother = next.fish.find(member => member.id === clutch.motherId), father = next.fish.find(member => member.id === clutch.fatherId);
        if (mother && father) next = { ...next, atlas: observeFamily(next.atlas, mother, father, members.filter(member => member.status === 'living')).atlas };
      }
      continue;
    }
    if (clutch.stage !== 'courting') continue;
    const blockers = courtshipBlockers(next, clutch);
    if (blockers.length) { next.clutches[i] = { ...clutch, days, blockers: [...new Set(blockers.map(blocker => blocker.code))] }; continue; }
    const mother = next.fish.find(member => member.id === clutch.motherId)!, father = next.fish.find(member => member.id === clutch.fatherId)!;
    const progress = Math.min(1, clutch.progress + courtshipRate(mother, father));
    const nursery = next.tanks.find(tank => tank.id === clutch.nurseryId);
    if (progress < 1) { next.clutches[i] = { ...clutch, days, progress, blockers: [] }; continue; }
    const residents = nursery ? next.fish.filter(member => member.status === 'living' && member.tankId === nursery.id).length : 0;
    if (!nursery || residents + reservedPlaces(next, nursery.id) > nursery.capacity) {
      next.clutches[i] = { ...clutch, days, progress, blockers: [nursery ? 'nursery-full' : 'nursery-missing'] };
      continue;
    }
    const bornAt = new Date(Date.parse(clutch.pairedAt) + days * MS_PER_GAME_DAY).toISOString(), eggs: Fish[] = [], taken = takenNames(next);
    const genesis = clutch.genomeVersion === 4, attempts = genesis ? eggsLaid(mother, father, clutch.size) : clutch.size;
    const causes = new Set<string>(), lethalSites: number[] = [];
    let nextId = next.nextId, nonviable = 0;
    for (let k = 0; k < attempts; k++) {
      // Genesis eggs are seeded by their place in the clutch, so a non-viable egg never repeats its genome.
      const birthSeed = genesis ? hash(`${next.seed}:spawn:${clutch.id}:egg:${k}`) : hash(`${next.seed}:spawn:${clutch.id}:${nextId}`);
      const trace = emptyTrace(), result = inherit(mother.genome, father.genome, birthSeed, MUTATION_RATE, clutch.genomeVersion, trace), sex: Fish['sex'] = hash(`sex:${birthSeed}`) % 2 === 0 ? 'F' : 'M';
      const development = genesis ? express(result.genome).genesis : undefined;
      if (development && !development.viable) {
        nonviable++;
        for (const defect of development.defects) if (defect.kind === 'lethal') { causes.add(`${defect.code} ${defect.label}`); lethalSites.push(defect.site); }
        continue;
      }
      eggs.push({
        id: fishId(nextId), name: newFishName(`${next.seed}:fish:${nextId}`, { sex, genome: result.genome }, taken), sex, species: clutch.species, ...result, birthSeed,
        generation: Math.max(mother.generation, father.generation) + 1, parents: [mother.id, father.id], bornAt, tankId: nursery.id,
        status: 'living', life: eggLife(), breeding: idleBreeding(), origins: childOrigins(fishId(nextId), mother, father, trace, result.mutations),
      });
      nextId++;
    }
    const rested = next.fish.map(member => member.id === mother.id || member.id === father.id ? { ...member, breeding: { model: 1 as const, cooldownDays: COOLDOWN_DAYS[member.sex] } } : member);
    next = { ...next, nextId, fish: [...rested, ...eggs] };
    if (genesis) next = withGenesisRecords(next, eggs, clutch.species, lethalSites);
    next.clutches[i] = {
      ...clutch, days, progress, blockers: [], stage: eggs.length ? 'incubating' : 'hatched', spawnedDay: days, firstFishId: eggs[0]?.id ?? null,
      ...(genesis ? { outcome: { laid: eggs.length, nonviable, causes: [...causes].sort() } } : {}),
    };
  }
  return next;
}

/** Name records for new open-ended alleles and lethal defects seen as failed eggs (Genesis, world v16). */
export function withGenesisRecords(world: World, newborn: readonly Fish[], species: Fish['species'], lethalSites: readonly number[]): World {
  let alleles = world.alleles;
  if (alleles) {
    const known = new Set(alleles.map(record => record.id)), added = newborn.flatMap(fish => newAlleleRecords(fish, known));
    if (added.length) alleles = [...alleles, ...added].slice(0, MAX_ALLELE_RECORDS);
  }
  const atlas = world.atlas && lethalSites.length ? recordLethal(world.atlas, species, lethalSites) : world.atlas;
  return { ...world, alleles, atlas };
}

/** One-line breeding readiness for the inspector and pickers. */
export function breedingStatus(world: World, fish: Fish): string {
  if (fish.status !== 'living') return 'Not available';
  const courting = courtingClutchOf(world, fish.id);
  if (courting) {
    const partner = world.fish.find(member => member.id === (courting.motherId === fish.id ? courting.fatherId : courting.motherId));
    return `Courting ${partner?.name ?? 'a partner'} · ${pct(courting.progress)}${courting.blockers.length ? ' · paused' : ''}`;
  }
  const potential = metabolicPotential(fish.genome), stage = lifeStage(fish.life, potential);
  if (stage !== 'adult' && stage !== 'elderly') return stage === 'egg' ? 'Egg' : `Not yet adult (${stage})`;
  const waiting = daysToMaturity(fish);
  if (waiting > 0) return `Grown, matures in ${plural(waiting, 'game day')}`;
  if (fish.breeding.cooldownDays > 0) return `Resting · can court in ${plural(fish.breeding.cooldownDays, 'game day')}`;
  if (fish.life.condition < BREEDING_CONDITION) return `Condition too low to court (${pct(fish.life.condition)})`;
  return 'Ready to court';
}

export type FastBreedRequest = { motherId: string; fatherId: string; tankId: string; count: number };

/**
 * Why a fast-breeding (instant) cross cannot run right now. Mirrors the `breed` command: parents only need to be a
 * living, hatched female and male of one species. Maturity, condition, rest, courtship and a shared tank are skipped;
 * the destination tank and the lab limits must still hold the offspring. An empty list means the cross can run.
 */
export function fastBreedingBlockers(world: World, request: FastBreedRequest, limits: PopulationLimits): Blocker[] {
  const blockers: Blocker[] = [], byId = new Map(world.fish.map(member => [member.id, member]));
  const mother = byId.get(request.motherId), father = byId.get(request.fatherId);
  for (const [parent, id, sex] of [[mother, request.motherId, 'F'], [father, request.fatherId, 'M']] as const) {
    const role = sex === 'F' ? 'female as the mother' : 'male as the father';
    if (!id) blockers.push({ code: 'role', message: `Choose a ${role}.`, fix: 'Pick one in the planner above.' });
    else if (!parent || parent.status !== 'living') blockers.push({ code: 'unavailable', fishId: id, message: `${parent?.name ?? id} is not a living resident.`, fix: `Choose a living ${role}.` });
    else if (parent.sex !== sex) blockers.push({ code: 'role', fishId: id, message: `${parent.name} is ${parent.sex === 'F' ? 'female' : 'male'}.`, fix: `Choose a ${role}.` });
    else if (isEgg(parent.life)) blockers.push({ code: 'immature', fishId: id, message: `${parent.name} is still an egg.`, fix: 'Wait until it hatches.' });
  }
  if (mother && father && mother.species !== father.species) blockers.push({
    code: 'species', message: `${mother.name} and ${father.name} are different species; only members of the same species can breed.`, fix: 'Choose two koi or two axolotls.',
  });
  const tank = world.tanks.find(t => t.id === request.tankId);
  if (!tank) blockers.push({ code: 'nursery-missing', message: 'Choose where the offspring will spawn.', fix: 'Pick one of your tanks.' });
  else {
    const residents = world.fish.filter(member => member.status === 'living' && member.tankId === tank.id).length;
    const free = tank.capacity - residents - reservedPlaces(world, tank.id);
    if (free < request.count) blockers.push({
      code: 'nursery-full', message: `${tank.name} has ${plural(Math.max(0, free), 'free place')}; ${plural(request.count, 'offspring')} need${request.count === 1 ? 's' : ''} ${request.count}.`,
      fix: 'Choose fewer offspring or another tank, or move fish out.',
    });
  }
  const living = world.fish.filter(member => member.status === 'living').length, reserved = reservedPlaces(world);
  if (living + reserved + request.count > limits.maxLiving) blockers.push({
    code: 'limit', message: `The lab holds at most ${limits.maxLiving.toLocaleString('en')} living fish, counting reserved eggs.`, fix: 'Sell fish to make room.',
  });
  else if (world.fish.length + reserved + request.count > limits.maxRecords) blockers.push({
    code: 'limit', message: `This save supports ${limits.maxRecords.toLocaleString('en')} fish records, counting reserved eggs.`, fix: 'Export your save before starting another lineage.',
  });
  return blockers;
}
