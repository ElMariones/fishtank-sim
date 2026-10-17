import { describe, expect, it } from 'vitest';
import { DECOR_ITEMS, EFFECTS, facetValue, LIGHTINGS, styleCost, styleOf, THEMES, withFacet, type TankStyle } from '../src/core/aquascape';
import { themeLayout } from '../src/core/aquascapeLayout';
import { ledgerBalance } from '../src/core/economy';
import { commandEnvelope, createRuntime, decodeRuntime, executeCommand } from '../src/core/runtime';
import { decodeSave } from '../src/core/save';
import { applyCommand, commandSchema, createWorld, DISPLAY_CAPACITY, DISPLAY_PRICE, isDisplay, MAX_DISPLAYS, MAX_TANKS, type Command } from '../src/core/world';
import { PIECE_DRAWERS } from '../src/rendering/decor';
import { drawPiece, pieceBox } from '../src/rendering/aquascape';
import { measureWork } from './support/recordingContext';

const NOW = '2026-10-17T12:00:00.000Z';
const display: Command = { type: 'purchase-display' };
const rich = () => ({ ...createWorld(NOW), credits: 20000, ledger: { ...createWorld(NOW).ledger, opening: 20000 } });

describe('Expositorium display aquariums', () => {
  it('opens a five-place display tank kept apart from the eight working tanks, and charges it to the ledger', () => {
    const world = applyCommand(createWorld(NOW), display);
    const tank = world.tanks.find(isDisplay)!;
    expect(tank).toMatchObject({ id: 'display-1', capacity: DISPLAY_CAPACITY, display: true });
    expect(styleOf(tank).lighting).toBe('gallery');
    expect(world.credits).toBe(1200 - DISPLAY_PRICE);
    expect(ledgerBalance(world.ledger)).toBe(world.credits);
    expect(commandSchema.safeParse(display).success).toBe(true);
  });

  it('allows three displays on top of eight working tanks, and never expands a display', () => {
    let world = rich();
    for (let i = 0; i < MAX_DISPLAYS; i++) world = applyCommand(world, display);
    expect(() => applyCommand(world, display)).toThrow('room for 3');
    while (world.tanks.filter(t => !isDisplay(t)).length < MAX_TANKS) world = applyCommand(world, { type: 'purchase-tank' });
    expect(world.tanks).toHaveLength(MAX_TANKS + MAX_DISPLAYS);
    expect(() => applyCommand(world, { type: 'purchase-tank' })).toThrow('eight tanks');
    expect(() => applyCommand(world, { type: 'upgrade-tank', tankId: 'display-1' })).toThrow('five places');
    expect(decodeSave(JSON.stringify(world)).tanks.filter(isDisplay)).toHaveLength(MAX_DISPLAYS);
  });

  it('holds five fish who can still move out, and rejects a sixth without changing the world', () => {
    let world = applyCommand(rich(), display);
    const fish = world.fish.filter(f => f.status === 'living').slice(0, 6);
    for (const member of fish.slice(0, 5)) world = applyCommand(world, { type: 'move', fishId: member.id, tankId: 'display-1' });
    expect(world.fish.filter(f => f.tankId === 'display-1')).toHaveLength(5);
    const before = JSON.stringify(world);
    expect(() => applyCommand(world, { type: 'move', fishId: fish[5].id, tankId: 'display-1' })).toThrow();
    expect(JSON.stringify(world)).toBe(before);
    world = applyCommand(world, { type: 'move', fishId: fish[0].id, tankId: 'tank-1' });
    expect(world.fish.filter(f => f.tankId === 'display-1')).toHaveLength(4);
  });

  it('round-trips through saves and replays from the journal', () => {
    let runtime = createRuntime(createWorld(NOW), 'expo');
    runtime = executeCommand(runtime, commandEnvelope(runtime, display, 1));
    const fishId = runtime.world.fish[0].id;
    runtime = executeCommand(runtime, commandEnvelope(runtime, { type: 'move', fishId, tankId: 'display-1' }, 2));
    const restored = decodeRuntime(JSON.stringify(runtime));
    expect(restored.world).toEqual(runtime.world);
    expect(restored.world.fish.find(f => f.id === fishId)!.tankId).toBe('display-1');
  });

  it('rejects tampered display saves instead of loading them', () => {
    const world = applyCommand(createWorld(NOW), display);
    const resized = { ...world, tanks: world.tanks.map(t => isDisplay(t) ? { ...t, capacity: 60 } : t) };
    expect(() => decodeSave(JSON.stringify(resized))).toThrow('five places');
    const onlyDisplays = { ...world, tanks: world.tanks.filter(isDisplay), fish: world.fish.map(f => ({ ...f, tankId: 'display-1' })) };
    expect(() => decodeSave(JSON.stringify(onlyDisplays))).toThrow();
  });

  it('never adds a display flag to a working tank through a save', () => {
    const world = createWorld(NOW);
    expect(decodeSave(JSON.stringify(world)).tanks.some(t => 'display' in t)).toBe(false);
    expect(world.tanks.some(t => 'display' in t)).toBe(false);
  });
});

