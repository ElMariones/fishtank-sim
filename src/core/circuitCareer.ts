/**
 * Circuit career (FS-133). Reputation, licences, titles, milestones, season record and rivals are all derived from the
 * saved show history, so there is no second mutable counter that could disagree with the results.
 * Projections are estimates against sampled typical fields, never the real (future) field.
 */
import { CALENDAR_YEAR_DAYS, COMPETITION_TIERS, competitionNpc, competitionScores, eligibility, type CompetitionEvent, type CompetitionParticipant, type CompetitionRun, type CompetitionTier } from './competitions';
import { showFormat, weightedTotal, type BriefId } from './tournament';
import type { Fish, World } from './types';

export const TIER_BASE = [4, 6, 10, 16, 24, 36] as const;
export const LICENCE_REPUTATION = [0, 10, 35, 90, 200, 400] as const;
const placementFactor = (rank: number) => rank === 1 ? 3 : rank === 2 ? 2 : rank === 3 ? 1.5 : rank <= 5 ? 1 : 0.5;

export function finishedRuns(world: World): CompetitionRun[] {
  return world.circuit.active?.phase === 'results' ? [...world.circuit.history, world.circuit.active] : world.circuit.history;
}
const level = (tier: CompetitionTier) => COMPETITION_TIERS.indexOf(tier);
/** Reputation one player entrant earned in one finished show. */
export function entrantReputation(run: CompetitionRun, participant: CompetitionParticipant): number {
  if (!participant.isPlayer || run.phase !== 'results') return 0;
  const base = TIER_BASE[level(run.event.tier)];
  return Math.round(base * placementFactor(participant.rank) + (run.show?.awardWinner === participant.fish.id ? base : 0));
}
export const runReputation = (run: CompetitionRun) => run.participants.reduce((sum, p) => sum + entrantReputation(run, p), 0);
export function reputationOf(runs: CompetitionRun[]): number { return runs.reduce((sum, run) => sum + runReputation(run), 0); }
/** The highest tier licensed by reputation; a tier the world already entered stays licensed (saves made before licences). */
export function licenceLevel(reputation: number, runs: CompetitionRun[]): number {
  const earned = LICENCE_REPUTATION.reduce<number>((best, need, index) => reputation >= need ? index : best, 0);
  const entered = runs.reduce((best, run) => Math.max(best, level(run.event.tier)), 0);
  return Math.max(earned, entered);
}
export function tierUnlocked(world: World, tier: CompetitionTier): boolean {
  const runs = [...world.circuit.history, ...(world.circuit.active ? [world.circuit.active] : [])];
  return level(tier) <= licenceLevel(reputationOf(finishedRuns(world)), runs);
}

export const TITLES = ['Podium Finisher', 'Show Winner', 'Regional Champion', 'National Champion', 'Pro Champion', 'Global Champion'] as const;
/** An animal's highest title from its own placements, or null. */
export function titleOf(runs: CompetitionRun[], fishId: string): string | null {
  let best = -1;
  for (const run of runs) for (const p of run.participants) if (p.fish.id === fishId && run.phase === 'results') {
    if (p.rank <= 3) best = Math.max(best, 0);
    if (p.rank === 1) best = Math.max(best, level(run.event.tier) >= 2 ? level(run.event.tier) : 1);
  }
  return best < 0 ? null : TITLES[best];
}

export type Milestone = { id: string; name: string; detail: string; done: boolean };
export function milestones(runs: CompetitionRun[], reputation: number): Milestone[] {
  const mine = runs.flatMap(run => run.participants.filter(p => p.isPlayer).map(p => ({ run, p })));
  const goldSpecies = new Set(mine.filter(({ p }) => p.rank === 1).map(({ run }) => run.event.species));
  const licence = licenceLevel(reputation, runs);
  return [
    { id: 'debut', name: 'Debut', detail: 'Finish your first show.', done: runs.length > 0 },
    { id: 'podium', name: 'On the podium', detail: 'Place in the top three.', done: mine.some(({ p }) => p.rank <= 3) },
    { id: 'gold', name: 'Best in show', detail: 'Win a show outright.', done: mine.some(({ p }) => p.rank === 1) },
    { id: 'double', name: 'Double podium', detail: 'Both of your entrants place in one show.', done: runs.some(run => run.participants.filter(p => p.isPlayer && p.rank <= 3).length === 2) },
    { id: 'award', name: 'Special award', detail: "Win a show's special award.", done: runs.some(run => run.participants.some(p => p.isPlayer && run.show?.awardWinner === p.fish.id)) },
    ...COMPETITION_TIERS.slice(1).map((tier, index) => ({ id: `licence-${tier}`, name: `${tier[0].toUpperCase()}${tier.slice(1)} licence`, detail: `Reach ${LICENCE_REPUTATION[index + 1]} reputation.`, done: licence >= index + 1 })),
    { id: 'all-rounder', name: 'All-rounder', detail: 'Win gold with three different species.', done: goldSpecies.size >= 3 },
    { id: 'veteran', name: 'Circuit veteran', detail: 'Finish ten shows.', done: runs.length >= 10 },
  ];
}

