import { describe, expect, it } from 'vitest';
import { axolotlPose } from '../src/core/axolotlPose';
import { buildAxolotlAnatomy, DEFAULT_AXOLOTL_SHAPE, type AxolotlShape } from '../src/core/axolotlAnatomy';
import { axolotlFounderGenome } from '../src/core/axolotlGenetics';
import { createWorld } from '../src/core/world';
import { createBehaviorWorld, feed, stepBehavior } from '../src/simulation/behavior';

describe('axolotl anatomy v2 display pose', () => {
  it('keeps animated extreme silhouettes inside portrait bounds across a full motion cycle', () => {
    for (const extreme of [0, 1]) {
      const shape = { ...DEFAULT_AXOLOTL_SHAPE };
      for (const key of Object.keys(shape) as (keyof AxolotlShape)[]) {
        if (typeof shape[key] === 'number' && !/Count|Seed|length/.test(key)) Object.assign(shape, { [key]: extreme });
      }
      const anatomy = buildAxolotlAnatomy(shape), b = anatomy.bounds;
      for (const grounded of [0, 1]) for (let frame = 0; frame < 80; frame++) {
        const pose = axolotlPose(anatomy, frame * 0.2, 812, { tailPhase: frame * 0.19, limbPhase: frame * 0.31, effort: 1, grounded });
        const limbs = anatomy.limbs.map(pose.limb), gills = anatomy.gills.map(pose.gill);
        const points = [...anatomy.top, ...anatomy.bottom, ...anatomy.dorsalFin, ...anatomy.ventralFin,
          ...limbs.flatMap(l => [l.root,l.joint,l.hand,...l.toes.flatMap(t => [t.start,t.control,t.end])]),
          ...gills.flatMap(g => [g.stalk.start,g.stalk.control,g.stalk.end,...g.fronds.flatMap(f=>[f.start,f.control,f.end])])].map(pose.point);
        for (const p of points) {
          expect(p.x).toBeGreaterThanOrEqual(b.minX); expect(p.x).toBeLessThanOrEqual(b.maxX);
          expect(p.y).toBeGreaterThanOrEqual(b.minY); expect(p.y).toBeLessThanOrEqual(b.maxY);
        }
      }
    }
  });
  it('anchors gills and toes while producing repeatable phase-dependent movement', () => {
    const a = buildAxolotlAnatomy({}), snapshot = JSON.stringify(a);
    const first = axolotlPose(a, 2, 14), repeat = axolotlPose(a, 2, 14), later = axolotlPose(a, 4, 14);
    expect(first.gill(a.gills[0])).toEqual(repeat.gill(a.gills[0]));
    expect(first.gill(a.gills[0])).not.toEqual(later.gill(a.gills[0]));
    expect(first.gill(a.gills[0]).stalk.start).toEqual(a.gills[0].stalk.start);
    for (const limb of a.limbs.map(first.limb)) for (const toe of limb.toes) expect(toe.start).toEqual(limb.hand);
    expect(JSON.stringify(a)).toBe(snapshot);
  });
  it('sanitizes corrupt motion inputs without invalid coordinates', () => {
    const a = buildAxolotlAnatomy({});
    const pose = axolotlPose(a, NaN, 1, { tailPhase: Infinity, limbPhase: NaN, effort: Infinity, grounded: NaN });
    const points = [...a.top.map(pose.point), ...a.limbs.map(pose.limb).map(l=>l.hand), ...a.gills.map(pose.gill).map(g=>g.stalk.end)];
    expect(points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))).toBe(true);
  });
});

describe('axolotl bottom exploration', () => {
  const fish = { ...createWorld('2026-09-19T12:00:00.000Z').fish[0], species: 'axolotl' as const, genome: axolotlFounderGenome(812) };
  it('settles into the lower tank deterministically without modifying fish records', () => {
    const snapshot = JSON.stringify(fish);
    const run = () => {
      let world = createBehaviorWorld([fish], false);
      world.actors[0] = {...world.actors[0], x:0.5, y:0.3, vx:0, vy:0};
      for(let i=0;i<1600;i++) world=stepBehavior(world);
      return world;
    };
    const end = run(); expect(end).toEqual(run());
    expect(end.actors[0].y).toBeGreaterThan(0.70);
    expect(end.actors[0].y).toBeLessThan(0.88);
    expect(JSON.stringify(fish)).toBe(snapshot);
  });
  it('can leave the bottom to pursue food and eat sinking pellets', () => {
    let world = createBehaviorWorld([fish], false);
    world.actors[0] = {...world.actors[0], x:0.5, y:0.79, hunger:0.95, phenotype:{...world.actors[0].phenotype,bold:0.95}};
    world=feed(world,6); let minY=1;
    for(let i=0;i<1600;i++){world=stepBehavior(world);minY=Math.min(minY,world.actors[0].y);}
    expect(minY).toBeLessThan(0.7);
    expect(world.actors[0].meals).toBeGreaterThan(0);
  });
});
