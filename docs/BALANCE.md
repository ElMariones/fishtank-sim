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
| Food target lifetime | 8 simulated motion seconds | Attraction demo; no nourishment or waste |

### Water model v1 (FS-301)

Game-rule approximations in `src/core/water.ts`; not aquarium-care advice.

| Parameter | Value | Reason / limitation |
|---|---:|---|
| Care time | 1 game day = 1,200 ticks = 60 real seconds at 1× | GDD pacing hypothesis; motion speed does not change it |
| Integration step | 25 ticks (half a game hour) | Fixed absolute steps; aeration and decay cannot overshoot |
| Default tank | 20,000 L at 22 °C, filter 60,000 mg N/day, aeration 24/day | A full tank of average adult lab fish stays "good" and "clean" |
| Fish respiration | 6,000 mg O₂ per kg per day × metabolism × oxygen demand | Lab fish count at adult genetic potential until FS-302 |
| Fish excretion | 100 mg ammonia N per kg per day × metabolism | Basal only; food-derived excretion arrives with feeding |
| Fish mass | 0.0148 g × length³ (cm) | Koi-like proportions: 52 cm ≈ 2.1 kg |
| Food decay | 2 per day; 50 mg N and 1,000 mg O₂ per gram | Uneaten food fouls water |
| Biofilter | Half capacity at 0.5 mg N/L and at 2 mg/L oxygen; 4.57 mg O₂ per mg N | Saturates under overload |
| Temperature | Rate × (1 + 0.07 × (T − 20)), bounded 0.5–2; oxygen saturation cubic fit | Linear Q10 stand-in |
| Oxygen bands | Good ≥ 6 mg/L, low ≥ 4, critical below | Player labels |
| Ammonia bands | Clean < 0.5 mg N/L, elevated < 1.5, high above | Player labels |
| Stocking bands | Light < 4 kg/m³, moderate < 8, heavy < 12, overstocked above | Soft warning only; no fish is lost |

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
