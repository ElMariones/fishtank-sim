import { useState } from 'react';
import { genotypeVisible, SEQUENCE_COST } from '../core/atlas';
import { daysToMaturity } from '../core/breeding';
import { express } from '../core/genetics';
import { alleleCarriers, alleleEffectText, alleleName, carriedAlleles, FINS_TEXT, loadView } from '../core/genesisView';
import type { Fish, World } from '../core/types';
import type { Command } from '../core/world';
import { Icon } from './Icon';

type Run = (command: Command, message: string) => World | null;
const pct = (value: number) => `${Math.round(value * 100)}%`;

/**
 * Inspector section for Genesis animals (koi genome v4, axolotl genome v2): what development made of the genome, how
 * temperament and life history act in the tank, visible and hidden genetic load, and the open-ended alleles it carries.
 * Older genomes get a one-line note instead.
 */
export function GenesisPanel({ world, fish, readOnly, onRun }: { world: World; fish: Fish; readOnly: boolean; onRun: Run }) {
  const [renaming, setRenaming] = useState<number | null>(null), [draft, setDraft] = useState('');
  const p = express(fish.genome), g = p.genesis;
  if (!g) return <div className="trait-block genesis-block legacy"><div className="block-title"><Icon name="dna" size={15} /><span className="eyebrow">Genesis development</span></div>
    <p className="help-copy">This animal predates Genesis genetics (koi genome v4, axolotl genome v2): it has no development chromosome, open-ended alleles or recorded load. Bred to a Genesis partner, its offspring inherit Genesis rules and a latent load read from its genome.</p></div>;
  const species = fish.species, load = loadView(world, fish), alleles = carriedAlleles(world, fish), known = genotypeVisible(world, fish);
  const waiting = fish.status === 'living' ? daysToMaturity(fish) : 0, sequenced = world.atlas.sequenced.includes(fish.id);
  const shareVsTypical = g.competitiveness / 0.6;
  const features = [
    FINS_TEXT[species][g.fins],
    g.ghost >= 0.99 ? 'Ghost: pigment cascade silenced' : g.ghost > 0 ? 'Faded: weak pigment cascade' : null,
    g.glow > 0 ? `${species === 'koi' ? 'Photophores' : 'Fluorescent'} · glow ${pct(g.glow)}` : null,
    species === 'goldfish' && p.goldfish?.health.buoyancy ? 'Weak swim bladder: floats head-down' : null,
    species === 'goldfish' && p.goldfish?.health.vision ? `Vision limited ${pct(p.goldfish.health.vision)}: protruding eyes, bubble sacs or an overgrown hood find less food` : null,
    g.plume ? 'Plume gills (two recessive copies)' : null,
    g.extraDigits ? `${g.extraDigits} extra digit${g.extraDigits === 1 ? '' : 's'} per foot (threshold trait)` : null,
    g.hueShift ? `Hue shifted ${g.hueShift > 0 ? '+' : ''}${Math.round(g.hueShift)}° by new alleles` : null,
  ].filter((value): value is string => Boolean(value));
  return <div className="trait-block genesis-block">
    <div className="block-title"><Icon name="dna" size={15} /><span className="eyebrow">Genesis development</span></div>
    <ul className="genesis-features">{features.map(feature => <li key={feature}>{feature}</li>)}</ul>
    <dl className="appearance-traits genesis-life">
      <div><dt>Maturity</dt><dd>Ready to court {g.maturityDays} days after hatching{waiting > 0 ? ` · ${waiting} to go` : fish.status === 'living' ? ' · mature' : ''}</dd></div>
      <div><dt>Food competition</dt><dd>Wins {pct(Math.min(2, shareVsTypical))} of a typical share when food is short<small>boldness, activity and appetite against long fins</small></dd></div>
      <div><dt>Clutch size</dt><dd>{pct(g.clutchFactor)} of the reserved places<small>fertility, vigor and load</small></dd></div>
      <div><dt>Hybrid vigor</dt><dd>{g.vigor.toFixed(2)}× growth and fertility<small>{pct(g.heterozygosity)} of loci heterozygous; inbreeding lowers it, outcrossing restores it</small></dd></div>
      <div><dt>Regeneration</dt><dd>{pct(g.regeneration)} · recovers condition {g.regeneration >= 0.5 ? 'quickly' : 'slowly'}{g.regeneration >= 0.72 ? `; regrows ${species === 'axolotl' ? 'missing digits' : 'eroded fins'}` : ''}</dd></div>
      <div><dt>Canalization</dt><dd>{pct(g.canalization)} · {g.asymmetry > 0.05 ? 'visibly asymmetric' : g.asymmetry > 0.03 ? 'slightly irregular' : 'tightly symmetric'}<small>low canalization adds noise and lets defects show more strongly</small></dd></div>
      {g.conditionCap < 1 ? <div><dt>Constitution</dt><dd>Condition cannot rise above {pct(g.conditionCap)}</dd></div> : null}
    </dl>
    <div className="genesis-load">
      <h4>Genetic load</h4>
      {load.expressed.length ? <ul className="defect-list">{load.expressed.map(site => {
        const rescued = g.defects.find(defect => defect.site === site.id)?.rescued;
        return <li key={site.id} className={rescued ? 'rescued' : ''}><b>{site.code} {site.label}</b><small>{rescued ? 'Regrown by strong regeneration. ' : ''}{site.text}</small></li>;
      })}</ul> : <p className="help-copy">No defect expressed: it is not homozygous for any recessive it carries.</p>}
      {known ? load.carried.length
        ? <p className="help-copy">Hidden carrier of {load.carried.map(site => `${site.code} ${site.label}`).join(', ')}. Half its offspring receive each; pairing it with another carrier risks affected young.</p>
        : <p className="help-copy">Sequenced: carries no hidden recessive.</p>
        : <p className="help-copy">Hidden load is unknown. Every animal may carry recessives that only show when inbreeding pairs two copies.</p>}
      {!known && fish.status === 'living' ? <button className="quiet sequence-button" disabled={readOnly || world.credits < SEQUENCE_COST}
        onClick={() => onRun({ type: 'sequence-fish', fishId: fish.id }, `${fish.name} sequenced: its genotype and hidden load are now visible.`)}>
        <Icon name="dna" size={14} />Sequence {fish.name} · ◈ {SEQUENCE_COST}</button> : null}
      {sequenced ? <p className="help-copy">Sequenced. Its clutches count double toward the Genome Atlas.</p> : null}
    </div>
    <div className="genesis-alleles">
      <h4>New alleles carried ({alleles.length})</h4>
      {alleles.length ? <ul className="allele-list">{alleles.map(allele => {
        const carriers = allele.record ? alleleCarriers(world, allele.record) : null;
        return <li key={allele.definition.id}>
          {renaming === allele.definition.id && allele.record
            ? <form className="allele-rename" onSubmit={event => { event.preventDefault(); if (onRun({ type: 'name-allele', alleleId: allele.definition.id, name: draft }, `Allele named ${draft.trim()}.`)) setRenaming(null); }}>
              <input aria-label="Allele name" value={draft} maxLength={32} autoFocus onChange={event => setDraft(event.target.value)} /><button disabled={!draft.trim()}>Save</button><button type="button" className="quiet" onClick={() => setRenaming(null)}>Cancel</button></form>
            : <b>{alleleName(allele)}{allele.record && !allele.record.named ? <small> (named after the fish where it arose)</small> : null}</b>}
          <small>{allele.copies === 2 ? 'Two copies' : 'One copy'} at {allele.locusLabel}{allele.arose ? ' · arose in this animal' : ''}</small>
          <small>{alleleEffectText(allele.definition, species)}</small>
          {carriers ? <small>{carriers.living} living carrier{carriers.living === 1 ? '' : 's'} in this world{carriers.homozygous ? `, ${carriers.homozygous} with two copies` : ''}</small> : null}
          {allele.record && renaming !== allele.definition.id && !readOnly ? <button className="link-button" onClick={() => { setRenaming(allele.definition.id); setDraft(allele.record!.name); }}>Rename allele</button> : null}
        </li>;
      })}</ul> : <p className="help-copy">Only catalog alleles. A new allele can arise in any birth; it is named after the fish it arose in, and you can rename it.</p>}
    </div>
  </div>;
}
