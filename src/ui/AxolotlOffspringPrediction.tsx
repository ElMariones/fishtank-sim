import { useMemo } from 'react';
import { axolotlFingerprint, expressAxolotl, inheritAxolotl, isAxolotlGenome, type AxolotlGenome, type AxolotlPigmentMorph } from '../core/axolotlGenetics';
import { hash } from '../core/random';

const SAMPLES = 256;
const pct = (value: number) => `${Math.round(value * 100)}%`;
const title = (value: string) => value.replace(/(^|-)([a-z])/g, (_m, dash, letter) => `${dash ? ' ' : ''}${letter.toUpperCase()}`);

type Range = { label: string; unit: 'cm' | 'score'; values: number[] };

function quantile(sorted: readonly number[], q: number) {
  if (!sorted.length) return 0;
  const position = (sorted.length - 1) * q, lo = Math.floor(position), hi = Math.ceil(position);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (position - lo);
}

function samplePair(mother: AxolotlGenome, father: AxolotlGenome) {
  const key = `${axolotlFingerprint(mother)}:${axolotlFingerprint(father)}`;
  const ranges: Range[] = [
    { label: 'Adult length', unit: 'cm', values: [] },
    { label: 'Head width', unit: 'score', values: [] },
    { label: 'Forelimb length', unit: 'score', values: [] },
    { label: 'Hindlimb length', unit: 'score', values: [] },
    { label: 'Tail length', unit: 'score', values: [] },
    { label: 'Gill stalk length', unit: 'score', values: [] },
    { label: 'Melanin', unit: 'score', values: [] },
    { label: 'Iridophore', unit: 'score', values: [] },
    { label: 'Activity', unit: 'score', values: [] },
    { label: 'Regeneration', unit: 'score', values: [] },
  ];
  const morphs = new Map<AxolotlPigmentMorph, number>();
  for (let i = 0; i < SAMPLES; i++) {
    const child = inheritAxolotl(mother, father, hash(`axolotl-prediction-v1:${key}:${i}`)).genome;
    const p = expressAxolotl(child);
    const m = p.morphology;
    const normalized = [
      p.adultLengthCm,
      (m.head.width - 0.22) / 0.18,
      (m.limbs.foreLength - 0.10) / 0.15,
      (m.limbs.hindLength - 0.11) / 0.17,
      (m.tail.length - 0.42) / 0.42,
      (m.gills.stalkLength - 0.07) / 0.18,
      p.pigmentation.melanin,
      p.pigmentation.iridophore,
      p.activity,
      p.life.regeneration,
    ];
    normalized.forEach((value, index) => ranges[index].values.push(Math.max(0, Math.min(index === 0 ? 100 : 1, value))));
    morphs.set(p.pigmentation.morph, (morphs.get(p.pigmentation.morph) ?? 0) + 1);
  }
  return {
    ranges: ranges.map(range => {
      const values = [...range.values].sort((a, b) => a - b);
      return { label: range.label, unit: range.unit, low: quantile(values, 0.1), median: quantile(values, 0.5), high: quantile(values, 0.9) };
    }),
    morphs: [...morphs.entries()].map(([morph, count]) => ({ morph, frequency: count / SAMPLES })).sort((a, b) => b.frequency - a.frequency),
  };
}

/** Deterministic Mendelian preview for the standalone axolotl genome. */
export function AxolotlOffspringPrediction({ mother, father }: { mother: unknown; father: unknown }) {
  if (!isAxolotlGenome(mother) || !isAxolotlGenome(father)) return null;
  const motherKey = axolotlFingerprint(mother), fatherKey = axolotlFingerprint(father);
  const prediction = useMemo(() => samplePair(mother, father), [motherKey, fatherKey]);
  return <section className="planner-odds" aria-label="Axolotl offspring prediction">
    <strong>Axolotl offspring adult potential</strong>
    <p className="help-copy">{SAMPLES} deterministic offspring samples using the axolotl linkage map and species-local mutation model. Ranges show the 10th–90th percentile of this sample, not a guarantee.</p>
    <div className="prediction-table"><table><thead><tr><th>Trait</th><th>10th–90th percentile</th><th>Median</th></tr></thead><tbody>
      {prediction.ranges.map(range => {
        const format = (value: number) => range.unit === 'cm' ? `${value.toFixed(1)} cm` : pct(value);
        return <tr key={range.label}><th scope="row">{range.label}</th><td>{format(range.low)} – {format(range.high)}</td><td>{format(range.median)}</td></tr>;
      })}
    </tbody></table></div>
    <p className="help-copy"><strong>Pigment morph sample:</strong> {prediction.morphs.map(item => `${title(item.morph)} ${pct(item.frequency)}`).join(' · ')}</p>
    <small>Polygenic ranges are marginal. Recessive pigment outcomes depend on the pair's hidden copies; care changes growth and current size, not the inherited genome.</small>
  </section>;
}
