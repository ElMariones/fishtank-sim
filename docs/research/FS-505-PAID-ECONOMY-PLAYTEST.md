# FS-505 — Complete-loop playtest and paid-economy sources and sinks

**Date:** 17 September 2026. **Status:** DONE, pushed `f5b1888`. Completes M5's task list.
**Models:** world save v9 · economy model v1 · price model 1 · relief model 1 · genome v2. No save, command or genome contract changed.

## Starting state

`ce75263` (FS-504 marked DONE) was HEAD and equal to `origin/main` after a fetch, with no tracked changes. Only `.claude/launch.json` was untracked; it gains an isolated `fishtank-fs505` entry (port 5183). The baseline suite passed: 186 tests in 31 files.

## Scope

FS-505 asks for a playtest of the complete loop, an economy source/sink report, and fixes for softlocks and major confusion. The bar comes from:
- M5's gate: complete the first-session loop and avoid economic softlock;
- BALANCE §4's rule that economy changes need source/sink experiments and no-funds recovery;
- FS-503's note that E-05 still used free tanks;
- FS-504's note that the rescue needed paid-economy strategies.

The playtest is seeded simulated keepers plus one browser session by the implementer. No external players took part; FS-705 remains the human playtest.

## Delivered

**Paid-economy playtest** (`src/core/paidEconomy.ts`, Research → **Paid economy**). Six keepers play 90 game days from the same six founders and ◈ 1,200. They use only commands the live interface sends: `purchase-tank`, `upgrade-tank`, `buy-listing`, `place-decorations`, `set-care`, `change-water`, `pair`, `sell-batch`, `rehome-batch`, `move`, `rename`, `feed` and `claim-relief`. The harness throws if a keeper sends a legacy free command (`add-tank`, `decorate`, `buy`, `breed`).
- **Ledger:** every game day the ledger must reconcile, and the final world must decode as a valid save. Spending is split into stock, aquariums, expansions, decorations, care equipment and water changes, and the split is checked against the world's own ledger totals.
- **No-softlock probe:** every 15 game days a copy of each world must reach an accepted pairing within 60 game days. The probe may only cancel, rehome, move, choose free care settings, wait, and take the koi rescue or stock the credits already cover. It is FS-504's recovery route, moved from the test file into `src/core/playtest.ts` so both use one implementation.
- **Milestones:** first courtship, eggs, hatch, sale, room purchase and second-generation courtship.

**Fixes from the playtest.**
1. **Best-first batch sales** (`planBestSales` in `economy.ts`, ADR-059). The sale review and the command it sends used collection order. Cheap pet-shop sales used up demand before fish that collectors wanted. The review now sells the fish with the highest offer under the remaining demand first. Offers only fall as demand is used, so a lazy queue re-prices stale entries. Realized prices never rise along the plan, ties keep collection order, and the command receives the planned order, so it pays exactly the review. `recoveryOverview` uses the same plan. On a fixture of 40 lab-cross adults, the plan pays ◈ 697 instead of ◈ 536 (+30%).
2. **Select all with a buyer N** replaces **Select all saleable N**. The old count included fish with no NPC offer: 20 "saleable" when only 16 could sell.
3. **Guide completion** now says how surplus offspring become credits or free places. None of the seven steps mentions selling, while every keeper's first income arrived on game day 30–31.
4. **Expansion at 60 places** now explains why the button is disabled.
5. **Research tabs** wrap on phones. The sixth tab pushed the row to 543 px at 390 px width.

## Paid-economy results

Seed world 481516, 90 game days, `paidEconomyPlaytest()`. Node and the browser produced identical tables.

| Keeper | Sales | Stock | Aquariums | Expansions | Decor | Equipment | Water | Net | Lowest | Sales cover spending | Rescues |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| First-session keeper | 9,522 | 0 | 2,000 | 2,700 | 0 | 0 | 0 | +4,822 | 500 · day 23 | day 45 | 0 |
| Selective breeder, paid room | 8,268 | 0 | 1,600 | 2,400 | 0 | 0 | 0 | +4,268 | 121 · day 35 | day 63 | 0 |
| Expansion first | 7,858 | 0 | 2,400 | 3,600 | 0 | 0 | 0 | +1,858 | 8 · day 33 | day 80 | 0 |
| Shop variant collector | 6,714 | 1,360 | 1,200 | 1,500 | 0 | 0 | 0 | +2,654 | 154 · day 31 | day 50 | 0 |
| Premium care and decoration | 7,645 | 0 | 2,000 | 2,400 | 200 | 3,150 | 364 | −469 | 40 · day 30 | day 81 | 0 |
| Spend-down and rescue | 9,385 | 0 | 2,400 | 3,600 | 0 | 0 | 0 | +3,385 | 0 · day 1 | day 42 | 1 |

