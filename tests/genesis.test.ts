import { describe, expect, it } from 'vitest';
import { buildAnatomy, validateAnatomy } from '../src/core/anatomy';
import { atlasProgress, MAP_MEIOSES, observeFamily, STAGE_EVIDENCE } from '../src/core/atlas';
import { AXOLOTL_DEV_INDEX } from '../src/core/axolotlCatalog';
import { axolotlFounderGenome, expressAxolotl, inheritAxolotl, isAxolotlGenome } from '../src/core/axolotlGenetics';
import { daysToMaturity, eggsLaid } from '../src/core/breeding';
import { GENOME_LOCI, GENOME_VERSION, MUTATION_RATE } from '../src/core/catalog';
import { adultLife } from '../src/core/development';
import { CHANNELS, homozygousSites, isNovel, KOI_LOAD, NOVEL_ID_MIN, vigorFor } from '../src/core/genesis';
import { GENESIS_AXOLOTL_FIXTURES, GENESIS_FOUNDER_SAMPLE, GENESIS_KOI_FIXTURES } from '../src/core/genesisFixtures';
import { loadRisk } from '../src/core/genesisView';
import { express, founderGenome, inherit } from '../src/core/genetics';
import { residentContexts, residentEnvironment } from '../src/core/habitat';
import { genomeProblem } from '../src/core/registry';
import { advanceRuntime, commandEnvelope, createRuntime, decodeRuntime, executeCommand } from '../src/core/runtime';
import { decodeSave } from '../src/core/save';
import { TICKS_PER_GAME_DAY } from '../src/core/water';
import { applyCommand, createWorld, type Command } from '../src/core/world';
import { drawFish } from '../src/rendering/fish';
import { measureWork } from './support/recordingContext';
import type { Fish, Genome, World } from '../src/core/types';

const NOW = '2026-10-16T12:00:00.000Z';
const index = (locus: string) => GENOME_LOCI.indexOf(locus as never);
const withAlleles = (genome: Genome, edits: Record<string, [number, number]>): Genome => {
  const next = { ...genome, maternal: [...genome.maternal], paternal: [...genome.paternal], genesis: structuredClone(genome.genesis!) };
  for (const [locus, [m, p]] of Object.entries(edits)) { next.maternal[index(locus)] = m; next.paternal[index(locus)] = p; }
  return next;
};
const genesisWorld = () => createWorld(NOW, 481516, GENOME_VERSION);
const cross = (world: World, motherId: string, fatherId: string, count = 24, tankId = 'tank-2'): World =>
  applyCommand(world, { type: 'breed', motherId, fatherId, tankId, timestamp: NOW, genomeVersion: GENOME_VERSION, count });

