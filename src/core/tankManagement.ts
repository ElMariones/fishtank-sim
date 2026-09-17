import { itemOf, pieceRadius, type TankStyle } from './aquascape';
import type { Tank } from './types';

/**
 * FS-503: optional on legacy tanks, required by the world v8 decoder. FS-117 adds the optional catalog `item` and shape
 * `variant`; a piece without them is an original plant or rock. `rotation` 90–270 draws the piece mirrored.
 */
export type Decoration = { id: string; kind: 'cover' | 'rock'; x: number; y: number; scale: number; rotation: number; item?: string; variant?: number };
export type { TankStyle };
export const TANK_PRICE = 400;
export const TANK_UPGRADE_PRICE = 300;
/** Price of an original FS-503 piece; catalog pieces carry their own prices (aquascape.ts). */
export const DECORATION_PRICE = 25;
export const MAX_DECORATIONS = 24;
// Preserve the original planted layout, including its edge positions, through migration.
export const legacyDecorations = (): Decoration[] => [
  { id: 'DC-1', kind: 'cover', x: 0.13, y: 0.8, scale: 1, rotation: 0 },
  { id: 'DC-2', kind: 'cover', x: 0.87, y: 0.8, scale: 1, rotation: 0 },
  { id: 'DC-3', kind: 'rock', x: 0.3, y: 0.76, scale: 1, rotation: 0 },
  { id: 'DC-4', kind: 'rock', x: 0.7, y: 0.76, scale: 1, rotation: 0 },
];
export const decorationsOf = (tank: Pick<Tank, 'planted' | 'decorations'>): Decoration[] => tank.decorations ?? (tank.planted ? legacyDecorations() : []);
export const decorationRadius = (item: Decoration) => pieceRadius(item);
/** Solids that overlap this much read as one hardscape cluster rather than a narrow gap. */
const CLUSTER_OVERLAP = 0.6;

/**
 * Solids keep glass clearance and either leave a full swimming gap between each other or overlap into one cluster.
 * Plants are permeable and may overlap anything.
 */
export function validateLayout(items: Decoration[]) {
  const problem = layoutProblem(items);
  if (problem) throw new Error(problem.message);
}

/** The first rule a layout breaks, with the pieces involved, so an editor can highlight them. */
export function layoutProblem(items: Decoration[]): { message: string; ids: string[] } | null {
  if (new Set(items.map(item => item.id)).size !== items.length) return { message: 'Duplicate decoration IDs.', ids: [] };
  for (const item of items) {
    if (item.item !== undefined && itemOf(item).kind !== item.kind) return { message: 'A decoration does not match its catalog piece.', ids: [item.id] };
    const r = decorationRadius(item) + 0.045;
    if (item.kind === 'rock' && (item.x - r < 0.08 || item.x + r > 0.92 || item.y - r < 0.12 || item.y + r > 0.88)) return { message: 'Move the rock away from the glass to leave swimming space.', ids: [item.id] };
  }
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j];
    if (a.kind !== 'rock' || b.kind !== 'rock') continue;
    const distance = Math.hypot(a.x - b.x, a.y - b.y), touching = decorationRadius(a) + decorationRadius(b);
    if (distance < touching + 0.09 && distance > touching * CLUSTER_OVERLAP) return { message: 'Leave more swimming space between solid pieces, or push them together into one cluster.', ids: [a.id, b.id] };
  }
  return null;
}
