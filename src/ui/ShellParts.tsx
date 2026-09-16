import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** A number that counts toward its new value and flashes up or down; exact at rest and for assistive technology. */
export function AnimatedNumber({ value, format = (n: number) => n.toLocaleString('en') }: { value: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(value), [trend, setTrend] = useState<'up' | 'down' | null>(null), from = useRef(value);
  useEffect(() => {
    if (from.current === value) return;
    const start = from.current, delta = value - start, began = performance.now();
    from.current = value;
    setTrend(delta > 0 ? 'up' : 'down');
    if (reducedMotion()) { setShown(value); return; }
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - began) / 650), eased = 1 - (1 - t) ** 3;
      setShown(Math.round(start + delta * eased));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    const clear = setTimeout(() => setTrend(null), 1200);
    return () => { cancelAnimationFrame(frame); clearTimeout(clear); setShown(value); };
  }, [value]);
  return <span className={`animated-number ${trend ?? ''}`}><span aria-hidden="true">{format(shown)}</span><span className="visually-hidden">{format(value)}</span></span>;
}

/** A compact live statistic for the top bar. */
export function StatPill({ icon, label, value, tone = 'neutral', onClick, title }: { icon: IconName; label: string; value: ReactNode; tone?: 'neutral' | 'gold' | 'aqua' | 'coral' | 'violet'; onClick?: () => void; title?: string }) {
  const body = <><span className="stat-icon"><Icon name={icon} size={16} /></span><span className="stat-text"><span className="stat-value">{value}</span><span className="stat-label">{label}</span></span></>;
  return onClick
    ? <button className={`stat-pill ${tone}`} onClick={onClick} title={title}>{body}</button>
    : <div className={`stat-pill ${tone}`} title={title}>{body}</div>;
}

/** A right-hand slide-over sheet for tools such as the shop, buyers and saves. Escape or the backdrop closes it. */
export function Drawer({ open, label, onClose, children, wide = false }: { open: boolean; label: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const focus = setTimeout(() => { if (!panel.current?.contains(document.activeElement)) panel.current?.focus(); }, 60);
    return () => { document.removeEventListener('keydown', onKey); clearTimeout(focus); previous?.focus?.(); };
  }, [open]);
  if (!open) return null;
  return <div className="drawer-root">
    <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
    <div className={`drawer ${wide ? 'wide' : ''}`} role="dialog" aria-label={label} ref={panel} tabIndex={-1}>
      <button className="drawer-close quiet" onClick={onClose} aria-label={`Close ${label}`}><Icon name="close" /></button>
      <div className="drawer-body">{children}</div>
    </div>
  </div>;
}

/** The latest notice as a toast. The text stays in a polite live region, so screen readers hear every notice. */
export function Toast({ message }: { message: string }) {
  const [visible, setVisible] = useState(!!message), [seen, setSeen] = useState(message);
  if (message !== seen) { setSeen(message); setVisible(!!message); }
  useEffect(() => {
    if (!message) return;
    const hide = setTimeout(() => setVisible(false), Math.min(14000, 5000 + message.length * 45));
    return () => clearTimeout(hide);
  }, [message]);
  return <div className="toast-region" role="status" aria-live="polite">
    {message ? <div key={message} className={`toast ${visible ? 'shown' : 'hidden'}`}>
      <span className="toast-icon"><Icon name="spark" size={16} /></span><p>{message}</p>
      <button className="quiet toast-close" onClick={() => setVisible(false)} aria-label="Dismiss notice"><Icon name="close" size={14} /></button>
    </div> : null}
  </div>;
}

export type WorkspaceTab<T extends string> = { id: T; label: string; icon: IconName; badge?: number | string; tone?: 'warn' | 'alert' | 'info' };

/** Tabs that switch the one open workspace panel, with arrow-key movement between tabs. */
export function WorkspaceTabs<T extends string>({ tabs, active, onChange, label }: { tabs: WorkspaceTab<T>[]; active: T; onChange: (id: T) => void; label: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (from: number, step: number) => {
    const next = (from + step + tabs.length) % tabs.length;
    onChange(tabs[next].id); refs.current[next]?.focus();
  };
  return <div className="workspace-tabs" role="tablist" aria-label={label}>
    {tabs.map((tab, i) => <button key={tab.id} ref={node => { refs.current[i] = node; }} role="tab" id={`tab-${tab.id}`} aria-selected={active === tab.id} aria-controls={`panel-${tab.id}`}
      tabIndex={active === tab.id ? 0 : -1} className={active === tab.id ? 'active' : ''} onClick={() => onChange(tab.id)}
      onKeyDown={event => { if (event.key === 'ArrowRight') { event.preventDefault(); move(i, 1); } else if (event.key === 'ArrowLeft') { event.preventDefault(); move(i, -1); } }}>
      <Icon name={tab.icon} size={17} /><span>{tab.label}</span>{tab.badge !== undefined && tab.badge !== 0 ? <span className={`tab-badge ${tab.tone ?? 'info'}`}>{tab.badge}</span> : null}
    </button>)}
    <span className="tab-indicator" aria-hidden="true" style={{ '--index': tabs.findIndex(tab => tab.id === active), '--count': tabs.length } as React.CSSProperties} />
  </div>;
}

/** A capacity meter with a soft animated fill. */
export function CapacityBar({ used, capacity }: { used: number; capacity: number }) {
  const share = capacity ? Math.min(1, used / capacity) : 0;
  return <span className={`capacity-bar ${share >= 0.9 ? 'full' : share >= 0.7 ? 'busy' : ''}`} aria-hidden="true"><span style={{ width: `${Math.round(share * 100)}%` }} /></span>;
}
