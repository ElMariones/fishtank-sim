import { useState } from 'react';
import { genotypeVisible } from '../core/atlas';
import { carriedAlleles, alleleName } from '../core/genesisView';
import { express, modulesOf } from '../core/genetics';
import { GOLDFISH_RECESSIVES } from '../core/goldfishCatalog';
import { moduleLoci } from '../core/modules';
import { RARITY_NOTE, rarityOf, tierRank, type RarityTier } from '../core/rarity';
import type { Fish, World } from '../core/types';
import { Icon } from './Icon';

export const tierClass = (tier: RarityTier) => `rarity ${tier.replace(' ', '-')}`;
export const TIER_TEXT: Record<RarityTier, string> = {
  common: 'Seen in most bred stock.', uncommon: 'Shows in about one animal in five to twelve.', rare: 'About one in fifteen to fifty.',
  'very rare': 'About one in fifty to two hundred.', epic: 'About one in two hundred to eight hundred.', legendary: 'Rarer than one in eight hundred, or never seen in reference stock.',
};

/** Hidden breeding potential the player may see: recessives carried as one copy, module liability close to its threshold, new alleles. */
function hiddenPotential(world: World, fish: Fish): string[] {
  const p = express(fish.genome), notes: string[] = [];
  if (p.goldfish?.carriers.length) notes.push(`Carries one hidden copy of ${p.goldfish.carriers.map(id => GOLDFISH_RECESSIVES[id]).join(', ')}`);
  if (p.axolotl?.pigmentation.carriers.length) notes.push(`Carries one hidden ${p.axolotl.pigmentation.carriers.join(', ')} copy`);
  if (fish.genome.genesis) {
    const loci = moduleLoci(fish.species), modules = modulesOf(fish.genome);
    loci.forEach((locus, i) => {
      const a = modules.maternal[i] ?? 0, b = modules.paternal[i] ?? 0;
      if (locus.rule === 'recessive' && (a > 0) !== (b > 0)) notes.push(`Carries one ${locus.label.toLowerCase()} copy: two carriers give about a quarter affected young`);
      if (locus.rule === 'dominant' && (a > 0 || b > 0) && fish.genome.genesis?.model !== 2) notes.push(`Carries a dominant ${locus.label.toLowerCase()} copy that shows in its offspring`);
    });
    const liability = p.genesis?.modules?.liability ?? {};
    for (const [trait, value] of Object.entries(liability)) if (value >= 0.6 && value < 1) notes.push(`${Math.round(value * 100)}% of the way to ${trait}: select its offspring to cross the threshold`);
    if (!fish.genome.genesis.model) {
      const latent = loci.filter((locus, i) => locus.rule === 'liability' && (modules.maternal[i] ?? 0) + (modules.paternal[i] ?? 0) >= 2).map(locus => locus.label.toLowerCase());
      if (latent.length) notes.push(`Latent body-plan liability for ${latent.join(', ')} that can show in Genesis-bred offspring`);
    }
  }
  const alleles = carriedAlleles(world, fish);
  const leaps = alleles.filter(allele => allele.definition.kind === 'leap');
  if (alleles.length) notes.push(`${alleles.length} new allele${alleles.length === 1 ? '' : 's'}${leaps.length ? `, including the leap ${leaps.map(alleleName).join(', ')}` : ''}`);
  return notes;
}

/**
 * Rarity for every species: each visible trait on the six-step ladder (common → legendary), an overall specimen tier
 * and score, and, once the genotype is known, the hidden potential that makes an animal worth crossing.
 */
export function RarityPanel({ world, fish }: { world: World; fish: Fish }) {
  const [all, setAll] = useState(false);
  const report = rarityOf(fish.species, fish.genome), known = genotypeVisible(world, fish);
  const rows = all ? report.rows : report.rows.filter(row => row.tier !== 'common');
  const potential = known ? hiddenPotential(world, fish) : [];
  return <div className="trait-block rarity-block">
    <div className="block-title"><Icon name="sparkles" size={15} /><span className="eyebrow">Rarity</span>
      <span className={`${tierClass(report.tier)} rarity-overall`} data-tip={TIER_TEXT[report.tier]}>{report.tier}</span></div>
    <p className="rarity-summary"><b className="mono">{report.score}</b> rarity points · {report.share > 0.5 ? 'as ordinary as most bred stock' : `rarer overall than ${Math.min(99.9, (1 - report.share) * 100).toFixed(report.share < 0.01 ? 1 : 0)}% of bred stock`}
      {report.standouts ? ` · ${report.standouts} standout trait${report.standouts === 1 ? '' : 's'}` : ''}</p>
    {rows.length ? <dl className="appearance-traits rarity-traits">{rows.map(row => <div key={row.trait} className={`rarity-row tier-${tierRank(row.tier)}`}>
      <dt>{row.trait}</dt>
      <dd>{row.value}<span className={tierClass(row.tier)} data-tip={`${TIER_TEXT[row.tier]} ${row.frequency ? `${(row.frequency * 100).toFixed(row.frequency < 0.01 ? 2 : 1)}% of reference stock.` : 'Never seen in reference stock.'}`}>{row.tier}</span></dd>
    </div>)}</dl> : <p className="help-copy">Every visible trait is common in bred stock.</p>}
    <button className="link-button" onClick={() => setAll(!all)}>{all ? 'Hide common traits' : `Show all ${report.rows.length} traits`}</button>
    <div className="rarity-potential">
      <h4>Breeding potential</h4>
      {known ? potential.length ? <ul>{potential.map(note => <li key={note}>{note}</li>)}</ul> : <p className="help-copy">No hidden recessive, near-threshold module or new allele.</p>
        : <p className="help-copy">Hidden carriers are unknown until this animal is sequenced (or in scientist mode). Rare young often come from plain-looking carriers.</p>}
    </div>
    <p className="help-copy">{RARITY_NOTE}</p>
  </div>;
}

/** A compact tier chip for cards and shop listings; nothing for animals below rare. */
export function RarityChip({ fish }: { fish: Pick<Fish, 'species' | 'genome'> }) {
  const report = rarityOf(fish.species, fish.genome);
  if (tierRank(report.tier) < tierRank('rare')) return null;
  return <span className={`${tierClass(report.tier)} card-rarity`}>{report.tier}</span>;
}