describe('Genesis genome v4 architecture', () => {
  it('keeps the first 66 loci of a seed identical to genome v3 and adds a valid development block', () => {
    for (let seed = 0; seed < 60; seed++) {
      const v3 = founderGenome(seed, 3), v4 = founderGenome(seed, 4);
      expect(v4.maternal.slice(0, 66)).toEqual(v3.maternal); expect(v4.paternal.slice(0, 66)).toEqual(v3.paternal);
      expect(v4.maternal).toHaveLength(72); expect(genomeProblem(v4)).toBeNull();
      // Founders never express their own load.
      expect(homozygousSites(v4.genesis!.load)).toEqual([]);
      expect(express(v4).genesis!.viable).toBe(true);
    }
    expect(express(founderGenome(1, 3)).genesis).toBeUndefined();
  });

  it('reads dominance instead of averaging: a potent copy hides a weak one', () => {
    const base = founderGenome(5, 4);
    // tail_length is "higher dominant": A5/A0 sits near A5/A5, far above the A0/A5 average of an additive locus.
    const het = express(withAlleles(base, { tail_length: [5, 0], fin_program: [0, 0] })).tail;
    const high = express(withAlleles(base, { tail_length: [5, 5], fin_program: [0, 0] })).tail;
    const low = express(withAlleles(base, { tail_length: [0, 0], fin_program: [0, 0] })).tail;
    expect((het - low) / (high - low)).toBeGreaterThan(0.7);
    // body_depth is "lower dominant": the heterozygote leans toward the low allele.
    const dHet = express(withAlleles(base, { body_depth: [5, 0] })).depth, dHigh = express(withAlleles(base, { body_depth: [5, 5] })).depth, dLow = express(withAlleles(base, { body_depth: [0, 0] })).depth;
    expect((dHet - dLow) / (dHigh - dLow)).toBeLessThan(0.3);
  });

  it('segregates a recessive epistatic switch 3:1 and masks every color behind it', () => {
    const base = founderGenome(9, 4), carrier = withAlleles(base, { pigment_cascade: [0, 3], red: [5, 5], black: [5, 5] });
    let ghosts = 0;
    for (let i = 0; i < 2000; i++) if (express(inherit(carrier, carrier, i, 0, 4).genome as Genome).genesis!.ghost >= 1) ghosts++;
    expect(ghosts / 2000).toBeGreaterThan(0.21); expect(ghosts / 2000).toBeLessThan(0.29);
    const ghost = express(withAlleles(carrier, { pigment_cascade: [0, 0] })), colored = express(carrier);
    expect(ghost.red).toBeLessThan(colored.red * 0.15); expect(ghost.black).toBeLessThan(colored.black * 0.1);
  });

  it('makes the fin program dominant, with trade-offs in speed and oxygen', () => {
    const base = withAlleles(founderGenome(12, 4), { fin_program: [0, 0] });
    const [standard, veil, butterfly] = [[0, 0], [4, 0], [5, 4]].map(pair => express(withAlleles(base, { fin_program: pair as [number, number] })));
    expect([standard.genesis!.fins, veil.genesis!.fins, butterfly.genesis!.fins]).toEqual(['standard', 'veil', 'butterfly']);
    expect(veil.tail).toBeGreaterThan(standard.tail * 1.2); expect(butterfly.tail).toBeGreaterThan(veil.tail);
    expect(veil.speed).toBeLessThan(standard.speed); expect(butterfly.genesis!.oxygenDemand).toBeGreaterThan(standard.genesis!.oxygenDemand);
    expect(veil.genesis!.competitiveness).toBeLessThan(standard.genesis!.competitiveness);
  });

  it('gives identical genotypes different development seeds, narrowed by canalization', () => {
    const base = founderGenome(21, 4), spread = (canal: [number, number]) => {
      const lengths = Array.from({ length: 30 }, (_, i) => express({ ...withAlleles(base, { canalization: canal }), genesis: { ...base.genesis!, dev: 1000 + i } }).length);
      return Math.max(...lengths) - Math.min(...lengths);
    };
    expect(spread([0, 0])).toBeGreaterThan(spread([5, 5]) * 3);
    expect(spread([5, 5])).toBeGreaterThan(0);
  });

  it('transmits load with its anchor locus and exposes it through inbreeding (inbreeding depression and heterosis)', () => {
    const site = KOI_LOAD.find(entry => entry.kind === 'lethal')!, base = founderGenome(30, 4);
    const carrier = { ...base, genesis: { ...base.genesis!, load: { maternal: [site.id], paternal: [] } } };
    let affected = 0, linked = 0, informative = 0;
    for (let i = 0; i < 2000; i++) {
      const trace = { maternal: [] as (0 | 1)[], paternal: [] as (0 | 1)[] }, child = inherit(carrier, carrier, i, 0, 4, trace).genome as Genome;
      if (homozygousSites(child.genesis!.load).includes(site.id)) affected++;
      // The site travels with the maternal homolog at its anchor locus.
      if (trace.maternal[site.anchor] === 0) { informative++; if (child.genesis!.load.maternal.includes(site.id)) linked++; }
    }
    expect(affected / 2000).toBeGreaterThan(0.21); expect(affected / 2000).toBeLessThan(0.29);
    expect(linked).toBe(informative);
    expect(vigorFor(0.65)).toBeGreaterThan(vigorFor(0.2));
  });

  it('creates open-ended alleles that are pure, carried with their definitions and valid', () => {
    const mother = founderGenome(40, 4), father = founderGenome(41, 4);
    let created = 0;
    for (let seed = 0; seed < 300; seed++) {
      const a = inherit(mother, father, seed, 0.2, 4), b = inherit(mother, father, seed, 0.2, 4);
      expect(a).toEqual(b);
      const genome = a.genome as Genome;
      expect(genomeProblem(genome)).toBeNull();
      for (const novel of genome.genesis!.novel) {
        created++;
        expect(novel.id).toBeGreaterThanOrEqual(NOVEL_ID_MIN);
        expect(Object.keys(novel.effects)).toEqual(CHANNELS.filter(channel => channel in novel.effects));
      }
      expect(validateAnatomy(buildAnatomy(express(genome)))).toEqual([]);
    }
    expect(created).toBeGreaterThan(50);
    // A grandchild inherits the definition along with the allele.
    const child = inherit(mother, father, 7, 0.2, 4).genome as Genome, grandchild = inherit(child, child, 8, 0, 4).genome as Genome;
    for (const allele of [...grandchild.maternal, ...grandchild.paternal].filter(isNovel)) expect(grandchild.genesis!.novel.some(entry => entry.id === allele)).toBe(true);
  });

  it('keeps every Genesis fixture and founder anatomically valid and drawable', () => {
    for (const fixture of [...GENESIS_KOI_FIXTURES, ...GENESIS_AXOLOTL_FIXTURES, ...GENESIS_FOUNDER_SAMPLE]) {
      expect(fixture.phenotype.genesis).toBeDefined();
      if (fixture.species === 'koi') expect(validateAnatomy(buildAnatomy(fixture.phenotype))).toEqual([]);
      const work = measureWork(ctx => drawFish(ctx, fixture.phenotype, fixture.birthSeed, 120, 1.5));
      expect(work.fills).toBeGreaterThan(0);
    }
    const kinds = new Set(GENESIS_KOI_FIXTURES.flatMap(fixture => fixture.phenotype.genesis!.defects.map(defect => defect.kind)));
    expect([...kinds].sort()).toEqual(['dwarf', 'eye', 'fins', 'pigment', 'spine']);
    expect(GENESIS_KOI_FIXTURES.find(f => f.id === 'genesis-koi-fins-regrown')!.phenotype.genesis!.defects[0].rescued).toBe(true);
  });
});

