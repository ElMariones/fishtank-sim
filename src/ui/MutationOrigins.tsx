import { label } from '../core/catalog';
import { NOTEBOOK_ROWS, type MutationNotebook, type OriginSummary } from '../core/origins';
import type { Fish } from '../core/types';

const plural = (count: number, word: string) => `${count.toLocaleString('en')} ${word}${count === 1 || word.endsWith('fish') ? '' : 's'}`;

function carriers(entry: OriginSummary) {
  return `${plural(entry.living, 'living carrier')}${entry.homozygous ? ` (${entry.homozygous} with two copies)` : ''} · ${plural(entry.records, 'record')}`;
}

/**
 * FS-603 inspector section: the mutation origins this fish carries, with save-local carrier counts, and the save's
 * mutation notebook. Counts describe this save only, and sharing an origin means descent from one recorded mutation.
 */
export function MutationOrigins({ fish, notebook, onSelect }: { fish: Fish; notebook: MutationNotebook; onSelect: (id: string) => void }) {
  const byId = new Map(notebook.origins.map(entry => [entry.id, entry]));
  const carried = fish.origins.map(origin => ({ origin, entry: byId.get(origin.id)! })).filter(item => item.entry);
  const scope = `Counts cover this save only: ${plural(notebook.living, 'living fish')} and ${plural(notebook.records, 'record')}, sold and rehomed fish included. Founders, shop stock and rescued fish start with no tracked origins. Fish share an origin only by descent from one recorded mutation; the same allele arising again is a separate origin. Births saved before origins were tracked were traced from genomes where the inherited copy is certain.`;
  return <div className="mutation-origins">
    <h3>Mutation origins in this fish</h3>
    {carried.length ? <ul>{carried.map(({ origin, entry }) => <li key={`${origin.locus}${origin.copy}`}>
      <span>{label(entry.locusId)} · {origin.copy === 'maternal' ? 'copy from mother' : 'copy from father'}<small>{entry.change}{entry.structural ? ' · structural' : ''}</small></span>
      <span>{entry.firstCarrierId === fish.id ? 'Arose in this fish' : <>From <button className="quiet link-button" onClick={() => onSelect(entry.firstCarrierId)}>{entry.firstCarrierName}</button></>}<small>{carriers(entry)}</small></span>
    </li>)}</ul> : <p className="help-copy">This fish carries no allele descended from a recorded mutation.</p>}
    <details className="mutation-notebook">
      <summary>Mutation notebook · {plural(notebook.origins.length, 'origin')} in this save</summary>
      <p className="help-copy">{scope}</p>
      {notebook.origins.length ? <ol>{notebook.origins.slice(0, NOTEBOOK_ROWS).map(entry => <li key={entry.id}>
        <span>{label(entry.locusId)}<small>{entry.change}{entry.structural ? ' · structural' : ''}</small></span>
        <span><button className="quiet link-button" onClick={() => onSelect(entry.firstCarrierId)}>{entry.firstCarrierName}</button><small>G{entry.generation} · {carriers(entry)}</small></span>
      </li>)}</ol> : <p className="help-copy">No mutation has been recorded in this save yet.</p>}
      {notebook.origins.length > NOTEBOOK_ROWS ? <p className="help-copy">Showing the {NOTEBOOK_ROWS} origins with the most living carriers.</p> : null}
    </details>
  </div>;
}
