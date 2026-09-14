import { useMemo, useState } from 'react';
import {
  ancestorGraph, ancestorLabel, descendantGenerations, descendantLabel, findRecords, MAX_ANCESTOR_DEPTH, MAX_DESCENDANT_DEPTH,
  type AncestorNode, type GenealogyIndex,
} from '../core/genealogy';
import type { Fish, World } from '../core/types';
import { Pagination, SexMark } from './Controls';
import { FishPortrait } from './FishPortrait';

const PAGE_SIZE = 60;

type Props = {
  world: World; index: GenealogyIndex; fish: Fish;
  /** Ancestor generations requested; kept while moving between relatives. */
  depth: number;
  /** Fish visited before this one through the family view, oldest first. */
  trail: readonly string[];
  pedigreeF: string;
  onDepth: (depth: number) => void; onNavigate: (id: string) => void; onBack: () => void; onReturn: () => void;
};

/** "Sumi", "Sumi and Kai", or "Sumi, Kai and 3 more". */
function listNames(names: string[]): string {
  return names.length <= 2 ? names.join(' and ') : `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
}

/**
 * Bounded family graph (FS-404): up to six ancestor generations with repeated ancestors listed once, descendants by
 * generation, record search and a breadcrumb trail. Selecting a relative focuses it and brings a living fish's tank into view.
 */
export function FamilyView({ world, index, fish, depth, trail, pedigreeF, onDepth, onNavigate, onBack, onReturn }: Props) {
  const graph = useMemo(() => ancestorGraph(index, fish.id, depth), [index, fish.id, depth]);
  const descendants = useMemo(() => descendantGenerations(index, fish.id), [index, fish.id]);
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState(1);
  const [page, setPage] = useState(0);
  const found = useMemo(() => findRecords(world.fish, query), [world.fish, query]);
  const record = (id: string) => index.byId.get(id)!;
  const name = (id: string) => index.byId.get(id)?.name ?? id;
  const where = (member: Fish) => member.status === 'sold' ? 'Sold · archived record' : world.tanks.find(t => t.id === member.tankId)?.name ?? 'Unknown aquarium';

  // Generations after the last recorded ancestor hold only founder or missing positions, so one note replaces them.
  const lastRecorded = graph.generations.reduce((last, generation, i) => generation.recorded ? i : last, -1);
  const shown = graph.generations.slice(0, lastRecorded + 1), beyond = graph.generations[lastRecorded + 1];
  const beyondNote = !beyond ? '' : lastRecorded < 0 ? 'Its recorded parents are missing from this world.'
    : `No ancestors are recorded beyond the ${ancestorLabel(beyond.depth - 1).toLowerCase()}${beyond.missing ? '; some records are missing from this world.' : '. Those lines begin with founder stock.'}`;
  const totals = shown.reduce((sum, g) => ({ positions: sum.positions + g.positions, recorded: sum.recorded + g.recorded, unknown: sum.unknown + g.unknown, missing: sum.missing + g.missing }),
    { positions: 0, recorded: 0, unknown: 0, missing: 0 });
  const continuesBack = shown.some(generation => generation.nodes.some(node => node.continues));
  const shownLevel = Math.min(level, Math.max(1, descendants.generations.length));
  const levelIds = descendants.generations[shownLevel - 1] ?? [];
  const levelPage = Math.min(page, Math.max(0, Math.ceil(levelIds.length / PAGE_SIZE) - 1));

  const ancestorNotes = (node: AncestorNode, member: Fish) => [
    ...(node.positions > 1 ? [`In ${node.positions} positions · among ${listNames(node.depths.map(d => ancestorLabel(d).toLowerCase()))}`] : []),
    ...(node.continues ? ['Earlier ancestors recorded'] : member.parents ? [] : ['Founder stock']),
  ];

  return <div className="family-view">
    {trail.length ? <nav className="family-trail" aria-label="Family path">
      <ol>
        {trail.map(id => <li key={id}><button className="quiet" onClick={() => onNavigate(id)}>{name(id)}</button></li>)}
        <li aria-current="location">{fish.name}</li>
      </ol>
      <div className="family-trail-actions">
        <button onClick={onBack}>← Back to {name(trail[trail.length - 1])}</button>
        {trail.length > 1 ? <button className="quiet" onClick={onReturn}>Return to {name(trail[0])}</button> : null}
      </div>
    </nav> : null}
    <div className="family-search">
      <label>Find any record by name or ID<input type="search" value={query} placeholder="Name, or an ID such as 47" onChange={event => setQuery(event.target.value)} /></label>
      {query.trim() ? found.matches.length ? <div className="family-results">
        {found.matches.map(match => <FamilyRelative key={match.id} fish={match} where={where(match)} detail={match.id === fish.id ? `${match.id} · shown now` : match.id}
          onSelect={id => { setQuery(''); onNavigate(id); }} />)}
        {found.total > found.matches.length ? <p className="help-copy">Showing {found.matches.length} of {found.total.toLocaleString()} matches. Type more of the name or the full ID.</p> : null}
      </div> : <p className="empty-copy">No record matches “{query.trim()}”.</p> : null}
    </div>
    <p className="help-copy">Select any relative to inspect them. Living fish bring their aquarium into view; sold fish open their archived record.</p>

    <section className="family-section" aria-labelledby="family-ancestors">
      <div className="family-section-heading"><h3 id="family-ancestors">Ancestors</h3>{fish.parents ? <small>{shown.length} of up to {MAX_ANCESTOR_DEPTH} generations</small> : null}</div>
      {fish.parents ? <>
        {shown.map(generation => <div className="family-generation" key={generation.depth}>
          <h4>{ancestorLabel(generation.depth)}<small>{generation.recorded} of {generation.positions} positions recorded{generation.unknown ? ` · ${generation.unknown} above founder stock` : ''}{generation.missing ? ` · ${generation.missing} missing from this world` : ''}</small></h4>
          {generation.nodes.map(node => {
            const member = record(node.id);
            return <FamilyRelative key={node.id} fish={member} where={where(member)} notes={ancestorNotes(node, member)} onSelect={onNavigate}
              detail={`${node.edges[0].role === 'mother' ? 'Mother' : 'Father'} of ${listNames(node.edges.map(edge => name(edge.childId)))}`} />;
          })}
          {generation.repeated.length ? <p className="family-repeat">Also here, listed nearer: {listNames(generation.repeated.map(name))}.</p> : null}
        </div>)}
        {beyondNote ? <p className="help-copy">{beyondNote}</p> : null}
        {(graph.deeper && graph.depth < MAX_ANCESTOR_DEPTH) || depth > 2 ? <div className="family-depth">
          {graph.deeper && graph.depth < MAX_ANCESTOR_DEPTH ? <button onClick={() => onDepth(graph.depth + 1)}>Show {ancestorLabel(graph.depth + 1).toLowerCase()}</button> : null}
          {depth > 2 ? <button className="quiet" onClick={() => onDepth(2)}>Show only parents and grandparents</button> : null}
        </div> : null}
        {graph.depth === MAX_ANCESTOR_DEPTH && continuesBack ? <p className="help-copy">Six generations is the most shown at once. Select an ancestor marked “Earlier ancestors recorded” to continue further back.</p> : null}
      </> : <p className="empty-copy">Founder stock · no recorded parents.</p>}
    </section>

    <div className="family-self">{fish.name}<small>Generation {fish.generation} · {where(fish)}</small></div>

    <section className="family-section" aria-labelledby="family-descendants">
      <div className="family-section-heading"><h3 id="family-descendants">Descendants</h3>{descendants.total ? <small>{descendants.total.toLocaleString()} within {descendants.generations.length} generation{descendants.generations.length === 1 ? '' : 's'}</small> : null}</div>
      {descendants.total ? <>
        <div className="family-levels" role="group" aria-label="Descendant generation">
          {descendants.generations.map((ids, i) => <button key={i} aria-pressed={shownLevel === i + 1} onClick={() => { setLevel(i + 1); setPage(0); }}>{descendantLabel(i + 1)} · {ids.length.toLocaleString()}</button>)}
        </div>
        <Pagination page={levelPage} count={levelIds.length} size={PAGE_SIZE} onPage={setPage} label={descendantLabel(shownLevel)} />
        {levelIds.slice(levelPage * PAGE_SIZE, (levelPage + 1) * PAGE_SIZE).map(id => {
          const member = record(id);
          return <FamilyRelative key={id} fish={member} where={where(member)} onSelect={onNavigate}
            detail={member.parents ? `Offspring of ${name(member.parents[0])} × ${name(member.parents[1])}` : ''} />;
        })}
        {descendants.continuing ? <p className="help-copy">{descendants.continuing.toLocaleString()} of the {descendantLabel(MAX_DESCENDANT_DEPTH).toLowerCase()} have offspring of their own. Select one to continue.</p> : null}
      </> : <p className="empty-copy">Their story is just beginning.</p>}
    </section>

    <p className="help-copy">Pedigree F ({pedigreeF}) uses every recorded generation, not only those shown, and assumes founder stock is unrelated and not inbred. It is different from heterozygosity.{fish.parents && totals.positions ? ` Of ${totals.positions} ancestor positions shown, ${totals.recorded} are recorded${totals.unknown ? ` and ${totals.unknown} lie above founder stock` : ''}${totals.missing ? `; ${totals.missing} are missing from this world` : ''}.` : ''} Repeated ancestors are listed once, at their nearest generation.</p>
  </div>;
}

function FamilyRelative({ fish, where, detail, notes = [], onSelect }: { fish: Fish; where: string; detail: string; notes?: string[]; onSelect: (id: string) => void }) {
  return <button className="relative" onClick={() => onSelect(fish.id)}>
    <FishPortrait fish={fish} view="current" />
    <span>
      <strong>{fish.name}</strong>
      <small>G{fish.generation} · <SexMark sex={fish.sex} withLabel /> · {where}</small>
      {detail ? <small>{detail}</small> : null}
      {notes.length ? <span className="relative-notes">{notes.map(note => <span key={note}>{note}</span>)}</span> : null}
    </span>
    <span aria-hidden="true">↗</span>
  </button>;
}
