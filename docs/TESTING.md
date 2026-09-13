# Testing and verification

**Latest recorded run:** 13 September 2026 (FS-105), Windows 11, Node 22.18.0, npm 10.9.3. FS-101 runs used Node 24.11.1 and npm 11.6.2; FS-101 is pushed as `fe138d4`.

## 1. Commands

```sh
npm ci
npm test
npm run build
```

Vitest runs every `tests/*.test.ts` file: `core.test.ts`, `anatomy.test.ts`, `pattern.test.ts`, `collection.test.ts`, `selection.test.ts` and `resemblanceStudy.test.ts`. The build first type-checks all app and test TypeScript in strict mode, then creates dist/. The current suite has **44 tests**, and all passed. The production build passed.

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

## 4. Required next verification

### Visual inheritance / FS-101–107, FS-111

Human resemblance sessions (at least five observers through Research → Resemblance study), readability under 200% text, touch, and keyboard-only journeys. Do not assert a perceptual result from computational observers or allele counts.

### Runtime / M2

Worker start/stop/restart, strict-mode mount cleanup, command idempotency, timestamp boundaries, active/background integration comparison, negative/offline clocks, bounded catch-up, failed save transactions, quota and multi-tab writers.

### Aquarium / M3–4

Care recovery, nutrition/waste integration, life stage thresholds, fry reveal, capacity reservations, same-tick hatch cancellation, interrupted courtship, listed/sold/dead parent eligibility, history retention and larger pedigree graphs.

### Solo release / M7

Named hardware/browser benchmark, long-run memory, 100-generation genetics/anatomy soak, 2,000 owned-fish background test, restore/migration matrix, keyboard-only journeys, contrast, touch, reduced motion and Firefox/Chromium/WebKit behavior.

### Online / M8

Two simultaneous buyers, duplicate command retries, rollback on debit/transfer failure, stale listing versions, funds/capacity limits, authorization, private lineage redaction, sandbox import isolation, clock manipulation and transaction audit.

## 5. Evidence format

For a test report record task ID, source/model version, command or user journey, fixture/seed, environment, expected outcome, actual outcome, limitations, and relevant artifacts. Tests should verify domain promises or meaningful failure conditions, not mirror implementation line for line.
