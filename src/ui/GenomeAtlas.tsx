import { useMemo, useState } from 'react';
import { KIND_LABELS, KIND_TEXT, registryRows, sortedRows, type RegistryFilter, type RegistrySort } from '../core/alleleRegistry';
import {
  atlasLoci, atlasProgress, dominanceText, isModuleLocus, locusStage, mapDistance, MAP_MEIOSES, SEQUENCE_COST, STAGE_EVIDENCE, STAGE_LABELS,
} from '../core/atlas';
import { AXOLOTL_DEV_NOTES, AXOLOTL_LOCUS_NOTES, type AxolotlDevLocus, type AxolotlLocus } from '../core/axolotlCatalog';
import { CODEX_TIER_LABELS, codexFor, codexProgress, type CodexTier } from '../core/codex';
import { CHANNEL_LABELS, loadCatalog, type Channel } from '../core/genesis';
import { KOI_LOCUS_NOTES } from '../core/locusNotes';
import { moduleLoci } from '../core/modules';
import { families, familyRatios } from '../core/segregation';
import type { GenomeLocus } from '../core/catalog';
import type { Species, World } from '../core/types';
import { GOLDFISH_LOCUS_NOTES, type GoldfishLocus } from '../core/goldfishCatalog';
import { SPECIES_INFO } from '../core/species';
import type { Command } from '../core/world';
import { FishPortrait } from './FishPortrait';
import { Icon } from './Icon';

type Run = (command: Command, message: string) => World | null;
type Tab = 'chromosomes' | 'registry' | 'codex' | 'ratios';
const TABS: [Tab, string][] = [['chromosomes', 'Chromosomes'], ['registry', 'Allele registry'], ['codex', 'Codex'], ['ratios', 'Clutch ratios']];
const note = (species: Species, id: string) => id.startsWith('module:') ? moduleLoci(species).find(locus => `module:${locus.id}` === id)?.note ?? ''
  : species === 'koi' ? KOI_LOCUS_NOTES[id as GenomeLocus]
  : species === 'goldfish' ? GOLDFISH_LOCUS_NOTES[id as GoldfishLocus] ?? ''
  : AXOLOTL_LOCUS_NOTES[id as AxolotlLocus] ?? AXOLOTL_DEV_NOTES[id as AxolotlDevLocus] ?? '';
const TIER_CLASS: Record<CodexTier, string> = { 1: 'uncommon', 2: 'rare', 3: 'epic', 4: 'legendary' };
const percent = (value: number) => `${(value * 100).toFixed(value < 0.1 ? 1 : 0)}%`;

/**
 * Genome Atlas view (world v16, extended in v18). Discovery mode hides what each locus does until breeding reveals it;
 * scientist mode shows everything. Tabs hold the chromosome map with the defect notebook, the Allele Registry with
 * lineage (R-201), the Codex of named phenotypes (R-202) and clutch ratio analysis for testing hypotheses.
 */
