import { useEffect, useMemo, useState } from 'react';
import { isEgg } from '../core/development';
import {
  BOTH_COPIES_FIDELITY, copiesOf, dosesFor, EXTRACT_COST, extractProblem, MAX_CASSETTES, MAX_EDITS_PER_FISH, MIN_FIDELITY, MIN_INTEGRITY,
  SPLICE_COST, spliceProblem, type Cassette, type Copy, type SpliceTarget,
} from '../core/geneLab';
import {
  alleleText, cassetteRead, cassetteTitle, genotypeShown, germlineView, grade, inheritanceShare, karyotype, locusName, overhang, overhangLength,
} from '../core/geneLabView';
import { SPECIES_INFO } from '../core/species';
import { SPECIES, type Fish, type Species, type World } from '../core/types';
import type { Command } from '../core/world';
import { CassetteArt, EmptyVaultArt, HelixOrnament, SPECIES_TONE } from './editor/EditorArt';
import { Anneal, RestrictionCut, StickyEnds, type GameResult } from './editor/Minigames';
import { FishPortrait } from './FishPortrait';
import { Icon, type IconName } from './Icon';
import { Dialog } from './kit/Overlay';
import './genomeEditor.css';

type Props = { world: World; readOnly: boolean; focusId?: string; onRun: (command: Command, message: string) => World | null; onInspect: (fishId: string) => void };
type Mode = 'extract' | 'splice';
type ExtractGame = { kind: 'extract'; fishId: string; locus: number; copy: Copy; stage: 'intro' | 'play' | 'result'; result: GameResult | null; attempt: number };
type SpliceGame = { kind: 'splice'; cassetteId: string; fishId: string; target: SpliceTarget; stage: 'intro' | 'pair' | 'anneal' | 'result'; pairing: GameResult | null; anneal: GameResult | null; attempt: number };
type Game = ExtractGame | SpliceGame;

const SPECIES_ICON: Record<Species, IconName> = { koi: 'fish', goldfish: 'goldfish', guppy: 'guppy', axolotl: 'leaf' };
const credits = (amount: number) => `◈ ${amount.toLocaleString('en')}`;
const COPY_LABEL: Record<Copy, string> = { maternal: 'Maternal', paternal: 'Paternal' };
const TARGET_LABEL: Record<SpliceTarget, string> = { maternal: 'maternal copy', paternal: 'paternal copy', both: 'both copies' };

/**
 * Genome Editor (FS-132): the Splice Bench. Extract mode cuts one allele copy out of a donor into a gene cassette;
 * splice mode writes a cassette into a recipient's germline, so its offspring inherit it. Both are gated by minigames
 * whose score travels in the command. The recipient's own genome and look never change: the bench says so plainly.
 */
