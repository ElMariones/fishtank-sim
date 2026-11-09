import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { finishedRuns } from '../../core/circuitCareer';
import { isEgg } from '../../core/development';
import type { Offer } from '../../core/economy';
import { express, fingerprint, heterozygosity, metabolicPotential } from '../../core/genetics';
import { rarityOf, RARITY_NOTE, tierRank } from '../../core/rarity';
import { SPECIES_INFO } from '../../core/species';
import {
  APPRAISAL_NOTE, appraise, curatorNotes, decodeJournal, formatCm, JOURNAL_KEY, JOURNAL_TAGS, JOURNAL_TEXT_LIMIT, karyotype, pedigreeRows, showProspects,
  siblingsOf, studioMarks, tierShare, withJournalEntry, type Appraisal, type Journal, type JournalTag, type KaryoLocus,
} from '../../core/specimen';
import { exhibitLabel } from '../../core/tournament';
import type { Fish, World } from '../../core/types';
import { AnimalHonors } from '../Competitions';
import { SexMark } from '../Controls';
import { FishPortrait } from '../FishPortrait';
import { Icon, type IconName } from '../Icon';
import { Select } from '../kit/Menu';
import { lifeSummary } from '../lifeText';
import { SpecimenStage } from './SpecimenStage';
import './specimen.css';

export type StudioTab = 'profile' | 'appraisal' | 'genome' | 'lineage' | 'honours' | 'journal';
const TABS: { id: StudioTab; label: string; icon: IconName }[] = [
  { id: 'profile', label: 'Profile', icon: 'eye' }, { id: 'appraisal', label: 'Appraisal', icon: 'star' }, { id: 'genome', label: 'Genome', icon: 'dna' },
  { id: 'lineage', label: 'Lineage', icon: 'family' }, { id: 'honours', label: 'Honours', icon: 'medal' }, { id: 'journal', label: 'Journal', icon: 'book' },
];
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const typing = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
const pct = (n: number) => `${Math.round(n * 100)}%`;
const speciesIcon = (fish: Fish): IconName => fish.species === 'axolotl' ? 'leaf' : fish.species === 'goldfish' ? 'goldfish' : fish.species === 'guppy' ? 'guppy' : 'fish';

function readJournal(): Journal { try { return decodeJournal(localStorage.getItem(JOURNAL_KEY)); } catch { return {}; } }

export type StudioProps = {
  world: World; fishId: string; onClose: (lastId: string) => void;
  isFavorite: (id: string) => boolean; onToggleFavorite: (id: string) => void;
  inbreeding: (id: string) => number; founders: (id: string) => number; offers: (fish: Fish) => Offer[];
  onOpenInspector: (id: string, tab: 'Overview' | 'Genome' | 'Family') => void;
};

/**
 * Specimen Studio (FS-134): a full-screen, read-only isolation view for one animal. The stage draws it large with pan,
 * zoom and lenses; the dossier gathers its profile, appraisal, genome, lineage, honours and the keeper's journal. The
 * only thing it writes is the journal, which is device-local like favorites and never part of the world save.
 */
