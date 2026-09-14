# Testing and verification

**Latest recorded run:** 14 September 2026 (FS-306 juvenile reveal, after FS-305 care controls), Windows 11, Node 22.18.0, npm 10.9.3, in-app Chromium (Claude desktop browser pane) on an isolated QA origin. Earlier: 13 September 2026 (FS-302 life stages, after FS-301, FS-113, the M2 completion review and the FS-111 five-observer pool), in-app Chromium 152.0.7977.76. The earlier FS-202/205/206 run used Node 24.11.1, npm 11.6.2 and Google Chrome 153.0.8010.36 via bundled Playwright. Browser checks use independent fixtures, fresh browser contexts or the browser pane's own QA world; no user lineage is reset.

## 1. Commands

```sh
npm ci
npm test
npm run build
```

Vitest runs every `tests/*.test.ts` file. The M2 additions are `runtime.test.ts`, `time.test.ts`, `motionClient.test.ts` and `limits.test.ts`; `resemblancePool.test.ts` validates human records; `appearance.test.ts` covers genome v2 appearance (FS-113); `water.test.ts` covers the FS-301 water model; `development.test.ts` covers FS-302 life stages and growth; `care.test.ts` covers FS-305 care; `juvenile.test.ts` covers FS-306 stage appearance and turning poses. The build first type-checks all app and test TypeScript in strict mode, then creates dist/. The current suite has **124 tests** in 20 files, and all passed. The production build passed.

## 2. Automated coverage

