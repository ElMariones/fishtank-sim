import type { ReactNode } from 'react';
import type { TankStyle } from '../core/aquascape';
import type { CareStatus } from '../core/careAdvice';
import type { Tank } from '../core/types';
import { Icon, type IconName } from './Icon';
import { ActivityLog, type Notice } from './kit/Feedback';
import { MenuButton, useContextMenu, type MenuEntry } from './kit/Menu';
import { Popover } from './kit/Overlay';
import { AnimatedNumber, CapacityBar } from './ShellParts';

export type LabView = 'aquarium' | 'research' | 'fixtures' | 'competitions' | 'trophies';
export type TankSummary = { id: string; name: string; capacity: number; living: number; eggs: number; tone: 'good' | 'warn' | 'alert'; style: TankStyle };
export type TankAction = 'open' | 'aquascape' | 'care' | 'habitat';

const PRIMARY: [LabView, string, IconName, string][] = [
  ['aquarium', 'Aquarium', 'tank', 'G then A'], ['competitions', 'Competitions', 'trophy', 'G then C'], ['trophies', 'Trophy room', 'medal', 'G then T'],
];
const RESEARCH: [LabView, string, IconName][] = [['research', 'Research studies', 'flask'], ['fixtures', 'Visual fixtures', 'grid']];
const TONE_TEXT = { good: 'Water good', warn: 'Needs care', alert: 'Urgent care' } as const;
/** Backdrop and substrate colours for the rail's tank swatches, matching the renderer's palette. */
const BACKDROP: Record<TankStyle['backdrop'], [string, string]> = {
  deep: ['#1f5a63', '#071a21'], clear: ['#5fb9c4', '#123f4b'], black: ['#1c262b', '#040607'], forest: ['#3f6d57', '#0b1a14'], mountains: ['#6d93a2', '#122734'], blackwater: ['#8a6431', '#1b1005'],
};
const SUBSTRATE: Record<TankStyle['substrate'], string> = { sand: '#d3bd8f', gravel: '#8d8173', pebbles: '#7b776d', black: '#2c3034', soil: '#4b3527', coral: '#ecdfd1' };

type RailProps = {
  view: LabView; onView: (view: LabView) => void; compact: boolean; onCompact: () => void;
  tanks: TankSummary[]; activeTankId: string; loadingTankId?: string | null; onTank: (id: string) => void; onTankAction: (id: string, action: TankAction) => void; onAddTank: () => void;
  credits: number; saveState: string; guide: { done: number; total: number; hidden: boolean };
  onMarket: () => void; onShop: () => void; onSaves: () => void; onGuide: () => void; onExport: () => void;
  open: { market: boolean; shop: boolean; saves: boolean };
};

