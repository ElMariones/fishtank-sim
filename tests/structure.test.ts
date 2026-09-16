import { describe, expect, it } from 'vitest';
import { anatomyFor, buildAnatomy, containsPoint, portraitFrame, silhouettePoints, tailBox, tailLobes, validateAnatomy, type Anatomy } from '../src/core/anatomy';
import { LOCI } from '../src/core/catalog';
import { express, founderGenome, inherit } from '../src/core/genetics';
import { stagePhenotype } from '../src/core/juvenile';
import { buildOrnament } from '../src/core/ornament';
import { hash, random } from '../src/core/random';
import { STRUCTURE_BASELINE } from '../src/core/structure';
import type { Genome, Phenotype } from '../src/core/types';
import {
  ANATOMY_STRESS_FIXTURES, APPEARANCE_VISUAL_FIXTURES, COHORT_VISUAL_FIXTURES, EXTREME_VISUAL_FIXTURES, FOUNDER_VISUAL_FIXTURES, STRUCTURE_VISUAL_FIXTURES,
  structureGenome, structureSweep,
} from '../src/core/visualFixtures';
import { buildAnatomy as legacyBuildAnatomy } from './legacy/anatomyV2';

const byId = (id: string) => STRUCTURE_VISUAL_FIXTURES.find(fixture => fixture.id === id)!;
const binary = (seed: number): Genome => {
  const rng = random(seed), draw = () => LOCI.map(() => (rng() < 0.5 ? 0 : 5));
  return { version: 1, maternal: draw(), paternal: draw() };
};
/** The anatomy v3 fields a v2 renderer knows nothing about: version and extra lobes. */
const asV2 = ({ extraLobes: _lobes, ...rest }: Anatomy) => ({ ...rest, version: undefined });

