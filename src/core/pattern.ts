import { section, type Anatomy, type Vec } from './anatomy';
import { LOCI, label } from './catalog';
import { clamp, hash, random } from './random';
import type { Genome, MarkingAnchor, Phenotype } from './types';

/**
 * Development v2 marking structure. Each homolog of the Pigments (4) and Pattern (5) chromosomes is read as three
 * adjacent two-locus haplotype blocks. A block haplotype always produces the same marking anchor, so markings are
 * transmitted with the chromosome copy that carries them. A crossover inside a block or a mutation at one of its loci
 * creates a different haplotype and therefore relocates that one marking.
 */
export const MARKING_BLOCKS = [18, 20, 22, 24, 26, 28].map((first, block) => ({
  block, loci: [first, first + 1] as const, label: `${label(LOCI[first])} + ${label(LOCI[first + 1]).toLowerCase()}`,
}));

/** Identical maternal and paternal block haplotypes merge into one marking this much larger. */
const DOSE_SIZE = 1.3;
/** A warm or dark layer below this opacity is too faint to count as visible markings. */
export const MARKING_VISIBLE_ALPHA = 0.12;

function anchorFor(block: number, alleles: [number, number], origin: MarkingAnchor['origin']): MarkingAnchor {
  const key = `b${block}:${alleles[0]}${alleles[1]}`;
  const rng = random(hash(`pattern-v2:${key}`));
  return {
    key, block, alleles, origin,
    u: 0.1 + 0.82 * rng(), v: (rng() * 2 - 1) * 0.8 - 0.08, size: 0.65 + 0.7 * rng(), angle: rng() * 3,
    layer: rng() < 1 / 3 ? 'dark' : 'warm', priority: rng(),
  };
}

/** Phased genome → inherited marking anchors, most prominent first. Independent of maternal/paternal array order. */
export function markingAnchors(genome: Genome): MarkingAnchor[] {
  const anchors: MarkingAnchor[] = [];
  for (const { block, loci: [first, second] } of MARKING_BLOCKS) {
    const maternal: [number, number] = [genome.maternal[first], genome.maternal[second]];
    const paternal: [number, number] = [genome.paternal[first], genome.paternal[second]];
    if (maternal[0] === paternal[0] && maternal[1] === paternal[1]) anchors.push(anchorFor(block, maternal, 'both'));
    else anchors.push(anchorFor(block, maternal, 'maternal'), anchorFor(block, paternal, 'paternal'));
  }
  return anchors.sort((a, b) => b.priority - a.priority || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

export type PlacedMarking = {
  key: string; u: number; v: number; radius: number; aspect: number; angle: number; layer: MarkingAnchor['layer']; satellite: boolean;
};

/**
 * Places `frequency` patches in body coordinates. Anchors are shown in priority order; counts above the anchor total
 * add smaller satellites whose offsets are also inherited. The birth seed only jitters position, size and angle.
 */
export function placeMarkings(p: Phenotype, seed: number): PlacedMarking[] {
  const anchors = p.markings;
  if (!anchors.length) return [];
  const jitter = random(hash(`pattern-v2:birth:${seed}`));
  const spread = 1 - p.symmetry * 0.5;
  return Array.from({ length: p.frequency }, (_, i) => {
    const anchor = anchors[i % anchors.length], satellite = i >= anchors.length;
    let u = anchor.u, v = anchor.v, size = anchor.size * (anchor.origin === 'both' ? DOSE_SIZE : 1), angle = anchor.angle;
    if (satellite) {
      const orbit = random(hash(`pattern-v2:${anchor.key}:satellite:${Math.floor(i / anchors.length)}`));
      const direction = orbit() * Math.PI * 2;
      u += Math.cos(direction) * 0.07; v += Math.sin(direction) * 0.45; size *= 0.55; angle += orbit() * 3;
    }
    return {
      key: satellite ? `${anchor.key}+${i}` : anchor.key,
      u: clamp(u + (jitter() - 0.5) * 0.06, 0.02, 0.98),
      v: clamp(v * spread + (jitter() - 0.5) * 0.16, -1, 1),
      radius: p.patternScale * size * (0.88 + jitter() * 0.24),
      aspect: 0.5 + p.warp, angle: angle + (jitter() - 0.5) * 0.5, layer: anchor.layer, satellite,
    };
  });
}

/** Body coordinates → body-length coordinates on a specific anatomy, so markings stay attached to any silhouette. */
export function markingPosition(anatomy: Anatomy, marking: Pick<PlacedMarking, 'u' | 'v'>): Vec {
  const x = anatomy.snoutX + (0.5 - anatomy.snoutX) * marking.u, s = section(anatomy, x);
  return { x, y: s.center + marking.v * s.half };
}