export function SpecimenStudio({ world, fishId, onClose, isFavorite, onToggleFavorite, inbreeding, founders, offers, onOpenInspector }: StudioProps) {
  const [subjectId, setSubjectId] = useState(fishId);
  const [tab, setTab] = useState<StudioTab>('profile');
  const [compareId, setCompareId] = useState('none');
  const [announcement, setAnnouncement] = useState('');
  const [trail, setTrail] = useState<string[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const fish = world.fish.find(f => f.id === subjectId) ?? world.fish.find(f => f.id === fishId)!;
  const compare = compareId === 'none' ? null : world.fish.find(f => f.id === compareId) ?? null;
  const closeRef = useRef(() => onClose(fish.id)); closeRef.current = () => onClose(fish.id);

  // The neighbours that [ and ] step through: the same aquarium for living animals, the archive otherwise.
  const neighbours = useMemo(() => fish.status === 'living' ? world.fish.filter(f => f.status === 'living' && f.tankId === fish.tankId) : world.fish.filter(f => f.status !== 'living'), [world.fish, fish.status, fish.tankId]);
  const position = neighbours.findIndex(f => f.id === fish.id);
  const tankName = world.tanks.find(t => t.id === fish.tankId)?.name ?? '';
  const go = (id: string, keepTrail = false) => {
    if (id === fish.id) return;
    setTrail(keepTrail ? [...trail, fish.id].slice(-12) : []);
    setSubjectId(id); setCompareId('none');
  };
  const step = (delta: number) => { if (neighbours.length > 1) go(neighbours[(position + delta + neighbours.length) % neighbours.length].id); };
  const stepRef = useRef(step); stepRef.current = step;

  // Modal behaviour: focus moves in, Tab is trapped, Escape closes, the page behind stops scrolling, focus returns on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    document.documentElement.classList.add('has-modal', 'studio-open');
    const focus = window.setTimeout(() => root.current?.querySelector<HTMLElement>('.studio-stage')?.focus(), 40);
    const key = (event: KeyboardEvent) => {
      if (document.querySelector('.menu, .palette') || event.defaultPrevented) return;
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); return; }
      if (!typing(event.target) && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (event.key === ']' || event.key === 'PageDown') { event.preventDefault(); stepRef.current(1); return; }
        if (event.key === '[' || event.key === 'PageUp') { event.preventDefault(); stepRef.current(-1); return; }
      }
      if (event.key !== 'Tab' || !root.current) return;
      const focusable = Array.from(root.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(element => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (!root.current.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key); window.clearTimeout(focus);
      document.documentElement.classList.remove('has-modal', 'studio-open');
      if (previous?.isConnected && previous !== document.body) previous.focus();
    };
  }, []);

  const F = inbreeding(fish.id);
  const appraisal = useMemo(() => appraise(fish, F), [fish, F]);
  const favorite = isFavorite(fish.id);
  const kin = useMemo(() => siblingsOf(world.fish, fish), [world.fish, fish]);
  const children = useMemo(() => world.fish.filter(f => f.parents?.includes(fish.id)), [world.fish, fish.id]);
  const mother = fish.parents ? world.fish.find(f => f.id === fish.parents![0]) : undefined, father = fish.parents ? world.fish.find(f => f.id === fish.parents![1]) : undefined;

  const compareOptions = [
    { value: 'none', label: 'Alone in the cell', group: 'Compare' },
    ...(mother ? [{ value: mother.id, label: `${mother.name}`, hint: 'Mother', group: 'Parents' }] : []),
    ...(father ? [{ value: father.id, label: `${father.name}`, hint: 'Father', group: 'Parents' }] : []),
    ...kin.full.slice(0, 8).map(f => ({ value: f.id, label: f.name, hint: `Sibling · G${f.generation}`, group: 'Siblings' })),
    ...children.slice(0, 8).map(f => ({ value: f.id, label: f.name, hint: `Offspring · G${f.generation}`, group: 'Offspring' })),
    ...neighbours.filter(f => f.id !== fish.id && f.species === fish.species).slice(0, 10).map(f => ({ value: `${f.id}`, label: f.name, hint: 'Same aquarium', group: 'Tank mates' })),
  ].filter((option, i, all) => all.findIndex(other => other.value === option.value) === i);
  const compareRole = compare ? compare.id === mother?.id ? 'Mother' : compare.id === father?.id ? 'Father' : kin.full.some(f => f.id === compare.id) ? 'Sibling' : children.some(f => f.id === compare.id) ? 'Offspring' : 'Tank mate' : '';

  const studioLine = `${exhibitLabel(fish)} · ${fish.sex === 'F' ? 'Female' : 'Male'} · G${fish.generation} · ${fish.id}`;

  return createPortal(<div className="studio-root" ref={root}>
    <div className="studio" role="dialog" aria-modal="true" aria-labelledby="studio-title">
      <header className="studio-bar">
        <button className="quiet btn-sm studio-back" onClick={() => closeRef.current()} data-tip="Back to the aquarium (Esc)"><Icon name="chevron" size={15} className="flip-x" />Back</button>
        <div className="studio-identity">
          <span className="eyebrow">Specimen studio <span className="mono">{fish.id}</span></span>
          <h1 id="studio-title">{fish.name}</h1>
          <span className="studio-chips">
            <span className={`chip ${fish.species}`}><Icon name={speciesIcon(fish)} size={12} />{exhibitLabel(fish)}</span>
            <SexMark sex={fish.sex} withLabel />
            <span className="chip gene">G{fish.generation}</span>
            {fish.status !== 'living' ? <span className="chip warn">{fish.status === 'sold' ? 'Sold' : 'Rehomed'}</span> : <span className="chip">{tankName}</span>}
          </span>
        </div>
        <div className={`studio-grade grade-${appraisal.grade}`} data-tip="Studio appraisal: open the Appraisal tab for the breakdown" aria-label={`Studio grade ${appraisal.grade}, ${appraisal.stars} of 5 stars`}>
          <b>{appraisal.grade}</b><Stars value={appraisal.stars} small />
        </div>
        <div className="studio-bar-actions">
          {trail.length ? <button className="quiet btn-sm" onClick={() => { const back = trail[trail.length - 1]; setTrail(trail.slice(0, -1)); setSubjectId(back); setCompareId('none'); }} data-tip="Back to the previous specimen"><Icon name="restore" size={14} />{world.fish.find(f => f.id === trail[trail.length - 1])?.name ?? 'Back'}</button> : null}
          <div className="studio-stepper" role="group" aria-label="Browse specimens">
            <button className="icon-button btn-sm quiet" onClick={() => step(-1)} disabled={neighbours.length < 2} aria-label="Previous specimen" data-tip="Previous ( [ )"><Icon name="chevron" size={15} className="flip-x" /></button>
            <span className="mono">{position + 1} / {neighbours.length}</span>
            <button className="icon-button btn-sm quiet" onClick={() => step(1)} disabled={neighbours.length < 2} aria-label="Next specimen" data-tip="Next ( ] )"><Icon name="chevron" size={15} /></button>
          </div>
          <button className={`icon-button btn-sm quiet studio-favorite ${favorite ? 'on' : ''}`} aria-pressed={favorite} onClick={() => { onToggleFavorite(fish.id); setAnnouncement(favorite ? `${fish.name} removed from favorites.` : `${fish.name} kept as a favorite.`); }} aria-label={favorite ? 'Remove from favorites' : 'Keep as favorite'} data-tip={favorite ? 'Favorite' : 'Keep as favorite'}><Icon name="star" size={16} filled={favorite} /></button>
          <button className="quiet btn-sm" onClick={() => onOpenInspector(fish.id, 'Overview')} data-tip="Close the studio and open this animal in the inspector"><Icon name="sidebar" size={14} />Inspector</button>
          <button className="icon-button btn-sm quiet" onClick={() => closeRef.current()} aria-label="Close studio" data-tip="Close (Esc)"><Icon name="close" size={16} /></button>
        </div>
      </header>

      <div className="studio-body">
        <section className="studio-stage-column" aria-label="Stage">
          <SpecimenStage fish={fish} compare={compare} compareCaption={compare ? `${compare.name} (${compareRole.toLowerCase()})` : ''} photo={{ title: fish.name, line: studioLine }} onAnnounce={setAnnouncement} />
          <div className="studio-compare">
            <Icon name="layers" size={14} /><span>Compare at true scale</span>
            <Select label="Compare with" value={compareOptions.some(o => o.value === compareId) ? compareId : 'none'} onChange={setCompareId} options={compareOptions} disabled={isEgg(fish.life) || compareOptions.length < 2} />
            {compare ? <button className="link-button" onClick={() => go(compare.id, true)}>Study {compare.name}</button> : <small>{compareOptions.length < 2 ? 'No relatives or tank mates of this species to compare.' : 'Side by side at one centimetre scale.'}</small>}
          </div>
        </section>

        <section className="studio-dossier" aria-label="Dossier">
          <div className="studio-tabs" role="tablist" aria-label="Dossier sections">{TABS.map((t, i) => <button key={t.id} role="tab" id={`studio-tab-${t.id}`} aria-selected={tab === t.id} aria-controls="studio-panel" tabIndex={tab === t.id ? 0 : -1}
            className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}
            onKeyDown={event => { const d = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0; if (!d) return; event.preventDefault(); const next = TABS[(i + d + TABS.length) % TABS.length].id; setTab(next); document.getElementById(`studio-tab-${next}`)?.focus(); }}>
            <Icon name={t.icon} size={14} /><span>{t.label}</span></button>)}</div>
          <div className="studio-panel" id="studio-panel" role="tabpanel" aria-labelledby={`studio-tab-${tab}`} tabIndex={0} key={`${fish.id}:${tab}`}>
            {tab === 'profile' ? <ProfileTab world={world} fish={fish} appraisal={appraisal} onSelect={id => go(id, true)} /> : null}
            {tab === 'appraisal' ? <AppraisalTab world={world} fish={fish} appraisal={appraisal} parents={[mother, father]} inbreeding={inbreeding} offers={offers(fish)} /> : null}
            {tab === 'genome' ? <GenomeTab world={world} fish={fish} onOpenInspector={() => onOpenInspector(fish.id, 'Genome')} /> : null}
            {tab === 'lineage' ? <LineageTab world={world} fish={fish} inbreeding={F} founders={founders(fish.id)} siblings={kin} offspring={children} onSelect={id => go(id, true)} onOpenInspector={() => onOpenInspector(fish.id, 'Family')} /> : null}
            {tab === 'honours' ? <HonoursTab world={world} fish={fish} inbreeding={F} /> : null}
            {tab === 'journal' ? <JournalTab world={world} fish={fish} onSaved={setAnnouncement} /> : null}
          </div>
        </section>
      </div>
      <div className="visually-hidden" role="status" aria-live="polite">{announcement}</div>
    </div>
  </div>, document.body);
}