/** The left navigation rail: brand, lab views, aquariums as live swatches with their own menus, and lab tools. */
export function NavRail({ view, onView, compact, onCompact, tanks, activeTankId, loadingTankId, onTank, onTankAction, onAddTank, credits, saveState, guide, onMarket, onShop, onSaves, onGuide, onExport, open }: RailProps) {
  const saving = saveState === 'Saving…', failed = saveState === 'Session not saved';
  const context = useContextMenu();
  const tankMenu = (tank: TankSummary): MenuEntry[] => [
    { type: 'heading', id: 'h', label: tank.name },
    { id: 'open', label: 'Open aquarium', icon: 'tank', onSelect: () => onTankAction(tank.id, 'open') },
    { id: 'aquascape', label: 'Aquascape', icon: 'brush', hint: 'Decorate on the live tank', tone: 'brass', onSelect: () => onTankAction(tank.id, 'aquascape') },
    { id: 'care', label: 'Care controls', icon: 'drop', hint: TONE_TEXT[tank.tone], onSelect: () => onTankAction(tank.id, 'care') },
    { id: 'habitat', label: 'Habitat & expansion', icon: 'leaf', onSelect: () => onTankAction(tank.id, 'habitat') },
  ];
  const tool = (icon: IconName, label: string, onClick: () => void, extra?: ReactNode, expanded?: boolean, className = '') =>
    <button className={`rail-item rail-tool ${className}`} onClick={onClick} aria-label={label} data-tip={label} data-tip-collapsed data-tip-side="right" aria-expanded={expanded}>
      <Icon name={icon} /><span className="rail-label">{label}</span>{extra}</button>;
  return <aside className={`nav-rail ${compact ? 'compact' : ''}`} aria-label="Lab navigation">
    <div className="rail-top">
      <a className="rail-brand" href="#" aria-label="Fishtank, go to the aquarium" onClick={event => { event.preventDefault(); onView('aquarium'); }}>
        <img className="brand-mark" src="/brand/mark.svg" alt="" width="40" height="40" />
        <span className="rail-label brand-words"><b translate="no">Fishtank</b><small>Genetics lab</small></span>
      </a>
      <button className="quiet icon-button btn-sm rail-collapse" onClick={onCompact} aria-label={compact ? 'Expand navigation' : 'Collapse navigation'} data-tip={compact ? 'Expand navigation' : 'Collapse navigation'} data-tip-side="right">
        <Icon name="sidebar" size={17} /></button>
    </div>
    <nav className="rail-section" aria-label="Lab views">
      {PRIMARY.map(([value, label, icon]) => <button key={value} aria-label={label} data-tip={label} data-tip-collapsed data-tip-side="right"
        className={`rail-item rail-link ${view === value ? 'active' : ''}`} aria-current={view === value ? 'page' : undefined} onClick={() => onView(value)}>
        <Icon name={icon} /><span className="rail-label">{label}</span>
      </button>)}
    </nav>
    {view === 'aquarium' ? <div className="rail-section rail-tanks">
      <div className="rail-heading rail-label"><span>Aquariums</span><span className="mono">{tanks.length}/8</span></div>
      <nav aria-label="Aquariums">{tanks.map((tank, i) => {
        const [top, bottom] = BACKDROP[tank.style.backdrop];
        return <div className={`rail-tank ${tank.id === activeTankId ? 'active' : ''}`} key={tank.id} onContextMenu={event => context.open(event, tankMenu(tank), `${tank.name} actions`)}>
          <button className={`tank-card ${tank.id === loadingTankId ? 'loading' : ''}`} aria-current={tank.id === activeTankId ? 'true' : undefined} aria-busy={tank.id === loadingTankId}
            onClick={() => onTank(tank.id)} aria-label={`${tank.name}: ${tank.living} of ${tank.capacity} places${tank.eggs ? `, ${tank.eggs} eggs` : ''}, ${TONE_TEXT[tank.tone].toLowerCase()}`}
            data-tip={`${tank.name} · ${tank.living}/${tank.capacity}`} data-tip-collapsed data-tip-side="right"
            onKeyDown={event => { if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) { event.preventDefault(); context.openFor(event.currentTarget, tankMenu(tank), `${tank.name} actions`); } }}>
            <span className="tank-swatch" aria-hidden="true" style={{ '--sw-top': top, '--sw-bottom': bottom, '--sw-floor': SUBSTRATE[tank.style.substrate] } as React.CSSProperties}>
              <span className="mono">{String(i + 1).padStart(2, '0')}</span><i className={`tone-dot ${tank.tone}`} />
            </span>
            <span className="rail-label tank-card-body">
              <span className="tank-card-name">{tank.name}</span>
              <small><span className="mono">{tank.living}/{tank.capacity}</span>{tank.eggs ? <> · <Icon name="egg" size={11} /> {tank.eggs}</> : null} · <span className={`tone-text ${tank.tone}`}>{TONE_TEXT[tank.tone]}</span></small>
              <CapacityBar used={tank.living} capacity={tank.capacity} />
            </span>
          </button>
          {compact ? null : <MenuButton className="quiet icon-button btn-sm tank-more" items={tankMenu(tank)} label={`${tank.name} actions`} ariaLabel={`${tank.name} actions`} placement="right-start">
            <Icon name="more" size={16} /></MenuButton>}
        </div>;
      })}</nav>
      <button className="rail-item rail-add" onClick={onAddTank} aria-label="Add or expand aquariums" data-tip="Add or expand aquariums" data-tip-collapsed data-tip-side="right">
        <Icon name="plus" size={16} /><span className="rail-label">Add or expand aquariums</span></button>
    </div> : null}
    <div className="rail-section rail-research">
      <div className="rail-heading rail-label"><span>Research</span></div>
      {RESEARCH.map(([value, label, icon]) => <button key={value} aria-label={label} data-tip={label} data-tip-collapsed data-tip-side="right"
        className={`rail-item rail-link minor ${view === value ? 'active' : ''}`} aria-current={view === value ? 'page' : undefined} onClick={() => onView(value)}>
        <Icon name={icon} size={17} /><span className="rail-label">{label}</span>
      </button>)}
    </div>
    <div className="rail-section rail-tools">
      <div className="rail-heading rail-label"><span>Tools</span></div>
      {tool('coins', 'Buyers & ledger', onMarket, <span className="rail-meta brass mono">◈ <AnimatedNumber value={credits} /></span>, open.market)}
      {view === 'aquarium' ? tool('shop', 'NPC shop', onShop, undefined, open.shop) : null}
      {view === 'aquarium' ? tool('compass', 'First-session guide', onGuide, <span className={`ring rail-meta ${guide.done === guide.total ? 'complete' : ''}`} style={{ '--value': guide.done / guide.total, '--size': '30px' } as React.CSSProperties}>{guide.done}/{guide.total}</span>, !guide.hidden) : null}
      <div className="rail-pair">
        {tool('save', 'Saves', onSaves, undefined, open.saves)}
        {tool('download', 'Export', onExport, undefined, undefined, 'rail-export')}
      </div>
    </div>
    <div className={`rail-save ${saving ? 'saving' : failed ? 'failed' : 'saved'}`} role="status" data-tip={saveState} data-tip-collapsed data-tip-side="right">
      <span className="save-dot" aria-hidden="true" /><span className="rail-label">{saveState}</span></div>
    {context.node}
  </aside>;
}

