import { BUYERS, FOUNDER_RESALE_CAP, LEDGER_LABELS, LEDGER_REASONS, ledgerBalance, type TraitCache } from '../core/economy';
import type { World } from '../core/types';
import { STOCK_PRICE } from '../core/world';
import { RecoveryOptions } from './RecoveryOptions';

const signed = (amount: number) => `${amount < 0 ? '−' : amount > 0 ? '+' : ''}◈ ${Math.abs(amount).toLocaleString('en')}`;

type Props = { world: World; readOnly: boolean; traitCache: TraitCache; onClaimRelief: (tankId: string) => void; onClose: () => void };

/** FS-501 NPC market: what each buyer still wants, the ledger that explains the balance, and FS-504 recovery options. */
export function MarketPanel({ world, readOnly, traitCache, onClaimRelief, onClose }: Props) {
  const { market, ledger } = world, reconciled = ledgerBalance(ledger) === world.credits;
  return <section className="market-panel" aria-labelledby="market-title">
    <div className="market-heading">
      <div><div className="eyebrow">FS-501 · NPC MARKET</div><h2 id="market-title">Buyers and ledger</h2></div>
      <button className="quiet" onClick={onClose}>Close</button>
    </div>
    <p className="help-copy">Each buyer takes a limited number of fish and wants a few more every game day, and offers fall as its demand is used up. Fish bred here earn a capped bonus; founders and bought stock never resell above ◈ {FOUNDER_RESALE_CAP}, below the ◈ {STOCK_PRICE} stock price. Rehoming is always possible and pays nothing.</p>
    <ul className="buyer-list">{BUYERS.map(buyer => {
      const demand = market.demand[buyer.id], wanted = Math.floor(demand);
      return <li key={buyer.id}>
        <strong>{buyer.name}</strong>
        <small>Wants {buyer.wants} · pays up to ◈ {buyer.budget}</small>
        <meter min={0} max={buyer.capacity} value={demand} aria-label={`${buyer.name}: will take ${wanted} more of ${buyer.capacity}`} />
        <small>{wanted >= 1 ? `Will take ${wanted} more of ${buyer.capacity}` : 'Satisfied for now'} · {buyer.recovery} more each game day</small>
      </li>;
    })}</ul>
    <RecoveryOptions world={world} readOnly={readOnly} traitCache={traitCache} onClaim={onClaimRelief} />
    <h3>Ledger</h3>
    <div className="fixture-table-wrap"><table className="ledger-table">
      <caption className="visually-hidden">Credit totals by reason</caption>
      <tbody>
        <tr><th scope="row">Opening balance</th><td>◈ {ledger.opening.toLocaleString('en')}</td></tr>
        {LEDGER_REASONS.map(reason => <tr key={reason}><th scope="row">{LEDGER_LABELS[reason]}</th><td>{signed(ledger.totals[reason])}</td></tr>)}
        <tr className="ledger-balance"><th scope="row">Balance</th><td>◈ {world.credits.toLocaleString('en')}</td></tr>
      </tbody>
    </table></div>
    <p className="help-copy">{reconciled ? 'The balance equals the opening balance plus every total.' : 'The balance does not agree with the ledger totals.'}{ledger.next > 1 ? ` The ledger keeps the latest ${ledger.entries.length} of ${ledger.next - 1} entries; totals include them all.` : ''}</p>
    {ledger.entries.length ? <>
      <h3>Recent entries</h3>
      <ol className="ledger-entries">{ledger.entries.slice(-12).reverse().map(entry => <li key={entry.seq}>
        <span>#{entry.seq} · {LEDGER_LABELS[entry.reason]}{entry.fish ? ` · ${entry.fish} fish` : ''}</span><span>{entry.detail}</span><strong>{signed(entry.amount)}</strong>
      </li>)}</ol>
    </> : <p className="empty-copy">No credit has changed since this ledger opened.</p>}
  </section>;
}
