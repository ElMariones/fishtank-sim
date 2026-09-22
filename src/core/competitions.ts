import { axolotlFounderGenome } from './axolotlGenetics';
import { adultLife, lifeStage } from './development';
import { express, founderGenome, metabolicPotential } from './genetics';
import { newFishName } from './names';
import { clamp, hash, random } from './random';
import type { Fish, Species, World } from './types';

export const COMPETITION_TIERS = ['amateur', 'entry', 'regional', 'national', 'pro', 'global'] as const;
export type CompetitionTier = typeof COMPETITION_TIERS[number];
export type CompetitionEvent = { id: string; name: string; city: string; venue: string; tier: CompetitionTier; species: Species; year: number; opensDay: number; closesDay: number; fee: number; prizes: [number, number, number]; theme: number };
export type CompetitionParticipant = { fish: Fish; owner: string; isPlayer: boolean; scores: { presentation: number; pattern: number; condition: number }; total: number; rank: number; comment: string; askingPrice: number; negotiation: { attempts: number; counter: number | null; status: 'open' | 'declined' | 'purchased' } };
export type CompetitionRun = { event: CompetitionEvent; participants: CompetitionParticipant[]; phase: 'exhibition' | 'results'; enteredDay: number };
export type CompetitionState = { model: 1; day: number; active: CompetitionRun | null; history: CompetitionRun[] };
export const MAX_COMPETITION_HISTORY = 240;
export const CALENDAR_YEAR_DAYS = 360;
export const initialCircuit = (): CompetitionState => ({ model: 1, day: 0, active: null, history: [] });
const cities = ['Kyoto', 'Lisbon', 'Amsterdam', 'Singapore', 'Vancouver', 'Copenhagen', 'Barcelona', 'Osaka', 'Melbourne', 'Stockholm', 'Mexico City', 'Cape Town'];
const venues = ['Glasshouse Pavilion', 'Botanical Conservatory', 'Riverside Hall', 'Pearl Conservatory', 'Harbour Aquarium', 'Water Garden', 'Crystal Atrium', 'Lotus Pavilion'];
const titles = ['Moonlit Waters', 'The Glass Garden', 'Pearl of the River', 'The Gilded Fin', 'Sapphire Society', 'Northern Lights', 'The Lotus Crown', 'Coral & Silk', 'The Emerald Current', 'Silver Tide', 'Velvet Waters', 'Aurora Aquatic'];
const suffixes = ['Showcase', 'Invitational', 'Championship', 'Exhibition', 'Classic', 'Cup'];
const keepers = ['Mika Ito', 'Ines Duarte', 'Soren Holm', 'Amara Okafor', 'Ren Takahashi', 'Luca Moretti', 'Mei Chen', 'Elena Costa', 'Noor de Vries', 'Theo Laurent', 'Valeria Cruz', 'Ari Silva'];
const fees = [40, 80, 160, 300, 550, 900];
const pick = <T>(values: readonly T[], rng: () => number) => values[Math.floor(rng() * values.length)];

