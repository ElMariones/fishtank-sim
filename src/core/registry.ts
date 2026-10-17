import { APPEARANCE_BASELINE, APPEARANCE_FOUNDER_WEIGHTS, appearanceAlleleLabel } from './appearance';
import {
  ALLELE_COUNT, APPEARANCE_LOCI, CHROMOSOMES, FOUNDER_WEIGHTS, GENOME_LOCI, LOCI, LOCI_PER_GENOME, MUTATION_RATE, STRUCTURE_LOCI,
  type GenomeLocus, type GenomeVersion,
} from './catalog';
import {
  STRUCTURAL_MUTATION_RATE, STRUCTURE_ALLELE_LABELS, STRUCTURE_BASELINE, STRUCTURE_FOUNDER_WEIGHTS, STRUCTURE_MUTATION_TARGETS, type MutationTarget,
} from './structure';
import { genesisProblem, isNovel, KOI_LOAD, type DominanceClass } from './genesis';
import { DEVELOPMENT_ALLELE_LABELS, DEVELOPMENT_BASELINE, DEVELOPMENT_FOUNDER_WEIGHTS, DEVELOPMENT_OFFSET, KOI_DOMINANCE, koiNovelEligible } from './koiGenesis';
import { moduleAlleleCounts } from './modules';
import type { Genome } from './types';

/**
 * Locus registry v1 (FS-601): one data definition per locus drives founder draws, mutation, save validation, allele labels
 * and the genome view. Order is the stable genome order and must never change. A locus added by a later genome version
 * names the baseline allele that older genomes are read as, so older fish keep the expression they were born with.
 */
export const REGISTRY_MODEL = 1;
export type Expression = 'additive' | 'recessive-switch' | 'classic-dominant' | 'rainbow-dominant' | 'recessive' | 'overlay' | 'structural-recessive' | 'barbel-series'
  | 'cascade-recessive' | 'dominant-program' | 'semi-recessive';
export type AlleleDefinition = { id: number; label: string; founderWeight: number; mutationTargets: readonly MutationTarget[] };
export type LocusDefinition = {
  id: GenomeLocus;
  /** Position in every genome version that carries this locus. */
  index: number;
  chromosome: number; chromosomeName: string;
  /** First genome version that carries the locus. */
  sinceGenome: GenomeVersion;
  expression: Expression;
  /** Supported alleles in ID order; any other ID is invalid at this locus. */
  alleles: readonly AlleleDefinition[];
  /** Allele read for genomes older than `sinceGenome`; null for loci every genome carries. */
  baseline: number | null;
  /** Mutation probability per transmitted copy. */
  mutationRate: number;
  /** Development model that first interpreted this locus: v1 body and color, v3 appearance, v5 structure, v6 development. */
  developmentVersion: 1 | 3 | 5 | 6;
  /**
   * How a Genesis (genome v4) genotype combines its two copies at a quantitative locus; null where the locus has its own
   * categorical rule. Only these loci can receive open-ended alleles.
   */
  dominance: DominanceClass | null;
};

/** Legacy mutation: one step to an adjacent allele, the only step at A0 or A5. */
const adjacent = (allele: number): MutationTarget[] =>
  allele === 0 ? [{ allele: 1, weight: 1 }] : allele === ALLELE_COUNT - 1 ? [{ allele: ALLELE_COUNT - 2, weight: 1 }] : [{ allele: allele - 1, weight: 0.5 }, { allele: allele + 1, weight: 0.5 }];

const APPEARANCE_EXPRESSION: Record<typeof APPEARANCE_LOCI[number], Expression> = {
  base_color: 'classic-dominant', accent_color: 'classic-dominant', dot_color: 'rainbow-dominant', iris_color: 'classic-dominant', shimmer: 'additive',
  scale_type: 'recessive', body_motif: 'overlay', motif_density: 'additive', motif_scale: 'additive', motif_contrast: 'additive', motif_reach: 'additive', fin_motif: 'overlay',
};
const STRUCTURE_EXPRESSION: Record<typeof STRUCTURE_LOCI[number], Expression> = {
  tail_topology: 'structural-recessive', lobe_balance: 'additive', topology_spread: 'additive', dorsal_form: 'structural-recessive', barbel_count: 'barbel-series', fin_ray_density: 'additive',
};

