# Implementation status

**Updated:** 14 September 2026 · **Build:** 0.1.0 research lab. M1 FS-101–112 are DONE; FS-111 pooled five observers (54/60, above chance in every mode), so M1's roadmap gate is met. M2 FS-201–206 are DONE (`bd175ed`, `6a69695`). FS-113 (user request) adds genome v2 color and ornament genetics and is DONE (`2436fbf`). M3 is under way: FS-301 (water model, `4f61d8b`), FS-302 (life stages and growth, `5821f46`), FS-303 (utility behavior, `e7aefc1`) and FS-304 with the early FS-403 prediction (`5dbfb73`) are DONE. FS-305 care controls are DONE (`d425639`). FS-306 juvenile reveal is DONE (`325ceb4`). FS-307 care demonstration and absence summary is DONE (`a5d5ddc`), completing M3's task list. M4 has started: FS-401/402 normal breeding with courtship blockers and reserved nurseries is DONE (`9aabfdb`). FS-404's bounded six-generation family graph is DONE (`b7c3e37`). FS-405's incremental kinship cache with stated founder assumptions is DONE (`850f501`). FS-406's clutch selection, batch rehoming and two-generation demonstration are DONE (`44d7d98`), completing M4's task list. M5 has started: FS-501's economy model v1 is DONE (`006b500`).

## Current continuation — FS-502 DONE, pushed `3945d86`

Completed review of the existing uncommitted shop work on `5704c4b`, verified equal to freshly fetched `origin/main`. Added day-correct migration, shop metadata validation, purchase filter reset, cached listing previews, responsive destination controls, and deferred research bundles. `npm test`: 162 tests in 27 files pass; strict production build passes. Browser purchase, reload, ledger, filter, low-credit and phone checks passed on isolated port 5178. See [FS-502 shop evidence](research/FS-502-PERSISTENT-SHOP.md).

Next is FS-503: tank purchase/upgrades and persisted decoration placement. M5 remains open. `.claude/launch.json` remains untracked.

## Previous continuation — FS-501 DONE, pushed `006b500`

14 September 2026: FS-501 started from `85db06b` (FS-406 marked DONE), equal to `origin/main`. `.claude/launch.json` stays untracked; `fishtank-qa` (port 5176) serves the QA world.

- FS-501 adds:
  - **World save v6:** five NPC buyers with bounded demand that recovers each game day, and explained offers.
  - **Founder resale limit:** founders and bought stock resell for at most ◈ 150, below the stock price.
  - **Credit ledger:** it must reconcile with the balance.
  - **Rehoming:** economy-neutral, via `rehome-batch`.
  - **Journal compatibility:** sale commands carry a price model, so journals recorded before FS-501 replay at the lab quote.
  - **Research → Economy experiment:** runs E-05's six strategies.

  See [FS-501 economy model](research/FS-501-ECONOMY-MODEL.md).
- Next: FS-502, persistent shop stock and filters, where refreshing cannot reroll stock and purchases respect capacity.

## Previous continuation — FS-406 DONE, pushed `44d7d98`

14 September 2026: FS-406 started from `deafb89` (FS-405 marked DONE), equal to `origin/main`. `.claude/launch.json` stays untracked; the QA world (`localhost:5176`) and the generated deep lineage (`127.0.0.1:5176`) remain the isolated browser origins.

- FS-406 adds three pieces:
  - `move-batch` moves a reviewed batch to another tank atomically, counting nursery reservations.
  - A Clutch filter separates clutches within a parent pair. Any living fish can be selected for a move, while favorites and eggs are still never sold in bulk.
  - Research → **Two generations** runs a seeded normal-mode demonstration through the runtime: two founder pairs, selection from their adult clutches, one rehoming batch per clutch and a second generation. It uses no instant cross and replays its journal.

  See [FS-406 two generations](research/FS-406-TWO-GENERATIONS.md).
- M4's task list (FS-401–406) is delivered. Its gate, "complete two generations without instant-lab shortcuts", is met in two ways, neither an external playtest:
  - by that demonstration;
  - by a QA-world lineage bred twice in normal mode through the UI, with time advanced by protected offline catch-up.
- Followed by M5 FS-501 (above).

## Previous continuation — FS-405 DONE, pushed `850f501`

14 September 2026: FS-405 started from `c741d20` (FS-404 marked DONE), equal to `origin/main`. `.claude/launch.json` stays untracked; the QA world (`localhost:5176`) and the generated deep lineage (`127.0.0.1:5176`) remain the isolated browser origins.

