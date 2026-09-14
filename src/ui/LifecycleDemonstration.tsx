import { useState } from 'react';
import { LIFECYCLE_DAY_LIMIT, lifecycleDemonstration, type LifecycleDemo } from '../core/lifecycleScenario';

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

/** FS-406 demonstration: two generations through normal breeding, clutch selection and batch rehoming, checked by replay. */
export function LifecycleDemonstration() {
  const [result, setResult] = useState<LifecycleDemo | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  function run() {
    setRunning(true); setError('');
    setTimeout(() => {
      try { setResult(lifecycleDemonstration()); } catch (failure) { setError(failure instanceof Error ? failure.message : 'The demonstration could not complete.'); }
      setRunning(false);
    }, 20);
  }
  return <section className="fixture-section" aria-labelledby="lifecycle-title">
    <div className="fixture-section-heading"><div><div className="eyebrow">FS-406 · BREEDING LIFECYCLE</div><h2 id="lifecycle-title">Two generations in normal mode</h2></div>
      <p>A seeded world runs through the aquarium’s own commands and clock. Two founder pairs court into separate nurseries. When both clutches are adults, a simulated keeper picks the largest adult-length potential of each sex from different clutches, rehomes each clutch’s surplus in one batch and pairs the chosen fish. No instant lab cross is used.</p></div>
    {!result ? <div className="selection-start">
      <p className="help-copy">Runs in this tab for at most {LIFECYCLE_DAY_LIMIT} game days and never reads or changes your aquarium.</p>
      <button className="primary" onClick={run} disabled={running}>{running ? 'Running…' : 'Run demonstration'}</button>
      {error ? <p className="warning" role="alert">{error}</p> : null}
    </div> : <>
      <div className="fixture-summary" aria-label="Two-generation summary">
        <span><strong>{result.clutches.filter(clutch => clutch.hatchedOnDay !== null).length} of {result.clutches.length}</strong> clutches hatched</span>
        <span><strong>Day {result.days}</strong> second generation hatched</span>
        <span><strong>{result.instantCrosses}</strong> instant lab crosses</span>
        <span><strong>{result.rehomed}</strong> fish rehomed in batches</span>
        <span><strong>{result.replayed ? 'Matches' : 'Does not match'}</strong> save replayed from its journal</span>
      </div>
      <div className="fixture-table-wrap"><table className="fixture-table">
        <caption>Clutches in the demonstration</caption>
        <thead><tr><th scope="col">Clutch</th><th scope="col">Generation</th><th scope="col">Parents</th><th scope="col">Nursery</th><th scope="col">Paired</th><th scope="col">Laid</th><th scope="col">Hatched</th><th scope="col">Pedigree F</th></tr></thead>
        <tbody>{result.clutches.map(clutch => <tr key={clutch.clutchId}>
          <th scope="row">{clutch.clutchId}</th><td>{clutch.generation}</td><td>{clutch.mother} × {clutch.father}</td><td>{clutch.nursery}</td><td>Day {clutch.pairedOnDay}</td>
          <td>{clutch.laidOnDay === null ? '—' : `Day ${clutch.laidOnDay}`}</td><td>{clutch.hatchedOnDay === null ? '—' : `Day ${clutch.hatchedOnDay}`}</td><td>{pct(clutch.pedigreeF)}</td>
        </tr>)}</tbody>
      </table></div>
      <ol className="lifecycle-events" aria-label="What happened">{result.events.map((event, i) => <li key={i}><span>Day {event.day}</span>{event.text}</li>)}</ol>
      <p className="fixture-note">{result.birthsFromClutches ? 'Every bred fish belongs to a normal clutch record.' : 'Some bred fish do not belong to a clutch record.'} The fullest tank, {result.fullest.tank}, held {result.fullest.used} of {result.fullest.capacity} places, counting reservations. {result.records} fish records. Commands in order: {result.commands.join(', ')}.{result.replayError ? ` Replay problem: ${result.replayError}` : ''}</p>
    </>}
  </section>;
}