export function GenomeAtlas({ world, readOnly, onRun, onInspect }: { world: World; readOnly: boolean; onRun: Run; onInspect: (id: string) => void }) {
  const [species, setSpecies] = useState<Species>('koi'), [tab, setTab] = useState<Tab>('chromosomes');
  const progress = atlasProgress(world, species), discovery = world.atlas.mode === 'discovery', codex = codexProgress(world, species);
  const byId = useMemo(() => new Map(world.fish.map(fish => [fish.id, fish])), [world.fish]);
  return <div className="atlas-view">
    <header className="atlas-header">
      <div>
        <p className="eyebrow">Genome Atlas · {discovery ? 'discovery mode' : 'scientist mode'}{world.genesisModel === 2 ? ' · Genesis model 2' : ''}</p>
        <h2>What you know about the {SPECIES_INFO[species].one} genome</h2>
        <p className="help-copy">{discovery
          ? 'Loci start unidentified. Breed animals that carry two different alleles at a locus and the clutch shows it segregating: enough evidence identifies the trait, more reveals how its copies combine, and clutches from parents heterozygous at two neighbouring loci measure how often they recombine, placing them on the chromosome map. Sequencing an animal reveals its genotype and hidden load, and doubles what its clutches teach.'
          : 'Every locus, genotype and hidden carrier is shown, as in a research lab. Evidence and linkage are still recorded from your clutches.'}</p>
      </div>
      <div className="atlas-controls">
        <div className="segmented" role="group" aria-label="Species">
          {(['koi', 'goldfish', 'axolotl'] as const).map(value => <button key={value} aria-pressed={species === value} onClick={() => setSpecies(value)}>{SPECIES_INFO[value].title}</button>)}
        </div>
        <button className="quiet" disabled={readOnly} onClick={() => onRun({ type: 'set-atlas-mode', mode: discovery ? 'scientist' : 'discovery' }, discovery ? 'Scientist mode: every locus is shown.' : 'Discovery mode: only what you have learned is shown.')}>
          <Icon name={discovery ? 'eye' : 'search'} size={15} />{discovery ? 'Switch to scientist mode' : 'Switch to discovery mode'}</button>
      </div>
    </header>
    <div className="atlas-progress" role="group" aria-label="Atlas progress">
      {([['Identified', progress.identified], ['Inheritance known', progress.characterized], ['Mapped', progress.mapped]] as const).map(([label, value]) =>
        <div key={label} className="atlas-stat"><small>{label}</small><b className="mono">{value}/{progress.total}</b><span className="bar gene"><span style={{ width: `${Math.round(value / progress.total * 100)}%` }} /></span></div>)}
      <div className="atlas-stat"><small>Codex</small><b className="mono">{codex.found}/{codex.total}</b><span className="bar tide"><span style={{ width: `${Math.round(codex.found / codex.total * 100)}%` }} /></span></div>
      <div className="atlas-stat"><small>Sequenced animals</small><b className="mono">{world.atlas.sequenced.filter(id => byId.get(id)?.species === species).length}</b><small>◈ {SEQUENCE_COST} each, from the inspector</small></div>
    </div>
    <div className="segmented atlas-tabs" role="tablist" aria-label="Atlas sections">
      {TABS.map(([value, label]) => <button key={value} role="tab" aria-selected={tab === value} aria-pressed={tab === value} onClick={() => setTab(value)}>{label}</button>)}
    </div>
    {tab === 'chromosomes' ? <Chromosomes world={world} species={species} /> : null}
    {tab === 'registry' ? <Registry world={world} species={species} readOnly={readOnly} onRun={onRun} onInspect={onInspect} /> : null}
    {tab === 'codex' ? <Codex world={world} species={species} onInspect={onInspect} /> : null}
    {tab === 'ratios' ? <Ratios world={world} species={species} onInspect={onInspect} /> : null}
  </div>;
}

