# FS-105 selection and resemblance

**Recorded:** 13 September 2026  
**Models:** genome v1 · development v2 · anatomy v2 · renderer v3  
**Surfaces:** Research → Selection experiment · Research → Resemblance study

## Scope

FS-105 asks for a ten-generation selection report and a small resemblance study. This note separates three kinds of evidence:

- **Automated and complete:** a seeded selection experiment (a reduced BALANCE E-02) and a computational observer for resemblance (an automated stand-in for E-01).
- **Delivered, not yet used by people:** a blind in-app resemblance study that any observer can take and share.
- **Not claimed:** human recognition of family resemblance. No observers have taken the study yet; that work is FS-111.

## Selection experiment

### Method

- **Traits:** body length ↑, body depth ↑, tail length ↑, eye size ↓, pattern count ↑, warm pigment ↑.
- **Lines:** 8 replicate lines per trait. Each replicate starts from 40 seeded founders (20 female, 20 male), shared across traits.
- **Selection:** each generation keeps the top 4 females and top 4 males for the trait (20% truncation). Partners rotate every generation, each pair has 10 children (5 of each sex), and the lab mutation rate stays at 0.003 per transmitted copy. Ten generations.
- **Control:** random-mating lines keep 4 + 4 random parents from the same founders.
- **Measures:** trait mean and standard deviation, heterozygosity, exact pedigree F within the line (founders unrelated), mean speed, and anatomy validation of every generation-10 fish.
- **Pass rule:** the typical range is the 10th–90th percentile of the pooled founders (320 per trait). A trait passes when at least 6 of 8 selected lines end beyond it in the selected direction and shift further than the random lines. The GDD gate needs at least three traits.

### Results

Node and browser runs agree exactly.

| Trait | Founder range | Selected lines beyond | Random lines beyond | Shift selected / random | Pedigree F, gen 10 | Heterozygosity | Speed |
|---|---|---:|---:|---:|---:|---|---|
| Body length ↑ | 20–60% | 8 / 8 | 1 / 8 | +55 / +8 points | 0.80 | 77% → 19% | 0.042 → 0.042 |
| Body depth ↑ | 20–60% | 8 / 8 | 1 / 8 | +59 / +2 | 0.81 | 77% → 17% | 0.042 → 0.044 |
| Tail length ↑ | 17–45% | 8 / 8 | 2 / 8 | +65 / +6 | 0.76 | 77% → 18% | 0.042 → 0.034 |
| Eye size ↓ | 20–60% | 8 / 8 | 0 / 8 | −42 / −3 | 0.83 | 77% → 14% | 0.042 → 0.040 |
| Pattern count ↑ | 23–69% | 8 / 8 | 0 / 8 | +59 / −4 | 0.81 | 77% → 16% | 0.042 → 0.040 |
| Warm pigment ↑ | 19–64% | 8 / 8 | 0 / 8 | +60 / +3 | 0.78 | 77% → 17% | 0.042 → 0.039 |

Generation-10 means were 96–100% for the "higher" traits and 0% for eye size, against 37–51% in random-mating lines.

**Outcome:** all six traits pass, so the GDD selection criterion passes. All 3,840 generation-10 fish (selected and random) passed anatomy validation. The full run takes about 0.7 s in Node and 0.9 s in a browser tab.

### Failures and costs

1. **Saturation.** Selected lines hit the development-v1 ceiling (or floor) within about 4–7 generations. After that, the additive A0–A5 range limits progress, not selection. Continued progress towards unusual fish needs new mutation classes or topology (genome v2), which confirms the M6 dependency.
2. **Diversity collapse.** With 4 + 4 parents, mean pedigree F reaches about 0.80 and heterozygosity falls from 77% to 14–19% in ten generations. The lab lets a player do this for free, and the only warning is the expected F shown before a cross. Larger retained sets and outcrossing should be tested (BALANCE E-06) before breeding balance in M4.
3. **The speed tradeoff is noisy.** Tail selection lowers mean speed (0.042 → 0.034) and ends below random-mating lines. Correlated drift in thrust and body depth moves speed in other lines too: depth-selected lines ended slightly faster on average. In small populations speed is not a clean single-trait readout.
4. **Controls drift.** One or two of eight random-mating lines ended beyond the founder range for length, depth and tail. Any selection claim in this lab needs its control lines.

## Resemblance: computational observer

A trial shows two unrelated founder pairs and a cohort bred from one of them; the observer names the source pair. The silhouette channel compares the cohort's mean of ten normalized morphology descriptors with each midparent. The markings channel compares visible marking masks with each parent. The combined channel adds both margins after scaling each by its median size.

| Channel | Cohort of 4 siblings (300 trials) | Single child (300 trials) |
|---|---:|---:|
| Silhouette | 99.7% (95% CI 98.1–99.9%) | 96.3% (93.6–97.9%) |
| Markings | 89.0% (85.0–92.1%) | 79.7% (74.8–83.8%) |
| Combined | 98.7% (96.6–99.5%) | 95.3% (92.3–97.2%) |

On the 12 fixed human trials, the observer answers 4 of 4 correctly in every mode.

**Interpretation:** the rendered phenotype carries enough information to identify families, especially through silhouettes. This is an upper bound. The observer reads exact measurements and perfect masks, while people see small portraits and have limited attention. It does **not** show that people recognise the resemblance.

## Resemblance: human study

- **Format:** Research → Resemblance study runs 12 fixed blind trials, seeded and identical for every observer. There are 4 trials per mode (full appearance, silhouette only, markings only), each with 4 siblings and two parent pairs.
- **Recording:** each trial takes an answer and an optional cue note, and the last answer can be undone. Progress is stored on the device under `fishtank-sim.study.v1`.
- **Display modes:** silhouette mode neutralises colour and hides markings. Markings mode draws every fish on the standard all-A2 body. Only display phenotypes change; the renderer does not.
- **Results page:** per-mode accuracy with Wilson 95% intervals beside the computational observer, per-trial answers, and a JSON record to copy. It records no names, accounts or device details.
- **Status:** verified with scripted answers, which were then cleared. **No human observer has taken it.** One person's 12 trials give wide intervals (6 of 12 correct spans 25–75%). FS-111 targets at least five observers (60 trials, 20 per mode), pooled from their copied records.

## Gate status

| Criterion (GDD §14) | Status |
|---|---|
| Ten selected generations shift at least three descriptors beyond the typical range | **Passed:** 6 of 6 traits, 8 of 8 lines each |
| Offspring stay finite, renderable and inspectable | Passed for 10 generations here; the 100-generation soak remains M7 (FS-702) |
| People identify the correct parent pair more often than chance | **Not yet tested:** FS-111 |

## Reproduction

Run `npm test`; `tests/selection.test.ts` and `tests/resemblanceStudy.test.ts` pin the gate, costs, trial set and observer thresholds. In the app, open **Research → Selection experiment → Run experiment**, or **Research → Resemblance study**.