export function GenomeEditor({ world, readOnly, focusId, onRun, onInspect }: Props) {
  const lab = world.geneLab;
  const candidates = useMemo(() => world.fish.filter(f => f.status === 'living' && !isEgg(f.life)), [world.fish]);
  const [mode, setMode] = useState<Mode>('extract');
  const [speciesFilter, setSpeciesFilter] = useState<Species | 'all'>('all');
  const [query, setQuery] = useState('');
  const [fishId, setFishId] = useState(() => candidates.find(f => f.id === focusId)?.id ?? candidates[0]?.id ?? '');
  const [locus, setLocus] = useState<number | null>(null);
  const [cassetteId, setCassetteId] = useState<string | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [discarding, setDiscarding] = useState<Cassette | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; text: string } | null>(null);

  const fish = candidates.find(f => f.id === fishId) ?? candidates[0];
  const cassette = lab.cassettes.find(c => c.id === cassetteId) ?? null;
  useEffect(() => { if (cassetteId && !cassette) setCassetteId(null); }, [cassetteId, cassette]);
  const listSpecies = mode === 'splice' && cassette ? cassette.species : speciesFilter;
  const present = SPECIES.filter(s => candidates.some(f => f.species === s));
  const list = candidates.filter(f => (listSpecies === 'all' || f.species === listSpecies) && (!query.trim() || `${f.name} ${f.id}`.toLowerCase().includes(query.trim().toLowerCase())));
  const editedAnimals = new Set(lab.edits.filter(edit => candidates.some(f => f.id === edit.fishId)).map(edit => edit.fishId)).size;

  const loadCassette = (entry: Cassette) => {
    setMode('splice'); setCassetteId(entry.id); setLocus(entry.locus);
    if (!fish || fish.species !== entry.species) {
      const target = candidates.find(f => f.species === entry.species && !spliceProblem(world, entry, f, 'maternal')) ?? candidates.find(f => f.species === entry.species);
      if (target) setFishId(target.id);
    }
  };
  const chooseFish = (next: Fish) => { setFishId(next.id); if (!(mode === 'splice' && cassette)) setLocus(null); };

  return <section className="bench" aria-labelledby="bench-title">
    <header className="bench-heading">
      <div className="bench-intro">
        <span className="bench-kicker"><Icon name="splice" size={14} />THE SPLICE BENCH</span>
        <h1 id="bench-title">Cut, store and splice heritable DNA.</h1>
        <p>Cut one allele copy out of a donor into a gene cassette, then splice it into another animal of the same species. The edit is written into the recipient’s <strong>germline</strong>: the animal itself looks the same, but every clutch it parents inherits the new copy. The minigames decide how clean each sample and splice is.</p>
      </div>
      <HelixOrnament />
      <div className="bench-stats" role="group" aria-label="Bench status">
        <div><span className="bench-kicker">VAULT</span><strong>{lab.cassettes.length}<small>/{MAX_CASSETTES}</small></strong><small>cassettes</small></div>
        <div><span className="bench-kicker">EDITED</span><strong>{editedAnimals}</strong><small>living animal{editedAnimals === 1 ? '' : 's'}</small></div>
        <div><span className="bench-kicker">COSTS</span><strong className="brass">{credits(EXTRACT_COST)}</strong><small>cut · {credits(SPLICE_COST)} per spliced copy</small></div>
      </div>
    </header>

    <div className="bench-modes segmented" role="group" aria-label="Bench mode">
      <button aria-pressed={mode === 'extract'} onClick={() => setMode('extract')}><Icon name="scissors" size={16} />Extract<small>cut a copy into a cassette</small></button>
      <button aria-pressed={mode === 'splice'} onClick={() => { setMode('splice'); if (!cassette && lab.cassettes[0]) loadCassette(lab.cassettes[0]); }}><Icon name="splice" size={16} />Splice<small>write a cassette into a germline</small></button>
    </div>

    {readOnly ? <p className="bench-note" role="note"><Icon name="info" size={16} />This tab is read-only, so the bench cannot cut or splice. Close the editing tab and reload to take control.</p> : null}

    <div className="bench-layout">
      <nav className="bench-specimens" aria-label="Animals on the bench">
        <div className="bench-panel-head"><strong>{mode === 'extract' ? 'Choose a donor' : 'Choose a recipient'}</strong><span>{list.length}</span></div>
        {mode === 'splice' && cassette ? <p className="bench-filter-note"><Icon name="filter" size={14} />Showing {SPECIES_INFO[cassette.species].many}: this cassette only splices into its own species.</p>
          : <div className="bench-chips" role="group" aria-label="Species">
            <button className="chip" aria-pressed={speciesFilter === 'all'} onClick={() => setSpeciesFilter('all')}>All</button>
            {present.map(s => <button key={s} className={`chip ${s}`} aria-pressed={speciesFilter === s} onClick={() => setSpeciesFilter(s)}><Icon name={SPECIES_ICON[s]} size={12} />{SPECIES_INFO[s].titles}</button>)}
          </div>}
        <label className="bench-search"><Icon name="search" size={15} /><span className="visually-hidden">Find an animal</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Find by name or ID" /></label>
        {list.length ? <ul>{list.map(f => {
          const edits = lab.edits.filter(edit => edit.fishId === f.id).length;
          const fits = mode === 'splice' && cassette ? (['maternal', 'paternal'] as const).some(copy => !spliceProblem(world, cassette, f, copy)) : true;
          return <li key={f.id}>
            <button className={`specimen ${f.id === fish?.id ? 'current' : ''} ${fits ? '' : 'unfit'}`} aria-current={f.id === fish?.id ? 'true' : undefined} onClick={() => chooseFish(f)}>
              <span className="specimen-portrait"><FishPortrait fish={f} /></span>
              <span className="specimen-text">
                <strong>{f.name}</strong>
                <small><span className={`sex ${f.sex}`}>{f.sex === 'F' ? '♀' : '♂'}</span> {SPECIES_INFO[f.species].title} · gen {f.generation}</small>
                {edits ? <span className="edited-badge"><Icon name="splice" size={11} />{edits} edited cop{edits === 1 ? 'y' : 'ies'}</span> : null}
                {mode === 'splice' && cassette && !fits ? <small className="unfit-text">Nothing to splice here</small> : null}
              </span>
            </button>
          </li>;
        })}</ul> : <div className="bench-empty"><Icon name="fish" size={26} /><p>No animals match.</p><small>Eggs cannot be sampled or edited until they hatch.</small></div>}
      </nav>

      {fish ? <Workbench world={world} fish={fish} mode={mode} locus={locus} onLocus={setLocus} cassette={cassette} readOnly={readOnly} onInspect={onInspect}
        onExtract={copy => locus !== null && setGame({ kind: 'extract', fishId: fish.id, locus, copy, stage: 'intro', result: null, attempt: 0 })}
        onSplice={target => cassette && setGame({ kind: 'splice', cassetteId: cassette.id, fishId: fish.id, target, stage: 'intro', pairing: null, anneal: null, attempt: 0 })}
        onRestore={(at, copy) => onRun({ type: 'restore-germline', fishId: fish.id, locus: at, copy }, `${fish.name}’s ${copy} copy at ${locusName(world, fish.species, at)} restored. It transmits the allele it was born with again.`)}
        onPickCassette={() => setMode('splice')} />
        : <div className="bench-work bench-empty"><Icon name="fish" size={28} /><p>No living animals to work on.</p></div>}

      <aside className="bench-vault" aria-labelledby="vault-title">
        <div className="bench-panel-head"><strong id="vault-title"><Icon name="vault" size={16} />Gene vault</strong><span>{lab.cassettes.length}/{MAX_CASSETTES}</span></div>
        {lab.cassettes.length ? <ul>{lab.cassettes.map(entry => {
          const read = cassetteRead(world, entry), donor = world.fish.find(f => f.id === entry.donorId), allele = alleleText(world, entry.species, entry.locus, entry.allele);
          const loaded = mode === 'splice' && cassette?.id === entry.id;
          return <li key={entry.id} className={`cassette-card ${loaded ? 'loaded' : ''}`} style={{ '--species-tone': SPECIES_TONE[entry.species] } as React.CSSProperties}>
            <CassetteArt species={entry.species} seed={`${entry.species}:${entry.locus}:${entry.allele}`} doses={entry.doses} integrity={entry.integrity} read={read} />
            <div className="cassette-body">
              <span className="cassette-id mono">{entry.id}</span>
              {renaming?.id === entry.id ? <form className="cassette-rename" onSubmit={event => { event.preventDefault(); if (onRun({ type: 'label-cassette', cassetteId: entry.id, label: renaming.text }, 'Cassette relabelled.')) setRenaming(null); }}>
                <input autoFocus value={renaming.text} maxLength={32} onChange={event => setRenaming({ id: entry.id, text: event.target.value })} aria-label="Cassette label" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setRenaming(null); } }} />
                <button className="btn-sm" type="submit">Save</button>
              </form> : <strong className="cassette-title">{cassetteTitle(world, entry)}</strong>}
              <small>{read ? <><code className="allele">{allele.code}</code> {allele.name}</> : <span className="unread">Unread · sequence {donor?.name ?? 'the donor'} to read it</span>}</small>
              <small>{SPECIES_INFO[entry.species].title} · {entry.donorCopy} copy of {donor?.name ?? entry.donorId}{entry.origin ? <span className="origin-mark" data-tip="Descends from a recorded mutation; the splice keeps its origin"> ◆</span> : null}</small>
              <div className="cassette-meters">
                <span className="integrity" data-tip={`Integrity ${entry.integrity}: sets the doses and how wide the annealing window is`}><i style={{ width: `${entry.integrity}%` }} /></span>
                <span className="doses" aria-label={`${entry.doses} doses left`}>{[0, 1, 2].map(i => <i key={i} className={i < entry.doses ? 'on' : ''} />)}</span>
              </div>
              <div className="cassette-actions">
                <button className={loaded ? 'primary btn-sm' : 'btn-sm'} onClick={() => loadCassette(entry)} aria-pressed={loaded}><Icon name="splice" size={14} />{loaded ? 'Loaded' : 'Load'}</button>
                <button className="quiet btn-sm icon-button" onClick={() => setRenaming({ id: entry.id, text: entry.label ?? '' })} aria-label={`Relabel ${entry.id}`} data-tip="Relabel" disabled={readOnly}><Icon name="tag" size={14} /></button>
                <button className="quiet btn-sm icon-button" onClick={() => setDiscarding(entry)} aria-label={`Discard ${entry.id}`} data-tip="Discard" disabled={readOnly}><Icon name="trash" size={14} /></button>
              </div>
            </div>
          </li>;
        })}</ul> : <div className="vault-empty">
          <EmptyVaultArt />
          <p>The vault is empty.</p>
          <small>In Extract mode, pick a donor and a locus, then cut a copy. Cassettes wait here until you splice them.</small>
        </div>}
        <div className="bench-howto">
          <h3>How the bench works</h3>
          <ol>
            <li><Icon name="scissors" size={16} /><span><b>Restriction Cut.</b> Cut both recognition sites as they pass the enzyme. Cleaner cuts give more doses.</span></li>
            <li><Icon name="cassette" size={16} /><span><b>Sticky Ends.</b> Pair every overhanging base with its partner: A with T, G with C.</span></li>
            <li><Icon name="dial" size={16} /><span><b>Anneal.</b> Lock the thermocycler inside the window three times. Purer cassettes give a wider window.</span></li>
          </ol>
          <p>An edit changes what an animal passes on, never the animal itself. It is a lab shortcut, not a simulation of real gene editing.</p>
        </div>
      </aside>
    </div>

    {game?.kind === 'extract' ? <ExtractDialog world={world} game={game} onGame={setGame} onRun={onRun} onStored={() => setGame(null)} /> : null}
    {game?.kind === 'splice' ? <SpliceDialog world={world} game={game} onGame={setGame} onRun={onRun} onDone={() => setGame(null)} /> : null}
    <Dialog open={!!discarding} onClose={() => setDiscarding(null)} tone="rose" icon="trash" title={`Discard ${discarding?.id ?? ''}?`}
      description="The cassette and its remaining doses are destroyed. Edits already spliced from it stay in their germlines."
      actions={<><button onClick={() => setDiscarding(null)}>Cancel</button><button className="danger" onClick={() => { if (discarding && onRun({ type: 'discard-cassette', cassetteId: discarding.id }, `${discarding.id} discarded.`)) setDiscarding(null); }}>Discard cassette</button></>} />
  </section>;
}

