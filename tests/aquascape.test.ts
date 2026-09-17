import { describe, expect, it } from 'vitest';
import { DECOR_ITEMS, DEFAULT_STYLE, LIGHTINGS, settle, styleCost, styleOf, THEMES, type TankStyle } from '../src/core/aquascape';
import { nearestValid, placePiece, themeLayout } from '../src/core/aquascapeLayout';
import { ledgerBalance } from '../src/core/economy';
import { advanceRuntime, commandEnvelope, createRuntime, decodeRuntime, executeCommand } from '../src/core/runtime';
import { decodeSave } from '../src/core/save';
import { decorationsOf, layoutProblem, MAX_DECORATIONS, validateLayout, type Decoration } from '../src/core/tankManagement';
import { applyCommand, commandSchema, createWorld, type Command } from '../src/core/world';
import { habitatFootprints } from '../src/simulation/footprints';

const NOW = '2026-09-17T12:00:00.000Z';
const place = (decorations: Decoration[], tankId = 'tank-2'): Command => ({ type: 'place-decorations', tankId, decorations });

describe('FS-117 aquascape catalog and looks', () => {
  it('settles every piece at every size and position into a valid single-piece layout', () => {
    for (const entry of DECOR_ITEMS) for (const scale of [0.5, 1, 1.25]) for (const x of [0, 0.3, 0.5, 0.95]) {
      const piece = settle({ id: 'DC-1', kind: entry.kind, item: entry.id, variant: 3, x, y: 0.5, scale, rotation: 0 });
      expect(layoutProblem([piece]), `${entry.id} ${scale} ${x}`).toBeNull();
      expect(commandSchema.safeParse(place([piece])).success).toBe(true);
    }
  });

  it('builds every theme as a valid, affordable layout within the piece limit', () => {
    for (const theme of THEMES) {
      const layout = themeLayout(theme, 10);
      expect(layout.length).toBeLessThanOrEqual(MAX_DECORATIONS);
      expect(layoutProblem(layout), theme.id).toBeNull();
      expect(layout.map(piece => piece.id)).toEqual(layout.map((_, i) => `DC-${10 + i}`));
      const world = applyCommand(applyCommand(createWorld(NOW), place(layout)), { type: 'style-tank', tankId: 'tank-2', style: theme.style });
      expect(decorationsOf(world.tanks[1])).toEqual(layout);
      expect(styleOf(world.tanks[1])).toEqual(theme.style);
    }
  });

  it('slides a dropped solid out of the no-gap zone and places new pieces in open water', () => {
    const rock = settle({ id: 'DC-1', kind: 'rock', item: 'rock-boulder', x: 0.5, y: 0.5, scale: 1, rotation: 0 });
    const squeezed = settle({ id: 'DC-2', kind: 'rock', item: 'rock-seiryu', x: 0.62, y: 0.5, scale: 1, rotation: 0 });
    expect(layoutProblem([rock, squeezed])?.ids).toEqual(['DC-1', 'DC-2']);
    const fixed = nearestValid([rock, squeezed], 'DC-2');
    expect(layoutProblem(fixed)).toBeNull();
    expect(fixed[0]).toEqual(rock);
    const added = placePiece(fixed, 'orn-castle');
    expect(added.id).toBe('DC-3');
    expect(layoutProblem([...fixed, added])).toBeNull();
    // Plants may overlap solids: they are permeable cover.
    expect(layoutProblem([rock, settle({ id: 'DC-4', kind: 'cover', item: 'plant-sword', x: 0.5, y: 0.5, scale: 1, rotation: 0 })])).toBeNull();
  });

  it('charges catalog prices for new pieces, including a different piece under a reused ID, and nothing for moves or reshapes', () => {
    const castle = settle({ id: 'DC-1', kind: 'rock', item: 'orn-castle', x: 0.4, y: 0.5, scale: 1, rotation: 0 });
    let world = applyCommand(createWorld(NOW), place([castle]));
    expect(world.credits).toBe(1200 - 70);
    world = applyCommand(world, place([settle({ ...castle, x: 0.6, variant: 5, rotation: 180, scale: 1.2 })]));
    expect(world.credits).toBe(1130);
    world = applyCommand(world, place([settle({ ...castle, item: 'orn-lantern', variant: 0 })]));
    expect(world.credits).toBe(1130 - 40);
    expect(() => applyCommand(world, place([{ ...castle, kind: 'cover' }]))).toThrow('catalog');
    expect(ledgerBalance(world.ledger)).toBe(world.credits);
    expect(world.tanks[1].planted).toBe(false);
  });

  it('charges each changed look facet once, keeps water untouched and rejects unaffordable looks atomically', () => {
    const tropical: TankStyle = { substrate: 'coral', backdrop: 'clear', lighting: 'tropical' };
    expect(styleCost(DEFAULT_STYLE, tropical)).toBe(45 + 20 + 40);
    expect(styleCost(tropical, DEFAULT_STYLE)).toBe(0);
    const world = createWorld(NOW), water = structuredClone(world.tanks[0].water);
    const styled = applyCommand(world, { type: 'style-tank', tankId: 'tank-1', style: tropical });
    expect(styled.credits).toBe(1200 - 105);
    expect(styled.tanks[0].water).toEqual(water);
    expect(styled.ledger.entries.at(-1)).toMatchObject({ reason: 'equipment', amount: -105 });
    expect(decodeSave(JSON.stringify(styled))).toEqual(styled);
    const poor = { ...world, credits: 10, ledger: { ...world.ledger, opening: 10 } }, before = JSON.stringify(poor);
    expect(() => applyCommand(poor, { type: 'style-tank', tankId: 'tank-1', style: { ...DEFAULT_STYLE, lighting: LIGHTINGS[5].id } })).toThrow('costs');
    expect(JSON.stringify(poor)).toBe(before);
    expect(commandSchema.safeParse({ type: 'style-tank', tankId: 'tank-1', style: { ...tropical, lighting: 'disco' } }).success).toBe(false);
  });

  it('replays looks and catalog layouts after time passes, and leaves unstyled FS-503 saves unchanged', () => {
    let runtime = createRuntime(createWorld(NOW), 'fs117');
    const zen = THEMES.find(theme => theme.id === 'zen')!;
    for (const command of [place(themeLayout(zen)), { type: 'style-tank', tankId: 'tank-2', style: zen.style }] as Command[]) {
      runtime = executeCommand(runtime, commandEnvelope(runtime, command, runtime.tick + 50));
      runtime = advanceRuntime(runtime, runtime.tick + 2400);
      expect(decodeRuntime(JSON.stringify(runtime))).toEqual(runtime);
    }
    const tampered = JSON.parse(JSON.stringify(runtime)); tampered.world.tanks[1].style.lighting = 'aurora';
    expect(() => decodeRuntime(JSON.stringify(tampered))).toThrow('replay');
    const legacy = createWorld(NOW);
    expect(legacy.tanks[0]).not.toHaveProperty('style');
    expect(styleOf(legacy.tanks[0])).toEqual(DEFAULT_STYLE);
    expect(decodeSave(JSON.stringify(legacy))).toEqual(legacy);
    expect(() => validateLayout(decorationsOf(legacy.tanks[0]))).not.toThrow();
  });

  it('gives catalog pieces their own footprint radius for steering', () => {
    const boulder = settle({ id: 'DC-1', kind: 'rock', item: 'rock-boulder', x: 0.5, y: 0.5, scale: 1.2, rotation: 0 });
    const world = applyCommand(createWorld(NOW), place([boulder]));
    expect(habitatFootprints(world.tanks[1])[0]).toMatchObject({ kind: 'rock', radius: 0.085 * 1.2, x: boulder.x, y: boulder.y });
  });
});
