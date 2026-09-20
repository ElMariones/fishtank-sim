import { beforeAll, describe, expect, it } from 'vitest';
import { LEDGER_LIMIT } from '../src/core/economy';
import { JOURNAL_LIMIT } from '../src/core/runtime';
import { soak, SOAK_GENERATIONS, SOAK_RECORDS, type SoakReport } from '../src/core/soakScenario';
import { MAX_LIVING, MAX_RECORDS } from '../src/core/world';

/**
 * FS-702's acceptance run. It is slow on purpose: the whole point is the state after a hundred generations and two
 * thousand records, which a shortened run would not reach.
 */
describe('FS-702 soak', { timeout: 300_000 }, () => {
  let report: SoakReport;
  // Run once for the whole suite: the soak is the expensive part, and every test below reads the same run.
  beforeAll(() => { report = soak(); }, 300_000);

  it('reaches the depth and record count the milestone asks for', () => {
    expect(report.generations).toBeGreaterThanOrEqual(SOAK_GENERATIONS);
    expect(report.records).toBeGreaterThanOrEqual(SOAK_RECORDS);
    // Living fish are capped by design, so the record set is what actually grew.
    expect(report.living).toBeLessThanOrEqual(MAX_LIVING);
    expect(report.archived).toBeGreaterThan(SOAK_RECORDS - report.living - 1);
    // The world must end populated, or nothing that walks the living set was exercised.
    expect(report.living).toBeGreaterThan(0);
  });

  it('finds no invalid record, duplicate identifier or failed replay', () => {
    // The detail is in the message so a failure names the broken invariant instead of only a count.
    expect(report.problems.map(problem => `${problem.check}: ${problem.detail}`)).toEqual([]);
  });

  it('keeps every bounded structure bounded', () => {
    expect(report.bounds.journalEvents).toBeLessThan(JOURNAL_LIMIT);
    expect(report.bounds.ledgerEntries).toBeLessThanOrEqual(LEDGER_LIMIT);
    expect(report.records).toBeLessThanOrEqual(MAX_RECORDS);
    // A hundred generations deep, an ancestor walk still visits at most six generations and 126 distinct ancestors.
    expect(report.bounds.deepestAncestorGraph).toBeLessThanOrEqual(report.bounds.ancestorDepthLimit);
    expect(report.bounds.widestAncestorGraph).toBeLessThanOrEqual(report.bounds.ancestorGraphLimit);
  });

  /**
   * `applyCommand` deep-copies the world so a rejected command cannot leave it half-changed, so command cost is
   * expected to grow with the record set. This pins the *shape* of that growth: proportional is the price of
   * atomicity, and anything sharply steeper is a defect that a long session would feel as a growing freeze.
   */
  it('keeps command cost growing no faster than the record set', () => {
    const curve = report.costCurve;
    expect(curve.length).toBeGreaterThanOrEqual(3);
    const first = curve[0], last = curve.at(-1)!;
    expect(last.records).toBeGreaterThan(first.records);
    const recordGrowth = last.records / first.records;
    const costGrowth = last.msPerCommand / Math.max(first.msPerCommand, 0.001);
    // Generous headroom for a garbage collection landing inside a sample; it is the order that matters here.
    expect(costGrowth).toBeLessThan(recordGrowth * 3);
  });

  it('reports the measured cost curve, for the FS-702 evidence table', () => {
    console.table(report.costCurve);
    console.log(`generations ${report.generations}, records ${report.records} (${report.living} living), ${report.commands} commands over ${report.gameDays} game days`);
    console.log(`ms per command: ${report.timings.msPerCommandEarly} early, ${report.timings.msPerCommandLate} mid, ${report.timings.msPerCommandAtFullSize} at full size`);
    console.log(`total ${report.timings.total} ms, of which replay ${report.timings.replay} ms`);
    expect(report.costCurve.at(-1)!.msPerCommand).toBeGreaterThan(0);
  });
});