function Stars({ value, small = false }: { value: number; small?: boolean }) {
  return <span className={`studio-stars ${small ? 'small' : ''}`} aria-hidden="true">{[1, 2, 3, 4, 5].map(i => <span key={i} className={value >= i ? 'full' : value >= i - 0.5 ? 'half' : ''}><Icon name="star" size={small ? 11 : 18} filled /></span>)}</span>;
}

function Section({ title, icon, children, aside, tone }: { title: string; icon: IconName; children: ReactNode; aside?: ReactNode; tone?: string }) {
  return <section className={`studio-section ${tone ?? ''}`}><h2><Icon name={icon} size={14} /><span>{title}</span>{aside ? <small>{aside}</small> : null}</h2>{children}</section>;
}

function Meter({ label, value, tone = 'gene', text }: { label: string; value: number; tone?: string; text?: string }) {
  return <div className="studio-meter" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
    <span>{label}</span><span className={`bar ${tone}`}><span style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }} /></span><span className="mono">{text ?? Math.round(value * 100)}</span>
  </div>;
}

// ---- Profile -------------------------------------------------------------------------------------------------------

function ProfileTab({ world, fish, appraisal, onSelect }: { world: World; fish: Fish; appraisal: Appraisal; onSelect: (id: string) => void }) {
  const p = useMemo(() => express(fish.genome), [fish.genome]), potential = metabolicPotential(fish.genome);
  const notes = useMemo(() => curatorNotes(world, fish), [world, fish]);
  const rarity = rarityOf(fish.species, fish.genome);
  const traits = [...rarity.rows].sort((a, b) => a.frequency - b.frequency);
  const social = p.guppy?.social ?? p.goldfish?.social ?? p.axolotl?.social ?? p.social, bold = p.guppy?.bold ?? p.goldfish?.bold ?? p.axolotl?.bold ?? p.bold;
  const activity = p.guppy?.activity ?? p.goldfish?.activity ?? p.axolotl?.activity ?? p.activity, curious = p.guppy?.curious ?? p.goldfish?.curious ?? p.axolotl?.curious ?? p.curious;
  const parent = (id: string | undefined) => { const record = id ? world.fish.find(f => f.id === id) : undefined; return record ? <button className="link-button" onClick={() => onSelect(record.id)}>{record.name}</button> : <span>{id ?? '—'}</span>; };
  const egg = isEgg(fish.life);
  return <>
    <blockquote className="studio-curator">
      <span className="eyebrow"><Icon name="book" size={12} />Curator’s commentary</span>
      {notes.map((text, i) => <p key={i}>{text}</p>)}
    </blockquote>
    <Section title="Record" icon="info">
      <dl className="studio-facts">
        <div><dt>Species</dt><dd>{SPECIES_INFO[fish.species].title}<small>{fish.species === 'koi' ? 'Cyprinus rubrofuscus (lab model)' : SPECIES_INFO[fish.species].latin}</small></dd></div>
        <div><dt>Variety</dt><dd>{exhibitLabel(fish)}</dd></div>
        <div><dt>Life stage</dt><dd>{lifeSummary(fish)}<small>{fish.life.ageDays} game day{fish.life.ageDays === 1 ? '' : 's'} old</small></dd></div>
        <div><dt>Length</dt><dd>{egg ? 'Egg' : formatCm(fish.life.lengthCm)}<small>of {formatCm(potential.adultLengthCm)} potential</small></dd></div>
        <div><dt>Condition</dt><dd>{egg ? '—' : pct(fish.life.condition)}<small>{fish.life.condition >= 0.7 ? 'Thriving' : fish.life.condition >= 0.4 ? 'Recovering' : 'Struggling'}</small></dd></div>
        <div><dt>Parents</dt><dd>{fish.parents ? <>{parent(fish.parents[0])} × {parent(fish.parents[1])}</> : 'Founder stock'}</dd></div>
        <div><dt>Hatched in the lab</dt><dd>{new Date(fish.bornAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</dd></div>
        <div><dt>Status</dt><dd>{fish.status === 'living' ? world.tanks.find(t => t.id === fish.tankId)?.name ?? 'Living' : fish.status === 'sold' ? 'Sold' : 'Rehomed'}</dd></div>
      </dl>
    </Section>
    <Section title="Temperament" icon="sparkles" aside="Inherited tendencies">
      <Meter label="Sociability" value={social} /><Meter label="Boldness" value={bold} /><Meter label="Activity" value={activity} /><Meter label="Curiosity" value={curious} />
    </Section>
    <Section title="Features" icon="search" aside={`${rarity.standouts} standout${rarity.standouts === 1 ? '' : 's'} · overall ${rarity.tier}`}>
      <TraitList rows={traits.filter(row => tierRank(row.tier) >= 1)} />
      {traits.some(row => tierRank(row.tier) < 1) ? <details className="studio-common"><summary>{traits.filter(row => tierRank(row.tier) < 1).length} common traits</summary><TraitList rows={traits.filter(row => tierRank(row.tier) < 1)} /></details> : null}
      <p className="help-copy">{RARITY_NOTE} Grade {appraisal.grade} on the Appraisal tab weighs rarity as one axis of five.</p>
    </Section>
  </>;
}

function TraitList({ rows }: { rows: ReturnType<typeof rarityOf>['rows'] }) {
  if (!rows.length) return <p className="help-copy">No uncommon traits: everything here is typical of founder offspring.</p>;
  return <ul className="studio-traits">{rows.map(row => <li key={row.trait} className={`tier-${tierRank(row.tier)}`}>
    <span><b>{row.trait}</b><small>{row.value}</small></span>
    <span className="studio-tier"><span className="bar brass"><span style={{ width: `${tierShare(row.tier) * 100}%` }} /></span><em>{row.tier}</em><small className="mono">{row.frequency < 0.001 ? '<0.1' : (row.frequency * 100).toFixed(1)}%</small></span>
  </li>)}</ul>;
}

// ---- Appraisal -----------------------------------------------------------------------------------------------------

function Radar({ axes, ghost }: { axes: Appraisal['axes']; ghost: number[] | null }) {
  const R = 92, cx = 120, cy = 112, n = axes.length;
  const point = (i: number, v: number) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(a) * R * v, cy + Math.sin(a) * R * v] as const; };
  const poly = (values: number[]) => values.map((v, i) => point(i, Math.max(0.04, v / 100)).join(',')).join(' ');
  return <svg className="studio-radar" viewBox="0 0 240 228" role="img" aria-label={`Appraisal chart: ${axes.map(a => `${a.label} ${Math.round(a.score)}`).join(', ')}`}>
    {[0.25, 0.5, 0.75, 1].map(r => <polygon key={r} className="ring" points={axes.map((_, i) => point(i, r).join(',')).join(' ')} />)}
    {axes.map((_, i) => { const [x, y] = point(i, 1); return <line key={i} className="spoke" x1={cx} y1={cy} x2={x} y2={y} />; })}
    {ghost ? <polygon className="ghost" points={poly(ghost)} /> : null}
    <polygon className="shape" points={poly(axes.map(a => a.score))} />
    {axes.map((a, i) => { const [x, y] = point(i, Math.max(0.04, a.score / 100)); return <circle key={a.key} className="dot" cx={x} cy={y} r={3.2} />; })}
    {axes.map((a, i) => { const [x, y] = point(i, 1.2); return <text key={a.key} x={x} y={y} textAnchor={Math.abs(x - cx) < 8 ? 'middle' : x > cx ? 'start' : 'end'} dominantBaseline="middle">{a.label}</text>; })}
  </svg>;
}

