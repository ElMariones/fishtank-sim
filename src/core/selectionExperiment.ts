import { anatomyFor, validateAnatomy } from './anatomy';
import { measureDescriptors, type VisualDescriptorKey } from './descriptors';
import { express, founderGenome, heterozygosity, inherit } from './genetics';
import { hash, random } from './random';
import type { Genome, Phenotype } from './types';

/**
 * FS-105 artificial selection experiment (BALANCE E-02, reduced): seeded founder populations, truncation selection on one
 * normalized descriptor for ten generations, and a random-mating control from the same founders. Pure and deterministic.
 */
export type SelectionTarget = { descriptor: VisualDescriptorKey; direction: 'higher' | 'lower' };
export const SELECTION_TARGETS: SelectionTarget[] = [
  { descriptor: 'length', direction: 'higher' },
  { descriptor: 'depth', direction: 'higher' },
  { descriptor: 'tail', direction: 'higher' },
  { descriptor: 'eye', direction: 'lower' },
  { descriptor: 'frequency', direction: 'higher' },
  { descriptor: 'red', direction: 'higher' },
];

export type SelectionConfig = { generations: number; population: number; retainedPerSex: number; replicates: number; mutationRate?: number; salt: string };
export const DEFAULT_SELECTION_CONFIG: SelectionConfig = { generations: 10, population: 40, retainedPerSex: 4, replicates: 8, salt: 'fs-105' };

export type GenerationStats = { generation: number; mean: number; sd: number; heterozygosity: number; inbreeding: number; speed: number };
export type LineResult = { replicate: number; mode: 'selected' | 'random'; generations: GenerationStats[]; invalidAnatomyFinal: number };
export type TargetResult = {
  target: SelectionTarget;
  /** 10th–90th percentile of the pooled generation-0 founders. */
  typicalRange: [number, number];
  selected: LineResult[];
  random: LineResult[];
  /** Replicates whose generation-10 mean lies beyond the typical range in the selected direction. */
  selectedBeyondRange: number;
  randomBeyondRange: number;
  meanShift: { selected: number; random: number };
  passes: boolean;
};
export type SelectionReport = { config: SelectionConfig; targets: TargetResult[]; targetsPassing: number; gate: { required: number; passed: boolean }; invalidAnatomyFinal: number };

type Individual = { id: number; sex: 'F' | 'M'; genome: Genome; phenotype: Phenotype; value: number; mother: number | null; father: number | null };

const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);

function quantile(sorted: number[], q: number): number {
  const position = (sorted.length - 1) * q, low = Math.floor(position), high = Math.ceil(position);
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
}

