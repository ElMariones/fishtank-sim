import { useState } from 'react';
import { BUYERS, DAILY_DEMAND_CEILING, FOUNDER_RESALE_CAP } from '../core/economy';
import { economyExperiment, EXPERIMENT_DAYS, type EconomyReport } from '../core/economyExperiment';
import { STOCK_PRICE } from '../core/world';

const WIDTH = 520, HEIGHT = 190, PAD = 16;
const signed = (amount: number) => `${amount < 0 ? '−' : amount > 0 ? '+' : ''}◈ ${Math.abs(amount).toLocaleString('en')}`;

/** FS-501 E-05: seeded strategies over the same starting world, through the aquarium's own commands and NPC buyers. */
export function EconomyExperiment() {
  const [report, setReport] = useState<EconomyReport | null>(null);
  const [running, setRunning] = useState(false);
  function run() {
    setRunning(true);
    setTimeout(() => { setReport(economyExperiment()); setRunning(false); }, 20);
  }
  const values = report ? report.strategies.flatMap(strategy => strategy.days.map(day => day.credits)) : [];
  const max = Math.max(1200, ...values), min = Math.min(0, ...values);
  const x = (day: number) => PAD + (day - 1) / (EXPERIMENT_DAYS - 1) * (WIDTH - PAD * 2);
  const y = (credits: number) => HEIGHT - PAD - (credits - min) / Math.max(1, max - min) * (HEIGHT - PAD * 2);
  return <section className="fixture-section" aria-labelledby="economy-title">
    <div className="fixture-section-heading"><div><div className="eyebrow">FS-501 · E-05 ECONOMY AND CAPACITY</div><h2 id="economy-title">Six strategies over {EXPERIMENT_DAYS} game days</h2></div>
      <p>Each strategy starts from the same six founders and ◈ 1,200 and plays through the aquarium’s own commands, clock and NPC buyers. Tanks are free, as in the lab.</p></div>
    {!report ? <div className="selection-start">
      <p className="help-copy">Runs in this tab and never reads or changes your aquarium. It takes a few seconds.</p>
      <button className="primary" onClick={run} disabled={running}>{running ? 'Running…' : 'Run experiment'}</button>
    </div> : <>
      <div className="fixture-table-wrap"><table className="fixture-table">
        <caption>Results after {report.days} game days</caption>
        <thead><tr><th scope="col">Strategy</th><th scope="col">Net credits</th><th scope="col">Sold</th><th scope="col">Average price</th><th scope="col">Best day</th><th scope="col">Rehomed</th><th scope="col">Bred</th><th scope="col">Peak living</th><th scope="col">Income by buyer</th></tr></thead>
        <tbody>{report.strategies.map(strategy => <tr key={strategy.id}>
          <th scope="row">{strategy.label}</th><td>{signed(strategy.net)}</td><td>{strategy.sold}</td><td>{strategy.sold ? `◈ ${strategy.averagePrice}` : '—'}</td>
          <td>◈ {strategy.bestDayIncome}</td><td>{strategy.rehomed}</td><td>{strategy.bred}</td><td>{strategy.peakLiving}</td>
          <td>{BUYERS.filter(buyer => strategy.incomeByBuyer[buyer.id]).map(buyer => `${buyer.name} ◈ ${strategy.incomeByBuyer[buyer.id]}`).join(' · ') || '—'}</td>
        </tr>)}</tbody>
      </table></div>
      <svg className="economy-chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`Credits over ${report.days} game days: ${report.strategies.map(strategy => `${strategy.label} ends at ◈ ${strategy.finalCredits}`).join('; ')}.`}>
        <line className="trend-axis" x1={PAD} x2={WIDTH - PAD} y1={y(1200)} y2={y(1200)} />
        {report.strategies.map(strategy => <path key={strategy.id} className={`economy-line ${strategy.id}`} d={strategy.days.map((day, i) => `${i ? 'L' : 'M'}${x(day.day).toFixed(1)},${y(day.credits).toFixed(1)}`).join(' ')} />)}
      </svg>
      <ul className="economy-legend" aria-hidden="true">{report.strategies.map(strategy => <li key={strategy.id}><span className={`swatch ${strategy.id}`} />{strategy.label}</li>)}</ul>
      <ul className="economy-notes">{report.strategies.map(strategy => <li key={strategy.id}><strong>{strategy.label}.</strong> {strategy.description}{strategy.resaleLosses.length ? ` Each of ${strategy.resaleLosses.length} cycles lost ◈ ${Math.min(...strategy.resaleLosses)}–${Math.max(...strategy.resaleLosses)}.` : ''}</li>)}</ul>
      <p className="fixture-note">The line marks the starting ◈ 1,200. Once their starting demand is used, buyers can pay at most ◈ {DAILY_DEMAND_CEILING} a game day between them. Founders and bought stock never resell above ◈ {FOUNDER_RESALE_CAP}, below the ◈ {STOCK_PRICE} stock price.</p>
    </>}
  </section>;
}