function AppraisalTab({ world, fish, appraisal, parents, inbreeding, offers }: { world: World; fish: Fish; appraisal: Appraisal; parents: (Fish | undefined)[]; inbreeding: (id: string) => number; offers: Offer[] }) {
  const recorded = parents.filter((p): p is Fish => !!p);
  const ghost = useMemo(() => recorded.length === 2 ? recorded.map(p => appraise(p, inbreeding(p.id))).reduce((sum, a) => sum.map((v, i) => v + a.axes[i].score / 2), [0, 0, 0, 0, 0]) : null, [recorded.map(p => p.id).join(), world.fish]);
  const prospects = useMemo(() => fish.status === 'living' ? showProspects(world, fish) : [], [world, fish]);
  const top = offers[0]?.amount ?? 0;
  return <>
    <div className={`studio-verdict grade-${appraisal.grade}`}>
      <div className="studio-medallion" aria-hidden="true"><b>{appraisal.grade}</b><small>{appraisal.overall}</small></div>
      <div><Stars value={appraisal.stars} /><p className="studio-verdict-text">{appraisal.verdict}</p>
        <small>{appraisal.overall} / 100 · {appraisal.stars} star{appraisal.stars === 1 ? '' : 's'}{appraisal.potentialOnly ? ' · genetic potential (still an egg)' : ''}</small></div>
    </div>
    <Section title="Breakdown" icon="dial" aside={ghost ? <span className="studio-legend"><i className="me" />This animal <i className="ghost" />Parents’ average</span> : undefined}>
      <Radar axes={appraisal.axes} ghost={ghost} />
      {appraisal.axes.map((axis, i) => <div className="studio-axis" key={axis.key}>
        <Meter label={axis.label} value={axis.score / 100} text={String(Math.round(axis.score))} />
        <small>{axis.detail}{ghost ? <> · <span className={axis.score >= ghost[i] ? 'up' : 'down'}>{axis.score >= ghost[i] ? '▲' : '▼'} {Math.abs(Math.round(axis.score - ghost[i]))} vs parents</span></> : null}</small>
      </div>)}
      <p className="help-copy">{APPRAISAL_NOTE}</p>
    </Section>
    <Section title="Market value" icon="coins" tone="brass" aside="NPC buyers today">
      {fish.status !== 'living' ? <p className="help-copy">This animal is archived ({fish.status}); buyers no longer bid on it.</p>
        : isEgg(fish.life) ? <p className="help-copy">Eggs cannot be sold. Buyers bid once it hatches.</p>
        : offers.length ? <>
          <ul className="studio-offers">{offers.map((offer, i) => <li key={offer.buyer} className={i === 0 ? 'best' : ''}>
            <span>{offer.buyerName}{i === 0 ? <em>Best</em> : null}</span><span className="bar brass"><span style={{ width: `${top ? offer.amount / top * 100 : 0}%` }} /></span><b className="mono">◈ {offer.amount.toLocaleString()}</b>
          </li>)}</ul>
          <details className="studio-terms"><summary>Why the {offers[0].buyerName.toLowerCase()} offers ◈ {offers[0].amount}</summary>
            <ol>{offers[0].terms.map(term => <li key={term.label}><span>{term.label}</span><span className="mono">{term.amount < 0 ? '−' : '+'}◈ {Math.abs(term.amount)}</span></li>)}</ol></details>
          <p className="help-copy">Offers follow what each buyer wants and recover each game day. Appraisal and price are measured separately.</p>
        </> : <p className="help-copy">No buyer wants this animal today. Demand recovers each game day.</p>}
    </Section>
    {fish.status === 'living' ? <Section title="Show prospects" icon="trophy" tone="brass" aside="Open shows you can enter">
      {prospects.length ? <ul className="studio-prospects">{prospects.map(({ event, projection, blocker }) => <li key={event.id}>
        <span><b>{event.name}</b><small>{event.tier} · {event.city} · closes day {event.closesDay}</small></span>
        {projection ? <span className={`studio-band ${projection.band}`}><em>{projection.band}</em><small>place {projection.low}–{projection.high} · {projection.total.toFixed(1)} pts</small></span> : <span className="studio-band blocked"><em>Not yet</em><small>{blocker}</small></span>}
      </li>)}</ul> : <p className="help-copy">No open, licensed show for this species right now. New shows open as the calendar advances.</p>}
    </Section> : null}
  </>;
}