- FS-405: `createKinshipCache` keeps computed ancestor pairs for the session as births are added, rebuilds only when recorded history changes, and applies an explicit, validated founder assumption (unrelated and not inbred by default; unrecorded parents count as founders). Expected pedigree F and the Family note state how many founders a value assumes. Values match the previous calculation exactly. See [FS-405 kinship cache](research/FS-405-KINSHIP-CACHE.md).
- Followed by FS-406 (above).

## Previous continuation — FS-404 DONE, pushed `b7c3e37`

14 September 2026: FS-404 started from `f944706` (FS-401/402 marked DONE), equal to `origin/main`. `.claude/launch.json` stays untracked; its `fishtank-qa` entry (port 5176) serves the QA world at `localhost` and a generated deep lineage at `127.0.0.1`, two isolated origins.

- FS-404: `genealogy.ts` computes a bounded ancestor graph on demand. Each ancestor is listed once at its nearest generation, with its positions and the counts of recorded, founder-stock and missing positions. It also lists descendants by generation, searches records and keeps breadcrumbs. The Family tab shows up to six generations each way with portraits, aquariums and archived status. Selecting a relative focuses it across tanks, and marked ancestors continue further back. No save or command changed. See [FS-404 family graph](research/FS-404-FAMILY-GRAPH.md).
- Followed by FS-405 (above).

## Previous continuation — FS-401/402 DONE, pushed `9aabfdb`

14 September 2026: FS-401/402 started from `00e291c` (FS-307 marked DONE), equal to `origin/main`. `.claude/launch.json` stays untracked; its `fishtank-qa` entry (port 5176) is the isolated QA origin.

- FS-401/402: world save v5 adds per-fish rest days and clutch records. A pairing checks roles, adult stage, condition, rest, existing courtships, a shared tank, the nursery and population limits, then reserves nursery places that every arrival counts. Courtship progresses once per game day or records why it paused, lays tracked eggs into the reserved places, rests the parents and marks the clutch hatched. The instant lab cross remains as a labeled shortcut and for replay. See [FS-401/402 breeding lifecycle](research/FS-401-402-BREEDING-LIFECYCLE.md).
- Followed by FS-404 (above).

## Previous continuation — FS-307 DONE, pushed `a5d5ddc`

14 September 2026: FS-307 started from `45c0063` (FS-306 marked DONE), equal to `origin/main`. `.claude/launch.json` stays untracked; its extra `fishtank-qa` entry (port 5176) is the isolated QA origin.

