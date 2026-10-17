import { AXOLOTL_DEV_INDEX, AXOLOTL_LOCUS_INDEX } from './axolotlCatalog';
import { axolotlFounderGenome, type AxolotlGenome } from './axolotlGenetics';
import { GENOME_LOCI, type GenomeLocus } from './catalog';
import { express, founderGenome } from './genetics';
import { AXOLOTL_LOAD, KOI_LOAD, NOVEL_ID_MIN, type Channel, type DefectKind } from './genesis';
import { somaticFor } from './modules';
import type { CreatureGenome, Genome, Phenotype, Species } from './types';

/**
 * Genesis visual fixtures (renderer v8): reachable genome v4 koi and genome v2 axolotls with chosen development alleles,
 * homozygous load sites and open-ended alleles, so every new look can be inspected and tested. Each fixture starts from a
 * founder and only sets supported alleles, real load sites and a well-formed novel allele.
 */
export type GenesisFixture = { id: string; label: string; species: Species; genome: CreatureGenome; phenotype: Phenotype; birthSeed: number; note: string };

type KoiEdit = { alleles?: Partial<Record<GenomeLocus, [number, number]>>; defect?: DefectKind; novel?: { locus: GenomeLocus; value: number; potency: number; effects: Partial<Record<Channel, number>> } };
type AxolotlEdit = { alleles?: Partial<Record<string, [number, number]>>; defect?: DefectKind };

const KOI_BASE_SEED = 4042, AXOLOTL_BASE_SEED = 7131;

function koi(edit: KoiEdit, seed = KOI_BASE_SEED): Genome {
  const base = founderGenome(seed, 4), genome: Genome = { ...base, maternal: [...base.maternal], paternal: [...base.paternal], genesis: structuredClone(base.genesis!) };
  // A clean, canalized baseline so each card shows one change.
  genome.genesis!.load = { maternal: [], paternal: [] };
  for (const [locus, pair] of Object.entries({ canalization: [4, 4], pigment_cascade: [3, 3], fin_program: [0, 0], glow: [0, 0], red: [4, 3], black: [3, 2], ...edit.alleles }) as [GenomeLocus, [number, number]][]) {
    const index = GENOME_LOCI.indexOf(locus);
    genome.maternal[index] = pair[0]; genome.paternal[index] = pair[1];
  }
  if (edit.defect) {
    const site = KOI_LOAD.find(entry => entry.kind === edit.defect)!;
    genome.genesis!.load = { maternal: [site.id], paternal: [site.id] };
  }
  if (edit.novel) {
    const index = GENOME_LOCI.indexOf(edit.novel.locus), id = NOVEL_ID_MIN + 4242;
    genome.genesis!.novel = [{ id, locus: index, parent: genome.maternal[index], value: edit.novel.value, potency: edit.novel.potency, effects: edit.novel.effects }];
    genome.maternal[index] = id; genome.paternal[index] = id;
  }
  return genome;
}

function axolotl(edit: AxolotlEdit, seed = AXOLOTL_BASE_SEED): AxolotlGenome {
  const base = axolotlFounderGenome(seed, 2), genome: AxolotlGenome = { ...base, maternal: [...base.maternal], paternal: [...base.paternal], genesis: structuredClone(base.genesis!) };
  genome.genesis!.load = { maternal: [], paternal: [] };
  const index = (locus: string) => (AXOLOTL_DEV_INDEX as Record<string, number>)[locus] ?? (AXOLOTL_LOCUS_INDEX as Record<string, number>)[locus];
  for (const [locus, pair] of Object.entries({ axo_canalization: [4, 4], axo_fluorescence: [0, 0], axo_frill_program: [0, 0], axo_gill_program: [0, 0], axo_digit_program: [1, 1], axo_regeneration: [1, 1], ...edit.alleles })) {
    genome.maternal[index(locus)] = pair[0]; genome.paternal[index(locus)] = pair[1];
  }
  if (edit.defect) {
    const site = AXOLOTL_LOAD.find(entry => entry.kind === edit.defect)!;
    genome.genesis!.load = { maternal: [site.id], paternal: [site.id] };
  }
  return genome;
}

const make = (id: string, label: string, species: Species, genome: CreatureGenome, birthSeed: number, note: string): GenesisFixture =>
  ({ id, label, species, genome, phenotype: express(genome), birthSeed, note });

