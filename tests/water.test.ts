import { describe, expect, it } from 'vitest';
import { express, founderGenome, metabolicPotential } from '../src/core/genetics';
import { advanceWorld, massKg, stocking, tankLoad } from '../src/core/habitat';
import { random } from '../src/core/random';
import { advanceRuntime, commandEnvelope, createRuntime, decodeRuntime, executeCommand } from '../src/core/runtime';
import { decodeSave } from '../src/core/save';
import type { WaterState } from '../src/core/types';
import {
  addFood, changeWater, defaultWater, emptyLedger, integrateWater, NO_LOAD, oxygenSaturationMgL, stepWater, temperatureFactor,
  TICKS_PER_GAME_DAY, WATER_STEP_TICKS, waterStatus, type WaterLedger, type WaterLoad,
} from '../src/core/water';
import { applyCommand, createWorld, type Command } from '../src/core/world';

const NOW = '2026-09-13T12:00:00.000Z';
const DAY = TICKS_PER_GAME_DAY;
const typical: WaterLoad = { oxygenMgPerDay: 900_000, ammoniaMgNPerDay: 13_000 };
const overload: WaterLoad = { oxygenMgPerDay: 6_000_000, ammoniaMgNPerDay: 150_000 };
const breedStudio: Command = { type: 'breed', motherId: 'FSH-000001', fatherId: 'FSH-000002', tankId: 'tank-2', timestamp: NOW, genomeVersion: 2 };

/** Mass balance: the change in each stock equals the sum of recorded fluxes, within floating-point tolerance. */
function expectConserved(before: WaterState, after: WaterState, ledger: WaterLedger) {
  const litres = before.volumeL, tolerance = (...magnitudes: number[]) => 1e-7 * Math.max(1, ...magnitudes.map(Math.abs));
  const o = ledger.oxygen, oxygenFlux = o.aeration + o.exchange - o.respiration - o.foodDecay - o.nitrification;
  expect(Math.abs(after.oxygenMgL * litres - before.oxygenMgL * litres - oxygenFlux))
    .toBeLessThanOrEqual(tolerance(o.aeration, o.exchange, o.respiration, o.foodDecay, o.nitrification, before.oxygenMgL * litres));
  const a = ledger.ammonia, ammoniaFlux = a.excretion + a.foodDecay - a.nitrification - a.exchange;
  expect(Math.abs(after.ammoniaMgL * litres - before.ammoniaMgL * litres - ammoniaFlux))
    .toBeLessThanOrEqual(tolerance(a.excretion, a.foodDecay, a.nitrification, a.exchange, before.ammoniaMgL * litres));
  const f = ledger.food;
  expect(Math.abs(after.foodG - before.foodG - (f.added - f.decayed - f.removed))).toBeLessThanOrEqual(tolerance(f.added, f.decayed, f.removed, before.foodG));
  for (const value of [...Object.values(o), a.excretion, a.nitrification, after.oxygenMgL, after.ammoniaMgL, after.foodG]) expect(Number.isFinite(value)).toBe(true);
  expect(Math.min(after.oxygenMgL, after.ammoniaMgL, after.foodG)).toBeGreaterThanOrEqual(0);
}

