import { describe, expect, it } from 'vitest';
import { anatomyFor, buildAnatomy, portraitFrame, silhouettePoints, validateAnatomy } from '../src/core/anatomy';
import { ADULT_FROM, adultLife, developDay, eggLife, environmentFor, HATCH_LENGTH_CM, INCUBATION_DAYS, type LifeStage } from '../src/core/development';
import { express, founderGenome, metabolicPotential } from '../src/core/genetics';
import {
  appearanceMaturity, HATCHLING_PROPORTIONS, HATCHLING_TRANSLUCENCY, REVEAL_END_DAYS, REVEAL_START_DAYS, stagePhenotype, stageRevealSeries, type Maturity,
} from '../src/core/juvenile';
import { buildOrnament, isEmptyOrnament, type OrnamentShape } from '../src/core/ornament';
import { hash } from '../src/core/random';
import type { Phenotype } from '../src/core/types';
import { ANATOMY_STRESS_FIXTURES, APPEARANCE_VISUAL_FIXTURES, EXTREME_VISUAL_FIXTURES, FOUNDER_VISUAL_FIXTURES } from '../src/core/visualFixtures';
import { defaultWater } from '../src/core/water';
import { currentPhenotype, stagePhenotypeFor } from '../src/rendering/stage';
import { fishPose, pickActor, toBodySpace } from '../src/rendering/tankLayout';
import type { Actor } from '../src/simulation/motion';

const genome = founderGenome(306), adult = express(genome), potential = metabolicPotential(genome);
const healthy = environmentFor(defaultWater(), 5);
const hatchling: Maturity = { body: 0, pigment: 0 };