export const GENESIS_KOI_FIXTURES: readonly GenesisFixture[] = [
  make('genesis-koi-standard', 'Genesis baseline', 'koi', koi({}), 11, 'Founder with functional pigment cascade and standard fins.'),
  make('genesis-koi-veil', 'Veil fins', 'koi', koi({ alleles: { fin_program: [4, 1] } }), 12, 'One dominant veil copy: long flowing fins, slower, more oxygen.'),
  make('genesis-koi-butterfly', 'Butterfly fins', 'koi', koi({ alleles: { fin_program: [5, 4] } }), 13, 'Two veil copies: the longest fins and streamers.'),
  make('genesis-koi-ghost', 'Ghost', 'koi', koi({ alleles: { pigment_cascade: [0, 0] } }), 14, 'Two null cascade copies silence every color locus; its colors stay hidden in the genome.'),
  make('genesis-koi-faded', 'Faded', 'koi', koi({ alleles: { pigment_cascade: [1, 0] } }), 15, 'Weak and null cascade copies: colors fade but show.'),
  make('genesis-koi-glow', 'Radiant photophores', 'koi', koi({ alleles: { glow: [5, 5] } }), 16, 'Two radiant glow copies light the flank.'),
  make('genesis-koi-glow-carrier', 'Faint photophores', 'koi', koi({ alleles: { glow: [4, 0] } }), 17, 'One glow copy: semi-recessive, faint.'),
  make('genesis-koi-novel-hue', 'New hue allele', 'koi', koi({ novel: { locus: 'red', value: 5.4, potency: 1.2, effects: { hue: 0.9, sheen: 0.35 } } }), 18, 'An open-ended allele beyond the catalog: stronger red, hue rotated and a sheen.'),
  make('genesis-koi-noisy', 'Low canalization', 'koi', koi({ alleles: { canalization: [0, 0] } }), 19, 'Uncanalized development: shape noise and an uneven tail.'),
  make('genesis-koi-spine', 'Curved spine (load)', 'koi', koi({ defect: 'spine', alleles: { canalization: [1, 1] } }), 20, 'Homozygous recessive load: a kinked body and slower swimming.'),
  make('genesis-koi-fins', 'Fin erosion (load)', 'koi', koi({ defect: 'fins', alleles: { regeneration: [0, 0] } }), 21, 'Ragged, shortened fins; weak regeneration cannot regrow them.'),
  make('genesis-koi-fins-regrown', 'Fin erosion, regrown', 'koi', koi({ defect: 'fins', alleles: { regeneration: [5, 5] } }), 22, 'The same load, rescued by strong regeneration.'),
  make('genesis-koi-eye', 'Clouded eyes (load)', 'koi', koi({ defect: 'eye' }), 23, 'Small, milky eyes.'),
  make('genesis-koi-pigment', 'Pigment wash (load)', 'koi', koi({ defect: 'pigment' }), 24, 'Pale blotches over the markings.'),
  make('genesis-koi-dwarf', 'Dwarf (load)', 'koi', koi({ defect: 'dwarf' }), 25, 'About a third short of its size potential.'),
];

export const GENESIS_AXOLOTL_FIXTURES: readonly GenesisFixture[] = [
  make('genesis-axo-standard', 'Genesis baseline', 'axolotl', axolotl({}), 31, 'Genome v2 founder with standard crest and gills.'),
  make('genesis-axo-fluorescent', 'Fluorescent', 'axolotl', axolotl({ alleles: { axo_fluorescence: [5, 4] } }), 32, 'Dominant fluorescence: a green glow over skin and gills.'),
  make('genesis-axo-frill', 'Frilled crest', 'axolotl', axolotl({ alleles: { axo_frill_program: [4, 1] } }), 33, 'One dominant frill copy: a tall ruffled crest.'),
  make('genesis-axo-sail', 'Sail crest', 'axolotl', axolotl({ alleles: { axo_frill_program: [5, 4] } }), 34, 'Two frill copies: a sail.'),
  make('genesis-axo-plume', 'Plume gills', 'axolotl', axolotl({ alleles: { axo_gill_program: [5, 4] } }), 35, 'Two recessive plume copies: huge feathery gills.'),
  make('genesis-axo-digits', 'Extra digits', 'axolotl', axolotl({ alleles: { axo_digit_program: [5, 5] } }), 36, 'The digit program passes its threshold: extra toes on every foot.'),
  make('genesis-axo-gill-load', 'Stunted gills (load)', 'axolotl', axolotl({ defect: 'gill' }), 37, 'Homozygous load: short gills and poorer oxygen uptake.'),
  make('genesis-axo-limb-load', 'Missing digits (load)', 'axolotl', axolotl({ defect: 'limb', alleles: { axo_regeneration: [0, 0] } }), 38, 'Missing digits that weak regeneration cannot regrow.'),
  make('genesis-axo-limb-regrown', 'Missing digits, regrown', 'axolotl', axolotl({ defect: 'limb', alleles: { axo_regeneration: [5, 5] } }), 39, 'The same load rescued by strong regeneration.'),
  make('genesis-axo-spine', 'Kinked tail (load)', 'axolotl', axolotl({ defect: 'spine', alleles: { axo_canalization: [1, 1] } }), 40, 'A kinked tail and slower swimming.'),
];