// ---- Genome --------------------------------------------------------------------------------------------------------

const hue = (code: string) => { let h = 0; for (const c of code) h = (h * 31 + c.charCodeAt(0)) % 360; return (h * 47) % 360; };
const alleleColor = (code: string | null) => code === null ? undefined : code === 'N' ? 'var(--brass)' : `hsl(${hue(code)} 62% 58%)`;

function GenomeTab({ world, fish, onOpenInspector }: { world: World; fish: Fish; onOpenInspector: () => void }) {
  const chromosomes = useMemo(() => karyotype(world, fish), [world.atlas, world.alleles, fish]);
  const loci = chromosomes.flatMap(c => c.loci);
  const [picked, setPicked] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'het' | 'hom' | 'flags'>('all');
  const selected = picked === null ? null : loci[picked] ?? null;
  const counts = { het: loci.filter(l => l.state === 'het').length, hom: loci.filter(l => l.state === 'hom').length, novel: loci.filter(l => l.state === 'novel').length, hidden: loci.filter(l => l.state === 'hidden').length };
  const dim = (l: KaryoLocus) => filter === 'het' ? l.state !== 'het' && l.state !== 'novel' : filter === 'hom' ? l.state !== 'hom' : filter === 'flags' ? !(l.mutated || l.inherited || l.state === 'novel') : false;
  return <>
    <div className="studio-stats">
      <div><small>Heterozygous</small><b className="mono">{pct(heterozygosity(fish.genome))}</b></div>
      <div><small>New alleles</small><b className="mono">{counts.novel}</b></div>
      <div><small>Mutations at birth</small><b className="mono">{fish.mutations.length}</b></div>
      <div><small>Mutation origins</small><b className="mono">{fish.origins.length}</b></div>
    </div>
    <Section title="Karyogram" icon="dna" aside={`${loci.length} loci · ${chromosomes.length} chromosomes`}>
      <div className="studio-karyo-tools">
        <div className="segmented" role="group" aria-label="Highlight loci">
          {([['all', 'All'], ['het', 'Mixed copies'], ['hom', 'Matching copies'], ['flags', 'Mutations']] as const).map(([id, text]) => <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{text}</button>)}
        </div>
        <span className="studio-karyo-legend" aria-label="Upper stripe: mother’s copy. Lower stripe: father’s copy. One colour per allele."><span><b className="cell top" aria-hidden="true"><i /><i /></b>Mother</span><span><b className="cell bottom" aria-hidden="true"><i /><i /></b>Father</span><span>Colour = allele</span></span>
      </div>
      {counts.hidden ? <p className="help-copy atlas-note"><Icon name="search" size={13} /> Discovery mode: this animal is not sequenced, so its alleles stay hidden. Unidentified loci are numbered until the Genome Atlas names them.</p> : null}
      <div className="studio-karyo">{chromosomes.map((chromosome, c) => <div className="studio-chromosome" key={chromosome.label}>
        <span className="studio-chromosome-label"><span className="mono">{String(c + 1).padStart(2, '0')}</span>{chromosome.label}</span>
        <span className="studio-loci">{chromosome.loci.map(locus => <button key={locus.index} className={`studio-locus state-${locus.state} ${locus.mutated ? 'mutated' : ''} ${locus.inherited ? 'inherited' : ''} ${dim(locus) ? 'dim' : ''} ${picked === locus.index ? 'picked' : ''}`}
          aria-pressed={picked === locus.index} aria-label={`${locus.label}: ${locus.state === 'hidden' ? 'hidden' : locus.state === 'absent' ? 'not carried' : `${locus.maternal} and ${locus.paternal}`}`}
          data-tip={`${locus.label}${locus.maternal ? ` · ${locus.maternal}/${locus.paternal}` : ''}`} onClick={() => setPicked(picked === locus.index ? null : locus.index)}>
          <i style={{ background: alleleColor(locus.maternal) }} /><i style={{ background: alleleColor(locus.paternal) }} />
        </button>)}</span>
      </div>)}</div>
      {selected ? <div className="studio-locus-card" aria-live="polite">
        <h3>{selected.label}{selected.mutated ? <span className="chip gene">New mutation</span> : null}{selected.inherited ? <span className="chip gene">Inherited mutation</span> : null}</h3>
        {selected.state === 'hidden' ? <p className="help-copy">Sequence this animal in the Genome Atlas to read both copies.</p>
          : selected.state === 'absent' ? <p className="help-copy">Not carried by this genome version; the animal reads the baseline here.</p>
          : <dl><div><dt><i className="allele-dot m" />Mother’s copy</dt><dd><code>{selected.maternal}</code>{selected.maternalName !== selected.maternal ? selected.maternalName : 'Quantitative step'}</dd></div>
            <div><dt><i className="allele-dot p" />Father’s copy</dt><dd><code>{selected.paternal}</code>{selected.paternalName !== selected.paternal ? selected.paternalName : 'Quantitative step'}</dd></div>
            <div><dt>Copies</dt><dd>{selected.state === 'hom' ? 'Matching: it passes the same allele to every offspring.' : selected.state === 'novel' ? 'Carries an open-ended allele that arose in this world.' : 'Mixed: each offspring inherits one of the two at random.'}</dd></div></dl>}
      </div> : <p className="help-copy">Each locus shows two stripes: the copy from the mother above, from the father below. Matching colours mean matching copies. Pick a locus to read it.</p>}
    </Section>
    <div className="studio-checksum"><span>Genome checksum</span><code>{fingerprint(fish.genome)}</code><button className="link-button" onClick={onOpenInspector}>Full locus notes in the inspector</button></div>
  </>;
}

