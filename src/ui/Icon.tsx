/**
 * Deepwater icon set (FS-128): one 24 px grid, 1.75 stroke, round joins. Some glyphs carry a soft duotone fill. Icons
 * are decorative: every use sits beside visible or accessible text.
 */
const PATHS = {
  // Lab and navigation
  fish: 'M2.5 12c3.2-4.6 9.2-5.6 13.4-2.6L21 6.5v11l-5.1-2.9C11.7 17.6 5.7 16.6 2.5 12zM8 11.5h.01',
  tank: 'M3 6h18M4 6v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6M4 15c2.5-1.6 4.5-1.6 7 0s4.5 1.6 9 0M9 10.5h.01M14 9.5h.01',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5v1.5A3.5 3.5 0 0 0 8 11M16 6h3.5v1.5A3.5 3.5 0 0 1 16 11M12 13v4M8.5 20.5h7M9.5 17h5l.5 3.5h-6z',
  medal: 'M8 3h8l-2.2 6h-3.6zM12 21a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11zM12 13.2l.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3z',
  flask: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3M7.3 15h9.4',
  grid: 'M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z',
  guide: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z',
  book: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5',
  sidebar: 'M4 4h16v16H4zM9.5 4v16M6.3 8h1M6.3 11h1',
  menu: 'M4 7h16M4 12h16M4 17h10',
  more: 'M4.8 12a1.2 1.2 0 1 0 2.4 0 1.2 1.2 0 1 0-2.4 0M10.8 12a1.2 1.2 0 1 0 2.4 0 1.2 1.2 0 1 0-2.4 0M16.8 12a1.2 1.2 0 1 0 2.4 0 1.2 1.2 0 1 0-2.4 0',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  command: 'M9 6v12M15 6v12M9 9H6.5A2.5 2.5 0 1 1 9 6.5zM15 9h2.5A2.5 2.5 0 1 0 15 6.5zM9 15H6.5A2.5 2.5 0 1 0 9 17.5zM15 15h2.5a2.5 2.5 0 1 1-2.5 2.5zM9 9h6v6H9z',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13.5l1.6 1.2-1.8 3.1-1.9-.7a7 7 0 0 1-2 1.2L15 20.3h-3.6l-.3-2a7 7 0 0 1-2-1.2l-1.9.7-1.8-3.1 1.6-1.2a7 7 0 0 1 0-3l-1.6-1.2 1.8-3.1 1.9.7a7 7 0 0 1 2-1.2l.3-2H15l.3 2a7 7 0 0 1 2 1.2l1.9-.7 1.8 3.1-1.6 1.2a7 7 0 0 1 0 3z',
  filter: 'M4 5h16l-6.2 7.5V19l-3.6 1.5v-8z',
  sort: 'M7 4v16M3.5 16.5L7 20l3.5-3.5M17 20V4M13.5 7.5L17 4l3.5 3.5',
  // Economy
  shop: 'M4 9h16l-1.4-5H5.4zM5 9v11h14V9M9.5 20v-6h5v6M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0',
  coins: 'M12 7.5c4.4 0 8-1.3 8-2.8S16.4 2 12 2 4 3.2 4 4.7s3.6 2.8 8 2.8zM4 4.7v5c0 1.6 3.6 2.8 8 2.8s8-1.2 8-2.8v-5M4 9.7v5c0 1.6 3.6 2.8 8 2.8s8-1.2 8-2.8v-5M4 14.7v4.6C4 20.8 7.6 22 12 22s8-1.2 8-2.7v-4.6',
  tag: 'M3 12V4h8l9.5 9.5-8 8zM7.5 8.5h.01',
  ledger: 'M5 3h12a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2zM9 8h6M9 12h6M9 16h3',
  // Life and care
  drop: 'M12 3s6.5 6.6 6.5 11.3a6.5 6.5 0 0 1-13 0C5.5 9.6 12 3 12 3z',
  bubbles: 'M8.5 20a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM16 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM10.5 7a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17.5 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  thermo: 'M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0zM12 17.5v-6',
  biohazard: 'M12 12m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0M12 3.5a4 4 0 0 1 2.6 7M12 3.5a4 4 0 0 0-2.6 7M4.6 16.3a4 4 0 0 1 4.8-5.2M19.4 16.3a4 4 0 0 0-4.8-5.2M7.2 19.5a4 4 0 0 0 9.6 0',
  food: 'M5 11h14a7 7 0 0 1-14 0zM8 7.5c0-1 .8-1.3.8-2.3M12 7.5c0-1 .8-1.3.8-2.3M16 7.5c0-1 .8-1.3.8-2.3',
  scale: 'M12 4v16M5 20h14M5.5 9L3 15a3 3 0 0 0 5 0zM18.5 9L16 15a3 3 0 0 0 5 0zM5.5 9h13M12 4l-6.5 5M12 4l6.5 5',
  heart: 'M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z',
  egg: 'M12 3c3.6 0 6.3 6.1 6.3 10.2a6.3 6.3 0 0 1-12.6 0C5.7 9.1 8.4 3 12 3z',
  dna: 'M7 3c0 6 10 6 10 12 0 3-2 5-5 6M17 3c0 6-10 6-10 12 0 3 2 5 5 6M8.6 7h6.8M8.6 17h6.8M10 12h4',
  family: 'M12 5v4.5M6 14v-2h12v2M6 14v3M18 14v3M10 2.5h4v4h-4zM4 17h4v4H4zM16 17h4v4h-4z',
  leaf: 'M5 19c0-8 6-14 15-14 0 9-6 15-14 15M5 19l7-7',
  wave: 'M2 10c3-3 5-3 8 0s5 3 8 0 3-3 4-2M2 16c3-3 5-3 8 0s5 3 8 0 3-3 4-2',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z',
  mountain: 'M3 20l6-10 4 6 3-4 5 8z',
  home: 'M3.5 11L12 4l8.5 7M6 9.5V20h12V9.5M10 20v-5h4v5',
  move: 'M5 12h14M15 8l4 4-4 4M9 8l-4 4 4 4',
  // Status and actions
  spark: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',
  sparkles: 'M10 3l1.6 4.4L16 9l-4.4 1.6L10 15l-1.6-4.4L4 9l4.4-1.6zM18 13l.9 2.1L21 16l-2.1.9L18 19l-.9-2.1L15 16l2.1-.9z',
  star: 'M12 3.5l2.6 5.3 5.9.8-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z',
  crown: 'M3.5 8l4.2 3.5L12 5l4.3 6.5L20.5 8 19 18H5zM5 21h14',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5h.01',
  alert: 'M10.3 4.2L2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0zM12 9.5v4.5M12 17.5h.01',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  checkCircle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.3l2.8 2.8L16.2 9.6',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  pause: 'M8 5v14M16 5v14',
  play: 'M7 4.5l12 7.5-12 7.5z',
  chevron: 'M9 6l6 6-6 6',
  chevronDown: 'M6 9l6 6 6-6',
  chevronLeft: 'M15 6l-6 6 6 6',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  arrowLeft: 'M19 12H5M11 6l-6 6 6 6',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  calendar: 'M4.5 5.5h15v15h-15zM8 3v4M16 3v4M4.5 10h15M8 14h2M14 14h2M8 17h2',
  fastForward: 'M3.5 6l8 6-8 6zM12.5 6l8 6-8 6z',
  history: 'M3.5 12a8.5 8.5 0 1 0 2.5-6M3.5 4v4.5H8M12 8v4.5l3 2',
  eye: 'M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  brush: 'M14 4l6 6-8 8H6v-6zM3 21c2 0 3-1 3-3',
  flip: 'M12 3v18M8 7l-5 5 5 5zM16 7l5 5-5 5z',
  shuffle: 'M3 7h4l10 10h4M3 17h4l3-3M14 10l3-3h4M18 4l3 3-3 3M18 14l3 3-3 3',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  save: 'M5 3h11l3 3v15H5zM8 3v5h8V3M8 21v-7h8v7',
  download: 'M12 3v12M7 10l5 5 5-5M4 20h16',
  upload: 'M12 15V3M7 8l5-5 5 5M4 20h16',
  refresh: 'M20 11a8 8 0 0 0-14.8-3.5M4 4v4h4M4 13a8 8 0 0 0 14.8 3.5M20 20v-4h-4',
  pin: 'M9 4h6l-1 5 3 3v2H7v-2l3-3zM12 14v7',
  select: 'M4 4h5M4 4v5M20 4h-5M20 4v5M4 20h5M4 20v-5M20 20h-5M20 20v-5M9 12l2.2 2.2L15.5 10',
} as const;