describe('Genesis axolotl genome v2', () => {
  it('keeps v1 loci, adds the development chromosome, and its programs follow their dominance', () => {
    const v1 = axolotlFounderGenome(3), v2 = axolotlFounderGenome(3, 2);
    expect(v2.maternal.slice(0, 66)).toEqual(v1.maternal); expect(v2.maternal).toHaveLength(72); expect(isAxolotlGenome(v2)).toBe(true);
    const set = (pairs: Record<string, [number, number]>) => {
      const next = { ...v2, maternal: [...v2.maternal], paternal: [...v2.paternal] };
      for (const [locus, [m, p]] of Object.entries(pairs)) { next.maternal[(AXOLOTL_DEV_INDEX as Record<string, number>)[locus]] = m; next.paternal[(AXOLOTL_DEV_INDEX as Record<string, number>)[locus]] = p; }
      return expressAxolotl(next);
    };
    expect(set({ axo_fluorescence: [4, 0] }).genesis!.glow).toBeGreaterThan(0.5);
    expect(set({ axo_gill_program: [4, 0] }).genesis!.plume).toBe(false);
    expect(set({ axo_gill_program: [4, 5] }).genesis!.plume).toBe(true);
    expect(set({ axo_frill_program: [5, 0] }).genesis!.fins).toBe('veil');
    // Genome v1 x v1 stays v1 unless the clutch asks for Genesis; one v2 parent makes a v2 child.
    expect(inheritAxolotl(v1, axolotlFounderGenome(4), 1).genome.version).toBe(1);
    expect(inheritAxolotl(v1, v2, 1).genome.version).toBe(2);
    expect(express(v2).genesis).toBeDefined();
  });
});