/* ---- Workbench: portrait, karyogram and the selected locus ------------------------------------------------------- */

function Workbench({ world, fish, mode, locus, onLocus, cassette, readOnly, onInspect, onExtract, onSplice, onRestore, onPickCassette }: {
  world: World; fish: Fish; mode: Mode; locus: number | null; onLocus: (locus: number) => void; cassette: Cassette | null; readOnly: boolean; onInspect: (id: string) => void;
  onExtract: (copy: Copy) => void; onSplice: (target: SpliceTarget) => void; onRestore: (locus: number, copy: Copy) => void; onPickCassette: () => void;
}) {
  const chromosomes = useMemo(() => karyotype(world, fish), [world.atlas, fish]);
  const view = useMemo(() => germlineView(world, fish), [world, fish]);
  const seen = genotypeShown(world, fish), splicing = mode === 'splice' && cassette && cassette.species === fish.species ? cassette : null;
  const code = (value: number, at: number) => seen ? alleleText(world, fish.species, at, value).code : '??';

  return <div className="bench-work">
    <div className="work-plate">
      <div className="work-portrait"><FishPortrait fish={fish} large /></div>
      <div className="work-identity">
        <span className="bench-kicker">{mode === 'extract' ? 'DONOR' : 'RECIPIENT'} · {SPECIES_INFO[fish.species].title.toUpperCase()}</span>
        <h2>{fish.name}</h2>
        <p><span className="mono">{fish.id}</span> · <span className={`sex ${fish.sex}`}>{fish.sex === 'F' ? '♀ female' : '♂ male'}</span> · generation {fish.generation} · genome v{fish.genome.version}</p>
        <p className="work-germline">{view.edits.length ? <><Icon name="splice" size={14} />{view.edits.length} of {MAX_EDITS_PER_FISH} germline copies edited. Its looks are unchanged; its offspring inherit the edits.</>
          : <>Germline as born. {seen ? 'Alleles are readable.' : 'Alleles stay hidden until this animal is sequenced (discovery mode).'}</>}</p>
        <button className="link-button" onClick={() => onInspect(fish.id)}>Open in the inspector <Icon name="arrowRight" size={13} /></button>
      </div>
    </div>

    <div className="karyo" role="grid" aria-label={`${fish.name}’s karyogram: twelve chromosomes, two copies each`}>
      <div className="karyo-legend" aria-hidden="true"><span><i className="m" />maternal copy</span><span><i className="p" />paternal copy</span><span><i className="e" />edited germline</span>{splicing ? <span><i className="t" />cassette target</span> : null}</div>
      {chromosomes.map(chromosome => <div className={`karyo-row ${chromosome.carried ? '' : 'absent'}`} role="row" key={chromosome.number}>
        <span className="karyo-label" role="rowheader"><b className="mono">{String(chromosome.number).padStart(2, '0')}</b>{chromosome.label}</span>
        <div className="karyo-bands">
          {chromosome.loci.map(entry => {
            const carried = entry.index < fish.genome.maternal.length;
            const em = view.editAt(entry.index, 'maternal'), ep = view.editAt(entry.index, 'paternal');
            const target = splicing?.locus === entry.index, selected = locus === entry.index;
            return <button role="gridcell" key={entry.index} disabled={!carried} aria-selected={selected}
              className={`band ${selected ? 'selected' : ''} ${entry.known ? '' : 'unknown'} ${entry.editable ? '' : 'locked'} ${target ? 'target' : ''} ${em || ep ? 'edited' : ''}`}
              onClick={() => onLocus(entry.index)} data-tip={`${entry.name}${entry.editable ? '' : ' · cannot be edited'}`}
              aria-label={`${entry.name}: ${carried ? `maternal ${em ? `${code(em.allele, entry.index)} edited` : code(fish.genome.maternal[entry.index], entry.index)}, paternal ${ep ? `${code(ep.allele, entry.index)} edited` : code(fish.genome.paternal[entry.index], entry.index)}` : 'not carried'}`}>
              {carried ? <>
                <span className={`band-copy m ${em ? 'is-edited' : ''}`}>{em ? code(em.allele, entry.index) : code(fish.genome.maternal[entry.index], entry.index)}</span>
                <span className={`band-copy p ${ep ? 'is-edited' : ''}`}>{ep ? code(ep.allele, entry.index) : code(fish.genome.paternal[entry.index], entry.index)}</span>
              </> : <span className="band-copy none">—</span>}
            </button>;
          })}
        </div>
      </div>)}
    </div>

    {locus !== null ? <LocusCard world={world} fish={fish} locus={locus} mode={mode} cassette={splicing ? cassette : mode === 'splice' ? cassette : null} readOnly={readOnly}
      view={view} onExtract={onExtract} onSplice={onSplice} onRestore={onRestore} onLocus={onLocus} onPickCassette={onPickCassette} />
      : <p className="locus-hint"><Icon name="info" size={15} />{mode === 'extract' ? 'Select a locus band to cut one of its copies.' : cassette ? `Select the highlighted band (${locusName(world, cassette.species, cassette.locus)}) to splice the loaded cassette.` : 'Load a cassette from the vault to splice it.'}</p>}
  </div>;
}

