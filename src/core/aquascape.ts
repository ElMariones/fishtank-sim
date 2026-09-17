import type { Decoration } from './tankManagement';

/**
 * Aquascape catalog (FS-117): decoration pieces, tank looks and ready-made themes. Every piece still behaves as one of the
 * two FS-503 footprint kinds: plants are permeable cover that shy fish seek, everything else is solid and steered around.
 * Looks (substrate, backdrop, lighting) are cosmetic: they never change water, growth or behavior.
 */

export type DecorCategory = 'plants' | 'rocks' | 'wood' | 'ornaments';
/** `ground` pieces rest on the substrate; `surface` pieces float at the waterline. */
export type DecorMount = 'ground' | 'surface';
export type DecorItem = {
  id: string; name: string; category: DecorCategory; kind: Decoration['kind']; mount: DecorMount;
  /** Footprint radius at scale 1, normalized tank units. */
  radius: number; price: number; blurb: string;
};

const item = (id: string, name: string, category: DecorCategory, kind: Decoration['kind'], radius: number, price: number, blurb: string, mount: DecorMount = 'ground'): DecorItem =>
  ({ id, name, category, kind, mount, radius, price, blurb });

/** Stable IDs: saved layouts reference them. Append new pieces; never rename or remove one. */
export const DECOR_ITEMS = [
  item('plant-vallisneria', 'Jungle vallisneria', 'plants', 'cover', 0.09, 20, 'Tall ribbon leaves that sway in the current.'),
  item('plant-sword', 'Amazon sword', 'plants', 'cover', 0.085, 30, 'Broad rosette of lance-shaped leaves.'),
  item('plant-fern', 'Java fern', 'plants', 'cover', 0.07, 25, 'Dark, textured fronds with a rugged outline.'),
  item('plant-ludwigia', 'Red ludwigia', 'plants', 'cover', 0.075, 35, 'Stem plant that blushes red toward the light.'),
  item('plant-cabomba', 'Green cabomba', 'plants', 'cover', 0.075, 30, 'Feathery whorls on long, soft stems.'),
  item('plant-hairgrass', 'Dwarf hairgrass', 'plants', 'cover', 0.08, 20, 'A low, bright green carpet.'),
  item('plant-moss', 'Marimo moss balls', 'plants', 'cover', 0.05, 15, 'Velvety green spheres on the sand.'),
  item('plant-lotus', 'Tiger lotus', 'plants', 'cover', 0.08, 45, 'Mottled red leaves with pads reaching the surface.'),
  item('plant-frogbit', 'Floating frogbit', 'plants', 'cover', 0.08, 20, 'Round floating leaves with trailing roots.', 'surface'),
  item('rock-river', 'River stones', 'rocks', 'rock', 0.055, 20, 'Smooth, water-worn pebbles in a small cairn.'),
  item('rock-seiryu', 'Seiryu stone', 'rocks', 'rock', 0.065, 35, 'Jagged blue-grey stone veined with white.'),
  item('rock-lava', 'Lava rock', 'rocks', 'rock', 0.05, 25, 'Porous volcanic stone in deep red-black.'),
  item('rock-slate', 'Slate stack', 'rocks', 'rock', 0.06, 30, 'Layered plates of dark slate.'),
  item('rock-boulder', 'Granite boulder', 'rocks', 'rock', 0.085, 45, 'A heavy speckled centrepiece.'),
  item('rock-cave', 'Rock cave', 'rocks', 'rock', 0.075, 55, 'A stone mound with a shadowed grotto.'),
  item('wood-drift', 'Driftwood', 'wood', 'rock', 0.07, 35, 'Bleached, twisting branch wood.'),
  item('wood-spider', 'Spider wood', 'wood', 'rock', 0.075, 40, 'Fine reaching branches from a gnarled base.'),
  item('wood-log', 'Hollow log', 'wood', 'rock', 0.06, 30, 'A sunken bark log with a dark hollow.'),
  item('wood-roots', 'Mangrove roots', 'wood', 'rock', 0.07, 45, 'Arching roots that reach into the sand.'),
  item('orn-pagoda', 'Stone pagoda', 'ornaments', 'rock', 0.06, 60, 'A three-tiered garden pagoda.'),
  item('orn-lantern', 'Stone lantern', 'ornaments', 'rock', 0.045, 40, 'A tōrō lantern with a warm glow.'),
  item('orn-castle', 'Castle ruin', 'ornaments', 'rock', 0.075, 70, 'Crumbling towers from a sunken keep.'),
  item('orn-amphora', 'Sunken amphora', 'ornaments', 'rock', 0.045, 35, 'A tipped clay jar from an old wreck.'),
  item('orn-chest', 'Treasure chest', 'ornaments', 'rock', 0.045, 50, 'Lid ajar, with the odd escaping bubble.'),
  item('orn-clam', 'Giant clam', 'ornaments', 'rock', 0.04, 40, 'A fluted shell holding a pearl.'),
  item('orn-bubbler', 'Air stone', 'ornaments', 'rock', 0.03, 15, 'A steady column of fine bubbles.'),
] as const satisfies readonly DecorItem[];
export type DecorItemId = typeof DECOR_ITEMS[number]['id'];
export const DECOR_ITEM_IDS = DECOR_ITEMS.map(entry => entry.id) as [DecorItemId, ...DecorItemId[]];
const byId = new Map<string, DecorItem>(DECOR_ITEMS.map(entry => [entry.id, entry]));
/** FS-503 layouts name no piece: their plants and rocks keep the original radii and price. */
export const LEGACY_ITEM: Record<Decoration['kind'], DecorItemId> = { cover: 'plant-vallisneria', rock: 'rock-river' };
export const LEGACY_PIECE_PRICE = 25;
export const DECOR_CATEGORIES: { id: DecorCategory; label: string }[] = [
  { id: 'plants', label: 'Plants' }, { id: 'rocks', label: 'Rocks' }, { id: 'wood', label: 'Wood' }, { id: 'ornaments', label: 'Ornaments' },
];
/** Shape variants per piece: each draws a different silhouette from the same catalog entry. */
export const DECOR_VARIANTS = 8;

