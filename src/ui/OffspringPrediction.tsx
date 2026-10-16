import { useMemo, useState } from 'react';
import { GENOME_LOCI, label } from '../core/catalog';
import { fingerprint } from '../core/genetics';
import { predictOffspring, singleLocusOdds } from '../core/prediction';
import { alleleLabel, locusDefinition } from '../core/registry';
import { isNovel } from '../core/genesis';
import type { Genome } from '../core/types';

export function OffspringPrediction({ mother, father, goals, knownLocus, genotypesKnown = true }: {
  mother: Genome; father: Genome; goals: string[];
  /** Discovery mode: only loci whose inheritance the Genome Atlas has worked out can be predicted exactly. */
  knownLocus?: (index: number) => boolean; genotypesKnown?: boolean;
}) {
  const choices = GENOME_LOCI.filter(name => !knownLocus || knownLocus(locusDefinition(name).index));
  const [picked, setLocus] = useState('body_depth'), locus = choices.includes(picked as typeof choices[number]) ? picked : choices[0] ?? 'body_depth';
  // Stable content keys avoid resampling immutable genomes on live clock/behavior updates.
  const motherKey = fingerprint(mother), fatherKey = fingerprint(father), goalsKey = goals.join('|');
  const prediction = useMemo(() => predictOffspring(mother, father, goals), [motherKey, fatherKey, goalsKey]);
  const exact = genotypesKnown && choices.length > 0;
  const odds = exact ? singleLocusOdds(mother, father, locus) : [], named = locusDefinition(locus).index >= 48;
  return <section className="planner-odds" aria-label="Offspring prediction">
    <strong>Offspring adult potential</strong>
    <p className="help-copy">{prediction.samples} independent samples with linkage and {(prediction.mutationRate * 100).toFixed(1)}% mutation per copy. The 10th–90th percentile range covers the middle 80% of this sample; it is not a guarantee or a confidence interval. Care changes growth and current size.</p>
    <div className="prediction-table"><table><thead><tr><th>Trait</th><th>10th–90th percentile</th><th>Median</th></tr></thead>
      <tbody>{prediction.ranges.map(range => {
        const format = (value: number) => range.unit === 'cm' ? `${value.toFixed(1)} cm` : `${Math.round(value * 100)}%`;
        return <tr key={range.key}><th scope="row">{range.label}</th><td>{format(range.low)} – {format(range.high)}</td><td>{format(range.median)}</td></tr>;
      })}</tbody></table></div>
    <small>Percent values are normalized expression scores, not the chance of inheriting a trait. Ranges are marginal; combined goals may be linked.</small>
    {exact ? <><label>Exact single-locus odds<select aria-label="Exact single-locus odds" value={locus} onChange={event => setLocus(event.target.value)}>
      {choices.map(name => <option key={name} value={name}>{label(name)}</option>)}
    </select></label>
    <p>{odds.map(outcome => <span className="genotype-odds" key={outcome.alleles.join('/')}><b>{outcome.alleles.map(allele => isNovel(allele) ? 'N' : allele).join(' / ')}</b>{named ? ` (${outcome.alleles.map(allele => alleleLabel(locus, allele)).join(' / ')})` : ''}: {Math.round(outcome.probability * 100)}% </span>)}</p></>
      : <p className="help-copy">{genotypesKnown ? 'Exact single-locus odds need a locus whose inheritance the Genome Atlas has worked out.' : 'Exact single-locus odds need both parents’ genotypes: sequence them from the inspector.'}</p>}
    <small>Allele IDs, unordered pairs, before mutation. A parent whose genome predates a locus transmits its baseline: genome 1 at appearance loci, genomes 1 and 2 at structure loci. These exact odds do not predict visible expression.</small>
  </section>;
}
