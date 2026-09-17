import { useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type KeyboardEvent, type PointerEvent, type SetStateAction } from 'react';
import {
  BACKDROPS, DECOR_CATEGORIES, DECOR_ITEMS, DECOR_VARIANTS, LIGHTINGS, SCALE_RANGE, SUBSTRATES, THEMES, decorItem, itemOf, piecePrice, settle,
  styleCost, styleOf, type DecorCategory, type StyleFacet, type StyleOption, type TankStyle, type Theme,
} from '../core/aquascape';
import { nearestValid, nextPieceId, placePiece, themeLayout } from '../core/aquascapeLayout';
import { decorationsOf, layoutProblem, MAX_DECORATIONS, type Decoration } from '../core/tankManagement';
import type { Tank, World } from '../core/types';
import type { Command } from '../core/world';
import { AquascapeRenderer, paintThumbnail, pieceBox, type Scene } from '../rendering/aquascape';
import { Icon } from './Icon';

/**
 * Aquascape editor (FS-117). The live aquarium becomes the canvas: pieces are dragged straight into place and settle on
 * the substrate, the dock adds pieces, looks and themes, and one review applies the whole draft.
 */
export type AquascapeDraft = { decorations: Decoration[]; style: TankStyle; selected: string | null };
export const draftFor = (tank: Tank): AquascapeDraft => ({ decorations: structuredClone(decorationsOf(tank)), style: styleOf(tank), selected: null });

const DRAG_TYPE = 'application/x-fishtank-decor';
const isNew = (piece: Decoration, saved: readonly Decoration[]) => !saved.some(old => old.id === piece.id && old.item === piece.item);
/** Editor placements get a random shape and facing, so repeated pieces do not look stamped. */
const freshPiece = (pieces: Decoration[], saved: readonly Decoration[], itemId: string, x?: number) =>
  placePiece(pieces, itemId, { saved, x, variant: Math.floor(Math.random() * DECOR_VARIANTS), mirrored: Math.random() < 0.5 });

// ---- Overlay on the aquarium ----------------------------------------------------------------------------------------

