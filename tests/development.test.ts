import { describe, expect, it } from 'vitest';
import {
  adultLife, CONDITION_RESPONSE, developDay, eggLife, environmentFor, environmentLimits, HATCH_LENGTH_CM, INCUBATION_DAYS, lifeStage,
  STOCK_AGE_DAYS, type Environment,
} from '../src/core/development';
import { LOCI } from '../src/core/catalog';
import { founderGenome, metabolicPotential } from '../src/core/genetics';
import { advanceWorld, tankLoad } from '../src/core/habitat';
import { advanceRuntime, commandEnvelope, createRuntime, decodeRuntime, executeCommand } from '../src/core/runtime';
import { decodeSave } from '../src/core/save';
import type { LifeState, World } from '../src/core/types';
import { defaultWater, TICKS_PER_GAME_DAY } from '../src/core/water';
import { applyCommand, createWorld, type Command } from '../src/core/world';

const NOW = '2026-09-13T12:00:00.000Z';
const DAY = TICKS_PER_GAME_DAY;
const breedStudio: Command = { type: 'breed', motherId: 'FSH-000001', fatherId: 'FSH-000002', tankId: 'tank-2', timestamp: NOW, genomeVersion: 2 };
/** A founder genome with growth potential exactly 1, so timings reflect the base rate. */
const genome = (() => {
  const base = founderGenome(302), index = LOCI.indexOf('growth_rate');
  base.maternal[index] = 2; base.paternal[index] = 3;
  return base;
})();
const potential = metabolicPotential(genome);
const clean = defaultWater();
const conditions = {
  healthy: environmentFor(clean, 5),
  crowded: environmentFor(clean, 16),
  ammonia: environmentFor({ ...clean, ammoniaMgL: 2 }, 5),
  hypoxic: environmentFor({ ...clean, oxygenMgL: 3 }, 5),
} satisfies Record<string, Environment>;

function raise(days: number, environment: (day: number) => Environment, start: LifeState = eggLife()): LifeState[] {
  const history = [start];
  for (let day = 1; day <= days; day++) history.push(developDay(history[day - 1], potential, environment(day)));
  return history;
}

