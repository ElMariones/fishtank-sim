import { useMemo, useState } from 'react';
import { ALL_LOCI, label } from '../core/catalog';
import { fingerprint } from '../core/genetics';
import { predictOffspring, singleLocusOdds } from '../core/prediction';
import type { Genome } from '../core/types';

export function OffspringPrediction({ mother, father, goals }: { mother: Genome; father: Genome; goals: string[] }) {
  const [locus, setLocus] = useState('body_depth');
  // Stable content keys avoid resampling immutable genomes on live clock/behavior updates.
  const motherKey = fingerprint(mother), fatherKey = fingerprint(father), goalsKey = goals.join('|');
  const prediction = useMemo(() => predictOffspring(mother, father, goals), [motherKey, fatherKey, goalsKey]);
  const odds = singleLocusOdds(mother, father, locus);
  return <section className="planner-odds" aria-label="Offspring prediction">
    <strong>Offspring adult potential</strong>
    <p className="help-copy">{prediction.samples} independent samples with linkage and {(prediction.mutationRate * 100).toFixed(1)}% mutation per copy. The 10th–90th percentile range covers the middle 80% of this sample; it is not a guarantee or a confidence interval. Care changes growth and current size.</p>
    <div className="prediction-table"><table><thead><tr><th>Trait</th><th>10th–90th percentile</th><th>Median</th></tr></thead>
      <tbody>{prediction.ranges.map(range => {
        const format = (value: number) => range.unit === 'cm' ? `${value.toFixed(1)} cm` : `${Math.round(value * 100)}%`;
        return <tr key={range.key}><th scope="row">{range.label}</th><td>{format(range.low)} – {format(range.high)}</td><td>{format(range.median)}</td></tr>;
      })}</tbody></table></div>
    <small>Percent values are normalized expression scores, not the chance of inheriting a trait. Ranges are marginal; combined goals may be linked.</small>
    <label>Exact single-locus odds<select aria-label="Exact single-locus odds" value={locus} onChange={event => setLocus(event.target.value)}>
      {ALL_LOCI.map(name => <option key={name} value={name}>{label(name)}</option>)}
    </select></label>
    <p>{odds.map(outcome => <span className="genotype-odds" key={outcome.alleles.join('/')}><b>{outcome.alleles.join(' / ')}</b>: {Math.round(outcome.probability * 100)}% </span>)}</p>
    <small>Allele IDs, unordered pairs, before mutation. Genome 1 parents transmit the classic baseline at appearance loci. These exact odds do not predict visible expression.</small>
  </section>;
}
