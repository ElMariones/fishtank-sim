import { useState } from 'react';
import { DECORATION_PRICE, MAX_DECORATIONS, TANK_PRICE, TANK_UPGRADE_PRICE, decorationRadius, decorationsOf, validateLayout, type Decoration } from '../core/tankManagement';
import { reservedPlaces } from '../core/breeding';
import type { Tank, World } from '../core/types';
import { MAX_TANKS, type Command } from '../core/world';

type Props = { world: World; tank: Tank; readOnly?: boolean; onRun: (command: Command, message: string) => boolean };
export function HabitatPanel({ world, tank, readOnly, onRun }: Props) {
  const [draft, setDraft] = useState<Decoration[]>(() => structuredClone(decorationsOf(tank)));
  const [selected, setSelected] = useState(draft[0]?.id ?? '');
  const [review, setReview] = useState<'purchase' | 'upgrade' | null>(null);
  const [editing, setEditing] = useState(false);
  const current = decorationsOf(tank), shown = editing ? draft : current;
  const item = shown.find(d => d.id === selected);
  const cost = shown.filter(d => !current.some(old => old.id === d.id)).length * DECORATION_PRICE;
  let invalid = ''; try { validateLayout(shown); } catch (error) { invalid = (error as Error).message; }
  const change = (patch: Partial<Decoration>) => setDraft(items => items.map(d => d.id === selected ? { ...d, ...patch } : d));
  const begin = () => { setDraft(structuredClone(current)); setSelected(current[0]?.id ?? ''); setEditing(true); };
  const add = (kind: Decoration['kind']) => {
    let n = 1; while ([...draft, ...current].some(d => d.id === `DC-${n}`)) n++;
    const id = `DC-${n}`;
    setDraft([...draft, { id, kind, x: 0.5, y: 0.5, scale: 1, rotation: 0 }]); setSelected(id);
  };
  return <details className="habitat-panel" id="habitat-controls">
    <summary>Habitat & expansion <span>{tank.capacity} places · {tank.water.volumeL.toLocaleString()} L · {current.length} decorations</span></summary>
    <p>Two starter aquariums are included. New aquariums cost ◈ {TANK_PRICE} for 20 places and 10,000 L. Each expansion adds up to 20 places and 10,000 L for ◈ {TANK_UPGRADE_PRICE}, up to 60 places. Equipment is managed in Care controls.</p>
    <p>{reservedPlaces(world, tank.id)} places reserved for courtship. Plants offer shelter; rocks redirect swimming. Decoration changes do not change water quality or growth.</p>
    <div className="habitat-actions">
      <button disabled={readOnly || world.tanks.length >= MAX_TANKS || world.credits < TANK_PRICE} onClick={() => setReview('purchase')}>Review new aquarium · ◈ {TANK_PRICE}</button>
      <button disabled={readOnly || tank.capacity >= 60 || world.credits < TANK_UPGRADE_PRICE} onClick={() => setReview('upgrade')}>Review expansion · ◈ {TANK_UPGRADE_PRICE}</button>
    </div>
    {world.credits < TANK_PRICE ? <p>Not enough credits for a new aquarium. Sell surplus fish to NPC buyers, or rehome hatched fish for free to release places. The credits button in the header lists everything that still costs nothing.</p> : null}
    {world.tanks.length >= MAX_TANKS ? <p>All eight aquarium slots are in use.</p> : null}
    {review ? <div className="batch-review" role="region" aria-label="Aquarium purchase review">
      <p>{review === 'purchase' ? 'Buy a new empty aquarium with 20 places, 10,000 L, Standard filter and aeration?' : `Expand ${tank.name} from ${tank.capacity} to ${Math.min(60, tank.capacity + 20)} places and add 10,000 L of clean water? Existing fish and reservations stay in place.`}</p>
      <p>Cost: ◈ {review === 'purchase' ? TANK_PRICE : TANK_UPGRADE_PRICE}. Balance after: ◈ {world.credits - (review === 'purchase' ? TANK_PRICE : TANK_UPGRADE_PRICE)}.</p>
      <button disabled={readOnly || world.credits < (review === 'purchase' ? TANK_PRICE : TANK_UPGRADE_PRICE)} onClick={() => {
        if (onRun(review === 'purchase' ? { type: 'purchase-tank' } : { type: 'upgrade-tank', tankId: tank.id }, 'Aquarium purchase recorded in the ledger.')) setReview(null);
      }}>Confirm {review === 'purchase' ? 'aquarium purchase' : 'expansion'}</button>
      <button onClick={() => setReview(null)}>Cancel</button>
    </div> : null}
    <h3>Decoration layout</h3>
    <p>Each new piece costs ◈ {DECORATION_PRICE}. Moving, rotating and resizing are free. Removing a piece gives no refund. Review the layout below, then apply it to the live aquarium.</p>
    <svg className="habitat-map" viewBox="0 0 1000 600" role="img" aria-label="Decoration layout preview: plants are green circles; solid rocks are grey circles">
      <rect width="1000" height="600" fill="#102f35" />
      {shown.map(d => <g key={d.id}>
        <ellipse cx={d.x * 1000} cy={d.y * 600} rx={decorationRadius(d) * 1000} ry={decorationRadius(d) * 600} fill={d.kind === 'cover' ? '#426853' : '#72847b'} stroke={d.id === selected ? '#f4dfa4' : '#a5c6b5'} strokeWidth="3" />
        <line x1={d.x * 1000} y1={d.y * 600} x2={(d.x + Math.cos(d.rotation * Math.PI / 180) * decorationRadius(d) * 0.8) * 1000} y2={(d.y + Math.sin(d.rotation * Math.PI / 180) * decorationRadius(d) * 0.8) * 600} stroke="#f4dfa4" strokeWidth="3" />
        <text x={d.x * 1000} y={d.y * 600 + 5} textAnchor="middle" fill="white" fontSize="20">{d.id}</text>
      </g>)}
    </svg>
    {!editing ? <button disabled={readOnly} onClick={begin}>Edit decorations</button> : <>
      <div className="habitat-actions"><button disabled={draft.length >= MAX_DECORATIONS} onClick={() => add('cover')}>Add plants · ◈ {DECORATION_PRICE}</button><button disabled={draft.length >= MAX_DECORATIONS} onClick={() => add('rock')}>Add rock · ◈ {DECORATION_PRICE}</button></div>
      <label>Selected decoration<select value={item?.id ?? ''} onChange={e => setSelected(e.target.value)}><option value="">Choose a piece</option>{draft.map(d => <option key={d.id} value={d.id}>{d.id} · {d.kind === 'cover' ? 'Plants' : 'Rock'}</option>)}</select></label>
      {item ? <fieldset><legend>{item.id} position and appearance</legend>
        {(['x', 'y', 'scale', 'rotation'] as const).map(key => <label key={key}>{({ x: 'Horizontal position', y: 'Vertical position', scale: 'Size', rotation: 'Rotation' })[key]} · {key === 'rotation' ? `${item[key]}°` : `${Math.round(item[key] * 100)}%`}
          <input type="range" aria-label={({ x: 'Horizontal position', y: 'Vertical position', scale: 'Size', rotation: 'Rotation' })[key]} min={key === 'rotation' ? 0 : key === 'scale' ? 0.5 : key === 'x' ? 0.1 : 0.2} max={key === 'rotation' ? 360 : key === 'scale' ? 1.25 : key === 'x' ? 0.9 : 0.85} step={key === 'rotation' ? 5 : 0.01} value={item[key]} onChange={e => change({ [key]: Number(e.target.value) })} />
        </label>)}
        <button onClick={() => { setDraft(draft.filter(d => d.id !== selected)); setSelected(''); }}>Remove selected piece</button>
      </fieldset> : null}
      {invalid ? <p role="alert">{invalid}</p> : null}
      <p>{draft.length} / {MAX_DECORATIONS} pieces · Cost ◈ {cost} · Balance after ◈ {world.credits - cost}</p>
      <div className="habitat-actions"><button disabled={readOnly || !!invalid || world.credits < cost} onClick={() => {
        if (onRun({ type: 'place-decorations', tankId: tank.id, decorations: draft }, 'Layout saved. Plant shelter and rock avoidance now follow these positions.')) setEditing(false);
      }}>Apply layout · ◈ {cost}</button><button onClick={() => setEditing(false)}>Cancel layout changes</button></div>
    </>}
  </details>;
}
