# FS-501 economy model v1: NPC demand, explained offers, ledger and rehoming

**Recorded:** 14 September 2026 · **Status:** delivered; push reference in the [backlog](../BACKLOG.md)
**Models:** world save v6 · economy model v1 · price model 1 · breeding model v1 · genome v2

## Starting state

`85db06b` (FS-406 marked DONE) was HEAD and `origin/main`, with no tracked changes. Only `.claude/launch.json` was untracked.

## Scope

FS-501 asks for bounded NPC demand and price rules, a currency ledger, and documented purchase, resale and breeder-farming experiments. From the GDD and the balance plan:
- basic stock must not resell for more than it costs;
- demand is a finite budget and quantity over time;
- prestige from provenance is capped;
- offers explain their top contributions;
- a fish can always be rehomed without payment.

## Model

`src/core/economy.ts`, economy model v1.

**Buyers.** Five NPC buyers, each with a capacity, a daily recovery, a base price, a trait weight and a budget per fish:

| Buyer | Wants | Capacity / recovery | Base / weight / budget |
|---|---|---|---|
| Corner pet shop | any hatched fish | 10 / 5 | ◈ 14 / 0 / 20 |
| Long-fin collector | tail length from 55% | 3 / 1 | ◈ 35 / 180 / 240 |
| Pond keeper | adult length potential from 60 cm, low metabolism | 4 / 1 | ◈ 30 / 120 / 170 |
| Miniature keeper | adult length potential up to 40 cm | 3 / 1 | ◈ 35 / 150 / 200 |
| Color collector | uncommon, rare or very rare founder-stock appearance | 2 / 0.5 | ◈ 40 / 200 / 260 |

**Offers.** `offersFor` lists every interested buyer's offer for a living, hatched fish, best first. An offer is a list of terms, each the change in the rounded price, so the terms always add up to the offer:
1. base price;
2. trait interest × weight;
3. for trait buyers, a bred-here bonus of ◈ 6 per generation, at most ◈ 30;
4. a stage factor: fry 25% (pet shop only), juvenile 60%, adult 100%, elderly 80%;
5. condition, proportionally below 70%;
6. demand: × (0.5 + 0.5 × remaining ÷ capacity), with no offer below one unit;
7. the budget, or ◈ 150 for founders and bought stock;
8. a minimum of ◈ 1.

**Sales.** `planSales` sells in the given order, giving each fish its best offer and using up that buyer's demand before the next fish. The `sell` and `sell-batch` commands, the sale review and the E-05 strategies all use it, so a review shows what the command pays. A batch where any fish has no offer is refused whole. Demand recovers in `advanceWorld` at every game-day boundary, after breeding, so the daily recovery can pay at most ◈ 840 a game day across all buyers.

**Ledger.** World save v6 adds `market` (demand per buyer) and `ledger` (opening balance, running totals by reason, and the latest 100 entries).
- **What records:** purchases, equipment, water changes, sales and rehoming.
- **Balance check:** a save is rejected unless credits equal the opening balance plus every total.
- **Migration:** worlds v1–v5 open the ledger at their saved balance with full demand.

**Rehoming.** `rehome-batch` gives hatched, non-courting fish the new `rehomed` status. Credits don't change and records stay in the archive and family graph.

**Compatibility.** Sale commands now carry `priceModel: 1`, and journal entries without it replay with the lab quote they were recorded under. Legacy replay comparison ignores demand and ledger, which older snapshots cannot contain. Saves from before FS-501 therefore decode and rebase like any older world.

**Interface.**
- **Inspector:** shows **Best NPC offer**, a **Why ◈ N from the …** breakdown with other offers, **Sell to {buyer} · ◈ N** (or **No buyer today**), and **Rehome · no credits**.
- **Batch bar:** counts fish with offers and their total. The sale review lists buyer and price per fish in order, and **Review rehoming of N** lists rehomable fish.
- **Header:** the credits open **Buyers and ledger**, which shows each buyer's remaining demand, recovery and budget, the ledger totals and the latest entries.
- **Archive:** labels fish as sold or rehomed.
- **Research:** **Economy experiment** runs E-05.