- FS-307: an optional per-day observer on the ordinary advance feeds a per-tank **While you were away** summary after protected catch-up (hatching, stage changes, growth, condition, limiting causes with day counts, waiting warnings) and a standing count of declines without a named cause, which is zero. Research → **Care scenarios** runs a healthy tank and a stressed tank that recovers when a simulated keeper follows its warnings. See [FS-307 care demonstration and absence](research/FS-307-CARE-DEMO-AND-ABSENCE.md).
- M3 (FS-301–307) task list is delivered. Its gate, "fish react legibly; habitat affects development", is demonstrated by the FS-303, FS-305 and FS-307 fixtures and browser journeys, not by an external playtest.
- Followed by M4 FS-401/402 (above).

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
- FS-301: world save v2 gives every tank a unit-aware, one-compartment water model: litres, temperature, dissolved oxygen, ammonia nitrogen and uneaten food, with biofilter and aeration. It advances through the shared clock in fixed half-game-hour steps; visible, background, offline and replayed intervals agree exactly, and a mass-balance ledger backs zero, overload and recovery fixtures. Residents load the water at their adult genetic potential. The aquarium shows read-only oxygen, ammonia and stocking bands. World v1 saves migrate with default water. See [FS-301 water model](research/FS-301-WATER-MODEL.md).
- FS-302: world save v3 gives every fish a life state (age, current length, condition). Breeding lays eggs that hatch after 3 game days. Fry and juveniles grow logistically toward their genetic adult length, reaching adulthood in about 18–30 game days in good water, slower under low oxygen, ammonia or crowding. Condition carries recent conditions forward, so deficits and recovery take days. Development runs once per game day through the shared clock, including offline and replay. The tank draws fish at current size and counts incubating eggs; cards and the inspector show stage, age and condition beside adult potential. Eggs cannot breed or be sold. Older saves migrate as young adults. See [FS-302 life stages](research/FS-302-LIFE-STAGES.md).
- FS-304 (`5dbfb73`): one spatial hash per motion step supplies stable ordered local neighbors, and shared plant-cover and rock footprints drive Canvas and avoidance with body-center clearance. FS-403 (`5dbfb73`): exact pre-mutation genotype odds at all 60 loci and a separate 256-offspring preview of adult length and goal scores that never changes future births. See [spatial and prediction evidence](research/FS-304-403-SPATIAL-AND-PREDICTION.md).
- FS-305: world save v4 tank care with feeder rations, a shared food pool, filter and aeration tiers, a thermostat, manual feeding and water changes. Nutrition and temperature join the daily environment; condition names every limiting cause. The care panel shows chips, warnings with priced fixes, and controls with cost and a three-day projection before applying. See [FS-305 care controls](research/FS-305-CARE-CONTROLS.md).
- FS-306: stage appearance v1 in `src/core/juvenile.ts` (body maturity from length, pigment maturity from age) and renderer v6 swim motion with eased turns, interpolation and eggs. Inspector and collection toggles separate **Now** from **Adult potential**; Visual fixtures adds a juvenile reveal strip. See [FS-306 juvenile reveal](research/FS-306-JUVENILE-REVEAL.md).
- FS-307: `onDay` observer on the shared advance, `absence.ts` per-tank return summary with an unexplained-decline check, the **While you were away** panel, and seeded healthy/stressed care scenarios in Research with a keeper that applies warning fixes. See [FS-307 care demonstration and absence](research/FS-307-CARE-DEMO-AND-ABSENCE.md).
- FS-401/402: `breeding.ts` pairing and courtship blockers, day-boundary courtship and spawning into reserved nursery places, rest days, cancel and sale guards; world save v5 with validated clutch records; the Normal breeding panel, clutch list and inspector Breeding row. See [FS-401/402 breeding lifecycle](research/FS-401-402-BREEDING-LIFECYCLE.md).
- FS-404: `genealogy.ts` bounded ancestor graph with repeated ancestors listed once, per-generation completeness, descendant generations, record search and breadcrumbs. `FamilyView.tsx` shows up to six generations each way with portraits, cross-tank and archived focus. See [FS-404 family graph](research/FS-404-FAMILY-GRAPH.md).
- FS-405: `createKinshipCache` in `pedigree.ts` keeps computed ancestor pairs for the session as births are added. It rebuilds only when recorded history changes, and treats founders and unrecorded parents under an explicit, validated assumption (unrelated and not inbred by default). The breeding panel and Family view state how many founders an F value assumes. See [FS-405 kinship cache](research/FS-405-KINSHIP-CACHE.md).
- FS-406: the `move-batch` command, clutch groups within a pair, the Clutch filter, move and sale reviews for any selected living fish, and `lifecycleScenario.ts` with the Research **Two generations** tab. See [FS-406 two generations](research/FS-406-TWO-GENERATIONS.md).
- FS-501: `economy.ts` buyers, offers with explained terms, ordered sale plans, demand recovery and the ledger; world save v6 with market, ledger and the rehomed status; inspector offers, sale and rehoming reviews, **Buyers and ledger**, and `economyExperiment.ts` with the Research **Economy experiment** tab. See [FS-501 economy model](research/FS-501-ECONOMY-MODEL.md).
- 157 automated tests; production build; Chrome verification of worker load/cleanup/faults, two-tab takeover, offline limits, transaction recovery, migration and 10,000-record import/restore, with the runtime journeys repeated in the in-app Chromium pane after the M2 review fixes.

## Prototype shortcuts and limitations