describe('FS-301 water model', () => {
  it('declares units, oxygen saturation, bounded temperature rates and clean defaults', () => {
    expect(oxygenSaturationMgL(20)).toBeCloseTo(9.02, 2);
    expect(oxygenSaturationMgL(30)).toBeLessThan(oxygenSaturationMgL(20));
    expect(oxygenSaturationMgL(10)).toBeGreaterThan(oxygenSaturationMgL(20));
    expect([temperatureFactor(-50), temperatureFactor(20), temperatureFactor(80)]).toEqual([0.5, 1, 2]);
    expect(WATER_STEP_TICKS * 48).toBe(DAY);
    const water = defaultWater();
    expect(water.oxygenMgL).toBe(oxygenSaturationMgL(water.temperatureC));
    expect(waterStatus(water)).toEqual({ oxygen: 'good', ammonia: 'clean' });
  });

  it('zero load: clean water stays saturated and depleted oxygen recovers monotonically, conserving mass', () => {
    const clean = defaultWater(), ledger = emptyLedger();
    const month = integrateWater(clean, NO_LOAD, 0, 30 * DAY, ledger);
    expect([month.ammoniaMgL, month.foodG, ledger.steps]).toEqual([0, 0, 30 * 48]);
    expect(Math.abs(month.oxygenMgL - clean.oxygenMgL)).toBeLessThan(1e-9);
    expectConserved(clean, month, ledger);
    const depleted = { ...clean, oxygenMgL: 1 }, recovery = emptyLedger();
    let state = depleted;
    for (let step = 0; step < 48; step++) {
      const next = stepWater(state, NO_LOAD, recovery);
      expect(next.oxygenMgL).toBeGreaterThanOrEqual(state.oxygenMgL);
      state = next;
    }
    expect(clean.oxygenMgL - state.oxygenMgL).toBeLessThan(0.01);
    expectConserved(depleted, state, recovery);
  });

  it('overload: ammonia climbs past filter capacity and oxygen demand goes unmet, conserving mass', () => {
    const start = defaultWater(), ledger = emptyLedger();
    let state = start;
    for (let day = 1; day <= 10; day++) {
      const next = integrateWater(state, overload, (day - 1) * DAY, day * DAY, ledger);
      expect(next.ammoniaMgL).toBeGreaterThan(state.ammoniaMgL);
      state = next;
    }
    expect(waterStatus(state)).toEqual({ oxygen: 'critical', ammonia: 'high' });
    expect(ledger.oxygen.unmet).toBeGreaterThan(0);
    expectConserved(start, state, ledger);
  });

  it('recovery: water changes and a lighter load return good, clean water, conserving mass', () => {
    const overloaded = integrateWater(defaultWater(), overload, 0, 10 * DAY), ledger = emptyLedger();
    let state = changeWater(changeWater(overloaded, 0.5, ledger), 0.5, ledger);
    expect(state.ammoniaMgL).toBeCloseTo(overloaded.ammoniaMgL / 4, 9);
    for (let day = 1; day <= 30; day++) {
      const next = integrateWater(state, typical, (9 + day) * DAY, (10 + day) * DAY, ledger);
      if (day > 1) expect(next.ammoniaMgL).toBeLessThanOrEqual(state.ammoniaMgL + 1e-12);
      state = next;
    }
    expect(waterStatus(state)).toEqual({ oxygen: 'good', ammonia: 'clean' });
    expectConserved(overloaded, state, ledger);
  });

  it('integrates identically however the same interval is split', () => {
    const fed = addFood(defaultWater(), 800), end = 17 + 12_345;
    const whole = integrateWater(fed, typical, 17, end);
    const rng = random(301);
    let state = fed, tick = 17;
    while (tick < end) {
      const next = Math.min(end, tick + 1 + Math.floor(rng() * 90));
      state = integrateWater(state, typical, tick, next);
      tick = next;
    }
    expect(state).toEqual(whole);
  });

  it('turns uneaten food into ammonia and oxygen demand without creating or losing food', () => {
    const clean = defaultWater(), ledger = emptyLedger();
    const fed = addFood(clean, 1_000, ledger), later = integrateWater(fed, NO_LOAD, 0, 5 * DAY, ledger);
    expect(later.foodG).toBeLessThan(10);
    expect(ledger.ammonia.foodDecay).toBeGreaterThan(0);
    expect(ledger.oxygen.foodDecay).toBeGreaterThan(0);
    expect(integrateWater(fed, NO_LOAD, 0, DAY / 2).oxygenMgL).toBeLessThan(integrateWater(clean, NO_LOAD, 0, DAY / 2).oxygenMgL);
    expectConserved(clean, later, ledger);
  });

  it('leaves inputs untouched and rejects backwards time, invalid food and invalid water changes', () => {
    const water = defaultWater(), frozen = JSON.stringify(water);
    stepWater(water, overload); integrateWater(water, overload, 0, DAY); changeWater(water, 0.3); addFood(water, 5);
    expect(JSON.stringify(water)).toBe(frozen);
    expect(() => integrateWater(water, typical, 10, 9)).toThrow('backwards');
    for (const fraction of [0, -0.1, 0.95, Number.NaN]) expect(() => changeWater(water, fraction)).toThrow();
    for (const grams of [0, -1, Number.POSITIVE_INFINITY]) expect(() => addFood(water, grams)).toThrow();
  });
});

