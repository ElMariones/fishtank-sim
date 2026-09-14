# FS-401/402 normal breeding, courtship blockers and reserved nurseries

**Recorded:** 14 September 2026 · **Status:** delivered; push reference in the [backlog](../BACKLOG.md)
**Models:** world save v5 · breeding model v1 · care model v1 · life model v1 · stage appearance v1 · genome v2

## Starting state

`00e291c` (FS-307 marked DONE) was HEAD and `origin/main`, with no tracked changes. Only `.claude/launch.json` was untracked.

## Scope

- **FS-401:** maturity, health, cooldown and shared-habitat checks, with transparent courtship blockers.
- **FS-402:** a reserved clutch scheduler and a bounded nursery, with no overflow and no duplicated hatch on reload.

The instant lab cross had to stay replayable for existing saves.

## Model

World save v5 adds a rest counter to every fish and a list of clutch records (`src/core/breeding.ts`).

**Pairing** (`pair`) checks hard rules atomically. Any failure rejects the command with every reason; otherwise the clutch reserves its nursery places.

| Rule | Blocker | Fix offered |
|---|---|---|
| Female mother, male father, two different fish, both living | `role`, `unavailable` | Choose a living female and male |
| Adult stage (at least 70% of adult length) | `immature` | Wait for it to grow |
| Condition at least 70% | `condition` | Fix the care warnings in its tank |
| Not resting after a clutch (female 8, male 4 game days) | `cooldown` | Wait, or choose another fish |
| Not already courting | `busy` | Cancel that courtship, or wait until it spawns |
| Both in the same tank | `apart` | Move one of them |
| Nursery exists, no other courtship holds it, enough free places | `nursery-missing`, `nursery-busy`, `nursery-full` | Choose another nursery or a smaller clutch |
| Living and record limits, counting reservations | `limit` | Sell fish or export the save |

**Courtship** progresses once per game day at 0.5 × fertility ÷ 0.6 (bounded 0.25–0.75, two to four unpaused days). Each day it either progresses or records why it paused, and the UI shows the same reason with its fix. It pauses when:
- the parents are in different tanks;
- a parent's condition falls below 70%;
- the water has critical oxygen or high ammonia;
- the water is outside 18–28 °C.

**Reservation.** A courting clutch holds 8–24 places in its nursery. Every arrival (`move`, `buy`, the lab `breed`, `pair`) and the population limits count reserved places, so a courting nursery cannot overflow. At most one courtship can hold each nursery.

**Spawning.** At the day boundary after development, a completed courtship turns its reserved places into consecutive tracked eggs in the nursery. Eggs are dated from the pairing timestamp plus game days at one real minute each, and both parents start resting. An incubating clutch becomes hatched at the boundary where no egg remains.

**Guards.** A courting parent cannot be sold. `cancel-clutch` releases a courtship's reservation but cannot cancel laid eggs.

**Compatibility.** The instant `breed` command is unchanged apart from counting reservations. It replays older journals and stays in the UI as a labeled research shortcut. Worlds v1–v4 migrate with rested fish and no clutches.

**Interface.** The breeding panel defaults to **Normal breeding** and keeps **Instant lab cross** beside it.
- **Pairing:** normal breeding adds a nursery select with free places and a tracked-egg count. Every blocker is listed with its fix; otherwise a ready line explains what will happen.
- **Clutches:** the list shows progress, game days, reserved places, live pause reasons, **Cancel courtship** and **Show clutch**.
- **Elsewhere:** the inspector adds a **Breeding** row, and the return summary lists eggs laid and paused courtships.

## Fixtures

`tests/breeding.test.ts` (6 tests):

