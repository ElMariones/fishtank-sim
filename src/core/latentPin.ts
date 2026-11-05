/**
 * Latent genotypes (load and body-plan module genes of older genomes) are read from a genome's fingerprint. A germline
 * edit (FS-132) builds a new genome object for inheritance; it must keep reading the latent genotype of the genome the
 * animal was born with, or an edit at one locus would silently reshuffle unrelated latent genes. Edited genomes are
 * pinned here to their source genome. No imports, so any genetics module can read it without a cycle.
 */
const PINS = new WeakMap<object, object>();

export function pinLatentSource<T extends object>(edited: T, source: T): T {
  PINS.set(edited, PINS.get(source) ?? source);
  return edited;
}

/** The genome whose fingerprint seeds latent genotypes: the unedited source of a germline genome, or the genome itself. */
export const latentSource = <T extends object>(genome: T): T => (PINS.get(genome) as T | undefined) ?? genome;