| Area | Existing evidence |
|---|---|
| Reproducibility | Same founders, parent inputs and seed produce same offspring, mutation log, phenotype and checksum |
| Parental origin | 500 crosses with mutation disabled; each maternal/paternal allele comes from the corresponding parent |
| Mendelian segregation | 10,000 seeded offspring; recessive locus frequencies within 2 percentage points of 25/50/25 |
| Linkage | 10,000 synthetic marker crosses; adjacent boundary switch frequency within 2 points of 0.12 |
| Mutation | Forced mutations produce 96 matching log entries, valid alleles and no boundary no-op |
| Expression | All-zero, all-five, heterozygous extremes and 1,000 founders have finite positive anatomy/speed and 6–12 finite in-range marking anchors |
| Tradeoff | Changing tail length alone decreases speed as specified |
| Selection | Ten selected generations increase mean body depth by more than 0.08 compared with starting pool |
| Pedigree | Unrelated, self, full siblings, half siblings, parent-offspring, cousins, sold ancestors and input reordering |
| Birth command | Twenty unique IDs, correct parent links/generation, original world unchanged, save round-trip |
| Capacity | Cohort overflow rejected with no partial births or ID changes |
| Parent eligibility | Same-parent misuse rejected; accelerated second generation supported |
| Sale | Funds paid once, genome/pedigree retained, repeat sale and breeding archived parent rejected |
| Batch sale | Four cohort members sold in one command: credits rise by the sum of their quotes, genomes and parents retained, save round-trips; empty, duplicate, already-sold and unknown members each reject the whole batch with no change |
| Transfer/rename | Identity/genome preserved; invalid name/destination rejected |
| NPC purchase | Funds deducted, new founder, immediate resale loses credits, insufficient funds rejected |
| Save validation | Bad JSON, version, duplicates, IDs, tanks, cycles and allele bounds rejected |
| Motion | Two 2,000-tick runs agree, positions remain finite and in bounds |
| Visual fixtures | Founder/cohort/extreme signatures, 14 normalized descriptors, bounded measurements |
| Anatomy attachment | 58 fixtures, 8 corner genomes, 1,500 founder-distribution and 1,500 random A0/A5 genomes: finite x-monotonic outline, positive thickness, eye inside head, fin/gill/mouth/barbel roots inside the body, rays on the trailing edge, bounds contain every sampled curve |
| Anatomy regression | 558-phenotype sweep: v1 rules show defects (including eye overhang), anatomy v2 shows none; founder outline endpoints unchanged; eye limits listed as adjustments; unconstrained fixtures keep their exact eye radius |
| Portrait framing | Every fixture at 260 × 140 and 600 × 330, fitted and shared-scale: no sampled silhouette point outside the canvas; shared scale keeps a 1.6 vs 0.7 body length ratio visible |
| Picking | Tank pose inverse round-trips; body centre and caudal fin hit; a point two body lengths away misses; the top-most overlapping fish wins |
| Marking blocks | Anchors use only loci 18–29, are unchanged when maternal and paternal arrays swap, merge a homozygous block into one anchor, and change exactly one anchor when a block allele mutates |
| Marking transmission | 400 mutation-free children: more than 85% of anchors match a parental block haplotype (0.12 internal crossover predicts about 88%) |
| Marking placement | Deterministic and finite; body coordinates in range; a different birth seed moves a patch by at most 0.06 along and 0.16 across the body |
| Pattern resemblance | 24 × 10 seeded families: inherited sibling separation above 68% and at least 15 points above independent placement (which stays below 58%); parent separation above 66%; FS-101 cohorts above 75% versus independent below 60% |
| Resemblance metrics | Jaccard overlap and rank separation reference cases, including ties and empty masks |
| Collection preferences | Valid preferences round-trip; duplicate and unknown favorites are dropped; missing, malformed, future-version, unknown-descriptor, unknown-sort and non-ID favorites fall back to defaults; the storage key differs from the world save |
| Collection ordering | Newest, oldest, name and goal (higher and lower) orders; goal values equal normalized descriptors; a goal sort without a goal falls back to newest; input not mutated |
| Cohorts and goal leaders | Offspring grouped by parent pair, newest cohort first; leaders are the best living female and male for the goal; a sold leader is replaced |
| Selection experiment | Default configuration: gate passes (at least 3 traits beyond the founders' 10th–90th percentile in at least 75% of 8 selected lines); every trait's selected shift exceeds random mating by more than 25 points; random lines beyond the range at most 3 of 8; all generation-10 anatomy valid; pedigree F above 0.5 and heterozygosity lower after selection; tail-selected lines end slower than at generation 0 and than random lines; deterministic |
| Resemblance study kit | 12 fixed trials, 4 per mode, both answers used; every sibling allele within one mutation step of the answer pair; silhouette mode keeps morphology and hides pigment and markings; markings mode keeps markings on identical bodies; computational observer above 90% (silhouette) and 75% (markings) over 150 trials; per-mode scoring, Wilson intervals and stored-result validation |
| Appearance (FS-113) | For 300 seeds, genome v1 loci, mutations and non-appearance phenotype are identical under genome v2. Chromosomes 9–10 transmit from the parent homologs. Dominance, blends, carrier and mixed strengths, recessive scales and rainbow dots are independent of phase. Founder weights sum to 1; 10,000 founders show a new feature in 20–34% of cases, with striking variants under 1%. Rarity descriptions are checked. Mixed v1/v2 saves round-trip, and wrong genome shapes reject. A legacy breed/buy journal replays as genome v1, and an explicit v1 child of v2 parents rejects. Ornament geometry is finite, bounded and deterministic |
| Water model (FS-301) | Zero load keeps clean water saturated, and depleted oxygen recovers monotonically. Overload raises ammonia every day, drives oxygen critical and records unmet demand. Two 50% changes plus a typical load return good, clean water. Every fixture balances oxygen, ammonia and food against its ledger within 1e-7 relative, with nothing negative. Split intervals match a single integration exactly. Food decays into ammonia and oxygen demand. Inputs stay unmutated, and invalid time, food and water changes reject. Habitat load counts living residents and matches `express`. Every tank, empty ones included, advances. Replay reproduces saved water and rejects tampering. Fine and coarse advances agree. A world v1 runtime migrates with a rebased checkpoint, and invalid water rejects |
| Life stages (FS-302) | Environment curves give 1 when healthy, 0.475 hypoxic, 0.5 at high ammonia and 0.667 crowded, with limits listed most severe first. A healthy egg hatches on day 3 and becomes an adult within 18–30 game days through fry and juvenile, never shrinking or passing its potential. At day 30 the same genome ranks healthy > crowded > ammonia > hypoxic. Condition lags the environment in both directions, and growth resumes after recovery. In the world, eggs hatch at the day boundary, biomass rises, founders only age, splits and replay agree, and tampered length rejects. Eggs cannot be sold, batch-sold or bred, atomically. World v2 saves and runtimes migrate as young adults, and invalid life state rejects. Goal leaders are never eggs |

| Stage appearance (FS-306) | Maturity is 0 for eggs and hatchlings, 1 for stock adults (which draw the identical phenotype object) and rises monotonically. Hatchling proportions and pigment interpolate as declared while genetic, life-history, behavior values and marking anchors stay identical. Fixtures and 600 founders at four maturities keep valid anatomy and unclipped portraits. Ornament is empty before pigment and equals the adult's at full maturity. Continuous facing round-trips and stays pickable edge-on. The reveal series progresses egg → fry → juvenile with pigment complete by day 16 |
| Care (FS-305) | Rations from Off to Heavy order fed share, uneaten food and ammonia as declared, never feed beyond need, and balance food, ammonia and oxygen within 1e-7. Rations and temperature change development directionally; extra food gives identical growth. The thermostat reaches its target without overshoot. Splits, single-tick advances, offline catch-up and replay agree, and tampered care rejects. Upgrades, downgrades, water changes and feeding charge or reject atomically. A stressed tank's warnings, applied in rounds, clear every warning, and each projection equals the applied result. World v3 migrates with default care |

These statistical checks use fixed seeds and wide tolerances to catch implementation regressions. They do not establish biological validity or rigorous randomness certification.

## 3. Browser verification performed

The agent-browser CLI was not installed, so the connected Codex browser was used instead.

- Opened local app and inspected the actual Canvas aquarium and portrait.
- Confirmed no blank page or runtime error overlay.
- Read captured console warnings/errors: none observed.
- Bred founders Haru and Sumi: residents increased from 6 to 26; selected offspring had parent links and G1.
- Renamed FSH-000007 to Ember; transferred to Breeding Studio.
- Opened Family and selected Haru: inspector focused Haru and aquarium changed to The Koi Garden.
- Sold Haru to local NPC through the review step; archived profile retained genotype and facts.
- Reloaded: tank counts remained 24 in garden and 1 in studio; Ember’s renamed record was still in the studio.
- Checked responsive viewport at 390 × 844; document width did not exceed viewport; aquarium and core controls remained visible. Horizontal tank-selector scrolling is intentional.

This is a representative smoke check. Export download, every genome cell, every browser engine, screen-reader behavior, and complete text-zoom accessibility have not been exhaustively verified.

### FS-101 visual fixture verification

- Opened **Visual fixtures** from the local lab without changing the device-local world (24 residents in The Koi Garden, 1 in Breeding Studio, 1,276 credits remained visible on return).
- Confirmed six founders, two 20-child contact sheets, descriptor tables, and six extreme cases render as Canvas portraits.
- Confirmed the default desktop viewport and 390 × 844 viewport had no horizontal overflow; 56 fixture canvases and no Vite error overlay were present.
- Captured no browser `warn` or `error` logs.
- Confirmed the report explicitly labels independent patch placement as a limitation and does not claim the M1 resemblance gate has passed.

### FS-102 anatomy verification

Environment: local Vite dev server, in-app Chromium browser pane.

- **Visual fixtures** reports genome v1 → development v1 → anatomy v2 → renderer v2 and shows "0 / 858 anatomy failures".
- Six stress cards render with listed adjustments: shallow body with large high eyes (moved 0.04 BL, radius 0.060 → 0.036 BL), stub fork (moved 0.02 BL). The needle FS-101 extreme lists a 0.02 BL move.
- The comparison table lists renderer v1 rule failures (286 eye, 122 dorsal root, 858 pectoral root, 107 gill, 84 mouth, 243 tail ray, 26 portrait clip) against 0 for anatomy v2.
- A clean reload followed by opening the surface added no console errors. The errors seen earlier were Fast Refresh warnings about a hook dependency list changing length while editing a mounted component; they did not recur on a fresh load.
- **Shared scale** and **Fit each fish** are keyboard-reachable toggle buttons that expose `aria-pressed`.

### FS-108 / FS-109 collection verification

Environment: local Vite dev server, in-app Chromium browser pane, the pane's own device-local world (not a user save).

- Bred Haru × Sumi: collection 26, 26 batch checkboxes. Computed sex symbol colours were pink `rgb(255, 140, 198)` and blue `rgb(109, 185, 255)` at 21.6 px. Father options read "♂ Sumi · G0" and similar.
- Ticked Fry 7, then shift-ticked Fry 11: exactly Fry 7–11 were checked; summary "5 selected · ◈ 401".
- **Review sale of 5** listed each name, ID, generation and quote under "Sell 5 fish to the local NPC for ◈ 401?".
- **Confirm sale of 5**: credits 1,200 → 1,601, collection 26 → 21, sidebar "21 / 60 fish", selection cleared, review closed, and the status line reported the sale.
- **View archive** listed Fry 7–11 with no checkboxes or batch bar.
- At 375 × 812: document width 375 (no overflow), checkbox rows 40 px tall, inspector title shows "♀ Female".
- Console error count did not change during the journey.
- The aquarium's animation loop prevents the pane's screenshot tool from settling. For one visual check, `requestAnimationFrame` was stubbed from the console and the page was reloaded afterwards; no source was changed.

### FS-103 inherited marking verification

Environment: local Vite dev server, in-app Chromium browser pane.

- **Visual fixtures** header reads "development v2 · anatomy v2 · renderer v3"; the summary shows "73% sibling marking separation".
- **Inherited marking structure** tables match the Node test run: sibling overlap 21% → 42%, unrelated child overlap 19% → 29%, sibling separation 52% → 73%, parent separation 53% → 72%; FS-101 cohorts 51% → 82%.
- Opening the surface added no console errors.

### FS-110 sex filter verification

Environment: local Vite dev server, in-app Chromium browser pane, the pane's own device-local world (21 residents after the FS-109 check).

- The filter group read "All 21 · ♀ Females 9 · ♂ Males 12", with **All** pressed (`aria-pressed="true"`).
- One fish was ticked (1 selected), then **Females** was pressed: heading "Your collection 9", every card female, and the selection cleared to 0.
- **Males**: heading 12, every card male.
- **View archive** kept the Males filter: "Archived fish 1", counts All 5 · Females 4 · Males 1, and the card was male.
- **Show residents** then **All** restored 21 fish.
- Typecheck and 32 tests passed. One console error, `sexFilter is not defined`, came from Fast Refresh loading an intermediate edit; after a fresh reload the error count did not change.

### FS-104 goal, favorites and cohort verification

Environment: local Vite dev server, in-app Chromium browser pane, the pane's own device-local world.

- **Breeding goal → Tail length** switched **Sort** to the goal, labelled the first cards "G0 · #1", "#2", "#3", and ordered the 21 goal chips from 49% down to 6%.
- Goal leaders read "♀ Kohaku 49%" and "♂ Momo 35%". Choosing Kohaku set the mother picker to "♀ Kohaku · G0 · 49%"; the goal stayed "tail" and the notice read "Kohaku selected as mother. Your breeding goal is unchanged."
- Starring the first two cards gave "★ Favorites 2"; pressing it showed "Your collection 2".
- **Parents → Haru × Sumi · 15** showed 15 fish and pinned Haru ("Mother · G0 · Tail length 15%") and Sumi ("Father · G0 · Tail length 23%").
- `fishtank-sim.lab.v1.preferences` held `{ version: 1, goal: tail/higher, sort: goal, favorites: [FSH-000003, FSH-000006] }`.
- After reload: goal, **Higher ↑**, goal sort and both stars persisted; the Parents filter and parent pickers had reset.
- **Breed** (Haru × Sumi after the reset) switched the Parents filter to "Haru × Sumi · 35", kept the goal sort, and pinned both parents. The notice then said "new cohort" although the view held all of the pair's offspring; the wording was corrected to "Showing all offspring of … × …".
- Production build passed; console error count did not change.

### FS-105 research surfaces verification

Environment: local Vite dev server, in-app Chromium browser pane.

- Header navigation read "Aquarium (current) · Visual fixtures · Research". **Research** opened the resemblance study.
- Trial 1 of 12 was **Full appearance**, with 4 sibling canvases and 4 parent canvases labelled "Sibling 1–4", "Pair A mother/father" and "Pair B mother/father" (no answer leaked), plus the buttons "Pair A are the parents" and "Pair B are the parents".
- Typing the cue "tail shape" and choosing Pair A advanced to Trial 2 (**Silhouette only**) and stored `{ trialId: trial-1, choice: 0, cue: "tail shape", ms: 690 }` under `fishtank-sim.study.v1`. **Undo last answer** returned to Trial 1 with 0 stored answers.
- Scripted alternating answers to all 12 trials reached "Your resemblance results", with per-mode rows and Wilson intervals beside the computational observer (4/4 in each mode), and a textarea record that parsed with 12 answers. These answers are not data; **Start again** cleared them (0 stored).
- **Selection experiment → Run experiment** finished in 882 ms: "6 / 6 traits beyond typical range", "Passed gate (needs 3)", "0 invalid anatomies in generation 10", "0.80 mean pedigree F after selection". Six trend cards drew selected and random curves, and the outcome table matched the Node results.
- Console error count did not change.

### FS-106 keyboard, text and touch verification

Environment: in-app Chromium pane. Desktop checks used an emulated 1280 × 800 viewport; phone checks used the mobile preset (375 × 812, where `pointer: coarse` matched). "200% text" doubles the root font size, which scales every rem-based size.

**Audit before fixes:**

- **Keyboard:** 162 tab stops, 153 of them before the first inspector control.
- **Touch targets under 44 px:** favorite stars 32 px, many buttons 36 px, selects and filter pills 40 px, checkboxes 18 px (inside 40 px label rows), footer link 15 px.
- **200% text:** the fixed 86 px header overflowed by 18 px, trait labels clipped ("Sociability" 111 px in an 85 px column), and the page overflowed horizontally.

**After fixes:**

- The first two tab stops are "Skip to collection" and "Skip to inspector".
- Activating a card by keyboard (`click` with `detail` 0) selected Fry 13 and focused the inspector heading "Fry 13". A pointer click (`detail` 1) on another card left focus on that card.
- "↩ Collection" returned focus to the selected card (`#card-FSH-000020`).
- Family → Haru focused the heading "Haru" instead of dropping focus when the relative button unmounted.
- Rename by keyboard (form submit) reported "Fish name updated."; the original name was restored afterwards.
- Breed by keyboard: the Breeding Studio tank button, then the focused **Breed 20 offspring** button, went from "0 / 60 fish" to "20 / 60 fish". Focus stayed on the button, and the status read "20 offspring born … Showing all offspring of Haru × Sumi, ranked by tail length."
- 200% text at 1280 × 800: the header grew to 151 px with nothing spilling out; no trait, genome, fact, tab, tank or card text clipped on the Overview, Genome or Family tabs; document width 1,265 px (no horizontal overflow) once the inspector tabs could wrap.
- Phone preset: 0 visible buttons, selects, links or checkbox rows smaller than 44 × 44 px; no horizontal document overflow at normal or doubled text. The tank selector scrolls horizontally by design.
- Strict typecheck, tests and production build passed. Console error count did not change.

### M1 continuation and M2 foundation verification

**Commands:** `npm run check` (53 tests, strict TypeScript and production build passed); `node scripts/verify-m2.cjs` against the existing Vite server. The browser script uses `PLAYWRIGHT_MODULE` if Playwright is provided by a host bundle; otherwise it resolves an installed `playwright`. Set `FISHTANK_URL` to change the default `http://127.0.0.1:5173`. It creates fresh Chrome contexts and dedicated QA databases, never a persistent user browser profile. No dependency or lockfile change was required.

- Core: 250 exact comparisons with the previous matrix on a seeded 300-record inbred pedigree; deep 300-generation and 10,000-record ancestry queries; living/record limits with atomic rejection; v1 migration preserves records; duplicate breed/sale commands never repeat effects; stale, conflicting, wrong-world and backwards-time commands reject; mixed rename/move/breed replay agrees; event/snapshot tampering rejects; compacted old IDs stay stale.
- Browser: keyboard selection focuses the inspector, rename/breed/family navigation succeeds, and reload retains the renamed ancestor and 26 fish. Existing FS-106 focus/text/touch fixes are included in this release.
- IndexedDB rotation produced current **Name 2**, previous **Name 1**, older **Name 0**. Injected transaction abort and `QuotaExceededError` during current write left all slots byte-for-byte unchanged; stale token rejection also left all slots unchanged. Quota was fault-injected, not measured by filling the user's disk. A live autosave failure showed a persistent warning, and **Retry save now** saved the in-memory world successfully after storage recovered.
- A 10,000-record fixture round-tripped through IndexedDB and replay validation in **755 ms**; compact runtime JSON was **9,038,071 characters** (current world plus checkpoint). Exact sibling kinship was **0.25** in **1.8 ms**. These are one-run observations, not production performance guarantees; pathological pedigree cost and main-thread save work remain risks.
- Reviewed import of that large fixture worked; archive next-page navigation kept **60 cards** rendered and ancestor family navigation kept **60 offspring rows** rendered. Restoring backup1 through the same preview/replacement flow returned to the original 26-fish world and ancestor name.
- Malformed JSON and future schema imports rejected without a replacement button. Legacy v1 migration retained the exact raw localStorage value. An injected unsupported IndexedDB current snapshot remained untouched after reload, with a persistent recovery warning.
- Desktop 1440 px and mobile 375 × 812: no horizontal overflow with 200% root text, including genome and save views; measured mobile button/select/link/file targets at least 44 × 44 px; no page errors. The save status was moved out of the hidden mobile sidebar.
- Reproduction writes local artifacts under ignored `.artifacts/`: `m2-browser-evidence.json` and `m2-mobile.png`. The human study was not answered or counted as evidence.

Limitations from that foundation run were addressed by FS-202/205/206 below. Physical power-loss and Firefox/WebKit recovery remain untested. Exports contain world/replay data; collection preferences remain device-local.

### FS-202/205/206 runtime completion verification

**Commands:** `npm run check`; `node scripts/verify-runtime.cjs` against the local Vite server, with the same optional `PLAYWRIGHT_MODULE` and `FISHTANK_URL` environment variables as the earlier browser script.

- Worker lifecycle: React StrictMode plus three Research → Return to aquarium remounts created 8 workers, terminated 7 and left exactly 1 active. Cleanup sends shutdown and calls terminate.
- Recovery: an injected development diagnostic fault restarted once automatically. A second fault displayed “Aquarium motion is paused” and a **Restart aquarium motion** action; activating it recovered. No fish/world command is processed by this worker.
- Workload: 200 synthetic fish × 100 all-pairs motion steps took **89.9 ms** inside the worker. A main-thread click scheduled during that work ran with **1.9 ms** added delay, below the 100 ms acceptance threshold.
- Time: exact fine/coarse integration matched at tick 10,000 for both tanks. Bounded segments split at declared ticks with no gap or overlap. A nine-hour elapsed interval applied exactly **576,000 ticks** (eight hours at 20 Hz) and reported the remainder; a timestamp one hour ahead applied zero.
- Writer ownership: a second same-origin tab loaded the current world with a read-only warning. Rename submission was rejected at the domain/UI boundary. After closing the writer, **Reload and try to take control** acquired the lock, and the rejected draft was absent.
- No page errors. The final viewport screenshot and structured measurements are ignored artifacts at `.artifacts/m2-runtime.png` and `.artifacts/m2-runtime-evidence.json`.

The worker benchmark isolates simulation responsiveness; it is not a 200-fish Canvas frame-rate claim. Save serialization and validation remain on the main thread. Offline time currently advances a clock only, because water, care and life-history state begin in M3.

### M2 completion review and fixes

**Commands:** `npm run check` (63 tests, strict TypeScript and production build passed). Playwright was not installed in this environment, so `scripts/verify-runtime.cjs` was not rerun. The same journeys ran in the in-app Chromium 152 browser pane against the local Vite server, in the pane's own QA world.

A review before push found and fixed three problems:

1. **New fish were invisible in the open tank.** The worker received the new entity IDs, but the canvas dropped every ID without an existing actor. Reproduced: breeding 20 into the visible Breeding Studio raised the count tag to 40 while the canvas still drew 20, and the selected fry had no outline. After the fix, breeding again took the tank from 40 to 60 fish on screen without a reload, and the selected new fish (Fry 87) showed its dashed outline and name label.
2. **Hidden pages kept stepping motion.** The worker port had dropped the earlier `document.hidden` pause. A wrapped `Worker` counted 21 frames per second while visible, 0 while hidden and 20 after becoming visible again.
3. **30-second clock checkpoints stalled large worlds.** A 10,000-record runtime (9,038,140 characters) took 48 ms to serialize and 412–490 ms per `decodeRuntime`. Each commit validates the new, current and backup snapshots, about 1.3 s of main-thread work. Idle checkpoints now run every five minutes (ADR-031), and commands still save immediately. The offline notice now reports minutes instead of thousands of seconds.

Re-verification:

- Worker lifecycle: three Research → Return to aquarium round trips created 6 workers and terminated 6 (StrictMode mounts twice in development); one remained active.
- Faults: the first injected fault restarted automatically. The second showed "Aquarium motion is paused. Requested diagnostic worker fault." with **Restart aquarium motion**, and restarting resumed 20 frames per second. Totals stayed balanced at 8 created and 8 terminated.
- Writer lock: a second tab loaded read-only; a rename was refused with "This tab is read-only"; Saves showed the writer-lock notice and **Reload and try to take control**. After the writer tab closed, that button made the second tab the writer ("Saved on this device"), and the refused draft was absent.
- Offline: a `savedAt` nine hours old added exactly 576,000 ticks (191,933 → 767,933) with "8 hours of protected research time restored; the eight-hour offline cap was reached." Forty-five minutes added 54,001 ticks with "45 minutes of protected research time restored." A timestamp one hour ahead added zero ticks and no notice; `savedAt` was then reset to the current time.
- No console errors were recorded.

### FS-111 five-observer pool

The user supplied five anonymous complete `study-v1-12x4` result records; the first was already pooled. `poolObserverRecords` validated unique observer IDs and all 12 unique trial IDs per record, then recomputed **54/60 overall**: full appearance 19/20 (Wilson 95% 76.4–99.1%), silhouette 20/20 (83.9–100%), markings 15/20 (53.1–88.8%), overall 90% (79.9–95.3%). Every mode's lower bound is above 50% chance. Per-trial agreement: ten trials 5/5, trial-7 (full) 4/5, trial-9 (markings) 0/5. Submitted score summaries matched the recomputed values. Response times were retained; no cue notes were present. `tests/resemblancePool.test.ts` pins the pool; details are in [FS-111 human resemblance](research/FS-111-HUMAN-RESEMBLANCE.md).

### FS-113 appearance genetics verification

**Commands:** `npm run check` (72 tests, strict TypeScript and production build passed); `node scripts/check-docs.mjs`. Browser: in-app Chromium 152 against `npm run dev -- --port 5173 --strictPort`.

- The FS-101 founder, cohort and extreme checksum pins pass unchanged, as do the FS-103 pattern thresholds, the FS-105 selection and resemblance tests, and the FS-111 pool.
- **Visual fixtures → Appearance variants:** 15 cards with 15 portraits. A contact sheet showed every body motif, color variant, scale type and fin pattern listed in the [FS-113 report](research/FS-113-APPEARANCE-GENETICS.md#browser-verification). The founder table read 26.6% with at least one new feature; striking variants ran 0.12–0.60%, and strong shimmer 0.00%.
- **Regression found and fixed before push:** an existing QA world with genome v1 fish opened in recovery mode with "Save snapshot does not agree with its replay journal". Its breed/buy journal entries were replaying under genome v2. After adding `genomeVersion` to those commands (legacy entries replay as v1), the same world loaded and saved.
- **Existing world after the fix:**
  - Haru showed "Appearance · genome v1" with every trait classic, and the Genome tab marked chromosomes 09–10 "not carried by genome v1" (12 loci).
  - Four purchased Newcomers were genome v2. Newcomer 110 showed a slate and lavender blended body labeled very rare, with the founder-stock note.
  - After the purchases the world autosaved and reloaded without a replay warning, and no console errors were recorded.
- **Not verified:** frame timing for a full tank of ornamented fish, human perception of the new motifs, and screen-reader review of the Appearance block.

### FS-301 water model verification

**Commands:** `npm run check` (84 tests, strict TypeScript and production build passed); `node scripts/check-docs.mjs`. Browser: in-app Chromium 152 against the local Vite server.

- **Existing QA world** (world v1 snapshot and legacy journal): loaded without a replay warning. The Koi Garden (45 fish, 158 kg) showed "Oxygen good" (6.4 mg/L), "Ammonia clean" (0.21 mg N/L) and "Stocking moderate". The Breeding Studio (60 fish, 225 kg) showed "Oxygen low" (5.5 mg/L), "Ammonia clean" (0.39 mg N/L) and "Stocking heavy".
- **Saved water:** two plant toggles saved world v2 in both the snapshot and the checkpoint, with water and two journal events. After a reload the world replayed without a warning.
- **Offline catch-up:** a saved timestamp two hours old applied 144,002 ticks with "2 hours of protected research time restored. Tank water kept changing; fish growth and health are not simulated yet." The water saved at steady state (6.385 / 0.210 and 5.492 / 0.389).
- **Newer world:** a world created before FS-301 (6 founders, 16 kg) loaded with "Oxygen good" (8.4 mg/L), "Ammonia clean" (0.01 mg N/L) and "Stocking light".
- **Found and fixed:** a hot-reloaded tab still holding a pre-water world threw "Cannot read properties of undefined (reading 'volumeL')" in the readout. The readout now skips a tank without water; freshly loaded pages rendered normally.
- **Not verified:** water effects on fish (none exist), care controls (FS-305), and long real-time sessions beyond the five-minute clock checkpoint.

### FS-302 life stages verification

**Commands:** `npm run check` (91 tests, strict TypeScript and production build passed); `node scripts/check-docs.mjs`. Browser: in-app Chromium 152 against the local Vite server, in the pane's existing QA world saved as world v2. Older tests that sold or bred newborn cohorts now sell founders or hatch the eggs first, because eggs cannot be sold or bred.

- **Loading:** the world loaded without a replay warning. Cards read "Adult · 50 of 50 cm", and the inspector read "Life stage Adult · 61 of 61 cm · Age 36 game days · Condition 100%".
- **Breeding:** **＋ Add lab tank**, then breeding Haru × Sumi into Lineage Tank 3, showed "20 inhabitants", "Planted habitat · 20 eggs incubating", cards reading "Egg · hatches in 3 game days", and an inspector age of 0 game days. The saved snapshot was world v3 with 20 eggs.
- **12 minutes offline:** a `savedAt` 12 minutes old gave "12 minutes of protected research time restored. Tank water and fish development kept going; health is not simulated yet." All 20 were fry, for example "Fry · 4.1 of 65 cm" at 12 game days with 100% condition. A screenshot showed them drawn small, with the selected fry labeled.
- **25 more minutes offline:** all 20 were adults, for example "Adult · 63 of 65 cm" at 37 game days. The water read "Oxygen good" (7.7 mg/L), "Ammonia clean" (0.07 mg N/L) and "Stocking light" (70 kg).
- **Console:** tabs still holding a pre-life world during hot reload threw "Cannot read properties of undefined (reading 'lengthCm')". A newly opened tab loaded the same world with no console errors.
- **Not verified:** juvenile rendering (FS-306), feeding and nutrition (FS-305), health effects, and real-time hatching without an offline jump.

## FS-304 spatial steering and FS-403 prediction verification

14 September 2026, Windows, Node 24.11.1 / npm 11.6.2. `npm run check`: 111 tests in 18 files, strict TypeScript and production build passed. Ten new fixtures cover ordered spatial-query correctness, utility parity, candidate scaling, obstacle exclusion/tangent motion, exact Mendelian odds, mixed genomes, prediction determinism and unchanged future births. `node scripts/check-docs.mjs` and `git diff --check` passed. Full [evidence and limitations](research/FS-304-403-SPATIAL-AND-PREDICTION.md).

In-app Chromium on isolated port 5175: verified goal and parent changes update sampled adult ranges; exact base-color odds; habitat off/on; reload with saved world and goal; and narrow table layout at 375 × 812. Browser review found and fixed a squeezed Breed button by placing capacity feedback on a separate grid row (rechecked at 290 px button width). Breeding after preview produced one 20-egg cohort; reload retained 26 fish. No warning/error logs were reported. Rock exclusion and constant-density scaling are test evidence, not a claim of full silhouette collision or a production device benchmark. M3/M4 milestone gates remain open.

## FS-305 care controls verification

14 September 2026, Windows 11, Node 22.18.0 / npm 10.9.3. `npm run check`: 118 tests in 19 files, strict TypeScript and production build passed; `node scripts/check-docs.mjs` and `git diff --check` passed. In-app Chromium on the isolated origin `http://localhost:5176` (new QA world; the usual port 5173 world was not opened).

- Fresh garden: Oxygen good 8.4 mg/L, Ammonia clean 0.01 mg N/L, Fed 100%, 22.0 °C, no warnings. Heavy rations with a Strong filter previewed uneaten food 2 → 42 g and ◈ 250; applying moved credits 1,200 → 950. A 25% water change cost ◈ 5. The resulting leftovers warning's preview loaded Measured rations at no cost; **＋ Feed** reported the portion.
- Stress: Compact filter, Gentle aeration and 29 °C (no cost), 20 eggs bred into the garden, `savedAt` moved back 45 minutes. After reload: Oxygen critical 1.7 mg/L, Ammonia high 9.23 mg N/L, 29.0 °C, four warnings with priced fixes, Haru "Condition 16% · limited by ammonia, low oxygen, temperature".
- Recovery: a previewed fix (oxygen 1.5 → 7.1 mg/L, ammonia 14.25 → 4.52 over three days) applied for ◈ 250, and a 50% change for ◈ 10. After another 30 simulated minutes: Oxygen good 7.2, Ammonia clean 0.12, Fed 97%, no warnings, Haru 100%. No save or replay warning after either reload.
- 375 × 812 with coarse pointer: document width 375 px, projection table inside its panel, no care control under 44 px.
- Found and fixed: "26 fishs affected"; care warnings reused the save banner's `.warning` class; the resume notice still said health was not simulated; chip text lacked a space before values.
- No console or dev-server errors. Details: [FS-305 care controls](research/FS-305-CARE-CONTROLS.md).

## FS-306 juvenile reveal verification

14 September 2026, Windows 11, Node 22.18.0 / npm 10.9.3. `npm run check`: 124 tests in 20 files, strict TypeScript and production build passed; `node scripts/check-docs.mjs` and `git diff --check` passed. In-app Chromium on the isolated origin `http://localhost:5176`, continuing the FS-305 QA world.

- Eggs: 20 bred into the empty Breeding Studio read "0 swimming fish and 20 incubating eggs" on the canvas, "incubating egg, day 0 of 3" on cards and "NOW · EGG · HATCHES IN 3 GAME DAYS" in the inspector.
- After 8 simulated offline minutes: 20 swimming fry, cards such as "Fry 46, fry at 1.8 cm, current appearance".
- Views: the collection toggle relabeled cards as adult genetic potential, stored `portraits: "adult"` and survived a reload. The large portrait for Fry 46 switched between "ADULT GENETIC POTENTIAL · A PREVIEW, NOT HOW THIS FISH LOOKS TODAY" and "NOW · FRY · 2.2 OF 65 CM".
- Visual fixtures showed renderer v6 and the reveal strip: egg (day 0), fry at 0.6 cm (day 3), pigment 5% / 35% / 80% (days 6 / 9 / 12), juvenile with full pigment at 5.2 cm (day 16), juvenile at 30.1 cm with 95% body maturity (day 30).
- 375 × 812 with coarse pointer: no document overflow; the **Now** toggle measured 43 × 44 px, gained a coarse-pointer minimum width and rechecked at 44 × 44 px. All seven reveal portraits contained drawn pixels.
- One stale console error came from hot reload between two FS-305 edits and did not recur. Frame timing and screenshots were unavailable because the pane was hidden. Details: [FS-306 juvenile reveal](research/FS-306-JUVENILE-REVEAL.md).

## 4. Required next verification

### Visual inheritance / FS-101–107, FS-111

FS-111 pooled five observers (54/60). Before changing development v2 markings, a second seeded trial set with required cue notes should retest the markings channel, which every observer misread on trial-9. Screen-reader and cross-browser audits remain. The current keyboard/text/touch journeys passed. Do not assert a perceptual result from computational observers or allele counts.

### Runtime / M2

M2’s local Chrome gate passed. Later verification still needs physical process/power interruption, Firefox/WebKit, long-run worker memory, save serialization off the UI thread and biological active/background/offline parity after M3 state exists.

### Aquarium / M3–4

Care recovery, nutrition/waste integration, life stage thresholds, fry reveal, capacity reservations, same-tick hatch cancellation, interrupted courtship, listed/sold/dead parent eligibility, history retention and larger pedigree graphs.

### Solo release / M7

Named hardware/browser benchmark, long-run memory, 100-generation genetics/anatomy soak, 2,000 owned-fish background test, restore/migration matrix, keyboard-only journeys, contrast, touch, reduced motion and Firefox/Chromium/WebKit behavior.

### Online / M8

Two simultaneous buyers, duplicate command retries, rollback on debit/transfer failure, stale listing versions, funds/capacity limits, authorization, private lineage redaction, sandbox import isolation, clock manipulation and transaction audit.

## 5. Evidence format

For a test report record task ID, source/model version, command or user journey, fixture/seed, environment, expected outcome, actual outcome, limitations, and relevant artifacts. Tests should verify domain promises or meaningful failure conditions, not mirror implementation line for line.

## FS-303 and requested breeding/appearance improvements

13 September 2026. npm run check: 101 tests in 16 files, strict TypeScript and Vite production build passed. git diff --check passed. See [full evidence and limits](research/FS-303-BEHAVIOR-AND-BREEDING.md).

Browser: in-app Chromium, isolated port 5174 QA world. Verified compound targets, per-tank empty state, leader selection, categorical copy odds, favorite-safe sale including a favorite changed during review, persistence after reload, feeding state in inspector, appearance gallery and desktop/mobile planner (375 x 812, no horizontal overflow). The final fresh browser load had no console errors. A transient Vite hot-reload error occurred between two source edits and disappeared after both files were updated. The browser CLI and standalone Playwright were unavailable, so the in-app browser was used. Other FS-303 transitions are covered by deterministic scenario tests, not claimed as separately observed browser journeys. The normal port 5173 save was untouched.

## Breeding panel and inspector layout follow-up — DONE, pushed `c50e579`

13 September 2026. In-app Chromium on port 5174 verified the **Hide options** and **Open breeding options** control, including `aria-expanded` state and the compact closed summary. The desktop inspector remained at 16px from the viewport top after a 700px window scroll (`position: sticky`, bounded internal overflow). The fresh load had no console errors. The mobile breakpoint keeps the inspector in normal flow so it does not cover breeding and collection content.