type TopbarProps = {
  eyebrow: string; title: string;
  calendar: { label: string; day: number; disabledReason: string | null; advancing: boolean; onAdvance: (days: 1 | 7 | 30) => void };
  credits: number; living: number; courting: number; incubating: number; records: number;
  onLedger: () => void; onSearch: () => void; onShortcuts: () => void;
  notices: Notice[]; unread: number; onReadNotices: () => void; onClearNotices: () => void;
};

/** The slim top bar: where you are, the calendar, live numbers, search and the activity log. */
export function Topbar({ eyebrow, title, calendar, credits, living, courting, incubating, records, onLedger, onSearch, onShortcuts, notices, unread, onReadNotices, onClearNotices }: TopbarProps) {
  const blocked = !!calendar.disabledReason || calendar.advancing;
  // A blocked advance stays focusable: pressing it explains why time cannot move yet.
  const advance: MenuEntry[] = [
    { type: 'heading', id: 'h', label: calendar.disabledReason ? 'Calendar on hold' : 'Advance the calendar' },
    { id: 'd', label: 'One day', icon: 'clock', hint: 'Growth, hatching and care for 1 game day', shortcut: '.', onSelect: () => calendar.onAdvance(1), disabled: calendar.advancing },
    { id: 'w', label: 'One week', icon: 'calendar', hint: '7 days · courtships usually finish', onSelect: () => calendar.onAdvance(7), disabled: calendar.advancing },
    { id: 'm', label: 'One month', icon: 'fastForward', hint: '30 days · eggs grow into juveniles', onSelect: () => calendar.onAdvance(30), disabled: calendar.advancing },
  ];
  return <header className="topbar">
    <div className="topbar-title"><span className="eyebrow">{eyebrow}</span><strong>{title}</strong></div>
    <div className={`calendar ${calendar.advancing ? 'advancing' : ''}`} role="group" aria-label="Simulation calendar" aria-busy={calendar.advancing}>
      <span className="calendar-date" data-tip="Time only moves when you advance it. Feeder settings apply during every skip."><Icon name="calendar" size={17} />
        <span><strong>{calendar.label}</strong><small className="mono">Day {calendar.day}</small></span><span className="visually-hidden">Time only moves when you advance it. Feeder settings apply during every skip.</span></span>
      <span className="split-button">
        <button className="primary calendar-advance" aria-label={calendar.advancing ? 'Simulating' : 'Advance one game day'} aria-disabled={blocked || undefined} aria-describedby={calendar.disabledReason ? 'calendar-hold' : undefined}
          onClick={() => calendar.onAdvance(1)} data-tip={calendar.disabledReason ?? 'Advance one game day (.)'}>
          {calendar.advancing ? <span className="spinner" aria-hidden="true" /> : <Icon name="play" size={14} />}<span>{calendar.advancing ? 'Simulating…' : 'Next day'}</span></button>
        <MenuButton className="primary icon-button calendar-more" items={advance} label="Advance by" ariaLabel="More ways to advance the calendar" placement="bottom-end" disabled={calendar.advancing}>
          <Icon name="chevronDown" size={15} /></MenuButton>
      </span>
      {calendar.disabledReason ? <span id="calendar-hold" className="visually-hidden">{calendar.disabledReason}</span> : null}
    </div>
    <div className="top-stats" role="group" aria-label="Lab totals">
      <button className="stat-pill brass" onClick={onLedger} data-tip="Buyers, prices and your ledger"><Icon name="coins" size={16} /><span className="stat-value mono"><AnimatedNumber value={credits} format={n => `◈ ${n.toLocaleString('en')}`} /></span><span className="visually-hidden">lab credits, open buyers and ledger</span></button>
      <span className="stat-pill lume" data-tip="Living animals in every aquarium"><Icon name="fish" size={16} /><span className="stat-value mono"><AnimatedNumber value={living} /></span><span className="stat-label">living</span></span>
      <span className="stat-pill koi" data-tip={`${courting} courting · ${incubating} incubating`}><Icon name="heart" size={16} /><span className="stat-value mono">{courting + incubating}</span><span className="stat-label">clutches</span><span className="visually-hidden">: {courting} courting, {incubating} incubating</span></span>
      <span className="stat-pill gene" data-tip="Every animal ever recorded, including the archive"><Icon name="dna" size={16} /><span className="stat-value mono"><AnimatedNumber value={records} /></span><span className="stat-label">records</span></span>
    </div>
    <div className="topbar-actions">
      <button className="search-button" onClick={onSearch} aria-label="Search and commands" data-tip="Search fish, tanks and actions"><Icon name="search" size={16} /><span>Search</span><kbd>Ctrl K</kbd></button>
      <Popover label="Activity" className="activity-popover" triggerClassName="quiet icon-button activity-button" tip="Activity" onOpen={onReadNotices}
        trigger={<><Icon name="bell" size={18} />{unread ? <span className="badge lume activity-badge">{unread > 9 ? '9+' : unread}</span> : null}<span className="visually-hidden">Activity{unread ? `, ${unread} new` : ''}</span></>}>
        <ActivityLog notices={notices} onClear={onClearNotices} />
      </Popover>
      <button className="quiet icon-button shortcuts-button" onClick={onShortcuts} aria-label="Keyboard shortcuts and about" data-tip="Shortcuts (?)"><Icon name="command" size={17} /></button>
    </div>
  </header>;
}