export const decorItem = (id: string): DecorItem | undefined => byId.get(id);
export const itemOf = (piece: Pick<Decoration, 'kind' | 'item'>): DecorItem => byId.get(piece.item ?? LEGACY_ITEM[piece.kind])!;
export const piecePrice = (piece: Pick<Decoration, 'kind' | 'item'>) => piece.item ? itemOf(piece).price : LEGACY_PIECE_PRICE;
export const pieceRadius = (piece: Pick<Decoration, 'kind' | 'item' | 'scale'>) => (piece.item ? itemOf(piece).radius : piece.kind === 'rock' ? 0.055 : 0.09) * piece.scale;

/** Fish stay between these body-centre bounds (behavior.ts); solids keep their clearance inside them. */
const CLEARANCE = 0.045, FLOOR_Y = 0.88, WALL_X = [0.08, 0.92] as const;
export const SCALE_RANGE = [0.5, 1.25] as const;
export const SURFACE_Y = 0.2;

/**
 * Settle a piece where it belongs for its mount: solids rest just above the floor limit with glass clearance, plants root
 * in the substrate and floating plants sit at the waterline. The result always passes the per-piece layout rules.
 */
export function settle(piece: Decoration): Decoration {
  const entry = itemOf(piece), scale = round(Math.min(SCALE_RANGE[1], Math.max(SCALE_RANGE[0], piece.scale))), r = pieceRadius({ ...piece, scale });
  let x: number, y: number;
  if (piece.kind === 'rock') {
    x = clamp(piece.x, WALL_X[0] + r + CLEARANCE + 0.002, WALL_X[1] - r - CLEARANCE - 0.002);
    y = Math.max(SURFACE_Y, FLOOR_Y - CLEARANCE - r - 0.002);
  } else {
    x = clamp(piece.x, 0.1, 0.9);
    y = entry.mount === 'surface' ? SURFACE_Y : clamp(0.9 - r * 0.9, SURFACE_Y, 0.85);
  }
  return { ...piece, scale, x: round(x, 4), y: round(y, 4) };
}
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;

// ---- Tank looks ----------------------------------------------------------------------------------------------------

export type StyleFacet = 'substrate' | 'backdrop' | 'lighting';
export type StyleOption = { id: string; name: string; price: number; swatch: string[]; blurb: string };
const option = (id: string, name: string, price: number, swatch: string[], blurb: string): StyleOption => ({ id, name, price, swatch, blurb });

