import { useEffect, useMemo, useState } from 'react';
import {
  AERATION_TIERS, careCost, FILTER_TIERS, RATION_KEYS, RATION_LABELS, RATIONS, THERMOSTAT_RANGE, WATER_CHANGE_PERCENTS, waterChangeCost,
  type CareSettings, type WaterChangePercent,
} from '../core/care';
import { careStatus, careWarnings, projectTank, sameSettings, type CareFix, type CareProjection } from '../core/careAdvice';
import type { Ration, Tank, World } from '../core/types';
import type { Command } from '../core/world';

const PREVIEW_DAYS = 3;
const percent = (n: number) => `${Math.round(n * 100)}%`;
const credits = (n: number) => `◈ ${n.toLocaleString('en')}`;
const temperatures = Array.from({ length: THERMOSTAT_RANGE[1] - THERMOSTAT_RANGE[0] + 1 }, (_, i) => THERMOSTAT_RANGE[0] + i);
const FED_LABELS = { fed: 'Fed', underfed: 'Underfed', starving: 'Starving' } as const;

type Props = { world: World; tank: Tank; tick: number; readOnly: boolean; onRun: (command: Command, message: string) => boolean };

/** FS-305 care: status chips, warnings that name fixes, and controls whose cost and projected effect show before applying. */
export function CarePanel({ world, tank, tick, readOnly, onRun }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CareSettings | null>(null);
  const [waterPercent, setWaterPercent] = useState<WaterChangePercent | null>(null);
  useEffect(() => { setDraft(null); setWaterPercent(null); }, [tank.id]);

  const status = useMemo(() => careStatus(world, tank.id), [world, tank.id]);
  const warnings = useMemo(() => careWarnings(world, tank.id), [world, tank.id]);
  const settings = draft ?? status.settings, changed = !sameSettings(settings, status.settings);
  const cost = changed ? careCost(tank, settings) : 0;
  const now = useMemo(() => projectTank(world, tank.id, tick, 0), [world, tank.id, tick]);
  const current = useMemo(() => open ? projectTank(world, tank.id, tick, PREVIEW_DAYS) : null, [open, world, tank.id, tick]);
  const proposed = useMemo(() => open && draft && changed ? projectTank(world, tank.id, tick, PREVIEW_DAYS, { settings: draft }) : null, [open, world, tank.id, tick, draft, changed]);
  const afterChange = useMemo(() => waterPercent ? projectTank(world, tank.id, tick, 0, { waterChangePercent: waterPercent }) : null, [world, tank.id, tick, waterPercent]);
  const waterCost = waterPercent ? waterChangeCost(tank.water, waterPercent) : 0;

  function review(fix: CareFix) {
    if (fix.kind === 'settings') { setDraft(fix.settings); setOpen(true); }
    else if (fix.kind === 'water-change') { setWaterPercent(fix.percent); setOpen(true); }
    else if (fix.kind === 'command') onRun(fix.command, fix.command.type === 'feed'
      ? 'A portion of food joined the water. Fish eat what they need over the next hours; leftovers decay and add ammonia.'
      : 'A new lab tank is ready. Move some fish into it to ease crowding.');
  }
  function apply() {
    const message = `Care settings applied${cost ? ` for ${credits(cost)}` : ''}: ${RATION_LABELS[settings.ration].toLowerCase()} rations, ${FILTER_TIERS[settings.filterTier].label.toLowerCase()} filter, ${AERATION_TIERS[settings.aerationTier].label.toLowerCase()} aeration, thermostat ${settings.targetC} °C.`;
    if (onRun({ type: 'set-care', tankId: tank.id, ...settings }, message)) setDraft(null);
  }
  function changeWater() {
    if (waterPercent && onRun({ type: 'change-water', tankId: tank.id, percent: waterPercent }, `${waterPercent}% of the water in ${tank.name} was replaced for ${credits(waterCost)}.`)) setWaterPercent(null);
  }

  const comfortClass = status.comfort >= 1 ? 'comfortable' : status.comfort >= 0.6 ? 'uncomfortable' : 'harsh';
  const row = (label: string, value: (p: CareProjection) => string) => <tr><th scope="row">{label}</th><td>{value(now)}</td>{current ? <td>{value(current)}</td> : null}{proposed ? <td>{value(proposed)}</td> : null}</tr>;
  const price = (tierPrice: number, installedPrice: number) => tierPrice > installedPrice ? credits(tierPrice - installedPrice) : 'no cost';

  return <section className="care-panel" aria-label="Tank care">
    <div className="water-status" role="group" aria-label="Tank care status">
      <span className={`water-chip ${status.oxygen}`}>Oxygen {status.oxygen} <small>{tank.water.oxygenMgL.toFixed(1)} mg/L</small></span>
      <span className={`water-chip ${status.ammonia}`}>Ammonia {status.ammonia} <small>{tank.water.ammoniaMgL.toFixed(2)} mg N/L</small></span>
      <span className={`water-chip ${status.stocking}`}>Stocking {status.stocking} <small>{status.densityKgM3.toFixed(1)} kg/m³</small></span>
      <span className={`water-chip ${status.hatched ? status.fedLevel : 'fed'}`}>{status.hatched ? <>{FED_LABELS[status.fedLevel]} <small>{percent(status.fed)} of need</small></> : 'No hatched fish'}</span>
      <span className={`water-chip ${comfortClass}`}>Water {status.temperatureC.toFixed(1)} °C{status.targetC !== status.temperatureC ? <> <small>→ {status.targetC} °C</small></> : null}</span>
      <button className="care-toggle" aria-expanded={open} aria-controls="care-controls" onClick={() => setOpen(value => !value)}>{open ? 'Hide care controls' : 'Care controls'}</button>
    </div>
    {warnings.length ? <ul className="care-warnings" aria-label="Care warnings">{warnings.map(warning => <li key={warning.code} className={`care-${warning.severity}`}>
      <div><strong>{warning.severity === 'critical' ? 'Urgent · ' : ''}{warning.title}</strong><span>{warning.detail}</span></div>
      <div className="care-fixes">{warning.fixes.map(fix => fix.kind === 'hint'
        ? <span className="care-hint" key={fix.label}>{fix.label}</span>
        : <button key={fix.label} disabled={readOnly} onClick={() => review(fix)}>{fix.kind === 'command' ? fix.label : `Preview: ${fix.label}`}{fix.cost ? ` · ${credits(fix.cost)}` : ''}</button>)}</div>
    </li>)}</ul> : <p className="care-ok">Nothing is limiting these fish.{status.hatched ? ` They need about ${Math.round(status.needGPerDay).toLocaleString('en')} g of food per game day.` : ''}</p>}
    {open ? <div id="care-controls" className="care-controls">
      <div className="care-settings">
        <label>Feeder ration<select value={settings.ration} onChange={event => setDraft({ ...settings, ration: event.target.value as Ration })}>
          {RATION_KEYS.map(key => <option key={key} value={key}>{RATION_LABELS[key]} · {RATIONS[key]}× need</option>)}
        </select></label>
        <label>Filter<select value={settings.filterTier} onChange={event => setDraft({ ...settings, filterTier: Number(event.target.value) })}>
          {FILTER_TIERS.map((tier, i) => <option key={tier.label} value={i}>{tier.label} · {tier.mgNPerDay / 1000} g N/day · {i === status.settings.filterTier ? 'installed' : price(tier.price, FILTER_TIERS[status.settings.filterTier].price)}</option>)}
        </select></label>
        <label>Aeration<select value={settings.aerationTier} onChange={event => setDraft({ ...settings, aerationTier: Number(event.target.value) })}>
          {AERATION_TIERS.map((tier, i) => <option key={tier.label} value={i}>{tier.label} · {tier.perDay}/day · {i === status.settings.aerationTier ? 'installed' : price(tier.price, AERATION_TIERS[status.settings.aerationTier].price)}</option>)}
        </select></label>
        <label>Thermostat<select value={settings.targetC} onChange={event => setDraft({ ...settings, targetC: Number(event.target.value) })}>
          {temperatures.map(value => <option key={value} value={value}>{value} °C</option>)}
        </select></label>
      </div>
      <div className="prediction-table care-preview"><table>
        <caption>Projected after {PREVIEW_DAYS} game days if nothing else changes</caption>
        <thead><tr><th scope="col">Measure</th><th scope="col">Now</th><th scope="col">Current settings</th>{proposed ? <th scope="col">These settings</th> : null}</tr></thead>
        <tbody>
          {row('Oxygen', p => `${p.oxygen} · ${p.oxygenMgL.toFixed(1)} mg/L`)}
          {row('Ammonia', p => `${p.ammonia} · ${p.ammoniaMgL.toFixed(2)} mg N/L`)}
          {row('Fed over a game day', p => status.hatched ? `${FED_LABELS[p.fedLevel].toLowerCase()} · ${percent(p.fed)}` : '—')}
          {row('Uneaten food', p => `${Math.round(p.foodG).toLocaleString('en')} g`)}
          {row('Water temperature', p => `${p.temperatureC.toFixed(1)} °C`)}
          {row('Mean condition', p => p.meanCondition === null ? '—' : percent(p.meanCondition))}
        </tbody>
      </table></div>
      <div className="care-apply">
        <span>{changed ? cost ? `Equipment cost ${credits(cost)} · you have ${credits(world.credits)}` : 'No equipment cost' : 'Change a setting to preview its effect.'}</span>
        <button className="primary" disabled={readOnly || !changed || cost > world.credits} onClick={apply}>Apply settings{cost ? ` · ${credits(cost)}` : ''}</button>
        {changed ? <button className="quiet" onClick={() => setDraft(null)}>Reset</button> : null}
      </div>
      <div className="care-water" role="group" aria-label="Water change">
        <span>Water change</span>
        {WATER_CHANGE_PERCENTS.map(value => <button key={value} aria-pressed={waterPercent === value} onClick={() => setWaterPercent(waterPercent === value ? null : value)}>{value}% · {credits(waterChangeCost(tank.water, value))}</button>)}
      </div>
      {waterPercent && afterChange ? <p className="care-water-preview">Replacing {waterPercent}% takes ammonia from {tank.water.ammoniaMgL.toFixed(2)} to {afterChange.ammoniaMgL.toFixed(2)} mg N/L and oxygen from {tank.water.oxygenMgL.toFixed(1)} to {afterChange.oxygenMgL.toFixed(1)} mg/L at once, and siphons {percent(waterPercent / 100)} of the uneaten food.
        <button className="primary" disabled={readOnly || waterCost > world.credits} onClick={changeWater}>Change {waterPercent}% · {credits(waterCost)}</button></p> : null}
      <p className="help-copy">Game rules, not aquarium-care advice. Upgrades cost the price difference and lower tiers are free. Measured rations match what the fish need; extra food decays. Fish never die in this lab: poor care lowers condition and slows growth, and the inspector names every limiting cause.</p>
    </div> : null}
  </section>;
}