function Chromosomes({ world, species }: { world: World; species: Species }) {
  const loci = atlasLoci(species), knowledge = world.atlas[species], discovery = world.atlas.mode === 'discovery';
  const chromosomes = useMemo(() => [...new Set(loci.map(locus => locus.chromosome))].map(number => ({ number, loci: loci.filter(locus => locus.chromosome === number) })), [loci]);
  const defects = loadCatalog(species).filter(site => knowledge.defects.includes(site.id));
  return <>
    <div className="atlas-chromosomes">{chromosomes.map(({ number, loci: members }) => <section className={`atlas-chromosome${number === 13 ? ' body-plan-chromosome' : ''}`} key={number}>
      <h3><span className="chromosome-index mono">{String(number).padStart(2, '0')}</span>{number === 13 || locusStage(world, species, members[0].index) >= 3 || !discovery ? members[0].chromosomeLabel : 'Chromosome'}</h3>
      {number === 13 ? <p className="help-copy">Module genes for body-plan structures. Most animals carry hidden liability; a module grows only when its threshold is crossed.{world.genesisModel === 2 ? '' : ' Observed from Genesis model 2 clutches.'}</p> : null}
      <ol>{members.map((locus, offset) => {
        const stage = locusStage(world, species, locus.index), next = stage < 2 ? STAGE_EVIDENCE[stage + 1] : null, evidence = knowledge.evidence[locus.index] ?? 0;
        const link = offset < members.length - 1 && !isModuleLocus(locus.index) ? mapDistance(world.atlas, species, locus.index) : null;
        return <li key={locus.id} className={`atlas-locus stage-${stage}`}>
          <span className="stage-dot" title={STAGE_LABELS[stage]} aria-hidden="true" />
          <span className="atlas-locus-name">{stage >= 1 ? locus.label : `Locus ${number}.${offset + 1}`}<small>{stage >= 1 ? note(species, locus.id) : 'Unidentified: breed parents that differ here.'}</small>
            {stage >= 2 ? <small className="dominance">{isModuleLocus(locus.index) ? moduleRuleText(species, locus.id) : dominanceText(locus)}</small> : null}</span>
          <span className="atlas-evidence">{next !== null && discovery
            ? <><span className="bar tide"><span style={{ width: `${Math.min(100, Math.round(evidence / next * 100))}%` }} /></span><small>{STAGE_LABELS[stage]} · {Math.floor(evidence)}/{next}</small></>
            : <small>{STAGE_LABELS[stage]}</small>}
            {link ? <small className="linkage">{link.cM.toFixed(1)}% recombination to the next locus · {link.meioses} meioses{link.meioses < MAP_MEIOSES ? ' (too few to map)' : ''}</small> : null}</span>
        </li>;
      })}</ol>
    </section>)}</div>
    <section className="atlas-defects" aria-labelledby="atlas-defects-title">
      <h3 id="atlas-defects-title">Defect notebook</h3>
      {defects.length ? <ul className="defect-list">{defects.map(site => <li key={site.id}><b>{site.code} {site.label}</b><small>{site.text}</small></li>)}</ul>
        : <p className="help-copy">No defect seen yet. Hidden recessives show when inbreeding pairs two copies; eggs that never develop record lethal ones here.</p>}
    </section>
  </>;
}
const RULE_TEXT = { liability: 'Threshold trait: copies add up with a modifier and developmental noise', modifier: 'Modifier: shifts liability and the size of the structure', recessive: 'Recessive: two copies needed', dominant: 'Dominant: one copy is enough' } as const;
const moduleRuleText = (species: Species, id: string) => { const locus = moduleLoci(species).find(entry => `module:${entry.id}` === id); return locus ? RULE_TEXT[locus.rule] : ''; };