// ---- Lineage -------------------------------------------------------------------------------------------------------

/** Breeders' terms keep grandparent labels short; the full role stays in the tooltip and accessible name. */
const shortRole = (role: string) => role.includes('grandmother') ? 'Grandam' : role.includes('grandfather') ? 'Grandsire' : role;

function Node({ fish, role, onSelect, focus = false }: { fish: Fish | null; role: string; onSelect: (id: string) => void; focus?: boolean }) {
  if (!fish) return <div className="studio-node empty" title={`${role}: not recorded (founder stock beyond this point)`}><span>Unrecorded</span></div>;
  const inner = <><FishPortrait fish={fish} view="current" /><span className="eyebrow" title={role}>{shortRole(role)}</span><b>{fish.name}</b><small><SexMark sex={fish.sex} decorative /> G{fish.generation}{fish.status !== 'living' ? ` · ${fish.status}` : ''}</small></>;
  return focus ? <div className="studio-node focus">{inner}</div> : <button className="studio-node" onClick={() => onSelect(fish.id)} aria-label={`${role}: ${fish.name}. Study this animal`}>{inner}</button>;
}

function Strip({ title, items, total, onSelect }: { title: string; items: Fish[]; total: number; onSelect: (id: string) => void }) {
  return <div className="studio-strip"><h3>{title}<span className="badge">{total}</span></h3>
    {items.length ? <div className="studio-strip-items">{items.slice(0, 12).map(f => <button key={f.id} onClick={() => onSelect(f.id)} aria-label={`Study ${f.name}`} data-tip={`${f.name} · G${f.generation}`}><FishPortrait fish={f} view="current" /><span>{f.name}</span></button>)}
      {total > 12 ? <span className="studio-strip-more">+{total - 12}</span> : null}</div> : <p className="help-copy">None recorded.</p>}
  </div>;
}

