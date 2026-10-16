import { useEffect, useMemo, useState } from 'react';
import {
  AERATION_TIERS, careCost, FILTER_TIERS, RATION_KEYS, RATION_LABELS, RATIONS, THERMOSTAT_RANGE, WATER_CHANGE_PERCENTS, waterChangeCost,
  type CareSettings, type WaterChangePercent,
} from '../core/care';
import { careStatus, careWarnings, projectTank, sameSettings, type CareFix, type CareProjection } from '../core/careAdvice';
import type { Ration, Tank, World } from '../core/types';
import type { Command } from '../core/world';
import { Icon, type IconName } from './Icon';
import { Select } from './kit/Menu';

const PREVIEW_DAYS = 3;
const percent = (n: number) => `${Math.round(n * 100)}%`;
const credits = (n: number) => `◈ ${n.toLocaleString('en')}`;
const temperatures = Array.from({ length: THERMOSTAT_RANGE[1] - THERMOSTAT_RANGE[0] + 1 }, (_, i) => THERMOSTAT_RANGE[0] + i);
const FED_LABELS = { fed: 'Fed', underfed: 'Underfed', starving: 'Starving' } as const;

type Props = { world: World; tank: Tank; tick: number; readOnly: boolean; defaultOpen?: boolean; onRun: (command: Command, message: string) => boolean };