function LocusCard({ world, fish, locus, mode, cassette, readOnly, view, onExtract, onSplice, onRestore, onLocus, onPickCassette }: {
  world: World; fish: Fish; locus: number; mode: Mode; cassette: Cassette | null; readOnly: boolean; view: ReturnType<typeof germlineView>;
  onExtract: (copy: Copy) => void; onSplice: (target: SpliceTarget) => void; onRestore: (locus: number, copy: Copy) => void; onLocus: (locus: number) => void; onPickCassette: () => void;
}) {
  const seen = genotypeShown(world, fish), name = locusName(world, fish.species, locus);
  const describe = (value: number) => seen ? alleleText(world, fish.species, locus, value) : { code: '??', name: 'hidden until sequenced' };
  const blocked = readOnly ? 'This tab is read-only.' : null;
  const extractReason = blocked ?? extractProblem(world, fish, locus) ?? (world.credits < EXTRACT_COST ? `A cut costs ${credits(EXTRACT_COST)} and you have ${credits(world.credits)}.` : null);
  const spliceReason = (target: SpliceTarget) => blocked ?? spliceProblem(world, cassette ?? undefined, fish, target)
    ?? (world.credits < SPLICE_COST * copiesOf(target).length ? `This costs ${credits(SPLICE_COST * copiesOf(target).length)} and you have ${credits(world.credits)}.` : null);

  return <div className="locus-card" aria-live="polite">
    <header>
      <div><span className="bench-kicker">SELECTED LOCUS</span><h3>{name}</h3></div>
      <span className="mono locus-index">#{locus}</span>
    </header>
    <div className="locus-copies">
      {(['maternal', 'paternal'] as const).map(copy => {
        const born = describe(fish.genome[copy][locus]), edit = view.editAt(locus, copy), edited = edit ? describe(edit.allele) : null;
        return <div className={`locus-copy ${copy}`} key={copy}>
          <span className="bench-kicker">{COPY_LABEL[copy].toUpperCase()} COPY</span>
          <p><code className="allele">{born.code}</code> {born.name}{edit ? <span className="struck"> (as born)</span> : null}</p>
          {edit && edited ? <p className="locus-edited"><Icon name="splice" size={13} />Germline: <code className="allele">{edited.code}</code> {edited.name}<small> · from {edit.cassetteId}, fidelity {edit.fidelity}</small></p> : null}
          {edit ? <button className="btn-sm quiet" disabled={readOnly} onClick={() => onRestore(locus, copy)}><Icon name="restore" size={14} />Restore as born</button> : null}
          {mode === 'extract' ? <button className="btn-sm primary-gene" disabled={!!extractReason} onClick={() => onExtract(copy)}><Icon name="scissors" size={14} />Cut this copy · {credits(EXTRACT_COST)}</button> : null}
        </div>;
      })}
    </div>
    {mode === 'extract' && extractReason ? <p className="locus-reason"><Icon name="info" size={14} />{extractReason}</p> : null}
    {mode === 'extract' && !extractReason ? <p className="locus-help">The donor is unharmed: the bench copies the allele. In discovery mode a cassette from an unsequenced donor stays unread until you sequence the donor.</p> : null}
    {mode === 'splice' ? !cassette ? <p className="locus-reason"><Icon name="vault" size={14} />No cassette loaded. <button className="link-button" onClick={onPickCassette}>Load one from the vault</button>.</p>
      : cassette.species !== fish.species ? <p className="locus-reason"><Icon name="info" size={14} />The loaded cassette holds {SPECIES_INFO[cassette.species].one} DNA. Choose {SPECIES_INFO[cassette.species].a}.</p>
      : cassette.locus !== locus ? <p className="locus-reason"><Icon name="info" size={14} />{cassette.id} targets {locusName(world, cassette.species, cassette.locus)}. <button className="link-button" onClick={() => onLocus(cassette.locus)}>Go to that locus</button>.</p>
      : <div className="splice-panel">
        <div className="splice-summary">
          <CassetteArt species={cassette.species} seed={`${cassette.species}:${cassette.locus}:${cassette.allele}`} doses={cassette.doses} integrity={cassette.integrity} read={cassetteRead(world, cassette)} size={54} />
          <p><b>{cassette.id}</b> · {cassetteRead(world, cassette) ? <><code className="allele">{alleleText(world, cassette.species, cassette.locus, cassette.allele).code}</code> {alleleText(world, cassette.species, cassette.locus, cassette.allele).name}</> : 'unread allele'} · {cassette.doses} dose{cassette.doses === 1 ? '' : 's'} · integrity {cassette.integrity}</p>
        </div>
        <div className="splice-targets">
          {(['maternal', 'paternal', 'both'] as const).map(target => {
            const reason = spliceReason(target), share = inheritanceShare(copiesOf(target).length);
            return <div className="splice-target" key={target}>
              <button className={target === 'both' ? 'primary-gene' : ''} disabled={!!reason} onClick={() => onSplice(target)}>
                <Icon name="splice" size={15} />Splice {TARGET_LABEL[target]}<span className="brass">{credits(SPLICE_COST * copiesOf(target).length)}</span>
              </button>
              <Gametes share={share} />
              <small>{reason ?? (target === 'both' ? `Every offspring inherits it. Needs fidelity ${BOTH_COPIES_FIDELITY}.` : 'About half of its offspring inherit it.')}</small>
            </div>;
          })}
        </div>
      </div> : null}
  </div>;
}

