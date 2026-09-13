import { useMemo, useState } from 'react';
import { sharedExtent, type Extent } from '../core/anatomy';
import {
  anatomySweep, LEGACY_ANATOMY_DEFECTS, VISUAL_DESCRIPTORS, VISUAL_FIXTURE_REPORT,
  type AnatomySweepReport, type VisualDescriptorKey, type VisualFixtureSubject,
} from '../core/visualFixtures';
import { PhenotypePortrait } from './FishPortrait';

const COMPARISON_KEYS: VisualDescriptorKey[] = ['length', 'depth', 'head', 'eye', 'tail', 'spread', 'frequency', 'patternScale'];
const EXTREME_KEYS: VisualDescriptorKey[] = ['length', 'depth', 'head', 'snout', 'eye', 'tail', 'spread', 'fork'];
const descriptorLabels = new Map(VISUAL_DESCRIPTORS.map(descriptor => [descriptor.key, descriptor.label]));
const displayPercent = (value: number) => `${Math.round(value * 100)}%`;
type Framing = 'fit' | 'shared';

function downloadReport(sweep: AnatomySweepReport) {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ ...VISUAL_FIXTURE_REPORT, anatomySweep: sweep }, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `visual-fixtures-v${VISUAL_FIXTURE_REPORT.fixtureVersion}-renderer-v${VISUAL_FIXTURE_REPORT.rendererVersion}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function FixtureCard({ fixture, compact = false, shared }: { fixture: VisualFixtureSubject; compact?: boolean; shared?: Extent }) {
  const keys: VisualDescriptorKey[] = compact ? ['length', 'depth', 'tail'] : ['length', 'depth', 'head', 'eye', 'tail'];
  return <article className={`fixture-card ${compact ? 'compact' : ''}`}>
    <div className="fixture-card-heading"><span>{fixture.id}</span><code>{fixture.genomeFingerprint}</code></div>
    <PhenotypePortrait phenotype={fixture.phenotype} seed={fixture.birthSeed} label={`${fixture.label}, deterministic visual fixture`} shared={shared} />
    <h3>{fixture.label}</h3>
    <div className="fixture-measures">{keys.map(key => <span key={key}>{descriptorLabels.get(key)} <strong>{displayPercent(fixture.normalized[key])}</strong></span>)}</div>
    <small>Seed {fixture.birthSeed}{fixture.mutationCount ? ` · ${fixture.mutationCount} new mutation${fixture.mutationCount === 1 ? '' : 's'}` : ''}</small>
    {!compact && fixture.anatomyAdjustments.length ? <ul className="fixture-adjustments" aria-label={`${fixture.label} anatomy constraints`}>{fixture.anatomyAdjustments.map(text => <li key={text}>{text}</li>)}</ul> : null}
  </article>;
}

function DescriptorBars({ fixture }: { fixture: VisualFixtureSubject }) {
  return <div className="fixture-bars">{EXTREME_KEYS.map(key => <div key={key}>
    <span>{descriptorLabels.get(key)}</span><meter min="0" max="1" value={fixture.normalized[key]} aria-label={`${fixture.label} ${descriptorLabels.get(key)}`} /><strong>{displayPercent(fixture.normalized[key])}</strong>
  </div>)}</div>;
}

export function VisualFixtureLab({ onClose }: { onClose: () => void }) {
  const [framing, setFraming] = useState<Framing>('fit');
  const sweep = useMemo(() => anatomySweep(400), []);
  const shared = (subjects: readonly VisualFixtureSubject[]) => framing === 'shared' ? sharedExtent(subjects.map(subject => subject.phenotype)) : undefined;
  const founderScale = shared(VISUAL_FIXTURE_REPORT.founders);
  const extremeScale = shared(VISUAL_FIXTURE_REPORT.extremes);
  const stressScale = shared(VISUAL_FIXTURE_REPORT.anatomyStress);
  return <main className="fixture-lab">
    <div className="fixture-hero">
      <div><div className="eyebrow">FS-101 BASELINE · ANATOMY V{VISUAL_FIXTURE_REPORT.anatomyVersion} · RENDERER V{VISUAL_FIXTURE_REPORT.rendererVersion}</div><h1>Visual inheritance fixtures</h1><p>A deterministic comparison surface for genome v{VISUAL_FIXTURE_REPORT.genomeVersion} → development v{VISUAL_FIXTURE_REPORT.developmentVersion} → anatomy v{VISUAL_FIXTURE_REPORT.anatomyVersion} → renderer v{VISUAL_FIXTURE_REPORT.rendererVersion}. It does not alter your aquarium save.</p></div>
      <div className="fixture-actions">
        <div className="framing-toggle" role="group" aria-label="Portrait framing">
          <button aria-pressed={framing === 'fit'} onClick={() => setFraming('fit')}>Fit each fish</button>
          <button aria-pressed={framing === 'shared'} onClick={() => setFraming('shared')}>Shared scale</button>
        </div>
        <button className="quiet" onClick={() => downloadReport(sweep)}>Download JSON report</button><button onClick={onClose}>Return to aquarium</button>
      </div>
    </div>
    <div className="fixture-summary" aria-label="Fixture summary">
      <span><strong>6</strong> founders</span><span><strong>2 × 20</strong> offspring cohorts</span><span><strong>6 + 6</strong> extremes · anatomy stress</span><span><strong>{sweep.invalid.length} / {sweep.samples}</strong> anatomy failures</span>
    </div>
    <p className="fixture-note framing-note" role="status">{framing === 'shared' ? 'Shared scale: portraits in each board use one pixel scale, so longer bodies look longer.' : 'Fit each fish: every portrait fills its frame. Use shared scale to compare body size.'}</p>

    <section className="fixture-section" aria-labelledby="founder-fixtures-title">
      <div className="fixture-section-heading"><div><div className="eyebrow">BASE POPULATION</div><h2 id="founder-fixtures-title">Six founder anchors</h2></div><p>World seed {VISUAL_FIXTURE_REPORT.worldSeed} · fixed timestamp {VISUAL_FIXTURE_REPORT.timestamp}</p></div>
      <div className="fixture-grid founders">{VISUAL_FIXTURE_REPORT.founders.map(fixture => <FixtureCard key={fixture.id} fixture={fixture} shared={founderScale} />)}</div>
    </section>

    {VISUAL_FIXTURE_REPORT.cohorts.map(cohort => {
      const cohortScale = shared([cohort.mother, cohort.father, ...cohort.children]);
      return <section className="fixture-section cohort-section" key={cohort.id} aria-labelledby={`${cohort.id}-title`}>
        <div className="fixture-section-heading"><div><div className="eyebrow">REPRODUCIBLE COHORT · SEED {cohort.seed}</div><h2 id={`${cohort.id}-title`}>{cohort.label}</h2></div><p>Twenty births using linked meiosis and the current lab mutation rate.</p></div>
        <div className="fixture-parents"><FixtureCard fixture={cohort.mother} compact shared={cohortScale} /><span aria-hidden="true">×</span><FixtureCard fixture={cohort.father} compact shared={cohortScale} /></div>
        <div className="fixture-grid children">{cohort.children.map(child => <FixtureCard key={child.id} fixture={child} compact shared={cohortScale} />)}</div>
        <div className="fixture-table-wrap"><table className="fixture-table"><caption>Normalized parent and cohort descriptor measurements</caption><thead><tr><th scope="col">Descriptor</th><th scope="col">Mother</th><th scope="col">Father</th><th scope="col">Child min</th><th scope="col">Child mean</th><th scope="col">Child max</th></tr></thead><tbody>{COMPARISON_KEYS.map(key => {
          const measurement = cohort.descriptors[key];
          return <tr key={key}><th scope="row">{descriptorLabels.get(key)}</th><td>{displayPercent(measurement.mother)}</td><td>{displayPercent(measurement.father)}</td><td>{displayPercent(measurement.minimum)}</td><td>{displayPercent(measurement.mean)}</td><td>{displayPercent(measurement.maximum)}</td></tr>;
        })}</tbody></table></div>
      </section>;
    })}

    <section className="fixture-section" aria-labelledby="extreme-fixtures-title">
      <div className="fixture-section-heading"><div><div className="eyebrow">ADVERSARIAL GEOMETRY INPUTS</div><h2 id="extreme-fixtures-title">Six reachable v1 extremes</h2></div><p>Only supported A0–A5 states are used. These cases do not add structural topology.</p></div>
      <div className="extreme-grid">{VISUAL_FIXTURE_REPORT.extremes.map(fixture => <article className="extreme-card" key={fixture.id}><FixtureCard fixture={fixture} shared={extremeScale} /><DescriptorBars fixture={fixture} /></article>)}</div>
    </section>

    <section className="fixture-section" aria-labelledby="anatomy-fixtures-title">
      <div className="fixture-section-heading"><div><div className="eyebrow">FS-102 · ANATOMY V{VISUAL_FIXTURE_REPORT.anatomyVersion} ANCHORS</div><h2 id="anatomy-fixtures-title">Attachment stress cases</h2></div><p>Eyes, fin roots, rays, gill and mouth sit on the measured body outline. Any constraint is listed on the card.</p></div>
      <div className="extreme-grid">{VISUAL_FIXTURE_REPORT.anatomyStress.map(fixture => <article className="extreme-card" key={fixture.id}><FixtureCard fixture={fixture} shared={stressScale} /><DescriptorBars fixture={fixture} /></article>)}</div>
      <div className="fixture-table-wrap"><table className="fixture-table anatomy-table">
        <caption>Renderer v1 anchor rules versus anatomy v{sweep.anatomyVersion}: {sweep.samples} phenotypes (all fixtures, {sweep.randomSamplesPerSource} founder-distribution genomes, {sweep.randomSamplesPerSource} random A0/A5 genomes)</caption>
        <thead><tr><th scope="col">Check</th><th scope="col">Renderer v1 rule</th><th scope="col">Anatomy v{sweep.anatomyVersion}</th></tr></thead>
        <tbody>
          {LEGACY_ANATOMY_DEFECTS.map(({ key, label }) => <tr key={key}><th scope="row">{label}</th><td>{sweep.legacy[key]}</td><td>{key === 'portrait-clipped' ? sweep.portraitClipped : sweep.invalid.length}</td></tr>)}
          <tr><th scope="row">Phenotypes with any defect</th><td>{sweep.legacyAffected}</td><td>{sweep.invalid.length + sweep.portraitClipped}</td></tr>
        </tbody>
      </table></div>
      <p className="fixture-note">Anatomy v{sweep.anatomyVersion} limited {sweep.eyeRadiusLimited} eye radii and moved {sweep.eyeMoved} eyes so they stay inside the head. The v1 column applies the old anchor and framing formulas to the same outline; the v{sweep.anatomyVersion} column counts any failed attachment check.</p>
    </section>

    <aside className="fixture-findings" aria-labelledby="fixture-findings-title"><div><div className="eyebrow">BASELINE FINDINGS</div><h2 id="fixture-findings-title">What this freezes—and what it exposes</h2></div><ul>{VISUAL_FIXTURE_REPORT.knownFindings.map(finding => <li key={finding}>{finding}</li>)}</ul></aside>
  </main>;
}
