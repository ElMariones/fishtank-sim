import { express } from './genetics';
import type { Fish, Phenotype, Species } from './types';

/**
 * Clutch ratio analysis (R-202 discovery tools): count the visible classes of a few switch-like traits among siblings and
 * test them against the Mendelian ratios a single locus can give. It reads only what the player can see (phenotypes), so it
 * works in discovery mode, and it proposes hypotheses rather than revealing genotypes.
 */
export type RatioTrait = { id: string; label: string; classify: (p: Phenotype) => string };
const fins = (p: Phenotype) => p.genesis?.fins ?? 'standard';
const m = (p: Phenotype) => p.genesis?.modules;

const KOI: RatioTrait[] = [
  { id: 'fins', label: 'Fin program', classify: p => ({ standard: 'standard', veil: 'veil', butterfly: 'butterfly' })[fins(p)] },
  { id: 'pigment', label: 'Pigment cascade', classify: p => (p.genesis?.ghost ?? 0) >= 0.9 ? 'ghost' : (p.genesis?.ghost ?? 0) > 0.3 ? 'faded' : 'colored' },
  { id: 'glow', label: 'Photophores', classify: p => (p.genesis?.glow ?? 0) >= 0.7 ? 'radiant' : (p.genesis?.glow ?? 0) > 0.05 ? 'faint' : 'dark' },
  { id: 'tail', label: 'Tail topology', classify: p => p.structure.tail },
  { id: 'dorsal', label: 'Dorsal form', classify: p => p.structure.dorsal },
  { id: 'scales', label: 'Scales', classify: p => p.appearance.scales },
  { id: 'second-dorsal', label: 'Second dorsal fin', classify: p => (m(p)?.secondDorsal ? 'twin sail' : 'single') },
  { id: 'wen', label: 'Wen', classify: p => (m(p)?.wen ? 'wen' : 'smooth head') },
  { id: 'bubble', label: 'Bubble eyes', classify: p => (m(p)?.bubble ? 'sacs' : 'plain eyes') },
];
const AXOLOTL: RatioTrait[] = [
  { id: 'morph', label: 'Pigment morph', classify: p => p.axolotl?.pigmentation.morph.replace('-like', '') ?? 'wild' },
  { id: 'crest', label: 'Tail crest', classify: p => ({ standard: 'standard', veil: 'frilled', butterfly: 'sail' })[fins(p)] },
  { id: 'plume', label: 'Gills', classify: p => (p.genesis?.plume ? 'plume' : 'standard') },
  { id: 'fluorescence', label: 'Fluorescence', classify: p => ((p.genesis?.glow ?? 0) >= 0.5 ? 'glowing' : 'dark') },
  { id: 'rami', label: 'Gill rami', classify: p => (m(p)?.extraRami ? 'four rami' : 'three rami') },
  { id: 'dorsal-crest', label: 'Dorsal crest', classify: p => (m(p)?.crest ? 'crested' : 'smooth back') },
];
const GOLDFISH: RatioTrait[] = [
  { id: 'tail', label: 'Tail', classify: p => p.goldfish?.tail.kind ?? 'single' },
  { id: 'eyes', label: 'Eyes', classify: p => p.goldfish?.eyes.kind ?? 'normal' },
  { id: 'dorsal', label: 'Dorsal fin', classify: p => p.goldfish?.fins.dorsal ?? 'full' },
  { id: 'scales', label: 'Scales', classify: p => p.goldfish?.scales.type ?? 'metallic' },
  { id: 'hood', label: 'Hood', classify: p => p.goldfish?.head.hoodKind ?? 'none' },
  { id: 'fins', label: 'Fin length', classify: p => ((p.goldfish?.fins.long ?? 0) > 0 ? 'long' : 'short') },
];
export const RATIO_TRAITS: Record<Species, RatioTrait[]> = { koi: KOI, axolotl: AXOLOTL, goldfish: GOLDFISH };

