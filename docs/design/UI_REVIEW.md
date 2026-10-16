# UI review and redesign brief (FS-128)

**Date:** 16 October 2026 · **Scope:** every screen of the local lab at 1600, 1280, 900 and 375 px · **Method:** source audit of
`src/ui` (32 components, 4 stylesheets, ~380 class names) plus a live walk-through of the aquarium, collection, breeding,
care, habitat, aquascape editor, competitions, shop and inspector.

The redesign that answers this review is described in [Deepwater design system](DESIGN_SYSTEM.md).

## 1. Verdict on the previous interface

The FS-116 "Lagoon" pass fixed the layout (tank first, tabs, drawers) but left the product looking like a capable
prototype rather than a game. Two surfaces are good (the competition circuit and the aquascape dock); the screens a
player uses every minute (collection, inspector, care, breeding) read as forms.

| Area | Score /5 | Main problem |
|---|---|---|
| Visual identity | 2 | No logo beyond a 26 px favicon; generic dark-teal dashboard; no typographic voice. |
| Design system | 1 | Two stylesheets fight (`styles.css` minified v0 + `theme.css` overrides); ~45 hard-coded colours, ~30 font sizes, no spacing scale. |
| Typography | 2 | Body copy at 11–12.5 px; low-contrast greys (#669198, #679096) on dark glass; Georgia hard-coded only in competitions. |
| Aquarium (hero) | 3 | Renderer is rich, but the frame is a plain rounded rectangle; river stones render as glossy spheres that read as eggs. |
| Collection | 2 | Small portrait on a flat card, a checkbox strip on every card, a wall of 12 mixed-height filter controls. |
| Inspector | 2 | 14-row definition list, native `<meter>`, a monospace allele list; no hierarchy between identity, state and genetics. |
| Care / Breeding / Habitat | 1.5 | Raw tables, native selects, `<details>` with sliders; no visual feedback for the numbers they show. |
| Navigation & IA | 3 | Research and Visual fixtures sit beside Aquarium as equals; the calendar takes a full-width bar; no search. |
| Interaction depth | 1.5 | No menus, popovers, context menus, dialogs, keyboard shortcuts or activity history; one toast replaces the last. |
| Accessibility | 3.5 | Good bones (skip links, roving tabs, live regions, reduced motion), weakened by tiny text and faint borders. |

## 2. Findings in detail

### Foundations
1. **Cascade conflict.** Every component is styled twice. Example: `.inspector` is `position: sticky; top: var(--topbar)` in
   `theme.css` line 121 and `top: 16px; max-height: calc(100vh - 32px)` in `styles.css` line 75; the later file wins
   depending on selector order, so the inspector's top offset changes between breakpoints.
2. **No scales.** Font sizes from `.55rem` to `2.35rem` in about 30 steps; radii 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 18 px.
3. **Render-blocking fonts.** Google Fonts loaded through a CSS `@import` inside the bundle, without preconnect.
4. **Icons.** 36 hand-drawn paths at mixed optical weights; several meanings share one glyph (`spark` is temperature,
   warnings, toasts and the trophy room).

### Shell
5. Brand is a favicon plus the word "fishtank sim"; nothing memorable.
6. Six primary destinations of unequal importance: Research and Visual fixtures are developer studies.
7. Calendar bar (full width, 74 px) holds three buttons and a sentence; the sentence duplicates the toast.
8. Stat pills hide their labels below 1320 px, leaving bare numbers.

### Aquarium
9. Glass is implied only by a 1 px border; no rim, no surface highlight, no stand, no ambient light spill.
10. HUD chips are equal-weight and unlabeled values ("Good", "Clean", "Light").
11. Rock pieces (`rock-river`) are drawn as smooth ellipses with a radial specular: they read as eggs.
12. Feed, Aquascape and Motion are three styles of button in one bar.

### Collection
13. Every card spends 40 px on a "Select" checkbox row even when no batch is being made.
14. The filter row mixes pill toggles (40 px), native selects and a segmented control; it wraps to three rows at 1280 px.
15. Batch bar shows a 25-word sentence before any selection.
16. No right-click, no hover actions, no keyboard shortcut to favourite or inspect.

### Inspector
17. Identity, live state, economics and genetics share one list; the important numbers (condition, F, best offer) are not
    visually separated from trivia (birth date).
18. Trait meters are native `<meter>` elements that render differently per browser.
19. Genome view: 66 rows of text; chromosome structure and maternal/paternal phase are not visual.

### Panels
20. Care's projection is a five-column HTML table; settings are four native selects with long option strings.
21. Habitat is a `<details>` disclosure inside a tab that is already a disclosure.
22. Confirmations (sale, rehome, move, purchase) are inline amber boxes that push content down.

### Interaction and feedback
23. Toasts replace each other; a month skip's report can vanish behind the next action.
24. No keyboard shortcuts beyond tab arrows; no global search for 480 animals and 8 tanks.

## 3. Brief for the redesign

**Concept: a natural-history laboratory under water.** Specimen plates and catalogue typography (a soft serif) meet
bioluminescent glass and brass instruments. The aquarium is the stage; everything else is a lab bench around it.

Requirements carried into the build:

- One token-driven stylesheet set; no hard-coded colours outside tokens and the canvas renderer.
- Three typefaces with roles: display serif (names, titles), UI sans (controls, body ≥ 13 px), mono (IDs, alleles, numbers).
- A real logo and mark, used in the rail, favicon and loading screen.
- A component kit: buttons, icon buttons, chips, segmented controls, custom dropdown menus with submenus, popovers,
  tooltips, context menus, modal dialogs, a toast stack with history, a command palette, meters and stat tiles.
- Aquarium frame with rim light, surface glint, stand and light spill; HUD chips that open a water-quality popover.
- Collection cards as specimen plates; hover actions, right-click menu and a batch mode that reveals selection only when used.
- Inspector as a specimen sheet: hero plate, identity, vital tiles, trait bars, then tabs.
- Every confirmation in a dialog; every long notice also in an activity log.
- Keep every existing flow, id used by the guide (`feed-button`, `planner-mother`, `rename-name`, `collection`…), live
  region and reduced-motion behaviour.

## 4. Independent review of the redesign

Two independent reviews ran on the finished redesign before sign-off: a senior front-end code review and a senior
product-design review, both from source. Their findings and what changed:

| Finding | Resolution |
|---|---|
| Menus opened inside dialogs rendered under them (z-order) | Layer order is now drawers 60 < dialogs 75 < menus 85; verified a destination menu inside the Move dialog is on top. |
| Escape in the palette also closed the drawer or dialog below; Ctrl K could open over a dialog | The palette stops Escape; dialogs and drawers ignore Escape while a menu or the palette is open; Ctrl K is ignored under a dialog. |
| Shortcuts acted behind open drawers and popovers; `[`/`]` discarded an unsaved aquascape draft | Shortcuts wait for any open layer; `[`/`]` wait while a draft is open. |
| A sale confirmation could appear later on its own; "Sell…" offered for fish with no buyer | Sell is disabled with the reason when nobody buys; a pending sale clears when its offer disappears. |
| Focus could leave a dialog after Tab closed a menu; focus was lost after confirming from the inspector | Menus return focus to their trigger on Tab; dialogs re-trap stray focus and fall back to the profile or collection. |
| "Nothing leaves this device" was untrue with Google Fonts | Copy now says the world is saved only in this browser and the typefaces load from Google Fonts. |
| Body text under 13 px; meaningful text at 7–10.5 px | Type scale moved up a step; an 11 px floor token replaces every smaller size, including the competition stylesheet. |
| Hard-coded colours, off-scale radii, ~340 `!important` | Tint text, gradients and scene colours are tokens; radii snapped to the scale; `!important` removed except two utilities. |
| Brass used for non-money states; axolotl accent hard-coded and near the female pink | Calendar to tide, aquascaping to moss, selection to lume, mutations to gene; new `--axolotl` orchid; paid actions brass. |
| Credits disappeared at 900 px and below; stat details only in tooltips | The credits pill stays at every width; stat labels stay visible; clutch and calendar details have screen-reader text. |
| 1281–1440 px was the tightest layout; care gauges clipped | The rail folds to icons at 1440 px; gauges and settings wrap with `auto-fit`. |
| Toasts expired while being read | Toasts pause while hovered or focused and get their remaining time back. |
| Endless blinking and floats beside the live tank | Alerts blink three times; hero float and light-spill loops removed; panel blur limited to floating layers. |
| HUD chips showed bare values; Care used native selects with long option strings | Chips read "O₂ good", "NH₃ clean"…; Care settings use the custom select with hints and prices. |
| Competition stylesheet was minified with its own scale | De-minified, neutral text and hairlines on tokens, 11 px floor, breakpoints aligned (the warm ceremony palette stays). |

## 5. Acceptance

Accepted when: `npm test` and `npm run build` pass; a browser walk-through at 1600, 1280, 900 and 375 px shows no
overflow, clipped labels or unstyled controls; keyboard paths reach menus, dialogs and the palette; a Web Interface
Guidelines review (focus, contrast, motion, forms, touch targets) finds no blocking issue. Results are recorded in
[TESTING](../TESTING.md#fs-128-deepwater-ui-redesign).
