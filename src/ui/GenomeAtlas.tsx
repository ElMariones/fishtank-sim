import { useMemo, useState } from 'react';
import {
  alleleLocusLabel, atlasLoci, atlasProgress, dominanceText, locusStage, mapDistance, MAP_MEIOSES, SEQUENCE_COST, STAGE_EVIDENCE, STAGE_LABELS,
} from '../core/atlas';
import { AXOLOTL_DEV_NOTES, AXOLOTL_LOCUS_NOTES, type AxolotlDevLocus, type AxolotlLocus } from '../core/axolotlCatalog';
import { loadCatalog } from '../core/genesis';
import { alleleCarriers } from '../core/genesisView';
import { KOI_LOCUS_NOTES } from '../core/locusNotes';
import type { GenomeLocus } from '../core/catalog';
import type { Species, World } from '../core/types';
import type { Command } from '../core/world';
import { Icon } from './Icon';

type Run = (command: Command, message: string) => World | null;
const note = (species: Species, id: string) => species === 'koi' ? KOI_LOCUS_NOTES[id as GenomeLocus]
  : AXOLOTL_LOCUS_NOTES[id as AxolotlLocus] ?? AXOLOTL_DEV_NOTES[id as AxolotlDevLocus] ?? '';

/**
 * Genome Atlas view (world v16). Discovery mode hides what each locus does until breeding reveals it; scientist mode shows
 * everything. The atlas also holds the defect notebook and the named-allele registry.
 */
