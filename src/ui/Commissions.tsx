import { useMemo, useState } from 'react';
import { CODEX_BY_KEY } from '../core/codex';
import {
  breedingLeads, closestCandidates, commissionLetter, daysLeft, DEADLINE_DAYS, deliveredReputation, MAX_ACTIVE, MAX_OFFERS, POST_EVERY_DAYS, reputationLevel, urgency,
  withdrawnReputation, type Commission,
} from '../core/commissions';
import { calendarLabel } from '../core/competitions';
import { SPECIES_INFO } from '../core/species';
import type { Fish, World } from '../core/types';
import type { Command } from '../core/world';
import { FishPortrait } from './FishPortrait';
import { Icon, type IconName } from './Icon';
import { Dialog } from './kit/Overlay';
import './commissions.css';

type Props = { world: World; readOnly: boolean; onRun: (command: Command, message: string) => World | null; onInspect: (fishId: string) => void };

const TIER_WORD = { 1: 'Uncommon', 2: 'Rare', 3: 'Epic', 4: 'Legendary' } as const;
const SPECIES_ICON: Record<Fish['species'], IconName> = { koi: 'fish', goldfish: 'goldfish', guppy: 'guppy', axolotl: 'leaf' };
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
const credits = (amount: number) => `◈ ${amount.toLocaleString('en')}`;
const STATUS_TEXT: Record<Commission['status'], string> = { offer: 'Offer', active: 'Accepted', delivered: 'Delivered', expired: 'Missed deadline', declined: 'Declined', withdrawn: 'Withdrawn' };

/**
 * Commissions (world v20): letters from fictional clients who want an animal that shows a Codex phenotype. A letter
 * stays on the board for a while; once accepted it has a deadline. Delivering an animal that meets every clause pays the
 * reward, raises reputation (which unlocks harder letters) and archives the animal as sold. All terms are shown as a
 * checklist; the letter's prose is only flavor.
 */
