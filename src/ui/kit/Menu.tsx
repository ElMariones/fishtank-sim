import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from '../Icon';
import { anchorOf, pointAnchor, useAnchoredPosition, useDismiss, type Anchor, type Placement } from './floating';

/** One row of a menu: an action, a nested submenu, a section heading or a divider. */
export type MenuEntry =
  | { type?: 'item'; id: string; label: string; icon?: IconName; hint?: string; shortcut?: string; disabled?: boolean; danger?: boolean;
      /** Present on choice rows: the row reads as a radio item with a check mark. */
      checked?: boolean; tone?: 'lume' | 'brass' | 'koi' | 'gene'; onSelect?: () => void; items?: MenuEntry[] }
  | { type: 'separator'; id: string }
  | { type: 'heading'; id: string; label: string };
type ItemEntry = Extract<MenuEntry, { id: string; label: string; type?: 'item' }>;
type CloseReason = 'select' | 'escape' | 'outside' | 'tab' | 'back';

const isItem = (entry: MenuEntry): entry is ItemEntry => entry.type === undefined || entry.type === 'item';
const SUBMENU_DELAY = 140;

type ListProps = { items: MenuEntry[]; anchor: Anchor; placement: Placement; label: string; onClose: (reason: CloseReason) => void; level?: number; className?: string };

/** A floating menu list in a portal: arrow keys, Home/End, type-ahead, Right/Left for submenus, Escape and Tab to close. */
export function MenuList({ items, anchor, placement, label, onClose, level = 0, className = '' }: ListProps) {
  const ref = useRef<HTMLDivElement>(null);
  const position = useAnchoredPosition(ref, anchor, placement);
  const actionable = items.filter(isItem);
  const initial = Math.max(0, actionable.findIndex(item => item.checked && !item.disabled), actionable.findIndex(item => !item.disabled));
  const [active, setActive] = useState(initial);
  const [sub, setSub] = useState<{ id: string; anchor: Anchor } | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const hoverTimer = useRef(0);
  const typed = useRef({ text: '', at: 0 });

  useEffect(() => { if (position.ready && !sub) buttons.current.get(actionable[active]?.id)?.focus({ preventScroll: false }); }, [active, position.ready, sub]);
  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  const move = (from: number, step: number) => {
    for (let i = 1; i <= actionable.length; i++) {
      const next = (from + step * i + actionable.length * 4) % actionable.length;
      if (!actionable[next].disabled) { setActive(next); return; }
    }
  };
  const openSub = (item: ItemEntry) => {
    const button = buttons.current.get(item.id);
    if (item.items && button) setSub({ id: item.id, anchor: anchorOf(button) });
  };
  const activate = (item: ItemEntry) => {
    if (item.disabled) return;
    if (item.items) { openSub(item); return; }
    onClose('select');
    item.onSelect?.();
  };
  const onKey = (event: React.KeyboardEvent) => {
    const item = actionable[active];
    if (event.key === 'ArrowDown') { event.preventDefault(); move(active, 1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); move(active, -1); }
    else if (event.key === 'Home') { event.preventDefault(); move(-1, 1); }
    else if (event.key === 'End') { event.preventDefault(); move(actionable.length, -1); }
    else if (event.key === 'ArrowRight' && item?.items) { event.preventDefault(); openSub(item); }
    else if (event.key === 'ArrowLeft' && level > 0) { event.preventDefault(); onClose('back'); }
    else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(level > 0 ? 'back' : 'escape'); }
    else if (event.key === 'Tab') { event.preventDefault(); onClose('tab'); }
    else if (event.key.length === 1 && /\S/.test(event.key) && !event.metaKey && !event.ctrlKey) {
      const now = performance.now();
      typed.current = { text: (now - typed.current.at < 600 ? typed.current.text : '') + event.key.toLowerCase(), at: now };
      const match = actionable.findIndex((entry, i) => !entry.disabled && entry.label.toLowerCase().startsWith(typed.current.text) && (typed.current.text.length > 1 || i !== active));
      if (match >= 0) setActive(match);
    }
  };

  const subItem = sub ? actionable.find(item => item.id === sub.id) : undefined;
  return createPortal(<>
    <div ref={ref} className={`menu ${className}`} role="menu" aria-label={label} data-side={position.side} data-level={level} onKeyDown={onKey}
      style={{ left: position.left, top: position.top, visibility: position.ready ? 'visible' : 'hidden' }}>
      {items.map(entry => {
        if (entry.type === 'separator') return <div key={entry.id} className="menu-separator" role="separator" />;
        if (entry.type === 'heading') return <div key={entry.id} className="menu-heading" role="presentation">{entry.label}</div>;
        const index = actionable.indexOf(entry), choice = entry.checked !== undefined;
        return <button key={entry.id} ref={node => { if (node) buttons.current.set(entry.id, node); else buttons.current.delete(entry.id); }}
          className={`bare menu-item ${entry.danger ? 'danger' : ''} ${entry.tone ? `tone-${entry.tone}` : ''} ${index === active ? 'active' : ''}`}
          role={choice ? 'menuitemradio' : 'menuitem'} aria-checked={choice ? entry.checked : undefined} aria-disabled={entry.disabled || undefined}
          aria-haspopup={entry.items ? 'menu' : undefined} aria-expanded={entry.items ? sub?.id === entry.id : undefined} tabIndex={-1}
          onClick={() => activate(entry)}
          onPointerEnter={() => {
            if (entry.disabled) return;
            setActive(index); window.clearTimeout(hoverTimer.current);
            hoverTimer.current = window.setTimeout(() => entry.items ? openSub(entry) : setSub(null), SUBMENU_DELAY);
          }}>
          <span className="menu-icon" aria-hidden="true">{choice ? (entry.checked ? <Icon name="check" size={15} /> : null) : entry.icon ? <Icon name={entry.icon} size={16} /> : null}</span>
          <span className="menu-label">{entry.label}{entry.hint ? <small>{entry.hint}</small> : null}</span>
          {entry.items ? <Icon name="chevron" size={14} className="menu-chevron" /> : entry.shortcut ? <kbd>{entry.shortcut}</kbd> : null}
        </button>;
      })}
    </div>
    {sub && subItem?.items ? <MenuList items={subItem.items} anchor={sub.anchor} placement="right-start" label={subItem.label} level={level + 1} className={className}
      onClose={reason => { setSub(null); if (reason === 'back') buttons.current.get(subItem.id)?.focus(); else onClose(reason); }} /> : null}
  </>, document.body);
}

