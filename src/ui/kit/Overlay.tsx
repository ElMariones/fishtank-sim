import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from '../Icon';
import { anchorOf, useAnchoredPosition, useDismiss, type Anchor, type Placement } from './floating';

const SHOW_DELAY = 380, SWITCH_DELAY = 60;

/**
 * One tooltip layer for the whole app. Any element with `data-tip` shows that text after a short hover or on keyboard
 * focus; moving between tipped elements switches instantly. Tips repeat names that are already accessible (labels,
 * aria-label), so they are hidden from assistive technology.
 */
export function TooltipLayer() {
  const [tip, setTip] = useState<{ text: string; anchor: Anchor; placement: Placement } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef(0), shown = useRef(false), current = useRef<Element | null>(null);
  const position = useAnchoredPosition(ref, tip?.anchor ?? null, tip?.placement ?? 'top');
  useEffect(() => {
    const show = (element: Element) => {
      const text = element.getAttribute('data-tip');
      if (!text) return;
      // Rail items repeat their visible label as a tip only when a narrow layout has hidden that label.
      const label = element.hasAttribute('data-tip-collapsed') ? element.querySelector('.rail-label') : null;
      if (label && label.getClientRects().length) return;
      current.current = element;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        if (current.current !== element || !element.isConnected) return;
        shown.current = true;
        setTip({ text, anchor: anchorOf(element), placement: (element.getAttribute('data-tip-side') as Placement | null) ?? 'top' });
      }, shown.current ? SWITCH_DELAY : SHOW_DELAY);
    };
    const hide = () => { window.clearTimeout(timer.current); current.current = null; setTip(null); window.setTimeout(() => { if (!current.current) shown.current = false; }, 300); };
    const over = (event: Event) => { const element = (event.target as Element).closest?.('[data-tip]'); if (element && element !== current.current) show(element); else if (!element && current.current) hide(); };
    const focus = (event: FocusEvent) => { const element = (event.target as Element).closest?.('[data-tip]'); if (element && (event.target as Element).matches(':focus-visible')) show(element); };
    const blur = () => { if (current.current) hide(); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && current.current) hide(); };
    document.addEventListener('pointerover', over); document.addEventListener('focusin', focus); document.addEventListener('focusout', blur);
    document.addEventListener('pointerdown', hide, true); document.addEventListener('keydown', key); window.addEventListener('scroll', hide, true);
    return () => {
      document.removeEventListener('pointerover', over); document.removeEventListener('focusin', focus); document.removeEventListener('focusout', blur);
      document.removeEventListener('pointerdown', hide, true); document.removeEventListener('keydown', key); window.removeEventListener('scroll', hide, true);
    };
  }, []);
  if (!tip) return null;
  return createPortal(<div ref={ref} className="tooltip" aria-hidden="true" data-side={position.side} style={{ left: position.left, top: position.top, visibility: position.ready ? 'visible' : 'hidden' }}>{tip.text}</div>, document.body);
}

/** A floating panel anchored to its trigger, for rich read-only content such as water readings or the activity log. */
export function Popover({ trigger, children, label, placement = 'bottom-end', className = '', triggerClassName = '', tip, onOpen }: {
  trigger: ReactNode; children: ReactNode | ((close: () => void) => ReactNode); label: string; placement?: Placement; className?: string; triggerClassName?: string; tip?: string; onOpen?: () => void;
}) {
  const button = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null), id = useId();
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const position = useAnchoredPosition(panel, anchor, placement);
  const close = (refocus = true) => { setAnchor(null); if (refocus) button.current?.focus(); };
  useDismiss(!!anchor, () => [button.current, panel.current], () => close(false));
  useEffect(() => {
    if (!anchor) return;
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); close(); } };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [anchor]);
  useEffect(() => { if (anchor && position.ready) panel.current?.focus(); }, [anchor, position.ready]);
  return <>
    <button ref={button} type="button" className={`popover-trigger ${triggerClassName} ${anchor ? 'open' : ''}`} aria-expanded={!!anchor} aria-controls={anchor ? id : undefined} data-tip={anchor ? undefined : tip}
      onClick={() => { if (anchor) close(false); else if (button.current) { setAnchor(anchorOf(button.current)); onOpen?.(); } }}>{trigger}</button>
    {anchor ? createPortal(<div ref={panel} id={id} className={`popover ${className}`} role="dialog" aria-label={label} tabIndex={-1} data-side={position.side}
      style={{ left: position.left, top: position.top, visibility: position.ready ? 'visible' : 'hidden' }}>{typeof children === 'function' ? children(() => close()) : children}</div>, document.body) : null}
  </>;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A modal dialog: backdrop, focus trap, Escape to close, focus restored to the opener. `tone` tints the header icon
 * for money (brass), care (lume) or irreversible actions (rose).
 */
export function Dialog({ open, onClose, title, description, icon = 'info', tone = 'lume', children, actions, wide = false, labelledBy, fallbackFocus }: {
  /** Where focus goes on close when the element that opened the dialog no longer exists. */
  fallbackFocus?: () => HTMLElement | null | undefined;
  open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; icon?: IconName; tone?: 'lume' | 'brass' | 'rose' | 'gene' | 'koi';
  children?: ReactNode; actions?: ReactNode; wide?: boolean; labelledBy?: string;
}) {
  const panel = useRef<HTMLDivElement>(null), titleId = useId(), descriptionId = useId();
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const key = (event: KeyboardEvent) => {
      // Menus and the palette above the dialog handle their own Escape first.
      if (document.querySelector('.menu, .palette')) return;
      if (event.key === 'Escape') { event.stopPropagation(); onClose(); return; }
      if (event.key !== 'Tab' || !panel.current) return;
      const focusable = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(element => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (!panel.current.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', key);
    const focus = window.setTimeout(() => {
      const preferred = panel.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panel.current?.querySelector<HTMLElement>('.dialog-actions button:not([disabled])');
      (preferred ?? panel.current)?.focus();
    }, 30);
    document.documentElement.classList.add('has-modal');
    return () => { document.removeEventListener('keydown', key); window.clearTimeout(focus); document.documentElement.classList.remove('has-modal'); if (previous?.isConnected && previous !== document.body) previous.focus(); else fallbackFocus?.()?.focus(); };
  }, [open]);
  if (!open) return null;
  return createPortal(<div className="dialog-root">
    <div className="dialog-backdrop" onClick={onClose} aria-hidden="true" />
    <div ref={panel} className={`dialog tone-${tone} ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy ?? titleId} aria-describedby={description ? descriptionId : undefined} tabIndex={-1}>
      <header className="dialog-header">
        <span className="dialog-icon" aria-hidden="true"><Icon name={icon} size={20} /></span>
        <div><h2 id={titleId}>{title}</h2>{description ? <p id={descriptionId}>{description}</p> : null}</div>
        <button className="quiet icon-button btn-sm dialog-close" onClick={onClose} aria-label="Close dialog"><Icon name="close" size={16} /></button>
      </header>
      {children ? <div className="dialog-body">{children}</div> : null}
      {actions ? <footer className="dialog-actions">{actions}</footer> : null}
    </div>
  </div>, document.body);
}
