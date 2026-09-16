import { useState } from 'react';
import { BUYERS } from '../core/economy';
import { PAID_PRICES, paidEconomyPlaytest, PLAYTEST_DAYS, ROUTE_CHECK_DAYS, ROUTE_CHECK_EVERY, totalSinks, type PaidEconomyReport } from '../core/paidEconomy';

const WIDTH = 520, HEIGHT = 190, PAD = 16;
const credits = (amount: number) => `◈ ${amount.toLocaleString('en')}`;
const signed = (amount: number) => `${amount < 0 ? '−' : amount > 0 ? '+' : ''}${credits(Math.abs(amount))}`;
const gameDays = (count: number) => `${count} game day${count === 1 ? '' : 's'}`;
const dayText = (day: number | null) => day === null ? '—' : `day ${day}`;

/** FS-505: the complete solo loop with paid room, shop stock, equipment and the koi rescue, reported as sources and sinks. */
export function PaidEconomy() {
  const [report, setReport] = useState<PaidEconomyReport | null>(null);
  const [running, setRunning] = useState(false);
  function run() {
    setRunning(true);
    setTimeout(() => { setReport(paidEconomyPlaytest()); setRunning(false); }, 20);
  }
  const values = report ? report.keepers.flatMap(keeper => keeper.days.map(day => day.credits)) : [];
  const max = Math.max(1200, ...values);
  const x = (day: number) => PAD + (day - 1) / (PLAYTEST_DAYS - 1) * (WIDTH - PAD * 2);
  const y = (amount: number) => HEIGHT - PAD - amount / Math.max(1, max) * (HEIGHT - PAD * 2);
  return <section className="fixture-section" aria-labelledby="paid-economy-title">
    <div className="fixture-section-heading"><div><div className="eyebrow">FS-505 · PAID ECONOMY PLAYTEST</div><h2 id="paid-economy-title">Six keepers over {PLAYTEST_DAYS} game days with prices</h2></div>
      <p>Each keeper starts from the same six founders and ◈ 1,200 and uses only what the aquarium’s own buttons send: aquariums at {credits(PAID_PRICES.aquarium)}, expansions at {credits(PAID_PRICES.expansion)}, decorations at {credits(PAID_PRICES.decoration)}, shop listings, equipment, water changes, courtship, sales, rehoming and the koi rescue.</p></div>
    {!report ? <div className="selection-start">
      <p className="help-copy">Runs in this tab and never reads or changes your aquarium. It takes a few seconds.</p>
      <button className="primary" onClick={run} disabled={running}>{running ? 'Running…' : 'Run playtest'}</button>
    </div> : <>
      <div className="fixture-table-wrap"><table className="fixture-table">
        <caption>Sources and sinks after {report.days} game days</caption>
        <thead><tr><th scope="col">Keeper</th><th scope="col">Sales</th><th scope="col">Stock</th><th scope="col">Aquariums</th><th scope="col">Expansions</th><th scope="col">Decorations</th><th scope="col">Equipment</th><th scope="col">Water changes</th><th scope="col">Net</th><th scope="col">Lowest</th><th scope="col">Sales cover spending</th><th scope="col">Rescues</th></tr></thead>
        <tbody>{report.keepers.map(keeper => <tr key={keeper.id}>
          <th scope="row">{keeper.label}</th><td>{credits(keeper.flows.sales)}</td><td>{credits(keeper.flows.stock)}</td><td>{credits(keeper.flows.aquariums)}</td>
          <td>{credits(keeper.flows.expansions)}</td><td>{credits(keeper.flows.decorations)}</td><td>{credits(keeper.flows.careEquipment)}</td><td>{credits(keeper.flows.waterChanges)}</td>
          <td>{signed(keeper.net)}</td><td>{credits(keeper.lowestCredits)} · day {keeper.lowestDay}</td><td>{dayText(keeper.paybackDay)}</td><td>{keeper.rescues}</td>
        </tr>)}</tbody>
      </table></div>
      <svg className="economy-chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`Credits over ${report.days} game days: ${report.keepers.map(keeper => `${keeper.label} lowest ${credits(keeper.lowestCredits)}, ends at ${credits(keeper.finalCredits)}`).join('; ')}.`}>
        <line className="trend-axis" x1={PAD} x2={WIDTH - PAD} y1={y(1200)} y2={y(1200)} />
        <line className="trend-axis" x1={PAD} x2={WIDTH - PAD} y1={y(0)} y2={y(0)} />
        {report.keepers.map(keeper => <path key={keeper.id} className={`economy-line paid-${keeper.id}`} d={keeper.days.map((day, i) => `${i ? 'L' : 'M'}${x(day.day).toFixed(1)},${y(day.credits).toFixed(1)}`).join(' ')} />)}
      </svg>
      <ul className="economy-legend" aria-hidden="true">{report.keepers.map(keeper => <li key={keeper.id}><span className={`swatch paid-${keeper.id}`} />{keeper.label}</li>)}</ul>
      <div className="fixture-table-wrap"><table className="fixture-table">
        <caption>The loop and the no-softlock checks</caption>
        <thead><tr><th scope="col">Keeper</th><th scope="col">First courtship</th><th scope="col">First eggs</th><th scope="col">First hatch</th><th scope="col">First sale</th><th scope="col">Room bought</th><th scope="col">Second generation</th><th scope="col">Places</th><th scope="col">Peak living</th><th scope="col">Sold / rehomed</th><th scope="col">Longest route to a pairing</th></tr></thead>
        <tbody>{report.keepers.map(keeper => <tr key={keeper.id}>
          <th scope="row">{keeper.label}</th>
          <td>{dayText(keeper.milestones.firstCourtship)}</td><td>{dayText(keeper.milestones.firstEggs)}</td><td>{dayText(keeper.milestones.firstHatch)}</td>
          <td>{dayText(keeper.milestones.firstSale)}</td><td>{dayText(keeper.milestones.firstRoomBought)}</td><td>{dayText(keeper.milestones.secondGeneration)}</td>
          <td>{keeper.finalPlaces}</td><td>{keeper.peakLiving}</td><td>{keeper.sold} / {keeper.rehomed}</td>
          <td>{gameDays(Math.max(...keeper.routeChecks.map(check => check.days)))}{keeper.reconciled && keeper.validSave ? '' : ' · ledger or save failed'}</td>
        </tr>)}</tbody>
      </table></div>
      <ul className="economy-notes">{report.keepers.map(keeper => <li key={keeper.id}><strong>{keeper.label}.</strong> {keeper.description} Income by buyer: {BUYERS.filter(buyer => keeper.incomeByBuyer[buyer.id]).map(buyer => `${buyer.name} ${credits(keeper.incomeByBuyer[buyer.id])}`).join(' · ') || 'none'}.</li>)}</ul>
      <p className="fixture-note">Every {ROUTE_CHECK_EVERY} game days a copy of each keeper’s world must reach an accepted pairing within {ROUTE_CHECK_DAYS} game days using only free actions, the koi rescue and credits already held. Spending in the table adds up to {report.keepers.map(keeper => credits(totalSinks(keeper.flows))).join(', ')} and matches each world’s ledger.</p>
    </>}
  </section>;
}