/** Glyphs with a soft fill under the stroke, for a little weight at small sizes. */
const DUO: Partial<Record<IconName, string>> = {
  fish: 'M2.5 12c3.2-4.6 9.2-5.6 13.4-2.6L21 6.5v11l-5.1-2.9C11.7 17.6 5.7 16.6 2.5 12z',
  drop: 'M12 3s6.5 6.6 6.5 11.3a6.5 6.5 0 0 1-13 0C5.5 9.6 12 3 12 3z',
  heart: 'M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z',
  egg: 'M12 3c3.6 0 6.3 6.1 6.3 10.2a6.3 6.3 0 0 1-12.6 0C5.7 9.1 8.4 3 12 3z',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0z',
  star: 'M12 3.5l2.6 5.3 5.9.8-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z',
  spark: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',
  crown: 'M3.5 8l4.2 3.5L12 5l4.3 6.5L20.5 8 19 18H5z',
  leaf: 'M5 19c0-8 6-14 15-14 0 9-6 15-14 15',
  tag: 'M3 12V4h8l9.5 9.5-8 8z',
  thermo: 'M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z',
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, className, filled = false }: { name: IconName; size?: number; className?: string; filled?: boolean }) {
  const duo = DUO[name];
  return <svg className={`icon icon-${name} ${className ?? ''}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {duo ? <path d={duo} fill="currentColor" stroke="none" opacity={filled ? 1 : 0.16} /> : null}
    <path d={PATHS[name]} />
  </svg>;
}
