# FS-305 care controls and actionable warnings

**Recorded:** 14 September 2026 · **Status:** DONE, pushed `d425639`
**Models:** world save v4 · care model v1 · water model v1 · life model v1 · genome v2 · development v4 · renderer v5

## Starting state

Fetched `origin/main` before work: `b282836` was both HEAD and the remote, with no tracked changes or unpushed commits. Only `.claude/launch.json` was untracked; a second, isolated `fishtank-qa` preview entry (port 5176) was added there for browser checks and is not committed.

## Scope

FS-305 asks for feeding, equipment and water controls with cost and effect previews, and care warnings that identify corrective actions. It must keep domain care separate from the transient worker pellets and motion speed, preserve protected absence, and keep active, background, offline and replayed integration equal, with atomic rejection.

## Model

Every tank in world save v4 carries `care` (`src/core/care.ts`); filter and aeration capacity stay on the FS-301 water state.

| Field | Meaning |
|---|---|
| `ration` | Off, Light, Measured, Generous or Heavy: 0, 0.8, 1, 1.2 or 1.6 × the residents' current need |
| `targetC` | Thermostat setpoint, 16–30 °C |
| `dayNeedG`, `dayEatenG` | Grams needed and eaten since the current game day began |
| `fed` | Share of need eaten over the last completed game day |

**Each half-hour step,** before the FS-301 water step:

1. The feeder adds ration × need, where need is 10 g per kg of fish per game day × metabolism × the temperature rate.
2. Fish eat 60% of the food present, never more than that step's need. Eaten food adds 6 mg ammonia N per gram; fasting excretion is 40 mg N per kg per day, so a fully fed fish still excretes the FS-301 100 mg.
3. Uneaten food decays in the water step, adding ammonia and oxygen demand.
4. The thermostat moves the water by at most 0.1 °C.

**Each game day,** the feeding day closes before development. The environment becomes min(oxygen, ammonia, temperature comfort) × crowding × nutrition, where nutrition is 0.1 at 0% fed, 0.55 at 50% and 1 from 85%. Temperature comfort is 1 from 18 to 26 °C, and growth is multiplied by 1 + 0.04 × (T − 22), bounded 0.8–1.2. Every factor is also returned by `environmentLimits`, so condition, the lab's health measure, cannot fall without a named cause. Fish never die.

**Costs.** Filter tiers (30/60/120/240 g N per day) cost ◈ 0/150/400/900 and aeration tiers (12/24/36/48 per day) ◈ 0/100/300/650; an upgrade costs the difference and lower tiers are free. A water change costs ◈ 1 per m³ replaced. Food has no recurring cost (ADR-046).

## Commands, warnings and previews

| Command | Effect | Rejected when |
|---|---|---|
| `feed` | Adds a quarter game day of the residents' need | No hatched fish need food |
| `set-care` | Sets ration, filter, aeration and thermostat; charges upgrades | Nothing changes; credits are short |
| `change-water` | Replaces 10%, 25% or 50% with clean water; siphons that share of uneaten food | Credits are short |

`careAdvice.ts` derives bands and warnings for oxygen, ammonia, temperature, crowding, underfeeding and leftovers. Each names the fish affected and fixes with their cost: the next equipment tier, Measured rations, cooling to 22 °C, a 25% or 50% water change, a manual portion or a new tank. In the UI a fix opens **Care controls** with the change selected. `projectTank` runs the ordinary world advance on a copy holding only that tank and its residents, so a preview equals applying the change and letting the same time pass.

## Fixtures

`tests/care.test.ts` (7 tests):