/** FS-305 care: status chips, warnings that name fixes, and controls whose cost and projected effect show before applying. */
export function CarePanel({ world, tank, tick, readOnly, defaultOpen = false, onRun }: Props) {
  const [open, setOpen] = useState(defaultOpen);
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
    // Only free, immediate commands are offered as fixes: feeding a portion.
    else if (fix.kind === 'command') onRun(fix.command, 'A portion of food joined the water. Fish eat what they need over the next hours; leftovers decay and add ammonia.');
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

  const tone = (level: string) => ['low', 'elevated', 'heavy', 'underfed', 'uncomfortable'].includes(level) ? 'warn' : ['critical', 'high', 'overstocked', 'starving', 'harsh'].includes(level) ? 'alert' : 'good';
  const gauge = (icon: IconName, label: string, level: string, value: string, share: number, note: string) =>
    <div className={`care-gauge water-chip ${level}`} key={label}>
      <span className="care-gauge-icon" aria-hidden="true"><Icon name={icon} size={18} /></span>
      <span className="care-gauge-text"><small>{label}</small><b>{value}</b><span className={`bar ${tone(level) === 'good' ? '' : tone(level)}`}><span style={{ width: `${Math.round(Math.max(0.04, Math.min(1, share)) * 100)}%` }} /></span><small className="care-gauge-level">{note}</small></span>
    </div>;
  return <section className="care-panel" aria-labelledby="care-title">
    <header className="panel-header">
      <span className="panel-icon" aria-hidden="true"><Icon name="drop" size={20} /></span>
      <div><span className="eyebrow">Water & equipment</span><h2 id="care-title">Care for {tank.name}</h2>
        <p>{status.hatched ? `These fish need about ${Math.round(status.needGPerDay).toLocaleString('en')} g of food per game day.` : 'No hatched fish are eating yet.'} Changes preview their effect before you pay.</p></div>
      <button className="care-toggle btn-sm" aria-expanded={open} aria-controls="care-controls" onClick={() => setOpen(value => !value)}><Icon name="settings" size={15} />{open ? 'Hide controls' : 'Care controls'}</button>
    </header>
    <div className="water-status care-gauges" role="group" aria-label="Tank care status">
      {gauge('bubbles', 'Oxygen', status.oxygen, `${tank.water.oxygenMgL.toFixed(1)} mg/L`, tank.water.oxygenMgL / 9, `${status.oxygen} · dissolved`)}
      {gauge('biohazard', 'Ammonia', status.ammonia, `${tank.water.ammoniaMgL.toFixed(2)} mg N/L`, 1 - Math.min(1, tank.water.ammoniaMgL), `${status.ammonia} · lower is better`)}
      {gauge('fish', 'Stocking', status.stocking, `${status.densityKgM3.toFixed(1)} kg/m³`, 1 - Math.min(1, status.densityKgM3 / 30), `${status.stocking} · ${status.residents} residents`)}
      {status.hatched
        ? gauge('food', 'Feeding', status.fedLevel, `${percent(status.fed)} of need`, status.fed, `${FED_LABELS[status.fedLevel]} · ${Math.round(status.needGPerDay).toLocaleString('en')} g a day`)
        : gauge('food', 'Feeding', 'fed', '—', 1, 'No hatched fish yet')}
      {gauge('thermo', 'Temperature', comfortClass, `${status.temperatureC.toFixed(1)} °C`, status.comfort, `${comfortClass} · ${status.targetC !== status.temperatureC ? `heading to ${status.targetC} °C` : 'at target'}`)}
    </div>
    {warnings.length ? <ul className="care-warnings" aria-label="Care warnings">{warnings.map(warning => <li key={warning.code} className={`care-${warning.severity}`}>
      <div><strong>{warning.severity === 'critical' ? 'Urgent · ' : ''}{warning.title}</strong><span>{warning.detail}</span></div>
      <div className="care-fixes">{warning.fixes.map(fix => fix.kind === 'hint'
        ? <span className="care-hint" key={fix.label}>{fix.label}</span>
        : <button key={fix.label} disabled={readOnly} onClick={() => review(fix)}>{fix.kind === 'command' ? fix.label : `Preview: ${fix.label}`}{fix.cost ? ` · ${credits(fix.cost)}` : ''}</button>)}</div>
    </li>)}</ul> : <p className="care-ok">Nothing is limiting these fish.</p>}
    {open ? <div id="care-controls" className="care-controls">
      <div className="care-settings">
        <div className="care-setting"><span className="care-setting-label"><Icon name="food" size={15} />Feeder ration</span>
          <Select label="Feeder ration" value={settings.ration} onChange={value => setDraft({ ...settings, ration: value as Ration })}
            options={RATION_KEYS.map(key => ({ value: key, label: RATION_LABELS[key], hint: `${RATIONS[key]}× what the fish need` }))} /></div>
        <div className="care-setting"><span className="care-setting-label"><Icon name="layers" size={15} />Filter</span>
          <Select label="Filter" value={String(settings.filterTier)} onChange={value => setDraft({ ...settings, filterTier: Number(value) })}
            options={FILTER_TIERS.map((tier, i) => ({ value: String(i), label: tier.label, hint: `${tier.mgNPerDay / 1000} g N a day · ${i === status.settings.filterTier ? 'installed' : price(tier.price, FILTER_TIERS[status.settings.filterTier].price)}` }))} /></div>
        <div className="care-setting"><span className="care-setting-label"><Icon name="bubbles" size={15} />Aeration</span>
          <Select label="Aeration" value={String(settings.aerationTier)} onChange={value => setDraft({ ...settings, aerationTier: Number(value) })}
            options={AERATION_TIERS.map((tier, i) => ({ value: String(i), label: tier.label, hint: `${tier.perDay} a day · ${i === status.settings.aerationTier ? 'installed' : price(tier.price, AERATION_TIERS[status.settings.aerationTier].price)}` }))} /></div>
        <div className="care-setting"><span className="care-setting-label"><Icon name="thermo" size={15} />Thermostat</span>
          <Select label="Thermostat" value={String(settings.targetC)} onChange={value => setDraft({ ...settings, targetC: Number(value) })}
            options={temperatures.map(value => ({ value: String(value), label: `${value} °C` }))} /></div>
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
        <button className={cost ? 'brass' : 'primary'} disabled={readOnly || !changed || cost > world.credits} onClick={apply}>Apply settings{cost ? ` · ${credits(cost)}` : ''}</button>
        {changed ? <button className="quiet" onClick={() => setDraft(null)}>Reset</button> : null}
      </div>
      <div className="care-water" role="group" aria-label="Water change">
        <span>Water change</span>
        {WATER_CHANGE_PERCENTS.map(value => <button key={value} aria-pressed={waterPercent === value} onClick={() => setWaterPercent(waterPercent === value ? null : value)}>{value}% · {credits(waterChangeCost(tank.water, value))}</button>)}
      </div>
      {waterPercent && afterChange ? <p className="care-water-preview">Replacing {waterPercent}% takes ammonia from {tank.water.ammoniaMgL.toFixed(2)} to {afterChange.ammoniaMgL.toFixed(2)} mg N/L and oxygen from {tank.water.oxygenMgL.toFixed(1)} to {afterChange.oxygenMgL.toFixed(1)} mg/L at once, and siphons {percent(waterPercent / 100)} of the uneaten food.
        <button className="brass" disabled={readOnly || waterCost > world.credits} onClick={changeWater}>Change {waterPercent}% · {credits(waterCost)}</button></p> : null}
      <p className="help-copy">Game rules, not aquarium-care advice. Upgrades cost the price difference and lower tiers are free. Measured rations match what the fish need; extra food decays. Fish never die in this lab: poor care lowers condition and slows growth, and the inspector names every limiting cause.</p>
    </div> : null}
  </section>;
}