| Keeper | Courtship | Eggs | Hatch | First sale | Room bought | Second generation | Places | Peak living | Sold / rehomed | Longest route to a pairing |
|---|---|---|---|---|---|---|---:|---:|---|---|
| First-session keeper | day 1 | 3 | 6 | 31 | 17 | 32 | 400 | 338 | 132 / 96 | 1 game day |
| Selective breeder | day 1 | 3 | 6 | 31 | 23 | 32 | 360 | 298 | 120 / 68 | 8 game days |
| Expansion first | day 1 | 3 | 6 | 31 | 1 | 34 | 480 | 383 | 107 / 44 | 1 game day |
| Shop variant collector | day 1 | 3 | 6 | 30 | 36 | 36 | 280 | 247 | 56 / 76 | 1 game day |
| Premium care | day 1 | 3 | 6 | 31 | 32 | 32 | 380 | 300 | 98 / 40 | 3 game days |
| Spend-down and rescue | day 1 | 2 | 5 | 31 | 0 | 33 | 480 | 396 | 116 / 40 | 4 game days |

### Findings

- **No softlock.** All 36 route checks reached a pairing within 8 game days. No keeper ended a game day with a sex missing, and every ledger reconciled daily. The spend-down keeper had ◈ 0 and no males on day 1, claimed one rescue and courted the same day. It still bought no stock and finished +◈ 3,385. The rescue restored the loop without becoming an income.
- **The loop completes in about half an hour at 1×.** Courtship on day 1, eggs on day 2–3, hatching on day 5–6, and a second-generation courtship on day 32–36. The GDD's 20–35 minute first-generation hypothesis holds for these keepers.
- **No income for the first 30 game days** for keepers who sell only adults. Before then only founders (capped at ◈ 150) and juveniles or fry (60% and 25% prices, mostly to the pet shop) can sell. This is slow rather than stuck, because starter room covers the first clutches, but a first session sees no income from its own lineage. The guide's completion text now points to selling; FS-705 must measure whether players understand it.
- **Room is the main sink, and it is one-off.** Aquariums and expansions cost ◈ 2,700–6,000 per keeper, which fills the full build-out of eight 60-place tanks (◈ 6,000 beyond the starters). Nothing recurs after that: food, breeding and rehoming are free, and equipment is bought once. Keepers that stopped building ended +◈ 4,268 to +◈ 4,822 and were still rising, bounded only by NPC demand (◈ 840 a game day). **Open balance risk:** a long save accumulates credits with nothing to spend them on. A recurring sink or collector orders would change FS-504's no-softlock argument, which assumes breeding and food stay free, so it is left for a balance decision rather than tuned here.
- **Overbuilding delays returns but never strands.** Expansion first bottomed at ◈ 8 on day 33 and covered its spending only on day 80.
- **Premium care does not pay in healthy tanks.** Strong filters and aeration, water changes and decorations cost ◈ 3,714. Sales fell to ◈ 7,645 against the selective breeder's ◈ 8,268, a net of −◈ 469. Equipment's value is in overstocked or stressed tanks (FS-305/307). Its price is a cost, not an investment, while default equipment keeps these stocking levels healthy.
- **Shop stock serves collectors.** ◈ 1,360 on four variant and carrier listings led to ◈ 5,074 from the color collector alone. Total sales were lowest because this keeper refused pet-shop offers.
- **The long-fin collector** earned ◈ 449–1,155 per keeper by day 90. In FS-501's 60-day run it bought nothing.

## Automated evidence