type OverlayProps = { draft: AquascapeDraft; saved: readonly Decoration[]; setDraft: Dispatch<SetStateAction<AquascapeDraft | null>> };
export function AquascapeOverlay({ draft, saved, setDraft }: OverlayProps) {
  const root = useRef<HTMLDivElement>(null), [size, setSize] = useState({ w: 0, h: 0 });
  const drag = useRef<{ id: string; pointer: number; offset: number } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const problem = layoutProblem(draft.decorations), invalid = new Set(problem?.ids ?? []);
  const update = (change: (pieces: Decoration[]) => Decoration[], selected?: string | null) =>
    setDraft(current => current && ({ ...current, decorations: change(current.decorations), selected: selected === undefined ? current.selected : selected }));
  const patch = (id: string, change: (piece: Decoration) => Decoration) => update(pieces => nearestValid(pieces.map(piece => piece.id === id ? settle(change(piece)) : piece), id));

  const boxes = useMemo(() => size.w ? draft.decorations.map(piece => ({ piece, box: pieceBox(piece, size.w, size.h) }))
    .sort((a, b) => (b.box.right - b.box.left) * (b.box.bottom - b.box.top) - (a.box.right - a.box.left) * (a.box.bottom - a.box.top)) : [], [draft.decorations, size]);
  const selected = boxes.find(entry => entry.piece.id === draft.selected);

  const pointerDown = (event: PointerEvent, piece: Decoration) => {
    event.preventDefault(); event.stopPropagation();
    const rect = root.current!.getBoundingClientRect();
    drag.current = { id: piece.id, pointer: event.pointerId, offset: (event.clientX - rect.left) / rect.width - piece.x };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    (event.currentTarget as HTMLElement).focus({ preventScroll: true });
    setDragging(piece.id);
    update(pieces => pieces, piece.id);
  };
  const pointerMove = (event: PointerEvent) => {
    const active = drag.current;
    if (!active || active.pointer !== event.pointerId) return;
    const rect = root.current!.getBoundingClientRect(), x = (event.clientX - rect.left) / rect.width - active.offset;
    update(pieces => pieces.map(piece => piece.id === active.id ? settle({ ...piece, x }) : piece));
  };
  // Ends on release, cancel or a lost capture, so a drag can never stay stuck.
  const pointerUp = (event: PointerEvent) => {
    const active = drag.current;
    if (!active || active.pointer !== event.pointerId) return;
    drag.current = null; setDragging(null);
    update(pieces => nearestValid(pieces, active.id));
  };
  const keyDown = (event: KeyboardEvent, piece: Decoration) => {
    const moves: Record<string, () => void> = {
      ArrowLeft: () => patch(piece.id, p => ({ ...p, x: p.x - (event.shiftKey ? 0.05 : 0.01) })),
      ArrowRight: () => patch(piece.id, p => ({ ...p, x: p.x + (event.shiftKey ? 0.05 : 0.01) })),
      ArrowUp: () => patch(piece.id, p => ({ ...p, scale: p.scale + 0.05 })), ArrowDown: () => patch(piece.id, p => ({ ...p, scale: p.scale - 0.05 })),
      Delete: () => update(pieces => pieces.filter(p => p.id !== piece.id), null), Backspace: () => update(pieces => pieces.filter(p => p.id !== piece.id), null),
      f: () => patch(piece.id, p => ({ ...p, rotation: p.rotation > 90 && p.rotation < 270 ? 0 : 180 })),
      r: () => patch(piece.id, p => ({ ...p, variant: ((p.variant ?? 0) + 1) % DECOR_VARIANTS })),
      Escape: () => update(pieces => pieces, null),
    };
    const action = moves[event.key];
    if (action) { event.preventDefault(); action(); }
  };

  return <div ref={root} className={`aquascape-overlay ${dragging ? 'is-dragging' : ''}`} onPointerDown={() => update(pieces => pieces, null)}
    onDragOver={event => { if (event.dataTransfer.types.includes(DRAG_TYPE)) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } }}
    onDrop={event => {
      const itemId = event.dataTransfer.getData(DRAG_TYPE);
      if (!itemId || !decorItem(itemId)) return;
      event.preventDefault();
      const rect = root.current!.getBoundingClientRect(), x = (event.clientX - rect.left) / rect.width;
      setDraft(current => {
        if (!current || current.decorations.length >= MAX_DECORATIONS) return current;
        const piece = freshPiece(current.decorations, saved, itemId, x);
        return { ...current, decorations: nearestValid([...current.decorations, piece], piece.id), selected: piece.id };
      });
    }}>
    {boxes.map(({ piece, box }) => {
      const entry = itemOf(piece), style: CSSProperties = { left: box.left, top: box.top, width: box.right - box.left, height: box.bottom - box.top };
      return <button key={piece.id} type="button" style={style}
        className={`decor-handle ${piece.id === draft.selected ? 'selected' : ''} ${invalid.has(piece.id) ? 'invalid' : ''} ${piece.id === dragging ? 'dragging' : ''} ${entry.kind}`}
        aria-label={`${entry.name}, ${Math.round(piece.x * 100)}% across. Drag or use arrow keys to move; up and down resize; F flips; R reshapes; Delete removes.`}
        aria-pressed={piece.id === draft.selected}
        onPointerDown={event => pointerDown(event, piece)} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onLostPointerCapture={pointerUp}
        onKeyDown={event => keyDown(event, piece)} onFocus={() => { if (draft.selected !== piece.id) update(pieces => pieces, piece.id); }}>
        <span className="decor-handle-label">{entry.name}{isNew(piece, saved) ? <b> · ◈ {piecePrice(piece)}</b> : null}</span>
      </button>;
    })}
    {selected && !dragging ? <div className="decor-toolbar" role="toolbar" aria-label={`${itemOf(selected.piece).name} tools`} onPointerDown={event => event.stopPropagation()}
      style={{ left: Math.min(Math.max(8, selected.box.cx - 150), size.w - 308), top: Math.max(8, selected.box.top - 52) }}>
      <button type="button" title="Smaller" aria-label="Smaller" disabled={selected.piece.scale <= SCALE_RANGE[0]} onClick={() => patch(selected.piece.id, p => ({ ...p, scale: p.scale - 0.1 }))}><Icon name="minus" size={16} /></button>
      <span className="decor-scale">{Math.round(selected.piece.scale * 100)}%</span>
      <button type="button" title="Larger" aria-label="Larger" disabled={selected.piece.scale >= SCALE_RANGE[1]} onClick={() => patch(selected.piece.id, p => ({ ...p, scale: p.scale + 0.1 }))}><Icon name="plus" size={16} /></button>
      <i />
      <button type="button" title="Flip" aria-label="Flip" onClick={() => patch(selected.piece.id, p => ({ ...p, rotation: p.rotation > 90 && p.rotation < 270 ? 0 : 180 }))}><Icon name="flip" size={16} /></button>
      <button type="button" title="New shape" aria-label="New shape" onClick={() => patch(selected.piece.id, p => ({ ...p, variant: ((p.variant ?? 0) + 1) % DECOR_VARIANTS }))}><Icon name="shuffle" size={16} /></button>
      <button type="button" title="Duplicate" aria-label="Duplicate" disabled={draft.decorations.length >= MAX_DECORATIONS} onClick={() => setDraft(current => {
        if (!current) return current;
        const copy = freshPiece(current.decorations, saved, selected.piece.item ?? itemOf(selected.piece).id);
        const twin = settle({ ...copy, variant: selected.piece.variant, scale: selected.piece.scale, rotation: selected.piece.rotation });
        return { ...current, decorations: nearestValid([...current.decorations, twin], twin.id), selected: twin.id };
      })}><Icon name="copy" size={16} /></button>
      <button type="button" className="danger" title="Remove" aria-label="Remove" onClick={() => update(pieces => pieces.filter(p => p.id !== selected.piece.id), null)}><Icon name="trash" size={16} /></button>
    </div> : null}
    {problem ? <p className="decor-problem" role="alert">{problem.message}</p> : null}
  </div>;
}

