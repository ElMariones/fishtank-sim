# FS-307 care demonstration, absence summary and recovery

**Recorded:** 14 September 2026 · **Status:** delivered; push reference in the [backlog](../BACKLOG.md)
**Models:** world save v4 (unchanged) · care model v1 · life model v1 · stage appearance v1 · renderer v6

## Starting state

`45c0063` (FS-306 marked DONE) was HEAD and `origin/main`, with no tracked changes. Only `.claude/launch.json` was untracked.

## Scope

FS-307 asks for a healthy and a stressed tank demonstration, an absence summary and recovery, with no unexplained health decay. With FS-305 and FS-306 it completes M3's task list.

## Model

**Day observer.** `advanceWorld`, `advanceRuntime` and `applyOfflineCatchup` accept an optional `onDay` callback. At each game-day boundary it receives the world before and after development and the environment each tank applied. It only observes: fixtures assert the advanced world is identical with or without it.

**Absence summary** (`src/core/absence.ts`). `loadSession` attaches the observer to the ordinary protected catch-up, so the summary describes exactly what was applied. Per tank it reports:

| Field | Meaning |
|---|---|
| Residents, eggs hatched, became juvenile, reached adulthood | Stage changes during the absence |
| Length gained, mean condition before and after, fish declined | Growth and condition, with declines beyond 0.5 percentage points |
| Limiting causes | Each named cause with the number of game days it applied |
| Warnings | The care warnings waiting on return |
| Unexplained declines | Fish-days whose condition fell with no named cause |

Every factor in the environment also appears in `environmentLimits`, so condition can only fall when a cause is named. The unexplained count therefore stays zero; it is reported as a standing check, not assumed.

**Return panel.** **While you were away** shows the summary above the tank after at least one game day: game days passed, a row per tank with something to report and an **Open** button, a count of quiet tanks, and the decline check. The live status line only points to the panel.

**Care scenarios** (`src/core/careScenario.ts`, Research → **Care scenarios**). Two seeded worlds run for 40 game days through the aquarium's own advance:

| Scenario | Setup | Keeper |
|---|---|---|
| Healthy | 30 adults, Measured rations, Standard filter and aeration, 22 °C | Reviews but never needs to act |
| Stressed | 45 adults, Generous rations, Compact filter, Standard aeration, 28 °C thermostat | From day 16 applies every settings fix and water change named by the warnings, through ordinary commands; reviews every five days while warnings remain |

When two warnings suggest the same change (cooling appears under both oxygen and temperature), the keeper lists it once.

**Tuning finding.** The first stressed setup (60 adults, Heavy rations, Compact filter, Gentle aeration, 29 °C) read 0.0 mg/L oxygen and 77% condition by the end of day 1, and ammonia reached 73.55 mg N/L by day 15. Condition kept falling until day 22, six days after the first fix. That demonstrates a crash, not a decline a player can read and correct. A six-candidate probe chose the current setup, and fixtures now pin the legible shape.

## Fixtures

`tests/absence.test.ts` (4 tests):

| Fixture | Result |
|---|---|
| Observer | Advancing with and without `onDay` gives identical worlds; one report per game-day boundary, each with every tank's environment; the last report is the world at that boundary |
| No unexplained decline | 12 random combinations of stocking (10–60 adults), ration, filter, aeration and thermostat over 20 game days: more than 100 fish-day declines, every one with a named cause |
| Scenarios | Healthy: no warnings, limits, reviews or declines; condition 100% throughout. Stressed: warnings from day 1 while condition is above 90%; oxygen never below 3 mg/L; condition stays above 75% on day 2; oxygen, ammonia, temperature and leftovers warnings by day 15 with condition below 50%; lowest condition no later than the first review (day 16); every warning cleared, condition above 95% by day 40; zero unexplained declines; deterministic |
| Absence | A stressed garden with 20 eggs in the studio, 40 offline minutes: observed catch-up equals plain catch-up; 40 game days; garden 60 fish all declined, limited by low oxygen, ammonia and temperature, with oxygen and ammonia warnings; studio 20 eggs hatched, grown, nothing limited, not quiet. A quiet world past the eight-hour cap reports 480 game days and only quiet tanks |

## Browser verification

In-app Chromium against the isolated `fishtank-qa` server on port 5176, continuing the FS-305/306 QA world:

- **Return panel:** after `savedAt` moved 20 minutes back, the reload showed no save warning and "WHILE YOU WERE AWAY · 20 game days passed". Breeding Studio read "20 fish · 20 reached adulthood · Nothing limited these fish" with **Open Breeding Studio**. The Koi Garden counted as "1 tank had nothing to report", followed by "Every condition decline had a named cause. Fish never die in this lab." After the notice fix, the live status line read "While you were away: the summary above shows what changed in each tank."
- **Care scenarios, final setup:**
  - Summary tiles read: lowest healthy-tank condition 100%, lowest stressed-tank condition 13%, stressed warnings cleared on day 18, and 0 of 675 fish-day declines without a named cause.
  - Stressed tank: 94% condition on day 1 (oxygen 4.7 mg/L, ammonia 0.69 mg N/L), 59% on day 5, 23% on day 10, 13% on day 15 (ammonia 6.46).
  - One review on day 16 (◈ 360): Standard filter, Measured rations, Strong aeration, cooling to 22 °C and a 50% water change.
  - Recovery after the review: 76% on day 20, 94% on day 25, 100% from day 35, with oxygen 7.3 and ammonia 0.17.
- **Found and fixed before commit:**
  - The crash-like first stressed setup.
  - A duplicated thermostat fix in the keeper's list.
  - The return notice announced twice.
  - "1 care reviews" in the chart label.
  - A fix label containing its own semicolon made five fixes read as six when joined with semicolons.
- **Console:** only the stale "plural is not defined" error from an FS-305 hot reload; no new errors.
- **Not captured:** screenshots, because the browser pane was hidden.

## Limitations

- The summary is not stored: dismissing it or reloading again loses it, and there is no permanent per-fish event history (FS-404).
- The keeper is scripted and applies every fix at once. It demonstrates that warnings name workable fixes; it is not a player study (FS-505, FS-705).
- The stressed setup is tuned for a readable demonstration, not measured against real koi husbandry.
- Clutch and courtship events do not exist yet, so the summary cannot report them (FS-402).
- Protection means capped time and no mortality; poor care during an absence still lowers condition, with its causes reported.
