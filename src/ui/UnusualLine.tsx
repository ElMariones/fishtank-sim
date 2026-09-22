import { useMemo, useState } from 'react';
import { express } from '../core/genetics';
import type { Fish } from '../core/types';
import { mutationPacing, UNUSUAL_LINE_DAY_LIMIT, UNUSUAL_LINE_SEED, unusualLineDemonstration, type PacingReport, type UnusualLineDemo } from '../core/unusualLineScenario';
import { PhenotypePortrait } from './FishPortrait';

const pct = (value: number) => `${(value * 100).toFixed(value < 0.01 ? 2 : 1)}%`;
const LABELS: Record<string, string> = { tail_topology: 'Tail topology', dorsal_form: 'Dorsal form', barbel_count: 'Barbel count' };

function Portrait({ fish, caption }: { fish: Fish; caption: string }) {
  const phenotype = useMemo(() => express(fish.genome), [fish]);
  return <figure className="study-fish"><PhenotypePortrait phenotype={phenotype} seed={fish.birthSeed} label={`${fish.name}: ${caption}`} /><figcaption>{fish.name} · {caption}</figcaption></figure>;
}

/** FS-605 demonstration: ordinary koi to a registered unusual line through normal breeding, with mutation discovery pacing. */
export function UnusualLine() {
  const [result, setResult] = useState<{ demo: UnusualLineDemo; pacing: PacingReport } | null>(null);
  const [running, setRunning] = useState(false), [error, setError] = useState('');
  function run() {
    setRunning(true); setError('');
    setTimeout(() => {
      try { setResult({ demo: unusualLineDemonstration(UNUSUAL_LINE_SEED, 'tail_topology'), pacing: mutationPacing(200) }); }
      catch (failure) { setError(failure instanceof Error ? failure.message : 'The demonstration could not complete.'); }
      setRunning(false);
    }, 20);
  }
  const demo = result?.demo, pacing = result?.pacing;
  const strip = useMemo(() => {
    if (!demo?.mutation) return [];
    const world = demo.world, originId = demo.mutation.originId, copies = (fish: Fish) => fish.origins.filter(origin => origin.id === originId).length;
    const first = world.fish.find(fish => originId.startsWith(`${fish.id}/`))!;
    const founder = world.fish.find(fish => fish.id === first.parents?.[0])!;
    const maxGeneration = Math.max(...world.fish.map(fish => fish.generation));
    const carrierChild = world.fish.find(fish => fish.generation === first.generation + 1 && copies(fish) === 1);
    const expressing = world.fish.find(fish => fish.generation === first.generation + 2 && copies(fish) === 2);
    const line = world.fish.find(fish => fish.generation === maxGeneration && copies(fish) === 2);
    return [
      [founder, 'founder koi, standard tail'], [first, 'hidden new copy'], [carrierChild, 'carrier, standard tail'],
      [expressing, 'two copies, paired fan'], [line, 'line offspring, paired fan'],
    ].filter((entry): entry is [Fish, string] => !!entry[0]);
  }, [demo]);
  return <section className="fixture-section" aria-labelledby="unusual-line-title">
    <div className="fixture-section-heading"><div><div className="eyebrow">FS-605 · KOI TO AN UNUSUAL LINE</div><h2 id="unusual-line-title">A paired-fan line through normal breeding</h2></div>
      <p>A seeded world breeds its six founder koi through courtship and clutches until an egg carries a new tail-topology mutation. A simulated keeper grows the carrier, outcrosses it, intercrosses carrier offspring, registers the fish showing the new tail as a bloodline and breeds them. Surplus fish are rehomed as they hatch. No instant lab cross is used, and the journal is replayed at the end.</p></div>
    {!demo || !pacing ? <div className="selection-start">
      <p className="help-copy">Runs in this tab for at most {UNUSUAL_LINE_DAY_LIMIT} game days (seed {UNUSUAL_LINE_SEED}) and never reads or changes your aquarium. It takes a few seconds.</p>
      <button className="primary" onClick={run} disabled={running}>{running ? 'Running…' : 'Run demonstration'}</button>
      {error ? <p className="warning" role="alert">{error}</p> : null}
    </div> : <>
      <div className="fixture-summary" aria-label="Unusual line summary">
        <span><strong>Day {demo.mutation?.discoveredOnDay ?? '—'}</strong> {demo.mutation ? `new ${demo.mutation.variant} copy found among ${demo.mutation.birthsBefore.toLocaleString('en')} eggs` : 'no mutation found'}</span>
        <span><strong>Day {demo.days}</strong> {demo.completed ? 'line offspring hatched' : 'limit reached'}</span>
        <span><strong>{demo.generations.at(-1)?.expressing ?? 0} of {demo.generations.at(-1)?.count ?? 0}</strong> final offspring show it</span>
        <span><strong>{demo.instantCrosses}</strong> instant lab crosses · {demo.replayed ? 'journal replays' : 'replay failed'}</span>
      </div>
      <div className="study-cohort unusual-strip" aria-label="From koi to the unusual line">{strip.map(([fish, caption]) => <Portrait key={fish.id} fish={fish} caption={caption} />)}</div>
      <div className="fixture-table-wrap"><table className="fixture-table">
        <caption>Generations after the mutation</caption>
        <thead><tr><th scope="col">Generation</th><th scope="col">Offspring</th><th scope="col">One copy</th><th scope="col">Show the variant</th><th scope="col">Parents’ kinship (pedigree F)</th></tr></thead>
        <tbody>{demo.generations.map(generation => <tr key={generation.label}><th scope="row">{generation.label}</th><td>{generation.count}</td><td>{generation.carriers}</td><td>{generation.expressing}</td><td>{pct(generation.pedigreeF)}</td></tr>)}</tbody>
      </table></div>
      {demo.bloodline ? <p className="fixture-note">Registered <strong>{demo.bloodline.name}</strong> with foundation {demo.bloodline.foundation.join(', ')}. Its line offspring have ancestry {pct(Math.min(...demo.bloodline.finalAncestry))}–{pct(Math.max(...demo.bloodline.finalAncestry))} and standard similarity {pct(Math.min(...demo.bloodline.finalSimilarity))}–{pct(Math.max(...demo.bloodline.finalSimilarity))}, shown separately.</p> : null}
      <ol className="lifecycle-events" aria-label="What happened">{demo.events.map((event, i) => <li key={i}><span>Day {event.day}</span>{event.text}</li>)}</ol>
      <div className="fixture-table-wrap"><table className="fixture-table">
        <caption>Discovery pacing: founder stock and new mutations</caption>
        <thead><tr><th scope="col">Structural locus</th><th scope="col">Founder carries a hidden copy</th><th scope="col">Founder shows it</th><th scope="col">Share of first new mutations</th></tr></thead>
        <tbody>{Object.keys(pacing.founderCarrier).map(id => <tr key={id}><th scope="row">{LABELS[id]}</th><td>{pct(pacing.founderCarrier[id])}</td><td>{pct(pacing.founderExpressing[id])}</td><td>{pct(pacing.firstLocus[id])}</td></tr>)}</tbody>
      </table></div>
      <p className="fixture-note">From standard parents, the first new structural mutation took {pacing.birthsToMutation.median} births at the median ({pacing.birthsToMutation.p10}–{pacing.birthsToMutation.p90} for the 10th–90th percentiles, {pacing.samples} seeded lineages). A tail-topology mutation alone takes about three times as many. This demonstration spans {demo.days} game days; the calendar now lets you advance by a day, week or month.</p>
    </>}
  </section>;
}
