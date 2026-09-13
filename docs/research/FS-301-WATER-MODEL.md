# FS-301 water model

**Recorded:** 13 September 2026  
**Models:** world save v2 · water model v1 · genome v2 · development v3 · anatomy v2 · renderer v4

## Scope

FS-301 asks for a unit-aware water, oxygen and waste model with zero, overload and recovery conservation fixtures, connected to the shared M2 clock. Fish are not yet affected by the water. Growth and health (FS-302), behavior (FS-303) and care controls (FS-305) follow.

## Model

Each tank in world save v2 carries one well-mixed compartment (`src/core/water.ts`):

| State | Unit |
|---|---|
| Volume | litres |
| Temperature | °C |
| Dissolved oxygen | mg O₂/L |
| Ammonia (total ammonia nitrogen proxy) | mg N/L |
| Uneaten food | g |
| Biofilter capacity at 20 °C | mg N per game day |
| Aeration transfer coefficient | per game day |

**Time.** Care time is one game day per 1,200 ticks, which is 60 real seconds at 1× (the GDD pacing hypothesis). Water advances in fixed 25-tick steps (half a game hour) counted by absolute step boundaries, so any split of an interval produces the same values. Each step uses only +, −, × and ÷, so saved doubles are identical on every browser, which replay validation depends on. Motion speed never changes care time.

**Each step, in order:**

1. Uneaten food decays.
2. Excretion and decayed food add ammonia.
3. The biofilter nitrifies ammonia with saturating capacity (half at 0.5 mg N/L) and slows at low oxygen (half at 2 mg/L).
4. Aeration moves oxygen toward temperature-dependent saturation.
5. Respiration, food decay and nitrification (4.57 mg O₂ per mg N) draw on the oxygen available. Unmet demand is recorded instead of driving oxygen negative.
6. Temperature scales biological rates by 1 + 0.07 × (T − 20), bounded to 0.5–2.

**Load.** `src/core/habitat.ts` sums the living residents of each tank at their adult genetic potential:

- Mass is 0.0148 g × length³ (cm), so a 52 cm fish is about 2.1 kg.
- Respiration is 6,000 mg O₂ per kg per game day × metabolism × oxygen demand. Oxygen demand comes from the `oxygen_demand` locus and tail drag.
- Excretion is 100 mg ammonia N per kg per game day × metabolism.

**Default tank.** 20,000 L at 22 °C, a 60,000 mg N/day biofilter and aeration of 24/day. A full lab tank of about 126 kg of average adults settles near 6.5 mg/L oxygen and 0.2 mg N/L ammonia. Sixty of the largest possible adults (about 830 kg) drive oxygen to critical and ammonia to high.

**Status bands** (game labels, not care advice):

| Measure | Bands |
|---|---|
| Oxygen | good ≥ 6 mg/L, low ≥ 4 mg/L, critical below |
| Ammonia | clean < 0.5 mg N/L, elevated < 1.5 mg N/L, high above |
| Stocking | light < 4 kg/m³, moderate < 8, heavy < 12, overstocked above |

## Persistence and replay

- **Save format.** World save v2 adds `water` to every tank. A world v1 save migrates with default, clean, oxygen-saturated water.
- **Advancing.** `advanceRuntime` advances every tank's water at commands, clock checkpoints and offline catch-up alike.
- **Replay.** `decodeRuntime` replays the journal, advances to the snapshot tick and compares the full world, water included, so tampered water is rejected.
- **Pre-water snapshots.** A runtime whose snapshot is world v1 has no water to replay. Its journal is validated against the water-free world, water starts from defaults at that snapshot, and the journal folds into a new checkpoint there. The revision is unchanged, so an exact retry of an older command is still rejected as stale (ADR-036).

## Conservation fixtures

`tests/water.test.ts` (12 tests):

| Fixture | Setup | Result |
|---|---|---|
| Zero load | 30 game days with no fish or food | Oxygen stays at saturation within 1e-9 mg/L; ammonia and food stay 0 |
| Zero load, depleted | Oxygen starts at 1 mg/L | Rises every step and is within 0.01 mg/L of saturation after one game day |
| Overload | 6,000 g O₂ and 150 g N per day | Ammonia rises every day for 10 days; oxygen critical, ammonia high, unmet oxygen demand recorded |
| Recovery | Two 50% water changes, then a typical load | Ammonia quartered at once, then never rises; good oxygen and clean water after 30 days |
| Mass balance | Every fixture above, plus food | The change in oxygen, ammonia and food equals the recorded fluxes within 1e-7 relative, with no negative quantity |
| Split intervals | 12,345 ticks at once versus random splits | Identical state |
| Food | 1,000 g added to clean water | Below 10 g after 5 days; adds ammonia and oxygen demand |
| Runtime | Breed, clock checkpoint, move, clock checkpoint | Replay reproduces the saved water; tampered water is rejected; 1,200 single-tick advances equal one coarse advance |
| World v1 | M2-style runtime without water | Loads with default water at the snapshot, an empty journal and the same fish; a stale retry rejects; later saves round-trip |

The habitat tests also confirm that the cheap `metabolicPotential` matches `express` for 200 founders, that only living residents count, and that empty tanks stay clean and saturated.

## Browser verification

In-app Chromium 152 against the local Vite server:

- **Existing QA world** (world v1 snapshot and legacy journal):
  - Loaded without a replay warning.
  - The Koi Garden (45 fish, 158 kg) read "Oxygen good" (6.4 mg/L), "Ammonia clean" (0.21 mg N/L), "Stocking moderate".
  - The Breeding Studio (60 fish, 225 kg) read "Oxygen low" (5.5 mg/L), "Ammonia clean" (0.39 mg N/L), "Stocking heavy".
- **Saving water:** two plant toggles saved a world v2 snapshot and checkpoint carrying water. After a reload it replayed without a warning.
- **Offline catch-up:** a saved timestamp two hours old applied 144,002 ticks, with the notice "2 hours of protected research time restored. Tank water kept changing; fish growth and health are not simulated yet." The water saved at its steady state.
- **Newer world:** a world created before FS-301 (6 founders, 16 kg) read "Oxygen good" (8.4 mg/L), "Ammonia clean" (0.01 mg N/L), "Stocking light".
- **Found and fixed:** a hot-reloaded development tab still holding a pre-water world threw an error in the new readout. The readout now skips such a tank; decoded worlds always carry water.

## Limitations

- Water does not affect fish yet: no health, growth, hunger, feeding consumption or death.
- The Feed button is still a behavior demonstration, so no food enters the water model through the UI.
- No controls exist for water changes, temperature, filtration or aeration (FS-305). Full tanks of large fish can show low oxygen with no in-app remedy other than moving or selling fish.
- There is no pH, nitrite/nitrate, carbon dioxide, light, plant uptake or gas exchange beyond one aeration coefficient.
- Every fish counts at adult genetic potential until FS-302 adds growth.
- Stocking is a soft warning only.
