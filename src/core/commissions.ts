import { courtingClutchOf } from './breeding';
import { GENOME_VERSION, MUTATION_RATE } from './catalog';
import { CODEX_BY_KEY, codexFor, type CodexEntry, type CodexTier } from './codex';
import { isEgg, lifeStage } from './development';
import { recordEntry } from './economy';
import { express, inherit, metabolicPotential } from './genetics';
import { clamp, hash, random } from './random';
import { SPECIES_INFO } from './species';
import type { Fish, Species, World } from './types';

/**
 * Commissions (world v20): letters from NPC clients who want one animal that shows a named Codex phenotype. A letter asks
 * for a species and a Codex entry, sometimes a sex, and always a bred animal of at least some generation, so a commission
 * is a breeding goal with a deadline rather than a purchase. Accept it, breed toward it, and deliver an adult that passes
 * the Codex test: the animal leaves the lab (like a sale), the client pays and your reputation grows. Reputation opens
 * harder (and better paid) letters.
 *
 * Everything is derived from the world seed, the letter number and the day, so the board replays exactly. Letters are
 * posted only in Genesis model 2 worlds (the live game), so research harnesses and recorded journals are unchanged.
 */
export const COMMISSIONS_MODEL = 1;
export const MAX_OFFERS = 3;
export const MAX_ACTIVE = 2;
export const MAX_COMMISSION_HISTORY = 80;
/** New letters arrive at most once per game week. */
export const POST_EVERY_DAYS = 7;
/** An unanswered letter stays on the board this long. */
export const OFFER_DAYS = 10;
/** Days to deliver after accepting, by tier. */
export const DEADLINE_DAYS: Record<CodexTier, number> = { 1: 24, 2: 36, 3: 54, 4: 80 };
export const BASE_REWARD: Record<CodexTier, number> = { 1: 220, 2: 380, 3: 620, 4: 980 };

export type CommissionStatus = 'offer' | 'active' | 'delivered' | 'expired' | 'declined' | 'withdrawn';
export type Commission = {
  id: string; clientId: string; species: Species; entry: string; sex: 'F' | 'M' | null; minGeneration: number; tier: CodexTier; reward: number;
  postedDay: number;
  /** For an offer: the last day it can be accepted. For an accepted commission: the delivery deadline. */
  dueDay: number;
  status: CommissionStatus; acceptedDay: number | null; closedDay: number | null;
  /** The delivered animal (its record stays in the archive) and the reputation this letter changed. */
  fishId: string | null; fishName: string | null; reputation: number;
};
export type CommissionState = { model: 1; nextId: number; refreshedDay: number; reputation: number; board: Commission[]; history: Commission[] };

export const initialCommissions = (): CommissionState => ({ model: 1, nextId: 1, refreshedDay: -POST_EVERY_DAYS, reputation: 0, board: [], history: [] });
export const commissionId = (n: number) => `CM-${n.toString().padStart(6, '0')}`;

export type ReputationLevel = { label: string; from: number; next: number | null; cap: CodexTier; bonus: number };
const LEVELS: readonly ReputationLevel[] = [
  { label: 'Newcomer', from: 0, next: 30, cap: 2, bonus: 0 },
  { label: 'Trusted breeder', from: 30, next: 90, cap: 3, bonus: 0.1 },
  { label: 'Renowned breeder', from: 90, next: 200, cap: 4, bonus: 0.2 },
  { label: 'Master breeder', from: 200, next: null, cap: 4, bonus: 0.3 },
];
export const reputationLevel = (reputation: number): ReputationLevel => [...LEVELS].reverse().find(level => reputation >= level.from)!;
export const deliveredReputation = (c: Pick<Commission, 'tier' | 'minGeneration'>) => 10 * c.tier + 5 * (c.minGeneration - 1);
export const expiredReputation = (c: Pick<Commission, 'tier'>) => 6 * c.tier;
export const withdrawnReputation = (c: Pick<Commission, 'tier'>) => 4 * c.tier;