/** Eight gametes, lit by the share that carries the spliced allele. */
function Gametes({ share }: { share: number }) {
  return <span className="gametes" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <i key={i} className={i < Math.round(share * 8) ? 'on' : ''} />)}</span>;
}

/* ---- Minigame dialogs ------------------------------------------------------------------------------------------- */

function ResultCard({ score, failed, note, label }: { score: number; failed: boolean; note: string; label: string }) {
  const g = grade(failed ? 0 : score);
  return <div className={`result-card grade-${g.letter} ${failed ? 'failed' : ''}`} role="status">
    <span className="result-grade">{failed ? '×' : g.letter}</span>
    <div><strong>{failed ? 'Failed' : g.word}</strong><span>{label} <b className="mono">{failed ? 0 : score}</b></span><small>{note}</small></div>
  </div>;
}

function ExtractDialog({ world, game, onGame, onRun, onStored }: { world: World; game: ExtractGame; onGame: (game: Game | null) => void; onRun: Props['onRun']; onStored: () => void }) {
  const donor = world.fish.find(f => f.id === game.fishId)!, name = locusName(world, donor.species, game.locus), result = game.result;
  const kept = result && !result.failed && result.score >= MIN_INTEGRITY;
  const store = () => {
    if (!result) return;
    if (onRun({ type: 'extract-gene', fishId: donor.id, locus: game.locus, copy: game.copy, integrity: result.score }, `Stored a ${name} cassette from ${donor.name} in the vault · ${credits(EXTRACT_COST)}`)) onStored();
  };
  return <Dialog open onClose={() => onGame(null)} wide tone="gene" icon="scissors" title={`Restriction Cut · ${name}`}
    description={`${donor.name}, ${game.copy} copy. Cut the 5′ and 3′ recognition sites as they cross the enzyme. Cutting bare strand nicks it; a missed site loops round faster.`}
    actions={game.stage === 'intro' ? <><button onClick={() => onGame(null)}>Cancel</button><button className="primary-gene" data-autofocus onClick={() => onGame({ ...game, stage: 'play' })}><Icon name="play" size={15} />Start the digest</button></>
      : game.stage === 'result' ? <><button onClick={() => onGame(null)}>{kept ? 'Discard sample' : 'Close'}</button>
        <button onClick={() => onGame({ ...game, stage: 'play', result: null, attempt: game.attempt + 1 })}><Icon name="refresh" size={15} />Try again</button>
        {kept ? <button className="primary-gene" data-autofocus onClick={store}><Icon name="vault" size={15} />Store in vault · {credits(EXTRACT_COST)}</button> : null}</>
      : <button onClick={() => onGame(null)}>Abandon</button>}>
    {game.stage === 'intro' ? <GameIntro steps={[['scissors', 'Space or Cut', 'Cut when a brass site sits inside the glowing window.'], ['alert', 'Three nicks', 'Cutting where there is no site damages the strand; three nicks ruin it.'], ['vault', `Integrity ${MIN_INTEGRITY}+`, 'Keeps the sample. 60+ gives two doses, 85+ gives three.']]} />
      : game.stage === 'play' ? <RestrictionCut key={game.attempt} geneName={name} onDone={outcome => onGame({ ...game, stage: 'result', result: outcome })} />
      : result ? <>
        <ResultCard score={result.score} failed={result.failed || result.score < MIN_INTEGRITY} note={result.failed ? result.note : result.score < MIN_INTEGRITY ? `Too damaged to keep (${MIN_INTEGRITY} needed). ${result.note}` : result.note} label="Integrity" />
        {kept ? <p className="result-explain">This cassette will hold <b>{dosesFor(result.score)} dose{dosesFor(result.score) === 1 ? '' : 's'}</b>. Nothing is charged until you store it.</p> : null}
      </> : null}
  </Dialog>;
}

