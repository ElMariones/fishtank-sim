import { quietTank, type AbsenceSummary, type TankAbsence } from '../core/absence';

const pct = (value: number) => `${Math.round(value * 100)}%`;
const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

function changes(tank: TankAbsence): string {
  const parts = [plural(tank.residents, 'fish', 'fish')];
  if (tank.eggsHatched) parts.push(`${plural(tank.eggsHatched, 'egg')} hatched`);
  if (tank.becameJuvenile) parts.push(`${tank.becameJuvenile} became juvenile`);
  if (tank.becameAdult) parts.push(`${tank.becameAdult} reached adulthood`);
  if (tank.conditionBefore !== null && tank.conditionAfter !== null && Math.abs(tank.conditionAfter - tank.conditionBefore) >= 0.005)
    parts.push(`mean condition ${pct(tank.conditionBefore)} → ${pct(tank.conditionAfter)}`);
  if (tank.declined) parts.push(`${tank.declined} declined`);
  return parts.join(' · ');
}

/** FS-307 return summary: per-tank changes during protected offline time, their causes, and what needs attention now. */
export function AbsencePanel({ summary, notice, onOpenTank, onDismiss }: { summary: AbsenceSummary; notice: string; onOpenTank: (tankId: string) => void; onDismiss: () => void }) {
  const reported = summary.tanks.filter(tank => !quietTank(tank)), quiet = summary.tanks.length - reported.length;
  return <section className="absence-panel" aria-labelledby="absence-title">
    <div className="absence-heading">
      <div><div className="eyebrow">WHILE YOU WERE AWAY</div><h2 id="absence-title">{plural(summary.gameDays, 'game day')} passed</h2><p>{notice}</p></div>
      <button className="quiet" onClick={onDismiss}>Dismiss</button>
    </div>
    {reported.length ? <ul>{reported.map(tank => <li key={tank.tankId}>
      <div><strong>{tank.name}</strong><span>{changes(tank)}</span></div>
      <p>{tank.limitDays.length ? `Condition was limited by ${tank.limitDays.map(limit => `${limit.cause} (${plural(limit.days, 'day')})`).join(', ')}.` : 'Nothing limited these fish.'}</p>
      {tank.warnings.length ? <p className="absence-warnings">Needs attention now: {tank.warnings.map(warning => `${warning.severity === 'critical' ? 'urgent ' : ''}${warning.title.toLowerCase()}`).join(', ')}.</p> : null}
      <button onClick={() => onOpenTank(tank.tankId)}>Open {tank.name}</button>
    </li>)}</ul> : null}
    <p className="help-copy">{quiet ? `${plural(quiet, 'tank')} had nothing to report. ` : ''}{summary.unexplainedDeclines
      ? `${plural(summary.unexplainedDeclines, 'condition decline')} had no named cause; please export this save and report it.`
      : 'Every condition decline had a named cause. Fish never die in this lab.'}</p>
  </section>;
}
