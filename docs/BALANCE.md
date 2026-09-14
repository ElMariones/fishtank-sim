# Balance baseline and experiments

All planned values below are game hypotheses. They are not real aquarium-care recommendations. Keep lab tuning separate from solo and online tuning.

## 1. Implemented lab constants

| Parameter | Value | Reason / limitation |
|---|---:|---|
| Initial founders | 6, alternating female/male | Three possible starting pairs; all unrelated by assumption |
| Loci / chromosomes | 48 / 8 | Stable genome-v1 catalog |
| Alleles per locus | 6 | IDs 0–5; mostly additive |
| Per-copy mutation | 0.003 | About 25.06% of births have at least one small mutation |
| Boundary crossover | 0.12 | Synthetic linked meiosis |
| Cohort | 20 | Accelerated research comparison |
| Tank capacity | 60 fish | Temporary count limit; not volume/biomass |
| Maximum tanks | 8 | Bounds local UI and saves |
| Living fish limit | 480 across eight tanks | Sold fish free living capacity but retain ancestry |
| Total record limit | 10,000 including sold fish | IndexedDB storage and bounded UI pages; actual quota can still fail |
| Initial credits | 1,200 | Local NPC workflow demonstration |
| Unrelated stock | 250 credits | Deterministically generated founder on purchase |
| Lab sale quote | round(35 + 0.5 × sizeCm + 25 × metallic + 25 × tail) | No rarity/demand/age model |
| Breeding / new lab tank cost | 0 | Deliberately unbalanced experimentation |
| Motion tick | 50 ms | Visual motion only |
| Motion speed | 1× / 2× / 4× | Does not age fish |
| Visual pellets | Sink, can be eaten once, dissolve after 20 motion seconds | Transient worker display; the domain Feed command adds real food (FS-305) |

### Water model v1 (FS-301)

Game-rule approximations in `src/core/water.ts`; not aquarium-care advice.

| Parameter | Value | Reason / limitation |
|---|---:|---|
| Care time | 1 game day = 1,200 ticks = 60 real seconds at 1× | GDD pacing hypothesis; motion speed does not change it |
| Integration step | 25 ticks (half a game hour) | Fixed absolute steps; aeration and decay cannot overshoot |
| Default tank | 20,000 L at 22 °C, filter 60,000 mg N/day, aeration 24/day | A full tank of average adult lab fish stays "good" and "clean" |
| Fish respiration | 6,000 mg O₂ per kg per day × metabolism × oxygen demand | Fish count at their current size (FS-302) |
| Fish excretion | 40 mg ammonia N per kg per day × metabolism while fasting, plus 6 mg N per gram eaten | FS-305 split: a fully fed fish still excretes the original 100 mg N per kg per day |
| Fish mass | 0.0148 g × length³ (cm) | Koi-like proportions: 52 cm ≈ 2.1 kg |
| Food decay | 2 per day; 50 mg N and 1,000 mg O₂ per gram | Uneaten food fouls water |
| Biofilter | Half capacity at 0.5 mg N/L and at 2 mg/L oxygen; 4.57 mg O₂ per mg N | Saturates under overload |
| Temperature | Rate × (1 + 0.07 × (T − 20)), bounded 0.5–2; oxygen saturation cubic fit | Linear Q10 stand-in |
| Oxygen bands | Good ≥ 6 mg/L, low ≥ 4, critical below | Player labels |
| Ammonia bands | Clean < 0.5 mg N/L, elevated < 1.5, high above | Player labels |
| Stocking bands | Light < 4 kg/m³, moderate < 8, heavy < 12, overstocked above | Soft warning only; no fish is lost |

### Life model v1 (FS-302)

Game rules in `src/core/development.ts`; not biological growth laws.

