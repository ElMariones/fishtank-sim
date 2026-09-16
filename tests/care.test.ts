import { describe, expect, it } from 'vitest';
import {
  AERATION_TIERS, CARE_RATES, careCost, careSettings, closeCareDay, FILTER_TIERS, integrateTank, RATION_KEYS, stepTank, waterChangeCost,
  type CareSettings,
} from '../src/core/care';
import { careStatus, careWarnings, projectTank, sameSettings } from '../src/core/careAdvice';
import { adultLife, environmentLimits, lifeStage, temperatureComfort, temperatureGrowth } from '../src/core/development';
import { founderGenome, metabolicPotential } from '../src/core/genetics';
import { advanceWorld, tankEnvironment, tankLoad } from '../src/core/habitat';
import { random } from '../src/core/random';
import { advanceRuntime, applyOfflineCatchup, commandEnvelope, createRuntime, decodeRuntime, executeCommand } from '../src/core/runtime';
import { decodeSave } from '../src/core/save';
import type { Fish, Ration, TankCare, WaterState, World } from '../src/core/types';
import { emptyLedger, oxygenSaturationMgL, TICKS_PER_GAME_DAY, type WaterLedger } from '../src/core/water';
import { applyCommand, commandSchema, createWorld, type Command } from '../src/core/world';
import { TICK_MS } from '../src/simulation/time';

const NOW = '2026-09-14T12:00:00.000Z';
const DAY = TICKS_PER_GAME_DAY;
const fishId = (n: number) => `FSH-${String(n).padStart(6, '0')}`;
const breedStudio: Command = { type: 'breed', motherId: 'FSH-000001', fatherId: 'FSH-000002', tankId: 'tank-2', timestamp: NOW, genomeVersion: 3 };

/** The Koi Garden holding `count` founder-distribution adults with the given care, and an empty studio. */
function stocked(count: number, care: Partial<TankCare> = {}, water: Partial<WaterState> = {}): World {
  const base = createWorld(NOW);
  const fish = Array.from({ length: count }, (_, i): Fish => {
    const genome = founderGenome(9000 + i);
    return { ...base.fish[0], id: fishId(i + 1), name: `Fish ${i + 1}`, sex: i % 2 ? 'M' : 'F', genome, tankId: 'tank-1', life: adultLife(genome) };
  });
  const [garden, studio] = base.tanks;
  return { ...base, nextId: count + 1, fish, tanks: [{ ...garden, water: { ...garden.water, ...water }, care: { ...garden.care, ...care } }, studio] };
}

/** Each stock changes by exactly its recorded fluxes: food added, eaten, decayed and siphoned; ammonia and oxygen as in FS-301. */
function expectBalanced(before: WaterState, after: WaterState, ledger: WaterLedger) {
  const litres = before.volumeL, tolerance = (...magnitudes: number[]) => 1e-7 * Math.max(1, ...magnitudes.map(Math.abs));
  const o = ledger.oxygen, oxygen = o.aeration + o.exchange - o.respiration - o.foodDecay - o.nitrification;
  expect(Math.abs((after.oxygenMgL - before.oxygenMgL) * litres - oxygen)).toBeLessThanOrEqual(tolerance(o.aeration, o.respiration, before.oxygenMgL * litres));
  const a = ledger.ammonia, ammonia = a.excretion + a.foodDecay - a.nitrification - a.exchange;
  expect(Math.abs((after.ammoniaMgL - before.ammoniaMgL) * litres - ammonia)).toBeLessThanOrEqual(tolerance(a.excretion, a.foodDecay, a.nitrification, before.ammoniaMgL * litres));
  const f = ledger.food;
  expect(Math.abs(after.foodG - before.foodG - (f.added - f.eaten - f.decayed - f.removed))).toBeLessThanOrEqual(tolerance(f.added, f.eaten, f.decayed, before.foodG));
  expect(Math.min(after.oxygenMgL, after.ammoniaMgL, after.foodG)).toBeGreaterThanOrEqual(0);
}