| Fixture | Result |
|---|---|
| Pairing blockers | A valid pair has none. Swapped roles, the same fish, eggs, fry, low condition, rest days, separated parents, an existing courtship, a held nursery, a nursery too full for 24 and a missing nursery are each refused with a message and fix, and the world is unchanged. A genome v1 clutch from genome v2 parents is refused |
| Courtship | One unpaused day adds the pair's rate. Separation records `apart` and water above 28 °C records `water` without progress, while condition stays at least 70%. Once fixed, the pair lays 12 eggs in the nursery with the right parents, generation and date. Reservations drop to zero; parents rest 8 and 4 days, count down, and the clutch hatches on schedule |
| Reservations | A nursery full of residents plus reservations refuses a purchase, a move and a lab cross unchanged. Three seeded random walks of 90 mixed commands (pairings, purchases, moves, lab crosses, cancellations, sales, new tanks and time) never exceed tank capacity or the living limit, never duplicate an ID, lay eggs in at least two walks, and replay exactly |
| No duplication | Reloading at eight points around courtship, spawning and hatching, and one offline catch-up, give the same world as one straight advance: 22 fish, one hatched clutch. An exact retry of the pairing is a no-op, and the absence summary reports 16 eggs laid |
| Cancel and sale guard | Selling a courting parent, alone or in a batch, is refused unchanged. Cancelling releases the places and frees the pair. Cancelling twice, cancelling laid eggs and cancelling an unknown clutch are refused |
| Migration and validation | World v4 loads as rested fish with no clutches; courting and laid worlds round-trip. The save is rejected when a mother is male, a courting clutch lists eggs, two courtships hold one nursery, a reservation exceeds capacity, a clutch ID is out of range, laid eggs do not match, or a rest is 400 days. A world v4 runtime with a lab cross rebases |

**Found and fixed before commit:**
- **Migration key order.** The migrated world placed `nextClutchId` after `fish`, while a decoded current save puts it before `tanks`. Replay validation compares serialized worlds, so every saved world from before v5 would have opened in recovery mode. Four legacy-save tests caught it, and the migration now writes keys in schema order.
- **Weak property walk.** The first random walk picked parents from all fish, mostly eggs and fry, so courtships rarely ran and the reservation checks said little about spawning. The walk now favors adults sharing a tank, and the test requires at least two of three walks to lay eggs.

## Browser verification

In-app Chromium against the isolated `fishtank-qa` server on port 5176, continuing the FS-305–307 QA world saved as world v4:

- **Migration:** the v4 world loaded with no save warning or recovery mode. **Normal breeding** was selected, and Haru × Sumi read "Ready: Haru and Sumi can court in The Koi Garden. Courtship takes about 3 game days…".
- **Pairing:** **Start courtship · reserve 20 places** gave the notice "Haru and Sumi started courting…" and a clutch row "Courting · CL-000001 · 0% after 0 game days · 20 places reserved". Breeding Studio's free places fell from 40 to 20. The same pair then listed three blockers (both parents busy, the nursery already reserved), Start was disabled, and the inspector read "Breeding · Courting Sumi · 0%".
- **Sale guard:** confirming Haru's sale left "Haru is courting. Cancel the courtship before selling.", with credits, Haru and the clutch unchanged.
- **Pause:** moving Haru to Breeding Studio showed "Paused: Haru and Sumi are in different tanks. Move them back into one tank." After 3 simulated game days, the return summary listed the paused courtship, and progress was still 45% after 4 game days.
- **Spawning:** after Haru moved back and 3 more game days passed, the summary read "Breeding Studio · 40 fish · 20 eggs laid". The clutch read "Eggs incubating · 20 of 20 eggs still incubating". The reserved places had become the eggs (still 20 free), and Haru and Sumi were resting for 7 and 3 game days.
- **Show clutch:** it opened Breeding Studio filtered to Haru × Sumi, with both parents pinned and the first egg selected ("NOW · EGG · HATCHES IN 2 GAME DAYS").
- **Lab cross:** **Instant lab cross** hid the normal-breeding panel, offered "Breed 20 offspring" and labeled itself a research shortcut that skips maturity, condition, rest days, courtship and shared-habitat checks.
- **Phone, 375 × 812 with coarse pointer:** no document overflow, and none of the six new breeding controls under 44 px.
- **Console:** one "reading 'cooldownDays'" error came from hot reload into a tab holding pre-v5 fish. Its count stayed at one through pairing, the sale guard, both time skips, spawning and Show clutch, which all read that field. The stale FS-305 "plural" error is also still listed.

## Limitations

- The Parents filter groups every clutch of a pair, so Show clutch lists earlier offspring of the same pair too; per-clutch cohorts and batch rehoming are FS-406.
- No courtship animation, mate preference, natural breeding or breeding cost. Fertility changes courtship speed only; the player chooses clutch size.
- One courting clutch per nursery, and only the tracked eggs exist; there is no narrative count of untracked eggs.
- Eggs are dated at one game day per real minute, which does not follow speed changes because game time has none.
- Genealogy beyond one generation and the kinship cache are FS-404/405.