describe('FS-301 habitat load and persistent water', () => {
  it('derives respiration and excretion from living residents at adult potential', () => {
    for (let seed = 0; seed < 200; seed++) {
      const genome = founderGenome(seed), phenotype = express(genome), potential = metabolicPotential(genome);
      expect([potential.adultLengthCm, potential.metabolism]).toEqual([phenotype.adultLengthCm, phenotype.metabolism]);
    }
    const world = applyCommand(createWorld(NOW), breedStudio);
    const garden = tankLoad(world.fish, 'tank-1'), studio = tankLoad(world.fish, 'tank-2');
    expect([garden.fish, studio.fish]).toEqual([6, 20]);
    expect(studio.oxygenMgPerDay).toBeGreaterThan(garden.oxygenMgPerDay);
    expect(tankLoad(applyCommand(world, { type: 'sell', fishId: 'FSH-000001' }).fish, 'tank-1').fish).toBe(5);
    expect(massKg(52)).toBeCloseTo(2.08, 2);
    expect(stocking(tankLoad([], 'tank-1'), defaultWater()).level).toBe('light');
  });

  it('advances every tank, including empty ones, through the shared clock and round-trips saves', () => {
    const world = applyCommand(applyCommand(createWorld(NOW), breedStudio), { type: 'add-tank' });
    expect(advanceWorld(world, 0, WATER_STEP_TICKS - 1)).toBe(world);
    const later = advanceWorld(world, 0, 3 * DAY);
    expect(later.tanks[1].water.oxygenMgL).toBeLessThan(later.tanks[0].water.oxygenMgL);
    expect(later.tanks[1].water.ammoniaMgL).toBeGreaterThan(later.tanks[0].water.ammoniaMgL);
    expect(later.tanks[2].water.ammoniaMgL).toBe(0);
    expect(Math.abs(later.tanks[2].water.oxygenMgL - world.tanks[2].water.oxygenMgL)).toBeLessThan(1e-9);
    expect(decodeSave(JSON.stringify(later))).toEqual(later);
  });

  it('persists water through commands, clock checkpoints and replay; fine and coarse advances agree', () => {
    let runtime = createRuntime(createWorld(NOW), 'water-world');
    runtime = executeCommand(runtime, commandEnvelope(runtime, breedStudio, 40));
    runtime = advanceRuntime(runtime, 2 * DAY + 7);
    runtime = executeCommand(runtime, commandEnvelope(runtime, { type: 'move', fishId: 'FSH-000007', tankId: 'tank-1' }, 3 * DAY));
    runtime = advanceRuntime(runtime, 5 * DAY);
    expect(runtime.world.tanks[1].water.ammoniaMgL).toBeGreaterThan(0);
    expect(decodeRuntime(JSON.stringify(runtime))).toEqual(runtime);
    const tampered = structuredClone(runtime);
    tampered.world.tanks[0].water.ammoniaMgL += 0.01;
    expect(() => decodeRuntime(JSON.stringify(tampered))).toThrow('replay');
    let fine = createRuntime(createWorld(NOW), 'fine');
    for (let tick = 1; tick <= DAY; tick++) fine = advanceRuntime(fine, tick);
    expect(fine.world).toEqual(advanceRuntime(createRuntime(createWorld(NOW), 'coarse'), DAY).world);
  });

  it('starts water at a world v1 snapshot and folds its journal into a new checkpoint', () => {
    let runtime = createRuntime(createWorld(NOW, 481516, 1), 'legacy-water');
    const command = commandEnvelope(runtime, { type: 'breed', motherId: 'FSH-000001', fatherId: 'FSH-000002', tankId: 'tank-2', timestamp: NOW }, 30);
    runtime = advanceRuntime(executeCommand(runtime, command), 900);
    // The M2 reducer stored world v1, without water, in both the snapshot and its checkpoint.
    const legacy = JSON.parse(JSON.stringify(runtime));
    for (const stored of [legacy.world, legacy.checkpoint.world]) { stored.version = 1; for (const entry of stored.tanks) delete entry.water; }
    const decoded = decodeRuntime(JSON.stringify(legacy));
    expect(decoded.world.version).toBe(2);
    expect(decoded.world.tanks.map(entry => entry.water)).toEqual([defaultWater(), defaultWater()]);
    expect(decoded.world.fish).toEqual(runtime.world.fish);
    expect(decoded).toMatchObject({ tick: 900, revision: 1, events: [], checkpoint: { tick: 900, revision: 1 } });
    expect(() => executeCommand(decoded, command)).toThrow('Stale');
    const renamed = executeCommand(decoded, commandEnvelope(decoded, { type: 'rename', fishId: 'FSH-000007', name: 'Tide' }, 1000));
    expect(decodeRuntime(JSON.stringify(renamed))).toEqual(renamed);
    legacy.world.fish[6].name = 'Changed';
    expect(() => decodeRuntime(JSON.stringify(legacy))).toThrow('replay');
  });

  it('migrates world v1 saves with default water and rejects invalid water', () => {
    const current = createWorld(NOW), legacy = JSON.parse(JSON.stringify(current));
    legacy.version = 1;
    for (const entry of legacy.tanks) delete entry.water;
    expect(decodeSave(JSON.stringify(legacy))).toEqual(current);
    const mutate = (edit: (world: { tanks: { water?: Record<string, unknown> }[] }) => void) => {
      const copy = JSON.parse(JSON.stringify(current));
      edit(copy);
      return JSON.stringify(copy);
    };
    for (const raw of [
      mutate(world => { world.tanks[0].water!.aerationPerDay = 99; }),
      mutate(world => { world.tanks[0].water!.oxygenMgL = -1; }),
      mutate(world => { world.tanks[0].water!.model = 2; }),
      mutate(world => { world.tanks[0].water!.extra = 1; }),
      mutate(world => { delete world.tanks[0].water; }),
    ]) expect(() => decodeSave(raw)).toThrow();
  });
});