function define(id: GenomeLocus): LocusDefinition {
  const index = GENOME_LOCI.indexOf(id), chromosome = Math.floor(index / 6) + 1;
  const common = { id, index, chromosome, chromosomeName: CHROMOSOMES[chromosome - 1], dominance: KOI_DOMINANCE[id] ?? null };
  const levels = (weights: readonly number[], label: (allele: number) => string, targets?: readonly (readonly MutationTarget[])[]) =>
    weights.map((founderWeight, allele) => ({ id: allele, label: label(allele), founderWeight, mutationTargets: targets?.[allele] ?? adjacent(allele) }));
  if (index < LOCI.length) {
    const expression: Expression = id === 'melanin_switch' || id === 'metallic_switch' ? 'recessive-switch' : 'additive';
    return { ...common, sinceGenome: 1, expression, alleles: levels(FOUNDER_WEIGHTS, allele => `A${allele}`), baseline: null, mutationRate: MUTATION_RATE, developmentVersion: 1 };
  }
  if (index < LOCI.length + APPEARANCE_LOCI.length) {
    const locus = id as typeof APPEARANCE_LOCI[number], offset = index - LOCI.length;
    return { ...common, sinceGenome: 2, expression: APPEARANCE_EXPRESSION[locus], alleles: levels(APPEARANCE_FOUNDER_WEIGHTS[locus], allele => appearanceAlleleLabel(locus, allele)),
      baseline: APPEARANCE_BASELINE[offset], mutationRate: MUTATION_RATE, developmentVersion: 3 };
  }
  if (index >= DEVELOPMENT_OFFSET) {
    const locus = id as keyof typeof DEVELOPMENT_ALLELE_LABELS, offset = index - DEVELOPMENT_OFFSET;
    const expression: Expression = locus === 'pigment_cascade' ? 'cascade-recessive' : locus === 'fin_program' ? 'dominant-program' : locus === 'glow' ? 'semi-recessive' : 'additive';
    return { ...common, sinceGenome: 4, expression, alleles: levels(DEVELOPMENT_FOUNDER_WEIGHTS[locus], allele => DEVELOPMENT_ALLELE_LABELS[locus][allele]),
      baseline: DEVELOPMENT_BASELINE[offset], mutationRate: MUTATION_RATE, developmentVersion: 6 };
  }
  const locus = id as typeof STRUCTURE_LOCI[number], offset = index - LOCI.length - APPEARANCE_LOCI.length, targets = STRUCTURE_MUTATION_TARGETS[locus];
  return { ...common, sinceGenome: 3, expression: STRUCTURE_EXPRESSION[locus], alleles: levels(STRUCTURE_FOUNDER_WEIGHTS[locus], allele => STRUCTURE_ALLELE_LABELS[locus][allele], targets),
    baseline: STRUCTURE_BASELINE[offset], mutationRate: targets ? STRUCTURAL_MUTATION_RATE : MUTATION_RATE, developmentVersion: 5 };
}

export const LOCUS_REGISTRY: readonly LocusDefinition[] = GENOME_LOCI.map(define);
export const LOCUS_BY_ID = new Map(LOCUS_REGISTRY.map(entry => [entry.id, entry]));

export function locusDefinition(id: string): LocusDefinition {
  const entry = LOCUS_BY_ID.get(id as GenomeLocus);
  if (!entry) throw new Error(`Unknown locus ${id}.`);
  return entry;
}

/** The loci a genome version carries, in order. */
export const lociFor = (version: GenomeVersion): readonly LocusDefinition[] => LOCUS_REGISTRY.slice(0, LOCI_PER_GENOME[version]);

/** The two copies a genome expresses at a locus: its own alleles, or the baseline for a locus its version predates. */
export function allelesAt(genome: Genome, id: string): [number, number] {
  const entry = locusDefinition(id);
  if (genome.version < entry.sinceGenome) return [entry.baseline!, entry.baseline!];
  return [genome.maternal[entry.index], genome.paternal[entry.index]];
}

export const alleleLabel = (id: string, allele: number) => isNovel(allele) ? 'new allele' : locusDefinition(id).alleles[allele]?.label ?? `A${allele}`;

/** Why a genome is invalid under the registry, or null: its length must match its version and every allele must be supported. */
export function genomeProblem(genome: Genome): string | null {
  const loci = lociFor(genome.version);
  if (genome.maternal.length !== loci.length || genome.paternal.length !== loci.length) return `Genome v${genome.version} must carry ${loci.length} loci per copy.`;
  if ((genome.version === 4) !== Boolean(genome.genesis)) return 'Only genome v4 carries a development block.';
  const novel = new Map((genome.genesis?.novel ?? []).map(entry => [entry.id, entry]));
  if (genome.genesis) {
    const problem = genesisProblem(genome.genesis, KOI_LOAD, loci.length, koiNovelEligible, moduleAlleleCounts('koi'));
    if (problem) return problem;
  }
  for (const entry of loci) {
    for (const allele of [genome.maternal[entry.index], genome.paternal[entry.index]]) {
      if (genome.genesis && isNovel(allele)) {
        if (novel.get(allele)?.locus !== entry.index) return `Novel allele ${allele} is not defined for ${entry.id}.`;
        continue;
      }
      if (!Number.isInteger(allele) || allele < 0 || allele >= entry.alleles.length) return `Allele A${allele} is not supported at ${entry.id}.`;
    }
  }
  if (genome.genesis) {
    const carried = new Set([...genome.maternal, ...genome.paternal]);
    if (genome.genesis.novel.some(entry => !carried.has(entry.id))) return 'A genome lists a novel allele it does not carry.';
  }
  return null;
}
