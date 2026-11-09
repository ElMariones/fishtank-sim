import { describe, expect, it } from 'vitest';
import {
  APPRAISAL_WEIGHTS, appraise, clampZoom, curatorNotes, decodeJournal, gradeFor, karyotype, MAX_ZOOM, MIN_ZOOM, pedigreeRows, scaleBar,
  siblingsOf, starsFor, studioMarks, withJournalEntry, zoomAt,
} from '../src/core/specimen';
import { applyCommand, createWorld } from '../src/core/world';
import { GENOME_VERSION } from '../src/core/catalog';
import type { World } from '../src/core/types';

const NOW = '2026-11-09T12:00:00.000Z';

function bred(): World {
  let world = createWorld(NOW);
  const mother = world.fish.find(f => f.sex === 'F' && f.species === 'koi')!, father = world.fish.find(f => f.sex === 'M' && f.species === 'koi')!;
  world = applyCommand(world, { type: 'breed', motherId: mother.id, fatherId: father.id, tankId: mother.tankId, timestamp: NOW, genomeVersion: GENOME_VERSION, count: 4 });
  return world;
}

describe('specimen studio (FS-134)', () => {
  it('appraises every species deterministically on five weighted axes without changing the world', () => {
    const world = bred(), before = JSON.stringify(world);
    expect(Object.values(APPRAISAL_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    for (const fish of world.fish) {
      const a = appraise(fish, 0), b = appraise(fish, 0);
      expect(a).toEqual(b);
      expect(a.axes.map(axis => axis.key)).toEqual(['form', 'pattern', 'condition', 'rarity', 'diversity']);
      for (const axis of a.axes) { expect(axis.score).toBeGreaterThanOrEqual(0); expect(axis.score).toBeLessThanOrEqual(100); }
      expect(a.grade).toBe(gradeFor(a.overall));
      expect(a.stars).toBeGreaterThanOrEqual(0.5); expect(a.stars).toBeLessThanOrEqual(5);
    }
    expect(JSON.stringify(world)).toBe(before);
    // Inbreeding lowers only the diversity axis.
    const fish = world.fish[0], outbred = appraise(fish, 0), inbred = appraise(fish, 0.25);
    expect(inbred.axes[4].score).toBeLessThan(outbred.axes[4].score);
    expect(inbred.axes.slice(0, 4)).toEqual(outbred.axes.slice(0, 4));
  });

  it('maps grades and stars on fixed floors', () => {
    expect(gradeFor(90)).toBe('S'); expect(gradeFor(70)).toBe('A'); expect(gradeFor(69.9)).toBe('B'); expect(gradeFor(46)).toBe('C'); expect(gradeFor(0)).toBe('D');
    expect(starsFor(100)).toBe(5); expect(starsFor(0)).toBe(0.5); expect(starsFor(61)).toBe(3);
  });

  it('derives marks from records: founders, lab-bred offspring and close kin', () => {
    const world = bred(), founder = world.fish.find(f => !f.parents)!, child = world.fish.find(f => f.parents)!;
    expect(studioMarks(world, founder, 0).find(m => m.id === 'founder')!.name).toBe('Founder');
    expect(studioMarks(world, child, 0).find(m => m.id === 'founder')!.name).toBe(`Lab-bred · G${child.generation}`);
    expect(studioMarks(world, child, 0).find(m => m.id === 'outbred')!.earned).toBe(true);
    expect(studioMarks(world, child, 0.25).some(m => m.id === 'kin' && m.earned)).toBe(true);
    expect(studioMarks(world, child, 0).some(m => m.id === 'kin')).toBe(false);
    const parent = world.fish.find(f => f.id === child.parents![0])!;
    expect(studioMarks(world, parent, 0).find(m => m.id === 'prolific')!.earned).toBe(false);
  });

  it('writes stable curator notes from the record', () => {
    const world = bred();
    for (const fish of world.fish.slice(0, 8)) {
      const notes = curatorNotes(world, fish);
      expect(notes).toHaveLength(3);
      expect(curatorNotes(world, fish)).toEqual(notes);
      expect(notes.join(' ')).not.toMatch(/undefined|NaN/);
    }
  });

  it('builds a karyotype in registry order and hides alleles in discovery mode until sequenced', () => {
    const world = bred();
    for (const species of ['koi', 'axolotl', 'goldfish', 'guppy'] as const) {
      const fish = world.fish.find(f => f.species === species);
      if (!fish) continue;
      const karyo = karyotype(world, fish), loci = karyo.flatMap(c => c.loci);
      expect(loci.map(l => l.index)).toEqual(loci.map((_, i) => i));
      expect(karyo.length).toBeGreaterThan(5);
    }
    const discovery: World = { ...world, atlas: { ...world.atlas, mode: 'discovery', sequenced: [] } };
    const fish = discovery.fish[0], hidden = karyotype(discovery, fish).flatMap(c => c.loci).filter(l => l.state !== 'absent');
    expect(hidden.every(l => l.state === 'hidden' && l.maternal === null)).toBe(true);
    const scientist: World = { ...world, atlas: { ...world.atlas, mode: 'scientist' } };
    const shown = karyotype(scientist, fish).flatMap(c => c.loci).filter(l => l.state !== 'absent');
    expect(shown.every(l => l.known && l.maternal !== null)).toBe(true);
  });

  it('charts three generations and finds siblings', () => {
    const world = bred(), child = world.fish.find(f => f.parents)!;
    const rows = pedigreeRows(world.fish, child.id);
    expect(rows.map(r => r.length)).toEqual([1, 2, 4]);
    expect(rows[1].map(f => f?.id)).toEqual(child.parents);
    expect(rows[2].every(f => f === null)).toBe(true);
    const { full } = siblingsOf(world.fish, child);
    expect(full.length).toBeGreaterThan(0);
    expect(full.some(f => f.id === child.id)).toBe(false);
  });

  it('decodes journal notes defensively and removes empty entries', () => {
    expect(decodeJournal(null)).toEqual({});
    expect(decodeJournal('{bad')).toEqual({});
    expect(decodeJournal('[1]')).toEqual({});
    const decoded = decodeJournal(JSON.stringify({ a: { text: 'Nice fins', tags: ['Keeper', 'Nope', 'Keeper'], updatedAt: NOW }, b: { text: 3 }, c: null }));
    expect(decoded).toEqual({ a: { text: 'Nice fins', tags: ['Keeper'], updatedAt: NOW } });
    const added = withJournalEntry({}, 'x', { text: 'hello', tags: ['Watch'] }, NOW);
    expect(added.x.text).toBe('hello');
    expect(withJournalEntry(added, 'x', { text: '  ', tags: [] }, NOW)).toEqual({});
  });

  it('zooms about the pointer within limits and picks 1–2–5 scale bars', () => {
    const view = zoomAt({ zoom: 1, x: 0, y: 0 }, 2, 100, 50);
    expect(view).toEqual({ zoom: 2, x: -100, y: -50 });
    // The point under the pointer stays put: (p - x) / zoom is unchanged.
    expect((100 - view.x) / view.zoom).toBeCloseTo(100, 9);
    expect(clampZoom(100)).toBe(MAX_ZOOM); expect(clampZoom(0.01)).toBe(MIN_ZOOM);
    const bar = scaleBar(0.05);
    expect([0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100]).toContain(bar.cm);
    expect(bar.px).toBeGreaterThanOrEqual(60); expect(bar.px).toBeLessThanOrEqual(160);
  });
});
