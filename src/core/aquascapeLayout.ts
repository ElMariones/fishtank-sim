import { DECOR_VARIANTS, decorItem, settle, type Theme } from './aquascape';
import { layoutProblem, type Decoration } from './tankManagement';

/**
 * Placement helpers shared by the aquascape editor and themes (FS-117). Pieces settle into their mount, and a piece that
 * lands between "full swimming gap" and "one cluster" slides to the nearest valid spot instead of blocking the layout.
 */

export const nextPieceId = (pieces: readonly Decoration[], saved: readonly Decoration[] = []) =>
  `DC-${Math.max(0, ...[...pieces, ...saved].map(piece => Number(piece.id.slice(3)) || 0)) + 1}`;

/** Slide piece `id` left or right to the closest position where it breaks no layout rule. */
export function nearestValid(pieces: Decoration[], id: string): Decoration[] {
  if (!layoutProblem(pieces)?.ids.includes(id)) return pieces;
  const piece = pieces.find(entry => entry.id === id)!;
  for (let step = 0.005; step <= 0.5; step += 0.005) for (const direction of [-1, 1]) {
    const moved = settle({ ...piece, x: piece.x + direction * step }), layout = pieces.map(entry => entry.id === id ? moved : entry);
    if (!layoutProblem(layout)?.ids.includes(id)) return layout;
  }
  return pieces;
}

/**
 * A new settled piece. With `x` it goes there (sliding if needed); without, it takes the open spot farthest from the
 * other pieces, preferring the middle of the tank.
 */
export function placePiece(pieces: Decoration[], itemId: string, options: { saved?: readonly Decoration[]; x?: number; variant?: number; mirrored?: boolean } = {}): Decoration {
  const entry = decorItem(itemId);
  if (!entry) throw new Error('Unknown decoration piece.');
  const base: Decoration = {
    id: nextPieceId(pieces, options.saved), kind: entry.kind, item: entry.id, variant: (options.variant ?? 0) % DECOR_VARIANTS,
    x: options.x ?? 0.5, y: 0.5, scale: 1, rotation: options.mirrored ? 180 : 0,
  };
  if (options.x !== undefined) return nearestValid([...pieces, settle(base)], base.id).find(piece => piece.id === base.id)!;
  let best = settle(base), bestScore = -Infinity;
  for (let candidate = 0.12; candidate <= 0.881; candidate += 0.01) {
    const piece = settle({ ...base, x: candidate });
    if (layoutProblem([...pieces, piece])) continue;
    const spacing = Math.min(1, ...pieces.map(other => Math.abs(other.x - piece.x) * (other.kind === piece.kind ? 1 : 2)));
    const score = spacing - Math.abs(candidate - 0.5) * 0.05;
    if (score > bestScore) { best = piece; bestScore = score; }
  }
  return best;
}

/** A theme's pieces as a valid settled layout, numbered from `firstId`. */
export function themeLayout(theme: Theme, firstId = 1): Decoration[] {
  let pieces: Decoration[] = [];
  theme.pieces.forEach(([itemId, x, scale = 1, variant = 0], index) => {
    const entry = decorItem(itemId)!;
    const piece = settle({ id: `DC-${firstId + index}`, kind: entry.kind, item: itemId, variant, x, y: 0.5, scale, rotation: index % 3 === 2 ? 180 : 0 });
    pieces = nearestValid([...pieces, piece], piece.id);
  });
  return pieces;
}
