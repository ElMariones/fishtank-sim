import { axolotlFounderGenome } from './axolotlGenetics';
import { goldfishFounderGenome } from './goldfishGenetics';
import { goldfishShowGenome } from './goldfishShop';
import { guppyFounderGenome } from './guppyGenetics';
import { guppyShowGenome } from './guppyShop';
import { SPECIES_INFO } from './species';
import { adultLife, lifeStage } from './development';
import { express, founderGenome, metabolicPotential } from './genetics';
import { newFishName } from './names';
import { clamp, hash, random } from './random';
import type { Fish, Species, World } from './types';
import { awardWinner, judgeComment, scoreField, showFormat, type Scores, type ShowFormat, type TacticId } from './tournament';

export const COMPETITION_TIERS = ['amateur', 'entry', 'regional', 'national', 'pro', 'global'] as const;
export type CompetitionTier = typeof COMPETITION_TIERS[number];
export type CompetitionEvent = { id: string; name: string; city: string; venue: string; tier: CompetitionTier; species: Species; year: number; opensDay: number; closesDay: number; fee: number; prizes: [number, number, number]; theme: number };
export type CompetitionParticipant = { fish: Fish; owner: string; isPlayer: boolean; scores: { presentation: number; pattern: number; condition: number }; total: number; rank: number; comment: string; askingPrice: number; negotiation: { attempts: number; counter: number | null; status: 'open' | 'declined' | 'purchased' }; adjust?: Scores };
/** `show` marks a format-2 run (FS-133, world v22): brief, special award, incident and preparation. Format-1 runs have none. */
export type CompetitionRun = { event: CompetitionEvent; participants: CompetitionParticipant[]; phase: 'exhibition' | 'results'; enteredDay: number; show?: ShowFormat };
export type CompetitionState = { model: 1; day: number; active: CompetitionRun | null; history: CompetitionRun[] };
export const MAX_COMPETITION_HISTORY = 240;
export const CALENDAR_YEAR_DAYS = 360;
export const initialCircuit = (): CompetitionState => ({ model: 1, day: 0, active: null, history: [] });
const cities = ['Kyoto', 'Lisbon', 'Amsterdam', 'Singapore', 'Vancouver', 'Copenhagen', 'Barcelona', 'Osaka', 'Melbourne', 'Stockholm', 'Mexico City', 'Cape Town'];
const venues = ['Glasshouse Pavilion', 'Botanical Conservatory', 'Riverside Hall', 'Pearl Conservatory', 'Harbour Aquarium', 'Water Garden', 'Crystal Atrium', 'Lotus Pavilion'];
const titles = ['Moonlit Waters', 'The Glass Garden', 'Pearl of the River', 'The Gilded Fin', 'Sapphire Society', 'Northern Lights', 'The Lotus Crown', 'Coral & Silk', 'The Emerald Current', 'Silver Tide', 'Velvet Waters', 'Aurora Aquatic'];
const suffixes = ['Showcase', 'Invitational', 'Championship', 'Exhibition', 'Classic', 'Cup'];
export const COMPETITION_KEEPERS = ['Mika Ito', 'Ines Duarte', 'Soren Holm', 'Amara Okafor', 'Ren Takahashi', 'Luca Moretti', 'Mei Chen', 'Elena Costa', 'Noor de Vries', 'Theo Laurent', 'Valeria Cruz', 'Ari Silva'];
const fees = [40, 80, 160, 300, 550, 900];
const pick = <T>(values: readonly T[], rng: () => number) => values[Math.floor(rng() * values.length)];