const LEVEL_TONE: Record<string, 'good' | 'warn' | 'alert'> = {
  good: 'good', low: 'warn', critical: 'alert', clean: 'good', elevated: 'warn', high: 'alert',
  light: 'good', moderate: 'good', heavy: 'warn', overstocked: 'alert', fed: 'good', underfed: 'warn', starving: 'alert',
};
const worst = (...tones: ('good' | 'warn' | 'alert')[]) => tones.includes('alert') ? 'alert' : tones.includes('warn') ? 'warn' : 'good';

/** Glass status over the live aquarium. The chips open a water report; a warning button jumps to Care. */
export function TankHud({ status, tank, warnings, onCare, paused }: { status: CareStatus; tank: Tank; warnings: { critical: number; total: number }; onCare: () => void; paused: boolean }) {
  const tone = (level: string) => LEVEL_TONE[level] ?? 'good';
  const overall = worst(tone(status.oxygen), tone(status.ammonia), tone(status.stocking), status.hatched ? tone(status.fedLevel) : 'good');
  const chip = (icon: IconName, label: string, short: string, level: string) =>
    <span className={`hud-chip ${tone(level)}`}><Icon name={icon} size={14} /><span className="hud-chip-text" aria-hidden="true"><b>{short}</b> {level}</span><span className="visually-hidden">{label} {level}</span></span>;
  const row = (icon: IconName, label: string, level: string, value: string, share: number, note: string) =>
    <div className={`water-row ${tone(level)}`}><span className="water-row-icon"><Icon name={icon} size={16} /></span>
      <div><span className="water-row-head"><b>{label}</b><span className={`chip ${tone(level) === 'good' ? 'lume' : tone(level)}`}>{level}</span></span>
        <span className={`bar ${tone(level) === 'good' ? '' : tone(level)}`}><span style={{ width: `${Math.round(Math.max(0.04, Math.min(1, share)) * 100)}%` }} /></span>
        <small><span className="mono">{value}</span> · {note}</small></div></div>;
  return <div className="tank-hud">
    <span className={`live-badge ${paused ? 'paused' : ''}`}><span className="live-dot" aria-hidden="true" />{paused ? 'Paused' : 'Live'}</span>
    <Popover label="Water report" placement="bottom-start" className="water-popover" triggerClassName={`bare hud-chips ${overall}`} tip="Water report"
      trigger={<>{chip('bubbles', 'Oxygen', 'O₂', status.oxygen)}{chip('biohazard', 'Ammonia', 'NH₃', status.ammonia)}{chip('fish', 'Stocking', 'Stock', status.stocking)}
        {status.hatched ? chip('food', 'Feeding', 'Food', status.fedLevel) : null}
        <span className="hud-chip neutral"><Icon name="thermo" size={14} /><span className="hud-chip-text mono">{status.temperatureC.toFixed(1)}°</span><span className="visually-hidden">Water temperature</span></span></>}>
      {close => <div className="water-report">
        <header><span className="eyebrow">Water report</span><strong>{tank.name}</strong><span className={`chip ${overall === 'good' ? 'lume' : overall}`}>{overall === 'good' ? 'Healthy' : overall === 'warn' ? 'Needs care' : 'Urgent'}</span></header>
        {row('bubbles', 'Oxygen', status.oxygen, `${tank.water.oxygenMgL.toFixed(1)} mg/L`, tank.water.oxygenMgL / 9, 'dissolved oxygen')}
        {row('biohazard', 'Ammonia', status.ammonia, `${tank.water.ammoniaMgL.toFixed(2)} mg N/L`, 1 - Math.min(1, tank.water.ammoniaMgL / 1), 'lower is better')}
        {row('fish', 'Stocking', status.stocking, `${status.densityKgM3.toFixed(1)} kg/m³`, 1 - Math.min(1, status.densityKgM3 / 30), `${status.residents} residents`)}
        {status.hatched ? row('food', 'Feeding', status.fedLevel, `${Math.round(status.fed * 100)}% of need`, status.fed, `${Math.round(status.needGPerDay).toLocaleString('en')} g per game day`) : null}
        {row('thermo', 'Temperature', status.comfort >= 1 ? 'good' : status.comfort >= 0.6 ? 'low' : 'critical', `${status.temperatureC.toFixed(1)} °C → ${status.targetC} °C`, status.comfort, status.comfort >= 1 ? 'comfortable' : 'outside comfort')}
        <footer><button className="primary btn-sm" onClick={() => { close(); onCare(); }}><Icon name="drop" size={14} />Open care controls</button></footer>
      </div>}
    </Popover>
    {warnings.total ? <button className={`hud-alert ${warnings.critical ? 'alert' : 'warn'}`} onClick={onCare}><Icon name="alert" size={14} />{warnings.total} care warning{warnings.total === 1 ? '' : 's'}</button> : null}
  </div>;
}
