import { describe, expect, it } from 'vitest';
import { BUYERS, DAILY_DEMAND_CEILING } from '../src/core/economy';
import { KEEPERS, paidEconomyPlaytest, PLAYTEST_DAYS, ROUTE_CHECK_DAYS, ROUTE_CHECK_EVERY, totalSinks } from '../src/core/paidEconomy';
import { RELIEF_COOLDOWN_DAYS } from '../src/core/recovery';

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

describe('FS-505 paid-economy playtest', () => {
  const report = paidEconomyPlaytest(), byId = Object.fromEntries(report.keepers.map(keeper => [keeper.id, keeper]));

  it('plays every keeper through live commands only, with a reconciled ledger and a valid save', () => {
    expect(report.days).toBe(PLAYTEST_DAYS);
    expect(report.keepers.map(keeper => keeper.id)).toEqual(KEEPERS.map(keeper => keeper.id));
    for (const keeper of report.keepers) {
      expect([keeper.reconciled, keeper.validSave]).toEqual([true, true]);
      for (const legacy of ['add-tank', 'decorate', 'buy', 'breed'] as const) expect(keeper.commands[legacy]).toBeUndefined();
      // The harness's split of spending matches the world's own ledger totals.
      const { flows, ledgerTotals } = keeper;
      expect([flows.sales, flows.stock, flows.aquariums + flows.expansions + flows.decorations + flows.careEquipment, flows.waterChanges])
        .toEqual([ledgerTotals.sale, 0 - ledgerTotals.stock, 0 - ledgerTotals.equipment, 0 - ledgerTotals.waterChange]);
      expect(keeper.net).toBe(flows.sales - totalSinks(flows));
      expect(sum(Object.values(keeper.incomeByBuyer))).toBe(flows.sales);
      expect(keeper.days.map(day => day.credits).every(credits => credits >= 0)).toBe(true);
      expect(keeper.finalPlaces).toBe(120 + 20 * keeper.aquariums + 20 * keeper.expansions);
      expect(keeper.peakLiving).toBeLessThanOrEqual(keeper.finalPlaces);
      // NPC demand still bounds income once room is paid for.
      const startingDemand = sum(BUYERS.map(buyer => buyer.capacity * buyer.budget));
      let cumulative = 0;
      keeper.days.forEach((day, i) => { cumulative += day.income; expect(cumulative).toBeLessThanOrEqual(startingDemand + (i + 1) * DAILY_DEMAND_CEILING); });
    }
  });

  it('completes the first-session loop to a second generation and never softlocks', () => {
    for (const keeper of report.keepers) {
      const { milestones } = keeper;
      expect(milestones.firstCourtship).not.toBeNull();
      expect(milestones.firstHatch).toBeLessThanOrEqual(10);
      expect(milestones.secondGeneration).toBeLessThanOrEqual(45);
      expect(keeper.routeChecks.map(check => check.day)).toEqual(Array.from({ length: PLAYTEST_DAYS / ROUTE_CHECK_EVERY }, (_, i) => (i + 1) * ROUTE_CHECK_EVERY));
      for (const check of keeper.routeChecks) expect(check.days).toBeLessThanOrEqual(ROUTE_CHECK_DAYS);
    }
    expect(byId.guided.commands).toMatchObject({ rename: 1, feed: 1 });
    expect(byId.guided.paybackDay).not.toBeNull();
  });

  it('recovers a keeper who spends every credit and loses every male, without making the rescue an income', () => {
    const { spendDown } = byId;
    expect(spendDown.lowestCredits).toBe(0);
    expect(spendDown.rescues).toBeGreaterThanOrEqual(1);
    expect(spendDown.rescues).toBeLessThanOrEqual(Math.ceil(PLAYTEST_DAYS / RELIEF_COOLDOWN_DAYS));
    expect(spendDown.flows.stock).toBe(0);
    expect(spendDown.milestones.firstCourtship).toBe(1);
    expect(spendDown.net).toBeGreaterThan(0);
  });

  it('measures the sinks: room is one-off, and premium care costs more than it returns', () => {
    for (const keeper of report.keepers) expect(keeper.finalPlaces).toBeLessThanOrEqual(480);
    // Once eight 60-place tanks exist, no command in the solo loop charges again, so the build-out bounds room spending.
    expect(byId.expander.flows.aquariums + byId.expander.flows.expansions).toBeLessThanOrEqual(6 * 400 + 12 * 300);
    expect(byId.premiumCare.flows.careEquipment + byId.premiumCare.flows.waterChanges).toBeGreaterThan(0);
    expect(byId.premiumCare.flows.sales).toBeLessThan(byId.selective.flows.sales + byId.premiumCare.flows.careEquipment);
    expect(byId.shopCollector.bought).toBeGreaterThan(0);
    expect(byId.shopCollector.incomeByBuyer.petShop).toBe(0);
  });
});