export const SUBSTRATES = [
  option('sand', 'Fine sand', 0, ['#d9c49a', '#b89f74'], 'Soft golden sand.'),
  option('gravel', 'Mixed gravel', 30, ['#9a8f84', '#5f5a55', '#c9b79b'], 'Multicoloured aquarium gravel.'),
  option('pebbles', 'River pebbles', 40, ['#8c877c', '#b8ad98', '#5d6461'], 'Large rounded pebbles.'),
  option('black', 'Black sand', 40, ['#2a2d31', '#474b50'], 'Glittering volcanic black sand.'),
  option('soil', 'Aqua soil', 35, ['#3d2c22', '#5a4131'], 'Dark, rich planting soil.'),
  option('coral', 'Coral sand', 45, ['#f1e6da', '#e8c6be'], 'Bright crushed coral with pink flecks.'),
] as const satisfies readonly StyleOption[];
export const BACKDROPS = [
  option('deep', 'Deep lagoon', 0, ['#1d5560', '#0a2630'], 'Teal water fading to depth.'),
  option('clear', 'Clear spring', 20, ['#4ba9b7', '#1b5c6d'], 'Bright, crystal-clear water.'),
  option('black', 'Blackout', 20, ['#10181c', '#05080a'], 'A black backing that makes colour pop.'),
  option('forest', 'Misty forest', 50, ['#2f5b48', '#12291f'], 'Silhouettes of a submerged forest.'),
  option('mountains', 'Mountain mist', 50, ['#557a8a', '#1a3340'], 'Layered ridges in the haze.'),
  option('blackwater', 'Tannin creek', 35, ['#6a4a22', '#241508'], 'Tea-coloured water from fallen leaves.'),
] as const satisfies readonly StyleOption[];
export const LIGHTINGS = [
  option('daylight', 'Daylight', 0, ['#f6fbff', '#bfe9ff'], 'Neutral white light with soft rays.'),
  option('tropical', 'Tropical noon', 40, ['#fff6c8', '#6fe9ff'], 'Bright sun with strong ripples.'),
  option('sunset', 'Golden hour', 40, ['#ffc27a', '#ff7a59'], 'Low, warm amber light.'),
  option('moonlight', 'Moonlight', 40, ['#8fb2ff', '#2b3d7a'], 'Dim blue night; lanterns glow.'),
  option('grow', 'Grow LED', 50, ['#ff9ee6', '#9ad7ff'], 'Full-spectrum pink-white planted light.'),
  option('aurora', 'Aurora RGB', 80, ['#6dffb5', '#8a7dff', '#ff7ad9'], 'Slowly cycling coloured light.'),
] as const satisfies readonly StyleOption[];
export const STYLE_OPTIONS = { substrate: SUBSTRATES, backdrop: BACKDROPS, lighting: LIGHTINGS } as const;
export type TankStyle = { substrate: typeof SUBSTRATES[number]['id']; backdrop: typeof BACKDROPS[number]['id']; lighting: typeof LIGHTINGS[number]['id'] };
/** Tanks without a saved look use the free options. */
export const DEFAULT_STYLE: TankStyle = { substrate: 'sand', backdrop: 'deep', lighting: 'daylight' };
export const styleOf = (tank: { style?: TankStyle }): TankStyle => tank.style ?? DEFAULT_STYLE;
export const styleOption = (facet: StyleFacet, id: string): StyleOption => (STYLE_OPTIONS[facet] as readonly StyleOption[]).find(entry => entry.id === id) ?? STYLE_OPTIONS[facet][0];
/** Each facet changed to a paid option is charged at that option's price; returning to a free option costs nothing. */
export const styleCost = (from: TankStyle, to: TankStyle) =>
  (['substrate', 'backdrop', 'lighting'] as const).reduce((sum, facet) => sum + (from[facet] === to[facet] ? 0 : styleOption(facet, to[facet]).price), 0);

// ---- Themes ---------------------------------------------------------------------------------------------------------

