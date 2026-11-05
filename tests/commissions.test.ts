import { describe, expect, it } from 'vitest';
import { GENOME_VERSION } from '../src/core/catalog';
import { CODEX } from '../src/core/codex';
import {
  advanceCommissions, canDeliver, closestCandidates, commissionLetter, deliveredReputation, expiredReputation, MAX_ACTIVE, MAX_OFFERS, POST_EVERY_DAYS,
  postOffers, reputationLevel, withdrawnReputation, type Commission,
} from '../src/core/commissions';
import { express, metabolicPotential } from '../src/core/genetics';
import { advanceWorld } from '../src/core/habitat';
import { decodeSave } from '../src/core/save';
import type { Fish, World } from '../src/core/types';
import { TICKS_PER_GAME_DAY } from '../src/core/water';
import { applyCommand, createWorld } from '../src/core/world';

const NOW = '2026-11-05T12:00:00.000Z';
const roundTrip = (world: World) => decodeSave(JSON.stringify(world));
const live = () => createWorld(NOW, 314159, GENOME_VERSION);

/** A world with an adult, lab-bred koi and an accepted commission for a Codex entry it shows. */
function deliverable(): { world: World; fish: Fish; commission: Commission } {
  let world = live();
  const [mother, father] = [world.fish.find(f => f.sex === 'F')!, world.fish.find(f => f.sex === 'M')!];
  world = applyCommand(world, { type: 'breed', motherId: mother.id, fatherId: father.id, tankId: 'tank-2', timestamp: NOW, genomeVersion: GENOME_VERSION, count: 24 });
  // Grow the youngsters to adulthood directly (the calendar path is covered elsewhere).
  world = { ...world, fish: world.fish.map(f => f.parents ? { ...f, life: { ...mother.life, lengthCm: metabolicPotential(f.genome).adultLengthCm } } : f) };
  for (const fish of world.fish.filter(f => f.parents)) {
    const entry = CODEX.find(e => e.species === 'koi' && (() => { try { return e.test(express(fish.genome)); } catch { return false; } })());
    if (!entry) continue;
    const commission: Commission = { id: 'CM-000900', clientId: 'harbour', species: 'koi', entry: entry.key, sex: null, minGeneration: 1, tier: entry.tier, reward: 400,
      postedDay: 0, dueDay: 30, status: 'active', acceptedDay: 0, closedDay: null, fishId: null, fishName: null, reputation: 0 };
    world = { ...world, commissions: { ...world.commissions, nextId: 901, board: [...world.commissions.board.filter(c => c.status === 'offer').slice(0, 1), commission] } };
    return { world, fish, commission };
  }
  throw new Error('no deliverable fixture');
}

describe('commissions (world v20)', () => {
  it('posts the same letters for the same seed, only in live-game worlds', () => {
    const a = live(), b = live();
    expect(a.commissions.board).toHaveLength(MAX_OFFERS);
    expect(a.commissions.board).toEqual(b.commissions.board);
    expect(a.commissions.board.every(c => c.status === 'offer' && c.tier <= reputationLevel(0).cap)).toBe(true);
    expect(createWorld(NOW, 314159).commissions.board).toEqual([]);
    for (const c of a.commissions.board) expect(commissionLetter(c).body).toMatch(/I am looking for/);
    expect(roundTrip(a)).toEqual(a);
  });

  it('accepts up to the active limit and rejects the rest without changing anything', () => {
    let world = live();
    const ids = world.commissions.board.map(c => c.id);
    for (const id of ids.slice(0, MAX_ACTIVE)) world = applyCommand(world, { type: 'accept-commission', commissionId: id });
    expect(world.commissions.board.filter(c => c.status === 'active')).toHaveLength(MAX_ACTIVE);
    const before = JSON.stringify(world);
    expect(() => applyCommand(world, { type: 'accept-commission', commissionId: ids[MAX_ACTIVE] })).toThrow(/at once/);
    expect(JSON.stringify(world)).toBe(before);
    expect(roundTrip(world)).toEqual(world);
  });

  it('declines an offer for free and charges reputation for withdrawing', () => {
    let world = live();
    const [first, second] = world.commissions.board;
    world = applyCommand(world, { type: 'decline-commission', commissionId: first.id });
    expect(world.commissions.history[0]).toMatchObject({ id: first.id, status: 'declined', reputation: 0 });
    world = { ...world, commissions: { ...world.commissions, reputation: 50 } };
    world = applyCommand(applyCommand(world, { type: 'accept-commission', commissionId: second.id }), { type: 'decline-commission', commissionId: second.id });
    expect(world.commissions.reputation).toBe(50 - withdrawnReputation(second));
    expect(world.commissions.history[0]).toMatchObject({ id: second.id, status: 'withdrawn' });
    expect(roundTrip(world)).toEqual(world);
  });

  it('delivers a matching animal: pays, archives it as sold, records the ledger and raises reputation', () => {
    const { world, fish, commission } = deliverable();
    expect(canDeliver(world, commission, fish)).toBe(true);
    expect(closestCandidates(world, commission).some(row => row.fish.id === fish.id && row.ready)).toBe(true);
    const next = applyCommand(world, { type: 'deliver-commission', commissionId: commission.id, fishId: fish.id });
    expect(next.credits).toBe(world.credits + commission.reward);
    expect(next.fish.find(f => f.id === fish.id)!.status).toBe('sold');
    expect(next.ledger.entries.at(-1)).toMatchObject({ reason: 'commission', amount: commission.reward });
    expect(next.ledger.totals.commission).toBe(commission.reward);
    expect(next.commissions.reputation).toBe(deliveredReputation(commission));
    expect(next.commissions.history[0]).toMatchObject({ id: commission.id, status: 'delivered', fishId: fish.id, fishName: fish.name });
    expect(roundTrip(next)).toEqual(next);
  });

  it('rejects a founder or a non-matching animal atomically', () => {
    const { world, commission } = deliverable();
    const founder = world.fish.find(f => !f.parents)!;
    const before = JSON.stringify(world);
    expect(() => applyCommand(world, { type: 'deliver-commission', commissionId: commission.id, fishId: founder.id })).toThrow(/does not meet/);
    expect(JSON.stringify(world)).toBe(before);
  });

  it('expires a missed deadline with a reputation cost, and posts new letters weekly', () => {
    const { world, commission } = deliverable();
    const rich = { ...world, commissions: { ...world.commissions, reputation: 40 } };
    const late = advanceCommissions(rich, commission.dueDay);
    expect(late.commissions.board.some(c => c.id === commission.id)).toBe(false);
    expect(late.commissions.history[0]).toMatchObject({ id: commission.id, status: 'expired' });
    expect(late.commissions.reputation).toBe(40 - expiredReputation(commission));
    const later = advanceWorld(live(), 0, TICKS_PER_GAME_DAY * (POST_EVERY_DAYS + 1));
    expect(later.commissions.refreshedDay).toBeGreaterThanOrEqual(POST_EVERY_DAYS);
    expect(roundTrip(later)).toEqual(later);
    expect(postOffers(live(), 0).commissions.board).toEqual(live().commissions.board);
  });

  it('rejects a save whose delivered letter names an animal that is still living', () => {
    const { world, fish, commission } = deliverable();
    const forged = { ...world, commissions: { ...world.commissions, board: world.commissions.board.filter(c => c.id !== commission.id),
      history: [{ ...commission, status: 'delivered' as const, closedDay: 1, fishId: fish.id, fishName: fish.name, reputation: 10 }] } };
    expect(() => decodeSave(JSON.stringify(forged))).toThrow(/delivered/);
  });
});