## Fixtures

`tests/economy.test.ts` (6 tests):

| Fixture | Result |
|---|---|
| Offers | 600 genome v2 founders plus uniform A0 and A5 genomes: every offer's terms sum to its amount, every founder offer is between ◈ 1 and ◈ 150, and all five buyers appear. The best founder's genome bred to generation 5 gains "Bred here, generation 5", beats the founder offer and stays within its buyer's budget. An egg has no offers, a fry only the pet shop's, a juvenile a lower price with a stage term, and condition 35% a negative condition term |
| Demand and plans | For twelve genome v1 fish only the pet shop wants: the first ten sell with falling prices and the last two have no buyer. Selling all twelve is refused unchanged. Ten in one batch pay exactly the plan and empty the pet shop, the same as ten single sales. Demand returns to 5 after one game day and 10 after three, equal day by day or all at once. A runtime with batch and single sales replays |
| Ledger | A seeded walk of 900 steps covers lab crosses, priced, batch and legacy sales, purchases, equipment, water changes, rehoming, new tanks and time; founders are kept as breeders. After every step the balance equals the opening plus totals and at most 100 entries are kept. More than 100 entries were written, sequence numbers increase, totals have the expected signs, and rehoming totals zero. A save with one extra credit, demand above capacity, or swapped entries is refused |
| Rehoming | Three hatched fish become rehomed with no credit change, a zero rehoming entry, parents intact, and a valid save. Rehomed fish cannot be sold, moved or rehomed again; duplicates, eggs and courting fish are refused |
| Legacy | A sale without a price model pays the lab quote and records it. A world v5 save migrates with the ledger opening at its balance, full demand and keys in current order; a v5 save with a rehomed fish is refused. A world v5 runtime whose journal sold and bought before FS-501 decodes with the same credits and rebases |
| E-05 | Observation earns nothing and is never stranded. Every resale cycle loses at least ◈ 100 and the loop's net is negative. Every strategy's cumulative income stays within starting demand plus ◈ 840 per game day, income by buyer sums to the total, living fish stay within the limit, and the lab-cross farmer sells more fish than the selective breeder at a lower average price than collector contracts |

**Found and fixed before commit:**
- **Ledger walk:** the first walk sold its founders early and stalled at 49 entries, so it never exercised the 100-entry limit. It now keeps founders as breeding stock and caps its population so the test stays fast.
- **Empty ledger wording:** **Buyers and ledger** said "keeps the latest 0 of 0 entries" before any credit changed. That sentence now appears only once entries exist.
- **Credits button on phones:** the phone stylesheet hides the "lab credits · buyers and ledger" hint, leaving the button named only by its balance. It now carries an explicit accessible name and title.
- **Panel gutter:** the market panel ran edge to edge on phones and now keeps a side margin.

## E-05 results

Six seeded strategies ran for 60 game days, each from the same six founders and ◈ 1,200, with free tanks.

| Strategy | Net | Sold | Average | Best day | Rehomed | Bred | Peak living | Income by buyer |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Observation-focused | ◈ 0 | 0 | — | ◈ 0 | 0 | 0 | 6 | — |
| Purchase and resale loop | −◈ 1,105 | 6 | ◈ 66 | ◈ 107 | 0 | 0 | 6 | pet shop 28, pond keeper 60, color collector 307 |
| Selective breeder | +◈ 3,188 | 49 | ◈ 65 | ◈ 394 | 30 | 320 | 247 | pond keeper 1,184, miniature 494, color collector 1,510 |
| Collector contracts | +◈ 3,134 | 40 | ◈ 78 | ◈ 329 | 23 | 320 | 263 | pond keeper 1,158, miniature 438, color collector 1,538 |
| Maximum-output breeder | +◈ 536 | 230 | ◈ 2 | ◈ 27 | 178 | 432 | 78 | pet shop 536 |
| Instant lab-cross farmer | +◈ 643 | 290 | ◈ 2 | ◈ 27 | 790 | 1,200 | 126 | pet shop 643 |

