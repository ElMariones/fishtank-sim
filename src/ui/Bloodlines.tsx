import { useMemo, useState } from 'react';
import {
  ancestryContributions, bloodlineSummaries, captureStandard, MAX_FOUNDATION, registrationProblem, standardSimilarity, standardStructureText,
} from '../core/bloodlines';
import type { Fish, World } from '../core/types';
import type { Command } from '../core/world';
import { SexMark } from './Controls';

const pct = (value: number) => `${Math.round(value * 100)}%`;
type Run = (command: Command, message: string) => World | null;

/** Batch review that registers the selected fish as a bloodline's foundation (FS-604). */
export function BloodlineRegistration({ world, foundation, onRun, onDone, onCancel }: { world: World; foundation: Fish[]; onRun: Run; onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const ids = foundation.map(fish => fish.id), problem = registrationProblem(world, name, ids);
  const standard = useMemo(() => foundation.length && foundation.length <= MAX_FOUNDATION ? captureStandard(foundation) : null, [ids.join(',')]);
  return <div className="batch-review" id="batch-review" role="region" aria-labelledby="bloodline-review-title">
    <h3 id="bloodline-review-title">Register a bloodline from {foundation.length} foundation fish?</h3>
    <p>The line’s standard is taken from these fish now and does not change later. Descendants are then shown with two separate measures: ancestry, the expected share of their genome from this foundation, and standard similarity, how closely they match the standard whatever their ancestry.</p>
    {standard ? <p>Standard: {standardStructureText(standard)}{standard.signatureOrigins.length ? `; ${standard.signatureOrigins.length} mutation origin${standard.signatureOrigins.length === 1 ? '' : 's'} every foundation fish carries` : ''}.</p> : null}
    <ul>{foundation.map(fish => <li key={fish.id}><SexMark sex={fish.sex} /><span>{fish.name}<small>{fish.id} · G{fish.generation}</small></span><span /></li>)}</ul>
    <label className="bloodline-name">Bloodline name<input value={name} maxLength={32} onChange={event => setName(event.target.value)} placeholder="Garden Gold" /></label>
    {name.trim() && problem ? <p role="status">{problem}</p> : null}
    <div className="batch-review-actions">
      <button className="confirm" disabled={!!problem} onClick={() => { if (onRun({ type: 'register-bloodline', name, foundationIds: ids, timestamp: new Date().toISOString() }, `${name.trim()} registered with ${foundation.length} foundation fish.`)) onDone(); }}>Register {name.trim() || 'bloodline'}</button>
      <button className="quiet" onClick={onCancel}>Cancel</button>
    </div>
  </div>;
}

/** Family tab section: this fish's ancestry and similarity for every registered line, and the registry itself. */
export function BloodlineSection({ world, fish, onRun, onSelect }: { world: World; fish: Fish; onRun: Run; onSelect: (id: string) => void }) {
  const summaries = useMemo(() => bloodlineSummaries(world), [world.fish, world.bloodlines]);
  const rows = useMemo(() => world.bloodlines.map(line => ({ line, share: ancestryContributions(world, line).get(fish.id) ?? 0, similarity: standardSimilarity(fish, line.standard) })), [world.fish, world.bloodlines, fish]);
  const [renaming, setRenaming] = useState<string | null>(null), [draft, setDraft] = useState('');
  return <section className="bloodline-section" aria-labelledby="bloodline-title">
    <h3 id="bloodline-title">Bloodlines</h3>
    {!world.bloodlines.length ? <p className="help-copy">No bloodline is registered yet. Select 1 to {MAX_FOUNDATION} fish in the collection and choose Register bloodline to name a line and record its standard.</p> : <>
      <p className="help-copy">Ancestry is the expected share of {fish.name}’s genome from a line’s foundation, from recorded parents. Standard similarity compares {fish.name}’s adult genetic look with the line’s standard. They are measured separately: a lookalike can match without ancestry, and a descendant can drift.</p>
      <ul className="bloodline-rows">{rows.map(({ line, share, similarity }) => <li key={line.id}>
        <span><strong>{line.name}</strong><small>{share > 0 ? `Ancestry ${pct(share)}` : 'No recorded ancestry'}</small></span>
        <span>Similarity {pct(similarity.overall)}<small>shape {pct(similarity.descriptors)} · structure {Math.round(similarity.structure * 3)}/3{similarity.origins === null ? '' : ` · origins ${pct(similarity.origins)}`}</small></span>
      </li>)}</ul>
      <h3>Registered lines</h3>
      <ul className="bloodline-registry">{summaries.map(summary => <li key={summary.line.id}>
        {renaming === summary.line.id
          ? <form className="rename-form" onSubmit={event => { event.preventDefault(); if (onRun({ type: 'rename-bloodline', bloodlineId: summary.line.id, name: draft }, 'Bloodline renamed.')) setRenaming(null); }}>
              <label>New name<input value={draft} maxLength={32} onChange={event => setDraft(event.target.value)} /></label><button>Save</button><button type="button" className="quiet" onClick={() => setRenaming(null)}>Cancel</button>
            </form>
          : <span><strong>{summary.line.name}</strong> <button className="quiet link-button" onClick={() => { setRenaming(summary.line.id); setDraft(summary.line.name); }}>Rename</button>
              <small>{summary.line.id} · foundation {summary.foundationNames.join(', ')} · {standardStructureText(summary.line.standard)}</small></span>}
        <span>{summary.livingMembers} living with ancestry<small>{summary.livingMembers ? `mean ancestry ${pct(summary.meanContribution)} · mean similarity ${pct(summary.meanSimilarity)}` : 'no living descendants'}{summary.closest ? <> · closest <button className="quiet link-button" onClick={() => onSelect(summary.closest!.id)}>{summary.closest.name}</button> {pct(summary.closest.similarity)}</> : null}</small></span>
      </li>)}</ul>
    </>}
  </section>;
}