describe('FS-602 structure anatomy', () => {
  it('builds exactly the anatomy v2 geometry and ornament for every standard-structure fish', () => {
    const phenotypes: [string, Phenotype][] = [
      ...[...FOUNDER_VISUAL_FIXTURES, ...COHORT_VISUAL_FIXTURES.flatMap(c => c.children), ...EXTREME_VISUAL_FIXTURES, ...ANATOMY_STRESS_FIXTURES, ...APPEARANCE_VISUAL_FIXTURES]
        .map(f => [f.id, f.phenotype] as [string, Phenotype]),
      ...Array.from({ length: 600 }, (_, i) => [`v2-${i}`, express(founderGenome(hash(`fs-602:v2:${i}`), 2))] as [string, Phenotype]),
      ...Array.from({ length: 300 }, (_, i) => [`binary-${i}`, express(binary(hash(`fs-602:legacy-binary:${i}`)))] as [string, Phenotype]),
      // Genome v3 fish whose Structure alleles are all baseline.
      ...Array.from({ length: 200 }, (_, i) => {
        const g = founderGenome(hash(`fs-602:v3:${i}`), 3);
        return [`v3-baseline-${i}`, express({ ...g, maternal: [...g.maternal.slice(0, 60), ...STRUCTURE_BASELINE], paternal: [...g.paternal.slice(0, 60), ...STRUCTURE_BASELINE] })] as [string, Phenotype];
      }),
    ];
    const withStages = phenotypes.flatMap(([id, p]) => [[id, p], [`${id}-hatchling`, stagePhenotype(p, { body: 0, pigment: 0 })], [`${id}-half`, stagePhenotype(p, { body: 0.5, pigment: 0.4 })]] as [string, Phenotype][]);
    for (const [id, p] of withStages) {
      const current = buildAnatomy(p), legacy = legacyBuildAnatomy(p);
      expect([id, current.version, current.extraLobes]).toEqual([id, 3, []]);
      expect(asV2(current)).toEqual({ ...legacy, version: undefined });
    }
    for (const fixture of APPEARANCE_VISUAL_FIXTURES) {
      const legacy = { ...legacyBuildAnatomy(fixture.phenotype), version: 3, extraLobes: [] } as unknown as Anatomy;
      expect(buildOrnament(fixture.phenotype, fixture.birthSeed, anatomyFor(fixture.phenotype))).toEqual(buildOrnament(fixture.phenotype, fixture.birthSeed, legacy));
    }
  });

  it('draws each supported structure as its fixture names it, attached and within bounds', () => {
    const lobes = (id: string) => tailLobes(anatomyFor(byId(id).phenotype)).length;
    expect(STRUCTURE_VISUAL_FIXTURES.map(f => f.genome.version)).toEqual(STRUCTURE_VISUAL_FIXTURES.map(() => 3));
    expect([lobes('structure-paired'), lobes('structure-paired-wide'), lobes('structure-crown'), lobes('structure-crown-tight'), lobes('structure-carrier'), lobes('structure-lopsided')]).toEqual([2, 2, 4, 4, 1, 1]);
    expect(anatomyFor(byId('structure-no-dorsal').phenotype).dorsal).toBeNull();
    const reducedFixture = byId('structure-reduced-dorsal'), reduced = anatomyFor(reducedFixture.phenotype).dorsal!;
    const normal = buildAnatomy(express(structureGenome(FOUNDER_VISUAL_FIXTURES[2].genome, {}, { dorsal_height: [5, 5], fin_gain: [4, 4] }))).dorsal!;
    expect(reduced.control.y).toBeGreaterThan(normal.control.y);
    expect(reduced.end.x).toBeLessThan(normal.end.x);
    expect(['structure-no-barbels', 'structure-carrier', 'structure-four-barbels', 'structure-six-barbels'].map(id => anatomyFor(byId(id).phenotype).barbels.length)).toEqual([0, 2, 4, 6]);
    // Ray density and lobe balance shape the tail within one topology.
    const wide = anatomyFor(byId('structure-paired-wide').phenotype), tight = anatomyFor(byId('structure-crown-tight').phenotype);
    expect([wide.caudal.rays.length, tight.caudal.rays.length]).toEqual([7, 5]);
    const lopsided = anatomyFor(byId('structure-lopsided').phenotype).caudal;
    expect(lopsided.upperTip.x).toBeGreaterThan(lopsided.lowerTip.x);
    expect(Math.abs(lopsided.upperOuter.y)).toBeGreaterThan(Math.abs(lopsided.lowerOuter.y));
    // A paired fan fans upward and downward from one root, wider apart with more spread.
    const paired = anatomyFor(byId('structure-paired').phenotype);
    expect(paired.caudal.angle).toBeLessThan(0); expect(paired.extraLobes[0].angle).toBeGreaterThan(0);
    expect(wide.extraLobes[0].angle!).toBeGreaterThan(paired.extraLobes[0].angle!);
    expect(paired.extraLobes[0].root).toEqual(paired.caudal.root);
    for (const fixture of STRUCTURE_VISUAL_FIXTURES) {
      const a = anatomyFor(fixture.phenotype), points = silhouettePoints(a);
      expect([fixture.id, validateAnatomy(a)]).toEqual([fixture.id, []]);
      for (const [w, h] of [[260, 140], [600, 330]]) {
        const frame = portraitFrame(fixture.phenotype, w, h);
        expect(points.filter(v => { const x = frame.originX + v.x * frame.pixelsPerBodyLength, y = frame.originY + v.y * frame.pixelsPerBodyLength; return x < -1e-6 || x > w + 1e-6 || y < -1e-6 || y > h + 1e-6; })).toEqual([]);
      }
      // Picking reaches the outermost lobe tip, not only the first lobe.
      const box = tailBox(a), lowest = tailLobes(a).map(lobe => lobe.lowerTip).reduce((low, tip) => (tip.y > low.y ? tip : low));
      expect(containsPoint(a, (lowest.x + a.caudal.root.x) / 2, (lowest.y + a.caudal.root.y) / 2)).toBe(true);
      expect(box.x1).toBeGreaterThan(0.5);
    }
  });

  it('keeps every tail, dorsal and barbel form valid and unclipped on fixtures, founders and extreme bodies', () => {
    const report = structureSweep(120);
    expect(report.invalid).toEqual([]);
    expect(report.portraitClipped).toBe(0);
    expect(report.checked).toBeGreaterThan(1500);
  });

  it('keeps structure valid through juvenile stages', () => {
    for (const fixture of STRUCTURE_VISUAL_FIXTURES) for (const body of [0, 0.25, 0.5, 0.75]) {
      const young = stagePhenotype(fixture.phenotype, { body, pigment: body });
      expect(young.structure).toBe(fixture.phenotype.structure);
      expect([fixture.id, body, validateAnatomy(buildAnatomy(young))]).toEqual([fixture.id, body, []]);
    }
  });

  it('reaches unusual structure by breeding: carriers show nothing, and a carrier cross expresses about a quarter', () => {
    const base = FOUNDER_VISUAL_FIXTURES[2].genome;
    const carrier = structureGenome(base, { tail_topology: [0, 1], dorsal_form: [2, 0] });
    expect(express(carrier).structure).toMatchObject({ tail: 'standard', dorsal: 'normal' });
    let paired = 0, absentDorsal = 0;
    for (let seed = 0; seed < 800; seed++) {
      const child = express(inherit(carrier, carrier, hash(`fs-602:carrier:${seed}`), 0).genome).structure;
      if (child.tail === 'paired') paired++;
      if (child.dorsal === 'absent') absentDorsal++;
    }
    expect(paired / 800).toBeGreaterThan(0.2); expect(paired / 800).toBeLessThan(0.3);
    expect(absentDorsal / 800).toBeGreaterThan(0.2); expect(absentDorsal / 800).toBeLessThan(0.3);
    // A crown needs two crown copies: paired × crown parents give paired fans and crowns, never a standard tail.
    const pairedParent = structureGenome(base, { tail_topology: [1, 1] }), crownParent = structureGenome(base, { tail_topology: [2, 2] });
    const kinds = new Set(Array.from({ length: 200 }, (_, seed) => express(inherit(crownParent, pairedParent, seed, 0).genome).structure.tail));
    expect([...kinds]).toEqual(['paired']);
    const crowns = Array.from({ length: 200 }, (_, seed) => express(inherit(crownParent, crownParent, seed, 0).genome).structure.tail);
    expect(new Set(crowns)).toEqual(new Set(['crown']));
  });
});