describe('Genesis life history and temperament', () => {
  it('sets maturity, clutch size and food competition from genes', () => {
    const world = genesisWorld(), [haru, sumi] = world.fish;
    expect(haru.life.ageDays).toBeGreaterThanOrEqual(3 + express(haru.genome).genesis!.maturityDays);
    expect(daysToMaturity(haru)).toBe(0);
    const young = { ...haru, life: { ...adultLife(haru.genome), ageDays: 5 } };
    expect(daysToMaturity(young)).toBeGreaterThan(0);
    expect(eggsLaid(haru, sumi, 20)).toBeGreaterThanOrEqual(1); expect(eggsLaid(haru, sumi, 20)).toBeLessThanOrEqual(20);
    // When food is short, a bold, active animal is fed better than a shy one in the same tank.
    const bold = withAlleles(haru.genome as Genome, { boldness: [5, 5], activity: [5, 5], curiosity: [5, 5], fin_program: [0, 0] });
    const shy = withAlleles(haru.genome as Genome, { boldness: [0, 0], activity: [0, 0], curiosity: [0, 0], fin_program: [5, 5] });
    const hungry: World = { ...world, tanks: world.tanks.map(tank => ({ ...tank, care: { ...tank.care, fed: 0.5 } })),
      fish: [{ ...haru, genome: bold }, { ...sumi, genome: shy }, ...world.fish.slice(2)] };
    const contexts = residentContexts(hungry), env = { oxygen: 1, ammonia: 1, temperature: 1, crowding: 1, nutrition: 0.55, overall: 0.55, growth: 1 };
    const boldEnv = residentEnvironment(hungry.fish[0], env, contexts.get('tank-1')), shyEnv = residentEnvironment(hungry.fish[1], env, contexts.get('tank-1'));
    expect(boldEnv.environment.nutrition).toBeGreaterThan(shyEnv.environment.nutrition);
    expect(shyEnv.limits).toContain('outcompeted for food');
  });

  it('records clutch outcomes, lethal eggs, allele names and atlas evidence through normal breeding, and replays them', () => {
    let runtime = createRuntime(genesisWorld(), 'genesis-life');
    const run = (payload: Command, tick = runtime.tick) => { runtime = executeCommand(runtime, commandEnvelope(runtime, payload, tick)); };
    run({ type: 'pair', motherId: 'FSH-000001', fatherId: 'FSH-000002', nurseryId: 'tank-2', size: 24, timestamp: NOW, genomeVersion: GENOME_VERSION });
    runtime = advanceRuntime(runtime, runtime.tick + 12 * TICKS_PER_GAME_DAY);
    const clutch = runtime.world.clutches[0];
    expect(clutch.outcome).toBeDefined();
    expect(clutch.outcome!.laid + clutch.outcome!.nonviable).toBeLessThanOrEqual(24);
    expect(clutch.stage).toBe('hatched');
    expect(runtime.world.atlas.koi.evidence.some(value => value > 0)).toBe(true);
    // Sequencing and naming are commands too, and the save replays to the same world.
    run({ type: 'sequence-fish', fishId: 'FSH-000001' });
    expect(runtime.world.ledger.totals.research).toBe(-60);
    expect(decodeRuntime(JSON.stringify(runtime))).toEqual(runtime);
    expect(decodeSave(JSON.stringify(runtime.world))).toEqual(runtime.world);
  });

  it('round-trips a high-mutation fast-bred world with novel alleles through save and replay', () => {
    let runtime = createRuntime(genesisWorld(), 'genesis-novel');
    const run = (payload: Command) => { runtime = executeCommand(runtime, commandEnvelope(runtime, payload)); };
    for (let i = 0; i < 4; i++) run({ type: 'breed', motherId: 'FSH-000001', fatherId: 'FSH-000002', tankId: 'tank-2', timestamp: NOW, genomeVersion: GENOME_VERSION, count: 12 });
    const records = runtime.world.alleles;
    if (records.length) {
      run({ type: 'name-allele', alleleId: records[0].id, name: 'Moonfin' });
      expect(runtime.world.alleles[0]).toMatchObject({ name: 'Moonfin', named: true });
    }
    expect(decodeRuntime(JSON.stringify(runtime))).toEqual(runtime);
  });
});

describe('Genome Atlas', () => {
  it('needs several informative clutches to identify, characterize and map a locus', () => {
    const world = genesisWorld();
    const [mother, father] = world.fish as [Fish, Fish];
    let atlas = world.atlas, clutches = 0;
    const kids = (seed: number) => Array.from({ length: 20 }, (_, i) => ({ ...mother, id: `FSH-9${String(seed).padStart(2, '0')}${String(i).padStart(3, '0')}`, genome: inherit(mother.genome, father.genome, seed * 100 + i, MUTATION_RATE, 4).genome } as Fish));
    const first = observeFamily(atlas, mother, father, kids(1));
    expect(atlasProgress({ atlas: first.atlas }, 'koi').mapped).toBe(0);
    expect(atlasProgress({ atlas: first.atlas }, 'koi').characterized).toBe(0);
    while (atlasProgress({ atlas }, 'koi').mapped === 0 && clutches < 40) atlas = observeFamily(atlas, mother, father, kids(++clutches)).atlas;
    expect(clutches).toBeGreaterThan(2);
    expect(STAGE_EVIDENCE[2]).toBeGreaterThan(STAGE_EVIDENCE[1]); expect(MAP_MEIOSES).toBeGreaterThanOrEqual(30);
  });

  it('computes exact load risk only once both parents are sequenced', () => {
    let world = genesisWorld();
    const [mother, father] = world.fish;
    expect(loadRisk(world, mother, father)).toBeNull();
    world = applyCommand(applyCommand(world, { type: 'sequence-fish', fishId: mother.id }), { type: 'sequence-fish', fishId: father.id });
    const risk = loadRisk(world, mother, father)!;
    expect(risk.risk).toBeGreaterThanOrEqual(0); expect(risk.risk).toBeLessThanOrEqual(1);
    // A sib-mated line shows more defects than its founders' cross.
    let line: World = cross(genesisWorld(), 'FSH-000001', 'FSH-000002', 24);
    const pick = (w: World, sex: 'F' | 'M') => w.fish.find(f => f.generation === Math.max(...w.fish.map(x => x.generation)) && f.sex === sex)!;
    for (let generation = 0; generation < 4; generation++) {
      const next = structuredClone(line), keep = [pick(line, 'F').id, pick(line, 'M').id];
      for (const fish of next.fish) { fish.life = adultLife(fish.genome); if (!keep.includes(fish.id)) fish.status = 'rehomed'; }
      line = cross(next, pick(next, 'F').id, pick(next, 'M').id, 24, 'tank-1');
    }
    expect(line.atlas.koi.evidence.some(value => value > 0)).toBe(true);
  });
});
