import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from '../Icon';

export type NoticeTone = 'info' | 'success' | 'warn' | 'money';
export type Notice = { id: number; text: string; at: number; day: number; tone: NoticeTone };
const TONE_ICON: Record<NoticeTone, IconName> = { info: 'info', success: 'checkCircle', warn: 'alert', money: 'coins' };
const MAX_TOASTS = 3;
const lifetime = (text: string) => Math.min(14000, 5200 + text.length * 40);

/**
 * The newest notices as a stack of toasts. Each leaves on its own timer or when dismissed; every notice also stays in
 * the activity log. The region is a polite live region, so screen readers hear each new notice once.
 */
export function ToastStack({ notices }: { notices: Notice[] }) {
  const [gone, setGone] = useState<ReadonlySet<number>>(new Set());
  const [leaving, setLeaving] = useState<ReadonlySet<number>>(new Set());
  const [, tick] = useState(0);
  // While the pointer or focus is on the stack, toasts stay; afterwards each gets its remaining time back.
  const [held, setHeld] = useState(false);
  const pausedAt = useRef(0), extra = useRef(new Map<number, number>());
  const end = (notice: Notice) => notice.at + lifetime(notice.text) + (extra.current.get(notice.id) ?? 0);
  const visible = notices.slice(0, MAX_TOASTS).filter(notice => !gone.has(notice.id) && (held || Date.now() < end(notice) + 400));
  const dismiss = (id: number) => {
    setLeaving(current => new Set(current).add(id));
    window.setTimeout(() => setGone(current => new Set(current).add(id)), 260);
  };
  useEffect(() => {
    if (held) return;
    const timers = visible.map(notice => window.setTimeout(() => dismiss(notice.id), Math.max(0, end(notice) - Date.now())));
    const refresh = window.setInterval(() => tick(n => n + 1), 4000);
    return () => { timers.forEach(window.clearTimeout); window.clearInterval(refresh); };
  }, [visible.map(notice => notice.id).join(','), held]);
  const hold = (on: boolean) => {
    if (on === held) return;
    if (on) pausedAt.current = Date.now();
    else { const paused = Date.now() - pausedAt.current; for (const notice of visible) extra.current.set(notice.id, (extra.current.get(notice.id) ?? 0) + paused); }
    setHeld(on);
  };
  return <div className={`toast-region ${held ? 'held' : ''}`} role="status" aria-live="polite" onPointerEnter={() => hold(true)} onPointerLeave={() => hold(false)}
    onFocus={() => hold(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) hold(false); }}>
    {visible.slice().reverse().map(notice => <div key={notice.id} className={`toast tone-${notice.tone} ${leaving.has(notice.id) ? 'leaving' : ''}`}>
      <span className="toast-icon" aria-hidden="true"><Icon name={TONE_ICON[notice.tone]} size={16} /></span>
      <p>{notice.text}</p>
      <button className="quiet icon-button btn-sm toast-close" onClick={() => dismiss(notice.id)} aria-label="Dismiss notice"><Icon name="close" size={14} /></button>
      <span className="toast-timer" aria-hidden="true" style={{ animationDuration: `${lifetime(notice.text)}ms` }} />
    </div>)}
  </div>;
}

const ago = (at: number) => {
  const seconds = Math.round((Date.now() - at) / 1000);
  if (seconds < 45) return 'just now';
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  return `${Math.round(seconds / 3600)} h ago`;
};

/** Every notice this session, newest first, with its game day. */
export function ActivityLog({ notices, onClear }: { notices: Notice[]; onClear: () => void }) {
  return <div className="activity">
    <header><span className="eyebrow">Activity</span><strong>{notices.length ? `${notices.length} notice${notices.length === 1 ? '' : 's'} this session` : 'Nothing yet'}</strong>
      {notices.length ? <button className="quiet btn-sm" onClick={onClear}>Clear</button> : null}</header>
    {notices.length ? <ol>{notices.map(notice => <li key={notice.id} className={`tone-${notice.tone}`}>
      <span className="activity-icon" aria-hidden="true"><Icon name={TONE_ICON[notice.tone]} size={14} /></span>
      <div><p>{notice.text}</p><small>Game day {notice.day} · {ago(notice.at)}</small></div>
    </li>)}</ol> : <p className="empty-copy">Actions, sales, births and calendar reports will be listed here.</p>}
  </div>;
}

