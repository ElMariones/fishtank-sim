import { describe, expect, it } from 'vitest';
import { anatomyFor, buildAnatomy, portraitFrame, sharedExtent, silhouettePoints, validateAnatomy } from '../src/core/anatomy';
import { LOCI } from '../src/core/catalog';
import { express, founderGenome } from '../src/core/genetics';
import { hash, random } from '../src/core/random';
import type { Genome } from '../src/core/types';
import {
  anatomySweep, ANATOMY_STRESS_FIXTURES, COHORT_VISUAL_FIXTURES, EXTREME_VISUAL_FIXTURES, FOUNDER_VISUAL_FIXTURES, legacyAnatomyDefects,
} from '../src/core/visualFixtures';
import { fishPose, pickActor, toBodySpace } from '../src/rendering/tankLayout';
import type { Actor } from '../src/simulation/motion';

const uniform = (maternal: number, paternal = maternal): Genome => ({ version: 1, maternal: Array(48).fill(maternal), paternal: Array(48).fill(paternal) });
const binaryExtreme = (seed: number): Genome => {
  const rng = random(seed), draw = () => LOCI.map(() => (rng() < 0.5 ? 0 : 5));
  return { version: 1, maternal: draw(), paternal: draw() };
};
const fixtures = [...FOUNDER_VISUAL_FIXTURES, ...COHORT_VISUAL_FIXTURES.flatMap(cohort => cohort.children), ...EXTREME_VISUAL_FIXTURES, ...ANATOMY_STRESS_FIXTURES];

describe('FS-102 anatomy anchors', () => {
  it('keeps every fixture, corner genome and sampled extreme attached, finite and bounded', () => {
    const genomes = [
      ...[0, 1, 2, 3, 4, 5].map(allele => uniform(allele)), uniform(0, 5), uniform(5, 0),
      ...Array.from({ length: 1500 }, (_, i) => founderGenome(hash(`anatomy-test:founder:${i}`))),
      ...Array.from({ length: 1500 }, (_, i) => binaryExtreme(hash(`anatomy-test:binary:${i}`))),
    ];
    const failures = [
      ...fixtures.map(fixture => ({ id: fixture.id, problems: validateAnatomy(buildAnatomy(fixture.phenotype)) })),
      ...genomes.map((genome, i) => ({ id: `genome-${i}`, problems: validateAnatomy(buildAnatomy(express(genome))) })),
    ].filter(result => result.problems.length);
    expect(failures).toEqual([]);
  });

  it('corrects measured v1 anchor defects while preserving the v1 outline endpoints', () => {
    const report = anatomySweep(250);
    expect(report.invalid).toEqual([]);
    expect(report.portraitClipped).toBe(0);
    expect(report.legacyAffected).toBeGreaterThan(0);
    expect(report.legacy['eye-overhang']).toBeGreaterThan(0);
    for (const fixture of FOUNDER_VISUAL_FIXTURES) {
      const p = fixture.phenotype, a = anatomyFor(p);
      expect(a.top[0].x).toBeCloseTo(-(0.5 + p.snout), 12);
      expect(a.top.at(-1)!.y).toBeCloseTo(-p.depth * p.taper * 0.4, 12);
      expect(a.bottom.at(-1)!.y).toBeCloseTo(p.depth * p.taper * 0.4, 12);
    }
  });

  it('records developmental eye constraints instead of silently resizing anatomy', () => {
    const shallow = ANATOMY_STRESS_FIXTURES.find(fixture => fixture.id === 'anatomy-shallow-bigeye')!;
    expect(legacyAnatomyDefects(shallow.phenotype)).toContain('eye-overhang');
    const a = anatomyFor(shallow.phenotype);
    expect(a.eye.radius).toBeLessThan(shallow.phenotype.eye);
    expect(shallow.anatomyAdjustments.some(text => text.startsWith('Eye radius limited'))).toBe(true);
    const unconstrained = fixtures.filter(fixture => !fixture.anatomyAdjustments.length);
    expect(unconstrained.length).toBeGreaterThan(40);
    unconstrained.forEach(fixture => expect(anatomyFor(fixture.phenotype).eye.radius).toBe(fixture.phenotype.eye));
  });

  it('frames portraits without clipping, and shared scale keeps relative body length', () => {
    const group = fixtures.map(fixture => fixture.phenotype);
    const shared = sharedExtent(group);
    let outside = 0, reduced = 0;
    for (const p of group) {
      const points = silhouettePoints(anatomyFor(p));
      for (const [w, h] of [[260, 140], [600, 330]]) {
        for (const extent of [undefined, shared]) {
          const frame = portraitFrame(p, w, h, extent);
          if (frame.sharedScaleReduced) reduced++;
          outside += points.filter(v => {
            const x = frame.originX + v.x * frame.pixelsPerBodyLength, y = frame.originY + v.y * frame.pixelsPerBodyLength;
            return x < 0 || x > w || y < 0 || y > h;
          }).length;
        }
      }
    }
    expect(outside).toBe(0);
    expect(reduced).toBe(0);
    const needle = EXTREME_VISUAL_FIXTURES[0].phenotype, shortFace = EXTREME_VISUAL_FIXTURES[4].phenotype;
    expect(portraitFrame(needle, 260, 140, shared).size).toBeCloseTo(portraitFrame(shortFace, 260, 140, shared).size, 9);
    expect(portraitFrame(needle, 260, 140, shared).pixelsPerBodyLength).toBeGreaterThan(portraitFrame(shortFace, 260, 140, shared).pixelsPerBodyLength * 2);
  });

  it('picks fish through the same transform used for drawing', () => {
    const phenotype = FOUNDER_VISUAL_FIXTURES[0].phenotype;
    const actor: Actor = { id: 'a', x: 0.5, y: 0.5, vx: 0.03, vy: 0.012, phase: 0, phenotype };
    const pose = fishPose(actor, 800, 500);
    const forward = (bx: number, by: number) => {
      const x = bx * pose.bodyLength, y = by * pose.bodyLength;
      const rx = x * Math.cos(pose.angle) - y * Math.sin(pose.angle), ry = x * Math.sin(pose.angle) + y * Math.cos(pose.angle);
      return { x: pose.x + rx * pose.flip, y: pose.y + ry };
    };
    const probe = forward(-0.2, 0.05), back = toBodySpace(pose, probe.x, probe.y);
    expect(back.x).toBeCloseTo(-0.2, 9);
    expect(back.y).toBeCloseTo(0.05, 9);
    const centre = forward(0, 0), tip = anatomyFor(phenotype).caudal.upperTip, tail = forward(tip.x - 0.02, tip.y * 0.5);
    expect(pickActor([actor], 800, 500, centre.x, centre.y)).toBe('a');
    expect(pickActor([actor], 800, 500, tail.x, tail.y)).toBe('a');
    expect(pickActor([actor], 800, 500, pose.x, pose.y - 200)).toBeNull();
    expect(pickActor([actor, { ...actor, id: 'b' }], 800, 500, centre.x, centre.y)).toBe('b');
  });
});
