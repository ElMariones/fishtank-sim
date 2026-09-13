import { VISUAL_DESCRIPTORS, VISUAL_FIXTURE_REPORT, type VisualDescriptorKey, type VisualFixtureSubject } from '../core/visualFixtures';
import { PhenotypePortrait } from './FishPortrait';

const COMPARISON_KEYS: VisualDescriptorKey[] = ['length', 'depth', 'head', 'eye', 'tail', 'spread', 'frequency', 'patternScale'];
const EXTREME_KEYS: VisualDescriptorKey[] = ['length', 'depth', 'head', 'snout', 'eye', 'tail', 'spread', 'fork'];
const descriptorLabels = new Map(VISUAL_DESCRIPTORS.map(descriptor => [descriptor.key, descriptor.label]));
const displayPercent = (value: number) => `${Math.round(value * 100)}%`;

function downloadReport() {
  const url = URL.createObjectURL(new Blob([JSON.stringify(VISUAL_FIXTURE_REPORT, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `fs-101-visual-fixtures-v${VISUAL_FIXTURE_REPORT.fixtureVersion}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function FixtureCard({ fixture, compact = false }: { fixture: VisualFixtureSubject; compact?: boolean }) {
  const keys: VisualDescriptorKey[] = compact ? ['length', 'depth', 'tail'] : ['length', 'depth', 'head', 'eye', 'tail'];
  return <article className={`fixture-card ${compact ? 'compact' : ''}`}>
    <div className="fixture-card-heading"><span>{fixture.id}</span><code>{fixture.genomeFingerprint}</code></div>
    <PhenotypePortrait phenotype={fixture.phenotype} seed={fixture.birthSeed} label={`${fixture.label}, deterministic visual fixture`} />
    <h3>{fixture.label}</h3>
    <div className="fixture-measures">{keys.map(key => <span key={key}>{descriptorLabels.get(key)} <strong>{displayPercent(fixture.normalized[key])}</strong></span>)}</div>
    <small>Seed {fixture.birthSeed}{fixture.mutationCount ? ` · ${fixture.mutationCount} new mutation${fixture.mutationCount === 1 ? '' : 's'}` : ''}</small>
  </article>;
}

function DescriptorBars({ fixture }: { fixture: VisualFixtureSubject }) {
  return <div className="fixture-bars">{EXTREME_KEYS.map(key => <div key={key}>
    <span>{descriptorLabels.get(key)}</span><meter min="0" max="1" value={fixture.normalized[key]} aria-label={`${fixture.label} ${descriptorLabels.get(key)}`} /><strong>{displayPercent(fixture.normalized[key])}</strong>
  </div>)}</div>;
}

export function VisualFixtureLab({ onClose }: { onClose: () => void }) {
  return <main className="fixture-lab">
    <div className="fixture-hero">
      <div><div className="eyebrow">FS-101 · FROZEN BASELINE</div><h1>Visual inheritance fixtures</h1><p>A deterministic comparison surface for genome v1 → development v1 → renderer v1. It does not alter your aquarium save.</p></div>
      <div className="fixture-actions"><button className="quiet" onClick={downloadReport}>Download JSON report</button><button onClick={onClose}>Return to aquarium</button></div>
    </div>
    <div className="fixture-summary" aria-label="Fixture summary">
      <span><strong>6</strong> founders</span><span><strong>2 × 20</strong> offspring cohorts</span><span><strong>6</strong> v1 extremes</span><span><strong>{VISUAL_DESCRIPTORS.length}</strong> normalized descriptors</span>
    </div>

    <section className="fixture-section" aria-labelledby="founder-fixtures-title">
      <div className="fixture-section-heading"><div><div className="eyebrow">BASE POPULATION</div><h2 id="founder-fixtures-title">Six founder anchors</h2></div><p>World seed {VISUAL_FIXTURE_REPORT.worldSeed} · fixed timestamp {VISUAL_FIXTURE_REPORT.timestamp}</p></div>
      <div className="fixture-grid founders">{VISUAL_FIXTURE_REPORT.founders.map(fixture => <FixtureCard key={fixture.id} fixture={fixture} />)}</div>
    </section>

    {VISUAL_FIXTURE_REPORT.cohorts.map(cohort => <section className="fixture-section cohort-section" key={cohort.id} aria-labelledby={`${cohort.id}-title`}>
      <div className="fixture-section-heading"><div><div className="eyebrow">REPRODUCIBLE COHORT · SEED {cohort.seed}</div><h2 id={`${cohort.id}-title`}>{cohort.label}</h2></div><p>Twenty births using linked meiosis and the current lab mutation rate.</p></div>
      <div className="fixture-parents"><FixtureCard fixture={cohort.mother} compact /><span aria-hidden="true">×</span><FixtureCard fixture={cohort.father} compact /></div>
      <div className="fixture-grid children">{cohort.children.map(child => <FixtureCard key={child.id} fixture={child} compact />)}</div>
      <div className="fixture-table-wrap"><table className="fixture-table"><caption>Normalized parent and cohort descriptor measurements</caption><thead><tr><th scope="col">Descriptor</th><th scope="col">Mother</th><th scope="col">Father</th><th scope="col">Child min</th><th scope="col">Child mean</th><th scope="col">Child max</th></tr></thead><tbody>{COMPARISON_KEYS.map(key => {
        const measurement = cohort.descriptors[key];
        return <tr key={key}><th scope="row">{descriptorLabels.get(key)}</th><td>{displayPercent(measurement.mother)}</td><td>{displayPercent(measurement.father)}</td><td>{displayPercent(measurement.minimum)}</td><td>{displayPercent(measurement.mean)}</td><td>{displayPercent(measurement.maximum)}</td></tr>;
      })}</tbody></table></div>
    </section>)}

    <section className="fixture-section" aria-labelledby="extreme-fixtures-title">
      <div className="fixture-section-heading"><div><div className="eyebrow">ADVERSARIAL GEOMETRY INPUTS</div><h2 id="extreme-fixtures-title">Six reachable v1 extremes</h2></div><p>Only supported A0–A5 states are used. These cases do not add structural topology.</p></div>
      <div className="extreme-grid">{VISUAL_FIXTURE_REPORT.extremes.map(fixture => <article className="extreme-card" key={fixture.id}><FixtureCard fixture={fixture} /><DescriptorBars fixture={fixture} /></article>)}</div>
    </section>

    <aside className="fixture-findings" aria-labelledby="fixture-findings-title"><div><div className="eyebrow">BASELINE FINDINGS</div><h2 id="fixture-findings-title">What this freezes—and what it exposes</h2></div><ul>{VISUAL_FIXTURE_REPORT.knownFindings.map(finding => <li key={finding}>{finding}</li>)}</ul></aside>
  </main>;
}