| Parameter | Value | Reason / limitation |
|---|---:|---|
| Incubation | 3 game days | Inside the 2–4 day range above |
| Hatch length | 0.6 cm | Visible fry after hatching |
| Growth | Logistic: 0.27 per game day × growth potential (0.5–1.5) × condition | At potential 1 and full condition: adult 18–30 game days after laying (tested); slow growers take longer |
| Stages | Fry below 10% of adult length; adult from 70%; elderly after longevity × 365 game days | Derived from length and age |
| Condition | Moves 25% toward the day's environment factor each game day | Deficits and recovery take days |
| Oxygen factor | 0.1 at 0 mg/L → 0.6 at 4 → 1 at 6 | Matches the water bands |
| Ammonia factor | 1 at 0.5 mg N/L → 0.6 at 1.5 → 0.1 at 4 | Matches the water bands |
| Crowding factor | 1 at 8 kg/m³ → 0.8 at 12 → 0.4 at 24 | Soft stocking pressure |
| Nutrition | Factor 0.1 at 0% of need eaten → 0.55 at 50% → 1 at 85% or more | FS-305 feeding day; the factor multiplies the environment |
| Temperature | Comfort 1 from 18 to 26 °C, 0.2 at 8 and 34 °C; growth × (1 + 0.04 × (T − 22)), bounded 0.8–1.2 | FS-305; warmth speeds growth but holds less oxygen and raises demand |
| Stock and migrated fish | Young adults aged 30 game days at adult length potential | Matches how lab fish were always drawn |
| Water load | Mass from current length | Eggs add no load |
| Eggs | Cannot breed or be sold | GDD §5; normal breeding also requires adults (FS-401), while the instant lab cross still accepts any hatched fish |

### Care model v1 (FS-305)

Game rules in `src/core/care.ts` and `src/core/careAdvice.ts`; not aquarium-care advice.

| Parameter | Value | Reason / limitation |
|---|---:|---|
| Food need | 10 g per kg of fish per game day × metabolism × temperature rate | Eggs weigh nothing and need nothing |
| Feeder rations | Off 0×, Light 0.8×, Measured 1×, Generous 1.2×, Heavy 1.6× the current need | Dispensed every half-hour step from current biomass |
| Eating | Fish find 60% of the food present per step, never more than that step's need | Measured rations leave about 3% uneaten; extra food decays |
| Fed share | Food eaten ÷ food needed over each game day; a tank with no need counts as fed | One shared pool per tank, like the water model |
| Filter tiers | Compact 30, Standard 60, Strong 120, Industrial 240 g N per day | Prices ◈ 0 / 150 / 400 / 900; pay the difference to upgrade, lower tiers free |
| Aeration tiers | Gentle 12, Standard 24, Strong 36, Maximum 48 per day | Prices ◈ 0 / 100 / 300 / 650 |
| Thermostat | 16–30 °C, moves at most 0.1 °C per half-hour step | No running cost |
| Water change | 10%, 25% or 50%; ◈ 1 per m³ replaced (◈ 2 / 5 / 10 for 20 m³) | Siphons the same share of uneaten food |
| Manual portion | A quarter of a game day of the residents' need | Rejected when no hatched fish need food |
| Warning bands | Underfed below 85% fed, starving below 50%; leftovers above 5% of a day's need | Warnings open a preview; nothing applies until confirmed |
| Food cost | None | At one game day per minute, recurring food cost would dominate the lab economy and risk softlocks during protected absence; revisit in M5 |

Probe with 60 founder-distribution adults (155 kg, 7.8 kg/m³) and default equipment over 10 game days: Measured rations kept ammonia clean (0.31 mg N/L) with oxygen just low (5.8 mg/L); Generous reached elevated ammonia and low oxygen; Heavy reached high ammonia and critical oxygen. Half that stock on Measured rations had no warnings. A tank of 60 of the largest adults (836 kg) stays critical under any equipment; only moving fish helps.

### Stage appearance v1 and swim motion (FS-306)

Display rules in `src/core/juvenile.ts`, `src/rendering/fish.ts` and `src/ui/TankCanvas.tsx`; nothing here changes saved state or behavior.

