import { useId } from 'react';
import type { Base } from '../../core/geneLabView';
import { hash } from '../../core/random';
import type { Species } from '../../core/types';

/**
 * Splice Bench art (FS-132): hand-built SVG on Deepwater tokens. Every piece is decorative and sits beside text, so all
 * are `aria-hidden`. Colours come from CSS custom properties so the art follows the theme.
 */
export const SPECIES_TONE: Record<Species, string> = { koi: 'var(--koi)', goldfish: 'var(--goldfish)', guppy: 'var(--guppy)', axolotl: 'var(--axolotl)' };

/** A gene cassette: a capped glass vial whose barcode bands are unique to its allele and whose fill shows its doses. */
export function CassetteArt({ species, seed, doses, integrity, read = true, size = 64 }: { species: Species; seed: string; doses: number; integrity: number; read?: boolean; size?: number }) {
  const id = useId().replace(/:/g, ''), tone = SPECIES_TONE[species], h = hash(seed);
  const bands = Array.from({ length: 5 }, (_, i) => ({ y: 34 + i * 7, w: 6 + ((h >> (i * 3)) & 7), on: ((h >> (i + 11)) & 1) === 1 || i === 2 }));
  const level = 74 - doses * 14;
  return <svg className="cassette-art" width={size * 0.62} height={size} viewBox="0 0 40 96" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-glass`} x1="0" x2="1"><stop offset="0" stopColor="#fff" stopOpacity=".28" /><stop offset=".35" stopColor="#fff" stopOpacity=".05" /><stop offset="1" stopColor="#fff" stopOpacity=".16" /></linearGradient>
      <linearGradient id={`${id}-fluid`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={tone} stopOpacity=".95" /><stop offset="1" stopColor={tone} stopOpacity=".45" /></linearGradient>
      <clipPath id={`${id}-clip`}><path d="M11 16h18v58a9 9 0 0 1-18 0z" /></clipPath>
    </defs>
    <ellipse cx="20" cy="88" rx="14" ry="3.5" fill={tone} opacity=".22" />
    <g clipPath={`url(#${id}-clip)`}>
      <rect x="9" y={level} width="22" height="90" fill={`url(#${id}-fluid)`} />
      <path d={`M9 ${level} q5 -2.5 11 0 t11 0`} fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="1" />
      {read ? bands.map((band, i) => band.on ? <rect key={i} x={20 - band.w / 2} y={band.y} width={band.w} height="2.2" rx="1.1" fill="var(--ink-0)" opacity=".55" /> : null)
        : <text x="20" y="52" textAnchor="middle" fontSize="13" fontFamily="var(--font-mono)" fill="var(--ink-0)" opacity=".6">??</text>}
      {Array.from({ length: 4 }, (_, i) => <circle key={i} cx={14 + ((h >> (i * 5)) % 12)} cy={level + 10 + i * 9} r={0.9 + (i % 2) * 0.6} fill="#fff" opacity=".45" />)}
    </g>
    <path d="M11 16h18v58a9 9 0 0 1-18 0z" fill={`url(#${id}-glass)`} stroke="var(--line-3)" strokeWidth="1.2" />
    <path d="M14 22v44" stroke="#fff" strokeOpacity=".35" strokeWidth="1.6" strokeLinecap="round" />
    <rect x="7.5" y="6" width="25" height="11" rx="3" fill="var(--brass)" />
    <rect x="7.5" y="6" width="25" height="4" rx="2" fill="#fff" opacity=".28" />
    <rect x="10" y="17" width="20" height="2.5" rx="1" fill="var(--brass)" opacity=".65" />
    <circle cx="33.5" cy="22" r="3" fill={integrity >= 85 ? 'var(--kelp)' : integrity >= 60 ? 'var(--brass)' : 'var(--amber)'} stroke="var(--ink-1)" strokeWidth="1.2" />
  </svg>;
}

const BASE_TONE: Record<Base, string> = { A: 'var(--lume)', T: 'var(--kelp)', G: 'var(--gene)', C: 'var(--brass)' };
/** Nucleotide pads: purines (A, G) are a fused hexagon and pentagon, pyrimidines (T, C) a single ring. */
export function NucleotideGlyph({ base, size = 34 }: { base: Base; size?: number }) {
  const tone = BASE_TONE[base], purine = base === 'A' || base === 'G';
  return <svg className={`nucleotide nucleotide-${base}`} width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
    <path d={purine ? 'M9 13l7-4 7 4v8l-7 4-7-4z' : 'M13 12l7-4 7 4v9l-7 4-7-4z'} fill={tone} fillOpacity=".22" stroke={tone} strokeWidth="2" strokeLinejoin="round" />
    {purine ? <path d="M23 13l7 1.5 2 6.5-4.5 4.5L23 21" fill={tone} fillOpacity=".12" stroke={tone} strokeWidth="2" strokeLinejoin="round" /> : null}
    {base === 'G' ? <circle cx="16" cy="17" r="2" fill={tone} /> : null}
    {base === 'C' ? <path d="M20 8v-3" stroke={tone} strokeWidth="2" strokeLinecap="round" /> : null}
    {base === 'T' ? <path d="M20 25v4" stroke={tone} strokeWidth="2" strokeLinecap="round" /> : null}
    <path d={purine ? 'M16 25v8' : 'M20 25v8'} stroke="var(--fg-3)" strokeWidth="1.6" strokeLinecap="round" />
  </svg>;
}

/** The empty vault: a rack of three waiting vials. */
export function EmptyVaultArt() {
  return <svg className="vault-empty-art" width="132" height="92" viewBox="0 0 132 92" aria-hidden="true" focusable="false">
    <rect x="8" y="46" width="116" height="10" rx="4" fill="var(--brass)" opacity=".75" />
    <rect x="14" y="56" width="6" height="30" rx="2" fill="var(--brass)" opacity=".45" />
    <rect x="112" y="56" width="6" height="30" rx="2" fill="var(--brass)" opacity=".45" />
    {[30, 58, 86].map((x, i) => <g key={x} opacity={i === 1 ? 1 : 0.55}>
      <path d={`M${x} 14h16v50a8 8 0 0 1-16 0z`} fill="rgb(255 255 255 / .05)" stroke="var(--line-3)" strokeWidth="1.4" strokeDasharray={i === 1 ? '0' : '3 3'} />
      <rect x={x - 2} y="8" width="20" height="8" rx="2.5" fill="var(--gene)" opacity=".7" />
    </g>)}
    <path d="M66 30c-4 6 4 10 0 16" stroke="var(--gene)" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity=".8" />
  </svg>;
}

/** Header ornament: a slowly turning double helix whose rungs light in base-pair colours. */
export function HelixOrnament() {
  const rungs = Array.from({ length: 14 }, (_, i) => i);
  return <svg className="helix-ornament" width="260" height="120" viewBox="0 0 260 120" aria-hidden="true" focusable="false">
    <g className="helix-turn">
      {rungs.map(i => {
        const x = 10 + i * 18, phase = (i / 14) * Math.PI * 2.4, top = 60 + Math.sin(phase) * 38, bottom = 60 - Math.sin(phase) * 38;
        const tones = ['var(--lume)', 'var(--gene)', 'var(--kelp)', 'var(--brass)'];
        return <g key={i}>
          <line x1={x} y1={top} x2={x} y2={bottom} stroke={tones[i % 4]} strokeWidth="3" strokeLinecap="round" opacity={0.25 + Math.abs(Math.cos(phase)) * 0.6} />
          <circle cx={x} cy={top} r="4.2" fill="var(--gene)" />
          <circle cx={x} cy={bottom} r="4.2" fill="var(--lume)" opacity=".85" />
        </g>;
      })}
    </g>
  </svg>;
}
