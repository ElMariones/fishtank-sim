import { useEffect, useMemo, useState } from 'react';
import { sharedExtent, type Extent } from '../core/anatomy';
import { VISUAL_DESCRIPTORS } from '../core/descriptors';
import {
  computationalObserver, decodeStudyResults, displayPhenotype, scoreAnswers, STUDY_MODES, STUDY_RESULTS_KEY, STUDY_VERSION, studyTrials,
  type ChannelResult, type StudyFish, type StudyMode, type StudyResults,
} from '../core/resemblanceStudy';
import { DEFAULT_SELECTION_CONFIG, selectionReport, type LineResult, type SelectionReport, type TargetResult } from '../core/selectionExperiment';
import { CareScenarios } from './CareScenarios';
import { EconomyExperiment } from './EconomyExperiment';
import { LifecycleDemonstration } from './LifecycleDemonstration';
import { PaidEconomy } from './PaidEconomy';
import { UnusualLine } from './UnusualLine';
import { PhenotypePortrait } from './FishPortrait';

const TRIAL_COUNT = 12;
const COHORT_SIZE = 4;
const TRIAL_SET = `study-v${STUDY_VERSION}-${TRIAL_COUNT}x${COHORT_SIZE}`;
const MODE_LABEL: Record<StudyMode, string> = { full: 'Full appearance', silhouette: 'Silhouette only', pattern: 'Markings only' };
const MODE_HELP: Record<StudyMode, string> = {
  full: 'Everything the fish shows: body, fins, colour and markings.',
  silhouette: 'Colour and markings are hidden. Compare body, head, eyes and fins.',
  pattern: 'Every fish is drawn on the same standard body. Compare colour and markings.',
};
const OBSERVER_CHANNEL = { full: 'combined', silhouette: 'silhouette', pattern: 'pattern' } as const;
const descriptorLabel = new Map(VISUAL_DESCRIPTORS.map(descriptor => [descriptor.key, descriptor.label]));
const pct = (value: number) => `${Math.round(value * 100)}%`;
const describe = (result: ChannelResult) => result.trials ? `${pct(result.accuracy)} · ${result.correct}/${result.trials} · 95% CI ${pct(result.interval[0])}–${pct(result.interval[1])}` : 'No trials yet';
const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);

function readResults(): StudyResults {
  let raw: string | null = null;
  try { raw = localStorage.getItem(STUDY_RESULTS_KEY); } catch { /* Study progress is optional. */ }
  return decodeStudyResults(raw, TRIAL_SET);
}

