import { AXOLOTL_CHROMOSOMES, AXOLOTL_DEV_NOTES, AXOLOTL_DEV_REGISTRY, AXOLOTL_EXPRESSION_NOTES, AXOLOTL_LOCUS_NOTES, AXOLOTL_LOCUS_REGISTRY, type AxolotlDevLocus, type AxolotlLocus } from '../core/axolotlCatalog';
import { axolotlDominance, describeAxolotlGenotype, describeAxolotlPhenotype, isAxolotlGenome } from '../core/axolotlGenetics';
import { genotypeVisible, locusStage } from '../core/atlas';
import { DOMINANCE_LABELS, isNovel } from '../core/genesis';
import type { Fish, World } from '../core/types';
import { LocusTip } from './LocusTip';

/** Species-local phenotype cards. Nothing in this component interprets an axolotl allele through the koi catalog. */
export function AxolotlTraitPanel({ fish, genotypeKnown = true }: { fish: Fish; genotypeKnown?: boolean }) {
  if (!isAxolotlGenome(fish.genome)) return null;
  // In discovery mode hidden carrier copies are unknown until the animal is sequenced.
  const rows = describeAxolotlPhenotype(fish.genome).map(row => row.trait === 'Hidden copies' && !genotypeKnown ? { ...row, value: 'Unknown: sequence to reveal' } : row), groups = [...new Set(rows.map(row => row.group))];
  return <div className="axolotl-traits">
    {groups.map(group => <div className="trait-block appearance-block" key={group}>
      <div className="eyebrow">AXOLOTL · {group.toUpperCase()}</div>
      <dl className="appearance-traits">{rows.filter(row => row.group === group).map(row => <div key={row.trait}><dt>{row.trait}</dt><dd>{row.value}{row.note ? <span className="rarity recorded" title="Read from the genome and kept for future breeding, but not simulated yet">{row.note}</span> : null}</dd></div>)}</dl>
    </div>)}
    <p className="help-copy">Pigment morph labels use familiar axolotl phenotype names as biological anchors. Decorative color, pattern and body-shape combinations are synthetic game genetics. Values marked “recorded only” are inherited and shown, but the lab does not simulate them yet.</p>
  </div>;
}

/** Full 66-locus independent axolotl genome browser, grouped by its own 11 chromosomes. */
export function AxolotlGenomeView({ fish, world }: { fish: Fish; world: World }) {
  if (!isAxolotlGenome(fish.genome)) return null;
  const rows = describeAxolotlGenotype(fish.genome), seen = genotypeVisible(world, fish), names = new Map(world.alleles.map(record => [record.id, record.name]));
  const chromosomes = fish.genome.version === 2 ? [...AXOLOTL_CHROMOSOMES, { id: 'AX-DEV', label: 'Development' }] : AXOLOTL_CHROMOSOMES;
  const registry = fish.genome.version === 2 ? [...AXOLOTL_LOCUS_REGISTRY, ...AXOLOTL_DEV_REGISTRY] : AXOLOTL_LOCUS_REGISTRY;
  const code = (value: number, label: string, copy: string) => !seen ? <code className="hidden" title="Sequence this animal to read its alleles">??</code>
    : <code title={`Copy inherited from ${copy}`}>{isNovel(value) ? 'N' : `A${value}`}<small>{isNovel(value) ? names.get(value) ?? 'new allele' : label}</small></code>;
  return <>
    <p className="help-copy">{fish.genome.version === 2
      ? 'Axolotl genome v2 (Genesis) has two phased copies across 72 loci on 12 chromosomes. Quantitative loci combine by dominance (each allele has a potency), new open-ended alleles (N) can arise, and chromosome 12 adds fluorescence, frill and plume-gill programs, a threshold for extra digits, canalization and overdominant vigor.'
      : 'Axolotl Genome v1 has two phased copies across 66 species-specific loci on 11 chromosomes. Quantitative alleles blend; the leucistic-like, albino-like and melanoid-like switches are recessive in this simulation.'} These loci never reuse koi chromosome meanings. Hover or focus a locus name for what it does.</p>
    {world.atlas.mode === 'discovery' ? <p className="help-copy atlas-note">Discovery mode: unidentified loci show as numbers{seen ? '' : ' and alleles stay hidden until you sequence this animal'}.</p> : null}
    {chromosomes.map((chromosome, chromosomeIndex) => {
      const entries = registry.map((entry, index) => ({ entry, index })).filter(({ entry }) => entry.chromosomeId === chromosome.id);
      return <div className="chromosome" key={chromosome.id}>
        <h3>{String(chromosomeIndex + 1).padStart(2, '0')} / {chromosome.label}</h3>
        {entries.map(({ entry, index }, offset) => {
          const row = rows[index], mutation = fish.mutations.some(m => m.locus === index), inherited = !mutation && fish.origins.some(o => o.locus === index);
          const stage = locusStage(world, 'axolotl', index), dominance = axolotlDominance(index);
          const description = stage >= 1 ? AXOLOTL_LOCUS_NOTES[entry.id as AxolotlLocus] ?? AXOLOTL_DEV_NOTES[entry.id as unknown as AxolotlDevLocus] : 'Not identified yet. Breed parents that carry different alleles here.';
          const inheritance = stage >= 2 ? `${AXOLOTL_EXPRESSION_NOTES[entry.expression]}${dominance && fish.genome.genesis ? ` Genesis: ${DOMINANCE_LABELS[dominance]}.` : ''}` : 'How its two copies combine is not worked out yet.';
          return <div className={`locus appearance-locus ${mutation ? 'mutated' : ''} ${stage ? '' : 'unknown'}`} key={entry.id}>
            <span><LocusTip label={stage >= 1 ? row.label : `Locus ${chromosomeIndex + 1}.${offset + 1}`} description={description} inheritance={inheritance}>{mutation ? ' *' : inherited ? ' ◆' : ''}</LocusTip>
              <small>{entry.positionCm.toFixed(1)} cM</small>
              {seen && row.carrierFor ? <span className="rarity carrier">{row.carrierFor} carrier</span> : row.expressedRecessive ? <span className="rarity">expressed</span> : null}</span>
            {code(row.maternal, row.maternalAllele, 'mother')}
            {code(row.paternal, row.paternalAllele, 'father')}
          </div>;
        })}
      </div>;
    })}
    <p className="help-copy">* A new mutation in this animal. ◆ An allele copy inherited from a recorded mutation. Positions are species-local map positions used for linked inheritance and crossover.</p>
  </>;
}