// ---- Previews -------------------------------------------------------------------------------------------------------

function PieceThumb({ item, variant = 0 }: { item: string; variant?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null), entry = decorItem(item)!;
  useEffect(() => {
    if (canvas.current) paintThumbnail(canvas.current, { id: 'DC-0', kind: entry.kind, item, variant, x: 0.5, y: 0.5, scale: 1, rotation: 0 });
  }, [item, variant]);
  return <canvas ref={canvas} className="decor-thumb" aria-hidden="true" />;
}

/** A small still of a whole scene, painted with the tank renderer. */
function ScenePreview({ scene }: { scene: Scene }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2), W = element.clientWidth || 160, H = element.clientHeight || 90;
    element.width = W * dpr; element.height = H * dpr;
    const ctx = element.getContext('2d')!; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const renderer = new AquascapeRenderer();
    renderer.paintBack(ctx, W, H, scene, 4); renderer.paintPlants(ctx, W, H, scene, 4, 'back'); renderer.paintPlants(ctx, W, H, scene, 4, 'front'); renderer.paintFront(ctx, W, H, scene, 4);
  }, [scene]);
  return <canvas ref={canvas} className="scene-thumb" aria-hidden="true" />;
}

// ---- Dock -----------------------------------------------------------------------------------------------------------

type DockTab = 'themes' | DecorCategory | StyleFacet;
const LOOK_TABS: { id: StyleFacet; label: string; options: readonly StyleOption[] }[] = [
  { id: 'substrate', label: 'Substrate', options: SUBSTRATES }, { id: 'backdrop', label: 'Backdrop', options: BACKDROPS }, { id: 'lighting', label: 'Lighting', options: LIGHTINGS },
];

type DockProps = { world: World; tank: Tank; draft: AquascapeDraft; setDraft: Dispatch<SetStateAction<AquascapeDraft | null>>; readOnly?: boolean;
  onRun: (command: Command, message: string) => boolean; onClose: () => void };
