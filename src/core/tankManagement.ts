import type { Tank } from './types';

/** FS-503: optional on legacy tanks, required by the world v8 decoder. */
export type Decoration = { id: string; kind: 'cover' | 'rock'; x: number; y: number; scale: number; rotation: number };
export const TANK_PRICE = 400;
export const TANK_UPGRADE_PRICE = 300;
export const DECORATION_PRICE = 25;
export const MAX_DECORATIONS = 12;
// Preserve the original planted layout, including its edge positions, through migration.
export const legacyDecorations = (): Decoration[] => [
  { id: 'DC-1', kind: 'cover', x: 0.13, y: 0.8, scale: 1, rotation: 0 },
  { id: 'DC-2', kind: 'cover', x: 0.87, y: 0.8, scale: 1, rotation: 0 },
  { id: 'DC-3', kind: 'rock', x: 0.3, y: 0.76, scale: 1, rotation: 0 },
  { id: 'DC-4', kind: 'rock', x: 0.7, y: 0.76, scale: 1, rotation: 0 },
];
export const decorationsOf = (tank: Pick<Tank, 'planted' | 'decorations'>): Decoration[] => tank.decorations ?? (tank.planted ? legacyDecorations() : []);
export const decorationRadius = (item: Decoration) => (item.kind === 'rock' ? 0.055 : 0.09) * item.scale;
export function validateLayout(items: Decoration[]) {
  if (new Set(items.map(item => item.id)).size !== items.length) throw new Error('Duplicate decoration IDs.');
  for (const item of items) {
    const r = decorationRadius(item) + 0.045;
    if (item.kind === 'rock' && (item.x - r < 0.08 || item.x + r > 0.92 || item.y - r < 0.12 || item.y + r > 0.88)) throw new Error('Move the rock away from the glass to leave swimming space.');
  }
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j];
    if ((a.kind === 'rock' || b.kind === 'rock') && Math.hypot(a.x - b.x, a.y - b.y) < decorationRadius(a) + decorationRadius(b) + (a.kind === 'rock' && b.kind === 'rock' ? 0.09 : 0))
      throw new Error('Leave more swimming space between rocks and other decorations.');
  }
}