export type CommissionClient = { id: string; name: string; role: string; place: string; species: Species | null; greetings: readonly string[]; reasons: readonly string[]; signoff: string };
/** Fictional clients. Their letters are flavor; every term that matters is shown as a checklist beside them. */
export const CLIENTS: readonly CommissionClient[] = [
  { id: 'harbour', name: 'Mira Okonkwo', role: 'Secretary, Harbour Aquarist Society', place: 'Lisbon', species: null,
    greetings: ['Dear keeper,', 'Good day from the Society,'], reasons: ['Our spring meeting needs a teaching specimen that shows it clearly.', 'A member is building a display of named phenotypes, and yours would anchor it.'], signoff: 'With thanks, Mira' },
  { id: 'koi-house', name: 'Kenji Arakawa', role: 'Pond builder', place: 'Osaka', species: 'koi',
    greetings: ['Hello,', 'Greetings from the workshop,'], reasons: ['A client’s new garden pond needs a centrepiece.', 'I promised a restaurant owner something nobody else in town has.'], signoff: 'Respectfully, Kenji' },
  { id: 'salamander', name: 'Dr. Inés Duarte', role: 'Regeneration lab', place: 'Mexico City', species: 'axolotl',
    greetings: ['Dear colleague,', 'Hola,'], reasons: ['We need a documented, lab-bred animal for a comparison study.', 'Our outreach tank is missing this one, and the children ask about it every week.'], signoff: 'Warmly, Inés' },
  { id: 'lantern', name: 'Wei Lin', role: 'Lantern Festival committee', place: 'Hangzhou', species: 'goldfish',
    greetings: ['Dear friend of fish,', 'Hello from the festival office,'], reasons: ['The festival bowl needs a fish that people will remember.', 'Our oldest member wishes to see this variety once more.'], signoff: 'Best wishes, Wei' },
  { id: 'aripo', name: 'Anika Ramdial', role: 'Stream ecologist', place: 'Port of Spain', species: 'guppy',
    greetings: ['Hi there,', 'Greetings from the field station,'], reasons: ['I teach how sex-linked color passes from father to son, and I need a clear example.', 'Our visitor centre tank shows the wild form; I want a bred contrast beside it.'], signoff: 'Cheers, Anika' },
  { id: 'fancy-club', name: 'Theo Laurent', role: 'Fancy guppy judge', place: 'Amsterdam', species: 'guppy',
    greetings: ['Dear breeder,', 'Bonjour,'], reasons: ['I want a reference animal for the judges’ training day.', 'Our club’s honor table is empty in this class this year.'], signoff: 'Sincerely, Theo' },
  { id: 'collector', name: 'Noor de Vries', role: 'Private collector', place: 'Copenhagen', species: null,
    greetings: ['Hello,', 'Dear keeper,'], reasons: ['I collect animals that show one trait perfectly, and I pay for patience.', 'My collection has a gap exactly this shape.'], signoff: 'Kind regards, Noor' },
  { id: 'school', name: 'Ms. Amara Okafor', role: 'Biology teacher', place: 'Cape Town', species: null,
    greetings: ['Dear breeder,', 'Hello from our classroom,'], reasons: ['My students are learning Mendel, and a living example beats any diagram.', 'The class voted, and this is the animal they want to meet.'], signoff: 'Thank you, Amara and class 9B' },
];
export const CLIENT_BY_ID = new Map(CLIENTS.map(client => [client.id, client]));

/** The letter's prose: deterministic from the letter number, so it never needs saving. */
export function commissionLetter(c: Commission): { from: CommissionClient; greeting: string; body: string; reason: string; signoff: string } {
  const from = CLIENT_BY_ID.get(c.clientId) ?? CLIENTS[0], entry = CODEX_BY_KEY.get(c.entry), rng = random(hash(`commission-letter:${c.id}`));
  const info = SPECIES_INFO[c.species], want = c.sex ? `${c.sex === 'F' ? 'a female' : 'a male'} ${info.one}` : info.a;
  const name = entry?.name ?? c.entry, generation = c.minGeneration > 1 ? ` bred in your own lab for at least ${c.minGeneration} generations` : ' bred in your own lab';
  return {
    from, greeting: from.greetings[Math.floor(rng() * from.greetings.length)],
    body: `I am looking for ${want} that shows ${name}, an adult${generation}.`,
    reason: from.reasons[Math.floor(rng() * from.reasons.length)], signoff: from.signoff,
  };
}

const livingAdults = (world: Pick<World, 'fish'>, species: Species) => world.fish.filter(fish => fish.status === 'living' && fish.species === species && !isEgg(fish.life)
  && ['adult', 'elderly'].includes(lifeStage(fish.life, metabolicPotential(fish.genome))));