describe('FS-305 feeding, equipment and thermostat', () => {
  it('feeds a ration of the current need, never beyond it, and conserves food, ammonia and oxygen', () => {
    const results = new Map<Ration, { fed: number; foodG: number; ammoniaMgL: number }>();
    for (const ration of RATION_KEYS) {
      const world = stocked(30, { ration }), load = tankLoad(world.fish, 'tank-1'), ledger = emptyLedger();
      let tank = world.tanks[0];
      for (let day = 1; day <= 10; day++) {
        tank = integrateTank(tank, load, (day - 1) * DAY, day * DAY, ledger);
        expect(tank.care.dayEatenG).toBeLessThanOrEqual(tank.care.dayNeedG);
        tank = { ...tank, care: closeCareDay(tank.care) };
      }
      expectBalanced(world.tanks[0].water, tank.water, ledger);
      expect(ledger.food.eaten).toBeLessThanOrEqual(ledger.food.added);
      results.set(ration, { fed: tank.care.fed, foodG: tank.water.foodG, ammoniaMgL: tank.water.ammoniaMgL });
    }
    const r = (ration: Ration) => results.get(ration)!;
    expect(r('off').fed).toBe(0);
    expect(r('light').fed).toBeGreaterThan(0.7); expect(r('light').fed).toBeLessThan(0.85);
    expect(r('measured').fed).toBeGreaterThan(0.9);
    expect([r('generous').fed, r('heavy').fed]).toEqual([1, 1]);
    const order = RATION_KEYS.map(ration => r(ration).foodG);
    order.slice(1).forEach((grams, i) => expect(grams).toBeGreaterThan(order[i]));
    expect(r('measured').ammoniaMgL).toBeLessThan(r('generous').ammoniaMgL);
    expect(r('generous').ammoniaMgL).toBeLessThan(r('heavy').ammoniaMgL);
    // A fully fed fish excretes the FS-301 total: fasting plus eaten food at its daily need.
    expect(CARE_RATES.fastingAmmoniaMgNPerKgDay + CARE_RATES.eatenAmmoniaMgNPerG * CARE_RATES.foodNeedGPerKgDay).toBe(100);
  });

  it('turns rations into directional development: less food slows growth, extra food adds only waste', () => {
    const raised = new Map<Ration, World>();
    for (const ration of ['off', 'light', 'measured', 'generous'] as const) {
      const bred = applyCommand(createWorld(NOW), breedStudio);
      bred.tanks[1].care.ration = ration;
      raised.set(ration, advanceWorld(bred, 0, 30 * DAY));
    }
    const fry = (ration: Ration) => raised.get(ration)!.fish.filter(f => f.tankId === 'tank-2');
    const meanLength = (ration: Ration) => fry(ration).reduce((sum, f) => sum + f.life.lengthCm, 0) / 20;
    expect(meanLength('measured')).toBeGreaterThan(meanLength('light'));
    expect(meanLength('light')).toBeGreaterThan(meanLength('off'));
    expect(fry('generous').map(f => f.life)).toEqual(fry('measured').map(f => f.life));
    expect(raised.get('generous')!.tanks[1].water.foodG).toBeGreaterThan(raised.get('measured')!.tanks[1].water.foodG);
    const adults = (ration: Ration) => fry(ration).filter(f => lifeStage(f.life, metabolicPotential(f.genome)) === 'adult').length;
    expect(adults('measured')).toBeGreaterThan(adults('off'));
    expect(fry('off').every(f => f.life.condition < 0.3)).toBe(true);
    const starved = raised.get('off')!, studio = starved.tanks[1];
    expect(environmentLimits(tankEnvironment(studio, tankLoad(starved.fish, 'tank-2')))).toEqual(['underfeeding']);
  });

  it('moves water toward the thermostat without overshoot; warmth speeds growth but holds less oxygen', () => {
    expect([temperatureComfort(18), temperatureComfort(22), temperatureComfort(26)]).toEqual([1, 1, 1]);
    expect(temperatureComfort(30)).toBeLessThan(1);
    expect([temperatureGrowth(22), temperatureGrowth(10), temperatureGrowth(35)]).toEqual([1, 0.8, 1.2]);
    expect(temperatureGrowth(26)).toBeCloseTo(1.16, 12);
    expect(oxygenSaturationMgL(26)).toBeLessThan(oxygenSaturationMgL(22));
    const world = stocked(0, { targetC: 26 }), load = tankLoad([], 'tank-1');
    let tank = { water: world.tanks[0].water, care: world.tanks[0].care };
    for (let step = 0; step < 45; step++) {
      const next = stepTank(tank, load);
      expect(next.water.temperatureC - tank.water.temperatureC).toBeGreaterThanOrEqual(0);
      expect(next.water.temperatureC - tank.water.temperatureC).toBeLessThanOrEqual(CARE_RATES.thermostatStepC + 1e-12);
      tank = next;
    }
    expect(tank.water.temperatureC).toBe(26);
    const warm = applyCommand(createWorld(NOW), breedStudio), cool = applyCommand(createWorld(NOW), breedStudio);
    warm.tanks[1].care.targetC = 26;
    const length = (world: World) => advanceWorld(world, 0, 12 * DAY).fish.filter(f => f.tankId === 'tank-2').reduce((sum, f) => sum + f.life.lengthCm, 0);
    expect(length(warm)).toBeGreaterThan(length(cool));
  });

  it('integrates feeding and temperature identically across splits, clock checkpoints, offline catch-up and replay', () => {
    const world = stocked(40, { ration: 'generous', targetC: 25 }), load = tankLoad(world.fish, 'tank-1'), end = 13 + 7 * DAY + 345;
    const whole = integrateTank(world.tanks[0], load, 13, end), rng = random(305);
    let split = world.tanks[0], tick = 13;
    while (tick < end) { const next = Math.min(end, tick + 1 + Math.floor(rng() * 200)); split = integrateTank(split, load, tick, next); tick = next; }
    expect(split).toEqual(whole);

    let runtime = createRuntime(applyCommand(createWorld(NOW), breedStudio), 'care-world');
    runtime = executeCommand(runtime, commandEnvelope(runtime, { type: 'set-care', tankId: 'tank-2', ration: 'generous', filterTier: 1, aerationTier: 2, targetC: 25 }, 30));
    runtime = executeCommand(runtime, commandEnvelope(runtime, { type: 'change-water', tankId: 'tank-1', percent: 10 }, DAY + 7));
    let fine = runtime;
    for (let t = runtime.tick + 1; t <= runtime.tick + DAY; t++) fine = advanceRuntime(fine, t);
    const coarse = advanceRuntime(runtime, runtime.tick + DAY);
    const offline = applyOfflineCatchup(runtime, 0, DAY * TICK_MS).runtime;
    expect(fine.world).toEqual(coarse.world);
    expect(offline.world).toEqual(coarse.world);
    const advanced = advanceRuntime(coarse, 5 * DAY + 3), later = executeCommand(advanced, commandEnvelope(advanced, { type: 'feed', tankId: 'tank-1' }));
    expect(decodeRuntime(JSON.stringify(later))).toEqual(later);
    const tampered = structuredClone(later);
    tampered.world.tanks[1].care.fed = 0.5;
    expect(() => decodeRuntime(JSON.stringify(tampered))).toThrow('replay');
  });

  it('charges equipment upgrades and water changes once, and rejects no-ops, unaffordable changes and pointless feeding atomically', () => {
    const world = createWorld(NOW), garden = world.tanks[0];
    expect(careSettings(garden)).toEqual({ ration: 'measured', filterTier: 1, aerationTier: 1, targetC: 22 });
    expect(careCost(garden, careSettings(garden))).toBe(0);
    const strong: Command = { type: 'set-care', tankId: 'tank-1', ration: 'measured', filterTier: 2, aerationTier: 2, targetC: 24 };
    const upgraded = applyCommand(world, strong);
    expect(upgraded.credits).toBe(world.credits - (FILTER_TIERS[2].price - FILTER_TIERS[1].price) - (AERATION_TIERS[2].price - AERATION_TIERS[1].price));
    expect([upgraded.tanks[0].water.filterMgNPerDay, upgraded.tanks[0].water.aerationPerDay, upgraded.tanks[0].care.targetC]).toEqual([120_000, 36, 24]);
    const downgraded = applyCommand(upgraded, { ...strong, filterTier: 0, aerationTier: 0 });
    expect(downgraded.credits).toBe(upgraded.credits);
    const frozen = JSON.stringify(upgraded);
    expect(() => applyCommand(upgraded, strong)).toThrow('already in use');
    expect(() => applyCommand({ ...upgraded, credits: 100 }, { ...strong, filterTier: 3 })).toThrow('costs ◈ 500');
    expect(JSON.stringify(upgraded)).toBe(frozen);

    const dirty = { ...world, tanks: [{ ...garden, water: { ...garden.water, ammoniaMgL: 2, foodG: 400 } }, world.tanks[1]] };
    expect([10, 25, 50].map(percent => waterChangeCost(garden.water, percent))).toEqual([2, 5, 10]);
    const changed = applyCommand(dirty, { type: 'change-water', tankId: 'tank-1', percent: 25 });
    expect(changed.credits).toBe(world.credits - 5);
    expect(changed.tanks[0].water.ammoniaMgL).toBeCloseTo(1.5, 12);
    expect(changed.tanks[0].water.foodG).toBeCloseTo(300, 9);
    expect(() => applyCommand({ ...dirty, credits: 4 }, { type: 'change-water', tankId: 'tank-1', percent: 25 })).toThrow('costs ◈ 5');

    const need = tankLoad(world.fish, 'tank-1').foodNeedGPerDay * 1.14;
    expect(applyCommand(world, { type: 'feed', tankId: 'tank-1' }).tanks[0].water.foodG).toBeCloseTo(need * CARE_RATES.manualPortionDays, 9);
    const eggsOnly = applyCommand(world, breedStudio), before = JSON.stringify(eggsOnly);
    expect(() => applyCommand(eggsOnly, { type: 'feed', tankId: 'tank-2' })).toThrow('No hatched fish');
    expect(JSON.stringify(eggsOnly)).toBe(before);
    for (const invalid of [{ ...strong, ration: 'feast' }, { ...strong, targetC: 31 }, { ...strong, filterTier: 4 }, { type: 'change-water', tankId: 'tank-1', percent: 30 }])
      expect(() => applyCommand(world, invalid as Command)).toThrow();
  });

  it('warns about stressed tanks with fixes that, applied in turn, bring the tank back; projections match reality', () => {
    const healthy = advanceWorld(stocked(30), 0, 5 * DAY);
    expect(careWarnings(healthy, 'tank-1')).toEqual([]);
    expect(careStatus(healthy, 'tank-1')).toMatchObject({ oxygen: 'good', ammonia: 'clean', fedLevel: 'fed', stocking: 'moderate', leftovers: false });

    let world = advanceWorld(stocked(60, { ration: 'heavy', targetC: 29 }, { filterMgNPerDay: FILTER_TIERS[0].mgNPerDay, aerationPerDay: AERATION_TIERS[0].perDay }), 0, 5 * DAY);
    let tick = 5 * DAY;
    const codes = careWarnings(world, 'tank-1').map(warning => warning.code);
    expect(codes).toEqual(expect.arrayContaining(['oxygen', 'ammonia', 'temperature', 'leftovers']));
    const conditionBefore = world.fish.reduce((sum, f) => sum + f.life.condition, 0);
    for (let round = 0; round < 4 && careWarnings(world, 'tank-1').length; round++) {
      const warnings = careWarnings(world, 'tank-1'), current = careSettings(world.tanks[0]);
      for (const fix of warnings.flatMap(warning => warning.fixes)) if (fix.kind !== 'hint') expect(fix.cost).toBeGreaterThanOrEqual(0);
      const target: CareSettings = { ...current };
      for (const fix of warnings.flatMap(warning => warning.fixes)) {
        if (fix.kind !== 'settings') continue;
        for (const key of ['ration', 'filterTier', 'aerationTier', 'targetC'] as const) if (fix.settings[key] !== current[key]) (target as Record<string, unknown>)[key] = fix.settings[key];
      }
      if (!sameSettings(target, current)) {
        const command: Command = { type: 'set-care', tankId: 'tank-1', ...target };
        commandSchema.parse(command);
        // The preview runs the same advance, so it equals applying the settings and letting the same time pass.
        const projected = projectTank(world, 'tank-1', tick, 6, { settings: target });
        world = applyCommand(world, command);
        const reality = advanceWorld(world, tick, tick + 6 * DAY).tanks[0];
        expect([reality.water.oxygenMgL, reality.water.ammoniaMgL, reality.water.foodG, reality.water.temperatureC, reality.care.fed])
          .toEqual([projected.oxygenMgL, projected.ammoniaMgL, projected.foodG, projected.temperatureC, projected.fed]);
      }
      const change = warnings.flatMap(warning => warning.fixes).find(fix => fix.kind === 'water-change');
      if (change?.kind === 'water-change') world = applyCommand(world, { type: 'change-water', tankId: 'tank-1', percent: change.percent });
      world = advanceWorld(world, tick, tick + 6 * DAY); tick += 6 * DAY;
    }
    expect(careWarnings(world, 'tank-1')).toEqual([]);
    expect(world.fish.reduce((sum, f) => sum + f.life.condition, 0)).toBeGreaterThan(conditionBefore);
    expect(world.credits).toBeGreaterThan(0);
  });

  it('migrates worlds made before care with measured rations and a thermostat at the water temperature, and rejects invalid care', () => {
    const current = createWorld(NOW), older = JSON.parse(JSON.stringify(current));
    older.version = 3;
    for (const tank of older.tanks) delete tank.care;
    expect(decodeSave(JSON.stringify(older))).toEqual(current);
    older.tanks[0].water.temperatureC = 27.6;
    expect(decodeSave(JSON.stringify(older)).tanks[0].care).toMatchObject({ ration: 'measured', targetC: 28, fed: 1 });
    const mutate = (edit: (world: { tanks: { care?: Record<string, unknown> }[] }) => void) => {
      const copy = JSON.parse(JSON.stringify(current));
      edit(copy);
      return JSON.stringify(copy);
    };
    for (const raw of [
      mutate(world => { world.tanks[0].care!.ration = 'feast'; }),
      mutate(world => { world.tanks[0].care!.targetC = 40; }),
      mutate(world => { world.tanks[0].care!.fed = 1.2; }),
      mutate(world => { world.tanks[0].care!.dayNeedG = 1; world.tanks[0].care!.dayEatenG = 5; }),
      mutate(world => { world.tanks[0].care!.extra = true; }),
      mutate(world => { delete world.tanks[0].care; }),
    ]) expect(() => decodeSave(raw)).toThrow();

    let runtime = createRuntime(createWorld(NOW), 'v3-runtime');
    runtime = advanceRuntime(executeCommand(runtime, commandEnvelope(runtime, { type: 'rename', fishId: 'FSH-000001', name: 'Tide' }, 40)), 2 * DAY + 5);
    const legacy = JSON.parse(JSON.stringify(runtime));
    for (const stored of [legacy.world, legacy.checkpoint.world]) { stored.version = 3; for (const tank of stored.tanks) delete tank.care; }
    const decoded = decodeRuntime(JSON.stringify(legacy));
    expect(decoded).toMatchObject({ tick: 2 * DAY + 5, revision: 1, events: [] });
    expect(decoded.world.tanks.map(tank => tank.water)).toEqual(runtime.world.tanks.map(tank => tank.water));
    expect(decoded.world.tanks.every(tank => tank.care.ration === 'measured' && tank.care.dayNeedG === 0)).toBe(true);
  });
});
