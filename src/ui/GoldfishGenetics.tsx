import { useMemo } from 'react';
import {
  EYE_VARIANT_FROM, GOLDFISH_CHROMOSOMES, GOLDFISH_EXPRESSION_NOTES, GOLDFISH_LOCUS_INDEX, GOLDFISH_LOCUS_NOTES, GOLDFISH_LOCUS_REGISTRY, GOLDFISH_RECESSIVES,
  GOLDFISH_VARIANT_FROM, type GoldfishRecessive,
} from '../core/goldfishCatalog';
import { describeGoldfishGenotype, describeGoldfishPhenotype, expressGoldfish, goldfishDominance, goldfishFingerprint, inheritGoldfish, isGoldfishGenome, type GoldfishGenome } from '../core/goldfishGenetics';
import { genotypeVisible, locusStage } from '../core/atlas';
import { DOMINANCE_LABELS, isNovel } from '../core/genesis';
import { hash } from '../core/random';
import type { Fish, World } from '../core/types';
import { LocusTip } from './LocusTip';

/** Species-local trait cards. Nothing here interprets a goldfish allele through the koi or axolotl catalogs. */
export function GoldfishTraitPanel({ fish, genotypeKnown = true }: { fish: Fish; genotypeKnown?: boolean }) {
  if (!isGoldfishGenome(fish.genome)) return null;
  const rows = describeGoldfishPhenotype(fish.genome).map(row => row.trait === 'Hidden copies' && !genotypeKnown ? { ...row, value: 'Unknown: sequence to reveal' } : row);
  const groups = [...new Set(rows.map(row => row.group))];
  return <div className="axolotl-traits goldfish-traits">
    {groups.map(group => <div className="trait-block appearance-block" key={group}>
      <div className="eyebrow">GOLDFISH · {group.toUpperCase()}</div>
      <dl className="appearance-traits">{rows.filter(row => row.group === group).map(row => <div key={row.trait}><dt>{row.trait}</dt><dd>{row.value}</dd></div>)}</dl>
    </div>)}
    <p className="help-copy">Twin tail, telescope and celestial eyes, transparent scales and long fins are modelled on genes found in real goldfish (chdA, lrp2, the T locus, kcnk5b). Variety names follow breeders’ standards; the colors, hoods, patterns and exact numbers are synthetic game genetics.</p>
  </div>;
}

/** The full 72-locus goldfish genome browser, grouped by its own 12 chromosomes. */
export function GoldfishGenomeView({ fish, world }: { fish: Fish; world: World }) {
  if (!isGoldfishGenome(fish.genome)) return null;
  const rows = describeGoldfishGenotype(fish.genome), seen = genotypeVisible(world, fish), names = new Map(world.alleles.map(record => [record.id, record.name]));
  const code = (value: number, label: string, copy: string) => !seen ? <code className="hidden" title="Sequence this goldfish to read its alleles">??</code>
    : <code title={`Copy inherited from ${copy}`}>{isNovel(value) ? 'N' : `G${value}`}<small>{isNovel(value) ? names.get(value) ?? 'new allele' : label}</small></code>;
  return <>
    <p className="help-copy">Goldfish genome v1 has two phased copies across 72 loci on 12 chromosomes, Genesis-native from the start: quantitative loci combine by dominance, open-ended alleles (N) can arise, and every goldfish carries hidden genetic load. Switch loci follow their own rules: recessive (twin tail, eyes, bubble sacs, albino, blue, chocolate, curled gills), dominant (long fins, pompons) and incompletely dominant (transparent scales). Hover or focus a locus for what it does.</p>
    {world.atlas.mode === 'discovery' ? <p className="help-copy atlas-note">Discovery mode: unidentified loci show as numbers{seen ? '' : ' and alleles stay hidden until you sequence this goldfish'}.</p> : null}
    {GOLDFISH_CHROMOSOMES.map((chromosome, chromosomeIndex) => <div className="chromosome" key={chromosome.id}>
      <h3>{String(chromosomeIndex + 1).padStart(2, '0')} / {chromosome.label}</h3>
      {chromosome.loci.map((id, offset) => {
        const index = GOLDFISH_LOCUS_INDEX[id], entry = GOLDFISH_LOCUS_REGISTRY[index], row = rows[index];
        const mutation = fish.mutations.some(m => m.locus === index), inherited = !mutation && fish.origins.some(o => o.locus === index);
        const stage = locusStage(world, 'goldfish', index), dominance = goldfishDominance(index);
        const description = stage >= 1 ? GOLDFISH_LOCUS_NOTES[id] : 'Not identified yet. Breed parents that carry different alleles here.';
        const inheritance = stage >= 2 ? `${GOLDFISH_EXPRESSION_NOTES[entry.expression]}${dominance ? ` ${DOMINANCE_LABELS[dominance]}.` : ''}` : 'How its two copies combine is not worked out yet.';
        return <div className={`locus appearance-locus ${mutation ? 'mutated' : ''} ${stage ? '' : 'unknown'}`} key={id}>
          <span><LocusTip label={stage >= 1 ? row.label : `Locus ${chromosomeIndex + 1}.${offset + 1}`} description={description} inheritance={inheritance}>{mutation ? ' *' : inherited ? ' ◆' : ''}</LocusTip>
            <small>{entry.positionCm.toFixed(1)} cM</small>
            {seen && row.carrierFor ? <span className="rarity carrier">{row.carrierFor} carrier</span> : row.expressed && stage >= 1 ? <span className="rarity">expressed</span> : null}</span>
          {code(row.maternal, row.maternalAllele, 'mother')}
          {code(row.paternal, row.paternalAllele, 'father')}
        </div>;
      })}
    </div>)}
    <p className="help-copy">* A new mutation in this goldfish. ◆ An allele copy inherited from a recorded mutation. Positions are goldfish map positions used for linked inheritance.</p>
  </>;
}

