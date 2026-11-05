import { useMemo } from 'react';
import {
  GUPPY_CHROMOSOMES, GUPPY_EXPRESSION_NOTES, GUPPY_LOCUS_INDEX, GUPPY_LOCUS_NOTES, GUPPY_LOCUS_REGISTRY, GUPPY_RECESSIVES, GUPPY_VARIANT_FROM,
  SEX_CHROMOSOME, SEX_LOCUS, Y_FROM, type GuppyRecessive,
} from '../core/guppyCatalog';
import {
  describeGuppyGenotype, describeGuppyPhenotype, expressGuppy, guppyDominance, guppyFingerprint, guppyProgramText, inheritGuppy, isGuppyGenome, type GuppyGenome,
} from '../core/guppyGenetics';
import { genotypeVisible, locusStage } from '../core/atlas';
import { DOMINANCE_LABELS, isNovel } from '../core/genesis';
import { hash } from '../core/random';
import type { Fish, World } from '../core/types';
import { LocusTip } from './LocusTip';

/** Species-local trait cards. Nothing here interprets a guppy allele through another species' catalog. */
export function GuppyTraitPanel({ fish, genotypeKnown = true }: { fish: Fish; genotypeKnown?: boolean }) {
  if (!isGuppyGenome(fish.genome)) return null;
  const rows = describeGuppyPhenotype(fish.genome).map(row => row.trait === 'Hidden copies' && !genotypeKnown ? { ...row, value: 'Unknown: sequence to reveal' } : row);
  const groups = [...new Set(rows.map(row => row.group))];
  return <div className="axolotl-traits guppy-traits">
    {groups.map(group => <div className="trait-block appearance-block" key={group}>
      <div className="eyebrow">GUPPY · {group.toUpperCase()}</div>
      <dl className="appearance-traits">{rows.filter(row => row.group === group).map(row => <div key={row.trait}><dt>{row.trait}</dt><dd>{row.value}{row.note ? <small> {row.note}</small> : null}</dd></div>)}</dl>
    </div>)}
    <p className="help-copy">XY sex determination, Y-linked color, sex-limited male color, the Winge double-sword crossover, and the blond, golden, albino and blue recessives follow classic guppy genetics. Strain names follow breeders’ usage; the exact numbers and patterns are synthetic game genetics.</p>
  </div>;
}

/** The full 72-locus guppy genome, grouped by its own 12 chromosomes. A male's sex chromosome reads X (mother) / Y (father). */
export function GuppyGenomeView({ fish, world }: { fish: Fish; world: World }) {
  if (!isGuppyGenome(fish.genome)) return null;
  const genome = fish.genome, rows = describeGuppyGenotype(genome), seen = genotypeVisible(world, fish), names = new Map(world.alleles.map(record => [record.id, record.name]));
  const homolog = (copy: 'maternal' | 'paternal') => genome[copy][SEX_LOCUS] >= Y_FROM ? 'Y' : 'X';
  const code = (value: number, label: string, copy: string) => !seen ? <code className="hidden" title="Sequence this guppy to read its alleles">??</code>
    : <code title={`Copy inherited from ${copy}`}>{isNovel(value) ? 'N' : `P${value}`}<small>{isNovel(value) ? names.get(value) ?? 'new allele' : label}</small></code>;
  return <>
    <p className="help-copy">Guppy genome v1 has two phased copies across 72 loci on 12 chromosomes, Genesis-native from the start. The last chromosome is the sex chromosome: a male carries an X from his mother and a Y from his father, and passes that Y, with every color program linked to it, to all his sons. Double sword sits close to the sex region and crosses over only rarely (1.5%). Hover or focus a locus for what it does.</p>
    {world.atlas.mode === 'discovery' ? <p className="help-copy atlas-note">Discovery mode: unidentified loci show as numbers{seen ? '' : ' and alleles stay hidden until you sequence this guppy'}.</p> : null}
    {GUPPY_CHROMOSOMES.map((chromosome, chromosomeIndex) => {
      const sexChromosome = chromosome.id === SEX_CHROMOSOME;
      return <div className={`chromosome ${sexChromosome ? 'sex-chromosome' : ''}`} key={chromosome.id}>
        <h3>{String(chromosomeIndex + 1).padStart(2, '0')} / {chromosome.label}{sexChromosome ? <small> · copies: {homolog('maternal')} from mother, {homolog('paternal')} from father</small> : null}</h3>
        {chromosome.loci.map((id, offset) => {
          const index = GUPPY_LOCUS_INDEX[id], entry = GUPPY_LOCUS_REGISTRY[index], row = rows[index];
          const mutation = fish.mutations.some(m => m.locus === index), inherited = !mutation && fish.origins.some(o => o.locus === index);
          const stage = locusStage(world, 'guppy', index), dominance = guppyDominance(index);
          const description = stage >= 1 ? GUPPY_LOCUS_NOTES[id] : 'Not identified yet. Breed parents that carry different alleles here.';
          const inheritance = stage >= 2 ? `${GUPPY_EXPRESSION_NOTES[entry.expression]}${dominance ? ` ${DOMINANCE_LABELS[dominance]}.` : ''}` : 'How its two copies combine is not worked out yet.';
          return <div className={`locus appearance-locus ${mutation ? 'mutated' : ''} ${stage ? '' : 'unknown'}`} key={id}>
            <span><LocusTip label={stage >= 1 ? row.label : `Locus ${chromosomeIndex + 1}.${offset + 1}`} description={description} inheritance={inheritance}>{mutation ? ' *' : inherited ? ' ◆' : ''}</LocusTip>
              <small>{entry.positionCm.toFixed(1)} cM</small>
              {seen && row.carrierFor ? <span className="rarity carrier">{row.carrierFor} carrier</span> : row.expressed && stage >= 1 ? <span className="rarity">{entry.expression === 'sex' ? 'male' : 'expressed'}</span> : null}</span>
            {code(row.maternal, row.maternalAllele, sexChromosome ? `mother (${homolog('maternal')})` : 'mother')}
            {code(row.paternal, row.paternalAllele, sexChromosome ? `father (${homolog('paternal')})` : 'father')}
          </div>;
        })}
      </div>;
    })}
    <p className="help-copy">* A new mutation in this guppy. ◆ An allele copy inherited from a recorded mutation. Positions are guppy map positions used for linked inheritance; the sex chromosome does not recombine in males except at the double-sword locus.</p>
  </>;
}