export type PaletteCommand = { id: string; label: string; group: string; icon?: IconName; hint?: string; keywords?: string; shortcut?: string; run: () => void };

function score(command: PaletteCommand, query: string) {
  if (!query) return 1;
  const label = command.label.toLowerCase(), words = query.toLowerCase().split(/\s+/).filter(Boolean);
  let total = 0;
  for (const word of words) {
    if (label.startsWith(word)) total += 6;
    else if (label.split(/[\s·×-]+/).some(part => part.startsWith(word))) total += 4;
    else if (label.includes(word)) total += 2;
    else if (`${command.keywords ?? ''} ${command.hint ?? ''} ${command.group}`.toLowerCase().includes(word)) total += 1;
    else return 0;
  }
  return total;
}

/** Ctrl/⌘ K: jump to any view, aquarium or animal, or run a common action, from the keyboard. */
export function CommandPalette({ open, onClose, commands }: { open: boolean; onClose: () => void; commands: PaletteCommand[] }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null), list = useRef<HTMLDivElement>(null);
  const results = useMemo(() => commands.map(command => ({ command, score: score(command, query) })).filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score).slice(0, query ? 40 : 60).map(entry => entry.command), [commands, query]);
  const grouped = useMemo(() => {
    const order: string[] = [], byGroup = new Map<string, PaletteCommand[]>();
    for (const command of results) { if (!byGroup.has(command.group)) { byGroup.set(command.group, []); order.push(command.group); } byGroup.get(command.group)!.push(command); }
    return order.map(group => ({ group, items: byGroup.get(group)! }));
  }, [results]);
  const flat = grouped.flatMap(entry => entry.items);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    setQuery(''); setActive(0);
    const focus = window.setTimeout(() => input.current?.focus(), 20);
    return () => { window.clearTimeout(focus); if (previous?.isConnected) previous.focus(); };
  }, [open]);
  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => { list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }); }, [active]);
  if (!open) return null;
  const run = (command: PaletteCommand | undefined) => { if (!command) return; onClose(); window.setTimeout(command.run, 0); };
  return createPortal(<div className="dialog-root palette-root">
    <div className="dialog-backdrop" onClick={onClose} aria-hidden="true" />
    <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette" onPointerUp={() => input.current?.focus()}>
      <div className="palette-search"><Icon name="search" size={18} />
        <input ref={input} type="search" autoComplete="off" spellCheck={false} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search fish, aquariums, views and actions…"
          role="combobox" aria-expanded="true" aria-controls="palette-list" aria-activedescendant={flat[active] ? `palette-${flat[active].id}` : undefined} aria-autocomplete="list"
          onKeyDown={event => {
            if (event.key === 'ArrowDown') { event.preventDefault(); setActive(i => Math.min(flat.length - 1, i + 1)); }
            else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(i => Math.max(0, i - 1)); }
            else if (event.key === 'Enter') { event.preventDefault(); run(flat[active]); }
            else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
            else if (event.key === 'Tab') event.preventDefault();
          }} />
        <kbd>Esc</kbd></div>
      <div className="palette-list" id="palette-list" role="listbox" ref={list} aria-label="Results">
        {grouped.map(({ group, items }) => <div key={group} role="group" aria-label={group}>
          <div className="palette-group" aria-hidden="true">{group}</div>
          {items.map(command => {
            const index = flat.indexOf(command);
            return <div key={command.id} id={`palette-${command.id}`} role="option" aria-selected={index === active} data-active={index === active} className="palette-item"
              onPointerMove={() => setActive(index)} onClick={() => run(command)}>
              <span className="palette-icon" aria-hidden="true">{command.icon ? <Icon name={command.icon} size={16} /> : null}</span>
              <span className="palette-label">{command.label}{command.hint ? <small>{command.hint}</small> : null}</span>
              {command.shortcut ? <kbd>{command.shortcut}</kbd> : <Icon name="arrowRight" size={14} className="palette-go" />}
            </div>;
          })}
        </div>)}
        {!flat.length ? <p className="empty-copy">No match for “{query}”.</p> : null}
      </div>
      <footer className="palette-footer"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>?</kbd> all shortcuts</span></footer>
    </div>
  </div>, document.body);
}