describe('Aquascaping set 2: pieces, lights and effects', () => {
  const added = ['plant-anubias', 'plant-rotala', 'plant-crypt', 'rock-dragon', 'rock-arch', 'rock-crystal', 'wood-bonsai', 'orn-torii', 'orn-bridge', 'orn-wreck'];

  it('adds ten catalog pieces, appended after the original 26, each with a drawer that paints', () => {
    expect(DECOR_ITEMS.slice(26).map(entry => entry.id)).toEqual(added);
    for (const entry of DECOR_ITEMS) {
      expect(PIECE_DRAWERS[entry.id], entry.id).toBeDefined();
      for (const variant of [0, 1, 5]) {
        const piece = { id: 'DC-1', kind: entry.kind, item: entry.id, variant, x: 0.5, y: entry.kind === 'rock' ? 0.78 : 0.8, scale: 1, rotation: variant === 5 ? 180 : 0 };
        const work = measureWork(ctx => drawPiece(ctx, piece, pieceBox(piece, 900, 560), 1.5, 'all', 560));
        expect(work.fills + work.strokes, `${entry.id} ${variant}`).toBeGreaterThan(2);
      }
    }
  });

  it('offers six new lightings and seven effects, and charges for each changed facet', () => {
    expect(LIGHTINGS.map(l => l.id)).toEqual(expect.arrayContaining(['gallery', 'deepsea', 'neon', 'ember', 'storm', 'dawn']));
    expect(EFFECTS.filter(e => e.id !== 'none')).toHaveLength(7);
    const base: TankStyle = { substrate: 'sand', backdrop: 'deep', lighting: 'daylight' };
    const styled = withFacet(withFacet(base, 'lighting', 'neon'), 'effect', 'plankton');
    expect(styled).toEqual({ ...base, lighting: 'neon', effect: 'plankton' });
    expect(styleCost(base, styled)).toBe(70 + 45);
    // Choosing no effect removes the key, so the look equals one that never had an effect, and costs nothing.
    expect(withFacet(styled, 'effect', 'none')).toEqual({ ...base, lighting: 'neon' });
    expect(facetValue(base, 'effect')).toBe('none');
    expect(styleCost(styled, withFacet(styled, 'effect', 'none'))).toBe(0);
  });

  it('saves an effect only when one is chosen, so older style commands replay unchanged', () => {
    let world = applyCommand(createWorld(NOW), { type: 'style-tank', tankId: 'tank-1', style: { substrate: 'sand', backdrop: 'deep', lighting: 'storm', effect: 'motes' } });
    expect(world.tanks[0].style).toEqual({ substrate: 'sand', backdrop: 'deep', lighting: 'storm', effect: 'motes' });
    expect(decodeSave(JSON.stringify(world)).tanks[0].style).toEqual(world.tanks[0].style);
    world = applyCommand(world, { type: 'style-tank', tankId: 'tank-1', style: { substrate: 'sand', backdrop: 'deep', lighting: 'daylight' } });
    expect(world.tanks[0].style).toEqual({ substrate: 'sand', backdrop: 'deep', lighting: 'daylight' });
    expect(commandSchema.safeParse({ type: 'style-tank', tankId: 'tank-1', style: { substrate: 'sand', backdrop: 'deep', lighting: 'daylight', effect: 'none' } }).success).toBe(false);
  });

  it('builds the three new themes as valid layouts that use the new pieces', () => {
    for (const id of ['shrine', 'wreck', 'crystal']) {
      const theme = THEMES.find(t => t.id === id)!;
      expect(theme.style.effect).toBeDefined();
      expect(themeLayout(theme).some(piece => added.includes(piece.item!))).toBe(true);
    }
  });
});