| Area | Current limitation | Next task(s) |
|---|---|---|
| Visual quality | Canvas reference art; five observers scored 54/60 on one fixed 12-trial set, with markings the weak channel; portraits are still images and swim motion is a stylized 2D side view; renderer v6 frame timing unmeasured | FS-701 |
| Anatomy limits | An eye that cannot fit a shallow head is drawn smaller (adjustment listed); no protruding eyes or extra structures | FS-601–602 |
| Pattern inheritance | Placement inherited from haplotype blocks (73% sibling separation, computed); common haplotypes are shared by chance; ellipse shapes; symmetry is a spread proxy, not bilateral matching; all five observers misread one markings trial. FS-113 motif positions come from the birth seed, while kind, colors, density and contrast are inherited, and people have not judged them | FS-601 |
| Selection balance | Keeping 4 + 4 parents saturates v1 traits within 4–7 generations and drives pedigree F to about 0.8, with only the expected-F figure as a warning | FS-403 FS-605 |
| Research data | Five anonymous records pooled in-repo by hand; no cue notes, observer context or remote collection | FS-705 |
| Collection preferences | Up to four compound goals, sort and favorites are device-local and not in exported saves; filters (including the Clutch filter) and parent picks reset on reload | FS-203–204 |
| World size | 10,000 records and 480 living fish; tested large snapshot round trip about 755 ms, with validation still on the main thread; pathological pedigrees can still require quadratic ancestor-pair work on a first query, though computed pairs are then cached for the session | FS-702 |
| Life stages | Eggs, fry, juveniles, adults and an elderly label with age, growth and condition; condition is the health measure; hatchling proportions ease with length and pigment reveals by age only; fry steer with adult movement traits; no disease or death | FS-906 |
| Behavior | Utility cruise/forage/eat/hide/school with transient visual pellets; domain feeding is one shared pool per tank; no courtship, territorial utility or learned memory | FS-401 FS-906 |
| Curiosity/life-history genes | growth_rate, longevity, metabolism and oxygen_demand are active; fertility sets courtship speed; curiosity remains display-only | FS-906 |
| Breeding | Normal breeding enforces adult stage, condition, rest days, a shared tank and a reserved nursery, with recorded pause reasons; the instant lab cross still bypasses them as a labeled shortcut; no courtship animation, mate preference, natural breeding or cost | FS-906 |
| Environment | One-compartment water and care per tank: feeder rations, filter and aeration tiers, thermostat and water changes with previews; poor care lowers condition and slows growth but never kills; no pH, nitrite/nitrate, light, plant uptake or disease; food and equipment have no running cost | M5 |
| Decorations | Shared cover/rock footprints and body-center clearance; extreme fins can overlap; no user placement or collision mesh | FS-503 FS-701 |
| Economy | Economy model v1: five NPC buyers with bounded, recovering demand and explained offers; founders resell below the stock price; a reconciled ledger; free rehoming. Persistent shop stock has fixed specimens, filters, expiry and ledger-backed purchases (FS-502). Tanks, breeding and food are free; no upkeep, collector orders or real market | FS-503–505 |
| Batch management | Reviewed batch moves, sales and rehoming; selection clears when the tank, archive view or a filter changes; the move review checks places, not crowding | FS-505 |
| Rarity | Only founder-stock rarity labels for appearance (FS-113); no measured reference population or global service | FS-603 FS-805 |
| Topology | No extra tail lobes/eyes/fins or genome v3 topology; FS-113 scale types are drawn textures, not scale geometry | FS-601–602 |
| Family | Six generations back and forward as generation lists with text edges; no drawn pedigree chart or lineage registration; breadcrumbs, depth and the kinship cache are session-only; F assumes founders unrelated rather than measuring them | FS-603 FS-604 |
| History | Birth and pedigree permanent; recent command events persist but compact every 64 commands; no permanent lifetime event history or old portraits | FS-404 |
| Appearance versions | Lab fish store no per-record development/anatomy/renderer version; all fish re-render under the current model (markings moved with development v2) | FS-404 FS-601 |
| Persistence | IndexedDB snapshots/replay, two backups and one Web Locks writer; browsers without Web Locks fall back to stale-write rejection; no cloud sync; preferences remain device-local | FS-703 M8 |
| Save recovery | Export/retry and reviewed backup/import recovery work; physical power-loss durability and cross-browser recovery matrix remain untested | FS-703 |
| Performance | Motion runs in a worker; a synthetic 200-fish/100-step run kept measured input delay under 2 ms, but Canvas rendering and large-save validation remain on the main thread. A 10,000-record commit costs about 1.3 s of serialization and validation, so idle clock checkpoints run every five minutes | FS-701–702 |
| Selection | Body and caudal-fin shaped picking with 6 px slop; dorsal/pectoral fins only through slop; the live canvas is not keyboard-focusable (the collection is the keyboard path); no animated camera travel | FS-704 |
| UI scale | Inspector stacks below the collection on phones; collection and descendant lists paginate at 60 rows; a six-generation view can draw up to 126 portraits, unprofiled on low-end devices; no screen-reader audit yet | FS-701 FS-704 |
| Offline | Catch-up for at most eight hours integrates care, water and development (480 game days at 1×) and shows a per-tank return summary; the summary is not stored after dismissal or reload, and poor care during an absence still lowers condition (never fatally) | FS-404 |
| Online | No accounts, server, database, actual player listings, payments or external telemetry | M8 |
| Delivery | Pushed to GitHub `main`; no public deployment or continuous integration | FS-706 |

