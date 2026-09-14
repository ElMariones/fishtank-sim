# FS-406 clutch selection, batch rehoming and two generations in normal mode

**Recorded:** 14 September 2026 · **Status:** DONE, pushed `44d7d98`
**Models:** world save v5 (unchanged) · breeding model v1 · care model v1 · genome v2

## Starting state

`deafb89` (FS-405 marked DONE) was HEAD and `origin/main`, with no tracked changes. Only `.claude/launch.json` was untracked.

## Scope

FS-406 asks for a two-generation normal-mode demonstration, cohort selection, and batch rehoming with review. It completes M4's task list; the roadmap's M4 gate is "complete two generations without instant-lab shortcuts".

## Model

**Batch rehoming.** The `move-batch` command takes 1–480 fish IDs and a destination tank.
- **Atomic checks:** before any fish moves, it rejects duplicate IDs, members that are sold or missing, a missing tank, and a batch already entirely in that tank.
- **Capacity:** it counts arrivals against the destination's free places, courtship reservations included.
- **Replay:** it is an ordinary command, so journals replay it and no save version changed.

**Clutch selection.** `birthGroupsOf(fish, mother, father)` groups a pair's offspring by birth time, which fish laid together share, whether from a normal clutch or an instant lab cross. It lists the newest clutch first, with its ID range and size. The existing Parents filter still groups all of a pair's offspring.

**Collection.**
- **Clutch filter:** appears when the chosen pair has more than one clutch. **Show clutch** and a lab cross now open that clutch directly.
- **Selection:** any living fish in view can be selected. **Select all N** (with "in this clutch" when filtered) and **Select all saleable N** fill the selection.
- **Move review:** **Review move of N** names the source and destination and offers a destination select with free places. It states the destination's free places, its reservations and the places left after the move, warns when a courting fish would leave its partner, and lists every fish with ID, generation and stage. **Confirm move of N** sends one `move-batch`, after which **Open** leads to the destination.
- **Sale review:** lists only saleable fish, since favorites and eggs are still never sold in bulk, and says how many selected fish stay.

**Demonstration.** `lifecycleDemonstration()` in `src/core/lifecycleScenario.ts` runs a seeded world through `createRuntime`, `executeCommand` and `advanceRuntime`, one game day at a time:
1. **First pairings:** it adds a tank, then pairs Haru × Sumi into Breeding Studio and Kohaku × Yuki into Lineage Tank 3, 20 places each.
2. **Selection:** when all 40 offspring are adults with condition of at least 70%, it picks the largest adult-length potential among the females of the first clutch and the males of the second.
3. **Rehoming:** it adds another tank, rehomes each clutch's 19 surplus fish in one batch (to The Koi Garden and Lineage Tank 4), and moves the chosen father to the chosen mother.
4. **Second generation:** it pairs them into Lineage Tank 3 and advances until that clutch hatches.
5. **Report:** it returns the clutch table, a day-by-day event list, the command types, the number of instant crosses, whether every bred fish belongs to a clutch record, the fullest tank counting reservations, and whether the runtime save decodes and replays to the same world.

**Research** gains a **Two generations** tab that runs it.

## Fixtures

`tests/lifecycle.test.ts` (3 tests):

