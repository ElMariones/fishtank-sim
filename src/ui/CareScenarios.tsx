import { useState } from 'react';
import { careScenarios, SCENARIO_DAYS, STRESS_DAYS, type CareScenario } from '../core/careScenario';

const pct = (value: number) => `${Math.round(value * 100)}%`;
const WIDTH = 480, HEIGHT = 170, PAD = 14;
const x = (day: number) => PAD + (day - 1) / (SCENARIO_DAYS - 1) * (WIDTH - PAD * 2);
const y = (share: number) => HEIGHT - PAD - Math.min(1, Math.max(0, share)) * (HEIGHT - PAD * 2);
const path = (values: readonly number[]) => values.map((value, i) => `${i ? 'L' : 'M'}${x(i + 1).toFixed(1)},${y(value).toFixed(1)}`).join(' ');

function ScenarioCard({ scenario }: { scenario: CareScenario }) {
  const days = scenario.days, last = days.at(-1)!;
  const lowest = days.reduce((low, day) => day.meanCondition < low.meanCondition ? day : low, days[0]);
  return <article className="trend-card scenario-card">
    <h3>{scenario.label}</h3>
    <p className="help-copy">{scenario.description}</p>
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`${scenario.label}: mean condition ${pct(days[0].meanCondition)} on day 1, lowest ${pct(lowest.meanCondition)} on day ${lowest.day}, ${pct(last.meanCondition)} on day ${last.day}. Oxygen ${days[0].oxygenMgL.toFixed(1)} to ${last.oxygenMgL.toFixed(1)} mg/L. ${scenario.actions.length} care review${scenario.actions.length === 1 ? '' : 's'}.`}>
      {scenario.id === 'stressed' ? <rect className="scenario-stress" x={x(1)} y={PAD} width={x(STRESS_DAYS + 0.5) - x(1)} height={HEIGHT - PAD * 2} /> : null}
      <line className="trend-axis" x1={PAD} x2={WIDTH - PAD} y1={y(0)} y2={y(0)} />
      <line className="trend-axis" x1={PAD} x2={WIDTH - PAD} y1={y(1)} y2={y(1)} />
      {scenario.actions.map(action => <line key={action.day} className="scenario-action" x1={x(action.day)} x2={x(action.day)} y1={PAD} y2={HEIGHT - PAD} />)}
      <path className="scenario-oxygen" d={path(days.map(day => day.oxygenMgL / 12))} />
      <path className="scenario-ammonia" d={path(days.map(day => day.ammoniaMgL / 3))} />
      <path className="scenario-condition" d={path(days.map(day => day.meanCondition))} />
    </svg>
    <p><span className="legend selected">Mean condition</span><span className="legend oxygen">Oxygen, 0–12 mg/L</span><span className="legend control">Ammonia, 0–3 mg N/L (capped)</span>{scenario.actions.length ? <span className="legend review">Care review</span> : null}</p>
    {scenario.actions.length
      ? <ol className="scenario-actions">{scenario.actions.map(action => <li key={action.day}>Day {action.day}: {action.fixes.join(' · ')}{action.cost ? ` · ◈ ${action.cost}` : ''}</li>)}</ol>
      : <p className="help-copy">No warnings appeared, so no care action was needed.</p>}
  </article>;
}

/** FS-307 demonstration: seeded healthy and stressed tanks under the aquarium's own rules, with recovery by following warnings. */
export function CareScenarios() {
  const [result, setResult] = useState<ReturnType<typeof careScenarios> | null>(null);
  const [running, setRunning] = useState(false);
  function run() {
    setRunning(true);
    setTimeout(() => { setResult(careScenarios()); setRunning(false); }, 20);
  }
  return <section className="fixture-section" aria-labelledby="care-scenarios-title">
    <div className="fixture-section-heading"><div><div className="eyebrow">FS-307 · CARE AND RECOVERY</div><h2 id="care-scenarios-title">Healthy and stressed tanks</h2></div>
      <p>Two seeded tanks run for {SCENARIO_DAYS} game days through the same care, water and development rules as your aquarium. From day {STRESS_DAYS + 1}, a simulated keeper applies the fixes named by the stressed tank’s warnings.</p></div>
    {!result ? <div className="selection-start"><p className="help-copy">Runs in this tab and never reads or changes your aquarium.</p><button className="primary" onClick={run} disabled={running}>{running ? 'Running…' : 'Run scenarios'}</button></div> : <>
      <div className="fixture-summary" aria-label="Care scenario summary">
        <span><strong>{pct(Math.min(...result.healthy.days.map(day => day.meanCondition)))}</strong> lowest healthy-tank condition</span>
        <span><strong>{pct(Math.min(...result.stressed.days.map(day => day.meanCondition)))}</strong> lowest stressed-tank condition</span>
        <span><strong>{result.stressed.clearedOnDay ? `Day ${result.stressed.clearedOnDay}` : 'Not cleared'}</strong> stressed warnings cleared</span>
        <span><strong>{result.healthy.unexplainedDeclines + result.stressed.unexplainedDeclines} of {result.healthy.declines + result.stressed.declines}</strong> fish-day declines without a named cause</span>
      </div>
      <div className="scenario-grid"><ScenarioCard scenario={result.healthy} /><ScenarioCard scenario={result.stressed} /></div>
      <div className="fixture-table-wrap"><table className="fixture-table">
        <caption>Stressed tank at the end of selected game days</caption>
        <thead><tr><th scope="col">Day</th><th scope="col">Oxygen</th><th scope="col">Ammonia</th><th scope="col">Fed</th><th scope="col">Water</th><th scope="col">Mean condition</th><th scope="col">Limited by</th><th scope="col">Warnings</th></tr></thead>
        <tbody>{result.stressed.days.filter(day => day.day === 1 || day.day % 5 === 0).map(day => <tr key={day.day}>
          <th scope="row">{day.day}</th><td>{day.oxygenMgL.toFixed(1)} mg/L</td><td>{day.ammoniaMgL.toFixed(2)} mg N/L</td><td>{pct(day.fed)}</td>
          <td>{day.temperatureC.toFixed(1)} °C</td><td>{pct(day.meanCondition)}</td><td>{day.limits.join(', ') || '—'}</td><td>{day.warnings.join(', ') || '—'}</td>
        </tr>)}</tbody>
      </table></div>
      <p className="fixture-note">Condition moves a quarter of the way toward each day’s environment, so declines and recovery both take days. A decline counts as explained when that day’s environment named at least one limiting cause. Fish never die in this lab.</p>
    </>}
  </section>;
}
