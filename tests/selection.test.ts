import { describe, expect, it } from 'vitest';
import { DEFAULT_SELECTION_CONFIG, SELECTION_TARGETS, selectionReport, selectionTarget, type LineResult } from '../src/core/selectionExperiment';

const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const speedAt = (lines: LineResult[], generation: number) => average(lines.map(line => line.generations[generation].speed));

describe('FS-105 ten-generation selection experiment', () => {
  const report = selectionReport();

  it('moves at least three descriptors beyond the founders’ typical range while random mating does not', () => {
    expect(report.config).toEqual(DEFAULT_SELECTION_CONFIG);
    expect(report.gate).toEqual({ required: 3, passed: true });
    expect(report.targetsPassing).toBeGreaterThanOrEqual(3);
    for (const result of report.targets) {
      expect(result.selected).toHaveLength(8);
      expect(result.random).toHaveLength(8);
      expect(result.selected.every(line => line.generations.length === 11)).toBe(true);
      const sign = result.target.direction === 'higher' ? 1 : -1;
      expect(sign * (result.meanShift.selected - result.meanShift.random)).toBeGreaterThan(0.25);
      expect(result.randomBeyondRange).toBeLessThanOrEqual(3);
    }
  });

  it('keeps final generations renderable and records the diversity cost of strong truncation', () => {
    expect(report.invalidAnatomyFinal).toBe(0);
    for (const result of report.targets) {
      for (const line of result.selected) {
        const first = line.generations[0], last = line.generations.at(-1)!;
        expect(first.inbreeding).toBe(0);
        expect(last.inbreeding).toBeGreaterThan(0.5);
        expect(last.heterozygosity).toBeLessThan(first.heterozygosity);
      }
    }
  });

  it('shows the long-tail speed tradeoff under selection, against random-mating lines from the same founders', () => {
    const tail = report.targets.find(result => result.target.descriptor === 'tail')!;
    expect(speedAt(tail.selected, 10)).toBeLessThan(speedAt(tail.selected, 0));
    expect(speedAt(tail.selected, 10)).toBeLessThan(speedAt(tail.random, 10));
  });

  it('is deterministic for a given configuration', () => {
    const small = { ...DEFAULT_SELECTION_CONFIG, replicates: 2, generations: 3 };
    expect(selectionTarget(SELECTION_TARGETS[0], small)).toEqual(selectionTarget(SELECTION_TARGETS[0], small));
  });
});