## Evidence

**FS-501 economy model v1, Windows 11, Node 22.18.0, npm 10.9.3, in-app Chromium (isolated port 5176):** 157 tests and build pass. Six fixtures cover:
- offer terms and the founder resale limit;
- demand use, recovery and batch plans;
- a reconciled, bounded ledger under a 900-step walk;
- rehoming;
- legacy sales and world v5 migration;
- E-05 bounds.

E-05 over 60 game days: resale lost ◈ 143–236 a cycle; selective and collector breeders earned about ◈ 3,100 selling 40–49 fish; farming strategies earned ◈ 536–643 selling 230–290 fish at about ◈ 2.

In the browser:
- **Migration:** the world v5 QA save migrated.
- **Offers and sales:** Haru's ◈ 150 founder-limited offer showed its terms. Fry 7 sold to the pond keeper for ◈ 77, and a three-fish batch paid its reviewed ◈ 317.
- **Rehoming:** it changed no credits.
- **Ledger:** it reconciled throughout.

See [FS-501 economy model](research/FS-501-ECONOMY-MODEL.md).

**FS-406 two generations and batch rehoming, Windows 11, Node 22.18.0, npm 10.9.3, in-app Chromium (isolated origins on port 5176):** 151 tests and build pass. Three fixtures cover `move-batch` atomicity and reservations, clutch groups within a pair, and the seeded two-generation demonstration.

In the browser:
- **Research demonstration:** 3 of 3 clutches hatched, the second generation on day 40, with 0 instant crosses, 38 fish rehomed and a replayed save.
- **QA world:** a clutch filter chose 20 of 40 Haru × Sumi offspring, and one reviewed move sent them to The Koi Garden. Two of them then bred in normal mode, laying and hatching 20 eggs, whose Family shows grandparents Haru and Sumi and pedigree F 25.0%.
- **Before commit:** a replay check that compared key order instead of content was corrected.

See [FS-406 two generations](research/FS-406-TWO-GENERATIONS.md).

**FS-405 kinship cache, Windows 11, Node 22.18.0, npm 10.9.3, in-app Chromium (isolated origins on port 5176):** 148 tests and build pass. Six fixtures cover textbook relationships through second cousins, Wright's full-sib and backcross recurrences, three founder assumptions against the tabular relationship matrix, founder and missing-parent listing through real commands, incremental reuse (the next of 240 cached generations computes at most 12 pairs) and exact rebuilds. In the browser, Haru × Sumi read 0.0% with 2 founders assumed, and generation 9 siblings Tomo × Yori read 85.4% in both breeding modes, the value their first egg then showed. A wrong fixture expectation for a removed father record was corrected before commit. See [FS-405 kinship cache](research/FS-405-KINSHIP-CACHE.md).

**FS-404 family graph, Windows 11, Node 22.18.0, npm 10.9.3, in-app Chromium (isolated origins on port 5176):** 142 tests and build pass. Eight fixtures cover:
- repeated ancestors;
- an explicit position-by-position reference on random inbred pedigrees with missing records;
- ten generations reached six at a time;
- sold and cross-tank relatives;
- nearest-generation descendants;
- 10,000-record bounds;
- search and the trail.

In the browser:
- Family followed Haru's child Fry 31 into Breeding Studio and back to The Koi Garden, and kept sold Sumi as an archived record.
- On a generated nine-generation lineage, Tomo's view showed 126 of 126 positions, with backcrossed Kai listed once in 32 positions, then continued from Hana to the founders.
- A 43 px touch breadcrumb was fixed before commit.

See [FS-404 family graph](research/FS-404-FAMILY-GRAPH.md).

