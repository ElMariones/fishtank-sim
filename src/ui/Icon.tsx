/** Small inline stroke icons for the lab shell. Decorative: every use sits beside visible or accessible text. */
const PATHS = {
  trophy: 'M8 3h8v6a4 4 0 0 1-8 0zM8 5H4v2a4 4 0 0 0 4 4M16 5h4v2a4 4 0 0 1-4 4M12 13v5M8 21v-3h8v3z',
  calendar: 'M5 5h14v16H5zM8 3v4M16 3v4M5 10h14M8 14h2M14 14h2M8 17h2',
  fish: 'M3 12c3-5 9-6 13-3l5-3v12l-5-3c-4 3-10 2-13-3zM15.5 11h.01',
  flask: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3M7.5 15h9',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  shop: 'M4 9h16l-1.5-5h-13zM5 9v11h14V9M9 20v-6h6v6',
  coins: 'M12 7c4.4 0 8-1.1 8-2.5S16.4 2 12 2 4 3.1 4 4.5 7.6 7 12 7zM4 4.5v5C4 10.9 7.6 12 12 12s8-1.1 8-2.5v-5M4 9.5v5c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5v-5M4 14.5v5c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5v-5',
  save: 'M5 3h11l3 3v15H5zM8 3v5h8V3M8 21v-7h8v7',
  guide: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z',
  download: 'M12 3v12M7 10l5 5 5-5M4 20h16',
  drop: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  dna: 'M7 3c0 6 10 6 10 12 0 3-2 5-5 6M17 3c0 6-10 6-10 12 0 3 2 5 5 6M8.5 7h7M8.5 17h7',
  family: 'M12 5v5M6 14v-2h12v2M6 14v3M18 14v3M10 3h4v4h-4zM4 17h4v4H4zM16 17h4v4h-4z',
  leaf: 'M5 19c0-8 6-14 15-14 0 9-6 15-14 15M5 19l7-7',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  pause: 'M8 5v14M16 5v14',
  play: 'M7 5l12 7-12 7z',
  spark: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',
  chevron: 'M9 6l6 6-6 6',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  egg: 'M12 3c3.5 0 6 6 6 10a6 6 0 0 1-12 0c0-4 2.5-10 6-10z',
  wave: 'M2 10c3-3 5-3 8 0s5 3 8 0 3-3 4-2M2 16c3-3 5-3 8 0s5 3 8 0 3-3 4-2',
  brush: 'M14 4l6 6-8 8H6v-6zM3 21c2 0 3-1 3-3',
  flip: 'M12 3v18M8 7l-5 5 5 5zM16 7l5 5-5 5z',
  shuffle: 'M3 7h4l10 10h4M3 17h4l3-3M14 10l3-3h4M18 4l3 3-3 3M18 14l3 3-3 3',
  minus: 'M5 12h14',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  mountain: 'M3 20l6-10 4 6 3-4 5 8z',
  check: 'M5 12l5 5 9-10',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return <svg className={`icon ${className ?? ''}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={PATHS[name]} /></svg>;
}
