# FS-302 life stages and accumulated growth

**Recorded:** 13 September 2026 · **Status:** DONE, pushed `5821f46`  
**Models:** world save v3 · life model v1 · water model v1 · genome v2 · development v3 · renderer v4

## Scope

FS-302 asks for egg, fry, juvenile and adult stages with accumulated growth, where the same genome develops differently under declared conditions. Portrait pigment reveal and juvenile rendering belong to FS-306. Feeding belongs to FS-305, and health, disease and death are not simulated.

## Model

Every fish in world save v3 carries `life` (`src/core/development.ts`):

| Field | Meaning |
|---|---|
| `ageDays` | Whole game days since the egg was laid, counted at absolute day boundaries |
| `lengthCm` | Current length; 0 while an egg |
| `condition` | 0–1; a moving average of the recent environment |

**Daily update.** Once per game day (1,200 ticks, 60 real seconds at 1×):

1. Condition moves 25% of the way toward the day's environment factor.
2. An egg hatches at 0.6 cm on day 3.
3. A hatched fish grows logistically: length += 0.27 × growth potential × condition × length × (1 − length / adult length). Growth never makes a fish shrink or pass its genetic adult length.

**Environment factor.** min(oxygen, ammonia) × crowding × nutrition, each on a game curve:

| Measure | Curve |
|---|---|
| Oxygen | 0.1 at 0 mg/L → 0.6 at 4 → 1 at 6 |
| Ammonia | 1 at 0.5 mg N/L → 0.6 at 1.5 → 0.1 at 4 |
| Crowding | 1 at 8 kg/m³ → 0.8 at 12 → 0.4 at 24 |
| Nutrition | Fixed at 1 until FS-305 adds feeding |

**Stages** are derived from length and age:

| Stage | Rule |
|---|---|
| Egg | Length 0 |
| Fry | Below 10% of adult length |
| Juvenile | 10% to below 70% |
| Adult | From 70% |
| Elderly | After the longevity potential in 365-day years |

The `growth_rate` and `longevity` loci are now active. The genetic adult length stays a separate, unchanged potential.

**Integration.** `advanceWorld` interleaves the FS-301 water steps with one development pass at each absolute game-day boundary. Residents load the water at their current mass, and each living fish develops under its tank's water and crowding at that boundary. Commands, clock checkpoints, offline catch-up and replay therefore produce identical worlds.

**Commands.**
- Breeding lays 20 eggs.
- Eggs cannot breed or be sold, and breeding goal leaders skip them.
- Hatched fish may still breed in the lab until maturity checks arrive (FS-401).
- Founders and unrelated stock arrive as young adults (30 game days) at adult length potential.

**Persistence.** World v1–v2 saves migrate their fish as young adults at adult length potential, matching how the lab always drew them. Any older world snapshot is validated against its records only (identity, genome, pedigree, ownership and tanks) and rebased there. Tampered life state in a current save is rejected by replay.

## Interface

- **Tank:** fish are drawn and picked at their current size, with a floor so the smallest fry stay visible and clickable. Eggs are not drawn swimming; the tank label reads "20 eggs incubating".
- **Cards:** "Egg · hatches in 3 game days", "Fry · 4.1 of 65 cm" or "Adult · 63 of 65 cm".
- **Inspector:** life stage, age, condition with any limiting factors ("limited by low oxygen, crowding"), and the unchanged adult length potential.
- **Breeding:** parent pickers list only hatched fish. The breeding notice and lab note explain eggs, hatching and the remaining M4 shortcut.
- **Clock:** the display previews the shared clock every five seconds without saving, so eggs visibly hatch and fish grow between checkpoints.

## Fixtures

`tests/development.test.ts` (7 tests) raises one genome with growth potential exactly 1:

| Fixture | Result |
|---|---|
| Environment curves | Healthy 1; hypoxic (3 mg/L) 0.475; ammonia (2 mg N/L) 0.5; crowded (16 kg/m³) 0.667; limits listed most severe first |
| Healthy water | Egg for 3 days, hatches at 0.6 cm, passes through fry and juvenile, adult within 18–30 game days; length never decreases or exceeds potential; above 99% of adult length by day 60 |
| Declared conditions, day 30 | Healthy adult > crowded > high ammonia > hypoxic in length; the hypoxic fish is not yet adult, with condition below 0.5 |
| Condition history | One bad day moves condition only 25% of the gap; after 20 hypoxic days, condition is still below 0.7 on the first healthy day, rises daily, and growth resumes without reversing; the fish is behind a healthy sibling at day 40 and adult by day 70 |
| World integration | Eggs are still eggs one tick before day 3 and hatch at it; studio biomass rises; every studio fish is adult by day 60; founders only age; a split interval equals one advance; replay reproduces growth and rejects tampered length |
| Egg rules | Selling an egg, a batch containing an egg, or breeding an egg rejects with the world unchanged; the same fish can be sold once hatched |
| Migration | A world v2 save loads as young adult stock; invalid length, condition, extra fields or missing life reject; a world v2 runtime rebases with its stored water |

Older tests that sold or bred newborns now sell founders or hatch the eggs first. The collection test also confirms that goal leaders are never eggs.

## Browser verification

In-app Chromium 152 against the local Vite server, in the pane's existing QA world, which was saved as world v2:

- **Loading:** the world loaded without a replay warning. Cards read "Adult · 50 of 50 cm", and the inspector read "Life stage Adult · 61 of 61 cm · Age 36 game days · Condition 100%".
- **Breeding:** a new Lineage Tank 3 received Haru × Sumi. The tank showed "20 inhabitants" and "Planted habitat · 20 eggs incubating", and cards read "Egg · hatches in 3 game days". The notice said the eggs hatch in 3 game days and grow fastest in good water.
- **12 minutes offline:** "12 minutes of protected research time restored. Tank water and fish development kept going; health is not simulated yet." All 20 were fry, for example "Fry · 4.1 of 65 cm" at 12 game days. A screenshot showed the fry drawn small, with the selected fry labeled.
- **25 more minutes offline:** all 20 were adults, for example "Adult · 63 of 65 cm" at 37 game days. The tank read oxygen good (7.7 mg/L), ammonia clean (0.07 mg N/L) and stocking light (70 kg).
- **Console:** during hot reload, tabs still holding a pre-life world threw "reading 'lengthCm'". A freshly opened tab rendered normally without new errors.

## Limitations

- Portraits and tank drawings use adult shape and pigment at a smaller size; juvenile proportions and pattern reveal are FS-306.
- Nutrition is assumed. The Feed button still only attracts fish, and uneaten food does not come from the UI yet (FS-305).
- There is no health, disease, injury or death. The elderly stage is labeled only, and unreachable for years of play at 1×.
- The lab lets hatched fry breed, with no courtship, cooldown or maturity check (FS-401).
- Sale quotes still use adult genetic potential, not current size (M5 economy).
- One game day per real minute is the GDD pacing hypothesis; it has not been playtested.