function SpliceDialog({ world, game, onGame, onRun, onDone }: { world: World; game: SpliceGame; onGame: (game: Game | null) => void; onRun: Props['onRun']; onDone: () => void }) {
  const cassette = world.geneLab.cassettes.find(c => c.id === game.cassetteId), fish = world.fish.find(f => f.id === game.fishId)!;
  const bases = useMemo(() => cassette ? overhang(cassette.species, cassette.locus, cassette.allele, overhangLength(cassette.integrity)) : [], [cassette]);
  if (!cassette) return null;
  const name = locusName(world, fish.species, cassette.locus);
  const pairing = game.pairing, anneal = game.anneal;
  const failed = !!pairing?.failed || !!anneal?.failed;
  const fidelity = pairing && anneal ? Math.round((pairing.score + anneal.score) / 2) : 0;
  const landed = !failed && fidelity >= MIN_FIDELITY;
  const fallback = game.target === 'both' && landed && fidelity < BOTH_COPIES_FIDELITY
    ? (['maternal', 'paternal'] as const).filter(copy => !spliceProblem(world, cassette, fish, copy)) : [];
  const commit = (target: SpliceTarget) => {
    const cost = SPLICE_COST * copiesOf(target).length;
    if (onRun({ type: 'splice-gene', cassetteId: cassette.id, fishId: fish.id, copies: target, fidelity }, `Spliced ${cassette.id} into ${fish.name}’s ${TARGET_LABEL[target]}. Its offspring will carry it · ${credits(cost)}`)) onDone();
  };
  const steps: [string, boolean][] = [['Sticky ends', game.stage === 'pair'], ['Anneal', game.stage === 'anneal'], ['Result', game.stage === 'result']];
  return <Dialog open onClose={() => onGame(null)} wide tone="gene" icon="splice" title={`Splice ${cassette.id} → ${fish.name}`}
    description={`${name}, ${TARGET_LABEL[game.target]}. Pair the cassette’s overhang, then anneal it into the germline.`}
    actions={game.stage === 'intro' ? <><button onClick={() => onGame(null)}>Cancel</button><button className="primary-gene" data-autofocus onClick={() => onGame({ ...game, stage: 'pair' })}><Icon name="play" size={15} />Begin ligation</button></>
      : game.stage === 'result' ? <><button onClick={() => onGame(null)}>Close</button>
        <button onClick={() => onGame({ ...game, stage: 'pair', pairing: null, anneal: null, attempt: game.attempt + 1 })}><Icon name="refresh" size={15} />Try again</button>
        {landed && fallback.length === 0 && (game.target !== 'both' || fidelity >= BOTH_COPIES_FIDELITY) ? <button className="primary-gene" data-autofocus onClick={() => commit(game.target)}><Icon name="splice" size={15} />Commit splice · {credits(SPLICE_COST * copiesOf(game.target).length)}</button> : null}
        {fallback.map(copy => <button key={copy} className="primary-gene" onClick={() => commit(copy)}><Icon name="splice" size={15} />Land on {copy} copy · {credits(SPLICE_COST)}</button>)}</>
      : <button onClick={() => onGame(null)}>Abandon</button>}>
    {game.stage !== 'intro' ? <ol className="game-steps">{steps.map(([label, current], i) => <li key={label} className={current ? 'current' : (i === 0 && pairing) || (i === 1 && anneal) ? 'done' : ''}>{label}</li>)}</ol> : null}
    {game.stage === 'intro' ? <GameIntro steps={[['cassette', 'A T G C', `Pair each of the ${bases.length} overhanging bases with its partner before time runs out. Three mismatches unravel the end.`], ['dial', 'Space or Lock', 'Stop the thermocycler needle inside the green window, three times.'], ['splice', `Fidelity ${MIN_FIDELITY}+`, `Lands the edit. Both copies need ${BOTH_COPIES_FIDELITY}+. Nothing is charged until you commit.`]]} />
      : game.stage === 'pair' ? <StickyEnds key={`p${game.attempt}`} bases={bases} onDone={outcome => onGame({ ...game, pairing: outcome, stage: outcome.failed ? 'result' : 'anneal' })} />
      : game.stage === 'anneal' ? <Anneal key={`a${game.attempt}`} integrity={cassette.integrity} onDone={outcome => onGame({ ...game, anneal: outcome, stage: 'result' })} />
      : <>
        {pairing ? <ResultCard score={pairing.score} failed={pairing.failed} note={pairing.note} label="Pairing" /> : null}
        {anneal ? <ResultCard score={anneal.score} failed={anneal.failed} note={anneal.note} label="Annealing" /> : null}
        {!failed && anneal ? <ResultCard score={fidelity} failed={!landed} note={landed ? fidelity >= BOTH_COPIES_FIDELITY || game.target !== 'both' ? 'The splice is ready to commit.' : `Too weak for both copies (${BOTH_COPIES_FIDELITY} needed). Land it on one copy instead.` : `The ligation did not hold (${MIN_FIDELITY} needed).`} label="Fidelity" /> : null}
        {landed && fallback.length === 0 && game.target === 'both' && fidelity < BOTH_COPIES_FIDELITY ? <p className="result-explain">Neither copy can take this cassette on its own right now.</p> : null}
      </>}
  </Dialog>;
}

function GameIntro({ steps }: { steps: [IconName, string, string][] }) {
  return <ul className="game-intro">{steps.map(([icon, key, text]) => <li key={key}><span className="game-intro-icon"><Icon name={icon} size={20} /></span><b>{key}</b><span>{text}</span></li>)}</ul>;
}