/**
 * Offspring a pair would produce, sampled with fixed seeds: what the board and the breeding lead both read. Guppy pairs
 * must be an XX mother and an XY father; an invalid cross samples nothing.
 */
export function sampleOffspring(world: Pick<World, 'genesisModel' | 'bodyPlan' | 'seed'>, mother: Fish, father: Fish, samples: number, salt: string) {
  const out: ReturnType<typeof express>[] = [];
  for (let k = 0; k < samples; k++) {
    try {
      const genome = inherit(mother.genome, father.genome, hash(`${world.seed}:commission-sample:${salt}:${mother.id}:${father.id}:${k}`), MUTATION_RATE, GENOME_VERSION, undefined, world.genesisModel, world.bodyPlan).genome;
      out.push(express(genome));
    } catch { return out; }
  }
  return out;
}

/** Up to `limit` female × male pairs of a species, best-condition first, deterministic. */
function pairsOf(world: Pick<World, 'fish'>, species: Species, limit: number): [Fish, Fish][] {
  const adults = livingAdults(world, species).sort((a, b) => b.life.condition - a.life.condition || a.id.localeCompare(b.id));
  const females = adults.filter(fish => fish.sex === 'F').slice(0, 4), males = adults.filter(fish => fish.sex === 'M').slice(0, 4), pairs: [Fish, Fish][] = [];
  for (const mother of females) for (const father of males) if (pairs.length < limit) pairs.push([mother, father]);
  return pairs;
}

/** Codex entries the lab's current pairs can plausibly produce next generation (from a fixed offspring sample). */
function reachableEntries(world: World, species: Species, day: number): Set<string> {
  const entries = codexFor(species), found = new Set<string>();
  for (const [mother, father] of pairsOf(world, species, 6)) {
    for (const p of sampleOffspring(world, mother, father, 6, `board:${day}`)) for (const entry of entries) { try { if (entry.test(p)) found.add(entry.key); } catch { /* not this entry */ } }
  }
  return found;
}

const roundTo = (value: number, step: number) => Math.round(value / step) * step;

/** New letters for empty places on the board. Pure and seeded; only Genesis model 2 worlds receive letters. */
export function postOffers(world: World, day: number): World {
  const state = world.commissions;
  if (!state || world.genesisModel !== 2) return world;
  const open = state.board.filter(c => c.status === 'offer').length;
  if (open >= MAX_OFFERS) return { ...world, commissions: { ...state, refreshedDay: day } };
  const living = new Set(world.fish.filter(fish => fish.status === 'living').map(fish => fish.species));
  const pool: Species[] = living.size ? (['koi', 'axolotl', 'goldfish', 'guppy'] as const).filter(species => living.has(species)) : ['koi'];
  const level = reputationLevel(state.reputation), reachable = new Map<Species, Set<string>>(), board = [...state.board];
  let nextId = state.nextId;
  for (let k = open; k < MAX_OFFERS; k++) {
    const id = commissionId(nextId), rng = random(hash(`${world.seed}:commission:${id}`));
    const species = pool[Math.floor(rng() * pool.length)];
    if (!reachable.has(species)) reachable.set(species, reachableEntries(world, species, day));
    const reach = reachable.get(species)!, taken = new Set(board.map(c => c.entry));
    // Already shown by a bred animal here: still possible, but less likely to be asked for.
    const shown = new Set(world.fish.filter(fish => fish.status === 'living' && fish.species === species && fish.generation > 0)
      .flatMap(fish => codexFor(species).filter(entry => { try { return entry.test(express(fish.genome)); } catch { return false; } }).map(entry => entry.key)));
    const candidates = codexFor(species).filter(entry => entry.tier <= level.cap && !taken.has(entry.key));
    if (!candidates.length) { nextId++; continue; }
    const weight = (entry: CodexEntry) => (reach.has(entry.key) ? 4 : 1) * (shown.has(entry.key) ? 0.4 : 1) * (entry.tier === 4 ? 0.6 : 1);
    const total = candidates.reduce((sum, entry) => sum + weight(entry), 0);
    let draw = rng() * total, entry = candidates[candidates.length - 1];
    for (const candidate of candidates) { draw -= weight(candidate); if (draw < 0) { entry = candidate; break; } }
    const minGeneration = (entry.tier >= 3 ? 2 : 1) + (level.cap >= 4 && rng() < 0.3 ? 1 : 0);
    // Guppy strains are sex-limited, so a guppy letter never adds a sex clause; other species sometimes do.
    const sexRoll = rng(), sex = species === 'guppy' ? null : sexRoll < 0.12 ? 'F' : sexRoll < 0.24 ? 'M' : null;
    const clients = CLIENTS.filter(client => client.species === null || client.species === species);
    const client = clients[Math.floor(rng() * clients.length)];
    const reward = roundTo(BASE_REWARD[entry.tier] * (1 + 0.15 * (minGeneration - 1)) * (1 + level.bonus) * (sex ? 1.08 : 1) * (0.9 + 0.2 * rng()), 10);
    board.push({ id, clientId: client.id, species, entry: entry.key, sex, minGeneration, tier: entry.tier, reward, postedDay: day, dueDay: day + OFFER_DAYS,
      status: 'offer', acceptedDay: null, closedDay: null, fishId: null, fishName: null, reputation: 0 });
    nextId++;
  }
  return { ...world, commissions: { ...state, nextId, refreshedDay: day, board } };
}

