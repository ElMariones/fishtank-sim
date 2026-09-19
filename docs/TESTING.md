# Testing and verification

**Latest recorded automated run:** FS-119, 19 September 2026, Windows 11: 281 tests in 44 files, strict TypeScript and the production build pass ([details](#fs-119-axolotl-shop-pricing-and-locus-notes)).

**Previous automated run:** independent axolotl species / world v13, 18 September 2026, macOS workspace. `npm run check` passes **271 tests in 43 files**, strict TypeScript and the Vite production build. Dedicated suites cover standalone genetics, 1,200 extreme renderer morphologies, mixed-tank deterministic simulation, both breeding modes, cross-species atomic rejection, v12→v13 migration, save/runtime determinism, mutation-locus persistence, koi-only recovery/bloodlines and species-aware planner/prediction boundaries.

**Previous recorded run:** truthful trait names (ADR-056), 15 September 2026, Windows 11, Node 22.18.0, in-app Chromium (Claude desktop browser pane) on isolated `localhost:5176`. 168 tests in 28 files and strict production build pass. The QA save named under model 2 loaded with no console errors and kept its names. An instant cross laid 20 eggs; for four of them the inspector confirmed the named trait: tiger stripes, dark fin tips, Boldness 10 and a classic orange accent on a blended body that no body color word names.

**Previous recorded run:** generated fish names (ADR-055), 15 September 2026, Windows 11, Node 22.18.0, in-app Chromium (Claude desktop browser pane) on isolated `localhost:5176`. 166 tests in 28 files and strict production build pass. A pre-change world v7 QA save, with no `naming` field, loaded after 217 offline game days with no console errors and kept its numbered names. A lab cross then laid 20 eggs with generated names (for example "Rocket", "Mussel the Just" and "Coastal Glacier of Reedholm"), and six shop listings delivered after the rebase showed generated names.

**Previous recorded run:** FS-502, 14 September 2026, Windows, Node 24.11.1, npm 11.6.2, Codex in-app Chromium on isolated `127.0.0.1:5178`. 162 tests in 27 files and strict production build pass. Shop purchases, reload persistence, ledger, filters, insufficient credits and 375 × 812 layout checked; both deferred research views loaded without browser warning/error logs. See [FS-502 evidence](research/FS-502-PERSISTENT-SHOP.md).

**Previous recorded run:** 14 September 2026 (FS-501 economy model v1, after M4), Windows 11, Node 22.18.0, npm 10.9.3, in-app Chromium (Claude desktop browser pane) on an isolated QA origin. Earlier: 13 September 2026 (FS-302 life stages, after FS-301, FS-113, the M2 completion review and the FS-111 five-observer pool), in-app Chromium 152.0.7977.76. The earlier FS-202/205/206 run used Node 24.11.1, npm 11.6.2 and Google Chrome 153.0.8010.36 via bundled Playwright. Browser checks use independent fixtures, fresh browser contexts or the browser pane's own QA world; no user lineage is reset.

## Latest verification — FS-504, 15 September 2026

`npm run check` passed: 186 tests in 31 files and the strict production build, on Windows 11 with Node 22.18.0 and npm 10.9.3. The non-failing main-chunk advisory remains (549.59 kB, gzip 175.84 kB).
- **`recovery.test.ts` (9 tests):**
  - the koi rescue, its refusals, its wait and replay, and world v8 migration;
  - a rescue-farming bound: 6 claims and ◈ 356 over 60 game days;
  - four hard recovery starts;
  - a 500-step softlock walk: 24 checks, each reaching an accepted pairing within 22 game days;
  - free care fixes and the recovery overview.
- **`onboarding.test.ts` (3 tests):** guide storage, step order, and a first session played through commands, with eggs hatched within 8 game days.
- **Browser (isolated port 5182):**
  - the full guide;
  - spending down to ◈ 0;
  - a rescue followed by a ready pairing;
  - 390 px layout;
  - no console errors.

  The pane's synthetic Enter key did not submit the rename form; the Save button did.

See [FS-504 evidence](research/FS-504-ONBOARDING-AND-RECOVERY.md).

## Previous verification — FS-503, 15 September 2026

`npm run check` passed: 174 tests in 29 files and strict production build, Windows/Node 24.11.1/npm 11.6.2. Six habitat fixtures and updated worker recovery/name migration coverage are included. The build has a non-failing main-chunk advisory (534.82 kB, gzip 171.10 kB). Browser QA at isolated port 5181 verified reviewed purchases, expansions, placement rejection, keyboard transforms, reload persistence, free edits/removal, low funds, fish transfer, reconciled ledger and 390 × 844 layout. Final browser warnings/errors: none captured. See [FS-503 full evidence and limitations](research/FS-503-HABITAT-EXPANSION.md).

## 1. Commands

```sh
npm ci
npm test
npm run build
```

Vitest runs every `tests/*.test.ts` / `tests/*.test.tsx` file. The M2 additions are `runtime.test.ts`, `time.test.ts`, `motionClient.test.ts` and `limits.test.ts`; `resemblancePool.test.ts` validates human records; `appearance.test.ts` covers genome v2 appearance (FS-113); `water.test.ts` covers the FS-301 water model; `development.test.ts` covers FS-302 life stages and growth; `care.test.ts` covers FS-305 care; `juvenile.test.ts` covers FS-306 stage appearance and turning poses; `absence.test.ts` covers the FS-307 day observer, unexplained-decline check, care scenarios and absence summary; `breeding.test.ts` covers FS-401/402 pairing, courtship, reservations and clutches; `genealogy.test.ts` covers the FS-404 ancestor graph, descendants, search and trail; `kinship.test.ts` covers the FS-405 kinship cache, founder assumptions and reference fixtures; `lifecycle.test.ts` covers FS-406 batch rehoming, clutch groups and the two-generation demonstration; `economy.test.ts` covers FS-501 offers, demand, the ledger, rehoming, legacy replay and the E-05 experiment. The build first type-checks all app and test TypeScript in strict mode, then creates dist/. `shop.test.ts` covers persistent listings, expiry, atomic purchase, migration and invalid metadata. `names.test.ts` covers ADR-056 truthful generated names. `recovery.test.ts` covers the FS-504 koi rescue, its wait, migration, farming bound, hard recovery starts, softlock walk and free care fixes; `onboarding.test.ts` covers first-session guide storage and steps. The current suite has **281 tests** in 44 files, and all passed. `axolotlShop.test.ts` covers the FS-119 axolotl shop, price model 2 and locus notes. The production build passed.

### FS-119 axolotl shop, pricing and locus notes

19 September 2026, Windows 11, in-app Chromium (Claude desktop browser pane) on `localhost:5173`. `npm test`: **281 tests in 44 files** pass; strict TypeScript and the Vite production build pass.

- `axolotlShop.test.ts` (10): 240 generated listings validate, carry the right price, note and single hidden copy, and never resell above the founder cap; koi stock is unchanged; purchase is atomic and round-trips; stock refreshes on the koi rhythm and replays; edited prices, carriers and IDs reject; v13 saves and runtimes migrate and rebuild stock from their replay; model 2 keeps pond keepers away and admits only axolotls of 20 cm or less to the miniature keeper while model 1 keeps its recorded prices; every koi and axolotl locus has a note; hidden carriers and recorded-only traits are reported.
- Updated: `speciesBoundaries.test.ts` expects the species-normalized axolotl tail; `axolotlIntegration.test.ts` expects the current world version after v12 migration.
- **Browser journey:** the existing dev save (world v13) loaded after migration without recovery mode. NPC shop → Axolotls showed 4 of 4 listings (one ◈ 250 founder, three ◈ 440 recessive morphs, each resale ◈ 150 or less). Buying AX-000003 delivered Poppyseed of the Moss to The Koi Garden, selected it and saved. The Overview showed worded axolotl traits with three recorded-only markers; the Genome tab rendered 66 locus notes, and hovering Leucistic pathway showed its note beside the grid. A koi's Genome tab also rendered 66 notes. After clean reloads the console held only one error, raised once by a hot reload over the pre-migration in-memory world.

### Independent axolotl species / world v13

18 September 2026. `npm run check`: **271 tests in 43 files** pass; strict TypeScript and Vite production build pass. The existing main-bundle size advisory remains non-failing.

- `axolotlGenetics.test.ts` (18): founder determinism/distributions, rare recessive reachability, linked meiosis/crossover, mutation overrides, no `Math.random`, phase-invariant expression, morphology extremes, pigment interactions, pattern/color/texture, simulation potentials and descriptor/validation contracts.
- `axolotlRendering.test.ts` (6): recognizable side-profile anatomy, independent morphology channels, malformed-input sanitization, 1,200 seeded binary-extreme morphologies finite/bounded, direct nested phenotype adapter and deterministic Canvas command stream.
- `axolotlIntegration.test.ts` (11): deterministic purchases/names/genomes, mixed koi+axolotl simulation, ax×ax instant and normal breeding, cross-species rejection without world mutation, v13 save roundtrip, v12→v13 koi migration, species/genome validation, runtime replay determinism, ax mutation `locusId` preservation/recovery and unchanged koi mutation serialization.
- `speciesBoundaries.test.ts` (4): koi rescue ignores axolotl sex/partners, koi bloodline registration/summaries never interpret axolotl genomes, mutation notebook dispatches axolotl labels/origins correctly, and economy traits branch by species.
- `speciesBreedingPlanner.test.tsx` (7): same-species candidate filtering, koi goal leaders exclude axolotls, ax pairs never enter koi prediction, mixed pairs render safely, stale cross-species selected partners are not kept as candidate options, koi prediction helpers reject ax genomes, and normal courtship visibly blocks a mixed pair.
- All pre-existing koi tests remain green, including frozen seeded outputs/fixtures, registry migration, truthful names, structure anatomy, economy, origins, bloodlines, runtime replay and unusual-line demonstration.
- **Browser journey:** isolated Vite port 5190 with a fresh headless-Chrome profile. The live tank initially showed six koi. The NPC shop exposed the independent axolotl founder, and two purchases joined the same koi tank as a male and female axolotl with species-specific generated names. The inspector showed the axolotl phenotype blocks and all 11 chromosomes / 66 loci. Breeding → Axolotl listed only those two axolotls as parents, reported a ready normal courtship, rendered the species-specific 256-offspring range/morph preview, and contained no koi exact-locus odds. A cache-bypassing page reload completed with no DevTools page exceptions or error-level log entries.

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

| Economy model v1 (FS-501) | Across 600 founders plus uniform extremes, every offer's terms sum to its amount, founder offers stay within ◈ 1–150, and all five buyers are reachable. Bred fish earn a capped bonus within the buyer's budget; eggs have no offer, fry only the pet shop's, and stage and condition lower offers. Sales use up demand in order: a batch pays exactly its plan and equals single sales, a batch with any unwanted fish is refused unchanged, and demand recovers identically day by day or at once and replays. A 900-step walk keeps credits equal to the opening balance plus ledger totals with at most 100 entries, and tampered credits, demand or entry order are refused. Rehoming changes no credits and archives fish that can no longer be sold, moved or rehomed. Legacy sales keep the lab quote, and world v5 saves and runtimes migrate or rebase. E-05: resale loses at least ◈ 100 a cycle, cumulative income stays within the demand ceiling, and farming sells more fish for less |
| Batch rehoming and two generations (FS-406) | Ten eggs plus a fish already at the destination move in one command, changing only tank IDs. Duplicate, unknown and sold members, a missing tank, a batch already in place and an empty batch are refused without change. An arrival that would take reserved nursery places is refused while one that fits is accepted, and a `move-batch` journal replays. Two lab crosses of one pair form two clutch groups while the Parents cohort stays one group of 40; a normal clutch forms one group matching its record. The seeded demonstration issues no instant cross, hatches three clutches with the second generation last, rehomes 38 fish, keeps every bred fish in a clutch record and every tank within capacity, replays its save and repeats exactly |
| Kinship cache (FS-405) | Textbook values hold exactly in both argument orders and match the uncached function: self, parent–offspring, full and half siblings, grandparent, aunt or uncle, first, double first, half first and second cousins, and the offspring of full siblings. Inbreeding follows Wright's recurrence over 12 generations of full-sib mating and converges toward 0.5 under repeated backcrossing to one sire. Under unrelated founders, founders related at 0.1 and a 0.05 base population, 600 random pairs on a 300-record inbred pedigree with two records removed match the tabular relationship matrix within 1e-12; invalid assumptions reject. Founder listing through real commands names both founders and a bought newcomer, and reports a removed parent as missing (its siblings then read as half siblings). After 240 cached generations of sibling mating, the next generation computes at most 12 pairs, under a twentieth of a fresh cache, with an identical value. Renames and sales keep the cache; changed parents, a smaller record set or a duplicate ID rebuild it exactly; a 40-pair limit clears it and stays exact |
| Family graph (FS-404) | Half-sibling and backcross fixtures list each repeated ancestor once, with its positions, generations and child edges. On a 400-record inbred pedigree with three records removed, every fish at six generations and 120 random depths match an explicit position-by-position reference: recorded, unknown and missing counts, order, repeats, edges and continuation. A ten-generation line reaches its founders through two six-generation views. Sold and cross-tank relatives stay in the graph whatever the record order, and descendants are listed once at their nearest generation. On 10,000 records, the index, 50 six-generation graphs and a descendant walk finish within 500 ms with at most 126 ancestors. Search ranks IDs, digits, names and prefixes, eight at a time; the trail returns instead of looping and keeps 12 steps |
| Normal breeding (FS-401/402) | Each pairing blocker (roles, eggs and fry, condition, rest, separation, an existing courtship, a held, full or missing nursery) is refused with a message and fix and no change. Courtship progresses daily, records separation and harsh water without progress, then lays the reserved eggs with correct parents and dates, rests the parents and hatches on schedule. Nursery reservations refuse arrivals, and seeded random walks of 90 mixed commands never exceed capacity or the living limit, lay eggs and replay exactly. Reloads at eight points and offline catch-up lay each clutch once. Courting parents cannot be sold, only courtships can be cancelled, world v4 migrates, and inconsistent clutch records are rejected |
| Care demonstration and absence (FS-307) | The day observer leaves advanced worlds identical and reports every boundary. Across 12 random stocking, ration, equipment and thermostat combinations, every one of more than 100 fish-day condition declines had a named cause. The healthy scenario never warns or declines; the stressed scenario warns from day 1 while fish are above 90%, keeps oxygen above 3 mg/L, reaches its lowest condition no later than the first review, then clears every warning and returns above 95%, deterministically. An observed offline catch-up equals the plain one, and its per-tank summary reports hatching, growth, declines, causes and warnings; a capped quiet absence reports 480 quiet game days |
| Stage appearance (FS-306) | Maturity is 0 for eggs and hatchlings, 1 for stock adults (which draw the identical phenotype object) and rises monotonically. Hatchling proportions and pigment interpolate as declared while genetic, life-history, behavior values and marking anchors stay identical. Fixtures and 600 founders at four maturities keep valid anatomy and unclipped portraits. Ornament is empty before pigment and equals the adult's at full maturity. Continuous facing round-trips and stays pickable edge-on. The reveal series progresses egg → fry → juvenile with pigment complete by day 16 |
| Truthful names (ADR-056) | The neutral group holds at least 80 prefixes, 250 nouns and 120 suffixes, and shares no word with any trait group. 47 claim words, from "Golden", "Jade", "Tiger" and "Tigress" to "Queen", "Sir", "Tiny" and "Sleepy", appear only in groups that require their trait. Tags follow what is shown. One expressed body variant is named, while blends and hidden copies are not. Faint and full stripes both count. An accent is named only when drawn, and orange only in its hue range. Two-tone eyes are not named. Size, tendency and sex tags use their thresholds, and genome v1 fish get no appearance variant. Across 4,000 varied fish, every part of every name is supported by the fish's tags, every group is reached, and 45–70% of fish with a nameable trait get a trait part. 10,000 names against a taken set are distinct, deterministic, at most 32 characters and free of repeated words; without avoidance, over 97% of multi-part names are unique. The shop, a lab cross, bought stock, a listing, a delivery and a clutch get distinct generated names, and the world round-trips. A journal whose stored names differ is refused under the current model. Stored without `naming` or under models 1–2, it loads keeping those names and rebases onto model 3, then names later births truthfully and replays. Genome tampering is still refused. Pre-v7 records-only checks ignore names; tank ID tampering is refused |
| Koi rescue and no softlock (FS-504) | A world with no males and ◈ 100 receives one genome v2 adult male at no cost. It writes a ◈ 0 ledger entry, starts a 10-game-day wait, round-trips and can pair at once, and an empty world receives a pair. Both sexes present, enough credits for stock, a pending wait, a full or unknown tank and an invalid genome version are refused unchanged. The wait counts down identically split or whole and replays, and tampered or invented waits are refused. World v8 saves and runtimes migrate, with v8 decorations still proven by replay. A keeper farming rescues for 60 game days gets 6 claims and ◈ 356, at most ◈ 150 each. Using free actions only, an empty world, a pending rescue, an eggs-only world and a well-funded world without males all reach an accepted pairing. In a 500-step seeded walk, 24 checks all reached a pairing within 22 game days. Unaffordable care warnings name a free fix and none issues `add-tank` |
| First-session guide (FS-504) | Guide progress uses its own key, stays outside the world, orders and deduplicates steps, falls back on invalid or future data and starts hidden for worlds with a lineage. A first session through commands completes select, rename and feed from recorded actions, and court, hatch (a starred hatched offspring, not an egg) and goal from observed facts. The first eggs hatch within 8 game days, and completed steps stay complete after the kept fish is rehomed and the goal cleared |
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

## FS-307 care demonstration and absence verification

14 September 2026, Windows 11, Node 22.18.0 / npm 10.9.3. `npm run check`: 128 tests in 21 files, strict TypeScript and production build passed. In-app Chromium on the isolated origin `http://localhost:5176`, continuing the QA world.

- Return panel after 20 simulated offline minutes: "20 game days passed"; Breeding Studio "20 fish · 20 reached adulthood · Nothing limited these fish" with an **Open** button; one quiet tank; "Every condition decline had a named cause." No save warning. The live status line points to the panel instead of repeating the notice.
- Research → **Care scenarios**: healthy tank at 100% throughout with no reviews. Stressed tank 94% (day 1) → 59% (day 5) → 13% (day 15), oxygen 4.1–4.7 mg/L and never zero, ammonia up to 6.46 mg N/L; one review on day 16 (◈ 360) cleared every warning by day 18; 76% on day 20 and 100% from day 35. Zero of 675 fish-day declines lacked a named cause.
- Found and fixed: the first stressed setup crashed (oxygen 0.0 mg/L by day 1, lowest condition six days after the first fix) and was retuned from a six-candidate probe; a duplicated thermostat fix; the notice announced twice; "1 care reviews"; a semicolon inside one fix label made the joined list read as an extra fix.
- No new console errors. Details: [FS-307 care demonstration and absence](research/FS-307-CARE-DEMO-AND-ABSENCE.md).

## FS-501 economy model v1 verification

14 September 2026, Windows 11, Node 22.18.0 / npm 10.9.3. `npm run check`: 157 tests in 26 files, strict TypeScript and production build passed; `node scripts/check-docs.mjs` passed. In-app Chromium on the QA world (`http://localhost:5176`), saved as world v5 before this change.

- **Migration:** the save loaded as world v6 without warnings. **Buyers and ledger** showed full demand for all five buyers, opening balance ◈ 767 and no entries.
- **Offers:** Haru (founder) read "◈ 150 · Color collector" (base +40, trait interest 67% +133, founder resale limit −23). Fry 7 (generation 1) read "◈ 77 · Pond keeper" with a "Bred here, generation 1" +6 term.
- **Sales:**
  - Selling Fry 7 raised credits to ◈ 844, left the pond keeper wanting 3 of 4, and wrote ledger entry #1.
  - A batch of Fry 8–10 reviewed at ◈ 317 across two buyers and paid exactly that, taking credits to ◈ 1,161 and satisfying the color collector.
- **Rehoming:** rehoming Fry 11 kept credits at ◈ 1,161, wrote a ◈ 0 rehoming entry and archived the fish as "Rehomed · archived" beside four "Sold · archived".
- **Research → Economy experiment:** reproduced the E-05 table exactly, with six chart lines.
- **Phone, 375 × 812 coarse:** no page overflow, and none of the six checked market and offer controls was under 44 px.
- **Found and fixed before commit:**
  - The market panel said "latest 0 of 0 entries" on an empty ledger.
  - The first ledger test walk stalled before reaching the 100-entry limit.
  - On phones, the credits button lost its descriptive label and the panel had no side gutter.
- **Console:** no errors.

Details: [FS-501 economy model](research/FS-501-ECONOMY-MODEL.md).

## FS-406 two generations and batch rehoming verification

14 September 2026, Windows 11, Node 22.18.0 / npm 10.9.3. `npm run check`: 151 tests in 25 files, strict TypeScript and production build passed; `node scripts/check-docs.mjs` passed. In-app Chromium on the two isolated origins of the QA server.

- **Research → Two generations:**
  - **Summary:** 3 of 3 clutches hatched, the second generation on day 40, 0 instant lab crosses, 38 fish rehomed, and the save replayed from its journal.
  - **Clutches:** CL-000001 Haru × Sumi (laid day 3, hatched 6), CL-000002 Kohaku × Yuki (2, 5) and CL-000003 Fry 33 × Fry 24 (paired 34, laid 37, hatched 40).
  - **Capacity:** the fullest tank held 25 of 60 places.
  - **Phone width:** at 378 px there was no page overflow and the table scrolled in its wrapper.
- **Clutch selection and batch move (QA world):**
  - Breeding Studio's Haru × Sumi cohort offered two clutches (#47–66 and #27–46). Choosing #47–66 showed 20 fish and **Select all 20 in this clutch**.
  - The move review read "Move 20 fish from Breeding Studio to The Koi Garden?" and "35 free places; 15 remain after this move".
  - Confirming moved all 20 in one transfer (45/60 and 20/60) and offered **Open The Koi Garden**.
- **Second normal generation (QA world):**
  - **Pairing:** CL-000001 siblings Fry 61 × Fry 65 read ready, with expected pedigree F 25.0% and 2 founders.
  - **Laying:** after 4 simulated game days (protected offline catch-up after moving the stored save time back), the return summary read "20 eggs laid", with CL-000002 laid after 3 game days of courtship.
  - **Hatching:** after 4 more it read "20 eggs hatched".
  - **Show clutch:** it opened clutch #67–86 with Fry 67 (G2) selected.
  - **Family:** Fry 67 lists both parents, and grandparents Haru and sold Sumi each in 2 positions; pedigree F is 25.0%.
- **Observation:** the 45 adults in The Koi Garden were limited by crowding (mean condition 99% → 98%), a named cause. The move review checks places, not crowding.
- **Found and fixed before commit:** the demonstration's replay check compared key order instead of content.
- **Console:** no new errors.

Details: [FS-406 two generations](research/FS-406-TWO-GENERATIONS.md).

## FS-405 kinship cache verification

14 September 2026, Windows 11, Node 22.18.0 / npm 10.9.3. `npm run check`: 148 tests in 24 files, strict TypeScript and production build passed; `node scripts/check-docs.mjs` passed. In-app Chromium on the two isolated origins of the QA server, each fully reloaded.

- **QA world:** normal breeding for Haru × Sumi read "Expected pedigree F: 0.0%, from recorded ancestry; the 2 founders behind this pair are assumed unrelated and not inbred". Fry 31's Family note says its 0.0% assumes the 2 founders in its recorded ancestry are unrelated.
- **Deep lineage:** generation 9 siblings Tomo × Yori read an expected pedigree F of 85.4% with 2 founders assumed, and **Instant lab cross** showed the same 85.4%. After the cross, egg Fry 187 read pedigree inbreeding F 85.4%, the value shown beforehand.
- **Found and fixed before commit:** a fixture's wrong expectation for a grandchild whose father's record was removed (0.125 is correct and matches the tabular matrix).
- **Console:** a hot-reload intermediate logged "kinship is not defined" once per tab. The console keeps entries across reloads (a pre-reload marker stayed listed), and the count stayed at one through two reloads and later renders, so it did not recur.

Details: [FS-405 kinship cache](research/FS-405-KINSHIP-CACHE.md).

## FS-404 family graph verification

14 September 2026, Windows 11, Node 22.18.0 / npm 10.9.3. `npm run check`: 142 tests in 23 files, strict TypeScript and production build passed; `node scripts/check-docs.mjs` passed. In-app Chromium on two isolated origins of the QA server: `http://localhost:5176` (the continuing QA world) and `http://127.0.0.1:5176` (a generated deep lineage).

- **Cross-tank focus:** from founder Haru's 60 children, selecting Fry 31 focused its heading and brought Breeding Studio into view with the trail "Haru › Fry 31". Selecting Haru among its parents returned to The Koi Garden and cleared the trail.
- **Archived focus:** after Sumi was sold, Fry 31's parents listed her as "Sold · archived record". Selecting her showed **Last recorded**, her 60 children and no owner actions, and kept the aquarium in view.
- **Deep lineage:** nine lab-cross generations with sales and a backcross were built with real commands in the page, then imported through **Validate import** ("186 records · 40 living · 2 tanks") and **Replace world with reviewed import**.
  - Searching "Tomo" focused generation 9.
  - Six generations showed 126 of 126 positions and 13 ancestors, backcrossed Kai listed once "In 32 positions", sold Yuna archived, and "Earlier ancestors recorded" on Hana and Sora.
  - Selecting Hana continued to the founders, and her six descendant generations (20/40/20/20/20/20) switched and listed correctly.
- **Phone, 375 × 812 coarse:** no document overflow, and no control under 44 px after one fix (below).
- **Keyboard:** Shift+Tab reached the trail and inspector tabs. Enter and Space sent through the browser tool activated no focused button, including the existing Genome tab, so keyboard activation was not exercised.
- **Console:** no errors on either origin.
- **Found and fixed before commit:** the "Haru" breadcrumb measured 43 px wide on touch.

Details: [FS-404 family graph](research/FS-404-FAMILY-GRAPH.md).

## FS-401/402 normal breeding verification

14 September 2026, Windows 11, Node 22.18.0 / npm 10.9.3. `npm run check`: 134 tests in 22 files, strict TypeScript and production build passed; `node scripts/check-docs.mjs` passed. In-app Chromium on the isolated origin `http://localhost:5176`, continuing the QA world saved as world v4.

- The world v4 save loaded with no warning. **Normal breeding** was the default, and Haru × Sumi showed a ready line.
- Starting courtship reserved 20 places: Breeding Studio's free places went from 40 to 20. The pair then listed busy and nursery-reserved blockers with Start disabled, and the inspector read "Courting Sumi · 0%".
- Selling courting Haru was refused ("Haru is courting. Cancel the courtship before selling.") with nothing changed.
- Separating the pair showed a live pause reason. After 3 simulated game days, the return summary listed the paused courtship and progress stayed at 45%.
- Reunited, after 3 more game days: "20 eggs laid", clutch "Eggs incubating · 20 of 20", the reservation converted to residents, and rests of 7 and 3 game days. **Show clutch** opened the nursery filtered to the pair with the first egg selected.
- **Instant lab cross** hid the normal panel and labeled itself a research shortcut that skips the breeding checks.
- 375 × 812 with coarse pointer: no overflow; none of six new controls under 44 px.
- Found and fixed before commit: the migration's key order would have sent every older save to recovery mode, and the random reservation walk rarely paired adults.
- One hot-reload `cooldownDays` console error from before the page load did not recur through the journey. Details: [FS-401/402 breeding lifecycle](research/FS-401-402-BREEDING-LIFECYCLE.md).

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

## FS-118 tank switching

17 September 2026, Windows 11, Node 22.18.0. `npm test`: 225 tests in 38 files pass; `npm run build` passes (CSS 92.58 kB, 19.82 kB gzip).
- **Fixture:** a seeded save generated through domain commands (three tanks with 46, 60 and 60 living fish after 120 game days; Nature aquarium, Sunken ruins and Moonlit pond themes), loaded into isolated origins: `vite preview` on port 5190 and dev on 5176. The local dev save on 5173 was not used.
- **Production, before:** switching tanks blocked the main thread for 22–82 ms per task (three to four tasks per switch), measured with a MessageChannel probe; the canvas was not painting (hidden pane), so the worker restart and layer rebuild came on top. Dev mode showed about 450 ms per switch, mostly React 19 development overhead and three cascaded full renders.
- **Production, after:** longest block per switch 9–29 ms over five switches, the rail marking the new tank after 7–18 ms.
- **Renderer, dev tab, 733×413 at 1.5×, GPU-flushed:** first visit to a theme 12–106 ms (the highest includes drawing that substrate's grain tile once per session), a cached visit 8–15 ms, steady frames 5–8 ms; the old per-switch rebuild was 85–163 ms.
- **Behavior:** five rapid switches ended on the right tank with its 60 cards and a matching canvas label; all 60 portraits painted; the aquascape editor still opens and closes on a switch. The tank, collection and rail indicators were checked in screenshots and computed styles.
- **Limits:** the browser pane was hidden for most runs, so frame rates and the time until the tank veil clears were not measured; those run only with a visible page.

## FS-117 aquascape overhaul

17 September 2026, Windows 11, Node 22.18.0. `npm test`: 225 tests in 38 files pass; `npm run build` passes (CSS 89.95 kB, 19.37 kB gzip; main chunk 644.87 kB, 207.95 kB gzip).
- `tests/aquascape.test.ts`: every catalog piece settles into a valid layout at three sizes and four positions and passes the command schema; all nine themes build valid layouts and apply; a solid dropped into the no-gap zone slides to a valid spot while plants may overlap solids; catalog prices, free moves and reshapes, and charging a different piece under a reused ID; per-facet look costs with unchanged water, ledger agreement and atomic refusal; look and layout replay after time passes, tamper detection, and unstyled worlds decoding unchanged; catalog footprint radii reach steering.
- Existing FS-503 tests pass unchanged except one fixture: two rocks 0.05 apart now form an allowed cluster, so the unsafe-gap case uses 0.12 apart.
- **Browser (in-app Chromium, port 5173, the local dev save):** the default tanks render sand, deep backdrop, daylight rays and caustics with the original four pieces. All nine themes were previewed full-frame at 800×500 and every piece in a gallery; the review fixed a rainbow hue on red ludwigia, floating river stones, an invalid Sunken ruins layout, over-strong water caustics, stick-like forest branches, an oversized chest lid and undersized solids. A mouse drag moved a stone pile 0.3→0.39 and opened the toolbar; a drag that lost pointer capture could stay in drag mode, fixed with `lostpointercapture`. Adding a lantern and red ludwigia and choosing Golden hour and River pebbles showed ◈ 155 (75 pieces, 80 look); Apply left ◈ 1,045, and a reload restored the layout and look through replay validation. At 375 px the editor, tray and themes fit without horizontal page overflow.
- **Drag performance follow-up (ADR-067):** before, every drag step invalidated the whole cached layer, and repainting backdrop, substrate grains and all solids took 85 ms (Iwagumi), 163 ms (Nature aquarium) and 20 ms (Sunken ruins) per step with a GPU flush, plus a full app re-render. After, a complete frame while dragging a solid takes 5.5, 8.3 and 4.1 ms. In the browser, opening the editor froze the tank (two canvas captures 1.5 s apart were identical), a mouse drag moved a stone pile to 40% with no long task over 50 ms and released cleanly, and applying Iwagumi (◈ 215) closed the editor, restored the LIVE badge and left ◈ 985. 225 tests pass.
- **Limits:** frame-rate figures in the hidden browser pane were unreliable (requestAnimationFrame pauses), so no device timing is claimed; static layers are cached and only plants, light and water repaint per frame. Keyboard move/resize/flip/reshape shortcuts and reduced motion were not exercised in the pane.

## FS-116 UI overhaul

17 September 2026, Windows 11, Node 22.18.0, npm 10.9.3. `npm test`: 218 tests in 37 files pass; `npm run build` passes (CSS 83.95 kB, 18.32 kB gzip; main chunk 587.80 kB, 188.41 kB gzip). No core code changed.
- **Before:** in-app Chromium on isolated port 5183 measured the aquarium view at 6,201 px tall. The tank started 781 px down, the breeding planner took 1,754 px, and the collection started 3,173 px down.
- **After, 1,280 px:** the tank starts about 500 px down with notices shown. The page is 3,786 px tall with Collection open, and panels no longer stack. All four workspace tabs render their panels. The rail's habitat shortcut opens the Habitat tab and focuses it. The shop (800 px sheet), buyers and ledger, and saves drawers open from the rail and close with Escape. Visual fixtures (96 cards) and Research render inside the shell.
- **1,024 px:** the rail collapses to 76 px icons and the page is 1,014 px wide in a 1,024 px viewport.
- **375 px:** the page is 375 px wide with no horizontal overflow; the rail becomes a horizontal strip.
- **Performance:** care status for all tanks plus warnings for the active tank took about 0.1 ms per render on the 86-record QA save, memoized per world.
- **Console:** no errors.
- **Screenshot limits:** screenshots at emulated sizes sometimes came back blank or offset while scrolled, so scrolled states were verified from DOM geometry. Reduced motion and keyboard arrow movement between tabs were not exercised in the pane.

## FS-605 unusual line and pacing

17 September 2026, Windows 11, Node 22.18.0, npm 10.9.3. `npm run check`: 218 tests in 37 files, then the strict TypeScript and production build, pass.
- `tests/unusualLine.test.ts`: the seed 605 paired-fan line via normal breeding (mutation on day 302, line on day 391, 24 of 24 expressing with two origin copies by descent, 0 instant crosses, replayed journal, registered bloodline with 100% ancestry); an any-structure target finishing sooner; founder odds equal to the registry and seeded birth pacing in range.
- Browser on isolated port 5183: Research → Unusual line ran in 5.5 s with matching tables, a founder-to-line portrait strip showing standard and paired-fan tails, a 390 px layout and no console errors.

See [FS-605 evidence](research/FS-605-UNUSUAL-LINE.md).

## FS-604 bloodline registry

17 September 2026, Windows 11, Node 22.18.0, npm 10.9.3. `npm run check`: 215 tests in 36 files, then the strict TypeScript and production build, pass.
- `tests/bloodlines.test.ts`: exact ancestry fractions, including backcrosses and unrecorded parents; registration and rename rules with atomic refusals; an unrelated lookalike at 0 ancestry and 100% similarity, and descendants at 1/2 and 1/4 ancestry with varying similarity; calibration (children 58.5% vs unrelated 41.4% shape similarity over 150 families); structure and signature-origin standards; persistence, migration and replay tampering.
- Browser on isolated port 5183: a two-fish registration from the batch bar, the Family tab showing ancestry and similarity separately for a descendant and an unrelated fish, rename persisting across reload, a 390 px layout and no console errors. The shape scale was recalibrated after the browser showed an unrelated fish scoring above a descendant.

See [FS-604 evidence](research/FS-604-BLOODLINE-REGISTRY.md).

## FS-603 mutation origins

17 September 2026, Windows 11, Node 22.18.0, npm 10.9.3. `npm run check`: 209 tests in 35 files, then the strict TypeScript and production build, pass.
- `tests/origins.test.ts`: tracing leaves 200 crosses identical; the transmission rule; a twelve-generation lineage (486 records, 189 origins, 613 inherited copies) where every origin matches its allele and descends from its first carrier, with notebook counts equal to brute force; five validation refusals; world v10 migration rebuilding 393 of 542 origin copies with no invented descent, and runtime rebase.
- Browser on isolated port 5183: the QA save migrated to world v11. A cross of two mutated parents passed their origins by transmitted copy, and the Genome tab showed ◆ markers, the carried origin with a working first-carrier link and a 25-origin notebook with its scope statement. A "fishs" plural was fixed.

See [FS-603 evidence](research/FS-603-MUTATION-ORIGINS.md).

## FS-602 structure anatomy

17 September 2026, Windows 11, Node 22.18.0, npm 10.9.3. `npm run check`: 204 tests in 34 files, then the strict TypeScript and production build, pass.
- `tests/structure.test.ts`: 3,519 standard-structure anatomies (fixtures, genome v2 founders, v1 extremes and baseline genome v3 at three maturities) deep-equal a frozen anatomy v2 copy, and appearance ornament is unchanged. Twelve structure fixtures validate, frame without clipping and pick every lobe. The structure sweep finds 0 invalid and 0 clipped; fixtures validate through juvenile stages; carrier crosses express paired tails and absent dorsal fins in 20–30% of births.
- Browser on isolated port 5183: Visual fixtures → Structure variants drew all 12 cards with a sweep of 2,256 forms, 0 invalid and 0 clipped. The dorsal and barbel fixtures were made legible after screenshots; 96 motion draws painted with no console errors.

See [FS-602 evidence](research/FS-602-STRUCTURE-ANATOMY.md).

## FS-601 locus registry and genome v3

17 September 2026, Windows 11, Node 22.18.0, npm 10.9.3. `npm test`: 199 tests in 33 files pass; `npm run build` passes.
- `tests/registry.test.ts`: registry definitions and reachability; 300 genome v1/v2 crosses bit-identical to a copy of the pre-registry inheritance; genome v3 stream isolation; structural mutation statistics; standard expression for v1/v2 and baseline v3; registry validation in saves; world v9 runtime migration with shop model rebase.
- Browser on isolated port 5183: the FS-505 world v9 save loaded as world v10 with genome v2 fish and listings intact; the inspector showed the Structure block and a chromosome 11 genome view; an instant cross laid 20 genome v3 eggs with baseline Structure. The errors seen in the hot-reloaded tab did not recur in a fresh tab.

See [FS-601 evidence](research/FS-601-REGISTRY-AND-GENOME-V3.md).

## FS-505 paid-economy playtest

17 September 2026, Windows 11, Node 22.18.0, npm 10.9.3. `npm run check`: 191 tests in 32 files, then the strict TypeScript and production build, pass.
- `tests/paidEconomy.test.ts`: six seeded keepers over 90 game days, using live commands only. Covers daily ledger reconciliation, spending split against the ledger, NPC demand bounds, loop milestones, no-softlock routes every 15 game days, spend-down recovery with the rescue, and sink measurements.
- `tests/economy.test.ts`: best-first batch plan, ◈ 536 → ◈ 697 on 40 lab-cross adults, with prices that never rise and a command that pays the plan.
- Browser, in-app Chromium, isolated port 5183 with a fresh world: first session to guide completion, a 32-game-day time jump, best-first batch sale (◈ 663, read back from IndexedDB), second-generation courtship, aquarium purchase, Research → Paid economy identical to Node, and 390 px layout. A sale confirmed during a source hot reload was not persisted; the clean-reload repeat saved.

See [FS-505 evidence](research/FS-505-PAID-ECONOMY-PLAYTEST.md).

## FS-303 and requested breeding/appearance improvements

13 September 2026. npm run check: 101 tests in 16 files, strict TypeScript and Vite production build passed. git diff --check passed. See [full evidence and limits](research/FS-303-BEHAVIOR-AND-BREEDING.md).

Browser: in-app Chromium, isolated port 5174 QA world. Verified compound targets, per-tank empty state, leader selection, categorical copy odds, favorite-safe sale including a favorite changed during review, persistence after reload, feeding state in inspector, appearance gallery and desktop/mobile planner (375 x 812, no horizontal overflow). The final fresh browser load had no console errors. A transient Vite hot-reload error occurred between two source edits and disappeared after both files were updated. The browser CLI and standalone Playwright were unavailable, so the in-app browser was used. Other FS-303 transitions are covered by deterministic scenario tests, not claimed as separately observed browser journeys. The normal port 5173 save was untouched.

## Breeding panel and inspector layout follow-up — DONE, pushed `c50e579`

13 September 2026. In-app Chromium on port 5174 verified the **Hide options** and **Open breeding options** control, including `aria-expanded` state and the compact closed summary. The desktop inspector remained at 16px from the viewport top after a 700px window scroll (`position: sticky`, bounded internal overflow). The fresh load had no console errors. The mobile breakpoint keeps the inspector in normal flow so it does not cover breeding and collection content.