| Fixture | Result |
|---|---|
| Batch rehoming | Ten eggs and a founder already in The Koi Garden move in one command: only the eggs' tank IDs change (16 and 10 residents). Duplicate, unknown and sold members, a missing tank, a batch already in place and an empty batch are refused with nothing changed. With 20 eggs and a 24-place courtship in Breeding Studio, 17 arrivals are refused naming the reservation and 16 are accepted. A runtime with `move-batch` decodes and replays |
| Clutch groups | Two lab crosses of Haru × Sumi form two groups, newest first (#27–46 and #7–26), while the Parents cohort remains one group of 40. A normal 16-egg clutch forms one group matching its clutch record |
| Two generations | Commands are exactly add-tank, pair, pair, add-tank, three move-batch and pair: no instant cross. Three clutches of 20 are laid and hatched, the second generation after both first clutches hatched, within 90 game days. 38 fish are rehomed, all 66 records are founders or clutch members, the fullest tank stays within capacity, the save replays, and a second run is identical |

**Found and fixed before commit:**
- **Replay check compared key order.** The demonstration first reported that its save did not replay. `decodeRuntime` had in fact succeeded; the demonstration's own comparison serialized the live world, whose keys follow construction order, against a decoded world in schema order. Both sides are now decoded before comparison, and a decode failure's message is shown.
- **Recorded errors instead of silent failure.** The demonstration now carries `replayError`, shown in the Research note, so a replay problem is never reduced to a bare "does not match".

## Browser verification

In-app Chromium against the `fishtank-qa` server on port 5176.

**Research → Two generations (`http://127.0.0.1:5176`):**
- **Summary:** "3 of 3 clutches hatched · Day 40 second generation hatched · 0 instant lab crosses · 38 fish rehomed in batches · Matches save replayed from its journal".
- **Clutches:**

  | Clutch | Parents | Laid | Hatched |
  |---|---|---|---|
  | CL-000001 | Haru × Sumi | day 3 | day 6 |
  | CL-000002 | Kohaku × Yuki | day 2 | day 5 |
  | CL-000003 | Fry 33 × Fry 24 (paired day 34) | day 37 | day 40 |

  Pedigree F was 0.0% for all three.
- **Events:** the day-34 events name Fry 33 as the largest potential among 8 females of CL-000001 and Fry 24 among 7 males of CL-000002. They record rehoming 19 fish to The Koi Garden and 19 to Lineage Tank 4.
- **Note:** the fullest tank, The Koi Garden, held 25 of 60 places.
- **Phone width:** at 378 px the page had no horizontal overflow, the clutch table scrolled inside its wrapper, and the study buttons were at least 44 px tall.

**Continuing QA world (`http://localhost:5176`):**
- **Clutch filter:** in Breeding Studio, the Haru × Sumi cohort (40 fish) offered **All 2 clutches**, "#47–66 · 20 fish" (clutch CL-000001) and "#27–46 · 20 fish" (a lab cross). Choosing #47–66 showed 20 cards and **Select all 20 in this clutch**, which selected all 20 (1,587 credits saleable).
- **Move review:** the review read "Move 20 fish from Breeding Studio to The Koi Garden?" with "The Koi Garden · 35 free", "35 free places; 15 remain after this move", 20 listed fish and no courtship warnings.
- **Move:** confirming gave "20 fish moved from Breeding Studio to The Koi Garden in one transfer…", counts of 45/60 and 20/60, a cleared selection and **Open The Koi Garden**.
- **Second generation in normal mode:**
  - **Pairing:** CL-000001 siblings Fry 61 (♀) × Fry 65 (♂) read "Ready: … can court in The Koi Garden" with expected pedigree F 25.0% and 2 founders assumed. **Start courtship** reserved 20 places in Breeding Studio as CL-000002.
  - **Laying:** time was advanced by protected offline catch-up after moving the stored `savedAt` back 4.5 minutes, then reloading. The summary read "4 game days passed … Breeding Studio · 40 fish · 20 eggs laid", and CL-000002 was laid after 3 game days of courtship.
  - **Hatching:** a second catch-up of 3.5 minutes (4 game days) read "20 eggs hatched".
  - **Show clutch:** it opened Breeding Studio filtered to "Fry 61 × Fry 65 · 20" and "#67–86 · 20 fish" with Fry 67 (G2) selected and both parents pinned.
  - **Family:** Fry 67 lists Fry 61 and Fry 65 (The Koi Garden), and grandparents Haru and Sumi (sold, archived), each in 2 positions. The note reads "Pedigree F (25.0%) … the 2 founders … Of 6 ancestor positions shown, 6 are recorded."
- **Crowding after the move:** The Koi Garden's 45 adults were limited by crowding for both simulated absences, with mean condition 99% → 98%. The summary still read "Every condition decline had a named cause".
- **Console:** no new errors. The only entry is the "kinship is not defined" hot-reload artifact from FS-405, retained across reloads.

## Gate assessment

M4's gate, "complete two generations without instant-lab shortcuts", is met in two ways:
- **Seeded demonstration:** it runs through the runtime's commands and clock, issues no instant cross and replays its journal.
- **Browser lineage:** a real save in the browser went Haru × Sumi → CL-000001 → CL-000002 through normal breeding and the ordinary UI, with time advanced by protected offline catch-up.

Neither is an external playtest.

## Limitations

- **Rehoming stays inside the aquarium:** it moves fish only between the player's tanks. An economy-neutral way to rehome fish out of the aquarium belongs to the M5 economy (FS-501).
- **Capacity, not biomass:** the move review checks places, not crowding. Moving 20 adults into The Koi Garden limited its fish by crowding, and the warning appeared afterwards in that tank rather than in the review.
- **Clutch grouping:** clutches are grouped by birth time, so two instant crosses of one pair in the same millisecond would merge.
- **Selection:** it clears when the tank, archive view, sex, favorites, parents or clutch filter changes, and filters are not saved.
- **Demonstration keeper:** it selects only by adult-length potential; it does not use breeding goals or kinship.
- **Browser time:** it was advanced by simulated absence, not by waiting in real time.
