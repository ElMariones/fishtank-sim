# Deepwater design system (FS-128)

The interface of the lab since 16 October 2026. It answers the [UI review](UI_REVIEW.md). Concept: **a natural-history
laboratory under water** — specimen plates and catalogue typography meet bioluminescent glass and brass instruments. The
aquarium is the stage; everything else is a bench around it.

## Files

| File | Holds |
|---|---|
| `src/ui/design/tokens.css` | Every colour, type size, space, radius, shadow, easing, duration, z-layer and layout width. Legacy names (`--aqua`, `--text-2`…) alias the new tokens. |
| `src/ui/design/base.css` | Reset, type, native buttons/fields/tables/meters (wrapped in `:where()` so any component class wins), focus, utilities, shared keyframes. |
| `src/ui/design/kit.css` | Menus, select trigger, tooltip, popover, dialog, toasts, activity log, command palette, chips, badges, segmented controls, bars, rings. |
| `src/ui/design/shell.css` | App grid, navigation rail (expanded, compact, horizontal), top bar and calendar, workspace and inspector columns, tabs, drawers, breakpoints. |
| `src/ui/design/aquarium.css` | Tank frame, glass, HUD and water report, cabinet controls, aquascape editor and dock, loading states. |
| `src/ui/design/collection.css` | Toolbar, filters, specimen-plate cards, selection dock, empty and loading states. |
| `src/ui/design/inspector.css` | Hero plate, identity, vitals, tabs, facts, trait bars, genome chromosomes, family tree, bloodlines. |
| `src/ui/design/panels.css` | Breeding, care gauges, habitat offers, guide, calendar report, recovery, market, shop, saves. |
| `src/ui/design/research.css` | Visual fixtures and research studies. |
| `src/ui/competitions.css` | The circuit's own tier-tinted palette, now on the shared type and button tokens. |

## Foundations

- **Type.** Fraunces (display: names, titles, numbers that are headlines), Instrument Sans (all controls and copy),
  JetBrains Mono (IDs, alleles, credits, measurements). Body text is 13 px or larger (`--t-xs` and up). `--t-floor`
  (11 px) is the minimum and is only for eyebrows, caps labels, badges and captions. Fonts load from Google Fonts with
  preconnect in `index.html`, with system fallbacks.
- **Colour roles.** `--lume` aqua is action, selection and batch selection. `--brass` is value: credits, prices, offers,
  trophies, every paid action (Buy, paid Apply, water change, aquarium purchase), and the keeper's favourites (a gold
  star, the one deliberate exception). `--tide` is time, water and measurements (the calendar, care settings).
  `--moss` is habitat and aquascaping (the editor, its dock and selection, the habitat card). `--koi` is koi and breeding;
  `--axolotl` (orchid) is axolotls; `--gene` is genetics (generation, pedigree, genome, mutations, goal rank).
  `--amber` warns, `--rose` is urgent or destructive, `--kelp` confirms health (including the condition ring).
  Female `#ff8fc8`, male `#74c4ff`. Text on a tone's soft fill uses its `--{tone}-ink` token.
- **Tokens only.** No colour outside `tokens.css` except black and white in masks; gradients (`--grad-lume`,
  `--grad-brass`, `--grad-moss`), the tank's metal frame and plate backgrounds are tokens too. Control heights are
  `--control-sm/md/lg` (32/38/46 px). Base control styles are zero-specificity, so no `!important` is needed outside
  the visually-hidden utility and the reduced-motion override.
- **Surfaces.** Ink layers `--ink-0…6`; glass panels with a lit top edge; specimen plates (`--plate`) behind every portrait.
- **Motion.** `--ease-out` for entries, `--ease-spring` for small confirmations (stars, toasts, tab indicator). Durations
  120–520 ms. Alerts blink three times and then hold; the live dot pulses four times. The only endless decoration is a
  38-second ambient drift behind the app. Everything decorative stops under `prefers-reduced-motion`. Backdrop blur is
  kept for layers that float over moving content (top bar, HUD, menus, dialogs, drawers).

## Components (src/ui/kit)

| Component | Use |
|---|---|
| `MenuButton`, `MenuList` | Deployable menus with headings, separators, shortcuts, checked rows and nested submenus. Arrow keys, Home/End, type-ahead, Right/Left for submenus, Escape/Tab to close, focus returns to the trigger. |
| `Select` | A single-choice dropdown built on the menu. Used for collection Parents/Clutch/Sort, inspector Move to, move-dialog destination. Form selects inside planners stay native (styled) because tests and forms read them. |
| `useContextMenu` | Right-click, Menu key or Shift+F10 on fish cards and rail aquariums. |
| `TooltipLayer` | One global layer: any element with `data-tip` shows a tip after 380 ms (60 ms when moving between tips). `data-tip-collapsed` shows a rail tip only when its label is hidden. |
| `Popover` | Anchored panel for rich read-only content: the water report and the activity log. |
| `Dialog` | Modal with focus trap, Escape, restored focus and tones (lume, brass, rose, gene, koi). Every sale, rehoming, move, bloodline registration and aquarium purchase confirms here; the safe action (Cancel) has initial focus. |
| `ToastStack`, `ActivityLog` | Up to three toned toasts with a lifetime bar that pauses while the pointer or focus is on them; every notice also enters the session's activity log behind the bell. |
| `CommandPalette` | Ctrl/⌘ K or `/`: views, workspace tabs, actions, aquariums and every animal record. |

## Interaction conventions

- Layers, bottom to top: rail and top bar, drawers (60), dialogs and the palette (75), menus and popovers (85), toasts
  (100), tooltips (110). A menu opened inside a dialog sits above it. Escape closes only the topmost layer.

- Shortcuts (ignored while typing or while a menu, popover, dialog, drawer or the palette is open; `[`/`]` also wait while an aquascape draft is open): `.` next day, `F` feed, `M` motion, `1–4` workspace
  tabs, `[`/`]` previous/next aquarium, `G` then `A`/`C`/`T`/`R` views, `?` shortcuts, Ctrl K palette.
- The open view is in the address (`#/competitions`…), so Back, Forward and bookmarks work.
- Collection selection is a mode: the check appears on hover, when checked or while selecting; in selection mode a card
  click toggles it and shift-click extends a range. The dock floats at the bottom and ends after each batch action.
- Calendar: a tide split button in the top bar. Next day is the primary action; its menu holds a week and a month. When
  time cannot move (read-only tab, save warning, open aquascape, exhibition in progress) the button stays focusable
  and explains why instead of silently disabling.
- Breakpoints: 1440 px folds the rail to icons; 1280 hides two stat pills and the search label; 1080 keeps only credits;
  900 turns the rail into a top strip and stacks the inspector; 650 is the phone layout; 420 drops the calendar text.
  Credits stay visible at every width.

## Brand

`public/brand/mark.svg` (also `public/favicon.svg`): a kohaku koi swimming inside a specimen lens with a bioluminescent
rim. Wordmark: “Fishtank” in Fraunces with a “Genetics lab” eyebrow. The same mark animates on the pre-load splash.

## Renderer changes

River stones are flat, lopsided and matte with mineral speckle and quartz veins (they previously read as eggs). The
selected animal has a breathing dashed halo and a name pill in the interface typeface. Each aeration step adds an
air-stone bubble column, so equipment is visible in the water. No genome, phenotype or saved data changed.
