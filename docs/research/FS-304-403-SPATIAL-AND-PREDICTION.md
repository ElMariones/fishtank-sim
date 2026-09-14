# FS-304 spatial steering and FS-403 offspring prediction

14 September 2026. DONE, pushed `5dbfb73`. World v3, runtime/save schema unchanged; behavior model 2, motion protocol 2, prediction model 1. Genome/development/anatomy/fish renderer versions unchanged.

## Repository review

Fetched origin before work: `953143d` was both HEAD and origin/main. No tracked changes or unpushed commits existed. Only `.claude/launch.json` was untracked; it is excluded from this work. The documentation describes M1/M2 and FS-301–303 as delivered, with the remaining M3 care and M4 lifecycle still planned.

## Delivered

FS-304 builds a spatial hash from each immutable motion snapshot and queries neighboring cells for utility, separation and cohesion. Candidates are restored to source order so floating-point sums and tie behavior remain deterministic. School leaders use a map lookup. Exact distance tests remain in behavior selection/steering.

Canvas and motion share two permeable plant-cover areas and two circular solid rock footprints, expressed in normalized tank coordinates. Canvas displays circles as ellipses when the viewport aspect differs. Steering anticipates rocks, and a collision correction removes inward velocity while preserving tangent motion. A newly enabled rock can move an overlapping fish out on the next motion step. The existing saved planted boolean selects the preset; no schema or biological model changes are needed. UI text describes both plants and rocks and their visual-only effects.

The hash avoids unconditional all-pairs scans. At constant spatial density, a fourfold population increase (400 to 1,600) requires less than fivefold candidate visits, versus sixteenfold for all-pairs. It does not promise linear cost at arbitrary density: a cluster inside one neighborhood can still be quadratic. The 60-fish tank cap is unchanged.

FS-403 implements exact unordered genotype odds for any of the 60 loci, before mutation. Genome v1 contributes the classic baseline at appended appearance loci. Existing categorical target-copy odds remain separate.

The planner samples 256 genome-v2 offspring with linked meiosis and the 0.003 per-copy lab mutation rate. Seeds use a prediction-only namespace based on the two genome fingerprints and sample index. Opening/changing predictions never consumes world sequence IDs or changes a later clutch. Goals select measurements from the same sample, rather than rerolling it. The table shows adult length in cm and selected goal expression scores, each with median and empirical 10th–90th percentiles. Labels distinguish expression scores, exact odds, marginal ranges and confidence intervals. Stable genome/goal keys memoize the bounded sampling work across live state updates.

FS-403 was implemented ahead of FS-401/402 because its pure genetics input contract already exists. It makes no eligibility, courtship or nursery claim. Integrating it into normal breeding remains part of those tasks and M4's release gate.

## Verification

- Windows, Node 24.11.1 / npm 11.6.2: `npm run check` passes 111 tests in 18 files, strict TypeScript and production build. `node scripts/check-docs.mjs` and `git diff --check` pass.
- Five spatial fixtures compare exact ordered neighbors with brute force across boundaries/coincident positions; compare utility decisions; bound constant-density candidate growth; run 2,000 steps with a fish initially inside a rock; and verify tangent velocity, cover access, finite values and tank bounds.
- Five prediction fixtures cover Mendelian 1:2:1, all-locus normalization, v1/v2 crosses, unchanged future birth records/world state, reproducible bounded percentiles, fixed-parent extremes and invalid goal/locus requests. Existing genetics/replay/lifecycle/worker tests remain green.
- In-app Chromium, isolated QA origin `http://127.0.0.1:5175`: Haru × Sumi shows adult-length range 58.5–65.3 cm; adding Tail length shows 7–32% expression. Choosing the two goal leaders selects Kohaku × Momo and changes these to 37.6–57.3 cm and 28–58%. Selecting Base color shows 50% genotype 0/0 and 50% 0/1.
- Habitat off/on removes/restores plants and rocks; fish continue swimming and the inspector reports behavior. Reload retains the world/habitat and saved goal, restores default parent picks as before, and recomputes the same default-pair prediction without save recovery errors. No browser warning/error logs were reported.
- At 375 × 812, the table wraps within its panel with no document overflow. Browser QA found the existing two-column action layout squeezed the Breed button; it now places capacity feedback on its own row. The repaired button measures 290 px wide, with document width 360 px. Desktop disclosure and phone button rechecked after the fix. Breeding after preview creates one 20-egg cohort; reload retains 26 fish without errors. The usual port 5173 world was not touched.

## Limits and next work

Obstacle clearance is a fixed body-center proxy, not a morphology-aware collision mesh: long fins can overlap rocks, and arbitrary decoration placement is FS-503. Normalized geometry is not physical tank dimensions. Dense-neighborhood work and device-specific frame timing still need later profiling.

Percentiles are estimates from one deterministic sample, not guaranteed offspring bounds, a confidence interval, joint-trait odds or rarity estimates. Rare mutation tails may be absent. Adult potential does not predict current care-dependent growth. The exact panel uses allele IDs; named allele inspection remains in the Genome tab.

M3 FS-305–307 and M4 FS-401/402/404–406 remain open. Neither milestone is declared complete. Next: care controls and recovery, juvenile reveal, integrated M3 demonstration, then normal breeding and nursery scheduling.