**FS-401/402 normal breeding, Windows 11, Node 22.18.0, npm 10.9.3, in-app Chromium (isolated port 5176):** 134 tests and build pass. Six fixtures cover pairing blockers, courtship pauses and spawning, reservations under seeded random command walks, no duplication across reloads and offline catch-up, cancel and sale guards, and world v4 migration with clutch validation. Before commit, the fixtures caught a migration key-order bug that would have sent every older save to recovery mode. In the browser, the world v4 QA save loaded cleanly. Haru × Sumi reserved 20 nursery places, refused a sale while courting, paused while separated (45% frozen over 3 game days) and, once reunited, laid 20 eggs into the reserved places and rested for 7 and 3 game days. See [FS-401/402 breeding lifecycle](research/FS-401-402-BREEDING-LIFECYCLE.md).

**FS-307 care demonstration and absence, Windows 11, Node 22.18.0, npm 10.9.3, in-app Chromium (isolated port 5176):** 128 tests and build pass. Four fixtures cover observer neutrality, no unexplained decline across 12 random care setups, the healthy and stressed scenarios, and absence summaries including the eight-hour cap. In the browser, a 20-minute absence showed a per-tank summary (20 fish reached adulthood, nothing limited, one quiet tank). The stressed scenario fell from 94% to 13% over 15 game days with oxygen never below 4.1 mg/L, cleared every warning two days after one review, and returned to 100%, with 0 of 675 declines unexplained. See [FS-307 care demonstration and absence](research/FS-307-CARE-DEMO-AND-ABSENCE.md).

**FS-306 juvenile reveal, Windows 11, Node 22.18.0, npm 10.9.3, in-app Chromium (isolated port 5176):** 124 tests and build pass. Six fixtures cover maturity, interpolation without genetic change, stage anatomy and framing sweeps (fixtures and 600 founders at four maturities), ornament reveal, continuous turning poses and the reveal series. In the browser, 20 eggs showed egg portraits and an incubating caption; after 8 simulated minutes the fry read "fry at 1.8 cm, current appearance", and the Now/Adult potential toggles relabeled cards and the inspector, with the collection choice persisting. The reveal strip showed pigment 5/35/80/100% on days 6/9/12/16. See [FS-306 juvenile reveal](research/FS-306-JUVENILE-REVEAL.md).

**FS-305 care controls, Windows 11, Node 22.18.0, npm 10.9.3, in-app Chromium (isolated port 5176):** 118 tests and build pass. Seven fixtures cover ration conservation, directional development, the thermostat, split/offline/replay equality, atomic costs, warnings whose fixes clear a stressed tank with exact projections, and world v3 migration. In the browser, a stressed tank (Compact filter, Gentle aeration, 29 °C, Heavy rations, 26 fish, 45 offline minutes) read oxygen critical 1.7 mg/L and ammonia high 9.23 mg N/L with priced fixes; after a previewed fix, a 50% water change and 30 more minutes it read good, clean, 97% fed and 100% condition with no warnings. See [FS-305 care controls](research/FS-305-CARE-CONTROLS.md).

**FS-302 life stages, Windows 11, Node 22.18.0, npm 10.9.3, in-app Chromium 152:** 91 tests and build pass. One genome raised under declared conditions reaches adulthood within 18–30 game days in healthy water, and ranks healthy > crowded > high ammonia > hypoxic in length at day 30. Recovery takes days and never shrinks a fish. The existing QA world (a world v2 snapshot) loaded as adult stock without a replay warning. Twenty bred eggs showed "20 eggs incubating", were fry drawn small after 12 game minutes, and were all adults after 25 more. See [FS-302 life stages](research/FS-302-LIFE-STAGES.md).

**FS-301 water model, Windows 11, Node 22.18.0, npm 10.9.3, in-app Chromium 152:** 84 tests and build pass. Zero, overload and recovery fixtures each balance oxygen, ammonia and food against the recorded fluxes within 1e-7 relative, and a randomly split interval matches a single integration exactly. The existing QA world (a world v1 snapshot) loaded without a replay warning: a 158 kg tank read good oxygen and clean ammonia, and a 60-fish, 225 kg tank read low oxygen and heavy stocking. Saved water replayed after a reload, and a two-hour absence applied 144,002 ticks. See [FS-301 water model](research/FS-301-WATER-MODEL.md).

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

**Continue M5 with FS-503: tank purchases/upgrades and decoration placement.** Persist decoration transforms and update functional footprints. Preserve the fixed shop specimens, nursery reservations and atomic ledger-backed purchases. Keep sale commands carrying a price model, migrations writing keys in schema order, and the ledger reconciled. FS-403 prediction is available early; it does not establish M4's two-generation gate.