/** Twelve 30-day exhibition windows per 360-day show year; each event is annual and cannot be entered twice. */
export function competitionSchedule(seed: number, day: number): CompetitionEvent[] {
  const window = Math.floor(day / 30), year = Math.floor(day / CALENDAR_YEAR_DAYS) + 1;
  return COMPETITION_TIERS.flatMap((tier, level) => (['koi', 'axolotl'] as const).map(species => {
    const id = `SHOW-${window}-${tier}-${species}`, rng = random(hash(`${seed}:circuit:1:${id}`));
    return { id, name: `${pick(titles, rng)} ${pick(suffixes, rng)}`, city: pick(cities, rng), venue: pick(venues, rng), tier, species, year,
      opensDay: window * 30, closesDay: (window + 1) * 30, fee: fees[level], prizes: [fees[level] * 5, fees[level] * 3, fees[level] * 2] as [number, number, number], theme: Math.floor(rng() * 4) };
  }));
}
export function calendarLabel(day: number): string {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${day % 30 + 1} ${months[Math.floor(day / 30) % 12]} · Year ${Math.floor(day / CALENDAR_YEAR_DAYS) + 1}`;
}
export function eligibility(fish: Fish, event: CompetitionEvent): string | null {
  if (fish.status !== 'living') return 'Only living residents can enter.';
  if (fish.species !== event.species) return `This is a ${event.species === 'koi' ? 'koi' : 'axolotl'} competition.`;
  if (!['adult', 'elderly'].includes(lifeStage(fish.life, metabolicPotential(fish.genome)))) return 'Adults only — let this animal grow.';
  if (fish.life.condition < 0.7) return 'Needs at least 70% condition.';
  return null;
}
const round = (value: number) => Math.round(value * 10) / 10;
/** Equal-weight species-local phenotype criteria, plus developmental condition; no rarity or market price enters judging. */
export function competitionScores(fish: Fish, event: CompetitionEvent): CompetitionParticipant['scores'] {
  const p = express(fish.genome), a = p.axolotl;
  const style = random(hash(`${event.id}:judges`))();
  const presentation = a ? 52 + 24 * a.pattern.symmetry + 14 * a.pigmentation.skinLuster + 10 * clamp(a.morphology.gills.filamentLength / 1.5)
    : 52 + 24 * p.symmetry + 14 * p.metallic + 10 * p.spread;
  const pattern = a ? 48 + 28 * a.pattern.contrast + 16 * a.pattern.density + 8 * (1 - Math.abs(a.pattern.scale - style))
    : 48 + 28 * p.appearance.contrast + 16 * p.appearance.density + 8 * (1 - Math.abs(p.patternScale - style));
  return { presentation: round(clamp(presentation, 0, 100)), pattern: round(clamp(pattern, 0, 100)), condition: round(fish.life.condition * 100) };
}
const totalOf = (scores: CompetitionParticipant['scores']) => round((scores.presentation + scores.pattern + scores.condition) / 3);
const praise = ['A beautifully composed exhibit', 'A memorable presence in the glass', 'A specimen with unmistakable character', 'A wonderfully assured entry', 'An elegant expression of its lineage', 'A compelling individual', 'A striking moment in this year’s show', 'An exhibit the panel will remember'];
const critique = ['Further polish here could move it up the field.', 'There is room to build on this result next season.', 'That is the clearest opportunity for its next exhibition.', 'A stronger showing there would make this entry harder to overlook.', 'This gives its keeper a useful focus for the next show.', 'The panel sees real potential for a future return.'];
const finishes = ['The gold belongs to a convincing all-round performance.', 'A deserved place beside the champion.', 'A podium finish against a strong field.', 'A valued contribution to a distinctive field.'];
function commentFor(fish: Fish, event: CompetitionEvent, scores: CompetitionParticipant['scores'], rank: number): string {
  const rng = random(hash(`${event.id}:${fish.id}:comment`));
  const ordered = (Object.keys(scores) as (keyof typeof scores)[]).sort((a, b) => scores[b] - scores[a]);
  return `${pick(praise, rng)}. ${ordered[0][0].toUpperCase() + ordered[0].slice(1)} led at ${scores[ordered[0]].toFixed(1)}; ${ordered[2]} scored ${scores[ordered[2]].toFixed(1)}. ${pick(critique, rng)} ${finishes[Math.min(rank - 1, 3)]}`;
}
/** NPC entrants are real, stable genome snapshots; higher tiers select stronger candidates rather than inflating scores. */
export function competitionNpc(seed: number, event: CompetitionEvent, fishId: string): Fish {
  const level = COMPETITION_TIERS.indexOf(event.tier);
  let best: Fish | undefined, bestScore = -1;
  for (let attempt = 0; attempt <= level * 3; attempt++) {
    const birthSeed = hash(`${seed}:${event.id}:${fishId}:candidate:${attempt}`);
    const genome = event.species === 'koi' ? founderGenome(birthSeed, 3) : axolotlFounderGenome(birthSeed);
    const sex = birthSeed % 2 ? 'F' : 'M';
    const fish: Fish = { id: fishId, name: newFishName(`${event.id}:${fishId}:${attempt}`, { sex, genome }, new Set()), sex, species: event.species, genome, birthSeed,
      generation: 0, parents: null, bornAt: '2026-01-01T00:00:00.000Z', tankId: 'competition', status: 'living', mutations: [], origins: [], life: adultLife(genome), breeding: { model: 1, cooldownDays: 0 } };
    fish.life.condition = 0.78 + level * 0.03 + (hash(`${birthSeed}:condition`) % 700) / 10000;
    const score = totalOf(competitionScores(fish, event));
    if (score > bestScore) { best = fish; bestScore = score; }
  }
  return best!;
}
export function createCompetitionRun(world: World, event: CompetitionEvent, entrants: Fish[]): CompetitionRun {
  const fish = [...entrants.map(member => structuredClone(member))];
  for (let index = 0; index < 8; index++) {
    if (world.nextId > 999999) throw new Error('Animal identifiers exhausted. Export your world.');
    fish.push(competitionNpc(world.seed, event, `FSH-${String(world.nextId++).padStart(6, '0')}`));
  }
  const participants: CompetitionParticipant[] = fish.map((member, index) => {
    const scores = competitionScores(member, event), total = totalOf(scores);
    return { fish: member, owner: index < entrants.length ? 'You' : keepers[hash(`${event.id}:${member.id}:owner`) % keepers.length], isPlayer: index < entrants.length,
      scores, total, rank: 0, comment: '', askingPrice: Math.round(240 + total * 3 + COMPETITION_TIERS.indexOf(event.tier) * 100), negotiation: { attempts: 0, counter: null, status: 'open' } };
  });
  participants.sort((a, b) => b.total - a.total || a.fish.id.localeCompare(b.fish.id));
  participants.forEach((participant, index) => { participant.rank = index + 1; participant.comment = commentFor(participant.fish, event, participant.scores, participant.rank); });
  return { event, participants, phase: 'exhibition', enteredDay: world.circuit.day };
}
export function negotiationFloor(event: CompetitionEvent, participant: CompetitionParticipant): number {
  return Math.ceil(participant.askingPrice * (0.72 + (hash(`${event.id}:${participant.fish.id}:reserve`) % 160) / 1000));
}
/** Immutable identity remains linked to purchased/archived fish even when their name, location or condition later changes. */
export function sameCompetitionIdentity(a: Fish, b: Fish): boolean {
  return a.id === b.id && a.birthSeed === b.birthSeed && a.species === b.species && a.sex === b.sex && a.bornAt === b.bornAt
    && a.generation === b.generation && JSON.stringify(a.genome) === JSON.stringify(b.genome) && JSON.stringify(a.parents) === JSON.stringify(b.parents)
    && JSON.stringify(a.origins) === JSON.stringify(b.origins) && JSON.stringify(a.mutations) === JSON.stringify(b.mutations);
}
export function validateCircuit(world: World): void {
  const runs = [...world.circuit.history, ...(world.circuit.active ? [world.circuit.active] : [])], seen = new Set<string>(), npcIds = new Set<string>();
  for (const run of runs) {
    const event = competitionSchedule(world.seed, run.enteredDay).find(candidate => candidate.id === run.event.id);
    if (!event || JSON.stringify(event) !== JSON.stringify(run.event) || seen.has(event.id) || run.enteredDay > world.circuit.day) throw new Error('Invalid competition schedule or duplicate entry.');
    if (world.circuit.history.includes(run) && run.phase !== 'results') throw new Error('Competition history contains an unfinished show.');
    seen.add(event.id);
    const players = run.participants.filter(p => p.isPlayer), localIds = new Set<string>();
    if (players.length < 1 || players.length > 2 || run.participants.length !== players.length + 8) throw new Error('Invalid competition field.');
    for (const [index, participant] of run.participants.entries()) {
      const fish = participant.fish, owned = world.fish.find(member => member.id === fish.id), scores = competitionScores(fish, event);
      if (localIds.has(fish.id) || Number(fish.id.slice(4)) >= world.nextId || eligibility(fish, event) || (fish.species === 'axolotl') !== ('species' in fish.genome)) throw new Error('Invalid competition participant.');
      localIds.add(fish.id);
      if (participant.rank !== index + 1 || JSON.stringify(scores) !== JSON.stringify(participant.scores) || participant.total !== totalOf(scores)
        || participant.comment !== commentFor(fish, event, scores, participant.rank) || participant.askingPrice !== Math.round(240 + participant.total * 3 + COMPETITION_TIERS.indexOf(event.tier) * 100)) throw new Error('Invalid competition scores.');
      const previous = run.participants[index - 1];
      if (previous && (previous.total < participant.total || (previous.total === participant.total && previous.fish.id.localeCompare(fish.id) > 0))) throw new Error('Invalid competition ranking.');
      if (participant.isPlayer) {
        if (!owned || !sameCompetitionIdentity(fish, owned) || participant.owner !== 'You' || participant.negotiation.status !== 'open' || participant.negotiation.attempts !== 0 || participant.negotiation.counter !== null) throw new Error('Invalid player competition identity.');
      } else {
        if (npcIds.has(fish.id)) throw new Error('Duplicate competition NPC identity.');
        npcIds.add(fish.id);
        if (JSON.stringify(fish) !== JSON.stringify(competitionNpc(world.seed, event, fish.id))) {
          // Zod canonicalizes object key order, so identity and developmental fields are compared structurally.
          const expected = competitionNpc(world.seed, event, fish.id);
          if (!sameCompetitionIdentity(fish, expected) || JSON.stringify(fish.life) !== JSON.stringify(expected.life) || fish.name !== expected.name || fish.tankId !== expected.tankId || fish.status !== expected.status || fish.breeding.cooldownDays !== 0) throw new Error('Invalid competition NPC snapshot.');
        }
        if (participant.owner !== keepers[hash(`${event.id}:${fish.id}:owner`) % keepers.length]) throw new Error('Invalid competition keeper.');
        const n = participant.negotiation;
        if ((n.status === 'purchased') !== !!owned || (owned && !sameCompetitionIdentity(fish, owned))) throw new Error('Invalid competition transfer.');
        if ((n.attempts === 0 && (n.counter !== null || n.status !== 'open')) || (n.status === 'declined' && n.attempts !== 3) || (n.status === 'open' && n.attempts === 3)
          || (n.status === 'purchased' && (n.attempts === 0 || n.counter !== null)) || (n.attempts > 0 && n.status !== 'purchased' && (n.counter === null || n.counter < negotiationFloor(event, participant) || n.counter > participant.askingPrice))) throw new Error('Invalid negotiation state.');
        if (run.phase === 'exhibition' && n.attempts > 0) throw new Error('Negotiation started before judging.');
      }
    }
  }
}