- **Resale loop:** loses money by construction. Its six cycles lost ◈ 143–236 each, until credits fell below the stock price.
- **Output strategies:** maximum-output breeding and lab-cross farming sold hundreds of fry and juveniles to the pet shop for about ◈ 2 each. Finite demand kept them near ◈ 11 a game day by the end.
- **Selective and collector breeders:** earned about five times as much from far fewer fish. Their income was spread across the pond keeper, miniature keeper and color collector.
- **Long-fin collector:** bought nothing, because no fish reached 55% tail length within 60 days.
- **Holdings:** no strategy was stranded, but upkeep does not exist yet. The selective breeders held up to 247–263 living fish because free tanks let them keep growing juveniles.

One seed set, not a playtest.

## Browser verification

In-app Chromium against the `fishtank-qa` server on port 5176, with the continuing QA world saved as world v5.

- **Migration:** the save loaded as world v6 with "Saved on this device" and no warning. The credits read "◈ 767 lab credits · buyers and ledger".
- **Buyers and ledger:**
  - Every buyer was at full demand, from "Will take 10 more of 10 · 5 more each game day" for the pet shop to "0.5 more each game day" for the color collector.
  - The ledger showed opening balance ◈ 767, all totals ◈ 0, balance ◈ 767 and "No credit has changed since this ledger opened."
- **Founder offer:** Haru's best offer was ◈ 150 from the color collector: base +◈ 40, trait interest 67% +◈ 133, founder resale limit −◈ 23. Other offers were pond keeper ◈ 58 and corner pet shop ◈ 14.
- **Bred offer:** Fry 7 drew ◈ 77 from the pond keeper: base +◈ 30, trait interest 34% +◈ 41, "Bred here, generation 1" +◈ 6.
- **Single sale:** confirming "Sell Fry 7 to the pond keeper for ◈ 77?" gave the credits ◈ 844 and a pond keeper wanting "3 more of 4". It also added "#1 · Sales · 1 fish · Pond keeper ×1 +◈ 77", and the balance still matched the totals.
- **Batch sale:**
  - Fry 8–10 read "3 selected · 3 with offers for ◈ 317". The review listed Fry 10 to the color collector ◈ 113, Fry 9 to the color collector ◈ 135 and Fry 8 to the pond keeper ◈ 69.
  - Confirming gave "3 fish sold for ◈ 317 (Color collector ×2, Pond keeper ×1)", credits ◈ 1,161, a satisfied color collector and entry #2.
  - A game day had passed since the first sale, so the pond keeper had recovered to 3 of 4 after this sale.
- **Rehoming:** "Rehome Fry 11 outside your aquarium? No credits change…" kept credits at ◈ 1,161. The inspector switched to **Last recorded** with "This fish was rehomed outside your aquarium" and "Best NPC offer —", and the ledger added "#3 · Rehoming · 1 fish · ◈ 0". The archive listed Fry 11 as "Rehomed · archived" and Fry 7–10 as "Sold · archived".
- **Research → Economy experiment:** reproduced the six rows above exactly, with six chart lines ending at ◈ 1,200, 95, 4,388, 4,334, 1,736 and 1,843.
- **Phone, 375 × 812 with coarse pointer:** no page overflow, and **Buyers and ledger** stays within the screen. The six checked controls were the panel's Close, the credits button, the offer breakdown, Sell and Rehome; none was under 44 px.
- **Console:** no errors during the journey.

## Limitations

- Tanks, breeding and food are free, so the experiment has no upkeep or capacity cost; FS-503 adds tank purchases and upgrades.
- Shop stock is still generated at purchase (FS-502), and there are no timed collector orders.
- Demand is shared by all fish of a buyer's kind. Buyers do not tire of one lineage, and the pond keeper's interest mixes size with metabolism.
- A batch sells in collection order; the plan does not search for the order that pays most.
- Offers use genetic potential for traits and current stage only through the stage factor; appearance a buyer can see today is not modeled separately.
- The ledger keeps 100 entries; older detail survives only in the totals.
- E-05 is one seed set with scripted strategies, not player behavior.