describe('FS-302 life stages and accumulated growth', () => {
  it('declares environment factors that fall with low oxygen, ammonia and crowding', () => {
    expect(potential.growth).toBe(1);
    expect(conditions.healthy).toMatchObject({ oxygen: 1, ammonia: 1, crowding: 1, nutrition: 1, overall: 1 });
    expect(conditions.hypoxic.overall).toBeCloseTo(0.475, 12);
    expect(conditions.ammonia.overall).toBeCloseTo(0.5, 12);
    expect(conditions.crowded.overall).toBeCloseTo(2 / 3, 12);
    expect(environmentFor({ ...clean, oxygenMgL: 0, ammoniaMgL: 10 }, 100).overall).toBeCloseTo(0.1 * 0.4, 12);
    expect(environmentLimits(environmentFor({ ...clean, oxygenMgL: 3 }, 16))).toEqual(['low oxygen', 'crowding']);
    expect(environmentLimits(conditions.healthy)).toEqual([]);
  });

  it('hatches eggs on schedule and grows a healthy fish to adulthood within the 18–30 game-day design range', () => {
    const history = raise(60, () => conditions.healthy);
    for (let day = 0; day < INCUBATION_DAYS; day++) expect(lifeStage(history[day], potential)).toBe('egg');
    expect(history[INCUBATION_DAYS].lengthCm).toBe(HATCH_LENGTH_CM);
    const adultDay = history.findIndex(life => lifeStage(life, potential) === 'adult');
    expect(adultDay).toBeGreaterThanOrEqual(18);
    expect(adultDay).toBeLessThanOrEqual(30);
    expect([...new Set(history.map(life => lifeStage(life, potential)))]).toEqual(['egg', 'fry', 'juvenile', 'adult']);
    for (let day = 1; day < history.length; day++) {
      expect(history[day].lengthCm).toBeGreaterThanOrEqual(history[day - 1].lengthCm);
      expect(history[day].lengthCm).toBeLessThanOrEqual(potential.adultLengthCm);
    }
    expect(history[60].lengthCm).toBeGreaterThan(0.99 * potential.adultLengthCm);
  });

  it('develops the same genome differently under declared conditions', () => {
    const at30 = Object.fromEntries(Object.entries(conditions).map(([name, environment]) => [name, raise(30, () => environment)[30]])) as Record<keyof typeof conditions, LifeState>;
    expect(lifeStage(at30.healthy, potential)).toBe('adult');
    expect(at30.healthy.lengthCm).toBeGreaterThan(at30.crowded.lengthCm);
    expect(at30.crowded.lengthCm).toBeGreaterThan(at30.ammonia.lengthCm);
    expect(at30.ammonia.lengthCm).toBeGreaterThan(at30.hypoxic.lengthCm);
    expect(lifeStage(at30.hypoxic, potential)).not.toBe('adult');
    expect(at30.hypoxic.condition).toBeLessThan(0.5);
    for (const life of Object.values(at30)) expect(life.ageDays).toBe(30);
  });

  it('carries condition history: deficits and recovery take days, and growth never reverses', () => {
    const adult = adultLife(genome), badDay = developDay(adult, potential, conditions.hypoxic);
    expect(badDay.condition).toBeCloseTo(1 - (1 - conditions.hypoxic.overall) * CONDITION_RESPONSE, 12);
    expect(badDay.lengthCm).toBe(adult.lengthCm);
    const recovering = raise(70, day => day <= 20 ? conditions.hypoxic : conditions.healthy), healthy = raise(70, () => conditions.healthy);
    expect(recovering[21].condition).toBeLessThan(0.7);
    for (let day = 21; day <= 26; day++) expect(recovering[day].condition).toBeGreaterThan(recovering[day - 1].condition);
    for (let day = 1; day <= 70; day++) expect(recovering[day].lengthCm).toBeGreaterThanOrEqual(recovering[day - 1].lengthCm);
    expect(recovering[40].lengthCm).toBeLessThan(healthy[40].lengthCm);
    expect(lifeStage(recovering[70], potential)).toBe('adult');
  });

  it('integrates development with water in the world, identically across splits and replay', () => {
    const world = applyCommand(createWorld(NOW), breedStudio);
    const studio = (candidate: World) => candidate.fish.filter(member => member.tankId === 'tank-2');
    expect(studio(advanceWorld(world, 0, INCUBATION_DAYS * DAY - 1)).every(member => member.life.lengthCm === 0)).toBe(true);
    expect(studio(advanceWorld(world, 0, INCUBATION_DAYS * DAY)).every(member => member.life.lengthCm === HATCH_LENGTH_CM)).toBe(true);
    const day10 = advanceWorld(world, 0, 10 * DAY), day60 = advanceWorld(world, 0, 60 * DAY);
    expect(tankLoad(day60.fish, 'tank-2').biomassKg).toBeGreaterThan(tankLoad(day10.fish, 'tank-2').biomassKg);
    expect(studio(day60).every(member => lifeStage(member.life, metabolicPotential(member.genome)) === 'adult')).toBe(true);
    expect(day60.fish.slice(0, 6).map(member => member.life)).toEqual(world.fish.slice(0, 6).map(member => ({ ...member.life, ageDays: STOCK_AGE_DAYS + 60 })));
    let split = world, tick = 0;
    for (const end of [1, 700, DAY - 1, DAY, 5_000, 12_345, 20 * DAY]) { split = advanceWorld(split, tick, end); tick = end; }
    expect(split).toEqual(advanceWorld(world, 0, 20 * DAY));

    let runtime = createRuntime(createWorld(NOW), 'growth-world');
    runtime = executeCommand(runtime, commandEnvelope(runtime, breedStudio, 30));
    runtime = advanceRuntime(runtime, 8 * DAY + 11);
    runtime = executeCommand(runtime, commandEnvelope(runtime, { type: 'move', fishId: 'FSH-000007', tankId: 'tank-1' }, 9 * DAY));
    runtime = advanceRuntime(runtime, 15 * DAY);
    expect(runtime.world.fish[6].life.lengthCm).toBeGreaterThan(HATCH_LENGTH_CM);
    expect(decodeRuntime(JSON.stringify(runtime))).toEqual(runtime);
    const tampered = structuredClone(runtime);
    tampered.world.fish[7].life.lengthCm += 0.5;
    expect(() => decodeRuntime(JSON.stringify(tampered))).toThrow('replay');
  });

  it('keeps eggs out of breeding and sales, atomically', () => {
    const world = applyCommand(createWorld(NOW), breedStudio), egg = world.fish[6], before = JSON.stringify(world);
    expect(() => applyCommand(world, { type: 'sell', fishId: egg.id })).toThrow('Eggs cannot be sold');
    expect(() => applyCommand(world, { type: 'sell-batch', fishIds: ['FSH-000003', egg.id] })).toThrow('Eggs cannot be sold');
    const eggMother = world.fish.slice(6).find(member => member.sex === 'F')!;
    expect(() => applyCommand(world, { ...breedStudio, motherId: eggMother.id, tankId: 'tank-1' })).toThrow('Eggs cannot breed');
    expect(JSON.stringify(world)).toBe(before);
    const hatched = advanceWorld(world, 0, INCUBATION_DAYS * DAY);
    expect(applyCommand(hatched, { type: 'sell', fishId: egg.id }).fish[6].status).toBe('sold');
  });

  it('migrates older worlds as young adult stock and validates life state', () => {
    const current = createWorld(NOW), older = JSON.parse(JSON.stringify(current));
    older.version = 2;
    for (const member of older.fish) delete member.life;
    expect(decodeSave(JSON.stringify(older))).toEqual(current);
    expect(current.fish.every(member => member.life.ageDays === STOCK_AGE_DAYS && member.life.lengthCm === metabolicPotential(member.genome).adultLengthCm)).toBe(true);
    const mutate = (edit: (world: { fish: { life?: Record<string, unknown> }[] }) => void) => {
      const copy = JSON.parse(JSON.stringify(current));
      edit(copy);
      return JSON.stringify(copy);
    };
    for (const raw of [
      mutate(world => { world.fish[0].life!.lengthCm = 150; }),
      mutate(world => { world.fish[0].life!.condition = 1.5; }),
      mutate(world => { world.fish[0].life!.extra = true; }),
      mutate(world => { delete world.fish[0].life; }),
    ]) expect(() => decodeSave(raw)).toThrow();

    let runtime = createRuntime(createWorld(NOW), 'v2-runtime');
    runtime = advanceRuntime(executeCommand(runtime, commandEnvelope(runtime, breedStudio, 50)), 2 * DAY);
    const legacy = JSON.parse(JSON.stringify(runtime));
    for (const stored of [legacy.world, legacy.checkpoint.world]) { stored.version = 2; for (const member of stored.fish) delete member.life; }
    const decoded = decodeRuntime(JSON.stringify(legacy));
    expect(decoded).toMatchObject({ tick: 2 * DAY, revision: 1, events: [], checkpoint: { tick: 2 * DAY, revision: 1 } });
    expect(decoded.world.tanks).toEqual(runtime.world.tanks);
    expect(decoded.world.fish.every(member => member.life.ageDays === STOCK_AGE_DAYS)).toBe(true);
  });
});