Windows 11, Node 22.18.0, npm 10.9.3. `npm run check`: **191 tests in 32 files** pass, followed by the strict TypeScript and production build (main chunk 550.72 kB, 176.23 kB gzip, with Vite's non-failing size advisory).

`tests/paidEconomy.test.ts` (4 tests):

| Fixture | Result |
|---|---|
| Live commands only | Six keepers in order. Each: daily reconciliation and a valid final save; no legacy free command; spending split equal to the ledger totals; net = sales − spending; income by buyer sums to sales; credits never negative; places = 120 + 20 per aquarium and per expansion; peak living within places; cumulative income within starting demand plus ◈ 840 per game day |
| Loop and softlock | Every keeper courts, hatches by day 10 and starts a second generation by day 45. Route checks run on days 15, 30 … 90, each reaching a pairing within 60 game days. The first-session keeper renames and feeds once and its sales cover its spending |
| Spend-down | Lowest credits ◈ 0, at least one rescue and at most one per 10 game days, ◈ 0 of stock, courtship on day 1 and a positive net |
| Sinks | Places never exceed 480; room spending of the expansion keeper stays within the eight-tank build-out; premium care spends on equipment and water, and its sales stay below the selective breeder's plus its equipment spending; the collector buys listings and sells nothing to the pet shop |

`tests/economy.test.ts` adds **FS-505 best-first batch sales**: two lab crosses grown 35 game days give 40 adults. In newest-first order they sell 16 for ◈ 536; the best-first plan sells the same 16 for ◈ 697. It covers every selected fish, realized prices never rise, and the sequential plan over the planned order reproduces each sale. `sell-batch` in that order credits exactly ◈ 697, and tied offers keep the given order. `tests/recovery.test.ts` now imports the shared route and compares the recovery overview with the best-first plan; its FS-504 results are unchanged.

## Browser evidence

In-app Chromium (Claude desktop browser pane) against a fresh world on the isolated `http://localhost:5183`. No other origin was touched.

1. **First session:** the guide read 0 of 7. Selecting Haru, renaming her Ember with **Save**, **＋ Feed** and **Start courtship · reserve 20 places** reached step 5: "Ember and Sumi started courting in The Koi Garden. 20 places are reserved in Breeding Studio…". No console errors.
2. **Time:** in this origin only, the stored snapshot's save time was moved back 32 minutes before a reload. **While you were away** read "32 game days passed" and "Breeding Studio · 20 fish · 20 eggs laid", and the clutch had hatched into adults.
3. **Confusion found:** the collection batch bar read "Select all saleable 20", but "20 selected · 16 with offers for ◈ 556". The review listed ◈ 5–14 pet-shop sales ahead of pond-keeper and collector fish, in collection order.
4. **After the fixes:** starring Tango and Zesty Apricot of the Ferns completed step 5. **Select all with a buyer 18** gave "18 selected · 16 with offers for ◈ 663". The review read "Fish with the highest offers sell first…" and listed prices descending from ◈ 179, ◈ 135, ◈ 77, ◈ 64 down to ◈ 8. Confirming gave "16 fish sold for ◈ 663 (Color collector ×2, Pond keeper ×4, Corner pet shop ×10)" and credits ◈ 1,863. The stored IndexedDB snapshot read credits 1,863, 16 sold fish and ledger entry #1 of ◈ 663.
5. **Hot-reload artifact:** an earlier confirmed sale (◈ 666) happened while source edits hot-reloaded the page, and it was not persisted. The live state then reverted to the stored ◈ 1,200, and a nursery label showed a stale "40 free places". After a clean reload the same journey saved, and the label read 56 free places. FS-503 recorded the same development-server behavior; no invalid snapshot replaced a valid save.
6. **Family and goal:** Tango's parent link opened Ember (step 6). **＋ Add goal** completed the guide, which showed the new completion text about selling or rehoming surplus.
7. **Second generation:** Tango × Zesty Apricot of the Ferns read "Ready…" with expected pedigree F 25.0% and started courting in Breeding Studio on about game day 33.
8. **Room:** **Review expansion · ◈ 300** was disabled for the 60-place Breeding Studio with no reason shown; the new hint now reads "…already has the maximum 60 places…". **Confirm aquarium purchase** took credits from ◈ 1,863 to ◈ 1,463 and added "Lineage Tank 3 · 0 / 20 fish", saved.
9. **Research → Paid economy:** **Run playtest** took 4.2 s and reproduced both tables above exactly.
10. **Phone, 390 × 844:** the Research tab row reached 543 px. After the wrap fix the document is 390 px wide, and the tables scroll inside their own containers. The viewport was reset afterwards. The console showed no errors.

## Remaining limits

- **Evidence scope:** seeded keepers with fixed strategies on one world seed, plus one implementer session. This is not a player study; comprehension and the first-session completion rate remain for FS-705.
- **No recurring sink:** a finished build-out leaves credits accumulating. See the open balance risk above.
- **Early income:** it depends on juvenile and fry sales or founder resale for the first 30 game days.
- **Sale plan:** the best-first plan is greedy, not a search for the maximum total. Keepers use their own equivalent ranking.
- **Browser time:** the time jump rewrote a stored save time in a test origin; it does not exercise real long absences.