describe('FS-306 stage appearance', () => {
  it('derives maturity from length and age: eggs and hatchlings start at zero, stock adults stay exactly as drawn before', () => {
    expect(appearanceMaturity(eggLife(), potential.adultLengthCm)).toEqual(hatchling);
    expect(appearanceMaturity({ model: 1, ageDays: INCUBATION_DAYS, lengthCm: HATCH_LENGTH_CM, condition: 1 }, potential.adultLengthCm)).toEqual(hatchling);
    expect(appearanceMaturity(adultLife(genome), potential.adultLengthCm)).toEqual({ body: 1, pigment: 1 });
    expect(appearanceMaturity({ model: 1, ageDays: 40, lengthCm: potential.adultLengthCm * ADULT_FROM, condition: 1 }, potential.adultLengthCm).body).toBe(1);
    expect(appearanceMaturity({ model: 1, ageDays: REVEAL_START_DAYS, lengthCm: 5, condition: 1 }, potential.adultLengthCm).pigment).toBe(0);
    expect(appearanceMaturity({ model: 1, ageDays: REVEAL_END_DAYS, lengthCm: 5, condition: 1 }, potential.adultLengthCm).pigment).toBe(1);
    expect(stagePhenotype(adult, { body: 1, pigment: 1 })).toBe(adult);
    expect(currentPhenotype(adult, { life: adultLife(genome) })).toBe(adult);
    let life = eggLife(), before = appearanceMaturity(life, potential.adultLengthCm);
    for (let day = 1; day <= 60; day++) {
      life = developDay(life, potential, healthy);
      const now = appearanceMaturity(life, potential.adultLengthCm);
      expect(now.body).toBeGreaterThanOrEqual(before.body);
      expect(now.pigment).toBeGreaterThanOrEqual(before.pigment);
      before = now;
    }
    expect(before).toEqual({ body: 1, pigment: 1 });
  });

  it('interpolates hatchling proportions and pigment toward the adult without changing genetics or behavior', () => {
    const frozen = JSON.stringify(adult), young = stagePhenotype(adult, hatchling), half = stagePhenotype(adult, { body: 0.5, pigment: 0.5 });
    expect(JSON.stringify(adult)).toBe(frozen);
    for (const key of ['eye', 'depth', 'snout', 'tail', 'spread', 'dorsal', 'pectoral', 'barbel'] as const) {
      expect(young[key]).toBeCloseTo(adult[key] * HATCHLING_PROPORTIONS[key], 12);
      expect(half[key]).toBeCloseTo(adult[key] * (HATCHLING_PROPORTIONS[key] + (1 - HATCHLING_PROPORTIONS[key]) * 0.5), 12);
    }
    expect(young.head).toBeGreaterThan(adult.head);
    expect([young.red, young.black, young.metallic, young.finPigment, young.speckle]).toEqual([0, 0, 0, 0, 0]);
    expect(young.translucency).toBeGreaterThanOrEqual(HATCHLING_TRANSLUCENCY);
    expect(half.red).toBeCloseTo(adult.red * 0.5, 12);
    const unchanged: (keyof Phenotype)[] = ['length', 'adultLengthCm', 'growth', 'longevity', 'metabolism', 'oxygen', 'fertility', 'speed', 'turning',
      'activity', 'social', 'bold', 'curious', 'frequency', 'patternScale', 'warp', 'symmetry', 'edge', 'yellow', 'white', 'iris', 'pupil', 'mouth', 'fork', 'taper', 'curve', 'eyePosition'];
    for (const key of unchanged) expect(young[key]).toBe(adult[key]);
    expect(young.markings).toBe(adult.markings);
    expect(stagePhenotypeFor(adult, { body: 0.35, pigment: 0.1 })).toBe(stagePhenotypeFor(adult, { body: 0.35, pigment: 0.1 }));
  });

  it('keeps every stage of fixtures and 600 founders attached, finite and framed without clipping', () => {
    const phenotypes = [...FOUNDER_VISUAL_FIXTURES, ...EXTREME_VISUAL_FIXTURES, ...ANATOMY_STRESS_FIXTURES, ...APPEARANCE_VISUAL_FIXTURES].map(f => f.phenotype)
      .concat(Array.from({ length: 600 }, (_, i) => express(founderGenome(hash(`juvenile-test:${i}`)))));
    const maturities: Maturity[] = [hatchling, { body: 0.25, pigment: 0 }, { body: 0.5, pigment: 0.5 }, { body: 0.75, pigment: 1 }];
    const failures: string[] = [];
    let outside = 0;
    phenotypes.forEach((p, i) => maturities.forEach(maturity => {
      const stage = stagePhenotype(p, maturity), anatomy = buildAnatomy(stage), problems = validateAnatomy(anatomy);
      if (problems.length) failures.push(`${i}@${maturity.body}/${maturity.pigment}: ${problems.join(' ')}`);
      if (i < 40) {
        const frame = portraitFrame(stage, 260, 140);
        outside += silhouettePoints(anatomyFor(stage)).filter(v => {
          const x = frame.originX + v.x * frame.pixelsPerBodyLength, y = frame.originY + v.y * frame.pixelsPerBodyLength;
          return x < 0 || x > 260 || y < 0 || y > 140;
        }).length;
      }
    }));
    expect(failures).toEqual([]);
    expect(outside).toBe(0);
  });

  it('reveals ornament gradually: nothing before pigment, the adult ornament at full maturity, bounded in between', () => {
    const points = (shape: OrnamentShape) => shape.type === 'polygon' || shape.type === 'polyline' ? shape.points : [{ x: shape.x, y: shape.y }];
    const alpha = (p: Phenotype, seed: number) => buildOrnament(p, seed, anatomyFor(p)).body.reduce((sum, layer) => sum + layer.alpha * layer.shapes.length, 0);
    for (const fixture of APPEARANCE_VISUAL_FIXTURES) {
      const p = fixture.phenotype, seed = fixture.birthSeed;
      const hidden = stagePhenotype(p, { body: 0.5, pigment: 0 });
      expect(isEmptyOrnament(buildOrnament(hidden, seed, anatomyFor(hidden)))).toBe(true);
      expect(buildOrnament(stagePhenotype(p, { body: 1, pigment: 1 }), seed, anatomyFor(p))).toEqual(buildOrnament(p, seed, anatomyFor(p)));
      const partial = stagePhenotype(p, { body: 0.6, pigment: 0.5 }), anatomy = anatomyFor(partial), b = anatomy.bounds, ornament = buildOrnament(partial, seed, anatomy);
      for (const point of [...ornament.body, ...ornament.caudal, ...ornament.dorsal].flatMap(layer => layer.shapes.flatMap(points))) {
        expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true);
        expect(point.x).toBeGreaterThanOrEqual(b.minX - 0.25); expect(point.x).toBeLessThanOrEqual(b.maxX + 0.25);
        expect(point.y).toBeGreaterThanOrEqual(b.minY - 0.25); expect(point.y).toBeLessThanOrEqual(b.maxY + 0.25);
      }
      expect(alpha(stagePhenotype(p, { body: 1, pigment: 0.5 }), seed)).toBeLessThanOrEqual(alpha(p, seed) + 1e-9);
    }
  });

  it('turns fish smoothly through side-on without breaking the drawing and picking transform', () => {
    const actor: Actor = { id: 'a', x: 0.5, y: 0.5, vx: 0.03, vy: 0.012, phase: 0, phenotype: adult };
    expect(fishPose(actor, 800, 500).flip).toBe(-1);
    expect(fishPose(actor, 800, 500, 1, -1)).toEqual(fishPose(actor, 800, 500));
    const pose = fishPose(actor, 800, 500, 1, -0.5);
    const forward = (bx: number, by: number) => {
      const x = bx * pose.bodyLength, y = by * pose.bodyLength;
      return { x: pose.x + (x * Math.cos(pose.angle) - y * Math.sin(pose.angle)) * pose.flip, y: pose.y + x * Math.sin(pose.angle) + y * Math.cos(pose.angle) };
    };
    const probe = forward(-0.15, 0.04), back = toBodySpace(pose, probe.x, probe.y);
    expect(back.x).toBeCloseTo(-0.15, 9); expect(back.y).toBeCloseTo(0.04, 9);
    const edgeOn = fishPose(actor, 800, 500, 1, 0), local = toBodySpace(edgeOn, edgeOn.x + 40, edgeOn.y + 3);
    expect(Number.isFinite(local.x) && Number.isFinite(local.y)).toBe(true);
    expect(pickActor([actor], 800, 500, edgeOn.x, edgeOn.y, 6, () => 1, () => 0)).toBe('a');
    expect(pickActor([actor], 800, 500, pose.x, pose.y - 200, 6, () => 1, () => -0.5)).toBeNull();
  });

  it('raises a reveal fixture from egg through fry and juvenile, with pigment complete by game day 16', () => {
    const fixture = APPEARANCE_VISUAL_FIXTURES.find(f => f.id === 'appearance-rosettes')!;
    const series = stageRevealSeries(fixture.phenotype, fixture.genome, [0, 3, 6, 9, 12, 16, 30]);
    const order: LifeStage[] = ['egg', 'fry', 'juvenile', 'adult', 'elderly'];
    expect(series.map(frame => frame.day)).toEqual([0, 3, 6, 9, 12, 16, 30]);
    expect(series[0].stage).toBe('egg');
    expect(series[1].stage).toBe('fry');
    expect(series.some(frame => frame.stage === 'juvenile')).toBe(true);
    series.slice(1).forEach((frame, i) => {
      expect(order.indexOf(frame.stage)).toBeGreaterThanOrEqual(order.indexOf(series[i].stage));
      expect(frame.maturity.body).toBeGreaterThanOrEqual(series[i].maturity.body);
    });
    expect(series.find(frame => frame.day === 16)!.maturity.pigment).toBe(1);
    expect(series[1].phenotype.appearance.motifs).toEqual([]);
  });
});
