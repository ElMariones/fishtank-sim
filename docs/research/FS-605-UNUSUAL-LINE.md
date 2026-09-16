# FS-605 — Koi to an unusual line, and mutation discovery pacing

**Date:** 17 September 2026. **Status:** DONE, pushed `bb10985`. Completes M6's task list.
**Models:** world save v12 · genome v3 · structure model 1 · anatomy v3 · origin model 1 · bloodline model 1. No save or command change.

## Starting state

`b93338d` (FS-604 marked DONE) was HEAD and equal to `origin/main`. The baseline suite passed: 215 tests in 36 files.

## Scope

FS-605 asks for a multi-generation unusual-line demonstration and a review of mutation discovery pacing and tradeoffs. M6's gate is a koi-to-unusual-line demonstration with valid ancestry. GENETICS §5 warns that a very rare structural class can be effectively absent for ordinary players, and that rates must be tuned against tracked births and playtime, never with invisible pity rerolls.

## Delivered

**Demonstration** (`src/core/unusualLineScenario.ts`, Research → **Unusual line**). A seeded world (seed 605) with six standard-structure genome v3 founder koi plays through the runtime's own commands and clock. Only normal breeding is used, and the instant lab cross never runs.
1. **Discover:** ready founder females court ready founder males into the two starter tanks for 24 eggs, and hatched surplus is rehomed each day. The keeper stops at the first egg whose recorded mutation turns tail topology from standard to a variant, with origin `<fish>/<locus><copy>` (FS-603).
2. **Outcross:** the grown carrier courts an unrelated founder (not its parent), and offspring carrying the origin once are kept.
3. **Intercross:** two carrier siblings court, and offspring with two copies express the new tail and are kept.
4. **Fix:** expressing fish are registered as a bloodline (FS-604) and court. The demonstration ends when their clutch hatches.

The final runtime is decoded and replayed from its journal. A target option (`any`) counts the first mutation at any structural locus. The tab shows a portrait strip from founder to line offspring, a generations table with pedigree F, the event log, the bloodline's ancestry and similarity ranges, and the pacing tables.

**Pacing** (`mutationPacing`):
- exact founder-stock odds from the registry, for carrying and for expressing each structural variant;
- seeded births from standard parents, counted until the first new structural mutation.

## Demonstration result (seed 605, paired fan)

| Step | Game day | Outcome |
|---|---:|---|
| Discovery | 302 | After 87 founder courtships, Tulip (FSH-002047), among the first 2,064 eggs, carries a new standard → paired fan tail copy |
| Outcross | 336 | Tulip × founder Kohaku: 24 offspring, 13 carriers, 0 showing it; pedigree F 0% |
| Intercross | 364 | Carrier siblings: 24 offspring, 6 with two copies showing a paired fan; pedigree F 25% |
| Line | 391 | "Paired fan line" registered with two expressing fish; their clutch: 24 of 24 show a paired fan with two copies by descent; pedigree F 37.5% |

The run used 0 instant crosses and 2,160 births, and its journal replays. Every line offspring has 100% ancestry from the registered foundation and 71–90% standard similarity, reported separately. It runs in about 5 s in the browser.

## Pacing review

**Five fixed seeds, paired-fan target.** None was chosen after seeing results; seed 605 is the demonstration seed.

| Seed | Mutation found (day / eggs) | Line offspring hatched (day) | Births |
|---:|---|---:|---:|
| 605 | 302 / 2,064 | 391 | 2,160 |
| 606 | 163 / 1,104 | 269 | 1,176 |
| 607 | 61 / 432 | 155 | 504 |
| 608 | 6 / 72 | 93 | 144 |
| 609 | 121 / 840 | 215 | 912 |

With any structural target, seed 605 found a reduced dorsal copy on day 3 and fixed the line on day 83 (144 births). Seeds 606 and 607 fixed four-barbel and reduced-dorsal lines on days 145 and 126. Every run had 24 of 24 final offspring expressing and a replayed journal.

**Seeded births** (200 lineages of standard parents): the first new structural mutation came after a median of 95 births (10th–90th percentile 11–351). Tail topology, dorsal form and barbel count each supplied about a third of first mutations.

**Founder stock** (exact odds per founder):