function Registry({ world, species, readOnly, onRun, onInspect }: { world: World; species: Species; readOnly: boolean; onRun: Run; onInspect: (id: string) => void }) {
  const [sort, setSort] = useState<RegistrySort>('newest'), [filter, setFilter] = useState<RegistryFilter>('all'), [query, setQuery] = useState('');
  const [renaming, setRenaming] = useState<number | null>(null), [draft, setDraft] = useState('');
  const rows = useMemo(() => registryRows(world, species), [world.alleles, world.fish, world.atlas, species]);
  const byId = new Map(world.fish.map(fish => [fish.id, fish]));
  const shown = sortedRows(rows, sort, filter).filter(row => !query.trim() || `${row.record.name} ${row.locusKnown ? row.locusLabel : ''}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 240);
  const living = rows.filter(row => row.living).length, leaps = rows.filter(row => row.kind === 'leap').length, deepest = rows.reduce((max, row) => Math.max(max, row.depth), 0);
  return <section className="atlas-alleles registry" aria-labelledby="atlas-alleles-title">
    <h3 id="atlas-alleles-title">Allele Registry · {rows.length} allele{rows.length === 1 ? '' : 's'} arose in this world</h3>
    <p className="help-copy">Every new allele exists only in this world. It is named after the animal it arose in and keeps its full lineage: the allele it mutated from and every allele derived from it. {living} still have living carriers{leaps ? `, ${leaps} are leaps` : ''}{deepest ? `, and the longest lineage is ${deepest + 1} alleles deep` : ''}.</p>
    <div className="registry-controls">
      <input type="search" aria-label="Search alleles" placeholder="Search alleles" value={query} onChange={event => setQuery(event.target.value)} />
      <div className="segmented" role="group" aria-label="Filter">{(['all', 'living', 'lost', 'leap', 'regulatory'] as RegistryFilter[]).map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === 'all' ? 'All' : value === 'living' ? 'Living' : value === 'lost' ? 'Lost' : KIND_LABELS[value]}</button>)}</div>
      <div className="segmented" role="group" aria-label="Sort">{(['newest', 'carriers', 'lineage'] as RegistrySort[]).map(value => <button key={value} aria-pressed={sort === value} onClick={() => setSort(value)}>{value === 'newest' ? 'Newest' : value === 'carriers' ? 'Most carriers' : 'Deepest lineage'}</button>)}</div>
    </div>
    {shown.length ? <ul className="allele-list registry-list">{shown.map(row => {
      const origin = byId.get(row.record.origin), effects = row.definition ? Object.entries(row.definition.effects) as [Channel, number][] : [];
      return <li key={row.record.id} className={row.living ? '' : 'lost'}>
        {renaming === row.record.id
          ? <form className="allele-rename" onSubmit={event => { event.preventDefault(); if (onRun({ type: 'name-allele', alleleId: row.record.id, name: draft }, `Allele named ${draft.trim()}.`)) setRenaming(null); }}>
            <input aria-label="Allele name" value={draft} maxLength={32} autoFocus onChange={event => setDraft(event.target.value)} /><button disabled={!draft.trim()}>Save</button><button type="button" className="quiet" onClick={() => setRenaming(null)}>Cancel</button></form>
          : <b>{row.kind ? <span className={`allele-kind ${row.kind}`} data-tip={KIND_TEXT[row.kind]}>{KIND_LABELS[row.kind]}</span> : null}{row.record.name}{row.record.named ? null : <small> (named after its first carrier)</small>}</b>}
        <small>At {row.locusKnown ? row.locusLabel : 'an unidentified locus'} · arose in {origin ? <button className="link-button" onClick={() => onInspect(origin.id)}>{origin.name}</button> : row.record.origin}</small>
        <small className="lineage">Lineage: {row.depth ? `${'↳ '.repeat(Math.min(row.depth, 4))}from ` : 'from '}{row.parent.label}{row.shift !== null ? ` · ${row.shift >= 0 ? '+' : ''}${row.shift} on its locus` : ''}{row.children.length ? ` · ${row.children.length} derived allele${row.children.length === 1 ? '' : 's'}` : ''}</small>
        {effects.length ? <small>Side effects: {effects.map(([channel, amount]) => `${amount > 0 ? '+' : '−'}${CHANNEL_LABELS[channel]}`).join(', ')}</small> : null}
        <small className="carriers">{row.living ? <>{row.living} living carrier{row.living === 1 ? '' : 's'}{row.homozygous ? `, ${row.homozygous} with two copies` : ''} · {percent(row.frequency)} of copies at its locus</> : 'No living carrier: lost from the aquarium'}</small>
        {row.living ? <span className="bar gene registry-frequency" aria-hidden="true"><span style={{ width: `${Math.max(2, Math.round(row.frequency * 100))}%` }} /></span> : null}
        {renaming !== row.record.id && !readOnly ? <button className="link-button" onClick={() => { setRenaming(row.record.id); setDraft(row.record.name); }}>Rename</button> : null}
      </li>;
    })}</ul> : <p className="help-copy">{rows.length ? 'No allele matches.' : 'No new allele yet. Each Genesis birth has a small chance of one; it starts named after the animal it arose in.'}</p>}
  </section>;
}

function Codex({ world, species, onInspect }: { world: World; species: Species; onInspect: (id: string) => void }) {
  const found = new Map(world.codex.entries.map(entry => [entry.key, entry]));
  const entries = codexFor(species), byId = new Map(world.fish.map(fish => [fish.id, fish]));
  return <section className="atlas-codex" aria-labelledby="atlas-codex-title">
    <h3 id="atlas-codex-title">Codex · {entries.filter(entry => found.has(entry.key)).length} of {entries.length} named {SPECIES_INFO[species].one} phenotypes</h3>
    <p className="help-copy">The first animal bred in this world that shows a named phenotype is credited with its discovery. Undiscovered entries show what to aim for.{world.genesisModel === 2 ? '' : ' This world runs Genesis model 1, so new discoveries are not recorded.'}</p>
    <ul className="codex-grid">{entries.map(entry => {
      const discovery = found.get(entry.key), fish = discovery ? byId.get(discovery.fishId) : undefined;
      return <li key={entry.key} className={`codex-card ${discovery ? 'found' : 'missing'} tier-${entry.tier}`}>
        <span className="codex-plate">{fish ? <FishPortrait fish={fish} view="adult" /> : <Icon name="search" size={22} />}</span>
        <span className="codex-text">
          <b>{discovery ? entry.name : 'Undiscovered'}</b>
          <span className={`rarity ${TIER_CLASS[entry.tier]}`}>{CODEX_TIER_LABELS[entry.tier]}</span>
          <small>{entry.text}</small>
          {discovery ? <small>First bred: {fish ? <button className="link-button" onClick={() => onInspect(fish.id)}>{fish.name}</button> : discovery.fishId} · day {discovery.day}</small> : null}
        </span>
      </li>;
    })}</ul>
  </section>;
}

function Ratios({ world, species, onInspect }: { world: World; species: Species; onInspect: (id: string) => void }) {
  const groups = useMemo(() => families(world.fish.filter(fish => fish.species === species)).slice(0, 12), [world.fish, species]);
  const [selected, setSelected] = useState<string | null>(null);
  const family = groups.find(group => group.key === selected) ?? groups[0];
  const ratios = useMemo(() => family ? familyRatios(family) : [], [family]);
  const byId = new Map(world.fish.map(fish => [fish.id, fish]));
  return <section className="atlas-ratios" aria-labelledby="atlas-ratios-title">
    <h3 id="atlas-ratios-title">Clutch ratios</h3>
    <p className="help-copy">Count what siblings look like and compare it with the ratios one locus can give. A clean 3 : 1 suggests both parents carry a hidden recessive; 1 : 1 is a test cross; 1 : 2 : 1 means each genotype looks different. This uses only what you can see, so it works in discovery mode. Sample sizes below about twenty fit several ratios.</p>
    {groups.length ? <>
      <div className="ratio-families" role="group" aria-label="Families">{groups.map(group => {
        const mother = byId.get(group.motherId), father = byId.get(group.fatherId);
        return <button key={group.key} aria-pressed={group.key === family?.key} onClick={() => setSelected(group.key)}>{mother?.name ?? group.motherId} × {father?.name ?? group.fatherId}<small>{group.offspring.length} young</small></button>;
      })}</div>
      {family ? <div className="ratio-table">
        <p className="help-copy">Parents: <button className="link-button" onClick={() => onInspect(family.motherId)}>{byId.get(family.motherId)?.name}</button> × <button className="link-button" onClick={() => onInspect(family.fatherId)}>{byId.get(family.fatherId)?.name}</button> · {family.offspring.length} hatched young</p>
        {ratios.length ? <ul>{ratios.map(ratio => <li key={ratio.trait.id}>
          <b>{ratio.trait.label}</b>
          <span className="ratio-counts">{ratio.counts.map(([value, count]) => <span key={value}><span className="mono">{count}</span> {value}</span>)}</span>
          {ratio.best ? <small className="ratio-fit"><span className="mono">{ratio.best.ratio}</span> fits (χ² {ratio.best.chi}). {ratio.best.text}{ratio.others.length ? ` Also consistent: ${ratio.others.map(other => other.ratio).join(', ')}.` : ''}</small>
            : <small>{ratio.counts.length > 3 ? 'More than three classes: several loci are involved.' : 'No single-locus ratio fits: more loci, linkage or a threshold trait.'}</small>}
        </li>)}</ul> : <p className="help-copy">Nothing segregates visibly in this family: every sibling looks alike for the tracked traits.</p>}
      </div> : null}
    </> : <p className="help-copy">No family with at least six hatched young yet.</p>}
  </section>;
}