/** One game-day boundary: unanswered letters lapse, missed deadlines cost reputation, and new letters arrive weekly. */
export function advanceCommissions(world: World, day: number): World {
  const state = world.commissions;
  if (!state) return world;
  let next = world;
  const lapsed = state.board.filter(c => c.dueDay <= day);
  if (lapsed.length) {
    let reputation = state.reputation;
    const expired = lapsed.filter(c => c.status === 'active').map(c => {
      const lost = Math.min(reputation, expiredReputation(c));
      reputation -= lost;
      return { ...c, status: 'expired', closedDay: day, reputation: lost ? -lost : 0 } as Commission;
    });
    next = { ...next, commissions: { ...state, reputation, board: state.board.filter(c => c.dueDay > day), history: [...expired, ...state.history].slice(0, MAX_COMMISSION_HISTORY) } };
  }
  if (day - next.commissions.refreshedDay >= POST_EVERY_DAYS) next = postOffers(next, day);
  return next;
}

/** Why an animal cannot be delivered for this commission, or null when it can. Every clause is checked. */
export function deliveryClauses(world: World, c: Commission, fish: Fish): { label: string; met: boolean }[] {
  const entry = CODEX_BY_KEY.get(c.entry), info = SPECIES_INFO[c.species];
  let shows = false;
  try { shows = !!entry && fish.species === c.species && entry.test(express(fish.genome)); } catch { shows = false; }
  const stage = isEgg(fish.life) ? 'egg' : lifeStage(fish.life, metabolicPotential(fish.genome));
  return [
    { label: `${info.title}`, met: fish.species === c.species },
    { label: `Shows ${entry?.name ?? c.entry}`, met: shows },
    ...(c.sex ? [{ label: c.sex === 'F' ? 'Female' : 'Male', met: fish.sex === c.sex }] : []),
    { label: c.minGeneration > 1 ? `Bred here, generation ${c.minGeneration} or later` : 'Bred in your lab', met: fish.parents !== null && fish.generation >= c.minGeneration },
    { label: 'Adult', met: stage === 'adult' || stage === 'elderly' },
    { label: 'Not courting or carrying a brood', met: !courtingClutchOf(world, fish.id) },
    { label: 'Living resident', met: fish.status === 'living' },
  ];
}

export const canDeliver = (world: World, c: Commission, fish: Fish) => deliveryClauses(world, c, fish).every(clause => clause.met);

/**
 * Animals in the lab closest to a commission: first those that could be delivered now, then those that show the phenotype
 * but miss another clause (too young, too early a generation), best first.
 */
export function closestCandidates(world: World, c: Commission, limit = 6): { fish: Fish; clauses: { label: string; met: boolean }[]; ready: boolean }[] {
  return world.fish.filter(fish => fish.status === 'living' && fish.species === c.species)
    .map(fish => { const clauses = deliveryClauses(world, c, fish); return { fish, clauses, ready: clauses.every(x => x.met), score: clauses.filter(x => x.met).length + (clauses[1].met ? 10 : 0) }; })
    .filter(row => row.clauses[1].met)
    .sort((a, b) => b.score - a.score || b.fish.generation - a.fish.generation || a.fish.id.localeCompare(b.fish.id))
    .slice(0, limit).map(({ fish, clauses, ready }) => ({ fish, clauses, ready }));
}