function runLine(target: SelectionTarget, config: SelectionConfig, replicate: number, mode: LineResult['mode']): { line: LineResult; founders: number[] } {
  const pedigree: Individual[] = [];
  const kinship = new Map<number, number>();
  const make = (genome: Genome, sex: Individual['sex'], mother: number | null, father: number | null): Individual => {
    const phenotype = express(genome);
    const individual = { id: pedigree.length, sex, genome, phenotype, value: measureDescriptors(phenotype)[target.descriptor], mother, father };
    pedigree.push(individual);
    return individual;
  };
  // Coancestry by recursion on the younger individual; IDs increase with birth, so parents always have lower IDs.
  const coancestry = (a: number, b: number): number => {
    if (a === b) {
      const self = pedigree[a];
      return 0.5 * (1 + (self.mother === null ? 0 : coancestry(self.mother, self.father!)));
    }
    const older = Math.min(a, b), younger = Math.max(a, b), key = older * 100_000 + younger;
    const cached = kinship.get(key);
    if (cached !== undefined) return cached;
    const child = pedigree[younger];
    const value = child.mother === null ? 0 : 0.5 * (coancestry(older, child.mother) + coancestry(older, child.father!));
    kinship.set(key, value);
    return value;
  };
  const inbreeding = (individual: Individual) => individual.mother === null ? 0 : coancestry(individual.mother, individual.father!);
  const summarize = (population: Individual[], generation: number): GenerationStats => {
    const values = population.map(f => f.value), mean = average(values);
    return {
      generation, mean, sd: Math.sqrt(average(values.map(value => (value - mean) ** 2))),
      heterozygosity: average(population.map(f => heterozygosity(f.genome))), inbreeding: average(population.map(inbreeding)), speed: average(population.map(f => f.phenotype.speed)),
    };
  };

  let population = Array.from({ length: config.population }, (_, i) => {
    const seed = hash(`${config.salt}:founder:${replicate}:${i}`);
    // Genome v1 keeps the recorded FS-105 selection results reproducible.
    return make(founderGenome(seed, 1), i % 2 === 0 ? 'F' : 'M', null, null);
  });
  const founders = population.map(f => f.value);
  const generations = [summarize(population, 0)];
  const chooser = random(hash(`${config.salt}:random-mating:${target.descriptor}:${replicate}`));
  const sign = target.direction === 'higher' ? -1 : 1;
  const k = config.retainedPerSex;
  for (let generation = 1; generation <= config.generations; generation++) {
    const retain = (sex: Individual['sex']) => {
      const group = population.filter(f => f.sex === sex);
      if (mode === 'selected') return group.sort((a, b) => sign * (a.value - b.value) || a.id - b.id).slice(0, k);
      for (let i = group.length - 1; i > 0; i--) { const j = Math.floor(chooser() * (i + 1)); [group[i], group[j]] = [group[j], group[i]]; }
      return group.slice(0, k);
    };
    const mothers = retain('F'), fathers = retain('M');
    const perPair = Math.ceil(config.population / k), next: Individual[] = [];
    for (let pair = 0; pair < k; pair++) {
      // Rotate partners each generation so retained parents are not always the same couple.
      const mother = mothers[pair], father = fathers[(pair + generation) % k];
      for (let child = 0; child < perPair && next.length < config.population; child++) {
        const seed = hash(`${config.salt}:birth:${target.descriptor}:${replicate}:${mode}:${generation}:${pair}:${child}`);
        next.push(make(inherit(mother.genome, father.genome, seed, config.mutationRate, 1).genome, next.length % 2 === 0 ? 'F' : 'M', mother.id, father.id));
      }
    }
    population = next;
    generations.push(summarize(population, generation));
  }
  const invalidAnatomyFinal = population.filter(f => validateAnatomy(anatomyFor(f.phenotype)).length > 0).length;
  return { line: { replicate, mode, generations, invalidAnatomyFinal }, founders };
}

export function selectionTarget(target: SelectionTarget, config: SelectionConfig = DEFAULT_SELECTION_CONFIG): TargetResult {
  const selectedRuns = Array.from({ length: config.replicates }, (_, replicate) => runLine(target, config, replicate, 'selected'));
  const randomRuns = Array.from({ length: config.replicates }, (_, replicate) => runLine(target, config, replicate, 'random').line);
  const pooled = selectedRuns.flatMap(run => run.founders).sort((a, b) => a - b);
  const typicalRange: [number, number] = [quantile(pooled, 0.1), quantile(pooled, 0.9)];
  const beyond = (line: LineResult) => {
    const final = line.generations.at(-1)!.mean;
    return target.direction === 'higher' ? final > typicalRange[1] : final < typicalRange[0];
  };
  const shift = (lines: LineResult[]) => average(lines.map(line => line.generations.at(-1)!.mean - line.generations[0].mean));
  const selected = selectedRuns.map(run => run.line);
  const selectedBeyondRange = selected.filter(beyond).length, randomBeyondRange = randomRuns.filter(beyond).length;
  const meanShift = { selected: shift(selected), random: shift(randomRuns) };
  const directional = target.direction === 'higher' ? meanShift.selected > meanShift.random : meanShift.selected < meanShift.random;
  return {
    target, typicalRange, selected, random: randomRuns, selectedBeyondRange, randomBeyondRange, meanShift,
    passes: selectedBeyondRange >= Math.ceil(config.replicates * 0.75) && directional,
  };
}

/** Core proof gate (GDD §14): at least three descriptors move beyond the founders' typical range under selection. */
export function selectionReport(config: SelectionConfig = DEFAULT_SELECTION_CONFIG, targets = SELECTION_TARGETS): SelectionReport {
  const results = targets.map(target => selectionTarget(target, config));
  const targetsPassing = results.filter(result => result.passes).length;
  return {
    config, targets: results, targetsPassing, gate: { required: 3, passed: targetsPassing >= 3 },
    invalidAnatomyFinal: results.reduce((sum, result) => sum + [...result.selected, ...result.random].reduce((lines, line) => lines + line.invalidAnatomyFinal, 0), 0),
  };
}