| Parameter | Value | Reason / limitation |
|---|---:|---|
| Body maturity | Smoothstep of current length ÷ (0.7 × adult length) | Reaches 1 at the adult stage threshold |
| Pigment maturity | Smoothstep from game day 5 to 15 | Inside the GDD's 6–12 day reveal window after hatching |
| Hatchling proportions | Head 1.35× (at most 0.5), eye 1.7×, depth 0.78×, snout 0.6×, tail 0.55×, spread 0.7×, dorsal 0.45×, pectoral 0.7×, barbel 0.3× | Each returns to 1 with body maturity; anatomy v2 still limits eyes that cannot fit |
| Hatchling pigment | Red, black, metallic, fin pigment and speckle × pigment maturity; translucency at least 0.5 until revealed | Motifs, fin motifs, contrast and shimmer scale too; scale textures from 50% pigment |
| Maturity steps | Twentieths | Bounds cached stage phenotypes per fish |
| Tail beat | 3 + 5 × effort + 2 × activity radians per second × motion speed | Effort is swim speed over top speed |
| Tail sweep | Spread narrows up to 14% mid-stroke | Only shrinks, so anatomy bounds hold |
| Pectoral flutter | Folds toward the body by up to 35% of pectoral length | Portraits draw no motion |
| Turning | Facing eases 4 per second through side-on | Picking treats facing below 0.35 as 0.35 |
| Interpolation | Positions and time blend over each 50 ms worker frame | Paused tanks hold the last frame |

### Care scenarios (FS-307)

Seeded demonstration settings in `src/core/careScenario.ts`; they are not tuning targets for real tanks.

| Parameter | Value | Reason / limitation |
|---|---:|---|
| Length | 40 game days | Long enough to show decline and full recovery |
| Healthy tank | 30 founder-distribution adults, Measured rations, Standard filter and aeration, 22 °C | Stays at 100% condition with no warnings |
| Stressed tank | 45 adults, Generous rations, Compact filter, Standard aeration, 28 °C thermostat | Warnings from day 1 while fish are above 90%; condition falls to 13% by day 15 with oxygen 4.1–4.7 mg/L |
| Keeper | From day 16, applies every settings fix and water change named by the warnings; reviews every 5 days while warnings remain | One review (◈ 360) cleared every warning by day 18 |
| Rejected setup | 60 adults, Heavy rations, Compact filter, Gentle aeration, 29 °C | Oxygen 0.0 mg/L by day 1 and ammonia 73.55 mg N/L by day 15; condition kept falling six days after the first fix |
| Decline tolerance | 0.5 percentage points over an absence | Smaller changes do not count a fish as declined in the return summary |

### Breeding model v1 (FS-401/402)

Game rules in `src/core/breeding.ts`.

| Parameter | Value | Reason / limitation |
|---|---:|---|
| Tracked eggs per clutch | 8, 12, 16, 20 or 24, chosen when pairing | GDD first-playable range; reserved in the nursery before conception |
| Maturity | Adult stage: at least 70% of adult length | Same threshold as the life stage label |
| Condition | At least 70% to pair and to keep courting | Links breeding to care |
| Rest after spawning | Female 8, male 4 game days | Inside the 6–12 day cooldown hypothesis for females |
| Courtship speed | 0.5 progress per game day × fertility ÷ 0.6, bounded 0.25–0.75 | Two to four unpaused game days; the fertility locus is now active |
| Courtship pauses | Parents in different tanks, a parent below 70% condition, critical oxygen, high ammonia, or water outside 18–28 °C | Recorded daily with a reason and fix |
| Nursery limit | One courting clutch per nursery tank | Bounded, readable nursery management |
| Egg timestamp | Pairing time + game days × 60 real seconds | One game day per real minute at 1× |
| Instant lab cross | 20 eggs at once in the current tank, no courtship checks | Research shortcut; counts reservations |

## 2. Proposed solo launch tuning

| System | Initial experiment range | Measure |
|---|---|---|
| Game-day duration | 45–90 seconds at 1× | First retained juvenile within session |
| Maturity | 18–30 game days | Time to next selected generation |
| Incubation | 2–4 game days | Feedback without excessive waiting |
| Tracked fry per clutch | 8–24 | Comparison workload and capacity pressure |
| Breeding cooldown | 6–12 game days | Prevent continuous farm behavior |
| Active natural clutches | 1 per enabled tank by default | No unattended population explosion |
| Protected offline cap | 8 real hours, normal-speed conversion | Return experience and predictability |
| Small mutation probability | Experiment below lab rate | Visible novelty per retained cohort |
| Structural class probability | Start 1e-4 per tracked birth, then test | Discovery playtime distribution |
| Starter reserve | Several sessions of basic food and maintenance | No early economic softlock |