export function Commissions({ world, readOnly, onRun, onInspect }: Props) {
  const day = world.circuit.day, state = world.commissions, level = reputationLevel(state.reputation);
  const board = useMemo(() => [...state.board].sort((a, b) => (a.status === b.status ? a.dueDay - b.dueDay : a.status === 'active' ? -1 : 1)), [state.board]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = board.find(c => c.id === selectedId) ?? board[0] ?? null;
  const active = state.board.filter(c => c.status === 'active').length, offers = state.board.length - active;
  const nextPost = state.refreshedDay + POST_EVERY_DAYS, research = world.genesisModel !== 2;
  const earned = state.history.filter(c => c.status === 'delivered').reduce((sum, c) => sum + c.reward, 0);
  const progress = level.next === null ? 1 : (state.reputation - level.from) / (level.next - level.from);

  return <section className="desk" aria-labelledby="desk-title">
    <header className="desk-heading">
      <div>
        <span className="desk-kicker">THE BREEDER’S DESK</span>
        <h1 id="desk-title">Letters from people who need your animals.</h1>
        <p>Clients write in asking for an animal that shows a named phenotype from the Codex. Accept a letter, breed toward it, and deliver an animal that meets every term before its deadline.</p>
      </div>
      <div className="desk-reputation" role="group" aria-label="Reputation">
        <span className="desk-kicker">REPUTATION</span>
        <strong>{level.label}</strong>
        <meter min={0} max={1} value={progress} aria-label={level.next === null ? 'Highest reputation level' : `${state.reputation} of ${level.next} toward the next level`} />
        <small>{state.reputation} points{level.next !== null ? ` · ${level.next - state.reputation} to the next level` : ' · highest level'}</small>
        <small>Letters up to {TIER_WORD[level.cap].toLowerCase()}{level.bonus ? ` · rewards +${Math.round(level.bonus * 100)}%` : ''} · {credits(earned)} earned</small>
      </div>
    </header>

    {research ? <p className="desk-note" role="note"><Icon name="info" size={16} />This is a research world (Genesis model 1). Clients only write to live-game labs, so no letters arrive here.</p> : null}

    <div className="desk-layout">
      <nav className="desk-board" aria-label="Letters on the board">
        <div className="desk-board-head"><strong>On the board</strong><span>{active}/{MAX_ACTIVE} accepted · {offers}/{MAX_OFFERS} offers</span></div>
        {board.length ? <ul>{board.map(c => {
          const entry = CODEX_BY_KEY.get(c.entry), from = commissionLetter(c).from, left = daysLeft(c, day), u = urgency(c, day);
          return <li key={c.id}>
            <button className={`desk-envelope tier-${c.tier} ${c.status} ${selected?.id === c.id ? 'current' : ''}`} aria-current={selected?.id === c.id ? 'true' : undefined} onClick={() => setSelectedId(c.id)}>
              <span className="desk-envelope-top"><span className={`chip ${c.species}`}><Icon name={SPECIES_ICON[c.species]} size={12} />{SPECIES_INFO[c.species].title}</span><span className="desk-tier">{TIER_WORD[c.tier]}</span></span>
              <strong>{entry?.name ?? c.entry}</strong>
              <small>{from.name} · {from.place}</small>
              <span className="desk-envelope-foot"><b>{credits(c.reward)}</b><span className={u > 0.75 ? 'urgent' : ''}>{left === 0 ? (c.status === 'active' ? 'Due today' : 'Offer ends today') : c.status === 'active' ? `Due in ${plural(left, 'day')}` : `Offer ends in ${plural(left, 'day')}`}</span></span>
              <span className="desk-deadline" aria-hidden="true"><i style={{ width: `${Math.round((1 - u) * 100)}%` }} /></span>
            </button>
          </li>;
        })}</ul> : <div className="desk-empty">
          <Icon name="letter" size={28} />
          <p>{research ? 'No letters in research worlds.' : 'No letters right now.'}</p>
          {research ? null : <small>New letters arrive every {POST_EVERY_DAYS} game days. The next post comes {nextPost <= day ? 'with the next day' : `on ${calendarLabel(nextPost)}`}.</small>}
        </div>}
        {!research && board.length ? <p className="desk-post">Next post: {nextPost <= day ? 'next day' : calendarLabel(nextPost)}</p> : null}
      </nav>

      {selected ? <LetterDetail key={selected.id} world={world} commission={selected} readOnly={readOnly} onRun={onRun} onInspect={onInspect} /> : <div className="desk-letter desk-letter-empty"><p>Select a letter to read it.</p></div>}
    </div>

    <History world={world} />
  </section>;
}

function LetterDetail({ world, commission: c, readOnly, onRun, onInspect }: Omit<Props, 'world'> & { world: World; commission: Commission }) {
  const day = world.circuit.day, letter = commissionLetter(c), entry = CODEX_BY_KEY.get(c.entry);
  const [delivering, setDelivering] = useState<Fish | null>(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const candidates = useMemo(() => closestCandidates(world, c), [world.fish, world.clutches, c]);
  const leads = useMemo(() => c.status === 'active' || c.status === 'offer' ? breedingLeads(world, c) : [], [world.fish, c]);
  const activeCount = world.commissions.board.filter(x => x.status === 'active').length;
  const terms = [
    `${c.sex ? (c.sex === 'F' ? 'A female ' : 'A male ') + SPECIES_INFO[c.species].one : SPECIES_INFO[c.species].title} that shows ${entry?.name ?? c.entry}`,
    c.minGeneration > 1 ? `Bred in your lab, generation ${c.minGeneration} or later` : 'Bred in your lab (not a founder or shop animal)',
    'An adult, not courting or carrying a brood',
    c.status === 'active' ? `Delivered by ${calendarLabel(c.dueDay - 1)} (${daysLeft(c, day) ? `${plural(daysLeft(c, day), 'day')} left` : 'today is the last day'})` : `Accept by ${calendarLabel(c.dueDay - 1)}; then you have ${plural(DEADLINE_DAYS[c.tier], 'game day')} to deliver`,
  ];
  const accept = () => onRun({ type: 'accept-commission', commissionId: c.id }, `You accepted ${letter.from.name}’s commission: ${entry?.name ?? c.entry}.`);
  const decline = () => onRun({ type: 'decline-commission', commissionId: c.id }, c.status === 'active' ? `You withdrew from ${letter.from.name}’s commission.` : `You declined ${letter.from.name}’s letter.`);
  const deliver = (fish: Fish) => {
    const next = onRun({ type: 'deliver-commission', commissionId: c.id, fishId: fish.id }, `${fish.name} went to ${letter.from.name} for ${credits(c.reward)}. Reputation +${deliveredReputation(c)}.`);
    if (next) setDelivering(null);
  };

  return <article className={`desk-letter tier-${c.tier}`} aria-labelledby={`letter-${c.id}`}>
    <div className="desk-paper">
      <header>
        <div><span className="desk-kicker">{c.id} · {TIER_WORD[c.tier].toUpperCase()} REQUEST</span><h2 id={`letter-${c.id}`}>{entry?.name ?? c.entry}</h2></div>
        <div className="desk-reward"><small>REWARD</small><b>{credits(c.reward)}</b><small>+{deliveredReputation(c)} reputation</small></div>
      </header>
      <div className="desk-prose">
        <p>{letter.greeting}</p>
        <p>{letter.body} {letter.reason}</p>
        {entry ? <p className="desk-codex"><Icon name="book" size={14} /><span><b>Codex:</b> {entry.text}</span></p> : null}
        <p className="desk-sign">{letter.signoff}<small>{letter.from.role} · {letter.from.place}</small></p>
      </div>
      <h3>Terms</h3>
      <ul className="desk-terms">{terms.map(term => <li key={term}><Icon name="check" size={13} />{term}</li>)}</ul>
      <div className="desk-actions">
        {c.status === 'offer' ? <>
          <button className="primary" disabled={readOnly || activeCount >= MAX_ACTIVE} onClick={accept}>Accept commission</button>
          <button className="quiet" disabled={readOnly} onClick={decline}>Decline</button>
          {activeCount >= MAX_ACTIVE ? <small role="status">You already have {MAX_ACTIVE} accepted commissions. Deliver or withdraw one first.</small> : <small>Declining is free. Withdrawing after you accept costs {withdrawnReputation(c)} reputation; missing the deadline costs more.</small>}
        </> : <>
          <span className="desk-accepted"><Icon name="checkCircle" size={15} />Accepted {c.acceptedDay !== null ? calendarLabel(c.acceptedDay) : ''}</span>
          <button className="quiet" disabled={readOnly} onClick={() => setConfirmWithdraw(true)}>Withdraw…</button>
        </>}
      </div>
    </div>

    <section className="desk-candidates" aria-label="Closest animals in your lab">
      <h3>Closest in your lab</h3>
      {candidates.length ? <ul>{candidates.map(({ fish, clauses, ready }) => <li key={fish.id} className={ready ? 'ready' : ''}>
        <button className="desk-portrait" onClick={() => onInspect(fish.id)} aria-label={`Inspect ${fish.name}`}><FishPortrait fish={fish} view="current" /></button>
        <div>
          <strong>{fish.name}</strong><small>G{fish.generation} · {fish.sex === 'F' ? '♀' : '♂'}</small>
          <ul className="desk-clauses">{clauses.map(clause => <li key={clause.label} className={clause.met ? 'met' : 'missed'}><Icon name={clause.met ? 'check' : 'close'} size={11} />{clause.label}</li>)}</ul>
          {c.status === 'active' ? <button className={ready ? 'primary' : ''} disabled={readOnly || !ready} onClick={() => setDelivering(fish)}>{ready ? 'Deliver…' : 'Not ready yet'}</button> : null}
        </div>
      </li>)}</ul> : <p className="desk-hint">No animal in your lab shows {entry?.name ?? 'this phenotype'} yet.</p>}
      <h3>Breeding leads</h3>
      {leads.length ? <ul className="desk-leads">{leads.map(lead => <li key={`${lead.mother.id}:${lead.father.id}`}>
        <span><button className="link-button" onClick={() => onInspect(lead.mother.id)}>{lead.mother.name}</button> ♀ × <button className="link-button" onClick={() => onInspect(lead.father.id)}>{lead.father.name}</button> ♂</span>
        <b>{Math.round(lead.share * 100)}%</b><small>of sampled offspring show it</small>
      </li>)}</ul> : <p className="desk-hint">No pair of living adults produced it in a quick sample. Look for carriers in the shop, or breed toward the trait over a generation or two.</p>}
      <small className="desk-hint">Leads come from a small deterministic sample, so they are estimates rather than odds.</small>
    </section>

    <Dialog open={delivering !== null} onClose={() => setDelivering(null)} icon="letter" tone="brass" title={delivering ? `Deliver ${delivering.name}?` : ''}
      description={`${delivering?.name ?? ''} will go to ${letter.from.name} in ${letter.from.place} and leave your lab for good. Their record, pedigree and genome stay in your archive.`}
      actions={<><button className="quiet" onClick={() => setDelivering(null)}>Keep {delivering?.name}</button><button className="brass" data-autofocus disabled={readOnly} onClick={() => delivering && deliver(delivering)}>Deliver for {credits(c.reward)}</button></>}>
      {delivering ? <div className="desk-dialog"><FishPortrait fish={delivering} view="current" /><p>You receive <b>{credits(c.reward)}</b> and <b>+{deliveredReputation(c)}</b> reputation.</p></div> : null}
    </Dialog>
    <Dialog open={confirmWithdraw} onClose={() => setConfirmWithdraw(false)} icon="alert" tone="rose" title="Withdraw from this commission?"
      description={`${letter.from.name} will look elsewhere. You lose ${withdrawnReputation(c)} reputation, less than missing the deadline would cost.`}
      actions={<><button className="quiet" data-autofocus onClick={() => setConfirmWithdraw(false)}>Keep working on it</button><button className="danger" disabled={readOnly} onClick={() => { setConfirmWithdraw(false); decline(); }}>Withdraw</button></>} />
  </article>;
}

function History({ world }: { world: World }) {
  const history = world.commissions.history;
  if (!history.length) return null;
  return <section className="desk-history" aria-labelledby="desk-history-title">
    <h2 id="desk-history-title">Correspondence</h2>
    <div className="table-scroll"><table>
      <thead><tr><th scope="col">Letter</th><th scope="col">Client</th><th scope="col">Outcome</th><th scope="col">Animal</th><th scope="col">Closed</th><th scope="col">Reward</th><th scope="col">Reputation</th></tr></thead>
      <tbody>{history.slice(0, 30).map(c => <tr key={c.id} className={c.status}>
        <th scope="row">{CODEX_BY_KEY.get(c.entry)?.name ?? c.entry}<small>{SPECIES_INFO[c.species].title} · {TIER_WORD[c.tier]}</small></th>
        <td>{commissionLetter(c).from.name}</td>
        <td><span className={`desk-status ${c.status}`}>{STATUS_TEXT[c.status]}</span></td>
        <td>{c.fishName ?? '—'}</td>
        <td>{c.closedDay !== null ? calendarLabel(c.closedDay) : '—'}</td>
        <td>{c.status === 'delivered' ? credits(c.reward) : '—'}</td>
        <td className={c.reputation > 0 ? 'gain' : c.reputation < 0 ? 'loss' : ''}>{c.reputation > 0 ? `+${c.reputation}` : c.reputation || '0'}</td>
      </tr>)}</tbody>
    </table></div>
  </section>;
}