export type Hypothesis = { ratio: string; text: string; chi: number; fits: boolean };
export type TraitRatio = { trait: RatioTrait; counts: [string, number][]; total: number; best: Hypothesis | null; others: Hypothesis[] };

/** 95% chi-square critical values by degrees of freedom. */
const CRITICAL = [0, 3.841, 5.991, 7.815];
const chiSquare = (observed: number[], expected: number[]) => observed.reduce((sum, value, i) => sum + (expected[i] > 0 ? (value - expected[i]) ** 2 / expected[i] : value > 0 ? Infinity : 0), 0);

const TWO: [string, number[], string][] = [
  ['1 : 1', [1, 1], 'A test-cross ratio: one parent carries two different alleles here and the other is homozygous.'],
  ['3 : 1', [3, 1], 'Both parents carry one hidden copy of a recessive allele: a single locus with simple dominance.'],
  ['1 : 3', [1, 3], 'Both parents carry one copy of a dominant allele: a single locus with simple dominance.'],
  ['15 : 1', [15, 1], 'Two loci, or a threshold trait: only animals with enough liability cross the line.'],
];
const THREE: [string, number[], string][] = [
  ['1 : 2 : 1', [1, 2, 1], 'Both parents are heterozygous and the trait is incompletely dominant (each genotype looks different).'],
  ['2 : 1 : 1', [2, 1, 1], 'Both parents are heterozygous; the middle class is dominant over one extreme only.'],
  ['1 : 1 : 2', [1, 1, 2], 'Both parents are heterozygous; the middle class is dominant over one extreme only.'],
];

/** Classes ordered by frequency of the trait's natural order, then the best-fitting single-locus hypothesis. */
export function traitRatio(trait: RatioTrait, phenotypes: readonly Phenotype[]): TraitRatio {
  const tally = new Map<string, number>();
  for (const p of phenotypes) { const value = trait.classify(p); tally.set(value, (tally.get(value) ?? 0) + 1); }
  const counts = [...tally.entries()].sort((a, b) => b[1] - a[1]), total = phenotypes.length;
  if (counts.length < 2 || counts.length > 3 || total < 6) return { trait, counts, total, best: null, others: [] };
  const observed = counts.map(([, n]) => n), table = counts.length === 2 ? TWO : THREE;
  const scored = table.map(([ratio, parts, text]) => {
    const sum = parts.reduce((a, b) => a + b, 0), expected = parts.map(part => total * part / sum), chi = chiSquare(observed, expected);
    return { ratio, text, chi: Math.round(chi * 100) / 100, fits: chi <= CRITICAL[counts.length - 1] };
  }).sort((a, b) => a.chi - b.chi);
  return { trait, counts, total, best: scored[0].fits ? scored[0] : null, others: scored.slice(1).filter(entry => entry.fits) };
}

export type Family = { key: string; motherId: string; fatherId: string; species: Species; offspring: Fish[] };
/** Sibling groups by parent pair, most recent first. Eggs are left out: they cannot be seen yet. */
export function families(fish: readonly Fish[], minimum = 6): Family[] {
  const groups = new Map<string, Family>();
  for (const member of fish) {
    if (!member.parents || member.life.lengthCm <= 0) continue;
    const key = member.parents.join('×');
    const group = groups.get(key) ?? { key, motherId: member.parents[0], fatherId: member.parents[1], species: member.species, offspring: [] };
    group.offspring.push(member); groups.set(key, group);
  }
  return [...groups.values()].filter(group => group.offspring.length >= minimum).sort((a, b) => b.offspring[b.offspring.length - 1].id.localeCompare(a.offspring[a.offspring.length - 1].id));
}

/** Every ratio trait that segregates in a family. */
export function familyRatios(family: Family): TraitRatio[] {
  const phenotypes = family.offspring.map(member => express(member.genome));
  return RATIO_TRAITS[family.species].map(trait => traitRatio(trait, phenotypes)).filter(ratio => ratio.counts.length > 1);
}