const SAMPLES = 256;
const pct = (value: number) => `${Math.round(value * 100)}%`;

/** Exact single-locus odds for each recessive: share of offspring expressing it (two variant copies) and carrying one. */
export function recessiveOdds(mother: GoldfishGenome, father: GoldfishGenome) {
  return (Object.keys(GOLDFISH_RECESSIVES) as GoldfishRecessive[]).map(locus => {
    const index = GOLDFISH_LOCUS_INDEX[locus], from = locus === 'gf_eye_program' ? EYE_VARIANT_FROM : GOLDFISH_VARIANT_FROM;
    const share = (genome: GoldfishGenome) => (Number(genome.maternal[index] >= from) + Number(genome.paternal[index] >= from)) / 2;
    const m = share(mother), f = share(father);
    return { locus, trait: GOLDFISH_RECESSIVES[locus], expressed: m * f, carriers: m * (1 - f) + f * (1 - m) };
  }).filter(row => row.expressed > 0 || row.carriers > 0);
}

function samplePair(mother: GoldfishGenome, father: GoldfishGenome) {
  const key = `${goldfishFingerprint(mother)}:${goldfishFingerprint(father)}`, varieties = new Map<string, number>(), colors = new Map<string, number>();
  const lengths: number[] = [];
  let buoyant = 0, nonviable = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const p = expressGoldfish(inheritGoldfish(mother, father, hash(`goldfish-prediction-v1:${key}:${i}`)).genome);
    if (!p.genesis.viable) { nonviable++; continue; }
    varieties.set(p.variety.label, (varieties.get(p.variety.label) ?? 0) + 1);
    colors.set(p.variety.color, (colors.get(p.variety.color) ?? 0) + 1);
    lengths.push(p.adultLengthCm);
    if (p.health.buoyancy) buoyant++;
  }
  const viable = Math.max(1, SAMPLES - nonviable), sorted = lengths.sort((a, b) => a - b), q = (x: number) => sorted[Math.floor((sorted.length - 1) * x)] ?? 0;
  const top = (map: Map<string, number>) => [...map].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([name, n]) => ({ name, share: n / viable }));
  return { varieties: top(varieties), colors: top(colors), length: [q(0.1), q(0.5), q(0.9)], buoyant: buoyant / viable, nonviable: nonviable / SAMPLES };
}

/** Deterministic goldfish pair preview: exact recessive odds when both genotypes are known, plus a sampled variety mix. */
export function GoldfishOffspringPrediction({ mother, father, world }: { mother: Fish; father: Fish; world?: Pick<World, 'atlas'> }) {
  const ok = isGoldfishGenome(mother.genome) && isGoldfishGenome(father.genome);
  const motherKey = ok ? goldfishFingerprint(mother.genome as GoldfishGenome) : '', fatherKey = ok ? goldfishFingerprint(father.genome as GoldfishGenome) : '';
  const prediction = useMemo(() => ok ? samplePair(mother.genome as GoldfishGenome, father.genome as GoldfishGenome) : null, [motherKey, fatherKey]);
  if (!ok || !prediction) return null;
  const known = !world || (genotypeVisible(world, mother) && genotypeVisible(world, father));
  const odds = known ? recessiveOdds(mother.genome as GoldfishGenome, father.genome as GoldfishGenome) : [];
  return <section className="planner-odds" aria-label="Goldfish offspring prediction">
    <strong>Goldfish offspring</strong>
    {known ? odds.length ? <div className="prediction-table"><table><thead><tr><th>Recessive</th><th>Show it</th><th>Hidden carriers</th></tr></thead><tbody>
      {odds.map(row => <tr key={row.locus}><th scope="row">{row.trait[0].toUpperCase() + row.trait.slice(1)}</th><td>{pct(row.expressed)}</td><td>{pct(row.carriers)}</td></tr>)}
    </tbody></table></div> : <p className="help-copy">Neither parent carries a recessive variant copy.</p>
      : <p className="help-copy">Sequence both parents to see exact odds for twin tails, telescope eyes and the other recessives.</p>}
    <p className="help-copy">{SAMPLES} deterministic samples from this pair’s linkage map. <strong>Varieties:</strong> {prediction.varieties.map(item => `${item.name} ${pct(item.share)}`).join(' · ')}</p>
    <p className="help-copy"><strong>Colors:</strong> {prediction.colors.map(item => `${item.name} ${pct(item.share)}`).join(' · ')}</p>
    <small>Adult length {prediction.length[0].toFixed(1)}–{prediction.length[2].toFixed(1)} cm (median {prediction.length[1].toFixed(1)}){prediction.buoyant ? ` · ${pct(prediction.buoyant)} with buoyancy trouble` : ''}{prediction.nonviable ? ` · ${pct(prediction.nonviable)} of eggs fail from lethal load` : ''}. Sampled shares are estimates, not guarantees.</small>
  </section>;
}