function LineageTab({ world, fish, inbreeding, founders, siblings, offspring, onSelect, onOpenInspector }: {
  world: World; fish: Fish; inbreeding: number; founders: number; siblings: { full: Fish[]; half: Fish[] }; offspring: Fish[]; onSelect: (id: string) => void; onOpenInspector: () => void;
}) {
  const rows = useMemo(() => pedigreeRows(world.fish, fish.id), [world.fish, fish.id]);
  const roles = [['This animal'], ['Mother', 'Father'], ['Maternal grandmother', 'Maternal grandfather', 'Paternal grandmother', 'Paternal grandfather']];
  return <>
    <div className="studio-stats">
      <div><small>Pedigree F</small><b className="mono">{(inbreeding * 100).toFixed(1)}%</b></div>
      <div><small>Founders behind it</small><b className="mono">{founders}</b></div>
      <div><small>Generation</small><b className="mono">G{fish.generation}</b></div>
      <div><small>Offspring</small><b className="mono">{offspring.length}</b></div>
    </div>
    <Section title="Pedigree" icon="family" aside="Three generations · pick a relative to study it">
      <div className="studio-pedigree">{[...rows].reverse().map((row, r) => { const level = rows.length - 1 - r; return <div className={`studio-generation level-${level}`} key={level} style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
        {row.map((member, i) => <Node key={`${level}:${i}`} fish={member} role={roles[level][i]} onSelect={onSelect} focus={level === 0} />)}
      </div>; })}</div>
      <p className="help-copy">Pedigree F is the chance that both copies at a locus descend from one ancestor’s copy, assuming the {founders || 'listed'} founders were unrelated. <button className="link-button" onClick={onOpenInspector}>Deeper tree in the inspector</button></p>
    </Section>
    <Section title="Kin" icon="family">
      <Strip title="Full siblings" items={siblings.full} total={siblings.full.length} onSelect={onSelect} />
      <Strip title="Half siblings" items={siblings.half} total={siblings.half.length} onSelect={onSelect} />
      <Strip title="Offspring" items={offspring} total={offspring.length} onSelect={onSelect} />
    </Section>
  </>;
}