export function ResearchLab({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'study' | 'selection' | 'care' | 'lifecycle' | 'economy' | 'paid' | 'line'>('study');
  return <main className="fixture-lab research-lab">
    <div className="fixture-hero">
      <div><div className="eyebrow">FS-105 · FS-307 · FS-406 · FS-501 · FS-505 · FS-605 · RESEMBLANCE, SELECTION, CARE, LIFECYCLE, ECONOMY AND LINES</div><h1>Research studies</h1><p>Seeded experiments for the M1 visible-inheritance gate, the M3 care demonstration, the M4 two-generation gate, the M5 economy experiment and paid-economy playtest, and the M6 unusual-line demonstration. They use their own fish and never read or change your aquarium save.</p></div>
      <div className="fixture-actions">
        <div className="framing-toggle" role="group" aria-label="Research study">
          <button aria-pressed={tab === 'study'} onClick={() => setTab('study')}>Resemblance study</button>
          <button aria-pressed={tab === 'selection'} onClick={() => setTab('selection')}>Selection experiment</button>
          <button aria-pressed={tab === 'care'} onClick={() => setTab('care')}>Care scenarios</button>
          <button aria-pressed={tab === 'lifecycle'} onClick={() => setTab('lifecycle')}>Two generations</button>
          <button aria-pressed={tab === 'economy'} onClick={() => setTab('economy')}>Economy experiment</button>
          <button aria-pressed={tab === 'paid'} onClick={() => setTab('paid')}>Paid economy</button>
          <button aria-pressed={tab === 'line'} onClick={() => setTab('line')}>Unusual line</button>
        </div>
        <button onClick={onClose}>Return to aquarium</button>
      </div>
    </div>
    {tab === 'study' ? <ResemblanceStudy /> : tab === 'selection' ? <SelectionExperiment /> : tab === 'care' ? <CareScenarios /> : tab === 'lifecycle' ? <LifecycleDemonstration /> : tab === 'economy' ? <EconomyExperiment /> : tab === 'paid' ? <PaidEconomy /> : <UnusualLine />}
  </main>;
}

function TrialPortrait({ fish, mode, extent, label }: { fish: StudyFish; mode: StudyMode; extent: Extent; label: string }) {
  const phenotype = useMemo(() => displayPhenotype(fish.phenotype, mode), [fish, mode]);
  return <figure className="study-fish"><PhenotypePortrait phenotype={phenotype} seed={fish.seed} label={label} shared={extent} /><figcaption>{label}</figcaption></figure>;
}

function ResemblanceStudy() {
  const trials = useMemo(() => studyTrials(TRIAL_COUNT, COHORT_SIZE), []);
  const observer = useMemo(() => Object.fromEntries(STUDY_MODES.map(mode =>
    [mode, computationalObserver(trials.filter(trial => trial.mode === mode))[OBSERVER_CHANNEL[mode]]])) as Record<StudyMode, ChannelResult>, [trials]);
  const [results, setResults] = useState(readResults);
  const [cue, setCue] = useState('');
  const [shownAt, setShownAt] = useState(() => performance.now());
  const [copied, setCopied] = useState('');
  const answered = new Set(results.answers.map(answer => answer.trialId));
  const current = trials.find(trial => !answered.has(trial.id)) ?? null;
  const extent = useMemo(() => current
    ? sharedExtent([...current.cohort, ...current.pairs.flatMap(pair => [pair.mother, pair.father])].map(f => displayPhenotype(f.phenotype, current.mode)))
    : { width: 1, height: 1 }, [current]);

  useEffect(() => { try { localStorage.setItem(STUDY_RESULTS_KEY, JSON.stringify(results)); } catch { /* Study progress is optional. */ } }, [results]);
  useEffect(() => { setShownAt(performance.now()); setCue(''); }, [current?.id]);

  const scores = scoreAnswers(trials, results.answers);
  const record = JSON.stringify({ ...results, scores }, null, 2);

  function answer(choice: 0 | 1) {
    if (!current) return;
    const note = cue.trim().slice(0, 200);
    setResults(previous => ({ ...previous, answers: [...previous.answers, { trialId: current.id, choice, ms: Math.min(3_600_000, Math.round(performance.now() - shownAt)), ...(note ? { cue: note } : {}) }] }));
  }

  async function copy() {
    try { await navigator.clipboard.writeText(record); setCopied('Copied to the clipboard.'); }
    catch { setCopied('Copying was blocked. Select the record above and copy it manually.'); }
  }

  return <>
    <div className="fixture-summary" aria-label="Study summary">
      <span><strong>{TRIAL_COUNT}</strong> blind trials</span><span><strong>{COHORT_SIZE}</strong> siblings per trial</span><span><strong>3</strong> modes, 4 trials each</span><span><strong>{results.answers.length}</strong> answered</span>
    </div>
    {current ? <section className="fixture-section study-trial" aria-labelledby="trial-title">
      <div className="study-progress"><span>Trial {trials.indexOf(current) + 1} of {TRIAL_COUNT}</span><span className={`mode-badge ${current.mode}`}>{MODE_LABEL[current.mode]}</span><progress max={TRIAL_COUNT} value={results.answers.length} aria-label="Study progress" /></div>
      <h2 id="trial-title">Which pair are these siblings from?</h2>
      <p className="help-copy">{MODE_HELP[current.mode]} There is no time limit, and answers stay on this device.</p>
      <div className="study-cohort" role="group" aria-label="Siblings">{current.cohort.map((child, i) => <TrialPortrait key={child.id} fish={child} mode={current.mode} extent={extent} label={`Sibling ${i + 1}`} />)}</div>
      <div className="study-pairs">{current.pairs.map((pair, side) => {
        const name = side ? 'B' : 'A';
        return <article className="study-pair" key={name} aria-labelledby={`pair-${name}`}>
          <h3 id={`pair-${name}`}>Pair {name}</h3>
          <div className="study-pair-fish"><TrialPortrait fish={pair.mother} mode={current.mode} extent={extent} label={`Pair ${name} mother`} /><TrialPortrait fish={pair.father} mode={current.mode} extent={extent} label={`Pair ${name} father`} /></div>
          <button className="primary" onClick={() => answer(side ? 1 : 0)}>Pair {name} are the parents</button>
        </article>;
      })}</div>
      <label className="study-cue">Optional: which cue decided it?<input value={cue} maxLength={200} onChange={event => setCue(event.target.value)} placeholder="For example: tail shape, head markings" /></label>
      {results.answers.length ? <button className="quiet" onClick={() => setResults(previous => ({ ...previous, answers: previous.answers.slice(0, -1) }))}>Undo last answer</button> : null}
    </section> : <section className="fixture-section" aria-labelledby="study-results-title">
      <div className="fixture-section-heading"><div><div className="eyebrow">STUDY COMPLETE</div><h2 id="study-results-title">Your resemblance results</h2></div><p>Chance is 50%. Twelve trials give wide intervals, so one observer is a single data point, not a verdict on the M1 gate.</p></div>
      <div className="fixture-table-wrap"><table className="fixture-table study-table">
        <caption>Your accuracy by mode, beside a computational observer that measures the same trials exactly</caption>
        <thead><tr><th scope="col">Mode</th><th scope="col">You</th><th scope="col">Computational observer</th></tr></thead>
        <tbody>
          {STUDY_MODES.map(mode => <tr key={mode}><th scope="row">{MODE_LABEL[mode]}</th><td>{describe(scores[mode])}</td><td>{describe(observer[mode])}</td></tr>)}
          <tr><th scope="row">All trials</th><td>{describe(scores.overall)}</td><td>—</td></tr>
        </tbody>
      </table></div>
      <details className="study-details"><summary>Per-trial answers</summary><ol>{trials.map(trial => {
        const given = results.answers.find(answer => answer.trialId === trial.id);
        return <li key={trial.id}>{MODE_LABEL[trial.mode]} · {given ? (given.choice === trial.answer ? 'Correct' : 'Incorrect') : 'Unanswered'}{given ? ` · ${(given.ms / 1000).toFixed(1)} s` : ''}{given?.cue ? ` · “${given.cue}”` : ''}</li>;
      })}</ol></details>
      <label className="study-record">Result record to share with the project<textarea readOnly rows={8} value={record} /></label>
      <div className="fixture-actions"><button className="primary" onClick={copy}>Copy results</button><button className="quiet" onClick={() => { setResults({ version: STUDY_VERSION, trialSet: TRIAL_SET, answers: [] }); setCopied(''); }}>Start again</button></div>
      {copied ? <p className="fixture-note" role="status">{copied}</p> : null}
    </section>}
  </>;
}

function TrendCard({ result }: { result: TargetResult }) {
  const curve = (lines: LineResult[]) => lines[0].generations.map((_, g) => average(lines.map(line => line.generations[g].mean)));
  const selected = curve(result.selected), control = curve(result.random);
  const width = 240, height = 112, pad = 12;
  const x = (g: number) => pad + (g / (selected.length - 1)) * (width - pad * 2);
  const y = (value: number) => height - pad - value * (height - pad * 2);
  const path = (values: number[]) => values.map((value, g) => `${g ? 'L' : 'M'}${x(g).toFixed(1)},${y(value).toFixed(1)}`).join(' ');
  const [low, high] = result.typicalRange, name = descriptorLabel.get(result.target.descriptor)!;
  return <article className="trend-card">
    <h3>{name} {result.target.direction === 'higher' ? '↑' : '↓'}</h3>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${name}, selecting ${result.target.direction}: selected lines ${pct(selected[0])} to ${pct(selected.at(-1)!)}, random mating ${pct(control[0])} to ${pct(control.at(-1)!)}, founder typical range ${pct(low)} to ${pct(high)}.`}>
      <rect className="trend-band" x={pad} width={width - pad * 2} y={y(high)} height={y(low) - y(high)} />
      <line className="trend-axis" x1={pad} x2={width - pad} y1={y(0)} y2={y(0)} />
      <line className="trend-axis" x1={pad} x2={width - pad} y1={y(1)} y2={y(1)} />
      <path className="trend-control" d={path(control)} />
      <path className="trend-selected" d={path(selected)} />
    </svg>
    <p><span className="legend selected">Selected {pct(selected.at(-1)!)}</span><span className="legend control">Random {pct(control.at(-1)!)}</span><span className={result.passes ? 'trend-pass' : 'trend-fail'}>{result.passes ? 'Beyond range' : 'Not beyond range'}</span></p>
  </article>;
}

function SelectionExperiment() {
  const [report, setReport] = useState<SelectionReport | null>(null);
  const [running, setRunning] = useState(false);
  const config = DEFAULT_SELECTION_CONFIG;
  function run() {
    setRunning(true);
    setTimeout(() => { setReport(selectionReport(config)); setRunning(false); }, 20);
  }
  const finalMean = (lines: LineResult[], key: 'inbreeding' | 'heterozygosity' | 'speed') => average(lines.map(line => line.generations.at(-1)![key]));
  const firstMean = (lines: LineResult[], key: 'heterozygosity' | 'speed') => average(lines.map(line => line.generations[0][key]));
  return <section className="fixture-section" aria-labelledby="selection-title">
    <div className="fixture-section-heading"><div><div className="eyebrow">BALANCE E-02 · REDUCED</div><h2 id="selection-title">Ten-generation selection</h2></div><p>{config.replicates} replicate lines per trait · {config.population} fish per generation · top {config.retainedPerSex} females and {config.retainedPerSex} males kept · lab mutation rate. Random-mating lines start from the same founders.</p></div>
    {!report ? <div className="selection-start"><p className="help-copy">Runs {config.replicates * 2} lines for each of six traits in this tab. It takes about a second and does not touch your aquarium.</p><button className="primary" onClick={run} disabled={running}>{running ? 'Running…' : 'Run experiment'}</button></div> : <>
      <div className="fixture-summary" aria-label="Selection summary">
        <span><strong>{report.targetsPassing} / {report.targets.length}</strong> traits beyond typical range</span>
        <span><strong>{report.gate.passed ? 'Passed' : 'Not passed'}</strong> gate (needs {report.gate.required})</span>
        <span><strong>{report.invalidAnatomyFinal}</strong> invalid anatomies in generation {config.generations}</span>
        <span><strong>{average(report.targets.map(t => finalMean(t.selected, 'inbreeding'))).toFixed(2)}</strong> mean pedigree F after selection</span>
      </div>
      <div className="selection-grid">{report.targets.map(result => <TrendCard key={result.target.descriptor} result={result} />)}</div>
      <div className="fixture-table-wrap"><table className="fixture-table">
        <caption>Generation {config.generations} outcomes. Shift is the change in the normalized mean from generation 0.</caption>
        <thead><tr><th scope="col">Trait</th><th scope="col">Founder range</th><th scope="col">Selected lines beyond</th><th scope="col">Random lines beyond</th><th scope="col">Shift selected / random</th><th scope="col">Pedigree F</th><th scope="col">Heterozygosity</th><th scope="col">Speed</th></tr></thead>
        <tbody>{report.targets.map(result => <tr key={result.target.descriptor}>
          <th scope="row">{descriptorLabel.get(result.target.descriptor)} {result.target.direction === 'higher' ? '↑' : '↓'}</th>
          <td>{pct(result.typicalRange[0])}–{pct(result.typicalRange[1])}</td>
          <td>{result.selectedBeyondRange} / {config.replicates}</td><td>{result.randomBeyondRange} / {config.replicates}</td>
          <td>{result.meanShift.selected >= 0 ? '+' : ''}{pct(result.meanShift.selected)} / {result.meanShift.random >= 0 ? '+' : ''}{pct(result.meanShift.random)}</td>
          <td>{finalMean(result.selected, 'inbreeding').toFixed(2)}</td>
          <td>{pct(firstMean(result.selected, 'heterozygosity'))} → {pct(finalMean(result.selected, 'heterozygosity'))}</td>
          <td>{firstMean(result.selected, 'speed').toFixed(3)} → {finalMean(result.selected, 'speed').toFixed(3)}</td>
        </tr>)}</tbody>
      </table></div>
      <p className="fixture-note">Founder range is the 10th–90th percentile of the pooled founders. A trait passes when at least 75% of selected lines end beyond it and they shift further than random-mating lines. Keeping only four parents of each sex also drives inbreeding up and heterozygosity down within a few generations, which is a cost players should see before copying this strategy.</p>
    </>}
  </section>;
}
