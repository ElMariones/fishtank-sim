import { useEffect, useMemo, useState } from 'react';
import { CHROMOSOMES, LOCI, label } from '../core/catalog';
import { express, fingerprint, heterozygosity } from '../core/genetics';
import { MARKING_BLOCKS, MARKING_VISIBLE_ALPHA } from '../core/pattern';
import { kinship } from '../core/pedigree';
import { decodeSave, SAVE_KEY } from '../core/save';
import type { Fish, World } from '../core/types';
import { applyCommand, COHORT_SIZE, createWorld, quote, STOCK_PRICE, type Command } from '../core/world';
import { FishPortrait } from './FishPortrait';
import { TankCanvas } from './TankCanvas';
import { VisualFixtureLab } from './VisualFixtureLab';
import './styles.css';

const percent = (n: number) => `${(n * 100).toFixed(1)}%`;
const date = (timestamp: string) => new Date(timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
type SexFilter = 'all' | Fish['sex'];

function load(): { world: World; warning: string; blocked: boolean } {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return { world: raw ? decodeSave(raw) : createWorld(new Date().toISOString()), warning: '', blocked: false };
  } catch {
    return { world: createWorld(new Date().toISOString()), warning: 'Your stored save could not be loaded. It has been preserved. This temporary session will not overwrite it; export your work before leaving.', blocked: true };
  }
}