/** A deterministic sample of wild Genesis founders, to show natural variety. */
export const GENESIS_FOUNDER_SAMPLE: readonly GenesisFixture[] = [
  ...Array.from({ length: 8 }, (_, i) => make(`genesis-koi-founder-${i + 1}`, `Koi founder ${i + 1}`, 'koi', founderGenome(9100 + i * 7, 4), 9100 + i * 7, 'Unedited genome v4 founder.')),
  ...Array.from({ length: 4 }, (_, i) => make(`genesis-axo-founder-${i + 1}`, `Axolotl founder ${i + 1}`, 'axolotl', axolotlFounderGenome(9300 + i * 11, 2), 9300 + i * 11, 'Unedited genome v2 founder.')),
];

/**
 * Genesis model 2 fixtures (renderer v9, R-203): the same clean founders with module genes set on both homologs, and one
 * development seed chosen for each somatic mark. Model 2 genomes only; everything older never draws these layers.
 */
const model2 = <T extends Genome | AxolotlGenome>(genome: T, modules: number[], dev = genome.genesis!.dev): T =>
  ({ ...genome, genesis: { ...genome.genesis!, dev, model: 2 as const, modules: { maternal: [...modules], paternal: [...modules] } } });
/** The first development seed (from a fixed start) that develops the requested somatic mark at fixture canalization. */
const devWith = (kind: 'mosaic' | 'birthmark', canalization: number) => { for (let dev = 1; dev < 100000; dev++) if (somaticFor(dev, canalization)?.kind === kind) return dev; return 1; };
const NONE = [0, 0, 0, 0, 0, 0];
const koiCanalization = express(koi({})).genesis!.canalization;
export const GENESIS2_FIXTURES: readonly GenesisFixture[] = [
  make('genesis2-koi-twin-sail', 'Twin sail', 'koi', model2(koi({ alleles: { dorsal_height: [5, 5] } }), [3, 3, 0, 0, 0, 0]), 51, 'Dorsal duplication module past its threshold: a second dorsal fin behind the first.'),
  make('genesis2-koi-lionhead', 'Lionhead koi', 'koi', model2(koi({}), [0, 0, 3, 3, 0, 0]), 52, 'Wen module: a raspberry hood over the head.'),
  make('genesis2-koi-bubble', 'Bubble-eye koi', 'koi', model2(koi({}), [0, 0, 0, 0, 1, 3]), 53, 'Two recessive sac copies: fluid pouches under the eyes.'),
  make('genesis2-koi-dragon', 'Dragon', 'koi', model2(koi({ alleles: { fin_program: [4, 1], dorsal_height: [5, 4] } }), [3, 3, 3, 3, 0, 0]), 54, 'Wen, second dorsal and veil fins together.'),
  make('genesis2-koi-mosaic', 'Mosaic sector', 'koi', model2(koi({}), NONE, devWith('mosaic', koiCanalization)), 55, 'A somatic patch of recolored skin. Never inherited.'),
  make('genesis2-koi-birthmark', 'Birthmark', 'koi', model2(koi({}), NONE, devWith('birthmark', koiCanalization)), 56, 'A small one-off mark from development.'),
  make('genesis2-axo-four-rami', 'Four-ramus gills', 'axolotl', model2(axolotl({}), [1, 3, 0, 0, 0, 0]), 61, 'Two recessive copies: a fourth gill ramus on each side.'),
  make('genesis2-axo-polydactyl', 'Polydactyl', 'axolotl', model2(axolotl({}), [0, 0, 3, 0, 0, 0]), 62, 'Polydactyly module: extra digits on every foot.'),
  make('genesis2-axo-crested', 'Crested', 'axolotl', model2(axolotl({}), [0, 0, 0, 1, 3, 3]), 63, 'Dominant crest module: a membrane crest along the back.'),
  make('genesis2-axo-dragon', 'Dragon axolotl', 'axolotl', model2(axolotl({ alleles: { axo_frill_program: [5, 4] } }), [1, 3, 3, 1, 3, 3]), 64, 'Sail crest, dorsal crest, four rami and extra digits.'),
];

