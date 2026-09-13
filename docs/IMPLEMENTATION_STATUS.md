# Implementation status

**Updated:** 13 September 2026 · **Build:** 0.1.0 research lab. M1 FS-101–112 are DONE; FS-111 pooled five observers (54/60, above chance in every mode), so M1's roadmap gate is met. M2 FS-201–206 are DONE (`bd175ed`, `6a69695`). FS-113 (user request) adds genome v2 color and ornament genetics; it is verified and awaiting push.

## Delivered

- Complete planning package: GDD, genetics, architecture, UX, balance, roadmap, task backlog, decision log and continuation guide.
- Original user concept preserved verbatim under docs/source.
- React/TypeScript/Vite app with pinned dependencies and runnable local scripts.
- Six deterministic founder koi with permanent world-local IDs, names, sex and birth timestamps.
- 48 loci on eight phased synthetic chromosomes; linked meiosis; adjacent allele mutation; recessive switches; polygenic expression.
- Parameter-driven body/head/snout/eye/mouth/barbel/fin/pigment/pattern drawing; same renderer in aquarium and portraits.
- Seeded initial positions, fixed-step wandering, local separation/cohesion, inherited speed/turning/activity/boldness and food attraction.
- Click/list selection, enlarged static adult preview, name editing, overview, all-locus view and mutation markers.
- Twenty-offspring instant crosses, repeat generations, parent references and mutation records.
- Clickable parents/children; living relatives focus their aquarium; sold fish remain readable.
- Pedigree kinship/F and locus heterozygosity as separate metrics.
- Multiple tanks, transfer, cosmetic plants on/off, resident search and local archive.
- Local NPC stock purchase, reviewed sale, bounded quote, and balance/ownership command checks.
- Device-local autosave, versioned schema/reference validation, preserved invalid save fallback and JSON export.
- Responsive desktop/phone layout, keyboard-accessible fish cards and reduced-motion initial pause.
- FS-101 visual baseline: deterministic founder/cohort/extreme fixtures, normalized descriptor report, accessible comparison surface, and downloadable JSON report.
- FS-102 anatomy v2: pure outline/anchor/bounds module shared by tank and portraits; eyes, fin roots, rays, gill and mouth attached to the measured outline; listed eye constraints; six anatomy stress fixtures; clipping-free fitted and shared-scale portraits; fish-shaped tank picking. See [FS-102 anatomy anchors](research/FS-102-ANATOMY-ANCHORS.md).
- FS-103 development v2 inherited markings: marking anchors from phased Pigments/Pattern haplotype blocks, birth-seed jitter only, renderer v3 body-space markings, an inspector list of each fish's marking blocks and their parental copy, and a seeded resemblance study (sibling separation 52% → 73%). See [FS-103 inherited markings](research/FS-103-INHERITED-MARKINGS.md).
- FS-104 collection comparison: a device-local breeding goal (any visible descriptor, higher or lower) ranks the collection and shows goal values on cards, parent pickers and the inspector. One goal leader per sex sets a parent without clearing the goal. ☆ favorites with a Favorites filter; a Parents filter with both parents pinned above the grid; breeding switches to that pair's offspring. Preferences are validated and stored apart from the world save (ADR-020).
- FS-105 research surfaces, reached from the header's **Research** view: a seeded ten-generation selection experiment (6 traits × 8 lines with random-mating controls, trend charts and outcome table) and a blind 12-trial resemblance study in full, silhouette-only and markings-only modes with per-mode accuracy, a computational observer for comparison and a copyable result record. See [FS-105 selection and resemblance](research/FS-105-SELECTION-AND-RESEMBLANCE.md).
- FS-106 keyboard, text and touch pass: skip links to the collection and inspector; keyboard or relative selection moves focus to the inspector heading, and "↩ Collection" returns it to the card; touch targets of at least 44 px on coarse pointers (24 px otherwise); header, trait, genome and tab layouts that reflow at 200% text.
- FS-108 (user request): larger colour-coded sex symbols (pink ♀, blue ♂) with visible or hidden text, on collection cards, the inspector, relatives, the batch review and parent pickers.
- FS-109 (user request): multi-select residents with shift-click ranges, select all and clear, a reviewed batch sale showing names, quotes and total, and one atomic `sell-batch` command.
- FS-110 (user request): All / ♀ Females / ♂ Males filter buttons with live counts in the resident and archive collection views; changing the filter clears batch selection. Browser evidence in [TESTING.md](TESTING.md#fs-110-sex-filter-verification).
- FS-112: 480 living fish across eight 60-place tanks; 10,000 permanent records, including sold ancestors. Exact memoized kinship has no depth cutoff; collection and offspring views paginate at 60 rows.
- FS-201: runtime schema v2 wraps unchanged world/genome v1 with integer 50 ms command ticks, monotonic command/event IDs, stale-command rejection and a bounded validated replay journal. FS-205 now advances the same persistent clock between commands.
- FS-203: IndexedDB transactions store current plus two valid backups, compare-and-swap stale writers, validate/read back commits, and migrate v1 while retaining its original raw localStorage data.
- FS-204: Saves panel with export, file/paste import validation and count preview, explicit replacement, backup preview/restore, preserved-legacy export and retry after storage failure. Unreadable current saves block autosave until explicit recovery.
- FS-107: [M1 evidence review and M2 contracts](research/M1-REVIEW-M2-FOUNDATION.md); human recognition is still untested.
- FS-111: five validated anonymous observer records, 54/60 overall (full 19/20, silhouette 20/20, markings 15/20), each mode above chance at the 95% lower bound; every observer missed markings trial-9. The pool also reports per-trial agreement. See [human resemblance results](research/FS-111-HUMAN-RESEMBLANCE.md).
- FS-202: versioned module worker owns 20 Hz fish steering and transfers compact `Float32Array` frames to Canvas. Fish that join the visible tank are drawn and pickable on the next frame; motion pauses while the page is hidden. StrictMode/view cleanup terminates every replaced worker; one automatic and one user-triggered recovery path keep faults visible.
- FS-205: one integer 50 ms clock advances visible and background tank integration identically, with idle checkpoints every five minutes. Reload applies elapsed time at normal 1×, clamps negative deltas to zero and caps protected offline catch-up at eight hours. No life-history effects exist yet.
- FS-206: Web Locks gives one tab edit authority while other tabs remain inspectable and read-only; closing the writer and reloading transfers control. Existing transaction/quota recovery remains in the Saves panel.
- FS-113 (user request): genome v2 appends Color and Ornament chromosomes. They add body, accent, dot and eye colors (with blends and two-tone eyes), fine multicolor spots, tiger stripes, marbling, calico, rosettes and motif mixes, five scale types, shimmer, and tail and dorsal patterns, with body motifs that can reach the fins. About one founder in four shows a new feature, and striking variants stay under 1%. Genome v1 fish keep their exact look, and FS-101–111 fixtures are unchanged. The inspector lists appearance with founder-stock rarity, and Visual fixtures shows 15 variants and a founder survey. See [FS-113 appearance genetics](research/FS-113-APPEARANCE-GENETICS.md).
- 72 automated tests; production build; Chrome verification of worker load/cleanup/faults, two-tab takeover, offline limits, transaction recovery, migration and 10,000-record import/restore, with the runtime journeys repeated in the in-app Chromium pane after the M2 review fixes.

## Prototype shortcuts and limitations

| Area | Current limitation | Next task(s) |
|---|---|---|
| Visual quality | Canvas reference art; five observers scored 54/60 on one fixed 12-trial set, with markings the weak channel; portrait is static | FS-306 FS-701 |
| Anatomy limits | An eye that cannot fit a shallow head is drawn smaller (adjustment listed); no protruding eyes or extra structures | FS-601–602 |
| Pattern inheritance | Placement inherited from haplotype blocks (73% sibling separation, computed); common haplotypes are shared by chance; ellipse shapes; symmetry is a spread proxy, not bilateral matching; all five observers misread one markings trial. FS-113 motif positions come from the birth seed, while kind, colors, density and contrast are inherited, and people have not judged them | FS-601 |
| Selection balance | Keeping 4 + 4 parents saturates v1 traits within 4–7 generations and drives pedigree F to about 0.8, with only the expected-F figure as a warning | FS-403 FS-605 |
| Research data | Five anonymous records pooled in-repo by hand; no cue notes, observer context or remote collection | FS-705 |
| Collection preferences | Goal, sort and favorites are device-local and not in exported saves; filters and parent picks reset on reload; the Parents filter groups every clutch of a pair | FS-203–204 |
| World size | 10,000 records and 480 living fish; tested large snapshot round trip about 755 ms, with validation still on the main thread; pathological pedigrees can require quadratic ancestor-pair work | FS-405 FS-702 |
| Life stages | All fish display adult potential immediately; no aging, growth, hunger, health, death or lifespan integration | FS-302 |
| Behavior | No true feeding consumption, courtship, territorial utility, shelter use or learned memory | FS-303 |
| Curiosity/life-history genes | Some outputs are computed or displayed only; do not affect lifecycle | FS-302–303 |
| Breeding | Lab bypasses maturity, shared habitat, cost and cooldown; fixed 20 fish | FS-401–402 |
| Environment | No liters, biomass, temperature, water chemistry or oxygen simulation | FS-301 |
| Decorations | Plants are cosmetic toggle; no placement or collision footprint | FS-304 FS-503 |
| Economy | Free breeding/tanks make profit farming trivial, and batch sale makes it faster; stock is generated at purchase; sale quotes ignore appearance; no real market | FS-501–502 |
| Batch management | Batch sale only; no batch move/rehome, and selection does not persist across tank or archive views | FS-406 |
| Rarity | Only founder-stock rarity labels for appearance (FS-113); no measured reference population or global service | FS-603 FS-805 |
| Topology | No extra tail lobes/eyes/fins or genome v3 topology; FS-113 scale types are drawn textures, not scale geometry | FS-601–602 |
| Family | One-hop navigation, no graph layout or lineage registration | FS-404–405 FS-604 |
| History | Birth and pedigree permanent; recent command events persist but compact every 64 commands; no permanent lifetime event history or old portraits | FS-404 |
| Appearance versions | Lab fish store no per-record development/anatomy/renderer version; all fish re-render under the current model (markings moved with development v2) | FS-404 FS-601 |
| Persistence | IndexedDB snapshots/replay, two backups and one Web Locks writer; browsers without Web Locks fall back to stale-write rejection; no cloud sync; preferences remain device-local | FS-703 M8 |
| Save recovery | Export/retry and reviewed backup/import recovery work; physical power-loss durability and cross-browser recovery matrix remain untested | FS-703 |
| Performance | Motion runs in a worker; a synthetic 200-fish/100-step run kept measured input delay under 2 ms, but Canvas rendering and large-save validation remain on the main thread. A 10,000-record commit costs about 1.3 s of serialization and validation, so idle clock checkpoints run every five minutes | FS-701–702 |
| Selection | Body and caudal-fin shaped picking with 6 px slop; dorsal/pectoral fins only through slop; the live canvas is not keyboard-focusable (the collection is the keyboard path); no animated camera travel | FS-704 |
| UI scale | Inspector stacks below the collection on phones; collection and relative lists paginate at 60 rows; no screen-reader audit yet | FS-404 FS-704 |
| Offline | Persistent research time catches up for at most eight hours; no growth, health, water or other biological state exists to integrate yet | FS-301–302 |
| Online | No accounts, server, database, actual player listings, payments or external telemetry | M8 |
| Delivery | Pushed to GitHub `main`; no public deployment or continuous integration | FS-706 |

## Evidence

**FS-113 appearance genetics, Windows 11, Node 22.18.0, npm 10.9.3, in-app Chromium 152:** 72 tests and build pass, and the FS-101 checksum pins and FS-103/105/111 research tests are unchanged. Of 10,000 seeded founders, 26.6% show a new feature, and every striking variant is under 1%. Browser checks rendered all 15 appearance variants. Before push they also found that replaying legacy breed/buy journal entries under genome v2 broke existing saves; with versioned commands, the same world now loads and saves. A genome v1 fish reads as classic, and four new Newcomers were genome v2, one with a very rare slate and lavender blend. See [FS-113 appearance genetics](research/FS-113-APPEARANCE-GENETICS.md).

**M2 completion review and FS-111 pool, Windows 11, Node 22.18.0, npm 10.9.3, in-app Chromium 152:** 63 tests and build pass. The review fixed three problems. Fish bred into the visible tank were invisible; 40 → 60 fish now draw without a reload. The hidden-page motion pause is restored (21 → 0 → 20 frames per second). Idle clock checkpoints moved to five minutes after measuring about 1.3 s per 10,000-record commit. Re-verified: worker cleanup (6 created / 6 terminated over three remounts), automatic and manual fault recovery, a read-only second tab with takeover, the eight-hour cap (576,000 ticks) and a future timestamp (0 ticks). FS-111: five observers, 54/60. See [TESTING.md](TESTING.md#m2-completion-review-and-fixes).

**FS-106/107/112 and M2 foundation, Windows 11, Node 24.11.1, npm 11.6.2, Chrome:** 53 tests and production build pass. Keyboard select/rename/breed/family/reload works; 10,000 records survive IndexedDB and reviewed import with 60-row archive/family pages; abort, quota and stale-write checks preserve all three snapshot slots; v1 bytes and unsupported current data remain untouched. At 375 px with coarse pointer, checked targets are at least 44 px; 200% text has no horizontal overflow at phone or desktop widths. See [TESTING.md](TESTING.md#m1-continuation-and-m2-foundation-verification).

**FS-202/205/206 and FS-111 observer 1, same OS/toolchain, Chrome 153.0.8010.36:** 62 tests and build pass. One active worker remained after StrictMode and three remounts; 200 fish × 100 motion steps took 89.9 ms in the worker with 1.9 ms input delay; automatic/manual fault recovery passed. A second tab was read-only and took control after writer close/reload. Offline catch-up applied exactly 576,000 ticks for a nine-hour absence and zero for a future timestamp. See [M2 report](research/M2-RUNTIME-AND-RECOVERY.md).


**FS-106, 13 September 2026, Windows 11, Node 22.18.0, npm 10.9.3:** strict typecheck and the existing test suite passed. Browser journeys and measurements are recorded in [TESTING.md](TESTING.md#fs-106-keyboard-text-and-touch-verification): skip links first in tab order; keyboard card and relative selection land on the inspector heading; "↩ Collection" returns to the card; no touch target under 44 px with a coarse pointer; no clipping or page overflow at 200% text.

**FS-105, same environment:**

- npm test: **44 tests passed** (21 core, 5 anatomy, 6 pattern, 4 collection, 4 selection, 4 resemblance study); strict typecheck passed.
- Selection experiment (identical in Node and the browser): 6 of 6 traits beyond the founder typical range in 8 of 8 selected lines (random-mating 0–2 of 8); mean pedigree F 0.80; heterozygosity 77% → 14–19%; 0 invalid anatomies among 3,840 generation-10 fish; tail selection speed 0.042 → 0.034. The browser run took 0.9 s.
- Computational observer, 300 trials each: silhouette 99.7%, markings 89.0%, combined 98.7% with 4 siblings; 96.3%, 79.7% and 95.3% from a single child.
- Browser: **Research** is reachable from the header view navigation (`aria-current`). Trial 1 showed 4 siblings and two parent pairs, with labels that do not reveal the answer. An answer with a cue stored `{ trialId: trial-1, choice: 0, cue: "tail shape", ms: 690 }`; **Undo last answer** removed it. Scripted answers to all 12 trials reached the results table and a valid 12-answer record; **Start again** then cleared them. No new console errors.
- One human observer completed the study at the time: 11/12 overall. FS-111 later pooled five observers: 54/60.

**FS-104, same environment:**

- npm test: 36 tests passed; strict typecheck and production build passed.
- Browser: choosing **Tail length** ranked cards #1 onward with goal chips from 49% down to 6%; leaders ♀ Kohaku 49% and ♂ Momo 35%; choosing Kohaku kept the goal. Favorites and the Parents filter worked; goal, direction, sort and favorites persisted across a reload; breeding switched to the pair's offspring ranked by the goal.

**FS-103, same environment:**

- npm test: 32 tests passed; strict typecheck passed.
- Seeded study, 24 families × 10 children: sibling separation 52.4% (independent placement) → 72.7% (inherited anchors); parent separation 53.3% → 71.9%. Replication at 60 × 12: 52.8% → 72.3%. FS-101 cohorts: 50.5% → 82.2%. Browser tables matched.

**FS-108/FS-109/FS-110, same environment:**

- Browser (the pane's own test world): pink `rgb(255, 140, 198)` and blue `rgb(109, 185, 255)` sex symbols at 21.6 px; shift-click range selection of five fish; reviewed batch sale raised credits 1,200 → 1,601 and moved five fish to the archive; the sex filter showed 9 females and 12 males, cleared a ticked selection when changed, and applied in the archive. No overflow at 375 × 812.

**FS-102, same environment:**

- Anatomy sweep, 858 phenotypes: renderer v1 anchor rules failed for all 858 (286 eye overhangs, 243 stray tail rays, 26 clipped portraits, among others). Anatomy v2 failed 0 attachment and 0 framing checks; it limited 51 eye radii and moved 76 eyes.

**FS-101, 13 September 2026, Windows, Node 24.11.1, npm 11.6.2:** 20 tests and build passed. Browser: aquarium rendered; twenty offspring created; child renamed Ember; moved to Breeding Studio; Family selected Haru and focused The Koi Garden; Haru sold to local NPC and archived; reload retained fish counts and Ember's name/location; no console warnings/errors; 390 × 844 had no document overflow.

No production-scale benchmark, complete accessibility audit, external user study, online transaction test, or 100-generation visual study has been completed.

## Next action

**Push and mark FS-113 DONE.** M1's roadmap gate and M2 are complete, so the next scheduled task is FS-301’s unit-aware water model.