| Locus | Carries a hidden copy | Shows it |
|---|---:|---:|
| Tail topology | 0.80% | 0.0016% |
| Dorsal form | 5.9% | 0.09% |
| Barbel count | 6.9% | 0.12% |

With six founders, a dorsal or barbel carrier is likely in the starting tank, but a tail-topology carrier is rarely there.

### Tradeoffs and findings

- **Two routes, very different paces.** Dorsal and barbel variants can come from founder stock or appear within days. A paired fan almost always needs a new mutation, which took 6 to 302 game days here at about 7 eggs a game day from two nurseries during discovery. Once found, fixing a line took a steady 87–106 game days: grow the carrier, outcross, intercross, then one more clutch.
- **Real time.** At one game day per real minute, the five tail lines took 1.6–6.5 hours of play, and discovery dominated. That fits a long-term goal. A player who spends less of that time breeding may never see a tail mutation; that is the §5 risk.
- **Inbreeding cost.** The shortest route intercrosses siblings, reaching pedigree F 25%, then 37.5% in the line generation. Using unrelated carriers would take another generation.
- **Visibility.** Carriers look standard, but the inspector shows hidden copies and mutation origins. The pacing therefore depends on a player reading the Genome tab, not on luck alone.
- **Not changed here:** the 0.001 structural rate, founder weights and clutch rules. Candidate levers, left to a balance decision with playtests (FS-705):
  - more nurseries to raise births per game day, which costs credits (FS-505);
  - a shop documented-carrier category for tail topology, which the §5 rule would permit because it is visible stock, not a hidden reroll;
  - a declared research sandbox multiplier.

## Automated evidence

Windows 11, Node 22.18.0, npm 10.9.3. `npm run check`: **218 tests in 37 files** and the strict production build pass (main chunk 576.23 kB, 184.29 kB gzip, with Vite's size advisory).

`tests/unusualLine.test.ts` (3 tests):

| Fixture | Result |
|---|---|
| Paired-fan line | Completes within 600 game days with 0 instant crosses and a replayed journal. The mutation is tail topology → paired fan, and every founder expresses a standard tail. Outcross offspring have 0 showing it and more than 4 carriers at F 0; intercross offspring have at least 2 showing it at F 25%; 24 of 24 line offspring show it with two copies. The bloodline is "Paired fan line" with a paired-tail standard, final ancestry is all 1 and similarity is 0.6–1. The origin's first carrier recorded the mutation, all 24 line fish descend from it and show a paired fan, and the foundation fish carry two copies |
| Any structural target | Completes sooner than the tail target on seed 605, with no more births before discovery |
| Pacing | Founder odds equal the registry weights exactly. Each locus supplies 20–47% of first mutations. The median births to a first mutation is 60–180, with the 10th percentile below and the 90th above |

## Browser evidence

In-app Chromium on the isolated `http://localhost:5183`.
1. **Run:** Research → **Unusual line** → **Run demonstration** finished in 5.5 s. The summary read "Day 302 · new paired fan copy found among 2,064 eggs", "Day 391 · line offspring hatched", "24 of 24 final offspring show it" and "0 instant lab crosses · journal replays".
2. **Portrait strip:** five portraits: "Haru · founder koi, standard tail", "Tulip · hidden new copy", "Saint Loner of the Stars · carrier, standard tail", "Shy Oyster · two copies, paired fan" and "Selkie the Bashful · line offspring, paired fan". The screenshot shows standard single tails on the first three and split paired fans on the last two.
3. **Tables:** the generations table and pacing text matched the fixtures (Outcross 24 · 13 · 0 · 0.00%; Carrier intercross 24 · 9 · 6 · 25.0%; Line 24 · 0 · 24 · 37.5%; median 95 births, 11–351, about 6.5 hours of play).
4. **Phone:** at 390 × 844 the page was 390 px wide and the strip 358 px in two columns. No console errors.

## Remaining limits

- **Scripted evidence:** the demonstration is a keeper, not a player, and the pacing covers five seeds and one birth rate.
- **Crown-four:** a crown needs a second mutation on a paired-fan background; it is reachable (FS-601/602) but not demonstrated.
- **Care:** the keeper rehomes surplus immediately and never runs short of room or care; a real aquarium has more competing goals.
- **Numbers:** no rate or price was retuned; the levers above are open for FS-705.
