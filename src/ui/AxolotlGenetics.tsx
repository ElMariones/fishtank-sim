import { AXOLOTL_CHROMOSOMES, AXOLOTL_LOCUS_INDEX, AXOLOTL_LOCUS_REGISTRY } from '../core/axolotlCatalog';
import { describeAxolotlGenotype, describeAxolotlPhenotype, isAxolotlGenome } from '../core/axolotlGenetics';
import type { Fish } from '../core/types';

/** Species-local phenotype cards. Nothing in this component interprets an axolotl allele through the koi catalog. */
export function AxolotlTraitPanel({ fish }: { fish: Fish }) {
  if (!isAxolotlGenome(fish.genome)) return null;
  const rows = describeAxolotlPhenotype(fish.genome), groups = [...new Set(rows.map(row => row.group))];
  return <div className="axolotl-traits">
    {groups.map(group => <div className="trait-block appearance-block" key={group}>
      <div className="eyebrow">AXOLOTL · {group.toUpperCase()}</div>
      <dl className="appearance-traits">{rows.filter(row => row.group === group).map(row => <div key={row.trait}><dt>{row.trait}</dt><dd>{row.value}</dd></div>)}</dl>
    </div>)}
    <p className="help-copy">Pigment morph labels use familiar axolotl phenotype names as biological anchors. Decorative color, pattern and body-shape combinations are synthetic game genetics.</p>
  </div>;
}

/** Full 66-locus independent axolotl genome browser, grouped by its own 11 chromosomes. */
export function AxolotlGenomeView({ fish }: { fish: Fish }) {
  if (!isAxolotlGenome(fish.genome)) return null;
  const rows = describeAxolotlGenotype(fish.genome);
  return <>
    <p className="help-copy">Axolotl Genome v1 has two phased copies across 66 species-specific loci on 11 chromosomes. Quantitative alleles blend; the leucistic-like, albino-like and melanoid-like switches are recessive in this simulation. These loci never reuse koi chromosome meanings.</p>
    {AXOLOTL_CHROMOSOMES.map((chromosome, chromosomeIndex) => {
      const entries = AXOLOTL_LOCUS_REGISTRY.filter(entry => entry.chromosomeId === chromosome.id);
      return <div className="chromosome" key={chromosome.id}>
        <h3>{String(chromosomeIndex + 1).padStart(2, '0')} / {chromosome.label}</h3>
        {entries.map(entry => {
          const index = AXOLOTL_LOCUS_INDEX[entry.id], row = rows[index], mutation = fish.mutations.some(m => m.locus === index), inherited = !mutation && fish.origins.some(o => o.locus === index);
          return <div className={`locus appearance-locus ${mutation ? 'mutated' : ''}`} key={entry.id}>
            <span>{row.label}{mutation ? ' *' : inherited ? ' ◆' : ''}<small>{entry.positionCm.toFixed(1)} cM</small></span>
            <code title="Copy inherited from mother">A{row.maternal}<small>{row.maternalAllele}</small></code>
            <code title="Copy inherited from father">A{row.paternal}<small>{row.paternalAllele}</small></code>
            {row.carrierFor ? <span className="rarity carrier">{row.carrierFor} carrier</span> : row.expressedRecessive ? <span className="rarity">expressed</span> : null}
          </div>;
        })}
      </div>;
    })}
    <p className="help-copy">* A new mutation in this animal. ◆ An allele copy inherited from a recorded mutation. Positions are species-local map positions used for linked inheritance and crossover.</p>
  </>;
}