// ---- Honours -------------------------------------------------------------------------------------------------------

function HonoursTab({ world, fish, inbreeding }: { world: World; fish: Fish; inbreeding: number }) {
  const marks = useMemo(() => studioMarks(world, fish, inbreeding), [world, fish, inbreeding]);
  const earned = marks.filter(m => m.earned), locked = marks.filter(m => !m.earned);
  return <>
    <Section title="Studio marks" icon="medal" aside={`${earned.length} of ${marks.length} earned`}>
      <ul className="studio-marks">{[...earned, ...locked].map(mark => <li key={mark.id} className={`tone-${mark.tone} ${mark.earned ? 'earned' : 'locked'}`}>
        <span className="studio-mark-icon" aria-hidden="true"><Icon name={mark.icon} size={16} filled={mark.earned && (mark.icon === 'star' || mark.icon === 'crown')} /></span>
        <span><b>{mark.name}</b><small>{mark.earned ? mark.detail : `Locked · ${mark.detail}`}</small></span>
      </li>)}</ul>
      <p className="help-copy">Marks are read from this animal’s records (birth, mutations, rarity, shows and offspring), so they update as its life goes on.</p>
    </Section>
    <AnimalHonors world={world} fishId={fish.id} />
  </>;
}

// ---- Journal -------------------------------------------------------------------------------------------------------

function JournalTab({ world, fish, onSaved }: { world: World; fish: Fish; onSaved: (text: string) => void }) {
  const [journal, setJournal] = useState(readJournal);
  const entry = journal[fish.id];
  const [text, setText] = useState(entry?.text ?? '');
  const [status, setStatus] = useState(entry?.updatedAt ? `Saved ${new Date(entry.updatedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}` : 'Notes stay on this device');
  const save = (next: { text: string; tags: JournalTag[] }) => {
    const updated = withJournalEntry(readJournal(), fish.id, next, new Date().toISOString());
    setJournal(updated);
    try { localStorage.setItem(JOURNAL_KEY, JSON.stringify(updated)); setStatus('Saved on this device'); onSaved('Journal saved.'); }
    catch { setStatus('Could not save: browser storage is unavailable.'); }
  };
  const tags = entry?.tags ?? [];
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const comments = useMemo(() => finishedRuns(world).flatMap(run => run.participants.filter(p => p.fish.id === fish.id).map(p => ({ run, p }))).reverse(), [world, fish.id]);
  return <>
    <Section title="Keeper’s notes" icon="book" aside={status}>
      <div className="studio-tags" role="group" aria-label="Tags">{JOURNAL_TAGS.map(tag => <button key={tag} className="chip" aria-pressed={tags.includes(tag)}
        onClick={() => { window.clearTimeout(timer.current); save({ text, tags: tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag] }); }}>{tags.includes(tag) ? <Icon name="check" size={12} /> : null}{tag}</button>)}</div>
      <textarea className="studio-notes" value={text} maxLength={JOURNAL_TEXT_LIMIT} rows={6} aria-label={`Notes about ${fish.name}`} placeholder={`What do you want to remember about ${fish.name}? Pairings to try, quirks you noticed, plans for the line…`}
        onChange={event => { const value = event.target.value; setText(value); setStatus('Editing…'); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => save({ text: value, tags: readJournal()[fish.id]?.tags ?? [] }), 700); }}
        onBlur={() => { window.clearTimeout(timer.current); if (text !== (entry?.text ?? '')) save({ text, tags }); }} />
      <small className="studio-notes-count mono">{text.length} / {JOURNAL_TEXT_LIMIT}</small>
      <p className="help-copy">The journal is kept in this browser only, like favorites. It is not part of the world save or its exports.</p>
    </Section>
    <Section title="Judges’ commentary" icon="trophy" tone="brass" aside={comments.length ? `${comments.length} show${comments.length === 1 ? '' : 's'}` : undefined}>
      {comments.length ? <ul className="studio-comments">{comments.map(({ run, p }) => <li key={run.event.id}>
        <span className={`studio-rank rank-${Math.min(p.rank, 4)}`}>{p.rank}</span>
        <span><b>{run.event.name}</b><small>{run.event.tier} · {run.event.city} · Year {run.event.year} · {p.total.toFixed(1)} pts</small><q>{p.comment}</q></span>
      </li>)}</ul> : <p className="help-copy">No show appearances yet. Judges’ remarks collect here after each exhibition.</p>}
    </Section>
  </>;
}