export function AquascapeDock({ world, tank, draft, setDraft, readOnly, onRun, onClose }: DockProps) {
  const [tab, setTab] = useState<DockTab>('themes');
  const saved = decorationsOf(tank), savedStyle = styleOf(tank);
  const added = draft.decorations.filter(piece => isNew(piece, saved)), pieceCost = added.reduce((sum, piece) => sum + piecePrice(piece), 0);
  const lookCost = styleCost(savedStyle, draft.style), total = pieceCost + lookCost;
  const layoutChanged = JSON.stringify(saved) !== JSON.stringify(draft.decorations), lookChanged = JSON.stringify(savedStyle) !== JSON.stringify(draft.style);
  const problem = layoutProblem(draft.decorations), full = draft.decorations.length >= MAX_DECORATIONS;
  const counts = useMemo(() => Object.fromEntries(DECOR_CATEGORIES.map(category => [category.id, draft.decorations.filter(piece => itemOf(piece).category === category.id).length])), [draft.decorations]);

  const add = (itemId: string) => setDraft(current => {
    if (!current || current.decorations.length >= MAX_DECORATIONS) return current;
    const piece = freshPiece(current.decorations, saved, itemId);
    return { ...current, decorations: [...current.decorations, piece], selected: piece.id };
  });
  const applyTheme = (theme: Theme) => setDraft(current => {
    if (!current) return current;
    return { ...current, style: theme.style, selected: null, decorations: themeLayout(theme, Number(nextPieceId(current.decorations, saved).slice(3))) };
  });
  const apply = () => {
    if (layoutChanged && !onRun({ type: 'place-decorations', tankId: tank.id, decorations: draft.decorations }, added.length ? `${added.length} new piece${added.length === 1 ? '' : 's'} placed in ${tank.name}. Fish now steer around the new layout.` : `Layout saved in ${tank.name}. Fish now steer around the new layout.`)) return;
    if (lookChanged && !onRun({ type: 'style-tank', tankId: tank.id, style: draft.style }, `${tank.name} has a new look.`)) return;
    onClose();
  };
  const themeScenes = useMemo(() => new Map(THEMES.map(theme => [theme.id, { decorations: themeLayout(theme), style: theme.style }])), []);
  const lookScenes = useMemo(() => new Map(LOOK_TABS.flatMap(look => look.options.map(option => [`${look.id}:${option.id}`, { decorations: draft.decorations, style: { ...draft.style, [look.id]: option.id } }] as const))),
    // Look previews show the current layout; rebuild them when the tab opens rather than on every drag.
    [tab, draft.style]);

  return <section className="aquascape-dock" aria-label="Aquascape editor">
    <div className="dock-head">
      <div className="eyebrow">AQUASCAPE · {tank.name.toUpperCase()}</div><h2>Design your aquarium</h2>
      <p>Drag pieces onto the glass or tap to add · pieces settle into the substrate · plants give cover, everything else is solid</p>
    </div>
    <div className="dock-tabs" role="tablist" aria-label="Aquascape catalog">
      {([['themes', 'Themes', 'spark'], ...DECOR_CATEGORIES.map(c => [c.id, c.label, c.id === 'plants' ? 'leaf' : c.id === 'rocks' ? 'mountain' : c.id === 'wood' ? 'layers' : 'brush']), ['substrate', 'Substrate', 'grid'], ['backdrop', 'Backdrop', 'wave'], ['lighting', 'Lighting', 'sun']] as [DockTab, string, Parameters<typeof Icon>[0]['name']][]).map(([id, label, icon]) =>
        <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
          <Icon name={icon} size={15} />{label}{id in counts && counts[id] ? <span className="tab-badge">{counts[id]}</span> : null}
        </button>)}
    </div>
    <div className="dock-tray" role="tabpanel">
      {tab === 'themes' ? THEMES.map(theme => {
        const cost = themeLayout(theme).reduce((sum, piece) => sum + piecePrice(piece), 0) + styleCost(savedStyle, theme.style);
        return <button key={theme.id} type="button" className="dock-card theme-card" onClick={() => applyTheme(theme)}>
          <ScenePreview scene={themeScenes.get(theme.id)!} /><strong>{theme.name}</strong><small>{theme.blurb}</small><span className="price">◈ {cost}</span>
        </button>;
      }) : null}
      {DECOR_CATEGORIES.some(category => category.id === tab) ? DECOR_ITEMS.filter(entry => entry.category === tab).map(entry =>
        <button key={entry.id} type="button" className="dock-card piece-card" draggable={!full} disabled={full} title={entry.blurb}
          onDragStart={event => { event.dataTransfer.setData(DRAG_TYPE, entry.id); event.dataTransfer.effectAllowed = 'copy'; }} onClick={() => add(entry.id)}>
          <PieceThumb item={entry.id} /><strong>{entry.name}</strong><small>{entry.blurb}</small>
          <span className="price">◈ {entry.price}</span><span className={`kind-tag ${entry.kind}`}>{entry.kind === 'cover' ? 'Cover' : 'Solid'}</span>
        </button>) : null}
      {LOOK_TABS.filter(look => look.id === tab).flatMap(look => look.options.map(option => {
        const active = draft.style[look.id] === option.id, owned = savedStyle[look.id] === option.id;
        return <button key={option.id} type="button" className={`dock-card look-card ${active ? 'active' : ''}`} aria-pressed={active}
          onClick={() => setDraft(current => current && ({ ...current, style: { ...current.style, [look.id]: option.id } }))}>
          <ScenePreview scene={lookScenes.get(`${look.id}:${option.id}`)!} />
          <strong>{option.name}{active ? <Icon name="check" size={14} /> : null}</strong><small>{option.blurb}</small>
          <span className="price">{owned ? 'Current' : option.price ? `◈ ${option.price}` : 'Free'}</span>
        </button>;
      }))}
    </div>
    <div className="dock-footer">
      <div className="dock-summary">
        <span><strong>{draft.decorations.length}</strong> / {MAX_DECORATIONS} pieces</span>
        <span>New pieces <strong>◈ {pieceCost}</strong></span>
        <span>Look <strong>◈ {lookCost}</strong></span>
        <span className={world.credits < total ? 'short' : ''}>Balance after <strong>◈ {(world.credits - total).toLocaleString('en')}</strong></span>
      </div>
      <p className="dock-note">Moving, resizing, flipping and reshaping are free · removed pieces are not refunded · looks never change water or growth</p>
      <div className="dock-actions">
        <button type="button" className="quiet" onClick={() => setDraft(current => current && ({ ...current, decorations: [], selected: null }))} disabled={!draft.decorations.length}>Clear all</button>
        <button type="button" onClick={onClose}>Cancel</button>
        <button type="button" className="primary" disabled={readOnly || !!problem || world.credits < total || (!layoutChanged && !lookChanged)} onClick={apply}>
          <Icon name="check" size={16} />Apply{total ? ` · ◈ ${total}` : ''}
        </button>
      </div>
    </div>
  </section>;
}