const allMenus = () => Array.from(document.querySelectorAll('.menu'));
const FOCUSABLE = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

type MenuButtonProps = {
  items: MenuEntry[]; label: string; children: ReactNode; className?: string; placement?: Placement; disabled?: boolean; id?: string;
  /** Visible name of the trigger for screen readers when the children are only an icon or a value. */
  ariaLabel?: string; menuClassName?: string; tip?: string;
};

/** A button that deploys a menu. Arrow keys on the trigger open it too. Focus returns to the trigger on close. */
export function MenuButton({ items, label, children, className = '', placement = 'bottom-start', disabled, id, ariaLabel, menuClassName, tip }: MenuButtonProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const open = anchor !== null;
  const close = (reason: CloseReason) => { setAnchor(null); if (reason !== 'outside') trigger.current?.focus(); };
  useDismiss(open, () => [trigger.current, ...allMenus()], () => close('outside'));
  const show = () => { if (trigger.current) setAnchor(anchorOf(trigger.current)); };
  return <>
    <button ref={trigger} id={id} type="button" className={`menu-trigger ${className} ${open ? 'open' : ''}`} aria-haspopup="menu" aria-expanded={open} aria-label={ariaLabel} disabled={disabled}
      data-tip={tip} onClick={() => open ? close('outside') : show()}
      onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); show(); } }}>{children}</button>
    {open ? <MenuList items={items} anchor={anchor} placement={placement} label={label} onClose={close} className={menuClassName} /> : null}
  </>;
}

export type SelectOption<T extends string> = { value: T; label: string; hint?: string; disabled?: boolean; icon?: IconName; group?: string };

/** A custom single-choice dropdown: the trigger shows the current choice, the menu marks it with a check. */
export function Select<T extends string>({ value, options, onChange, label, prefix, className = '', id, placement = 'bottom-start', disabled, icon }: {
  value: T; options: SelectOption<T>[]; onChange: (value: T) => void; label: string; prefix?: string; className?: string; id?: string; placement?: Placement; disabled?: boolean; icon?: IconName;
}) {
  const current = options.find(option => option.value === value);
  const items: MenuEntry[] = [];
  let group: string | undefined;
  for (const option of options) {
    if (option.group && option.group !== group) { group = option.group; items.push({ type: 'heading', id: `h-${group}`, label: group }); }
    items.push({ id: option.value, label: option.label, hint: option.hint, disabled: option.disabled, checked: option.value === value, onSelect: () => onChange(option.value) });
  }
  return <MenuButton items={items} label={label} id={id} placement={placement} disabled={disabled} className={`select-trigger ${className}`} ariaLabel={`${label}: ${current?.label ?? 'none'}`}>
    {icon ? <Icon name={icon} size={15} /> : null}
    {prefix ? <span className="select-prefix">{prefix}</span> : null}
    <span className="select-value">{current?.label ?? 'Choose…'}</span>
    <Icon name="chevronDown" size={14} className="select-chevron" />
  </MenuButton>;
}

/** Right-click (or the Menu key, or Shift+F10) menus. Render `node` once; call `open` from an onContextMenu handler. */
export function useContextMenu() {
  const [state, setState] = useState<{ anchor: Anchor; items: MenuEntry[]; label: string } | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const close = (reason: CloseReason) => { setState(null); if (reason !== 'outside') returnFocus.current?.focus(); };
  useDismiss(!!state, allMenus, () => close('outside'));
  const open = (event: React.MouseEvent, items: MenuEntry[], label: string) => {
    event.preventDefault();
    const element = event.currentTarget as HTMLElement;
    returnFocus.current = element.matches(FOCUSABLE) ? element : element.querySelector<HTMLElement>(FOCUSABLE);
    setState({ anchor: pointAnchor(event.clientX, event.clientY), items, label });
  };
  /** Keyboard path: opens under the focused element. */
  const openFor = (element: HTMLElement, items: MenuEntry[], label: string) => {
    returnFocus.current = element;
    const rect = element.getBoundingClientRect();
    setState({ anchor: pointAnchor(rect.left + 12, rect.top + Math.min(rect.height, 48)), items, label });
  };
  const node = state ? <MenuList items={state.items} anchor={state.anchor} placement="bottom-start" label={state.label} onClose={close} className="context" /> : null;
  return { open, openFor, node };
}
