import type { CareStatus } from '../core/careAdvice';
import { Icon, type IconName } from './Icon';
import { AnimatedNumber, CapacityBar } from './ShellParts';

export type LabView = 'aquarium' | 'research' | 'fixtures' | 'competitions' | 'trophies';
export type TankSummary = { id: string; name: string; capacity: number; living: number; eggs: number; tone: 'good' | 'warn' | 'alert' };

const VIEW_ITEMS: [LabView, string, IconName][] = [['aquarium', 'Aquarium', 'fish'], ['competitions', 'Competitions', 'trophy'], ['trophies', 'Trophy room', 'spark'], ['research', 'Research', 'flask'], ['fixtures', 'Visual fixtures', 'grid']];
const TONE_TEXT = { good: 'water good', warn: 'needs care', alert: 'urgent care' } as const;

type RailProps = {
  view: LabView; onView: (view: LabView) => void;
  tanks: TankSummary[]; activeTankId: string; onTank: (id: string) => void; onHabitat: () => void;
  /** The aquarium whose collection is still loading, shown with a spinner on its card. */
  loadingTankId?: string | null;
  credits: number; saveState: string; guide: { done: number; total: number; hidden: boolean };
  onMarket: () => void; onShop: () => void; onSaves: () => void; onGuide: () => void; onExport: () => void;
  open: { market: boolean; shop: boolean; saves: boolean };
};

/** The left navigation rail: lab views, aquariums with live capacity and water status, and lab tools. */
export function NavRail({ view, onView, tanks, activeTankId, loadingTankId, onTank, onHabitat, credits, saveState, guide, onMarket, onShop, onSaves, onGuide, onExport, open }: RailProps) {
  const saving = saveState === 'Saving…', failed = saveState === 'Session not saved';
  const tool = (icon: IconName, label: string, onClick: () => void, extra?: React.ReactNode, expanded?: boolean) =>
    <button className="rail-tool" onClick={onClick} aria-label={label} title={label} aria-expanded={expanded}><Icon name={icon} /><span className="rail-label">{label}</span>{extra}</button>;
  return <aside className="nav-rail" aria-label="Lab navigation">
    <a className="rail-brand" href="#" aria-label="Fishtank Sim aquarium" onClick={event => { event.preventDefault(); onView('aquarium'); }}>
      <span className="brand-mark"><img src="/favicon.svg" alt="" /></span>
      <span className="rail-label brand-words">fishtank<span className="brand-light"> sim</span><small>Genetics lab · 0.1</small></span>
    </a>
    <nav className="rail-section" aria-label="Lab views">
      {VIEW_ITEMS.map(([value, label, icon]) => <button key={value} aria-label={label} title={label} className={`rail-link ${view === value ? 'active' : ''}`} aria-current={view === value ? 'page' : undefined} onClick={() => onView(value)}>
        <Icon name={icon} /><span className="rail-label">{label}</span>
      </button>)}
    </nav>
    {view === 'aquarium' ? <div className="rail-section rail-tanks">
      <div className="rail-heading rail-label">Aquariums <span>{tanks.length}/8</span></div>
      <nav aria-label="Aquariums">{tanks.map((tank, i) => <button key={tank.id} className={`tank-card ${tank.id === activeTankId ? 'active' : ''} ${tank.id === loadingTankId ? 'loading' : ''}`} aria-current={tank.id === activeTankId ? 'true' : undefined} aria-busy={tank.id === loadingTankId}
        onClick={() => onTank(tank.id)} title={`${tank.name}: ${tank.living} of ${tank.capacity} places, ${TONE_TEXT[tank.tone]}`}>
        <span className={`tank-dot ${tank.tone}`} aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
        <span className="rail-label tank-card-body">
          <span className="tank-card-name">{tank.name}</span>
          <small>{tank.living} / {tank.capacity} fish{tank.eggs ? ` · ${tank.eggs} eggs` : ''} · <span className={`tone-text ${tank.tone}`}>{TONE_TEXT[tank.tone]}</span></small>
          <CapacityBar used={tank.living} capacity={tank.capacity} />
        </span>
      </button>)}</nav>
      <button className="rail-add" aria-label="Aquariums & expansion" onClick={onHabitat}><Icon name="plus" size={16} /><span className="rail-label">Aquariums & expansion</span></button>
    </div> : null}
    <div className="rail-section rail-tools">
      <div className="rail-heading rail-label">Tools</div>
      {tool('coins', 'Buyers & ledger', onMarket, <span className="rail-meta gold">◈ <AnimatedNumber value={credits} /></span>, open.market)}
      {view === 'aquarium' ? tool('shop', 'NPC shop', onShop, undefined, open.shop) : null}
      {view === 'aquarium' ? tool('guide', 'First-session guide', onGuide, <span className={`guide-ring ${guide.done === guide.total ? 'complete' : ''}`} style={{ '--progress': guide.done / guide.total } as React.CSSProperties}>{guide.done}/{guide.total}</span>) : null}
      {tool('save', 'Saves', onSaves, undefined, open.saves)}
      {tool('download', 'Export save', onExport)}
    </div>
    <div className={`rail-save ${saving ? 'saving' : failed ? 'failed' : 'saved'}`} role="status"><span className="save-dot" aria-hidden="true" /><span className="rail-label">{saveState}</span></div>
  </aside>;
}

const LEVEL_TONE: Record<string, 'good' | 'warn' | 'alert'> = {
  good: 'good', low: 'warn', critical: 'alert', clean: 'good', elevated: 'warn', high: 'alert',
  light: 'good', moderate: 'good', heavy: 'warn', overstocked: 'alert', fed: 'good', underfed: 'warn', starving: 'alert',
};

/** Glass status chips over the live aquarium, with a shortcut to the care tab when something needs attention. */
export function TankHud({ status, warnings, onCare, paused }: { status: CareStatus; warnings: { critical: number; total: number }; onCare: () => void; paused: boolean }) {
  const chip = (icon: IconName, label: string, level: string, value: string) =>
    <span className={`hud-chip ${LEVEL_TONE[level] ?? 'good'}`} title={`${label}: ${level}`}><Icon name={icon} size={14} /><span>{value}</span><span className="visually-hidden">{label} {level}</span></span>;
  return <div className="tank-hud">
    <span className={`live-badge ${paused ? 'paused' : ''}`}><span className="live-dot" aria-hidden="true" />{paused ? 'Paused' : 'Live'}</span>
    <div className="hud-chips" role="group" aria-label="Water at a glance">
      {chip('drop', 'Oxygen', status.oxygen, status.oxygen)}
      {chip('wave', 'Ammonia', status.ammonia, status.ammonia)}
      {chip('fish', 'Stocking', status.stocking, status.stocking)}
      {status.hatched ? chip('heart', 'Feeding', status.fedLevel, status.fedLevel) : null}
      <span className="hud-chip neutral" title="Water temperature"><Icon name="spark" size={14} /><span>{status.temperatureC.toFixed(1)} °C</span></span>
    </div>
    {warnings.total ? <button className={`hud-alert ${warnings.critical ? 'alert' : 'warn'}`} onClick={onCare}><Icon name="spark" size={14} />{warnings.total} care warning{warnings.total === 1 ? '' : 's'}</button> : null}
  </div>;
}