Choose one unit system and store tuning in versioned configuration after the lifecycle exists. Do not distribute magic numbers across UI components and worker code.

## 3. NPC quote model proposal

Use buyer-specific bounded terms:

```text
quote = eligible × clamp(
  base
  + visibleTraitBonus
  + boundedRarityEvidence
  + documentedBreederBonus
  − conditionPenalty
  − oversupplyPenalty,
  minimumEligibleQuote,
  buyerBudget
)
```

Eligibility checks stage, ownership and listing locks. A fish can always be rehomed through an economy-neutral option even if a collector will not pay. The model’s breakdown should be explainable in the inspector.

Demand is a finite buyer budget and quantity over a simulated time window. Avoid a global multiplier that raises every fish price indefinitely. New founder purchase and guaranteed resale must not form a profitable immediate loop. Costs of breeding, nursery care, retention and unused capacity must be included in economy experiments.

No real-money conversion, cash-out, token economy, or paid mutation chance is defined.

## 4. Experiments to run before changing rates

### E-01: visible inheritance

Show two parent pairs and shuffled child cohorts. Ask observers to match each cohort to its parents and describe the cues. Record sample size and chance baseline. Repeat with silhouettes only and patterns only to identify the weak channel.

**Status (FS-105/111):** Research → Resemblance study runs 12 fixed blind trials (4 each in full, silhouette-only and markings-only modes) and exports a result record. A computational observer names the source pair in 99.7% (silhouette), 89.0% (markings) and 98.7% (combined) of 300 seeded trials. Five anonymous observers scored 54/60 overall (full 19/20, silhouette 20/20, markings 15/20), and each mode's 95% lower bound is above chance. Markings are the weak channel: all five markings misses were the same trial. No cue notes were supplied. See [FS-111 human resemblance](research/FS-111-HUMAN-RESEMBLANCE.md).

### E-02: artificial selection

For each selected descriptor, create 20 replicate seed populations; retain a declared proportion and breed for 10–30 generations. Compare to random mating. Plot mean, variance, survival/geometry validity and heterozygosity. Add a multi-objective experiment for long tails with adequate swimming performance.

**Status (FS-105, reduced):** 8 replicate lines per trait, 40 fish per generation, top 4 + 4 parents, 10 generations, with random-mating controls. All six traits ended beyond the founders' 10th–90th percentile range in 8 of 8 lines, while mean pedigree F reached 0.80 and heterozygosity fell from 77% to 14–19%. The 20-replicate, 10–30-generation version and the multi-objective long-tail experiment remain open. The original body-depth regression still runs in the core tests.

### E-03: mutation discovery

Simulate realistic tracked birth counts per session and week. Report median and 10th/90th percentile time to small and structural novelty. A theoretically exciting 1-in-100,000 event may be irrelevant to almost every player.

### E-04: care sensitivity

Raise identical genomes under healthy, underfed, overcrowded and recovering conditions. Changes should be directional, bounded and reversible where the design intends. Current condition should not instantly overwrite accumulated developmental history.

### E-05: economy and capacity

Compare observation-focused, selective breeder, maximum-output breeder and collector-contract strategies over a simulated month. Track net credits, fish count, upkeep, rehome count, variance and softlocks. Bound dominant exploit paths before introducing online trade.

### E-06: lineage stability

Select a recognizable pattern/body combination across unrelated outcrosses and increasingly related crosses. Measure target similarity, coancestry and explicit recessive burden. Confirm the UI does not confuse these values.

## 5. Reporting template

Experiment ID, code/model version, seed set, population size, retained cohort policy, environment, time settings, measured descriptors, comparison condition, result, uncertainty, plots/fixtures, recommended tuning change, and risks. Save reproducible configurations in the repository. Do not report a universal conclusion from one attractive screenshot.