function download(world: World) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(world, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'fishtank-lab-v1.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function App() {
  const [initial] = useState(load);
  const [world, setWorld] = useState(initial.world);
  const [tankId, setTankId] = useState(initial.world.tanks[0].id);
  const [selectedId, setSelectedId] = useState(initial.world.fish.find(f => f.status === 'living')?.id ?? '');
  const [tab, setTab] = useState<'Overview' | 'Genome' | 'Family'>('Overview');
  const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [speed, setSpeed] = useState(1);
  const [feedSignal, setFeedSignal] = useState(0);
  const [notice, setNotice] = useState('Select a fish to explore its traits and ancestry.');
  const [saveError, setSaveError] = useState(initial.warning);
  const [motherId, setMotherId] = useState(initial.world.fish.find(f => f.sex === 'F' && f.status === 'living')?.id ?? '');
  const [fatherId, setFatherId] = useState(initial.world.fish.find(f => f.sex === 'M' && f.status === 'living')?.id ?? '');
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [sexFilter, setSexFilter] = useState<SexFilter>('all');
  const [saleId, setSaleId] = useState<string | null>(null);
  const [view, setView] = useState<'aquarium' | 'fixtures'>('aquarium');
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [batchReview, setBatchReview] = useState(false);
  const [lastBatchId, setLastBatchId] = useState<string | null>(null);

  useEffect(() => {
    if (initial.blocked) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(world)); setSaveError(''); }
    catch { setSaveError('Saving is unavailable or storage is full. Export your save to keep this session.'); }
  }, [world, initial.blocked]);

  const tank = world.tanks.find(t => t.id === tankId) ?? world.tanks[0];
  const fish = world.fish.find(f => f.id === selectedId);
  const living = world.fish.filter(f => f.status === 'living');
  const residents = useMemo(() => world.fish.filter(f => f.tankId === tank.id && f.status === 'living'), [world.fish, tank.id]);
  const p = useMemo(() => fish ? express(fish.genome) : null, [fish]);
  const prospectiveF = useMemo(() => kinship(world.fish, motherId, fatherId), [world.fish, motherId, fatherId]);
  const currentF = useMemo(() => fish?.parents ? kinship(world.fish, fish.parents[0], fish.parents[1]) : 0, [world.fish, fish]);
  const viewFish = (showArchived ? world.fish.filter(f => f.status === 'sold') : residents).filter(f => `${f.name} ${f.id}`.toLowerCase().includes(query.toLowerCase()));
  const collection = sexFilter === 'all' ? viewFish : viewFish.filter(f => f.sex === sexFilter);
  const sexCounts = { all: viewFish.length, F: viewFish.filter(f => f.sex === 'F').length, M: viewFish.filter(f => f.sex === 'M').length };
  // Batch selection only ever acts on living fish visible in the current collection view.
  const batch = collection.filter(f => f.status === 'living' && batchIds.includes(f.id));
  const batchTotal = batch.reduce((sum, f) => sum + quote(f), 0);

  useEffect(() => { setBatchIds([]); setBatchReview(false); setLastBatchId(null); }, [tank.id, showArchived, sexFilter]);

  function run(command: Command, message: string): World | null {
    try {
      const next = applyCommand(world, command);
      setWorld(next);
      if (!next.fish.some(f => f.id === motherId && f.status === 'living')) setMotherId(next.fish.find(f => f.sex === 'F' && f.status === 'living')?.id ?? '');
      if (!next.fish.some(f => f.id === fatherId && f.status === 'living')) setFatherId(next.fish.find(f => f.sex === 'M' && f.status === 'living')?.id ?? '');
      setNotice(message);
      return next;
    }
    catch (error) { setNotice(error instanceof Error ? error.message : 'The action could not be completed.'); return null; }
  }

  function select(id: string) {
    const target = world.fish.find(f => f.id === id);
    if (!target) return;
    setSelectedId(id); setSaleId(null);
    if (target.status === 'living') { setTankId(target.tankId); setShowArchived(false); }
  }

  function breed() {
    const next = run({ type: 'breed', motherId, fatherId, tankId: tank.id, timestamp: new Date().toISOString() }, `${COHORT_SIZE} offspring born. Every fish inherited one recombined copy from each parent.`);
    if (next) { setSelectedId(next.fish[next.fish.length - COHORT_SIZE].id); setShowArchived(false); setQuery(''); }
  }

  /** Shift-click extends the last toggle across the visible collection, matching the new checked state. */
  function toggleBatch(id: string, extend: boolean) {
    const visible = collection.filter(f => f.status === 'living').map(f => f.id);
    const checked = !batchIds.includes(id);
    let affected = [id];
    if (extend && lastBatchId && visible.includes(lastBatchId)) {
      const [from, to] = [visible.indexOf(lastBatchId), visible.indexOf(id)].sort((a, b) => a - b);
      affected = visible.slice(from, to + 1);
    }
    setBatchIds(checked ? [...new Set([...batchIds, ...affected])] : batchIds.filter(existing => !affected.includes(existing)));
    setLastBatchId(id); setBatchReview(false);
  }

  function sellBatch() {
    const count = batch.length, total = batchTotal;
    if (run({ type: 'sell-batch', fishIds: batch.map(f => f.id) }, `${count} fish sold to the local NPC for ◈ ${total.toLocaleString()}. Their archived profiles remain in the family tree.`)) {
      setBatchIds([]); setBatchReview(false); setSaleId(null);
    }
  }

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#"><img src="/favicon.svg" alt="" /><span>fishtank<span className="brand-light"> sim</span></span></a>
      <div className="project-label">GENETICS LAB <span>0.1</span></div>
      <div className="top-actions"><span className="credits">◈ {world.credits.toLocaleString()} <small>lab credits</small></span><button className="quiet" onClick={() => setView(current => current === 'aquarium' ? 'fixtures' : 'aquarium')}>{view === 'aquarium' ? 'Visual fixtures' : 'Aquarium'}</button><button className="quiet" onClick={() => download(world)}>Export save</button></div>
    </header>
    {view === 'fixtures' ? <VisualFixtureLab onClose={() => setView('aquarium')} /> : <div className="workspace">
      <aside className="tank-sidebar">
        <div className="eyebrow">YOUR AQUARIUMS</div>
        <nav aria-label="Aquariums">{world.tanks.map((t, i) => <button key={t.id} className={`tank-link ${t.id === tank.id ? 'active' : ''}`} onClick={() => { setTankId(t.id); setShowArchived(false); setQuery(''); }}>
          <span className="tank-number">0{i + 1}</span><span>{t.name}<small>{living.filter(f => f.tankId === t.id).length} / {t.capacity} fish</small></span>
        </button>)}</nav>
        <button className="add-tank quiet" onClick={() => run({ type: 'add-tank' }, 'A new lab tank is ready.')}>＋ Add lab tank</button>
        <div className="sidebar-note"><span className="eyebrow">A LINEAGE STARTS HERE</span><p>Small differences.<br />Extraordinary descendants.</p><span>48 loci · 8 chromosomes<br />One fish at a time.</span></div>
        <div className="save-state">{saveError ? 'Session not saved' : 'Saved on this device'}</div>
      </aside>
      <main>
        {saveError ? <p className="warning" role="alert">{saveError}</p> : null}
        <div className="tank-heading"><div><div className="eyebrow">AQUARIUM / {String(world.tanks.indexOf(tank) + 1).padStart(2, '0')}</div><h1>{tank.name}</h1></div><span className="count-tag">{residents.length} inhabitants</span></div>
        <section className="aquarium" aria-label="Live aquarium">
          <TankCanvas fish={residents} tank={tank} selectedId={selectedId} onSelect={select} paused={paused} speed={speed} feedSignal={feedSignal} />
          <div className="tank-overlay"><span>{paused ? 'PAUSED' : 'LIVE AQUARIUM'}</span><span>{tank.planted ? 'Planted habitat' : 'Open water'}</span></div>
          {!residents.length ? <div className="empty-tank">A little room to evolve.<small>Move a fish here or introduce unrelated stock.</small></div> : null}
          <div className="tank-controls"><div><button aria-label={paused ? 'Resume aquarium' : 'Pause aquarium'} onClick={() => setPaused(v => !v)}>{paused ? '▶' : 'Ⅱ'}</button><button onClick={() => setSpeed(v => v === 1 ? 2 : v === 2 ? 4 : 1)} aria-label={`Motion speed ${speed} times`}>{speed}×</button></div><span>Click a fish to inspect</span><button className="feed-button" onClick={() => { setFeedSignal(v => v + 1); setNotice('Food draws fish toward the surface. Feeding is a behavior demo; care and growth arrive in a later milestone.'); }}>＋ Feed</button></div>
        </section>
        <div className="habitat-toolbar"><span>Laboratory mode · offspring show adult genetic potential</span><button className="quiet" onClick={() => run({ type: 'decorate', tankId: tank.id }, 'Habitat appearance updated. Decoration effects are planned for the care simulation.')}>{tank.planted ? 'Remove plants' : 'Add plants'}</button></div>
        <section className="breeding-panel" aria-labelledby="breeding-title">
          <div className="breed-intro"><div className="eyebrow">THE NEXT GENERATION</div><h2 id="breeding-title">What will they inherit?</h2><p>Choose two parents. Discover twenty possibilities.</p></div>
          <div className="parent-pickers"><label><span className="picker-label">Mother <SexMark sex="F" decorative /></span><select value={motherId} onChange={e => setMotherId(e.target.value)}><option value="">Select female</option>{living.filter(f => f.sex === 'F').map(f => <option key={f.id} value={f.id}>♀ {f.name} · G{f.generation}</option>)}</select></label><span className="cross">×</span><label><span className="picker-label">Father <SexMark sex="M" decorative /></span><select value={fatherId} onChange={e => setFatherId(e.target.value)}><option value="">Select male</option>{living.filter(f => f.sex === 'M').map(f => <option key={f.id} value={f.id}>♂ {f.name} · G{f.generation}</option>)}</select></label></div>
          <div className="breed-action"><button className="primary" onClick={breed} disabled={!living.some(f => f.id === motherId) || !living.some(f => f.id === fatherId)}>Breed 20 offspring <span>↗</span></button><small>Expected pedigree F: {percent(prospectiveF)}</small></div>
          <p className="lab-note">Accelerated experiment: no maturity wait or courtship. Parents may be in different lab tanks. Births use the current tank’s free places.</p>
        </section>
        <div className="status-line" role="status" aria-live="polite">{notice}</div>
        <section className="collection" aria-labelledby="collection-title">
          <div className="collection-heading"><h2 id="collection-title">{showArchived ? 'Archived fish' : 'Your collection'} <span>{collection.length}</span></h2><button className="quiet" onClick={() => { setShowArchived(v => !v); setQuery(''); }}>{showArchived ? 'Show residents' : 'View archive'}</button></div>
          <div className="collection-toolbar"><input aria-label="Search fish" placeholder="Search by name or ID…" value={query} onChange={e => setQuery(e.target.value)} /><button onClick={() => {
            const next = run({ type: 'buy', tankId: tank.id, timestamp: new Date().toISOString() }, 'Unrelated founder stock introduced. This is a local NPC purchase.');
            if (next) { setSelectedId(next.fish.at(-1)!.id); setShowArchived(false); setQuery(''); }
          }}>＋ Unrelated stock <span>◈ {STOCK_PRICE}</span></button></div>
          <div className="sex-filter" role="group" aria-label="Show fish by sex">
            {(['all', 'F', 'M'] as const).map(value => <button key={value} aria-pressed={sexFilter === value} onClick={() => setSexFilter(value)}>
              {value === 'all' ? 'All' : <><SexMark sex={value} decorative />{value === 'F' ? 'Females' : 'Males'}</>}<span className="filter-count">{sexCounts[value]}</span>
            </button>)}
          </div>
          {!showArchived && collection.length ? <div className="batch-bar" role="group" aria-label="Batch selection">
            <span className="batch-summary">{batch.length ? <><strong>{batch.length}</strong> selected · ◈ {batchTotal.toLocaleString()}</> : 'Tick fish to sell several at once. Shift-click a second box to select a range.'}</span>
            <div className="batch-actions">
              <button className="quiet" onClick={() => { setBatchIds(collection.map(f => f.id)); setBatchReview(false); }}>Select all {collection.length}</button>
              {batch.length ? <button className="quiet" onClick={() => { setBatchIds([]); setBatchReview(false); }}>Clear</button> : null}
              {batch.length ? <button className="batch-sell" aria-expanded={batchReview} aria-controls="batch-review" onClick={() => setBatchReview(true)}>Review sale of {batch.length}</button> : null}
            </div>
          </div> : null}
          {batchReview && batch.length ? <div className="batch-review" id="batch-review" role="region" aria-labelledby="batch-review-title">
            <h3 id="batch-review-title">Sell {batch.length} fish to the local NPC for ◈ {batchTotal.toLocaleString()}?</h3>
            <p>Their genomes and family links stay in the archive. Sold fish cannot breed, move or be sold again.</p>
            <ul>{batch.map(f => <li key={f.id}><SexMark sex={f.sex} /><span>{f.name}<small>{f.id} · G{f.generation}</small></span><span>◈ {quote(f)}</span></li>)}</ul>
            <div className="batch-review-actions"><button className="confirm" onClick={sellBatch}>Confirm sale of {batch.length}</button><button className="quiet" onClick={() => setBatchReview(false)}>Cancel</button></div>
          </div> : null}
          <div className="fish-grid">{collection.map(f => {
            const inBatch = batch.some(member => member.id === f.id);
            return <article className={`fish-card ${f.id === selectedId ? 'selected' : ''} ${inBatch ? 'batched' : ''}`} key={f.id}>
              <button className="fish-card-main" aria-pressed={f.id === selectedId} onClick={() => select(f.id)}>
                <div className="fish-card-top"><span>G{f.generation}</span><SexMark sex={f.sex} /></div><FishPortrait fish={f} /><div className="fish-card-bottom"><strong>{f.name}</strong><small>{f.status === 'sold' ? 'Archived' : `${express(f.genome).adultLengthCm.toFixed(0)} cm potential`}</small></div>
              </button>
              {f.status === 'living' ? <label className="batch-check"><input type="checkbox" checked={inBatch} aria-label={`Select ${f.name} for batch sale`}
                onChange={event => toggleBatch(f.id, (event.nativeEvent as MouseEvent).shiftKey === true)} /><span aria-hidden="true">{inBatch ? 'Selected' : 'Select'}</span></label> : null}
            </article>;
          })}</div>
          {!collection.length ? <p className="empty-copy">No fish here match this view.</p> : null}
        </section>
      </main>
      <aside className="inspector" aria-label="Fish inspector">
        {fish && p ? <>
          <div className="inspector-heading"><span className="eyebrow">SPECIMEN {fish.id.slice(4)}</span><span className="generation">G{fish.generation}</span></div>
          <div className="hero-portrait"><FishPortrait fish={fish} large /><span>{fish.status === 'sold' ? 'ARCHIVED SPECIMEN' : 'ADULT GENETIC PREVIEW'}</span></div>
          <div className="fish-title"><h2>{fish.name}</h2><SexMark sex={fish.sex} withLabel /></div>
          <p className="fish-subtitle">Koi ancestry · {fish.parents ? 'Bred in your aquarium' : 'Founder stock'}</p>
          <div className="inspector-tabs" role="group" aria-label="Inspector views">{(['Overview', 'Genome', 'Family'] as const).map(t => <button key={t} aria-pressed={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>
          {tab === 'Overview' ? <>
            <form className="rename-form" key={fish.id} onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); run({ type: 'rename', fishId: fish.id, name: String(data.get('name')) }, 'Fish name updated.'); }}><label>Given name<input name="name" aria-label="Given name" defaultValue={fish.name} maxLength={32} required disabled={fish.status !== 'living'} /></label><button disabled={fish.status !== 'living'}>Save</button></form>
            <dl className="facts"><div><dt>Born in the lab</dt><dd>{date(fish.bornAt)}</dd></div><div><dt>Adult length potential</dt><dd>{p.adultLengthCm.toFixed(1)} cm</dd></div><div><dt>Lab sale quote</dt><dd>◈ {quote(fish)}</dd></div><div><dt>Heterozygous loci</dt><dd>{percent(heterozygosity(fish.genome))}</dd></div><div><dt>Pedigree inbreeding F</dt><dd>{percent(currentF)}</dd></div><div><dt>New mutations at birth</dt><dd>{fish.mutations.length}</dd></div></dl>
            <div className="trait-block"><div className="eyebrow">INHERITED TENDENCIES</div>{[['Sociability', p.social], ['Boldness', p.bold], ['Activity', p.activity], ['Curiosity', p.curious]].map(([name, value]) => <div className="trait" key={name}><span>{name}</span><meter min="0" max="1" value={Number(value)} aria-label={String(name)} /><span>{Math.round(Number(value) * 100)}</span></div>)}</div>
            {fish.status === 'living' ? <div className="fish-actions"><label>Move to aquarium<select aria-label="Move to aquarium" value={fish.tankId} onChange={event => {
              if (run({ type: 'move', fishId: fish.id, tankId: event.target.value }, `${fish.name} moved to another aquarium.`)) setTankId(event.target.value);
            }}>{world.tanks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label><button onClick={() => { if (fish.sex === 'F') setMotherId(fish.id); else setFatherId(fish.id); setNotice(`${fish.name} selected as ${fish.sex === 'F' ? 'mother' : 'father'}.`); }}>Select as {fish.sex === 'F' ? 'mother' : 'father'}</button>
              {saleId === fish.id ? <div className="sale-confirm"><p>Sell {fish.name} to the local NPC for ◈ {quote(fish)}? Their family record remains available.</p><button onClick={() => { run({ type: 'sell', fishId: fish.id }, `${fish.name} sold. The archived profile remains in the family tree.`); setSaleId(null); }}>Confirm sale</button><button className="quiet" onClick={() => setSaleId(null)}>Cancel</button></div> : <button className="quiet sell" onClick={() => setSaleId(fish.id)}>Sell to local NPC · ◈ {quote(fish)}</button>}
            </div> : <p className="archive-note">This fish was sold to the local NPC. Its genome and family links are preserved.</p>}
          </> : null}
          {tab === 'Genome' ? <div className="genome-view"><div className="genome-fingerprint"><span>Genome checksum</span><code>{fingerprint(fish.genome)}</code></div><p className="help-copy">Two phased copies per locus. A0–A5 are allele IDs. Most blend; A5/A5 at the metallic switch expresses strong metallic color.</p>{CHROMOSOMES.map((chromosome, chromosomeIndex) => <div className="chromosome" key={chromosome}><h3>{String(chromosomeIndex + 1).padStart(2, '0')} / {chromosome}</h3>{LOCI.slice(chromosomeIndex * 6, chromosomeIndex * 6 + 6).map((locus, j) => {
            const i = chromosomeIndex * 6 + j, mutation = fish.mutations.some(m => m.locus === i);
            return <div className={`locus ${mutation ? 'mutated' : ''}`} key={locus}><span>{label(locus)}{mutation ? ' *' : ''}</span><code>A{fish.genome.maternal[i]}</code><code>A{fish.genome.paternal[i]}</code></div>;
          })}</div>)}<p className="help-copy">* A new mutation in this fish. No global rarity is measured in this offline lab.</p><div className="marking-blocks"><h3>Inherited marking blocks</h3><p className="help-copy">Each pair of neighbouring Pigments or Pattern loci on one chromosome copy places one marking. Siblings that inherit the same copy share it; a crossover or mutation inside the pair moves it.</p><ol>{p.markings.map((anchor, index) => {
            const visible = (anchor.layer === 'dark' ? p.black : p.red) * (1 - p.translucency) >= MARKING_VISIBLE_ALPHA, drawn = index < p.frequency;
            return <li key={anchor.key} className={drawn && visible ? '' : 'muted'}><span className={`marking-swatch ${anchor.layer}`} aria-hidden="true" /><span>{MARKING_BLOCKS[anchor.block].label}<small>A{anchor.alleles[0]}·A{anchor.alleles[1]} · {anchor.origin === 'both' ? 'on both copies (bolder)' : anchor.origin === 'maternal' ? 'copy from mother' : 'copy from father'}</small></span><span>{anchor.layer === 'dark' ? 'Dark' : 'Warm'}{!drawn ? ' · not drawn' : !visible ? ' · too faint' : ''}</span></li>;
          })}</ol></div></div> : null}
          {tab === 'Family' ? <div className="family-view"><p className="help-copy">Select any relative to inspect them. Living fish bring their aquarium into view; sold fish retain an archived profile.</p><h3>Parents</h3>{fish.parents ? fish.parents.map(id => <Relative key={id} fish={world.fish.find(f => f.id === id)!} onSelect={select} />) : <p className="empty-copy">Founder · no recorded parents.</p>}<div className="family-self">{fish.name}<small>Generation {fish.generation}</small></div><h3>Offspring</h3>{world.fish.filter(f => f.parents?.includes(fish.id)).map(child => <Relative key={child.id} fish={child} onSelect={select} />)}{!world.fish.some(f => f.parents?.includes(fish.id)) ? <p className="empty-copy">Their story is just beginning.</p> : null}<p className="help-copy">Pedigree F uses recorded ancestry and assumes unrelated founders. It is different from heterozygosity.</p></div> : null}
        </> : <p className="empty-copy">Select a fish from the aquarium or collection.</p>}
      </aside>
    </div>}
    <footer>Fishtank Sim <span>Research prototype · synthetic genetics · local saves · unbalanced lab economy</span><a href="https://github.com/ElMariones/fishtank-sim" target="_blank" rel="noreferrer">Project repository ↗</a></footer>
  </div>;
}

/** Colour-coded sex symbol (pink ♀, blue ♂). The text label keeps it readable without colour or sight. */
function SexMark({ sex, withLabel = false, decorative = false }: { sex: Fish['sex']; withLabel?: boolean; decorative?: boolean }) {
  const female = sex === 'F', text = female ? 'Female' : 'Male';
  return <span className={`sex-mark ${female ? 'female' : 'male'}`} aria-hidden={decorative || undefined}>
    <span className="sex-symbol" aria-hidden="true">{female ? '♀' : '♂'}</span>
    {withLabel ? <span className="sex-label">{text}</span> : decorative ? null : <span className="visually-hidden">{text}</span>}
  </span>;
}

function Relative({ fish, onSelect }: { fish: Fish; onSelect: (id: string) => void }) {
  return <button className="relative" onClick={() => onSelect(fish.id)}><FishPortrait fish={fish} /><span><strong>{fish.name}</strong><small>G{fish.generation} · <SexMark sex={fish.sex} withLabel />{fish.status === 'sold' ? ' · Sold' : ''}</small></span><span>↗</span></button>;
}