/** Pairs in the lab whose sampled offspring show the commission's phenotype, with the share of samples that did. */
export function breedingLeads(world: World, c: Commission, limit = 3): { mother: Fish; father: Fish; share: number }[] {
  const entry = CODEX_BY_KEY.get(c.entry);
  if (!entry) return [];
  const leads: { mother: Fish; father: Fish; share: number }[] = [];
  for (const [mother, father] of pairsOf(world, c.species, 12)) {
    const sample = sampleOffspring(world, mother, father, 12, `lead:${c.id}`);
    if (!sample.length) continue;
    const hits = sample.filter(p => { try { return entry.test(p) && (!c.sex || (p.guppy ? p.guppy.sex === c.sex : true)); } catch { return false; } }).length;
    if (hits) leads.push({ mother, father, share: hits / sample.length });
  }
  return leads.sort((a, b) => b.share - a.share || a.mother.id.localeCompare(b.mother.id)).slice(0, limit);
}

// ── Commands. Each validates fully before it changes the draft world it is given (applyCommand clones first). ──

export function acceptCommission(next: World, id: string): void {
  const state = next.commissions, c = state.board.find(entry => entry.id === id);
  if (!c || c.status !== 'offer') throw new Error('That letter is no longer on the board.');
  if (state.board.filter(entry => entry.status === 'active').length >= MAX_ACTIVE) throw new Error(`You can work on ${MAX_ACTIVE} commissions at once. Deliver or withdraw one first.`);
  const day = next.circuit.day;
  Object.assign(c, { status: 'active', acceptedDay: day, dueDay: day + DEADLINE_DAYS[c.tier] });
}

/** Declining an offer is free; withdrawing from an accepted commission costs a little reputation. */
export function declineCommission(next: World, id: string): void {
  const state = next.commissions, c = state.board.find(entry => entry.id === id);
  if (!c || (c.status !== 'offer' && c.status !== 'active')) throw new Error('That letter is no longer on the board.');
  const day = next.circuit.day, active = c.status === 'active', lost = active ? Math.min(state.reputation, withdrawnReputation(c)) : 0;
  next.commissions = {
    ...state, reputation: state.reputation - lost, board: state.board.filter(entry => entry.id !== id),
    history: [{ ...c, status: active ? 'withdrawn' : 'declined', closedDay: day, reputation: lost ? -lost : 0 } as Commission, ...state.history].slice(0, MAX_COMMISSION_HISTORY),
  };
}

export function deliverCommission(next: World, id: string, fishId: string): void {
  const state = next.commissions, c = state.board.find(entry => entry.id === id);
  if (!c || c.status !== 'active') throw new Error('Accept this commission before delivering.');
  const fish = next.fish.find(member => member.id === fishId);
  if (!fish || fish.status !== 'living') throw new Error('This animal is archived or unavailable.');
  const missed = deliveryClauses(next, c, fish).filter(clause => !clause.met);
  if (missed.length) throw new Error(`${fish.name} does not meet this commission: ${missed.map(clause => clause.label.toLowerCase()).join(', ')}.`);
  const day = next.circuit.day, gained = deliveredReputation(c), client = CLIENT_BY_ID.get(c.clientId);
  fish.status = 'sold';
  next.credits += c.reward;
  next.ledger = recordEntry(next.ledger, 'commission', c.reward, 1, `${fish.name} to ${client?.name ?? 'a client'} (${CODEX_BY_KEY.get(c.entry)?.name ?? c.entry})`);
  next.commissions = {
    ...state, reputation: state.reputation + gained, board: state.board.filter(entry => entry.id !== id),
    history: [{ ...c, status: 'delivered', closedDay: day, fishId: fish.id, fishName: fish.name, reputation: gained } as Commission, ...state.history].slice(0, MAX_COMMISSION_HISTORY),
  };
}

/** Days left before a letter lapses or a commission is due; 0 means today is the last day. */
export const daysLeft = (c: Pick<Commission, 'dueDay'>, day: number) => Math.max(0, c.dueDay - day - 1);
/** 0–1 urgency for the deadline meter. */
export const urgency = (c: Commission, day: number) => {
  const span = c.status === 'active' && c.acceptedDay !== null ? c.dueDay - c.acceptedDay : OFFER_DAYS;
  return clamp(1 - (c.dueDay - day) / Math.max(1, span));
};