export type Rival = { keeper: string; wins: number; losses: number; meetings: number };
/** Head-to-head per keeper: your best placing against their best placing in each shared show. */
export function rivals(runs: CompetitionRun[]): Rival[] {
  const table = new Map<string, Rival>();
  for (const run of runs) {
    const mine = Math.min(...run.participants.filter(p => p.isPlayer).map(p => p.rank));
    const best = new Map<string, number>();
    for (const p of run.participants) if (!p.isPlayer) best.set(p.owner, Math.min(best.get(p.owner) ?? 99, p.rank));
    for (const [keeper, rank] of best) {
      const row = table.get(keeper) ?? { keeper, wins: 0, losses: 0, meetings: 0 };
      row.meetings++; if (mine < rank) row.wins++; else row.losses++;
      table.set(keeper, row);
    }
  }
  return [...table.values()].sort((a, b) => b.losses - a.losses || b.meetings - a.meetings || a.keeper.localeCompare(b.keeper));
}

export type Career = {
  reputation: number; licence: number; next: { tier: CompetitionTier; need: number } | null; progress: number;
  season: { year: number; gold: number; silver: number; bronze: number; shows: number }; shows: number; rival: Rival | null; milestones: Milestone[];
};
export function circuitCareer(world: World): Career {
  const runs = finishedRuns(world), all = [...world.circuit.history, ...(world.circuit.active ? [world.circuit.active] : [])];
  const reputation = reputationOf(runs), licence = licenceLevel(reputation, all);
  const nextIndex = licence + 1 < COMPETITION_TIERS.length ? licence + 1 : null;
  const floor = LICENCE_REPUTATION[licence], need = nextIndex === null ? null : LICENCE_REPUTATION[nextIndex];
  const year = Math.floor(world.circuit.day / CALENDAR_YEAR_DAYS) + 1;
  const thisYear = runs.filter(run => run.event.year === year), placings = thisYear.flatMap(run => run.participants.filter(p => p.isPlayer).map(p => p.rank));
  const rivalRows = rivals(runs).filter(r => r.losses > 0);
  return {
    reputation, licence, next: nextIndex === null ? null : { tier: COMPETITION_TIERS[nextIndex], need: need! },
    progress: need === null ? 1 : Math.max(0, Math.min(1, (reputation - floor) / Math.max(1, need - floor))),
    season: { year, gold: placings.filter(r => r === 1).length, silver: placings.filter(r => r === 2).length, bronze: placings.filter(r => r === 3).length, shows: thisYear.length },
    shows: runs.length, rival: rivalRows[0] ?? null, milestones: milestones(runs, reputation),
  };
}

const fieldCache = new Map<string, number[]>();
/** Weighted totals of a sampled typical field for this event, best first (estimate only; cached per seed and event). */
export function typicalField(seed: number, event: CompetitionEvent, genesis: boolean): number[] {
  const key = `${seed}:${event.id}:${genesis}`;
  const cached = fieldCache.get(key);
  if (cached) return cached;
  const brief = showFormat(seed, event).brief;
  const totals = Array.from({ length: 6 }, (_, i) => weightedTotal(competitionScores(competitionNpc(seed ^ 0x5eed, event, `FSH-9${String(i).padStart(5, '0')}`, genesis), event), brief)).sort((a, b) => b - a);
  if (fieldCache.size > 400) fieldCache.clear();
  fieldCache.set(key, totals);
  return totals;
}
export type Projection = { total: number; low: number; high: number; band: 'podium' | 'contender' | 'outsider' };
/** Estimated finishing band for one animal: base scores under the brief, placed among a sampled typical field of eight. */
export function projectEntry(seed: number, event: CompetitionEvent, fish: Fish, genesis: boolean, brief: BriefId = showFormat(seed, event).brief): Projection {
  const total = weightedTotal(competitionScores(fish, event), brief), field = typicalField(seed, event, genesis);
  const beaten = field.filter(t => t > total).length, scaled = beaten * 8 / field.length;
  const low = Math.max(1, Math.floor(scaled)), high = Math.min(9, Math.ceil(scaled) + 2);
  return { total, low, high, band: high <= 4 ? 'podium' : low <= 4 ? 'contender' : 'outsider' };
}
export type Recommendation = { event: CompetitionEvent; fish: Fish; projection: Projection; eligible: number };
/** The player's best eligible animal for each open, licensed, not-yet-entered event, strongest projections first. */
export function recommendations(world: World, events: CompetitionEvent[]): Recommendation[] {
  const entered = new Set(world.circuit.history.map(run => run.event.id)), genesis = world.shop.model >= 3;
  const living = world.fish.filter(f => f.status === 'living');
  const out: Recommendation[] = [];
  for (const event of events) {
    if (entered.has(event.id) || !tierUnlocked(world, event.tier) || world.circuit.day < event.opensDay || world.circuit.day >= event.closesDay) continue;
    const ready = living.filter(f => f.species === event.species && !eligibility(f, event));
    if (!ready.length) continue;
    const brief = showFormat(world.seed, event).brief;
    const best = ready.map(fish => ({ fish, projection: projectEntry(world.seed, event, fish, genesis, brief) })).sort((a, b) => b.projection.total - a.projection.total)[0];
    out.push({ event, ...best, eligible: ready.length });
  }
  const order = { podium: 0, contender: 1, outsider: 2 };
  return out.sort((a, b) => order[a.projection.band] - order[b.projection.band] || level(b.event.tier) - level(a.event.tier) || b.projection.total - a.projection.total);
}