export function GenomeAtlas({ world, readOnly, onRun, onInspect }: { world: World; readOnly: boolean; onRun: Run; onInspect: (id: string) => void }) {
  const [species, setSpecies] = useState<Species>('koi'), [renaming, setRenaming] = useState<number | null>(null), [draft, setDraft] = useState('');
  const loci = atlasLoci(species), progress = atlasProgress(world, species), knowledge = world.atlas[species];
  const discovery = world.atlas.mode === 'discovery';
  const chromosomes = useMemo(() => [...new Set(loci.map(locus => locus.chromosome))].map(number => ({ number, loci: loci.filter(locus => locus.chromosome === number) })), [loci]);
  const records = world.alleles.filter(record => record.species === species);
  const byId = new Map(world.fish.map(fish => [fish.id, fish]));
  const defects = loadCatalog(species).filter(site => knowledge.defects.includes(site.id));
  return <div className="atlas-view">
    <header className="atlas-header">
      <div>
        <p className="eyebrow">Genome Atlas · {discovery ? 'discovery mode' : 'scientist mode'}</p>
        <h2>What you know about the {species === 'koi' ? 'koi' : 'axolotl'} genome</h2>
        <p className="help-copy">{discovery
          ? 'Loci start unidentified. Breed animals that carry two different alleles at a locus and the clutch shows it segregating: enough evidence identifies the trait, more reveals how its copies combine, and clutches from parents heterozygous at two neighbouring loci measure how often they recombine, placing them on the chromosome map. Sequencing an animal reveals its genotype and hidden load, and doubles what its clutches teach.'
          : 'Every locus, genotype and hidden carrier is shown, as in a research lab. Evidence and linkage are still recorded from your clutches.'}</p>
      </div>
      <div className="atlas-controls">
        <div className="segmented" role="group" aria-label="Species">
          {(['koi', 'axolotl'] as const).map(value => <button key={value} aria-pressed={species === value} onClick={() => setSpecies(value)}>{value === 'koi' ? 'Koi' : 'Axolotl'}</button>)}
        </div>
        <button className="quiet" disabled={readOnly} onClick={() => onRun({ type: 'set-atlas-mode', mode: discovery ? 'scientist' : 'discovery' }, discovery ? 'Scientist mode: every locus is shown.' : 'Discovery mode: only what you have learned is shown.')}>
          <Icon name={discovery ? 'eye' : 'search'} size={15} />{discovery ? 'Switch to scientist mode' : 'Switch to discovery mode'}</button>
      </div>
    </header>
    <div className="atlas-progress" role="group" aria-label="Atlas progress">
      {([['Identified', progress.identified], ['Inheritance known', progress.characterized], ['Mapped', progress.mapped]] as const).map(([label, value]) =>
        <div key={label} className="atlas-stat"><small>{label}</small><b className="mono">{value}/{progress.total}</b><span className="bar gene"><span style={{ width: `${Math.round(value / progress.total * 100)}%` }} /></span></div>)}
      <div className="atlas-stat"><small>Sequenced animals</small><b className="mono">{world.atlas.sequenced.filter(id => byId.get(id)?.species === species).length}</b><small>◈ {SEQUENCE_COST} each, from the inspector</small></div>
    </div>
    <div className="atlas-chromosomes">{chromosomes.map(({ number, loci: members }) => <section className="atlas-chromosome" key={number}>
      <h3><span className="chromosome-index mono">{String(number).padStart(2, '0')}</span>{locusStage(world, species, members[0].index) >= 3 || !discovery ? members[0].chromosomeLabel : 'Chromosome'}</h3>
      <ol>{members.map((locus, offset) => {
        const stage = locusStage(world, species, locus.index), next = stage < 2 ? STAGE_EVIDENCE[stage + 1] : null, evidence = knowledge.evidence[locus.index];
        const link = offset < members.length - 1 ? mapDistance(world.atlas, species, locus.index) : null;
        return <li key={locus.id} className={`atlas-locus stage-${stage}`}>
          <span className="stage-dot" title={STAGE_LABELS[stage]} aria-hidden="true" />
          <span className="atlas-locus-name">{stage >= 1 ? locus.label : `Locus ${number}.${offset + 1}`}<small>{stage >= 1 ? note(species, locus.id) : 'Unidentified: breed parents that differ here.'}</small>
            {stage >= 2 ? <small className="dominance">{dominanceText(locus)}</small> : null}</span>
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
    <section className="atlas-alleles" aria-labelledby="atlas-alleles-title">
      <h3 id="atlas-alleles-title">New alleles that arose in this world ({records.length})</h3>
      {records.length ? <ul className="allele-list">{records.slice().reverse().slice(0, 200).map(record => {
        const origin = byId.get(record.origin), carriers = alleleCarriers(world, record), locusKnown = locusStage(world, species, record.locus) >= 1;
        return <li key={record.id}>
          {renaming === record.id
            ? <form className="allele-rename" onSubmit={event => { event.preventDefault(); if (onRun({ type: 'name-allele', alleleId: record.id, name: draft }, `Allele named ${draft.trim()}.`)) setRenaming(null); }}>
              <input aria-label="Allele name" value={draft} maxLength={32} autoFocus onChange={event => setDraft(event.target.value)} /><button disabled={!draft.trim()}>Save</button><button type="button" className="quiet" onClick={() => setRenaming(null)}>Cancel</button></form>
            : <b>{record.name}{record.named ? null : <small> (named after its first carrier)</small>}</b>}
          <small>At {locusKnown ? alleleLocusLabel(record) : `an unidentified locus`} · arose in {origin ? <button className="link-button" onClick={() => onInspect(origin.id)}>{origin.name}</button> : record.origin}</small>
          <small>{carriers.living ? `${carriers.living} living carrier${carriers.living === 1 ? '' : 's'}${carriers.homozygous ? `, ${carriers.homozygous} homozygous` : ''}` : 'No living carrier: lost from the aquarium'}</small>
          {renaming !== record.id && !readOnly ? <button className="link-button" onClick={() => { setRenaming(record.id); setDraft(record.name); }}>Rename</button> : null}
        </li>;
      })}</ul> : <p className="help-copy">No new allele yet. Each Genesis birth has a small chance of one; it starts named after the animal it arose in.</p>}
    </section>
  </div>;
}