type ThemePiece = [DecorItemId, number, number?, number?];
export type Theme = { id: string; name: string; blurb: string; style: TankStyle; pieces: ThemePiece[] };
/** Ready-made aquascapes: [piece, x, scale = 1, variant = 0]. Tests keep each one valid. */
export const THEMES: Theme[] = [
  { id: 'zen', name: 'Zen koi garden', blurb: 'Pagoda, lantern and raked sand under warm light.', style: { substrate: 'sand', backdrop: 'mountains', lighting: 'sunset' }, pieces: [
    ['orn-pagoda', 0.24, 1.1], ['plant-hairgrass', 0.38, 1], ['rock-river', 0.46, 0.8, 2], ['orn-lantern', 0.72, 1], ['plant-vallisneria', 0.88, 1.1, 1], ['plant-moss', 0.6, 0.9], ['plant-frogbit', 0.7, 1],
  ] },
  { id: 'nature', name: 'Nature aquarium', blurb: 'Dense planting around driftwood on rich soil.', style: { substrate: 'soil', backdrop: 'forest', lighting: 'grow' }, pieces: [
    ['plant-vallisneria', 0.12, 1.2], ['plant-ludwigia', 0.24, 1.1, 3], ['wood-spider', 0.45, 1.15, 1], ['plant-sword', 0.62, 1.1], ['plant-cabomba', 0.78, 1.1, 2], ['plant-fern', 0.9, 1], ['plant-hairgrass', 0.36, 1.2, 4], ['plant-hairgrass', 0.7, 1, 5],
  ] },
  { id: 'iwagumi', name: 'Iwagumi', blurb: 'Seiryu stones over a clean carpet.', style: { substrate: 'gravel', backdrop: 'clear', lighting: 'daylight' }, pieces: [
    ['rock-seiryu', 0.4, 1.2, 0], ['rock-seiryu', 0.24, 0.8, 3], ['rock-seiryu', 0.66, 0.9, 5], ['plant-hairgrass', 0.14, 1.1], ['plant-hairgrass', 0.52, 1.2, 2], ['plant-hairgrass', 0.86, 1.1, 4],
  ] },
  { id: 'blackwater', name: 'Blackwater creek', blurb: 'Roots and leaf-stained water in amber light.', style: { substrate: 'soil', backdrop: 'blackwater', lighting: 'sunset' }, pieces: [
    ['wood-roots', 0.28, 1.2], ['wood-log', 0.68, 1.1, 2], ['plant-fern', 0.48, 1], ['plant-lotus', 0.86, 1.1], ['plant-frogbit', 0.4, 1.2], ['plant-frogbit', 0.62, 0.9, 3],
  ] },
  { id: 'ruins', name: 'Sunken ruins', blurb: 'A castle keep, lost amphorae and treasure.', style: { substrate: 'pebbles', backdrop: 'deep', lighting: 'tropical' }, pieces: [
    ['orn-castle', 0.3, 1.15], ['orn-amphora', 0.56, 1, 1], ['orn-chest', 0.74, 1], ['plant-vallisneria', 0.1, 1.1], ['plant-cabomba', 0.9, 1], ['rock-slate', 0.52, 0.7, 2], ['orn-bubbler', 0.62, 1],
  ] },
  { id: 'lagoon', name: 'Coral lagoon', blurb: 'Bright coral sand, shells and sunlit ripples.', style: { substrate: 'coral', backdrop: 'clear', lighting: 'tropical' }, pieces: [
    ['orn-clam', 0.3, 1.1], ['rock-lava', 0.5, 1.1, 1], ['orn-clam', 0.72, 0.8, 3], ['plant-sword', 0.14, 0.9], ['plant-moss', 0.86, 1.1], ['orn-bubbler', 0.62, 1],
  ] },
  { id: 'moonlit', name: 'Moonlit pond', blurb: 'Glowing lanterns and lotus in blue night.', style: { substrate: 'black', backdrop: 'black', lighting: 'moonlight' }, pieces: [
    ['orn-lantern', 0.26, 1.2], ['orn-lantern', 0.7, 0.9, 1], ['rock-boulder', 0.48, 0.9, 2], ['plant-lotus', 0.12, 1.1], ['plant-vallisneria', 0.88, 1], ['plant-frogbit', 0.5, 1.1],
  ] },
  { id: 'aurora', name: 'Aurora grotto', blurb: 'Cave rock and lava under cycling colour.', style: { substrate: 'black', backdrop: 'deep', lighting: 'aurora' }, pieces: [
    ['rock-cave', 0.36, 1.2], ['rock-lava', 0.64, 1, 4], ['plant-cabomba', 0.12, 1.1, 1], ['plant-ludwigia', 0.86, 1.1], ['orn-bubbler', 0.52, 1],
  ] },
  { id: 'bare', name: 'Bare breeding tank', blurb: 'Open water and clean sand for easy watching.', style: DEFAULT_STYLE, pieces: [
    ['plant-moss', 0.2, 1], ['plant-moss', 0.8, 1, 1],
  ] },
];