| Fixture | Result |
|---|---|
| Rations, 30 adults, 10 game days | Off 0% fed, Light 70–85%, Measured above 90%, Generous and Heavy 100%; uneaten food rises with every step up; ammonia Measured < Generous < Heavy; daily eaten never exceeds need; food, ammonia and oxygen balance their ledger within 1e-7 relative |
| Development, 20 fry, 30 game days | Mean length Measured > Light > Off; Generous fry have life states identical to Measured with more uneaten food; starved fry below 0.3 condition, limited only by underfeeding |
| Thermostat | 22 → 26 °C without overshoot, reaching exactly 26; comfort and growth curves; warmer fry grow longer while saturation falls |
| Time | Random splits equal one integration; 1,200 single-tick advances, one coarse advance and offline catch-up give identical worlds; replay reproduces `set-care`, `change-water` and `feed`; tampered `fed` rejects |
| Commands | Upgrade charges ◈ 450, downgrade is free; no-op and ◈ 500 unaffordable upgrade reject unchanged; 25% change costs ◈ 5 and quarters ammonia; manual portion size; feeding an egg-only tank rejects; invalid ration, temperature, tier and percentage reject |
| Warnings | A healthy 30-fish tank has none. A stressed 60-fish tank (Heavy, Compact, Gentle, 29 °C) warns about oxygen, ammonia, temperature and leftovers; applying its fixes in rounds clears every warning and raises condition, and each projection equals the applied result |
| Migration | World v3 loads with Measured rations and a thermostat at the rounded water temperature; invalid care rejects; a world v3 runtime rebases with its water |

Existing fixtures were adjusted only where world v4 changed a pinned version or where migrated tanks now carry default care.

## Browser verification

In-app Chromium against `npm run dev -- --port 5176 --strictPort`, in a new isolated QA world:

- **Fresh tank:** Oxygen good 8.4 mg/L, Ammonia clean 0.01 mg N/L, Stocking light 0.8 kg/m³, Fed 100%, Water 22.0 °C, "Nothing is limiting these fish. They need about 167 g of food per game day."
- **Previews and costs:** Heavy rations with a Strong filter showed a third column (uneaten food 2 → 42 g) and ◈ 250; applying moved credits 1,200 → 950. A 25% change previewed then cost ◈ 5. The resulting leftovers warning's **Preview: Feed measured rations** loaded Measured at no cost. **＋ Feed** reported the added portion.
- **Stressed tank:** Compact filter, Gentle aeration and 29 °C applied at no cost, 20 eggs bred into the tank, then `savedAt` moved 45 minutes back. The reload restored 45 minutes: Oxygen critical 1.7 mg/L, Ammonia high 9.23 mg N/L, 29.0 °C and 184 g of decaying food. Four warnings (two urgent) listed priced fixes, and Haru read "Condition 16% · limited by ammonia, low oxygen, temperature".
- **Recovery:** the preview for Measured, Standard filter and aeration and 22 °C projected oxygen 1.5 → 7.1 mg/L and ammonia 14.25 → 4.52 over three days; it applied for ◈ 250. A 50% change previewed ammonia 10.82 → 5.41 and applied for ◈ 10. After another 30 simulated minutes: Oxygen good 7.2, Ammonia clean 0.12, Fed 97%, no warnings, and Haru at 100% condition. Neither reload showed a save or replay warning.
- **Phone, 375 × 812 with coarse pointer:** document width 375 px, projection table within its panel, no care control under 44 px.
- **Found and fixed before commit:** "26 fishs affected"; warning items reused the save banner's `.warning` class; the resume notice still said health was not simulated; chip values lacked a space before the number for assistive text.
- No console or dev-server errors.

## Limitations

- One shared food pool per tank: bold fish reaching pellets first is visual only, and individual appetite is not tracked.
- No pH, nitrite/nitrate, carbon dioxide, light or plant uptake. Temperature comfort and growth are game curves.
- Condition is the only health state. There is no disease, injury or death, and challenge-mode rules are not designed.
- Food is free and equipment has no running cost; the lab economy stays unbalanced until M5.
- Offline catch-up applies care but the return notice is still one line (FS-307).
- A severely overstocked tank of the largest adults cannot be fixed with equipment; the warning points to moving fish, and batch moves arrive with FS-406.