const SAMPLES = 256;
const pct = (value: number) => `${Math.round(value * 100)}%`;

/** Exact single-locus odds for each autosomal recessive: share of offspring showing it and carrying one hidden copy. */
export function guppyRecessiveOdds(mother: GuppyGenome, father: GuppyGenome) {
  return (Object.keys(GUPPY_RECESSIVES) as GuppyRecessive[]).map(locus => {
    const index = GUPPY_LOCUS_INDEX[locus];
    const share = (genome: GuppyGenome) => (Number(genome.maternal[index] >= GUPPY_VARIANT_FROM) + Number(genome.paternal[index] >= GUPPY_VARIANT_FROM)) / 2;
    const m = share(mother), f = share(father);
    return { locus, trait: GUPPY_RECESSIVES[locus], expressed: m * f, carriers: m * (1 - f) + f * (1 - m) };
  }).filter(row => row.expressed > 0 || row.carriers > 0);
}

type Tally = Map<string, number>;
function sampleGuppyPair(mother: GuppyGenome, father: GuppyGenome) {
  const key = `${guppyFingerprint(mother)}:${guppyFingerprint(father)}`, sons: Tally = new Map(), daughters: Tally = new Map(), programs: Tally = new Map();
  let males = 0, females = 0, nonviable = 0, sterile = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const p = expressGuppy(inheritGuppy(mother, father, hash(`guppy-prediction-v1:${key}:${i}`)).genome);
    if (!p.genesis.viable) { nonviable++; continue; }
    if (p.sex === 'M') {
      males++; sons.set(p.strain.name, (sons.get(p.strain.name) ?? 0) + 1);
      for (const program of p.color.programs) programs.set(program, (programs.get(program) ?? 0) + 1);
      if (!p.health.canSire) sterile++;
    } else { females++; daughters.set(p.strain.name, (daughters.get(p.strain.name) ?? 0) + 1); }
  }
  const top = (map: Tally, of: number) => [...map].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, n]) => ({ name, share: n / Math.max(1, of) }));
  return { sons: top(sons, males), daughters: top(daughters, females), programs: top(programs, males), males: males / Math.max(1, males + females), sterile: sterile / Math.max(1, males), nonviable: nonviable / SAMPLES };
}

/** Deterministic guppy pair preview: sons and daughters separately, since a male's look depends on the Y his father gives him. */
export function GuppyOffspringPrediction({ mother, father, world }: { mother: Fish; father: Fish; world?: Pick<World, 'atlas'> }) {
  const ok = isGuppyGenome(mother.genome) && isGuppyGenome(father.genome);
  const motherKey = ok ? guppyFingerprint(mother.genome as GuppyGenome) : '', fatherKey = ok ? guppyFingerprint(father.genome as GuppyGenome) : '';
  const prediction = useMemo(() => ok ? sampleGuppyPair(mother.genome as GuppyGenome, father.genome as GuppyGenome) : null, [motherKey, fatherKey]);
  if (!ok || !prediction) return null;
  const known = !world || (genotypeVisible(world, mother) && genotypeVisible(world, father));
  const odds = known ? guppyRecessiveOdds(mother.genome as GuppyGenome, father.genome as GuppyGenome) : [];
  return <section className="planner-odds" aria-label="Guppy offspring prediction">
    <strong>Guppy brood</strong>
    {known ? odds.length ? <div className="prediction-table"><table><thead><tr><th>Recessive</th><th>Show it</th><th>Hidden carriers</th></tr></thead><tbody>
      {odds.map(row => <tr key={row.locus}><th scope="row">{row.trait[0].toUpperCase() + row.trait.slice(1)}</th><td>{pct(row.expressed)}</td><td>{pct(row.carriers)}</td></tr>)}
    </tbody></table></div> : <p className="help-copy">Neither parent carries a recessive variant copy.</p>
      : <p className="help-copy">Sequence both parents to see exact odds for albino, blond, golden, blue, dumbo and swallow.</p>}
    <p className="help-copy"><strong>Sons ({pct(prediction.males)}):</strong> {prediction.sons.map(item => `${item.name} ${pct(item.share)}`).join(' · ') || 'none sampled'}</p>
    <p className="help-copy"><strong>Daughters:</strong> {prediction.daughters.map(item => `${item.name} ${pct(item.share)}`).join(' · ') || 'none sampled'}</p>
    {prediction.programs.length ? <p className="help-copy"><strong>Y programs in sons:</strong> {prediction.programs.map(item => `${guppyProgramText(item.name as never)} ${pct(item.share)}`).join(' · ')}</p> : null}
    <small>{SAMPLES} deterministic samples from this pair’s linkage map{prediction.sterile ? ` · ${pct(prediction.sterile)} of sons are ribbon males that cannot sire` : ''}{prediction.nonviable ? ` · ${pct(prediction.nonviable)} of fry fail from lethal load` : ''}. Daughters carry their father’s color program hidden; their sons will show it. Sampled shares are estimates, not guarantees.</small>
  </section>;
}
