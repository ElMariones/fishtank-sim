import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { annealWindow, BASES, COMPLEMENT, type Base } from '../../core/geneLabView';
import { hash } from '../../core/random';
import { Icon } from '../Icon';
import { NucleotideGlyph } from './EditorArt';

/**
 * Splice Bench minigames (FS-132). They are skill checks in the interface only: each reports one integer score and the
 * bench sends it inside a command, so nothing here is replayed or seeded. Every game has pointer and keyboard controls
 * and slows down under `prefers-reduced-motion`.
 */
export type GameResult = { score: number; failed: boolean; note: string };

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return;
    const change = () => setReduced(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  return reduced;
}

/** Calls `step(dt seconds)` every animation frame while `running`. */
function useFrame(running: boolean, step: (dt: number) => void) {
  const saved = useRef(step);
  saved.current = step;
  useEffect(() => {
    if (!running) return;
    let last = performance.now(), frame = 0;
    const tick = (now: number) => {
      // Clamp long gaps (a hidden tab) so nothing teleports past the cut line.
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      saved.current(dt);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running]);
}

/** Global keys for a game, ignored while a button has focus (the button's own click handles Space and Enter). */
function useKeys(active: boolean, handler: (key: string, event: KeyboardEvent) => void) {
  const saved = useRef(handler);
  saved.current = handler;
  useEffect(() => {
    if (!active) return;
    const listener = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target instanceof HTMLElement && (event.target.closest('button') || event.target.closest('input'))) return;
      saved.current(event.key, event);
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [active]);
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/* ------------------------------------------------------------------------------------------------------------------ */
/* 1. Restriction Cut                                                                                                  */
/* ------------------------------------------------------------------------------------------------------------------ */

const W = 640, H = 210, LOOP = 960, CUT_X = 320, WINDOW = 26, MID = 108, AMP = 36, PITCH = 240;
const SITES = [{ x: 252, label: '5′ site' }, { x: 708, label: '3′ site' }] as const;
const GENE = [300, 660] as const;
const RUNG_TONES = ['var(--lume)', 'var(--gene)', 'var(--kelp)', 'var(--brass)'];
const screenX = (world: number, offset: number) => (((world - offset) % LOOP) + LOOP) % LOOP;
const strandY = (world: number, sign: 1 | -1) => MID + sign * AMP * Math.sin((2 * Math.PI * world) / PITCH);

export function RestrictionCut({ geneName, onDone }: { geneName: string; onDone: (result: GameResult) => void }) {
  const reduced = useReducedMotion();
  const state = useRef({ offset: -380, speed: reduced ? 105 : 175, cut: [false, false], accuracy: [] as number[], penalty: 0, nicks: 0, misses: 0, done: false });
  const [, render] = useState(0);
  const [flash, setFlash] = useState<{ kind: 'hit' | 'nick' | 'miss'; id: number; text: string } | null>(null);
  const flashId = useRef(0);
  const show = (kind: 'hit' | 'nick' | 'miss', text: string) => setFlash({ kind, text, id: ++flashId.current });

  const finish = useCallback(() => {
    const s = state.current;
    if (s.done) return;
    s.done = true;
    const failed = s.nicks >= 3;
    const integrity = failed ? 0 : clamp(Math.round(s.accuracy.reduce((a, b) => a + b, 0) / Math.max(1, s.accuracy.length) - s.penalty), 0, 100);
    window.setTimeout(() => onDone({ score: integrity, failed, note: failed ? 'Three nicks shredded the strand.' : `${s.misses ? `${s.misses} missed pass${s.misses === 1 ? '' : 'es'} · ` : ''}${s.nicks} nick${s.nicks === 1 ? '' : 's'}` }), 650);
  }, [onDone]);

  useFrame(!state.current.done, dt => {
    const s = state.current, before = s.offset;
    s.offset += s.speed * dt;
    SITES.forEach((site, i) => {
      if (s.cut[i]) return;
      const previous = screenX(site.x, before), current = screenX(site.x, s.offset);
      if (previous >= CUT_X - WINDOW && current < CUT_X - WINDOW && previous - current < LOOP / 2) {
        s.penalty += 8; s.misses++; s.speed *= 1.1;
        show('miss', `${site.label} slipped past · −8`);
      }
    });
    render(n => n + 1);
  });

  const cut = () => {
    const s = state.current;
    if (s.done) return;
    const target = SITES.findIndex((site, i) => !s.cut[i] && Math.abs(screenX(site.x, s.offset) - CUT_X) <= WINDOW);
    if (target < 0) {
      s.penalty += 15; s.nicks++;
      show('nick', s.nicks >= 3 ? 'Strand shredded' : `Nicked bare strand · −15 (${s.nicks}/3)`);
      if (s.nicks >= 3) finish();
      return;
    }
    const distance = Math.abs(screenX(SITES[target].x, s.offset) - CUT_X), accuracy = Math.round(100 - (distance / WINDOW) * 60);
    s.cut[target] = true; s.accuracy.push(accuracy);
    show('hit', `${SITES[target].label} cut · ${accuracy}%`);
    if (s.cut.every(Boolean)) finish();
  };
  useKeys(!state.current.done, (key, event) => { if (key === ' ' || key === 'Enter') { event.preventDefault(); cut(); } });

  const s = state.current, rungs: ReactElement[] = [];
  for (let world = 0; world < LOOP; world += 16) {
    const x = screenX(world, s.offset);
    if (x < -8 || x > W + 8) continue;
    const gene = world >= GENE[0] && world <= GENE[1], tone = RUNG_TONES[hash(`rung:${world}`) % 4];
    rungs.push(<line key={world} x1={x} x2={x} y1={strandY(world, 1)} y2={strandY(world, -1)} stroke={tone} strokeWidth={gene ? 3.4 : 2.4} strokeLinecap="round" opacity={gene ? 0.95 : 0.45} />);
  }
  const backbone = (sign: 1 | -1) => {
    let d = '';
    for (let x = 0; x <= W; x += 8) d += `${x === 0 ? 'M' : 'L'}${x} ${strandY(x + s.offset, sign).toFixed(1)}`;
    return d;
  };
  const geneStart = screenX(GENE[0], s.offset), geneWidth = GENE[1] - GENE[0];
  const cuts = s.cut.filter(Boolean).length;

  return <div className="game game-cut">
    <div className="game-stage">
      <svg viewBox={`0 0 ${W} ${H}`} className="game-svg" role="img" aria-label={`A DNA strand scrolls under the enzyme. ${cuts} of 2 sites cut, ${s.nicks} nicks.`}>
        <defs>
          <linearGradient id="cut-fade" x1="0" x2="1"><stop offset="0" stopColor="var(--ink-1)" /><stop offset=".12" stopColor="var(--ink-1)" stopOpacity="0" /><stop offset=".88" stopColor="var(--ink-1)" stopOpacity="0" /><stop offset="1" stopColor="var(--ink-1)" /></linearGradient>
          <filter id="cut-glow"><feGaussianBlur stdDeviation="4" /></filter>
        </defs>
        {[geneStart, geneStart - LOOP].map(x => <g key={x}>
          <rect x={x} y={MID - AMP - 18} width={geneWidth} height={AMP * 2 + 36} rx="14" fill="var(--gene)" opacity=".1" />
          <text x={x + geneWidth / 2} y={MID - AMP - 24} textAnchor="middle" className="game-label gene">{geneName}</text>
        </g>)}
        <rect x={CUT_X - WINDOW} y="14" width={WINDOW * 2} height={H - 28} rx="10" className="cut-window" />
        {rungs}
        <path d={backbone(1)} className="backbone top" />
        <path d={backbone(-1)} className="backbone bottom" />
        {SITES.map((site, i) => {
          const x = screenX(site.x, s.offset);
          return [x, x - LOOP, x + LOOP].filter(px => px > -60 && px < W + 60).map(px => <g key={`${i}:${px}`} className={`site ${s.cut[i] ? 'is-cut' : ''}`} transform={`translate(${px} ${MID})`}>
            {s.cut[i] ? <>
              <rect x="-31" y="-15" width="26" height="30" rx="6" className="site-box" />
              <rect x="5" y="-15" width="26" height="30" rx="6" className="site-box" />
              <path d="M-2 -24l4 48" className="cut-mark" />
            </> : <>
              <rect x="-29" y="-15" width="58" height="30" rx="7" className="site-box" />
              <text y="5" textAnchor="middle" className="site-text">GAATTC</text>
            </>}
            <text y={i === 0 ? 44 : -26} textAnchor="middle" className="game-label">{site.label}</text>
          </g>);
        })}
        <g className="scissors" transform={`translate(${CUT_X} 22)`}>
          <line x1="0" y1="8" x2="0" y2={H - 36} className="laser" filter="url(#cut-glow)" />
          <line x1="0" y1="8" x2="0" y2={H - 36} className="laser" />
          <g transform="translate(-12 -14)"><Icon name="scissors" size={24} /></g>
        </g>
        <rect width={W} height={H} fill="url(#cut-fade)" pointerEvents="none" />
      </svg>
      {flash ? <span key={flash.id} className={`game-flash ${flash.kind}`} role="status">{flash.text}</span> : null}
    </div>
    <div className="game-hud">
      <span className="hud-pips" aria-label={`${cuts} of 2 cuts`}>{[0, 1].map(i => <i key={i} className={s.cut[i] ? 'on' : ''} />)}<small>cuts</small></span>
      <span className="hud-pips danger" aria-label={`${s.nicks} of 3 nicks`}>{[0, 1, 2].map(i => <i key={i} className={i < s.nicks ? 'on' : ''} />)}<small>nicks</small></span>
      <button className="game-action" onClick={cut} data-autofocus disabled={s.done}><Icon name="scissors" size={18} />Cut<kbd>Space</kbd></button>
    </div>
  </div>;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* 2. Sticky Ends                                                                                                      */
/* ------------------------------------------------------------------------------------------------------------------ */

export function StickyEnds({ bases, onDone }: { bases: readonly Base[]; onDone: (result: GameResult) => void }) {
  const reduced = useReducedMotion(), total = (reduced ? 7 : 4.5) + bases.length * (reduced ? 1.6 : 1.05);
  const [index, setIndex] = useState(0), [lives, setLives] = useState(3), [errors, setErrors] = useState<number[]>([]), [left, setLeft] = useState(total);
  const [shake, setShake] = useState(0), [done, setDone] = useState(false);
  const clock = useRef(total), ended = useRef(false);
  const end = useCallback((result: GameResult) => {
    if (ended.current) return;
    ended.current = true; setDone(true);
    window.setTimeout(() => onDone(result), 600);
  }, [onDone]);
  useFrame(!done, dt => {
    clock.current = Math.max(0, clock.current - dt);
    setLeft(clock.current);
    if (clock.current === 0) end({ score: 0, failed: true, note: 'The ends drifted apart before they paired.' });
  });
  const press = (base: Base) => {
    if (ended.current) return;
    if (base === COMPLEMENT[bases[index]]) {
      const next = index + 1;
      setIndex(next);
      if (next === bases.length) {
        const clean = bases.length - new Set(errors).size;
        end({ score: clamp(Math.round(100 * (clean / bases.length) * (0.7 + 0.3 * clock.current / total)), 0, 100), failed: false, note: `${clean}/${bases.length} paired first time · ${clock.current.toFixed(1)} s spare` });
      }
      return;
    }
    setShake(n => n + 1);
    if (!errors.includes(index)) setErrors([...errors, index]);
    const remaining = lives - 1;
    setLives(remaining);
    if (remaining <= 0) end({ score: 0, failed: true, note: 'Three mismatches unravelled the end.' });
  };
  useKeys(!done, (key, event) => { const base = key.toUpperCase() as Base; if (BASES.includes(base)) { event.preventDefault(); press(base); } });

  const step = 520 / Math.max(bases.length, 6), x0 = 60 + (520 - step * bases.length) / 2;
  return <div className="game game-sticky">
    <div className={`game-stage ${shake ? 'shake' : ''}`} key={shake}>
      <svg viewBox="0 0 640 200" className="game-svg" role="img" aria-label={`Pair base ${Math.min(index + 1, bases.length)} of ${bases.length}. ${lives} tries left.`}>
        <path d={`M14 36H${x0 - 8}`} className="backbone top" />
        <path d={`M${x0 + step * bases.length + 8} 168H626`} className="backbone bottom" />
        <path d={`M${x0 - 8} 36H${x0 + step * bases.length}`} className="backbone top faint" />
        <path d={`M${x0} 168H${x0 + step * bases.length + 8}`} className="backbone bottom" />
        <text x="18" y="22" className="game-label">Recipient germline</text>
        <text x="622" y="192" textAnchor="end" className="game-label gene">Cassette overhang</text>
        {bases.map((base, i) => {
          const x = x0 + step * i + step / 2, paired = i < index, current = i === index && !done;
          return <g key={i} className={`pair ${paired ? 'paired' : ''} ${current ? 'current' : ''} ${errors.includes(i) ? 'erred' : ''}`}>
            {current ? <rect x={x - step / 2 + 3} y="44" width={step - 6} height="112" rx="12" className="pair-focus" /> : null}
            <text x={x} y="142" textAnchor="middle" className={`base base-${base}`}>{base}</text>
            <line x1={x} y1="148" x2={x} y2="166" className="stem" />
            {paired ? <>
              <line x1={x} y1="38" x2={x} y2="54" className="stem" />
              <line x1={x - 5} y1="84" x2={x - 5} y2="118" className="bond" />
              <line x1={x + 5} y1="84" x2={x + 5} y2="118" className="bond" />
              <text x={x} y="76" textAnchor="middle" className={`base base-${COMPLEMENT[base]}`}>{COMPLEMENT[base]}</text>
            </> : <rect x={x - 12} y="56" width="24" height="24" rx="6" className="slot" />}
          </g>;
        })}
      </svg>
    </div>
    <div className="game-timer" aria-hidden="true"><i style={{ width: `${(left / total) * 100}%` }} className={left / total < 0.25 ? 'low' : ''} /></div>
    <div className="game-hud">
      <span className="hud-pips heart" aria-label={`${lives} tries left`}>{[0, 1, 2].map(i => <i key={i} className={i < lives ? 'on' : ''} />)}<small>tries</small></span>
      <div className="base-pads" role="group" aria-label="Pair with a base">
        {BASES.map(base => <button key={base} className={`base-pad pad-${base}`} onClick={() => press(base)} disabled={done} aria-label={`Base ${base}`}>
          <NucleotideGlyph base={base} /><b>{base}</b><kbd>{base}</kbd>
        </button>)}
      </div>
    </div>
  </div>;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* 3. Anneal                                                                                                           */
/* ------------------------------------------------------------------------------------------------------------------ */

const ROUNDS = 3, SWEEP = 118;
const polar = (angle: number, radius: number) => {
  const rad = ((angle - 90) * Math.PI) / 180;
  return [160 + radius * Math.cos(rad), 150 + radius * Math.sin(rad)] as const;
};
const arc = (from: number, to: number, radius: number) => {
  const [x1, y1] = polar(from, radius), [x2, y2] = polar(to, radius);
  return `M${x1.toFixed(1)} ${y1.toFixed(1)}A${radius} ${radius} 0 ${to - from > 180 ? 1 : 0} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
};
const celsius = (angle: number) => Math.round(50 + ((angle + SWEEP) / (SWEEP * 2)) * 22);

export function Anneal({ integrity, onDone }: { integrity: number; onDone: (result: GameResult) => void }) {
  const reduced = useReducedMotion();
  const targets = useMemo(() => Array.from({ length: ROUNDS }, () => Math.round((Math.random() * 2 - 1) * (SWEEP - 30))), []);
  const motion = useRef({ t: Math.random() * 2, angle: 0 });
  const [round, setRound] = useState(0), [scores, setScores] = useState<number[]>([]), [last, setLast] = useState<{ text: string; kind: 'hit' | 'miss'; id: number } | null>(null);
  const [, render] = useState(0);
  const done = round >= ROUNDS;
  const speed = (reduced ? 0.32 : 0.5) + round * (reduced ? 0.1 : 0.2);
  useFrame(!done, dt => {
    const m = motion.current;
    m.t += dt * speed;
    const phase = m.t % 2, tri = phase < 1 ? phase : 2 - phase;
    m.angle = -SWEEP + tri * SWEEP * 2;
    render(n => n + 1);
  });
  const half = annealWindow(integrity, Math.min(round, ROUNDS - 1)), center = targets[Math.min(round, ROUNDS - 1)];
  const locked = useRef<number[]>([]);
  const lock = () => {
    if (locked.current.length >= ROUNDS) return;
    const diff = Math.abs(motion.current.angle - center), score = diff <= half ? Math.round(100 - (diff / half) * 50) : 0;
    const next = [...locked.current, score];
    locked.current = next;
    setScores(next);
    setLast({ text: score ? `Locked at ${celsius(motion.current.angle)} °C · ${score}%` : motion.current.angle > center ? 'Too hot: the strands melted apart' : 'Too cold: the strands mispaired', kind: score ? 'hit' : 'miss', id: next.length });
    setRound(next.length);
    if (next.length === ROUNDS) {
      const mean = Math.round(next.reduce((a, b) => a + b, 0) / ROUNDS);
      window.setTimeout(() => onDone({ score: mean, failed: false, note: `${next.filter(Boolean).length}/${ROUNDS} locks in the window` }), 700);
    }
  };
  useKeys(!done, (key, event) => { if (key === ' ' || key === 'Enter') { event.preventDefault(); lock(); } });

  const [nx, ny] = polar(motion.current.angle, 104);
  return <div className="game game-anneal">
    <div className="game-stage anneal-stage">
      <svg viewBox="0 0 320 222" className="game-svg dial-svg" role="img" aria-label={`Thermocycler at ${celsius(motion.current.angle)} degrees. Round ${Math.min(round + 1, ROUNDS)} of ${ROUNDS}.`}>
        <defs>
          <linearGradient id="heat" x1="0" x2="1"><stop offset="0" stopColor="var(--tide)" /><stop offset=".5" stopColor="var(--gene)" /><stop offset="1" stopColor="var(--rose)" /></linearGradient>
        </defs>
        <circle cx="160" cy="150" r="132" className="dial-face" />
        <path d={arc(-SWEEP, SWEEP, 118)} stroke="url(#heat)" className="dial-track" />
        {!done ? <path d={arc(center - half, center + half, 118)} className="dial-window" /> : null}
        {Array.from({ length: 23 }, (_, i) => {
          const angle = -SWEEP + (i * SWEEP * 2) / 22, [x1, y1] = polar(angle, i % 2 ? 98 : 94), [x2, y2] = polar(angle, 104);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="dial-tick" />;
        })}
        <text x={polar(-SWEEP, 80)[0]} y={polar(-SWEEP, 80)[1] + 4} textAnchor="middle" className="game-label">50°</text>
        <text x={polar(SWEEP, 80)[0]} y={polar(SWEEP, 80)[1] + 4} textAnchor="middle" className="game-label">72°</text>
        <line x1="160" y1="150" x2={nx} y2={ny} className="dial-needle" />
        <circle cx="160" cy="150" r="10" className="dial-hub" />
        <text x="160" y="118" textAnchor="middle" className="dial-readout">{celsius(motion.current.angle)}°C</text>
      </svg>
      {last ? <span key={last.id} className={`game-flash ${last.kind}`} role="status">{last.text}</span> : null}
    </div>
    <div className="game-hud">
      <span className="hud-pips" aria-label={`Round ${Math.min(round + 1, ROUNDS)} of ${ROUNDS}`}>{scores.concat(Array(ROUNDS - scores.length).fill(-1)).map((score, i) => <i key={i} className={score > 0 ? 'on' : score === 0 ? 'off' : ''} />)}<small>locks</small></span>
      <button className="game-action" onClick={lock} data-autofocus disabled={done}><Icon name="dial" size={18} />Lock<kbd>Space</kbd></button>
    </div>
  </div>;
}