/** Twelve 30-day exhibition windows per 360-day show year; each event is annual and cannot be entered twice. */
export function competitionSchedule(seed: number, day: number): CompetitionEvent[] {
  const window = Math.floor(day / 30), year = Math.floor(day / CALENDAR_YEAR_DAYS) + 1;
  // Goldfish shows (world v17) join the calendar; each event's draws are keyed by its own ID, so koi and axolotl shows are unchanged.
  // Guppy shows (world v20) join the same way.
  return COMPETITION_TIERS.flatMap((tier, level) => (['koi', 'axolotl', 'goldfish', 'guppy'] as const).map(species => {
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
  if (fish.species !== event.species) return `This is a ${SPECIES_INFO[event.species].one} competition.`;
  if (!['adult', 'elderly'].includes(lifeStage(fish.life, metabolicPotential(fish.genome)))) return 'Adults only — let this animal grow.';
  if (fish.life.condition < 0.7) return 'Needs at least 70% condition.';
  return null;
}
const round = (value: number) => Math.round(value * 10) / 10;
/** Equal-weight species-local phenotype criteria, plus developmental condition; no rarity or market price enters judging. */
export function competitionScores(fish: Fish, event: CompetitionEvent): CompetitionParticipant['scores'] {
  const p = express(fish.genome), a = p.axolotl;
  const style = random(hash(`${event.id}:judges`))();
  if (p.guppy) {
    // Guppies are judged against their strain's standard. Males show tail and color; females are judged as a female class
    // on body, finnage and the faint color they leak. No rarity enters.
    const gp = p.guppy, g = gp.genesis, c = gp.color, male = gp.sex === 'M';
    const tailQuality = male ? clamp(0.4 * gp.tail.rays + 0.3 * gp.tail.spread + 0.3 * gp.tail.length) * (1 - g.finFray) : clamp(gp.body.depth / 0.36) * (1 - g.finFray);
    const presentation = 46 + 28 * gp.strain.standard + 12 * gp.pattern.symmetry + 12 * tailQuality + (gp.fins.dumbo || gp.fins.swallow ? 3 : 0);
    const richness = male ? clamp(0.45 * c.iriAmount + 0.35 * c.redAmount + 0.2 * c.melanin * c.edging) : clamp(c.leak * 2 + 0.3 * c.iriAmount * 0.2);
    const pattern = 46 + 26 * richness + 12 * gp.pattern.edge + 8 * (1 - Math.abs(gp.pattern.scale * 6 - style)) + 6 * gp.pattern.coverage;
    const visible = g.defects.filter(d => !d.rescued && !['lethal', 'frail', 'subfertile'].includes(d.kind)).length;
    const presence = 10 * (male ? gp.behavior.display - 0.5 : gp.bold - 0.5) + 6 * (gp.activity - 0.5) - 7 * visible;
    const novelty = Math.min(6, 2 * g.novelAlleles) - 4 * g.depigment;
    return { presentation: round(clamp(presentation + presence, 0, 100)), pattern: round(clamp(pattern + novelty, 0, 100)), condition: round(fish.life.condition * 100) };
  }
  if (p.goldfish) {
    // Goldfish are judged against their own variety's standard, fin carriage and color richness; no rarity enters.
    const gf = p.goldfish, g = gf.genesis, c = gf.color;
    const finQuality = clamp(gf.fins.rays * 0.6 + 0.4 * clamp(gf.fins.length / 1.6)) * (1 - g.finFray);
    const presentation = 48 + 26 * gf.variety.standard + 12 * gf.pattern.symmetry + 10 * finQuality - (gf.health.buoyancy ? 14 : 0);
    const richness = c.broken ? clamp(c.body.s * (1 - c.whiteShare * 0.4) + 0.4 * Math.abs(c.whiteShare - 0.5) + 0.3 * c.darkAmount * (c.whiteShare > 0.2 ? 1 : 0.5)) : 0.25;
    const pattern = 46 + 26 * richness + 12 * gf.pattern.edge + 8 * (1 - Math.abs(gf.pattern.scale * 3 - style)) + 6 * gf.scales.reflectivity;
    const visible = g.defects.filter(d => !d.rescued && !['lethal', 'frail', 'subfertile'].includes(d.kind)).length;
    const presence = 10 * (gf.bold - 0.5) + 6 * (gf.activity - 0.5) - 7 * visible;
    const novelty = Math.min(6, 2 * g.novelAlleles) - 4 * g.depigment;
    return { presentation: round(clamp(presentation + presence, 0, 100)), pattern: round(clamp(pattern + novelty, 0, 100)), condition: round(fish.life.condition * 100) };
  }
  const presentation = a ? 52 + 24 * a.pattern.symmetry + 14 * a.pigmentation.skinLuster + 10 * clamp(a.morphology.gills.filamentLength / 1.5)
    : 52 + 24 * p.symmetry + 14 * p.metallic + 10 * p.spread;
  const pattern = a ? 48 + 28 * a.pattern.contrast + 16 * a.pattern.density + 8 * (1 - Math.abs(a.pattern.scale - style))
    : 48 + 28 * p.appearance.contrast + 16 * p.appearance.density + 8 * (1 - Math.abs(p.patternScale - style));
  // Genesis animals: bold, active animals present themselves; visible defects cost points; novelties catch the judges' eye.
  const g = p.genesis, bold = a ? a.bold : p.bold, activity = a ? a.activity : p.activity;
  const visible = g ? g.defects.filter(d => !d.rescued && !['lethal', 'frail', 'subfertile'].includes(d.kind)).length : 0;
  const presence = g ? 10 * (bold - 0.5) + 6 * (activity - 0.5) - 7 * visible + (g.fins !== 'standard' ? 4 : 0) : 0;
  const novelty = g ? 6 * g.glow + 5 * g.ghost + Math.min(6, 2 * g.novelAlleles) - 4 * g.depigment : 0;
  return { presentation: round(clamp(presentation + presence, 0, 100)), pattern: round(clamp(pattern + novelty, 0, 100)), condition: round(fish.life.condition * 100) };
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
export function competitionNpc(seed: number, event: CompetitionEvent, fishId: string, genesis = false): Fish {
  const level = COMPETITION_TIERS.indexOf(event.tier);
  let best: Fish | undefined, bestScore = -1;
  for (let attempt = 0; attempt <= level * 3; attempt++) {
    const birthSeed = hash(`${seed}:${event.id}:${fishId}:candidate:${attempt}`);
    // Genesis worlds (shop model 3) field Genesis rivals; older worlds keep the rivals their journals recorded.
    // Goldfish rivals are always goldfish genome v1; from the entry tier up they are show-bred to a variety.
    const sex = birthSeed % 2 ? 'F' : 'M';
    // Guppy rivals' sex comes from their genome; from the entry tier up the males are show-bred to a strain.
    const genome = event.species === 'koi' ? founderGenome(birthSeed, genesis ? 4 : 3) : event.species === 'goldfish' ? (level ? goldfishShowGenome(birthSeed) : goldfishFounderGenome(birthSeed))
      : event.species === 'guppy' ? (level ? guppyShowGenome(birthSeed, sex) : guppyFounderGenome(birthSeed, sex))
      : axolotlFounderGenome(birthSeed, genesis ? 2 : 1);
    const fish: Fish = { id: fishId, name: newFishName(`${event.id}:${fishId}:${attempt}`, { sex, genome }, new Set()), sex, species: event.species, genome, birthSeed,
      generation: 0, parents: null, bornAt: '2026-01-01T00:00:00.000Z', tankId: 'competition', status: 'living', mutations: [], origins: [], life: adultLife(genome), breeding: { model: 1, cooldownDays: 0 } };
    fish.life.condition = 0.78 + level * 0.03 + (hash(`${birthSeed}:condition`) % 700) / 10000;
    const score = totalOf(competitionScores(fish, event));
    if (score > bestScore) { best = fish; bestScore = score; }
  }
  return best!;
}
const askingPrice = (total: number, event: CompetitionEvent) => Math.round(240 + total * 3 + COMPETITION_TIERS.indexOf(event.tier) * 100);
export function createCompetitionRun(world: World, event: CompetitionEvent, entrants: Fish[], format?: 2): CompetitionRun {
  const fish = [...entrants.map(member => structuredClone(member))];
  for (let index = 0; index < 8; index++) {
    if (world.nextId > 999999) throw new Error('Animal identifiers exhausted. Export your world.');
    fish.push(competitionNpc(world.seed, event, `FSH-${String(world.nextId++).padStart(6, '0')}`, world.shop.model >= 3));
  }
  const ownerOf = (member: Fish, index: number) => index < entrants.length ? 'You' : COMPETITION_KEEPERS[hash(`${event.id}:${member.id}:owner`) % COMPETITION_KEEPERS.length];
  if (format === 2) {
    // Format 2: base scores ranked by the brief; judging applies the incident and the player's preparation.
    const show: ShowFormat = { ...showFormat(world.seed, event), tactic: null, awardWinner: null };
    const field = scoreField(event, show, fish.map((member, index) => ({ fish: member, isPlayer: index < entrants.length, owner: ownerOf(member, index) })));
    const participants: CompetitionParticipant[] = field.map((entry, index) => ({ fish: entry.fish, owner: entry.owner, isPlayer: entry.isPlayer, scores: entry.scores, total: entry.total, rank: index + 1,
      comment: '', askingPrice: askingPrice(entry.total, event), negotiation: { attempts: 0, counter: null, status: 'open' }, adjust: entry.adjust }));
    return { event, participants, phase: 'exhibition', enteredDay: world.circuit.day, show };
  }
  const participants: CompetitionParticipant[] = fish.map((member, index) => {
    const scores = competitionScores(member, event), total = totalOf(scores);
    return { fish: member, owner: ownerOf(member, index), isPlayer: index < entrants.length,
      scores, total, rank: 0, comment: '', askingPrice: askingPrice(total, event), negotiation: { attempts: 0, counter: null, status: 'open' } };
  });
  participants.sort((a, b) => b.total - a.total || a.fish.id.localeCompare(b.fish.id));
  participants.forEach((participant, index) => { participant.rank = index + 1; participant.comment = commentFor(participant.fish, event, participant.scores, participant.rank); });
  return { event, participants, phase: 'exhibition', enteredDay: world.circuit.day };
}
/** Judges a format-2 run in place: applies the incident and preparation, re-ranks, writes comments and the special award. */
export function judgeFormat2(run: CompetitionRun, tactic: TacticId): void {
  const show = run.show!, byId = new Map(run.participants.map(p => [p.fish.id, p]));
  const field = scoreField(run.event, show, run.participants.map(p => ({ fish: p.fish, isPlayer: p.isPlayer, owner: p.owner })), tactic);
  show.tactic = tactic;
  run.participants = field.map((entry, index) => ({ ...byId.get(entry.fish.id)!, scores: entry.scores, total: entry.total, rank: index + 1, comment: judgeComment(run.event, show, entry, index + 1), adjust: entry.adjust }));
  show.awardWinner = awardWinner(show.award, field);
  run.phase = 'results';
}
/** What a saved participant must equal: format 1 recomputes FS-124 scores; format 2 replays the brief, incident and preparation. */
function expectedField(seed: number, run: CompetitionRun, event: CompetitionEvent): { id: string; scores: Scores; total: number; comment: string; askingPrice: number; adjust?: Scores }[] {
  if (!run.show) return run.participants.map((p, index) => {
    const scores = competitionScores(p.fish, event), total = totalOf(scores);
    return { id: p.fish.id, scores, total, comment: commentFor(p.fish, event, scores, index + 1), askingPrice: askingPrice(total, event) };
  });
  const show = run.show, format = showFormat(seed, event), results = run.phase === 'results';
  if (show.brief !== format.brief || show.award !== format.award || show.incident !== format.incident || (show.tactic === null) === results || (show.awardWinner === null) === results) throw new Error('Invalid show format.');
  const entries = run.participants.map(p => ({ fish: p.fish, isPlayer: p.isPlayer, owner: p.owner }));
  const base = new Map(scoreField(event, show, entries).map(entry => [entry.fish.id, entry.total]));
  const field = scoreField(event, show, entries, results ? show.tactic! : undefined);
  if (results && show.awardWinner !== awardWinner(show.award, field)) throw new Error('Invalid special award.');
  return field.map((entry, index) => ({ id: entry.fish.id, scores: entry.scores, total: entry.total, adjust: entry.adjust,
    comment: results ? judgeComment(event, show, entry, index + 1) : '', askingPrice: askingPrice(base.get(entry.fish.id)!, event) }));
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
    const expected = expectedField(world.seed, run, event);
    for (const [index, participant] of run.participants.entries()) {
      const fish = participant.fish, owned = world.fish.find(member => member.id === fish.id), want = expected[index];
      if (localIds.has(fish.id) || Number(fish.id.slice(4)) >= world.nextId || eligibility(fish, event) || (fish.species !== 'koi') !== ('species' in fish.genome)) throw new Error('Invalid competition participant.');
      localIds.add(fish.id);
      if (participant.rank !== index + 1 || want.id !== fish.id || JSON.stringify(want.scores) !== JSON.stringify(participant.scores) || participant.total !== want.total
        || participant.comment !== want.comment || participant.askingPrice !== want.askingPrice || JSON.stringify(want.adjust) !== JSON.stringify(participant.adjust)) throw new Error('Invalid competition scores.');
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
        if (participant.owner !== COMPETITION_KEEPERS[hash(`${event.id}:${fish.id}:owner`) % COMPETITION_KEEPERS.length]) throw new Error('Invalid competition keeper.');
        const n = participant.negotiation;
        if ((n.status === 'purchased') !== !!owned || (owned && !sameCompetitionIdentity(fish, owned))) throw new Error('Invalid competition transfer.');
        if ((n.attempts === 0 && (n.counter !== null || n.status !== 'open')) || (n.status === 'declined' && n.attempts !== 3) || (n.status === 'open' && n.attempts === 3)
          || (n.status === 'purchased' && (n.attempts === 0 || n.counter !== null)) || (n.attempts > 0 && n.status !== 'purchased' && (n.counter === null || n.counter < negotiationFloor(event, participant) || n.counter > participant.askingPrice))) throw new Error('Invalid negotiation state.');
        if (run.phase === 'exhibition' && n.attempts > 0) throw new Error('Negotiation started before judging.');
      }
    }
  }
}
